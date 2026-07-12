/**
 * Provenance Components Barrel Export
 * 
 * Phase 3.1: Claim Provenance Tracking
 * 
 * UI components for displaying claim provenance information:
 * - Consensus status indicators
 * - Timeline of claim history
 * - Challenge/attack cards
 * - Version history
 * - Canonical claim cards
 */

// ConsensusIndicator - Consensus status display
export {
  ConsensusIndicator,
  ConsensusStatusSelect,
  ChallengeBreakdown,
  type ConsensusIndicatorProps,
} from "./ConsensusIndicator";

// ProvenanceTimeline - Timeline of claim history events
export {
  ProvenanceTimeline,
  ProvenanceTimelineSkeleton,
  ProvenanceTimelineCompact,
  type ProvenanceTimelineProps,
  type ProvenanceTimelineCompactProps,
} from "./ProvenanceTimeline";

// ChallengeCard - Attack/defense display
export {
  ChallengeCard,
  ChallengeReportCard,
  ChallengeCardSkeleton,
  type ChallengeCardProps,
  type ChallengeReportCardProps,
} from "./ChallengeCard";

// VersionCard - Version history display
export {
  VersionCard,
  VersionList,
  VersionBadge,
  VersionCompare,
  VersionListSkeleton,
  type VersionCardProps,
  type VersionListProps,
  type VersionBadgeProps,
  type VersionCompareProps,
} from "./VersionCard";

// CanonicalClaimCard - Cross-deliberation identity
export {
  CanonicalClaimCard,
  CanonicalClaimBadge,
  CanonicalClaimLink,
  CanonicalClaimCardSkeleton,
  type CanonicalClaimCardProps,
  type CanonicalClaimBadgeProps,
  type CanonicalClaimLinkProps,
  type CanonicalClaimData,
  type CanonicalClaimInstance,
} from "./CanonicalClaimCard";
