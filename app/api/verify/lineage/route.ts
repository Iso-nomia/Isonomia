/**
 * POST /api/verify/lineage
 *
 * verify-mode-B v2 — shared-root / convergent-lineage detection (C5). Input is a
 * page's outbound links (URLs only — privacy-light, no page body). For each source
 * it fetches the page and extracts upstream signals (cited DOIs, wire byline, press
 * releases), then unions sources that share an upstream: "N sources → M lineages".
 * This is the "three articles → one press release / one study" check.
 *
 * Heavier than /resolve (each source is fetched + parsed), so a tighter rate limit.
 * Honest: reports shared roots it could identify; absence of convergence is NOT
 * evidence of independence (the decisive signal is often unrecoverable).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { isSafePublicUrl } from "@/lib/unfurl";
import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { fetchUpstreams, clusterByUpstream, type SourceWithUpstream } from "@/lib/verify/lineage";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const MAX_URLS = 15;
const CONCURRENCY = 3;

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  limiter: Ratelimit.fixedWindow(10, "1 h"),
  prefix: "rl:verify-lineage",
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

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

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const { success } = await ratelimit.limit(String(userId));
  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — max 10 deep provenance checks per hour" },
      { status: 429, headers: CORS },
    );
  }

  const body = await req.json().catch(() => ({}));
  const raw: unknown = (body as any)?.urls;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ ok: false, error: "urls[] required" }, { status: 400, headers: CORS });
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const u of raw) {
    if (typeof u !== "string") continue;
    const url = u.trim();
    if (!url || seen.has(url) || !isSafePublicUrl(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_URLS) break;
  }
  if (urls.length === 0) {
    return NextResponse.json({ ok: false, error: "no safe public URLs" }, { status: 400, headers: CORS });
  }

  const sources: SourceWithUpstream[] = await mapPool(urls, CONCURRENCY, async (url) => {
    let canonical = url;
    let ownDoi: string | undefined;
    let title: string | null = null;
    try {
      const rc = await resolveUrlToCitation(url);
      canonical = rc.canonicalUrl || url;
      ownDoi = rc.doi ?? rc.derivedIdentifiers?.doi ?? undefined;
      title = rc.source?.title ?? null;
    } catch {
      /* resolution soft-fails; still try to fetch upstreams from the raw URL */
    }
    const upstreams = await fetchUpstreams(canonical, { ownDoi });
    return { id: url, url, title, upstreams };
  });

  const result = clusterByUpstream(sources);

  return NextResponse.json(
    {
      ok: true,
      result,
      note:
        "v2 deep provenance: sources sharing an upstream (cited study DOI, wire byline, or press release) are one lineage. Reports shared roots we could identify — absence of convergence is NOT evidence of independence, and this is a heuristic, not proof.",
    },
    { status: 200, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
