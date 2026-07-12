/**
 * Claim Embedding Service (Simplified)
 * 
 * Phase 1.2: Claim-Based Search & Discovery
 * 
 * SIMPLIFIED VERSION: Uses PostgreSQL full-text search instead of vector embeddings.
 * This provides a working search feature without requiring Pinecone setup.
 * 
 * TODO: Upgrade to vector search with Pinecone for better semantic matching.
 * When ready, set USE_VECTOR_SEARCH=true and configure Pinecone credentials.
 */

import { prisma } from "@/lib/prisma";
import { Claim, AcademicClaimType } from "@prisma/client";

// ─────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────

// Feature flag for future Pinecone integration
export const USE_VECTOR_SEARCH = process.env.USE_VECTOR_SEARCH === "true";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ClaimMetadata {
  claimId: string;
  text: string;
  claimType: string | null;
  academicClaimType: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  authorOrcids: string[];
  createdAt: string;
  deliberationId: string | null;
  humanVerified: boolean;
  extractedByAI: boolean;
}

export interface ClaimWithSource extends Claim {
  source?: {
    name?: string;
    title?: string;
    authorOrcids?: string[];
  } | null;
}

export interface IndexingResult {
  indexed: number;
  failed: number;
  errors?: string[];
}

// ─────────────────────────────────────────────────────────
// Simplified Indexing (No-op for PostgreSQL version)
// ─────────────────────────────────────────────────────────

/**
 * Index a single claim
 * SIMPLIFIED: No-op since PostgreSQL handles text search natively
 */
export async function indexClaim(claim: ClaimWithSource): Promise<void> {
  // No-op for PostgreSQL full-text search
  // Claims are automatically searchable via the text column
  console.log(`[ClaimIndex] Claim ${claim.id} ready for search (PostgreSQL FTS)`);
}

/**
 * Index multiple claims
 * SIMPLIFIED: No-op since PostgreSQL handles text search natively
 */
export async function indexClaimsBatch(
  claims: ClaimWithSource[]
): Promise<IndexingResult> {
  // No-op for PostgreSQL full-text search
  console.log(`[ClaimIndex] ${claims.length} claims ready for search (PostgreSQL FTS)`);
  return { indexed: claims.length, failed: 0 };
}

/**
 * Delete a claim from the index
 * SIMPLIFIED: No-op since deletion is handled by Prisma
 */
export async function deleteClaimFromIndex(claimId: string): Promise<void> {
  // No-op for PostgreSQL - claim deletion removes from search automatically
  console.log(`[ClaimIndex] Claim ${claimId} removed from search`);
}

/**
 * Delete multiple claims from the index
 * SIMPLIFIED: No-op since deletion is handled by Prisma
 */
export async function deleteClaimsFromIndex(claimIds: string[]): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndex] ${claimIds.length} claims removed from search`);
}

/**
 * Update claim metadata in the index
 * SIMPLIFIED: No-op since PostgreSQL reads directly from database
 */
export async function updateClaimMetadata(
  claimId: string,
  metadata: Partial<ClaimMetadata>
): Promise<void> {
  // No-op for PostgreSQL - metadata is always fresh from database
  console.log(`[ClaimIndex] Claim ${claimId} metadata updated`);
}

// ─────────────────────────────────────────────────────────
// Stats & Health Check
// ─────────────────────────────────────────────────────────

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<{
  totalVectors: number;
  dimension: number;
  indexFullness: number;
  mode: "postgresql" | "pinecone";
}> {
  const count = await prisma.claim.count();
  
  return {
    totalVectors: count,
    dimension: 0, // Not applicable for PostgreSQL
    indexFullness: 0,
    mode: "postgresql",
  };
}

/**
 * Check if a claim is indexed (always true for PostgreSQL)
 */
export async function isClaimIndexed(claimId: string): Promise<boolean> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true },
  });
  return !!claim;
}

/**
 * Reindex all claims
 * SIMPLIFIED: No-op for PostgreSQL, but returns stats for consistency
 */
export async function reindexAllClaims(options?: {
  sourceId?: string;
}): Promise<{
  total: number;
  indexed: number;
  failed: number;
}> {
  const whereClause: any = {};
  
  if (options?.sourceId) {
    whereClause.sourceId = options.sourceId;
  }

  const count = await prisma.claim.count({ where: whereClause });

  console.log(`[ClaimIndex] PostgreSQL FTS mode - ${count} claims searchable`);

  return {
    total: count,
    indexed: count,
    failed: 0,
  };
}

// ─────────────────────────────────────────────────────────
// Future: Vector Search Placeholder
// ─────────────────────────────────────────────────────────

/**
 * Generate embedding for text
 * PLACEHOLDER: Returns empty array in simplified mode
 * TODO: Implement with OpenAI when USE_VECTOR_SEARCH=true
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (USE_VECTOR_SEARCH) {
    throw new Error("Vector search not yet implemented. Set USE_VECTOR_SEARCH=false");
  }
  return [];
}
