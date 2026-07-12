/**
 * Phase 3.3: Cross-Deliberation Claim Mapping
 * 
 * Central export for all cross-deliberation functionality.
 * 
 * Features:
 * - Canonical Claim Registry: Register claims to a global registry for cross-room tracking
 * - Cross-Room Search: Search claims and arguments across all deliberations
 * - Argument Transport: Import arguments from one deliberation to another with provenance
 * - Related Deliberations: Find deliberations that share canonical claims
 */

// Types
export * from "./types";

// Services
export {
  findOrCreateCanonicalClaim,
  linkClaimToCanonical as registerClaimInstanceToCanonical,
  searchCanonicalClaims,
  createClaimEquivalence as linkClaimEquivalence,
} from "./canonicalRegistryService";

export {
  searchClaimsAcrossRooms,
  findRelatedDeliberations,
  getClaimCrossRoomStatus,
} from "./crossRoomSearchService";

export { importArgument } from "./argumentTransportService";

// Hooks
export {
  crossDelibKeys,
  useCrossRoomSearch,
  useCanonicalClaims,
  useRelatedDeliberations,
  useClaimCrossRoomStatus,
  useRegisterCanonicalClaim,
  useImportArgument,
} from "./hooks";
