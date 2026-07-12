/**
 * Argument Citation Components
 *
 * Phase 3.3: Argument-Level Citations
 *
 * Barrel exports for all argument citation components.
 */

// Badge components
export {
  ArgumentCitationBadge,
  CitationTypeSelector,
  ArgumentCitationBadgeSkeleton,
  type ArgumentCitationBadgeProps,
  type CitationTypeSelectorProps,
} from "./ArgumentCitationBadge";

// Card components
export {
  ArgumentCitationCard,
  ArgumentCitationCardCompact,
  ArgumentCitationList,
  ArgumentCitationCardSkeleton,
  type ArgumentCitationCardProps,
  type ArgumentCitationCardCompactProps,
  type ArgumentCitationListProps,
} from "./ArgumentCitationCard";

// Permalink components
export {
  PermalinkCopyButton,
  PermalinkDisplay,
  type PermalinkCopyButtonProps,
  type PermalinkDisplayProps,
} from "./PermalinkCopyButton";

// Graph visualization
export {
  ArgumentCitationGraphViewer,
  CitationGraphStats,
  type ArgumentCitationGraphViewerProps,
  type CitationGraphStatsProps,
} from "./ArgumentCitationGraphViewer";

// Modal components
export {
  CreateCitationModal,
  QuickCiteButton,
  type CreateCitationModalProps,
  type QuickCiteButtonProps,
} from "./CreateCitationModal";
