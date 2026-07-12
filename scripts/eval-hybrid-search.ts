/**
 * AI-EPI C.1 — eval harness for hybrid argument search.
 *
 * Runs a fixed set of probe queries against the three retrieval modes
 * (lexical / hybrid / vector) and reports:
 *
 *   - top-K ids per mode
 *   - latency per mode
 *   - pairwise Jaccard@K overlap (lexical↔hybrid, lexical↔vector,
 *     hybrid↔vector)
 *   - NDCG@K when an expectedIds gold set is provided for the query
 *     (binary relevance: id ∈ expectedIds → rel=1).
 *
 * Why this shape: with a small seeded corpus we don't have a labelled
 * dev set yet, so the harness leans on (a) overlap to prove hybrid is
 * not collapsing to one retriever and (b) NDCG against a hand-curated
 * gold set when present. Both can be expanded incrementally.
 *
 * Usage:
 *   npx tsx scripts/eval-hybrid-search.ts                 # uses built-in probes
 *   npx tsx scripts/eval-hybrid-search.ts --probes=path.json
 *   npx tsx scripts/eval-hybrid-search.ts --k=10
 *
 * Probe file format (JSON):
 *   [
 *     { "query": "smartphones teen mental health",
 *       "expectedIds": ["cm...","cm..."]   // optional
 *     },
 *     ...
 *   ]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { hybridSearchArguments } from "@/lib/argument/hybridSearch";
import { prisma } from "@/lib/prismaclient";

type Probe = { query: string; expectedIds?: string[] };

const DEFAULT_PROBES: Probe[] = [
  { query: "smartphones teen mental health" },
  { query: "social media causes adolescent depression" },
  { query: "expert opinion on screen time" },
  { query: "anxiety and social comparison" },
  { query: "longitudinal evidence smartphones" },
  { query: "correlation versus causation teen wellbeing" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k: string) => {
    const a = args.find((x) => x.startsWith(`--${k}=`));
    return a ? a.split("=").slice(1).join("=") : null;
  };
  const has = (k: string) => args.includes(`--${k}`);
  const k = Number(get("k") ?? "10");
  const probesPath = get("probes");
  const probes: Probe[] = probesPath
    ? JSON.parse(readFileSync(probesPath, "utf8"))
    : DEFAULT_PROBES;
  const sweepK = has("sweep-k");
  return {
    k: Number.isFinite(k) && k > 0 ? k : 10,
    probes,
    sweepK,
  };
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** NDCG@K with binary relevance from `expected`. */
function ndcg(ranked: string[], expected: Set<string>, k: number): number {
  const slice = ranked.slice(0, k);
  let dcg = 0;
  for (let i = 0; i < slice.length; i++) {
    const rel = expected.has(slice[i]) ? 1 : 0;
    dcg += rel / Math.log2(i + 2);
  }
  // Ideal: as many 1s as possible up front, capped by min(|expected|, k).
  const idealHits = Math.min(expected.size, k);
  let idcg = 0;
  for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

/**
 * Lexical mode mirrors what the API route does for mode=lexical: token
 * OR-coverage scoring, restricted to permalinked arguments.
 */
async function lexicalSearch(query: string, limit: number): Promise<string[]> {
  const STOP_WORDS = new Set([
    "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for",
    "is", "are", "be", "by", "with", "as", "from", "that", "this",
    "it", "its", "if", "not", "no", "but", "do", "does", "did",
  ]);
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, "").trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    .slice(0, 8);
  const where: any = { permalink: { isNot: null } };
  if (tokens.length > 0) {
    where.OR = tokens.flatMap((tok) => [
      { text: { contains: tok, mode: "insensitive" } },
      { conclusion: { text: { contains: tok, mode: "insensitive" } } },
    ]);
  }
  const rows = await prisma.argument.findMany({
    where,
    select: {
      id: true,
      text: true,
      createdAt: true,
      conclusion: { select: { text: true } },
    },
    take: limit * 4,
    orderBy: [{ createdAt: "desc" }],
  });
  // Coverage rerank, identical to route logic.
  const scored = rows.map((r) => {
    let cov = 0;
    if (tokens.length > 0) {
      const hay = ((r.text ?? "") + " " + (r.conclusion?.text ?? "")).toLowerCase();
      for (const t of tokens) if (hay.includes(t)) cov++;
    }
    return { id: r.id, cov, ts: r.createdAt ? +new Date(r.createdAt) : 0 };
  });
  scored.sort((a, b) => (b.cov - a.cov) || (b.ts - a.ts));
  return scored.slice(0, limit).map((s) => s.id);
}

async function hybridIds(
  query: string,
  limit: number,
  rrfK?: number,
): Promise<string[]> {
  const r = await hybridSearchArguments({
    query,
    limit,
    rrfK,
    filter: { permalinkRequired: true },
  });
  return r.map((x) => x.id);
}

/**
 * Pure dense — same retrieval path but we ignore sparse rank in fusion.
 * Easiest way: pull dense list directly through hybridSearch then re-sort
 * by denseRank only.
 */
async function denseIds(query: string, limit: number): Promise<string[]> {
  const r = await hybridSearchArguments({
    query,
    limit: limit * 4,
    filter: { permalinkRequired: true },
  });
  return r
    .filter((x) => x.denseRank != null)
    .sort((a, b) => (a.denseRank! - b.denseRank!))
    .slice(0, limit)
    .map((x) => x.id);
}

async function main() {
  const { k, probes, sweepK } = parseArgs();

  if (sweepK) {
    // Tune RRF K against the labelled probes. Only meaningful when
    // probes carry expectedIds; otherwise skip (no NDCG to optimise).
    const labelled = probes.filter(
      (p) => p.expectedIds && p.expectedIds.length > 0,
    );
    if (labelled.length === 0) {
      console.error(
        "[eval] --sweep-k requires probes with expectedIds. Aborting.",
      );
      await prisma.$disconnect();
      process.exit(2);
    }
    const sweepValues = [10, 30, 60, 90, 120, 200];
    console.log(
      `[eval] sweep-k mode k=${k} probes=${labelled.length} (with labels)`,
    );
    console.log();
    for (const rk of sweepValues) {
      const ndcgs: number[] = [];
      for (const p of labelled) {
        const ids = await hybridIds(p.query, k, rk);
        ndcgs.push(ndcg(ids, new Set(p.expectedIds!), k));
      }
      const avg = ndcgs.reduce((a, b) => a + b, 0) / ndcgs.length;
      console.log(`  rrfK=${rk.toString().padStart(3)}  ndcg@${k} avg=${avg.toFixed(4)}`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log(`[eval] k=${k} probes=${probes.length}`);
  console.log();

  const summary = {
    lexical: { ndcgs: [] as number[], lats: [] as number[] },
    hybrid:  { ndcgs: [] as number[], lats: [] as number[] },
    vector:  { ndcgs: [] as number[], lats: [] as number[] },
    overlap: {
      lex_hyb: [] as number[],
      lex_vec: [] as number[],
      hyb_vec: [] as number[],
    },
  };

  for (const p of probes) {
    console.log(`=== ${p.query} ===`);
    const t0 = Date.now();
    const lex = await lexicalSearch(p.query, k);
    const t1 = Date.now();
    const hyb = await hybridIds(p.query, k);
    const t2 = Date.now();
    const vec = await denseIds(p.query, k);
    const t3 = Date.now();
    const lLat = t1 - t0;
    const hLat = t2 - t1;
    const vLat = t3 - t2;

    summary.lexical.lats.push(lLat);
    summary.hybrid.lats.push(hLat);
    summary.vector.lats.push(vLat);

    const olxh = jaccard(lex, hyb);
    const olxv = jaccard(lex, vec);
    const ohv = jaccard(hyb, vec);
    summary.overlap.lex_hyb.push(olxh);
    summary.overlap.lex_vec.push(olxv);
    summary.overlap.hyb_vec.push(ohv);

    if (p.expectedIds && p.expectedIds.length > 0) {
      const ex = new Set(p.expectedIds);
      const nL = ndcg(lex, ex, k);
      const nH = ndcg(hyb, ex, k);
      const nV = ndcg(vec, ex, k);
      summary.lexical.ndcgs.push(nL);
      summary.hybrid.ndcgs.push(nH);
      summary.vector.ndcgs.push(nV);
      console.log(
        `  ndcg@${k}: lex=${nL.toFixed(3)} hyb=${nH.toFixed(3)} vec=${nV.toFixed(3)}`,
      );
    }
    console.log(
      `  latency:  lex=${lLat}ms hyb=${hLat}ms vec=${vLat}ms`,
    );
    console.log(
      `  jaccard@${k}: lex↔hyb=${olxh.toFixed(2)} lex↔vec=${olxv.toFixed(2)} hyb↔vec=${ohv.toFixed(2)}`,
    );
    console.log(`  lex top-3:  ${lex.slice(0, 3).join(", ") || "(none)"}`);
    console.log(`  hyb top-3:  ${hyb.slice(0, 3).join(", ") || "(none)"}`);
    console.log(`  vec top-3:  ${vec.slice(0, 3).join(", ") || "(none)"}`);
    console.log();
  }

  const avg = (xs: number[]) =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

  console.log("=== summary ===");
  console.log(
    `latency avg ms:  lex=${avg(summary.lexical.lats)?.toFixed(0)} hyb=${avg(summary.hybrid.lats)?.toFixed(0)} vec=${avg(summary.vector.lats)?.toFixed(0)}`,
  );
  console.log(
    `jaccard avg:     lex↔hyb=${avg(summary.overlap.lex_hyb)?.toFixed(2)} lex↔vec=${avg(summary.overlap.lex_vec)?.toFixed(2)} hyb↔vec=${avg(summary.overlap.hyb_vec)?.toFixed(2)}`,
  );
  if (summary.hybrid.ndcgs.length > 0) {
    console.log(
      `ndcg@${k} avg:    lex=${avg(summary.lexical.ndcgs)?.toFixed(3)} hyb=${avg(summary.hybrid.ndcgs)?.toFixed(3)} vec=${avg(summary.vector.ndcgs)?.toFixed(3)}`,
    );
  } else {
    console.log(`ndcg@${k}: (no expectedIds in probes — skip)`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
