/**
 * Claim Search Service (Simplified)
 * 
 * Phase 1.2: Claim-Based Search & Discovery
 * 
 * SIMPLIFIED VERSION: Uses PostgreSQL text search (ILIKE) instead of vector search.
 * Provides keyword matching with filters - good enough for MVP, upgrade later.
 * 
 * TODO: Upgrade to Pinecone vector search for semantic matching.
 * The API interface is designed to be drop-in compatible with future vector impl.
 */

import { prisma } from "@/lib/prisma";
import { AcademicClaimType, Prisma } from "@prisma/client";
import { USE_VECTOR_SEARCH } from "./claimEmbeddings";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ClaimSearchParams {
  query: string;
  types?: AcademicClaimType[];
  sourceId?: string;
  authorOrcid?: string;
  deliberationId?: string;
  excludeClaimIds?: string[];
  humanVerifiedOnly?: boolean;
  aiExtractedOnly?: boolean;
  limit?: number;
  minScore?: number; // Ignored in simplified mode
}

export interface ClaimSearchResult {
  claimId: string;
  score: number;
  text: string;
  claimType: string | null;
  academicClaimType: AcademicClaimType | null;
  sourceId: string | null;
  sourceTitle: string | null;
  humanVerified: boolean;
  extractedByAI: boolean;
}

export interface SearchResponse {
  results: ClaimSearchResult[];
  total: number;
  query: string;
  filters: Record<string, any>;
  mode: "postgresql" | "pinecone";
}

export interface RelatedClaim {
  claimId: string;
  text: string;
  claimType: string | null;
  academicClaimType: AcademicClaimType | null;
  sourceTitle: string | null;
  edgeType: string;
  direction: "incoming" | "outgoing";
  createdAt?: Date;
}

export interface ChallengesResponse {
  rebuttals: RelatedClaim[];
  undercuts: RelatedClaim[];
  undermines: RelatedClaim[];
}

// ─────────────────────────────────────────────────────────
// Search Functions
// ─────────────────────────────────────────────────────────

/**
 * Parse query into search terms for ILIKE matching
 */
function parseSearchTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .slice(0, 10); // Limit to 10 terms
}

/**
 * Calculate simple relevance score based on term matches
 */
function calculateScore(text: string, terms: string[]): number {
  const lowerText = text.toLowerCase();
  let matches = 0;
  
  for (const term of terms) {
    if (lowerText.includes(term)) {
      matches++;
    }
  }
  
  return terms.length > 0 ? matches / terms.length : 0;
}

/**
 * Search claims using PostgreSQL text matching
 * SIMPLIFIED: Uses ILIKE for keyword matching instead of vector similarity
 */
export async function searchClaims(
  params: ClaimSearchParams
): Promise<SearchResponse> {
  const {
    query,
    types,
    sourceId,
    authorOrcid,
    excludeClaimIds = [],
    humanVerifiedOnly = false,
    aiExtractedOnly = false,
    limit = 20,
  } = params;

  const searchTerms = parseSearchTerms(query);

  // Build where clause
  const where: Prisma.ClaimWhereInput = {
    // Text search using OR of ILIKE patterns
    AND: searchTerms.map((term) => ({
      text: { contains: term, mode: "insensitive" as Prisma.QueryMode },
    })),
  };

  // Apply filters
  if (types && types.length > 0) {
    where.academicClaimType = { in: types };
  }

  if (sourceId) {
    where.sourceId = sourceId;
  }

  if (authorOrcid) {
    where.source = {
      authorOrcids: { has: authorOrcid },
    };
  }

  if (humanVerifiedOnly) {
    where.humanVerified = true;
  }

  if (aiExtractedOnly) {
    where.extractedByAI = true;
  }

  if (excludeClaimIds.length > 0) {
    where.id = { notIn: excludeClaimIds };
  }

  // Query database
  const claims = await prisma.claim.findMany({
    where,
    include: {
      source: {
        select: { title: true },
      },
    },
    take: limit * 2, // Get extra for scoring/sorting
    orderBy: { createdAt: "desc" },
  });

  // Score and sort results
  const scoredResults = claims
    .map((claim) => ({
      claimId: claim.id,
      score: calculateScore(claim.text, searchTerms),
      text: claim.text,
      claimType: claim.claimType,
      academicClaimType: claim.academicClaimType,
      sourceId: claim.sourceId,
      sourceTitle: claim.source?.title || null,
      humanVerified: claim.humanVerified,
      extractedByAI: claim.extractedByAI,
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    results: scoredResults,
    total: scoredResults.length,
    query,
    filters: { types, sourceId, authorOrcid, humanVerifiedOnly, aiExtractedOnly },
    mode: "postgresql",
  };
}

/**
 * Find claims similar to a given claim
 * SIMPLIFIED: Uses keyword extraction from the claim text
 */
export async function findSimilarClaims(
  claimId: string,
  limit = 10,
  minScore = 0.3
): Promise<ClaimSearchResult[]> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
  });

  if (!claim) {
    throw new Error(`Claim ${claimId} not found`);
  }

  // Extract key terms from the claim (simple approach)
  const response = await searchClaims({
    query: claim.text,
    excludeClaimIds: [claimId],
    limit,
  });

  return response.results.filter((r) => r.score >= minScore);
}

/**
 * Find claims that attack or support a given claim via edges
 */
export async function findRelatedClaims(claimId: string): Promise<{
  attacks: RelatedClaim[];
  supports: RelatedClaim[];
  similar: ClaimSearchResult[];
}> {
  // Get direct relationships from ClaimEdge table
  const edges = await prisma.claimEdge.findMany({
    where: {
      OR: [{ fromClaimId: claimId }, { toClaimId: claimId }],
    },
    include: {
      from: {
        include: {
          source: { select: { title: true } },
        },
      },
      to: {
        include: {
          source: { select: { title: true } },
        },
      },
    },
  });

  const attacks: RelatedClaim[] = [];
  const supports: RelatedClaim[] = [];

  for (const edge of edges) {
    const isOutgoing = edge.fromClaimId === claimId;
    const relatedClaim = isOutgoing ? edge.to : edge.from;
    const direction = isOutgoing ? "outgoing" : "incoming";

    const related: RelatedClaim = {
      claimId: relatedClaim.id,
      text: relatedClaim.text,
      claimType: relatedClaim.claimType,
      academicClaimType: relatedClaim.academicClaimType,
      sourceTitle: relatedClaim.source?.title || null,
      edgeType: edge.type,
      direction,
      createdAt: relatedClaim.createdAt,
    };

    // Categorize by edge type
    if (edge.type === "rebuts") {
      attacks.push(related);
    } else if (edge.type === "supports") {
      supports.push(related);
    }
  }

  // Get text-similar claims
  let similar: ClaimSearchResult[] = [];
  try {
    similar = await findSimilarClaims(claimId, 5, 0.3);
  } catch (error) {
    console.warn(`Could not find similar claims for ${claimId}:`, error);
  }

  return { attacks, supports, similar };
}

/**
 * Get claims that challenge a specific claim
 */
export async function getChallenges(claimId: string): Promise<ChallengesResponse> {
  const edges = await prisma.claimEdge.findMany({
    where: {
      toClaimId: claimId,
      type: "rebuts",
    },
    include: {
      from: {
        include: {
          source: { select: { title: true } },
        },
      },
    },
  });

  const rebuttals: RelatedClaim[] = [];
  const undercuts: RelatedClaim[] = [];
  const undermines: RelatedClaim[] = [];

  for (const edge of edges) {
    const related: RelatedClaim = {
      claimId: edge.from.id,
      text: edge.from.text,
      claimType: edge.from.claimType,
      academicClaimType: edge.from.academicClaimType,
      sourceTitle: edge.from.source?.title || null,
      edgeType: edge.type,
      direction: "incoming",
      createdAt: edge.from.createdAt,
    };

    // Categorize by finer-grained attack type when available
    switch (edge.attackType) {
      case "UNDERCUTS":
        undercuts.push(related);
        break;
      case "UNDERMINES":
        undermines.push(related);
        break;
      case "REBUTS":
      default:
        rebuttals.push(related);
        break;
    }
  }

  return { rebuttals, undercuts, undermines };
}

/**
 * Get claims that support a specific claim
 */
export async function getSupports(claimId: string): Promise<RelatedClaim[]> {
  const edges = await prisma.claimEdge.findMany({
    where: {
      toClaimId: claimId,
      type: "supports",
    },
    include: {
      from: {
        include: {
          source: { select: { title: true } },
        },
      },
    },
  });

  return edges.map((edge) => ({
    claimId: edge.from.id,
    text: edge.from.text,
    claimType: edge.from.claimType,
    academicClaimType: edge.from.academicClaimType,
    sourceTitle: edge.from.source?.title || null,
    edgeType: edge.type,
    direction: "incoming" as const,
    createdAt: edge.from.createdAt,
  }));
}

// ─────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────

/**
 * Find potential duplicate claims using text similarity
 */
export async function findPotentialDuplicates(
  claimText: string,
  options?: {
    sourceId?: string;
    excludeClaimId?: string;
    threshold?: number;
  }
): Promise<ClaimSearchResult[]> {
  const threshold = options?.threshold || 0.6;

  const response = await searchClaims({
    query: claimText,
    sourceId: options?.sourceId,
    excludeClaimIds: options?.excludeClaimId ? [options.excludeClaimId] : [],
    limit: 5,
  });

  return response.results.filter((r) => r.score >= threshold);
}

/**
 * Get claims by author ORCID
 */
export async function getClaimsByAuthor(
  authorOrcid: string,
  options?: {
    types?: AcademicClaimType[];
    limit?: number;
  }
): Promise<ClaimSearchResult[]> {
  const claims = await prisma.claim.findMany({
    where: {
      source: {
        authorOrcids: { has: authorOrcid },
      },
      academicClaimType: options?.types ? { in: options.types } : undefined,
    },
    include: {
      source: { select: { title: true } },
    },
    take: options?.limit || 50,
    orderBy: { createdAt: "desc" },
  });

  return claims.map((claim) => ({
    claimId: claim.id,
    score: 1.0,
    text: claim.text,
    claimType: claim.claimType,
    academicClaimType: claim.academicClaimType,
    sourceId: claim.sourceId,
    sourceTitle: claim.source?.title || null,
    humanVerified: claim.humanVerified,
    extractedByAI: claim.extractedByAI,
  }));
}

/**
 * Get recent verified claims
 */
export async function getRecentVerifiedClaims(
  limit = 20
): Promise<ClaimSearchResult[]> {
  const claims = await prisma.claim.findMany({
    where: {
      humanVerified: true,
    },
    include: {
      source: { select: { title: true } },
    },
    orderBy: { verifiedAt: "desc" },
    take: limit,
  });

  return claims.map((claim) => ({
    claimId: claim.id,
    score: 1.0,
    text: claim.text,
    claimType: claim.claimType,
    academicClaimType: claim.academicClaimType,
    sourceId: claim.sourceId,
    sourceTitle: claim.source?.title || null,
    humanVerified: true,
    extractedByAI: claim.extractedByAI,
  }));
}
