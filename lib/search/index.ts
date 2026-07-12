/**
 * Search Module Exports
 * 
 * Phase 1.2: Claim-Based Search & Discovery
 * 
 * SIMPLIFIED VERSION: PostgreSQL text search (upgrade to Pinecone later)
 */

export {
  // Types
  type ClaimMetadata,
  type ClaimWithSource,
  type IndexingResult,
  // Functions
  indexClaim,
  indexClaimsBatch,
  deleteClaimFromIndex,
  deleteClaimsFromIndex,
  updateClaimMetadata,
  getIndexStats,
  isClaimIndexed,
  reindexAllClaims,
  generateEmbedding,
  USE_VECTOR_SEARCH,
} from "./claimEmbeddings";

export {
  // Types
  type ClaimSearchParams,
  type ClaimSearchResult,
  type SearchResponse,
  type RelatedClaim,
  type ChallengesResponse,
  // Functions
  searchClaims,
  findSimilarClaims,
  findRelatedClaims,
  getChallenges,
  getSupports,
  findPotentialDuplicates,
  getClaimsByAuthor,
  getRecentVerifiedClaims,
} from "./claimSearch";
