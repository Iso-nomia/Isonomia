// components/sources/index.ts
// Phase 3.1: Source Trust Components Barrel Export
// Phase 1.1: Paper-to-Claim Pipeline Components
// Phase 3.3: Cross-Platform Intelligence Components

export { VerificationBadge, type SourceVerificationStatus } from "./VerificationBadge";
export { ArchiveBadge, type ArchiveStatus } from "./ArchiveBadge";
export { SourceTrustBadges, type SourceTrustData } from "./SourceTrustBadges";

// Phase 1.1: Paper-to-Claim Pipeline
export { DOIInput, DOIInputCompact } from "./DOIInput";
export { SourceDetailPage } from "./SourceDetailPage";

// Phase 3.3: Cross-Platform Intelligence
export { SourceCrossReferences } from "./SourceCrossReferences";
export { SourceUsageStats } from "./SourceUsageStats";
export { ProvenanceChain } from "./ProvenanceChain";
