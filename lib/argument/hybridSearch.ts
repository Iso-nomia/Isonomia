/**
 * AI-EPI C.1 — hybrid (lexical + dense) argument retrieval.
 *
 * Two retrievers, fused with Reciprocal Rank Fusion (RRF):
 *
 *   sparse rank: existing OR-token coverage scoring (mirrors what
 *                /api/v3/search/arguments has been using for "lexical").
 *   dense rank:  pgvector cosine top-K against Argument.embedding.
 *
 *   rrf(id) = Σ_i  1 / (K + rank_i(id))    K = 60 (Cormack et al., 2009)
 *
 * Returns an ordered id list. The caller is expected to fetch the full
 * argument rows (with permalink, scheme, conclusion, etc.) and apply any
 * additional re-rank (e.g. dialectical_fitness) on top.
 *
 * This module is API-route-friendly: no Redis, no caching. Query
 * embedding caching belongs at the route layer.
 */
import { prisma } from "@/lib/prismaclient";
import { getOrComputeQueryEmbedding } from "@/lib/argument/queryEmbeddingCache";

export const RRF_K = 60;
export const DEFAULT_CANDIDATE_K = 100;

/**
 * Tokenise & filter a free-text query the same way the existing search
 * route does. Stop-word list intentionally minimal.
 */
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for",
  "is", "are", "be", "by", "with", "as", "from", "that", "this",
  "it", "its", "if", "not", "no", "but", "do", "does", "did",
]);

export function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, "").trim())
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
    .slice(0, 8);
}

export type HybridFilter = {
  /** Restrict to arguments in these deliberation ids (optional). */
  deliberationIds?: string[];
  /** Restrict to arguments whose primary scheme key matches. */
  schemeKey?: string | null;
  /** Restrict to a candidate id pool (e.g. counter-arg discovery). */
  argumentIds?: string[];
  /** Only return arguments with a public permalink. */
  permalinkRequired?: boolean;
  /** Restrict to arguments created on or after this date (Phase 2). */
  since?: Date | null;
  /** Restrict to arguments created on or before this date (Phase 2). */
  until?: Date | null;
};

export type HybridSearchResult = {
  id: string;
  /** 1-based rank in sparse list (null if absent). */
  sparseRank: number | null;
  /** 1-based rank in dense list (null if absent). */
  denseRank: number | null;
  /** Reciprocal rank fusion score. */
  rrfScore: number;
  /** Cosine distance from dense list (null if absent). */
  denseDistance: number | null;
  /** Number of distinct query tokens hit in argument or conclusion text. */
  lexicalCoverage: number;
};

/**
 * Sparse (lexical) candidates. Returns ids ordered by:
 *   1. coverage desc (#tokens hit)
 *   2. recency desc
 *
 * Empty-query short-circuits to recency-only.
 */
async function sparseCandidates(
  tokens: string[],
  k: number,
  filter: HybridFilter,
): Promise<{ id: string; coverage: number }[]> {
  const where: any = {};
  if (filter.permalinkRequired) where.permalink = { isNot: null };
  if (filter.deliberationIds?.length) {
    where.deliberationId = { in: filter.deliberationIds };
  }
  if (filter.schemeKey) {
    where.argumentSchemes = {
      some: { scheme: { key: filter.schemeKey } },
    };
  }
  if (filter.argumentIds) {
    where.id = { in: filter.argumentIds };
  }
  if (filter.since || filter.until) {
    where.createdAt = {
      ...(filter.since ? { gte: filter.since } : {}),
      ...(filter.until ? { lte: filter.until } : {}),
    };
  }
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
    take: k,
    orderBy: [{ createdAt: "desc" }],
  });

  const scored = rows.map((r) => {
    let coverage = 0;
    if (tokens.length > 0) {
      const hay = ((r.text ?? "") + " " + (r.conclusion?.text ?? "")).toLowerCase();
      for (const tok of tokens) if (hay.includes(tok)) coverage++;
    }
    return {
      id: r.id,
      coverage,
      createdAt: r.createdAt ? +new Date(r.createdAt) : 0,
    };
  });

  scored.sort((a, b) => {
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return b.createdAt - a.createdAt;
  });

  return scored.map((s) => ({ id: s.id, coverage: s.coverage }));
}

/**
 * Dense candidates via pgvector cosine. Uses raw SQL because Prisma can't
 * bind a vector parameter yet. Filter clauses are spliced safely (no user
 * strings in SQL — only ids/keys validated at the route boundary).
 */
async function denseCandidates(
  queryVec: number[],
  k: number,
  filter: HybridFilter,
): Promise<{ id: string; distance: number }[]> {
  // Build WHERE fragments. Parameterise everything; never interpolate
  // user data into the SQL string.
  const params: any[] = [];
  const wheres: string[] = [`a."embedding" IS NOT NULL`];

  // $1 reserved for the vector literal below.
  const vecLiteral = "[" + queryVec.join(",") + "]";
  params.push(vecLiteral);

  if (filter.permalinkRequired) {
    wheres.push(
      `EXISTS (SELECT 1 FROM "ArgumentPermalink" p WHERE p."argumentId" = a.id)`,
    );
  }
  if (filter.deliberationIds?.length) {
    params.push(filter.deliberationIds);
    wheres.push(`a."deliberationId" = ANY($${params.length}::text[])`);
  }
  if (filter.schemeKey) {
    params.push(filter.schemeKey);
    wheres.push(
      `EXISTS (
         SELECT 1 FROM "ArgumentSchemeInstance" si
         JOIN "ArgumentScheme" s ON s.id = si."schemeId"
         WHERE si."argumentId" = a.id AND s.key = $${params.length}
       )`,
    );
  }
  if (filter.argumentIds) {
    if (filter.argumentIds.length === 0) return [];
    params.push(filter.argumentIds);
    wheres.push(`a.id = ANY($${params.length}::text[])`);
  }
  if (filter.since) {
    params.push(filter.since);
    wheres.push(`a."createdAt" >= $${params.length}`);
  }
  if (filter.until) {
    params.push(filter.until);
    wheres.push(`a."createdAt" <= $${params.length}`);
  }

  params.push(k);
  const limitParam = `$${params.length}`;

  const sql = `
    SELECT a.id, (a."embedding" <=> $1::vector) AS distance
    FROM "Argument" a
    WHERE ${wheres.join(" AND ")}
    ORDER BY a."embedding" <=> $1::vector ASC
    LIMIT ${limitParam}
  `;
  const rows = await prisma.$queryRawUnsafe<{ id: string; distance: number }[]>(
    sql,
    ...params,
  );
  return rows.map((r) => ({ id: r.id, distance: Number(r.distance) }));
}

/**
 * Reciprocal Rank Fusion of sparse and dense lists.
 *
 * Empty query → dense-only ranking is impossible (no query vector), so
 * we degrade gracefully to sparse-only (which is recency in that case).
 *
 * Empty corpus on the dense side (no embeddings yet) → fuse acts as a
 * no-op for dense and the result is just the sparse list. This is the
 * desired behaviour during the embedding backfill window.
 */
export async function hybridSearchArguments(opts: {
  query: string;
  limit: number;
  candidateK?: number;
  /** Override for RRF K constant (default 60). Used by the eval harness for tuning. */
  rrfK?: number;
  filter?: HybridFilter;
}): Promise<HybridSearchResult[]> {
  const { query, limit } = opts;
  const k = Math.max(limit, opts.candidateK ?? DEFAULT_CANDIDATE_K);
  const rrfK = opts.rrfK ?? RRF_K;
  const filter: HybridFilter = { permalinkRequired: true, ...(opts.filter ?? {}) };
  const tokens = tokenizeQuery(query);

  const sparseP = sparseCandidates(tokens, k, filter);
  const denseP = query.trim()
    ? getOrComputeQueryEmbedding(query).then(({ vec }) =>
        denseCandidates(vec, k, filter),
      )
    : Promise.resolve<{ id: string; distance: number }[]>([]);

  const [sparse, dense] = await Promise.all([sparseP, denseP]);

  const sparseRanks = new Map<string, number>();
  const sparseCoverage = new Map<string, number>();
  sparse.forEach((r, i) => {
    sparseRanks.set(r.id, i + 1);
    sparseCoverage.set(r.id, r.coverage);
  });

  const denseRanks = new Map<string, number>();
  const denseDist = new Map<string, number>();
  dense.forEach((r, i) => {
    denseRanks.set(r.id, i + 1);
    denseDist.set(r.id, r.distance);
  });

  const allIds = new Set<string>([...sparseRanks.keys(), ...denseRanks.keys()]);
  const fused: HybridSearchResult[] = [];
  for (const id of allIds) {
    const sR = sparseRanks.get(id) ?? null;
    const dR = denseRanks.get(id) ?? null;
    const score =
      (sR != null ? 1 / (rrfK + sR) : 0) + (dR != null ? 1 / (rrfK + dR) : 0);
    fused.push({
      id,
      sparseRank: sR,
      denseRank: dR,
      rrfScore: score,
      denseDistance: denseDist.get(id) ?? null,
      lexicalCoverage: sparseCoverage.get(id) ?? 0,
    });
  }

  fused.sort((a, b) => {
    if (b.rrfScore !== a.rrfScore) return b.rrfScore - a.rrfScore;
    // Tiebreak: prefer higher coverage, then closer dense distance.
    if (b.lexicalCoverage !== a.lexicalCoverage) {
      return b.lexicalCoverage - a.lexicalCoverage;
    }
    const ad = a.denseDistance ?? Infinity;
    const bd = b.denseDistance ?? Infinity;
    return ad - bd;
  });

  return fused.slice(0, limit);
}
