/**
 * GET /api/v3/search/arguments
 *
 * Track B.2 — Public argument search endpoint.
 *
 * Query parameters:
 *   q          — full-text query, matched against argument text and conclusion claim text
 *   limit      — 1..50 (default 10)
 *   scheme     — filter by primary scheme key (e.g. "expert_opinion")
 *   against    — claim moid; returns arguments whose conclusion conflicts
 *                with that claim (currently approximated via text-overlap;
 *                will tighten when ConflictApplication exposes a moid index)
 *   sort       — "recent" (default) | "dialectical_fitness"
 *                Dialectical fitness ranks by:
 *                  +1.0 per CQ answered
 *                  +0.5 per inbound support edge
 *                  -0.7 per inbound attack edge
 *                  -1.0 per inbound conflict-application
 *                  +0.25 per piece of evidence with a contentSha256
 *                Tied scores fall back to recency.
 *
 *   --- Phase 5: counter-citation discovery ---
 *   include_strongest_counter — "1"/"true" → for each of the top K
 *                       results (default K=10), look up structural
 *                       contesters (rebut/undercut edges + conflict
 *                       applications targeting the conclusion claim) and
 *                       attach a `strongestCounter` block with the best
 *                       contester (most-engaged-then-recent). Self-counters
 *                       are excluded by MOID. Honest-empty: results with no
 *                       structural contester get `strongestCounter: null`.
 *   strongest_counter_k — integer 1..50; how many top results to enrich
 *                       with strongestCounter (default 10).
 *
 *   --- Phase 2: quality filters ---
 *   tested_only       — "1"/"true" → only return arguments whose computed
 *                       standingState is one of tested-attacked /
 *                       tested-undermined / tested-survived.
 *   min_cq_satisfied  — integer ≥ 0; only return args with at least N
 *                       SATISFIED (or PARTIALLY_SATISFIED) critical-question
 *                       statuses recorded.
 *   min_evidence      — integer ≥ 0; only return args whose conclusion has
 *                       at least N evidence rows with a contentSha256
 *                       (i.e. provenance-anchored evidence).
 *   since / until     — ISO-8601 dates or datetimes; filters createdAt range.
 *                       Pushed into the DB query (cheap).
 *   mode       — "lexical" (default) | "hybrid" | "vector"
 *                "hybrid"/"vector" runs pgvector cosine top-K + sparse
 *                token retrieval and fuses with Reciprocal Rank Fusion
 *                (K=60). The id list is then row-fetched + (optionally)
 *                fitness-re-ranked. Falls back to lexical if `q` is empty.
 *                Each result includes a `hybrid` block with rrfScore,
 *                sparseRank, denseRank, denseDistance.
 *
 * Returns ranked argument permalinks with attestation summaries.
 *
 * Public, cache-friendly. Used by MCP tools `search_arguments` and
 * `find_counterarguments`.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  computeFitnessBreakdown,
  FITNESS_WEIGHTS,
} from "@/lib/citations/argumentAttestation";
import {
  computeDialecticalCounters,
  deriveIsTested,
  standingStateFromCounters,
} from "@/lib/citations/dialecticalCounters";
import { getArgumentCitedBy } from "@/lib/citation/citedBy";
import {
  hybridSearchArguments,
  type HybridSearchResult,
} from "@/lib/argument/hybridSearch";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const FITNESS_CANDIDATE_FACTOR = 4; // pull 4x the asked-for limit before re-ranking
const FITNESS_CANDIDATE_CAP = 200;

function parseLimit(raw: string | null): number {
  const n = Math.floor(Number(raw ?? "10"));
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(50, n);
}

function parseNonNegInt(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function parseBool(raw: string | null): boolean {
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Accepts ISO-8601 date or datetime; returns Date or null on bad input. */
function parseIsoDate(raw: string | null): Date | null {
  if (raw == null || raw.trim() === "") return null;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const limit = parseLimit(sp.get("limit"));
  const scheme = (sp.get("scheme") ?? "").trim().toLowerCase() || null;
  const against = (sp.get("against") ?? "").trim() || null;
  // Phase 6 — "for" stance discovery. Restricts results to arguments
  // whose conclusion claim has the given MOID. Honest definition of
  // "arguments concluding to this claim." Symmetric to `against`.
  const conclusionMoid = (sp.get("conclusion_moid") ?? "").trim() || null;
  const sort = (sp.get("sort") ?? "recent").trim().toLowerCase();
  const wantFitness = sort === "dialectical_fitness";
  const modeRaw = (sp.get("mode") ?? "lexical").trim().toLowerCase();
  const mode: "lexical" | "hybrid" | "vector" =
    modeRaw === "hybrid" || modeRaw === "vector" ? (modeRaw as any) : "lexical";

  // Phase 2 — quality filters.
  const testedOnly = parseBool(sp.get("tested_only"));
  const minCqSatisfied = parseNonNegInt(sp.get("min_cq_satisfied"));
  const minEvidence = parseNonNegInt(sp.get("min_evidence"));
  const since = parseIsoDate(sp.get("since"));
  const until = parseIsoDate(sp.get("until"));
  const qualityActive =
    testedOnly ||
    (minCqSatisfied != null && minCqSatisfied > 0) ||
    (minEvidence != null && minEvidence > 0);

  // Phase 5 — counter-citation discovery (opt-in).
  const includeStrongestCounter = parseBool(sp.get("include_strongest_counter"));
  const strongestCounterKRaw = parseNonNegInt(sp.get("strongest_counter_k"));
  const strongestCounterK =
    strongestCounterKRaw != null && strongestCounterKRaw > 0
      ? Math.min(50, strongestCounterKRaw)
      : 10;

  // Phase 10a (10.3) — downstream cited-by summary on each card (opt-in).
  const includeCitedBy = parseBool(sp.get("include_cited_by"));
  const citedByKRaw = parseNonNegInt(sp.get("cited_by_k"));
  const citedByK =
    citedByKRaw != null && citedByKRaw > 0 ? Math.min(50, citedByKRaw) : 10;

  // T1.3 — deliberation-scope tagging. Three modes:
  //   - `scope=within` + `within_deliberation=<id>`  → only intra-deliberation
  //     hits. Caller wants to stay inside one debate.
  //   - `scope=cross` + `within_deliberation=<id>`   → only OTHER deliberations.
  //     Caller wants the cross-pollination signal explicitly.
  //   - `scope=both` (default when `within_deliberation` is set) → both, with
  //     each result tagged `scope: "within" | "cross"` and intra-deliberation
  //     results sorted first inside the active sort key.
  // The bug we're fixing (per external Claude-Desktop feedback): users could
  // not distinguish intra- from inter-deliberation results in `find_counter‐
  // arguments`, which made cross-pollination noise look like in-context
  // results. Tagging preserves the cross-graph signal that justifies the
  // graph-of-graphs architecture rather than scoping it away.
  const withinDeliberation =
    (sp.get("within_deliberation") ?? "").trim() || null;
  const scopeRaw = (sp.get("scope") ?? "").trim().toLowerCase();
  const scope: "within" | "cross" | "both" =
    scopeRaw === "within" || scopeRaw === "cross" || scopeRaw === "both"
      ? scopeRaw
      : "both";

  // Echoed back in every response so consumers can see what was applied
  // (and so MCP clients can replay queries).
  const echoQuery = () => ({
    q,
    limit,
    scheme,
    against,
    conclusionMoid: conclusionMoid || undefined,
    sort: wantFitness ? "dialectical_fitness" : "recent",
    mode,
    testedOnly: testedOnly || undefined,
    minCqSatisfied: minCqSatisfied ?? undefined,
    minEvidence: minEvidence ?? undefined,
    since: since ? since.toISOString() : undefined,
    until: until ? until.toISOString() : undefined,
    includeStrongestCounter: includeStrongestCounter || undefined,
    strongestCounterK: includeStrongestCounter ? strongestCounterK : undefined,
    includeCitedBy: includeCitedBy || undefined,
    citedByK: includeCitedBy ? citedByK : undefined,
    withinDeliberation: withinDeliberation || undefined,
    scope: withinDeliberation ? scope : undefined,
  });

  // Build query. We restrict to arguments that have a permalink (i.e. have
  // been surfaced publicly) and that are not in private deliberations.
  const where: any = {
    permalink: { isNot: null },
  };

  // since/until are cheap to push to the DB; do it before the candidate fetch.
  if (since || until) {
    where.createdAt = {
      ...(since ? { gte: since } : {}),
      ...(until ? { lte: until } : {}),
    };
  }

  // Text matching across argument text and conclusion claim text.
  // Tokenize on whitespace and require AT LEAST ONE token to appear in
  // either the argument text or the conclusion claim text (substring,
  // case-insensitive). Coverage — how many query tokens hit — is computed
  // post-filter and used to re-rank below.
  //
  // Why OR instead of AND: per-token AND black-holes natural-language
  // queries whose vocabulary doesn't exactly match the corpus (the round-2
  // MCP transcript hit this with "smartphones teen mental health" — the
  // corpus uses "adolescent", not "teen"). OR + coverage gives lexical
  // recall now; vector recall ships with C.1/C.2.
  //
  // Stop-word filter is intentionally tiny — the goal is to drop words
  // that hit everything (the, a, of, and, ...), not to do real NLP.
  const STOP_WORDS = new Set([
    "the", "a", "an", "of", "and", "or", "in", "on", "at", "to", "for",
    "is", "are", "be", "by", "with", "as", "from", "that", "this",
    "it", "its", "if", "not", "no", "but", "do", "does", "did",
  ]);
  let queryTokens: string[] = [];
  if (q) {
    queryTokens = q
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^\p{L}\p{N}-]/gu, "").trim())
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t))
      .slice(0, 8);
    if (queryTokens.length > 0) {
      where.OR = queryTokens.flatMap((tok) => [
        { text: { contains: tok, mode: "insensitive" } },
        { conclusion: { text: { contains: tok, mode: "insensitive" } } },
      ]);
    }
  }

  // T1.3 — deliberation-scope filter. Default (`scope=both`) keeps the
  // candidate set unrestricted but tags each result downstream. Explicit
  // `within` / `cross` push the constraint into the DB so we don't waste
  // post-filter cycles.
  if (withinDeliberation && scope === "within") {
    where.deliberationId = withinDeliberation;
  } else if (withinDeliberation && scope === "cross") {
    where.deliberationId = { not: withinDeliberation };
  }

  if (scheme) {
    where.argumentSchemes = {
      some: { scheme: { key: scheme } },
    };
  }

  // Phase 6 — restrict to arguments concluding to a specific claim
  // (the "for" stance). Pushed to the DB via a Prisma relation filter.
  if (conclusionMoid) {
    where.conclusion = { moid: conclusionMoid };
  }

  // "against" mode: arguments that dialectically contest the target claim.
  //
  // Strategy (in order of authority):
  //   1. ConflictApplication rows that conflict the target claim directly
  //   2. ArgumentEdge rows of type rebut/undercut whose target argument
  //      concludes the target claim
  //
  // The previous text-overlap heuristic ("first 4 words of the target claim
  // appear in the candidate's conclusion") returned 0 for cleanly
  // dialectical pairs whose conclusions don't share surface vocabulary
  // (e.g. Haidt vs. Odgers on teen screens). The structural query is the
  // source of truth and is what the seeded edges encode.
  //
  // Honesty rule: arguments whose conclusion MOID equals the target are NOT
  // counter-arguments to it; exclude them so empty results are honestly
  // empty rather than the same argument echoing back.
  let againstClaimText: string | null = null;
  if (against) {
    const claim = await prisma.claim.findFirst({
      where: { moid: against },
      select: { id: true, text: true },
    });
    if (claim) {
      againstClaimText = claim.text;
      const [edgeContesters, conflictContesters] = await Promise.all([
        // Argument edges: any argument whose edge of type rebut/undercut
        // points at an argument that concludes the target claim.
        prisma.argumentEdge.findMany({
          where: {
            type: { in: ["rebut", "undercut"] as any },
            to: { conclusionClaimId: claim.id },
          },
          select: { fromArgumentId: true },
          take: 200,
        }),
        // ConflictApplications targeting the claim directly.
        prisma.conflictApplication.findMany({
          where: { conflictedClaimId: claim.id },
          select: { conflictingArgumentId: true } as any,
          take: 200,
        }),
      ]);
      const ids = new Set<string>();
      for (const e of edgeContesters) if (e.fromArgumentId) ids.add(e.fromArgumentId);
      for (const c of conflictContesters as any[]) {
        if (c?.conflictingArgumentId) ids.add(c.conflictingArgumentId);
      }
      where.id = { in: Array.from(ids) };
      where.conclusion = { moid: { not: against } };
      // If no structural contesters exist, short-circuit to honest-empty
      // rather than letting a no-op `id IN ()` query run.
      if (ids.size === 0) {
        return NextResponse.json(
          {
            ok: true,
            query: { ...echoQuery(), againstClaimText },
            count: 0,
            results: [],
          },
          {
            headers: {
              "Cache-Control": "public, max-age=30, s-maxage=30",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }
  }

  // For dialectical-fitness sort, hybrid mode, or any active quality
  // filter (tested_only / min_cq_satisfied / min_evidence) we pull a wider
  // candidate pool so post-fetch filtering doesn't underfill the page.
  const needsWidePool = wantFitness || qualityActive;
  const candidateLimit = needsWidePool
    ? Math.min(FITNESS_CANDIDATE_CAP, limit * FITNESS_CANDIDATE_FACTOR)
    : limit;

  // C.1 — hybrid retrieval. When mode !== "lexical", run pgvector +
  // sparse fusion (RRF) and feed the resulting id list back into the
  // existing row-fetch + fitness re-rank pipeline. The lexical OR clause
  // is replaced by `id IN (hybridIds)`; all other filters (scheme,
  // against, permalink) are preserved.
  let hybridResults: HybridSearchResult[] | null = null;
  if (mode !== "lexical" && q) {
    // Honor existing structural constraint from `against` when set.
    const argumentIdsConstraint: string[] | undefined =
      where.id?.in && Array.isArray(where.id.in) ? where.id.in : undefined;
    hybridResults = await hybridSearchArguments({
      query: q,
      limit: candidateLimit,
      filter: {
        schemeKey: scheme,
        argumentIds: argumentIdsConstraint,
        permalinkRequired: true,
        since,
        until,
      },
    });
    const hybridIds = hybridResults.map((r) => r.id);
    if (hybridIds.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          query: { ...echoQuery(), againstClaimText },
          count: 0,
          results: [],
        },
        {
          headers: {
            "Cache-Control": "public, max-age=30, s-maxage=30",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
    // Replace lexical OR with the fused id pool. Drop the OR so prisma
    // doesn't AND it with the id-set restriction.
    delete where.OR;
    where.id = { in: hybridIds };
  }

  const rows = await prisma.argument.findMany({
    where,
    select: {
      id: true,
      text: true,
      createdAt: true,
      deliberationId: true,
      deliberation: { select: { id: true, title: true } },
      conclusion: {
        select: {
          id: true,
          text: true,
          moid: true,
          ClaimEvidence: { select: { contentSha256: true } as any, take: 25 },
        },
      },
      premises: {
        select: { claim: { select: { id: true } } },
        take: 50,
      },
      permalink: { select: { shortCode: true, version: true, accessCount: true } },
      argumentSchemes: {
        where: { isPrimary: true },
        select: { scheme: { select: { key: true, name: true, title: true } } },
        take: 1,
      },
    },
    take: candidateLimit,
    orderBy: [{ createdAt: "desc" }],
  });

  // Compute dialectical counters per row (always — needed for standingState
  // on every result, not just fitness sorts). Capped to 50 by `limit` so the
  // parallel fan-out stays bounded.
  let withFitness: Array<{
    row: typeof rows[number];
    fitness: number;
    fitnessBreakdown: ReturnType<typeof computeFitnessBreakdown> | null;
    cqAnswered: number;
    supportEdges: number;
    attackEdges: number;
    attackCAs: number;
    cqRequired: number;
    /** Number of evidence rows on the conclusion claim with a contentSha256 (provenance-anchored). */
    evidenceWithProvenance: number;
    /** Number of distinct query tokens (post-stop-word filter) found in argument text or conclusion text. 0 when q was empty. */
    lexicalCoverage: number;
  }> = rows
    .filter((r) => r.permalink?.shortCode)
    .map((r) => {
      let lexicalCoverage = 0;
      if (queryTokens.length > 0) {
        const haystack = (
          (r.text ?? "") + " " + (r.conclusion?.text ?? "")
        ).toLowerCase();
        for (const tok of queryTokens) {
          if (haystack.includes(tok)) lexicalCoverage++;
        }
      }
      return {
        row: r,
        fitness: 0,
        fitnessBreakdown: null,
        cqAnswered: 0,
        supportEdges: 0,
        attackEdges: 0,
        attackCAs: 0,
        cqRequired: 0,
        evidenceWithProvenance: 0,
        lexicalCoverage,
      };
    });

  await Promise.all(
    withFitness.map(async (entry) => {
      const argId = entry.row.id;
      const conclusionId = entry.row.conclusion?.id ?? null;
      // An UNDERMINE targets a premise claim, so premise-targeted CAs are real
      // attacks on this argument and must count — kept in lockstep with the
      // attestation envelope's dialecticalStatus (see lib/citations/argumentAttestation.ts).
      const attackTargetClaimIds = [
        ...(conclusionId ? [conclusionId] : []),
        ...((entry.row.premises ?? [])
          .map((p: any) => p.claim?.id)
          .filter((id: any): id is string => !!id)),
      ];
      const { cqAnswered, supportEdges, attackEdges, attackCAs } =
        await computeDialecticalCounters({ argumentId: argId, attackTargetClaimIds });
      entry.cqAnswered = cqAnswered;
      entry.supportEdges = supportEdges;
      entry.attackEdges = attackEdges;
      entry.attackCAs = attackCAs;
      const evidenceWithProvenance = (entry.row.conclusion?.ClaimEvidence ?? []).filter(
        (e: any) => !!e?.contentSha256
      ).length;
      entry.evidenceWithProvenance = evidenceWithProvenance;
      // Single-source-of-truth fitness math — same weights, same formula
      // as the attestation envelope (Track AI-EPI Pt. 3 §1).
      const breakdown = computeFitnessBreakdown({
        cqAnswered,
        supportEdges,
        attackEdges,
        attackCAs,
        evidenceWithProvenance,
      });
      entry.fitness = breakdown.total;
      entry.fitnessBreakdown = breakdown;
    })
  );

  // Phase 2 quality filters — applied AFTER counters are known. Truncation
  // to `limit` happens in the sort blocks below, so we filter first to keep
  // pagination honest (users get up to `limit` results that pass the bar,
  // not `limit` results pre-filter that may then collapse to <limit).
  if (qualityActive) {
    withFitness = withFitness.filter((entry) => {
      if (testedOnly) {
        if (!deriveIsTested(entry)) return false;
      }
      if (minCqSatisfied != null && entry.cqAnswered < minCqSatisfied) return false;
      if (minEvidence != null && entry.evidenceWithProvenance < minEvidence) return false;
      return true;
    });
  }

  if (wantFitness) {
    withFitness.sort((a, b) => {
      // The consumer explicitly asked for dialectical_fitness sort, so
      // fitness is primary. Coverage is only a tiebreaker — overriding
      // fitness with coverage (Round-2 behavior) silently disrespected
      // the chosen sort key, which Round-3 transcript flagged.
      if (b.fitness !== a.fitness) return b.fitness - a.fitness;
      if (queryTokens.length > 0 && b.lexicalCoverage !== a.lexicalCoverage) {
        return b.lexicalCoverage - a.lexicalCoverage;
      }
      const ad = a.row.createdAt ? +new Date(a.row.createdAt) : 0;
      const bd = b.row.createdAt ? +new Date(b.row.createdAt) : 0;
      return bd - ad;
    });
  } else if (hybridResults) {
    // Hybrid mode without fitness — preserve RRF order from the fusion
    // step. Use a rank lookup so we don't re-sort by anything else.
    const rankById = new Map<string, number>();
    hybridResults.forEach((h, i) => rankById.set(h.id, i));
    withFitness.sort((a, b) => {
      const ra = rankById.get(a.row.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rankById.get(b.row.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb;
    });
  } else if (queryTokens.length > 0) {
    // Recency sort + a query: still re-rank by coverage so high-coverage
    // results aren't pushed off the page by older but less-relevant ones.
    withFitness.sort((a, b) => {
      if (b.lexicalCoverage !== a.lexicalCoverage) {
        return b.lexicalCoverage - a.lexicalCoverage;
      }
      const ad = a.row.createdAt ? +new Date(a.row.createdAt) : 0;
      const bd = b.row.createdAt ? +new Date(b.row.createdAt) : 0;
      return bd - ad;
    });
  } else if (needsWidePool) {
    // We widened the candidate pool for fitness or quality filtering.
    // No query and no hybrid → already in DB recency order; nothing to do
    // here — the unified within-first reorder + truncation runs below.
  }

  // T1.3 — stable within-first reorder when caller anchored a deliberation
  // and asked for both scopes. Preserves the active sort within each
  // partition; just lifts intra-deliberation hits ahead of cross hits so
  // they aren't pushed off the page by an older / lower-fitness within
  // result.
  if (withinDeliberation && scope === "both") {
    const within = withFitness.filter(
      (e) => e.row.deliberationId === withinDeliberation,
    );
    const cross = withFitness.filter(
      (e) => e.row.deliberationId !== withinDeliberation,
    );
    withFitness = [...within, ...cross];
  }
  withFitness = withFitness.slice(0, limit);

  const hybridById = new Map<string, HybridSearchResult>();
  if (hybridResults) {
    for (const h of hybridResults) hybridById.set(h.id, h);
  }

  // Phase 5 — strongestCounter discovery. Opt-in. Single-fanout: one
  // edge query + one conflictApplication query covering ALL top-K
  // conclusion claim ids, then a single argument.findMany to fetch the
  // contester rows. Avoids per-result N+1.
  const strongestCounterById = includeStrongestCounter
    ? await fetchStrongestCounters(withFitness.slice(0, strongestCounterK))
    : new Map<string, StrongestCounter>();

  // Phase 10a (10.3) — downstream cited-by summary for the top-K results.
  // Bounded + opt-in; composes getArgumentCitedBy (same classification as the
  // cited-by endpoint) so there is no drift. publicOnly: only linkable citers
  // surface on the public search card.
  const citedBySummaryById = includeCitedBy
    ? await fetchCitedBySummaries(withFitness.slice(0, citedByK))
    : new Map<string, CitedBySummary>();

  const results = withFitness.map((entry) => {
    const r = entry.row;
    const sc = r.permalink!.shortCode;
    const primaryScheme = r.argumentSchemes[0]?.scheme ?? null;
    const standingState = standingStateFromCounters(entry);
    const h = hybridById.get(r.id);
    // T1.3 — derive `scope` against the caller's anchor deliberation, when
    // one was supplied. Always emit `deliberation` so the consumer can
    // group / route results regardless of mode.
    const resultScope: "within" | "cross" | null = withinDeliberation
      ? r.deliberationId === withinDeliberation
        ? "within"
        : "cross"
      : null;
    return {
      argumentId: r.id,
      permalink: `${BASE_URL}/a/${sc}`,
      shortCode: sc,
      version: r.permalink!.version,
      text: r.text,
      deliberation: r.deliberation
        ? { id: r.deliberation.id, title: r.deliberation.title ?? null }
        : { id: r.deliberationId, title: null },
      ...(resultScope ? { scope: resultScope } : {}),
      conclusion: r.conclusion
        ? { claimId: r.conclusion.id, moid: r.conclusion.moid, text: r.conclusion.text }
        : null,
      scheme: primaryScheme
        ? { key: primaryScheme.key, name: primaryScheme.name, title: primaryScheme.title }
        : null,
      standingState,
      accessCount: r.permalink!.accessCount,
      createdAt: r.createdAt?.toISOString() ?? null,
      attestationUrl: `${BASE_URL}/api/a/${sc}/aif?format=attestation`,
      ...(queryTokens.length > 0
        ? {
            lexicalCoverage: {
              matched: entry.lexicalCoverage,
              outOf: queryTokens.length,
            },
          }
        : {}),
      ...(h
        ? {
            hybrid: {
              rrfScore: Math.round(h.rrfScore * 10000) / 10000,
              sparseRank: h.sparseRank,
              denseRank: h.denseRank,
              denseDistance:
                h.denseDistance == null
                  ? null
                  : Math.round(h.denseDistance * 1000) / 1000,
            },
          }
        : {}),
      ...(wantFitness
        ? {
            dialecticalFitness: Math.round(entry.fitness * 1000) / 1000,
            fitnessBreakdown: entry.fitnessBreakdown,
          }
        : {}),
      ...(includeStrongestCounter
        ? { strongestCounter: strongestCounterById.get(r.id) ?? null }
        : {}),
      ...(includeCitedBy
        ? { citedBy: citedBySummaryById.get(r.id) ?? null }
        : {}),
    };
  });

  return NextResponse.json(
    {
      ok: true,
      query: { ...echoQuery(), againstClaimText },
      // Self-describing fitness formula — lets clients (and verifiers) read
      // the weights without round-tripping to source. (Pt. 3 §1.)
      fitnessFormula: wantFitness ? FITNESS_WEIGHTS : undefined,
      count: results.length,
      // T1.3 — in `scope=both` mode, surface the within/cross split so the
      // consumer can see at a glance whether the cross-pollination signal
      // is even present in the result set.
      ...(withinDeliberation && scope === "both"
        ? {
            scopeBreakdown: {
              within: results.filter((r: any) => r.scope === "within").length,
              cross: results.filter((r: any) => r.scope === "cross").length,
            },
          }
        : {}),
      results,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

// ─────────────────────────────────────────────────────────────────────
// Phase 5 — strongestCounter helper
// ─────────────────────────────────────────────────────────────────────

type StrongestCounter = {
  argumentId: string;
  shortCode: string;
  permalink: string;
  attestationUrl: string;
  conclusion: { claimId: string; moid: string | null; text: string } | null;
  /** How the contester relates to the original. */
  source: "edge" | "conflict" | "edge+conflict";
};

/**
 * For each result row, find the "strongest" structural contester to its
 * conclusion claim. v0 ranking is `permalink.accessCount desc, createdAt
 * desc` — a community-engagement-then-recency proxy. A future iteration
 * should rank by dialectical fitness once that computation is cheap
 * enough to fan out across K results without blowing the request budget.
 *
 * Single-fanout: 2 prisma queries to find contester ids across all top-K
 * conclusion claim ids, then 1 prisma query to fetch the contester
 * argument rows. No N+1.
 *
 * Self-counters (same conclusion MOID as the original) are excluded.
 * Only public args (with a permalink) are returned.
 */
/** Phase 10a (10.3) — per-result downstream cited-by summary. */
type CitedBySummary = {
  total: number;
  contests: number;
  buildsOn: number;
  reuses: number;
  supports: number;
  externalTrusted: number;
  strongest: {
    kind: "supports" | "contests" | "builds-on" | "reuses";
    shortCode: string | null;
    permalink: string | null;
    text: string | null;
    standingState: string | null;
  } | null;
};

/**
 * Compose getArgumentCitedBy for the top-K results (bounded, opt-in, parallel).
 * Reuses the cited-by endpoint's exact classification, so counts here can never
 * drift from the /cited-by surface. `publicOnly` keeps unlinkable citers off
 * the public search card. "Strongest downstream" surfaces a contest when one
 * exists (the load-bearing signal), else the most recent citer.
 */
async function fetchCitedBySummaries(
  rows: Array<{ row: { id: string } }>,
): Promise<Map<string, CitedBySummary>> {
  const out = new Map<string, CitedBySummary>();
  await Promise.all(
    rows.map(async ({ row }) => {
      const cb = await getArgumentCitedBy(row.id, {
        limit: 5,
        sort: "recent",
        publicOnly: true,
      }).catch(() => null);
      if (!cb) return;
      const edge = cb.edges.find((e) => e.kind === "contests") ?? cb.edges[0] ?? null;
      out.set(row.id, {
        total: cb.counts.total,
        contests: cb.counts.contests,
        buildsOn: cb.counts.byKind["builds-on"],
        reuses: cb.counts.byKind.reuses,
        supports: cb.counts.byKind.supports,
        externalTrusted: cb.counts.externalTrusted,
        strongest: edge
          ? {
              kind: edge.kind,
              shortCode: edge.from.shortCode,
              permalink: edge.from.permalinkUrl,
              text: edge.from.text,
              standingState: edge.from.standingState,
            }
          : null,
      });
    }),
  );
  return out;
}

async function fetchStrongestCounters(
  rows: Array<{
    row: {
      id: string;
      conclusion?: { id: string; moid: string | null; text: string } | null;
    };
  }>,
): Promise<Map<string, StrongestCounter>> {
  const out = new Map<string, StrongestCounter>();
  const claimIdToOriginalArgId = new Map<string, string>();
  const originalMoidByArgId = new Map<string, string | null>();
  for (const r of rows) {
    const cid = r.row.conclusion?.id;
    if (!cid) continue;
    claimIdToOriginalArgId.set(cid, r.row.id);
    originalMoidByArgId.set(r.row.id, r.row.conclusion?.moid ?? null);
  }
  const claimIds = Array.from(claimIdToOriginalArgId.keys());
  if (claimIds.length === 0) return out;

  const [edges, conflicts] = await Promise.all([
    prisma.argumentEdge.findMany({
      where: {
        type: { in: ["rebut", "undercut"] as any },
        to: { conclusionClaimId: { in: claimIds } },
      },
      select: {
        fromArgumentId: true,
        to: { select: { conclusionClaimId: true } },
      },
      take: 500,
    }),
    prisma.conflictApplication.findMany({
      where: { conflictedClaimId: { in: claimIds } },
      select: {
        conflictingArgumentId: true,
        conflictedClaimId: true,
      } as any,
      take: 500,
    }),
  ]);

  // claimId → contester argId → which structural source(s) found it.
  const contestersByClaim = new Map<string, Map<string, "edge" | "conflict" | "edge+conflict">>();
  function record(claimId: string, argId: string, kind: "edge" | "conflict") {
    if (!contestersByClaim.has(claimId)) contestersByClaim.set(claimId, new Map());
    const m = contestersByClaim.get(claimId)!;
    const prior = m.get(argId);
    if (!prior) m.set(argId, kind);
    else if (prior !== kind) m.set(argId, "edge+conflict");
  }
  for (const e of edges) {
    const cid = e.to?.conclusionClaimId;
    if (!cid || !e.fromArgumentId) continue;
    record(cid, e.fromArgumentId, "edge");
  }
  for (const c of conflicts as any[]) {
    const cid = c?.conflictedClaimId;
    const aid = c?.conflictingArgumentId;
    if (!cid || !aid) continue;
    record(cid, aid, "conflict");
  }

  const allContesterIds = Array.from(
    new Set(
      Array.from(contestersByClaim.values()).flatMap((m) => Array.from(m.keys())),
    ),
  );
  if (allContesterIds.length === 0) return out;

  const argRows = await prisma.argument.findMany({
    where: { id: { in: allContesterIds }, permalink: { isNot: null } },
    select: {
      id: true,
      createdAt: true,
      conclusion: { select: { id: true, moid: true, text: true } },
      permalink: { select: { shortCode: true, accessCount: true } },
    },
  });
  const argById = new Map(argRows.map((a) => [a.id, a]));

  for (const r of rows) {
    const cid = r.row.conclusion?.id;
    if (!cid) continue;
    const candidates = contestersByClaim.get(cid);
    if (!candidates) continue;
    const originalMoid = originalMoidByArgId.get(r.row.id) ?? null;
    const ranked = Array.from(candidates.entries())
      .map(([argId, source]) => ({ arg: argById.get(argId), source }))
      .filter(
        (c): c is { arg: NonNullable<typeof c.arg>; source: typeof c.source } =>
          !!c.arg &&
          !!c.arg.permalink &&
          // Honesty rule: same conclusion MOID is not a counter.
          (originalMoid == null || c.arg.conclusion?.moid !== originalMoid),
      )
      .sort((a, b) => {
        const ac = a.arg.permalink!.accessCount ?? 0;
        const bc = b.arg.permalink!.accessCount ?? 0;
        if (ac !== bc) return bc - ac;
        const at = a.arg.createdAt ? +new Date(a.arg.createdAt) : 0;
        const bt = b.arg.createdAt ? +new Date(b.arg.createdAt) : 0;
        return bt - at;
      });

    const best = ranked[0];
    if (!best) continue;
    const sc = best.arg.permalink!.shortCode;
    out.set(r.row.id, {
      argumentId: best.arg.id,
      shortCode: sc,
      permalink: `${BASE_URL}/a/${sc}`,
      attestationUrl: `${BASE_URL}/api/a/${sc}/aif?format=attestation`,
      conclusion: best.arg.conclusion
        ? {
            claimId: best.arg.conclusion.id,
            moid: best.arg.conclusion.moid ?? null,
            text: best.arg.conclusion.text,
          }
        : null,
      source: best.source,
    });
  }

  return out;
}