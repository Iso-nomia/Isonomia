/**
 * Phase 10a (task 10.6) — Webmention receiver support.
 *
 * Verifies that an external `source` page actually links back to one of our
 * `target` permalinks, then records it as an `ExternalCitation`. Per locked
 * decision D2, a verified backlink is stored `unreviewed` and displayed by
 * default; it is excluded from the headline cited-by count until a moderator
 * promotes it to `trusted`.
 *
 * SECURITY: `source` is attacker-controlled and we fetch it server-side, so
 * every fetch goes through `assertSafePublicUrl` (SSRF guard: http(s) only,
 * DNS-resolved to a public IP, redirects disallowed, response size-capped).
 * The pure helpers (`ipIsPrivate`, `htmlLinksTo`, `parseTargetPath`) are
 * exported for unit testing without touching the network.
 */

import net from "node:net";
import { lookup } from "node:dns/promises";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prismaclient";
import { resolvePermalink } from "@/lib/citations/permalinkService";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // 512 KB is plenty for a page's <head> + links

// --- 10.6a iterable quality gates ------------------------------------------
// Per-domain rate limit + an opt-in trusted-domain boost. Both are tunable
// (env / constants) — the "iterate the gates" half of the D2 decision. The
// rate limit FAILS OPEN when Redis is unconfigured or errors, because
// verification is the primary anti-spam control and a broken cache must not
// take down the receiver.
const DOMAIN_WINDOW_S = 3600;
const DOMAIN_MAX_PER_WINDOW = 20;

let _redis: Redis | null | undefined;
function redisClient(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

/** Fixed-window per-source-domain limiter. Fail-open by design. */
export async function checkDomainRateLimit(
  domain: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const r = redisClient();
  if (!r || !domain) return { allowed: true, remaining: DOMAIN_MAX_PER_WINDOW };
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % DOMAIN_WINDOW_S);
  const key = `webmention:rl:${domain}:${windowStart}`;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, DOMAIN_WINDOW_S);
    return {
      allowed: count <= DOMAIN_MAX_PER_WINDOW,
      remaining: Math.max(0, DOMAIN_MAX_PER_WINDOW - count),
    };
  } catch {
    return { allowed: true, remaining: DOMAIN_MAX_PER_WINDOW };
  }
}

/** Opt-in allowlist that BOOSTS a domain to `trusted` — never a precondition
 *  for being recorded/displayed (D2: boost, not admit). */
export function isTrustedDomain(domain: string): boolean {
  const raw = process.env.WEBMENTION_TRUSTED_DOMAINS ?? "";
  const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(domain.toLowerCase());
}

export interface WebmentionTarget {
  targetType: "argument" | "claim";
  /** The path identifier: an argument short-code or a claim MOID. */
  identifier: string;
}

/** True for loopback / private / link-local / unique-local addresses. */
export function ipIsPrivate(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // malformed → unsafe
    if (p[0] === 10) return true;
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local (incl. cloud metadata)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase();
    if (ip6 === "::1" || ip6 === "::") return true; // loopback / unspecified
    if (ip6.startsWith("fe80")) return true; // link-local
    if (ip6.startsWith("fc") || ip6.startsWith("fd")) return true; // unique-local
    if (ip6.startsWith("::ffff:")) return ipIsPrivate(ip6.slice(7)); // v4-mapped
    return false;
  }
  return true; // not a recognizable IP → treat as unsafe
}

/** Reject non-public URLs before any server-side fetch. Throws on unsafe. */
export async function assertSafePublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("unsupported_scheme");
  const host = u.hostname;
  if (!host || /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new Error("private_host");
  }
  const addrs = net.isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new Error("dns_failed");
      });
  if (!addrs.length) throw new Error("dns_empty");
  for (const a of addrs) {
    if (ipIsPrivate(a.address)) throw new Error("private_address");
  }
  return u;
}

/** Map a target URL on our domain to its {type, identifier}, or null. */
export function parseTargetPath(targetUrl: string): WebmentionTarget | null {
  let u: URL;
  try {
    u = new URL(targetUrl);
  } catch {
    return null;
  }
  const baseHost = (() => {
    try {
      return new URL(BASE_URL).hostname;
    } catch {
      return "isonomia.app";
    }
  })();
  const host = u.hostname.replace(/^www\./, "");
  if (host !== baseHost.replace(/^www\./, "")) return null;

  const arg = u.pathname.match(/^\/a\/([A-Za-z0-9_-]+)(?:@[^/]+)?\/?$/);
  if (arg) return { targetType: "argument", identifier: arg[1] };
  const claim = u.pathname.match(/^\/c\/([A-Za-z0-9_-]+)\/?$/);
  if (claim) return { targetType: "claim", identifier: claim[1] };
  return null;
}

/** Resolve a parsed target to a concrete DB row id, or null if it doesn't exist. */
export async function resolveTargetId(
  t: WebmentionTarget,
): Promise<{ targetType: "argument" | "claim"; targetId: string } | null> {
  if (t.targetType === "argument") {
    const resolved = await resolvePermalink(t.identifier);
    return resolved ? { targetType: "argument", targetId: resolved.argumentId } : null;
  }
  const claim = await prisma.claim.findFirst({
    where: { moid: t.identifier },
    select: { id: true },
  });
  return claim ? { targetType: "claim", targetId: claim.id } : null;
}

/** Does the source HTML contain a link to the target (full URL or its path)? */
export function htmlLinksTo(html: string, targetUrl: string): boolean {
  let path = targetUrl;
  try {
    path = new URL(targetUrl).pathname;
  } catch {
    /* keep full string */
  }
  // Require the link to appear inside an href/src attribute, not just anywhere,
  // so a page merely *mentioning* the URL in prose doesn't count as a backlink.
  const needle = targetUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const needlePath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:href|src)\\s*=\\s*["'][^"']*(?:${needle}|${needlePath})`, "i");
  return re.test(html);
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,300})<\/title>/i);
  return m ? m[1].trim() : null;
}

/**
 * Fetch the source page (SSRF-guarded, no redirects, size-capped) and confirm
 * it links back to `targetUrl`. Returns the page title on success.
 */
export async function verifyBacklink(
  sourceUrl: string,
  targetUrl: string,
): Promise<{ ok: boolean; title: string | null; reason?: string }> {
  let safe: URL;
  try {
    safe = await assertSafePublicUrl(sourceUrl);
  } catch (e) {
    return { ok: false, title: null, reason: (e as Error).message };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(safe.toString(), {
      redirect: "error", // a redirect could bounce us past the SSRF check
      signal: controller.signal,
      headers: { "User-Agent": "IsonomiaWebmention/1.0", Accept: "text/html" },
    });
    if (!res.ok) return { ok: false, title: null, reason: `source_status_${res.status}` };

    // Read at most MAX_BYTES so a hostile source can't stream us to death.
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (total >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    } else {
      html = (await res.text()).slice(0, MAX_BYTES);
    }

    if (!htmlLinksTo(html, targetUrl)) {
      return { ok: false, title: null, reason: "no_backlink" };
    }
    return { ok: true, title: extractTitle(html) };
  } catch (e) {
    return { ok: false, title: null, reason: (e as Error).name === "AbortError" ? "timeout" : "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Upsert a verified backlink as an `unreviewed` ExternalCitation (D2). */
export async function recordExternalCitation(input: {
  targetType: "argument" | "claim";
  targetId: string;
  sourceUrl: string;
  title: string | null;
}): Promise<{ id: string; trustState: string }> {
  const sourceDomain = (() => {
    try {
      return new URL(input.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  // Boost, not admit: an allowlisted domain records straight to `trusted`;
  // everyone else lands `unreviewed` (displayed, not counted). Never blocks.
  const boosted = sourceDomain ? isTrustedDomain(sourceDomain) : false;

  const row = await prisma.externalCitation.upsert({
    where: {
      targetType_targetId_sourceUrl: {
        targetType: input.targetType,
        targetId: input.targetId,
        sourceUrl: input.sourceUrl,
      },
    },
    // Re-verification refreshes the timestamp/title but never silently
    // re-opens a citation a moderator hid, so trustState is left untouched here.
    update: { verifiedAt: new Date(), title: input.title, sourceDomain },
    create: {
      targetType: input.targetType,
      targetId: input.targetId,
      sourceUrl: input.sourceUrl,
      sourceDomain,
      title: input.title,
      verifiedAt: new Date(),
      ...(boosted ? { trustState: "trusted" as const } : {}),
      // otherwise trustState defaults to `unreviewed` in the schema.
    },
    select: { id: true, trustState: true },
  });
  return row;
}
