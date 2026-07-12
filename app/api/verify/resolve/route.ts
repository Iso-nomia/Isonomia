/**
 * POST /api/verify/resolve
 *
 * verify-mode-B v0 — resolver-backed convergence. Takes the outbound links from a
 * page (URLs only — privacy-light, no page body), resolves each to its citation
 * identity, and clusters by identity root to report "N tellings → M roots".
 *
 * Privacy: URLs only; no page content. No DB writes (calls `resolveUrlToCitation`
 * directly, not the persisting `resolveAll`). SSRF-guarded per URL, auth-gated,
 * rate-limited like /api/unfurl.
 *
 * Honest scope (v0): catches the same source reached by multiple URLs (shared DOI
 * or identical canonical URL). It does NOT detect "different articles sharing an
 * upstream press release" — that is v2 (needs each source's own outbound citations).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { isSafePublicUrl } from "@/lib/unfurl";
import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { clusterConvergence, type ResolvedRef } from "@/lib/verify/convergence";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const MAX_URLS = 25;
const RESOLVE_CONCURRENCY = 4;

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  // Each call fans out to up to MAX_URLS resolutions, so a tighter window than unfurl.
  limiter: Ratelimit.fixedWindow(20, "1 h"),
  prefix: "rl:verify-resolve",
});

/** Run `fn` over `items` with a fixed concurrency cap, preserving order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const { success: withinLimit } = await ratelimit.limit(String(userId));
  if (!withinLimit) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — max 20 page checks per hour" },
      { status: 429, headers: CORS },
    );
  }

  const body = await req.json().catch(() => ({}));
  const raw: unknown = (body as any)?.urls;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ ok: false, error: "urls[] required" }, { status: 400, headers: CORS });
  }

  // Dedup exact-duplicate input URLs up front, cap, and drop unsafe/invalid.
  const seen = new Set<string>();
  const safeUrls: string[] = [];
  const skipped: string[] = [];
  for (const u of raw) {
    if (typeof u !== "string") continue;
    const url = u.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    if (safeUrls.length >= MAX_URLS) break;
    if (isSafePublicUrl(url)) safeUrls.push(url);
    else skipped.push(url);
  }

  if (safeUrls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no safe public URLs to resolve", skipped },
      { status: 400, headers: CORS },
    );
  }

  const refs: ResolvedRef[] = await mapPool(safeUrls, RESOLVE_CONCURRENCY, async (url) => {
    try {
      const rc = await resolveUrlToCitation(url);
      let domain: string | null = null;
      try {
        domain = new URL(rc.canonicalUrl || url).hostname;
      } catch {
        /* leave null */
      }
      return {
        inputUrl: url,
        canonicalUrl: rc.canonicalUrl || "",
        doi: rc.doi ?? rc.derivedIdentifiers?.doi ?? null,
        domain,
        title: rc.source?.title ?? null,
        confidence: rc.confidence,
      };
    } catch {
      // Resolver soft-fails to a URL-identity ref so the link is still counted.
      let domain: string | null = null;
      try {
        domain = new URL(url).hostname;
      } catch {
        /* leave null */
      }
      return { inputUrl: url, canonicalUrl: url, doi: null, domain, title: null, confidence: "none" };
    }
  });

  const result = clusterConvergence(refs);

  return NextResponse.json(
    {
      ok: true,
      result,
      skippedUnsafe: skipped.length,
      note:
        "v0 convergence: same source via multiple URLs (shared DOI or identical canonical URL). Does NOT detect distinct articles sharing an upstream source — that is v2. Absence of convergence is not evidence of independence.",
    },
    { status: 200, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
