
// lib/unfurl.ts
import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";

const TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function hashUrl(url: string) {
  return crypto.createHash("sha256").update(url.trim().toLowerCase()).digest("hex");
}

export function isSafePublicUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    // Block localhost & private ranges
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    // Block IP literals in private/reserved ranges
    const ip = parseIp(host);
    if (ip && isPrivateIp(ip)) return false;
    return true;
  } catch { return false; }
}

function parseIp(host: string): string | null {
  // crude but OK: IPv4 dotted quad
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  return null;
}
function isPrivateIp(ip: string) {
  const [a,b] = ip.split(".").map(x => parseInt(x,10));
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true; // loopback
  return false;
}

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    if (!r.ok) return "";
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function parseOpenGraph(html: string) {
  const out: { title?: string; desc?: string; image?: string; robotsBlocked?: boolean } = {};
  const get = (name: string) => {
    const re = new RegExp(`<meta[^>]+property=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
    const m = re.exec(html);
    return m?.[1];
  };
  out.title = get("og:title") ?? (/<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? undefined);
  out.desc =
    get("og:description") ??
    (/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1] ?? undefined);
  out.image = get("og:image") ?? undefined;

  // robots
  const robots =
    (/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html)?.[1] ?? "").toLowerCase();
  out.robotsBlocked = robots.includes("noindex") || robots.includes("none");

  return out;
}

export async function getOrFetchLinkPreview(url: string, facetId?: bigint) {
  const urlHash = hashUrl(url);

  const existing = await prisma.linkPreview.findUnique({ where: { urlHash } });
  if (existing && Date.now() - existing.fetchedAt.getTime() < TTL_MS) return existing;

  if (!isSafePublicUrl(url)) {
    return prisma.linkPreview.upsert({
      where: { urlHash },
      update: { status: "blocked", fetchedAt: new Date(), facetId: facetId ?? undefined },
      create: { urlHash, url, status: "blocked", facetId: facetId ?? undefined },
    });
  }

  try {
    const html = await fetchWithTimeout(url, 4500);
    const og = parseOpenGraph(html);
    const status = og.robotsBlocked ? "noindex" : "ok";

    return prisma.linkPreview.upsert({
      where: { urlHash },
      update: { title: og.title, desc: og.desc, image: og.image, status, fetchedAt: new Date(), facetId: facetId ?? undefined },
      create: { urlHash, url, title: og.title, desc: og.desc, image: og.image, status, facetId: facetId ?? undefined },
    });
  } catch {
    return prisma.linkPreview.upsert({
      where: { urlHash },
      update: { status: "error", fetchedAt: new Date(), facetId: facetId ?? undefined },
      create: { urlHash, url, status: "error", facetId: facetId ?? undefined },
    });
  }
}
