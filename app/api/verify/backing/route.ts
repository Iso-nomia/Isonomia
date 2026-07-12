/**
 * POST /api/verify/backing
 *
 * verify-mode-B v1b — the hollow-citation check (C4). Input is `{ pairs:
 * {claim, citedUrl}[] }` — claim-spans extracted ON-DEVICE, plus the URLs they
 * cite. NEVER the page body (Q-057). For each pair: resolve the citation → fetch
 * the source's body text (fall back to its abstract) → ask the backing judge
 * whether the source supports the claim → return a verdict with its OWN confidence.
 *
 * Privacy (Q-057): claim-spans only; no page content; **no storage** (nothing is
 * persisted or logged with the claim text). On-demand, auth-gated, rate-limited.
 *
 * Honest states: backs / contradicts / unrelated (the hollow-citation flag) /
 * unverifiable (source text unretrievable — NOT an accusation).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { resolveUrlToCitation } from "@/lib/citation/resolve";
import { fetchSourceText } from "@/lib/verify/sourceText";
import { assessBacking, shapeVerdict, type SourceKind } from "@/lib/verify/backing";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const MAX_PAIRS = 12;
const CONCURRENCY = 3;

const ratelimit = new Ratelimit({
  redis: new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  }),
  // Heavier than /resolve — each pair fans out to a fetch + an LLM call.
  limiter: Ratelimit.fixedWindow(10, "1 h"),
  prefix: "rl:verify-backing",
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

interface Pair {
  claim: string;
  citedUrl: string;
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const { success } = await ratelimit.limit(String(userId));
  if (!success) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — max 10 backing checks per hour" },
      { status: 429, headers: CORS },
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawPairs: unknown = (body as any)?.pairs;
  if (!Array.isArray(rawPairs) || rawPairs.length === 0) {
    return NextResponse.json({ ok: false, error: "pairs[] required" }, { status: 400, headers: CORS });
  }

  const pairs: Pair[] = [];
  for (const p of rawPairs) {
    const claim = typeof (p as any)?.claim === "string" ? (p as any).claim.trim() : "";
    const citedUrl = typeof (p as any)?.citedUrl === "string" ? (p as any).citedUrl.trim() : "";
    if (claim && citedUrl) pairs.push({ claim, citedUrl });
    if (pairs.length >= MAX_PAIRS) break;
  }
  if (pairs.length === 0) {
    return NextResponse.json({ ok: false, error: "no valid {claim, citedUrl} pairs" }, { status: 400, headers: CORS });
  }

  const results = await mapPool(pairs, CONCURRENCY, async (pair) => {
    // Resolve the citation (reuse the v0 resolver; no DB writes).
    let canonicalUrl = pair.citedUrl;
    let abstract: string | undefined;
    let title: string | null = null;
    try {
      const rc = await resolveUrlToCitation(pair.citedUrl);
      canonicalUrl = rc.canonicalUrl || pair.citedUrl;
      abstract = rc.source?.abstractText || undefined;
      title = rc.source?.title ?? null;
    } catch {
      /* resolution soft-fails; we still try the raw URL for body text */
    }

    // Prefer full body text; fall back to the abstract; else nothing.
    let sourceText = "";
    let sourceKind: SourceKind = "none";
    const body = await fetchSourceText(canonicalUrl);
    if (body.ok) {
      sourceText = body.text;
      sourceKind = "body";
    } else if (abstract && abstract.trim().length >= 80) {
      sourceText = abstract.trim();
      sourceKind = "abstract";
    }

    let assessment = null;
    if (sourceKind !== "none") {
      try {
        assessment = await assessBacking({ sourceText, claim: pair.claim });
      } catch {
        // No judge configured / API failure → unverifiable, not a false "unsupported".
        assessment = null;
      }
    }

    return {
      claim: pair.claim,
      citedUrl: pair.citedUrl,
      sourceTitle: title,
      verdict: shapeVerdict(assessment, sourceKind),
    };
  });

  return NextResponse.json(
    {
      ok: true,
      results,
      note:
        "C4 backing check. 'unrelated' is the hollow-citation flag (source doesn't back the claim); 'unverifiable' means the source text couldn't be retrieved — NOT that the claim is unsupported. Verdicts carry their own confidence and are heuristic, not proof.",
    },
    { status: 200, headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
