/**
 * Claim Indexing Hooks (Simplified)
 * 
 * Phase 1.2: Claim-Based Search & Discovery
 * 
 * SIMPLIFIED VERSION: Minimal hooks since PostgreSQL handles search natively.
 * These hooks are mostly no-ops but maintain the API for future vector search.
 */

import { USE_VECTOR_SEARCH } from "@/lib/search/claimEmbeddings";

// ─────────────────────────────────────────────────────────
// Lifecycle Hooks (No-ops for PostgreSQL mode)
// ─────────────────────────────────────────────────────────

/**
 * Hook to call after a claim is created
 * SIMPLIFIED: No-op since PostgreSQL searches claims directly
 */
export async function onClaimCreated(claimId: string): Promise<void> {
  // No-op for PostgreSQL - claims are immediately searchable
  console.log(`[ClaimIndexing] Claim ${claimId} created and searchable`);
}

/**
 * Hook to call after a claim is updated
 * SIMPLIFIED: No-op since PostgreSQL reads from source
 */
export async function onClaimUpdated(claimId: string): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndexing] Claim ${claimId} updated`);
}

/**
 * Hook to call after a claim is deleted
 * SIMPLIFIED: No-op since Prisma handles deletion
 */
export async function onClaimDeleted(claimId: string): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndexing] Claim ${claimId} deleted`);
}

/**
 * Hook to call after a claim is verified
 * SIMPLIFIED: No-op since PostgreSQL reads from source
 */
export async function onClaimVerified(claimId: string): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndexing] Claim ${claimId} verified`);
}

/**
 * Hook to call when a claim is added to a deliberation
 * SIMPLIFIED: No-op for PostgreSQL
 */
export async function onClaimAddedToDeliberation(
  claimId: string,
  deliberationId: string
): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndexing] Claim ${claimId} linked to deliberation ${deliberationId}`);
}

// ─────────────────────────────────────────────────────────
// Batch Hooks
// ─────────────────────────────────────────────────────────

/**
 * Hook to call after multiple claims are created
 */
export async function onClaimsCreated(claimIds: string[]): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndexing] ${claimIds.length} claims created and searchable`);
}

/**
 * Hook to call after multiple claims are deleted
 */
export async function onClaimsDeleted(claimIds: string[]): Promise<void> {
  // No-op for PostgreSQL
  console.log(`[ClaimIndexing] ${claimIds.length} claims deleted`);
}

// ─────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────

/**
 * Check if indexing is enabled (always true for PostgreSQL mode)
 */
export function isIndexingEnabled(): boolean {
  return true;
}

/**
 * Check indexing health
 */
export async function checkIndexingHealth(): Promise<{
  enabled: boolean;
  configured: boolean;
  operational: boolean;
  mode: "postgresql" | "pinecone";
  error?: string;
}> {
  return {
    enabled: true,
    configured: true,
    operational: true,
    mode: USE_VECTOR_SEARCH ? "pinecone" : "postgresql",
  };
}

/**
 * Wrapper to safely call indexing hooks (no-op passthrough)
 */
export function safeIndexingHook<T extends (...args: any[]) => Promise<void>>(
  hook: T
): T {
  return hook;
}
