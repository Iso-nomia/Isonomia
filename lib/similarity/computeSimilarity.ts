/**
 * Phase 3.4.2: Similarity Computation
 *
 * Computes similarity scores between deliberations and stacks
 * based on topic overlap, citation similarity, and participant overlap.
 */

import { prisma } from "@/lib/prismaclient";

export interface SimilarityScore {
  id: string;
  type: "deliberation" | "stack";
  title: string;
  score: number;
  reasons: string[];
  metadata?: {
    sharedSources?: number;
    sharedTopics?: number;
    overlapRatio?: number;
  };
}

/**
 * Citations are attached polymorphically (targetType / targetId), not via a
 * direct Deliberation.citations relation. The canonical mapping (see
 * lib/schemes/protocol/closeDeliberation.ts) is: a citation belongs to a
 * deliberation when it targets a Claim whose `deliberationId` matches.
 *
 * Returns the distinct Source ids cited within the given deliberation.
 */
async function sourceIdsForDeliberation(deliberationId: string): Promise<string[]> {
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true },
  });
  const claimIds = claims.map((c) => c.id);
  if (claimIds.length === 0) return [];

  const citations = await prisma.citation.findMany({
    where: { targetType: "claim", targetId: { in: claimIds } },
    select: { sourceId: true },
  });
  return Array.from(new Set(citations.map((c) => c.sourceId)));
}

/**
 * Extract normalized topic keywords from a set of Source rows.
 * `Source.keywords` is the schema field holding subject keywords.
 */
function normalizeTopics(keywords: string[] | null | undefined): string[] {
  return (keywords ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Find deliberations related to the given deliberation
 * based on shared sources and topic overlap
 */
export async function findRelatedDeliberations(
  deliberationId: string,
  limit: number = 10
): Promise<SimilarityScore[]> {
  // Get current deliberation's cited source ids
  const currentSourceIds = new Set(await sourceIdsForDeliberation(deliberationId));

  // If no sources, can't compute similarity
  if (currentSourceIds.size === 0) return [];

  // Get topics from current sources (Source.keywords)
  const sources = await prisma.source.findMany({
    where: { id: { in: Array.from(currentSourceIds) } },
    select: { keywords: true },
  });

  const currentTopics = new Set<string>();
  for (const source of sources) {
    for (const normalized of normalizeTopics(source.keywords)) {
      currentTopics.add(normalized);
    }
  }

  // Find other public deliberations that cite the same sources. Citations are
  // polymorphic, so we walk: shared sources -> citations -> target claims ->
  // their deliberations.
  const sharingCitations = await prisma.citation.findMany({
    where: {
      targetType: "claim",
      sourceId: { in: Array.from(currentSourceIds) },
    },
    select: { sourceId: true, targetId: true },
  });

  const targetClaimIds = Array.from(new Set(sharingCitations.map((c) => c.targetId)));
  if (targetClaimIds.length === 0) return [];

  const claims = await prisma.claim.findMany({
    where: { id: { in: targetClaimIds }, deliberationId: { not: null } },
    select: { id: true, deliberationId: true },
  });

  // Map claim id -> deliberation id
  const claimToDelib = new Map<string, string>();
  for (const c of claims) {
    if (c.deliberationId) claimToDelib.set(c.id, c.deliberationId);
  }

  // Collect candidate deliberation ids (excluding the current one) and the
  // set of shared source ids per deliberation.
  const delibSharedSources = new Map<string, Set<string>>();
  for (const cit of sharingCitations) {
    const delibId = claimToDelib.get(cit.targetId);
    if (!delibId || delibId === deliberationId) continue;
    const set = delibSharedSources.get(delibId) ?? new Set<string>();
    set.add(cit.sourceId);
    delibSharedSources.set(delibId, set);
  }

  const candidateIds = Array.from(delibSharedSources.keys());
  if (candidateIds.length === 0) return [];

  const otherDelibs = await prisma.deliberation.findMany({
    where: {
      id: { in: candidateIds },
      visibility: "public",
    },
    select: {
      id: true,
      title: true,
    },
    take: 100, // Limit for performance
  });

  // Score each deliberation
  const scores: SimilarityScore[] = [];

  for (const delib of otherDelibs) {
    const reasons: string[] = [];
    let score = 0;

    // Source overlap
    const delibSourceIds = delibSharedSources.get(delib.id) ?? new Set<string>();
    const sharedSources = [...currentSourceIds].filter((id) =>
      delibSourceIds.has(id)
    );

    if (sharedSources.length > 0) {
      const sourceScore = sharedSources.length * 10;
      score += sourceScore;
      reasons.push(`${sharedSources.length} shared source${sharedSources.length > 1 ? "s" : ""}`);
    }

    // Topic overlap (only compute if we have topics)
    let sharedTopicsCount = 0;
    if (currentTopics.size > 0 && delibSourceIds.size > 0) {
      const delibSources = await prisma.source.findMany({
        where: { id: { in: Array.from(delibSourceIds) } },
        select: { keywords: true },
      });

      const delibTopics = new Set<string>();
      for (const source of delibSources) {
        for (const normalized of normalizeTopics(source.keywords)) {
          delibTopics.add(normalized);
        }
      }

      const sharedTopics = [...currentTopics].filter((t) => delibTopics.has(t));
      sharedTopicsCount = sharedTopics.length;

      if (sharedTopicsCount > 0) {
        const topicScore = sharedTopicsCount * 5;
        score += topicScore;
        reasons.push(`${sharedTopicsCount} shared topic${sharedTopicsCount > 1 ? "s" : ""}`);
      }
    }

    if (score > 0) {
      scores.push({
        id: delib.id,
        type: "deliberation",
        title: delib.title ?? "",
        score,
        reasons,
        metadata: {
          sharedSources: sharedSources.length,
          sharedTopics: sharedTopicsCount,
        },
      });
    }
  }

  // Sort by score and return top N
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Find stacks related to a deliberation based on shared sources.
 *
 * NOTE: The current data model does not link StackItem rows to Source rows
 * (StackItem references LibraryPost blocks or embedded stacks, neither of
 * which carries a Source foreign key). There is therefore no schema-supported
 * path from a deliberation's cited sources to stacks, so this returns an empty
 * result set. The signature is preserved for callers; restore the body once a
 * Source <-> Stack linkage exists in the schema.
 */
export async function findRelatedStacks(
  _deliberationId: string,
  _limit: number = 10
): Promise<SimilarityScore[]> {
  return [];
}

/**
 * Find sources related to a given source
 * based on shared topics or citations in same deliberations
 */
export async function findRelatedSources(
  sourceId: string,
  limit: number = 10
): Promise<SimilarityScore[]> {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      keywords: true,
      citations: {
        select: { id: true, targetType: true, targetId: true },
      },
    },
  });

  if (!source) return [];

  const sourceTopics = new Set<string>(normalizeTopics(source.keywords));

  // Resolve this source's citations down to the deliberations they belong to
  // (via their target claims).
  const claimTargetIds = source.citations
    .filter((c) => c.targetType === "claim")
    .map((c) => c.targetId);

  const sourceDelibIds = new Set<string>();
  if (claimTargetIds.length > 0) {
    const claims = await prisma.claim.findMany({
      where: { id: { in: claimTargetIds }, deliberationId: { not: null } },
      select: { deliberationId: true },
    });
    for (const c of claims) {
      if (c.deliberationId) sourceDelibIds.add(c.deliberationId);
    }
  }

  if (sourceDelibIds.size === 0) return [];

  // Find the claims belonging to those deliberations, then the citations that
  // target those claims (excluding this source) to discover co-cited sources.
  const coDelibClaims = await prisma.claim.findMany({
    where: { deliberationId: { in: Array.from(sourceDelibIds) } },
    select: { id: true },
  });
  const coClaimIds = coDelibClaims.map((c) => c.id);
  if (coClaimIds.length === 0) return [];

  const coOccurringCitations = await prisma.citation.findMany({
    where: {
      targetType: "claim",
      targetId: { in: coClaimIds },
      sourceId: { not: sourceId },
    },
    select: {
      sourceId: true,
      source: {
        select: {
          id: true,
          title: true,
          keywords: true,
        },
      },
    },
  });

  // Score each related source
  type RelatedSourceAgg = {
    source: { id: string; title: string | null; keywords: string[] };
    coOccur: number;
    topicOverlap: number;
  };
  const scoreMap = new Map<string, RelatedSourceAgg>();

  for (const citation of coOccurringCitations) {
    if (!citation.source) continue;

    const existing = scoreMap.get(citation.sourceId);
    if (existing) {
      existing.coOccur++;
    } else {
      const relatedTopics = new Set<string>(normalizeTopics(citation.source.keywords));
      const sharedTopics = [...sourceTopics].filter((t) => relatedTopics.has(t));

      scoreMap.set(citation.sourceId, {
        source: citation.source,
        coOccur: 1,
        topicOverlap: sharedTopics.length,
      });
    }
  }

  // Convert to scores
  const scores: SimilarityScore[] = [];

  for (const [id, data] of scoreMap) {
    const score = data.coOccur * 5 + data.topicOverlap * 3;
    const reasons: string[] = [];

    if (data.coOccur > 0) {
      reasons.push(`cited together ${data.coOccur} time${data.coOccur > 1 ? "s" : ""}`);
    }
    if (data.topicOverlap > 0) {
      reasons.push(`${data.topicOverlap} shared topic${data.topicOverlap > 1 ? "s" : ""}`);
    }

    if (reasons.length > 0) {
      scores.push({
        id,
        type: "deliberation", // Reusing type for sources
        title: data.source.title ?? "",
        score,
        reasons,
      });
    }
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
