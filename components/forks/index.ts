/**
 * Fork Components - Barrel Exports
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 */

// ─────────────────────────────────────────────────────────
// Fork Type Components
// ─────────────────────────────────────────────────────────

export {
  ForkBadge,
  ForkIndicator,
  ForkTypePicker,
  FORK_TYPE_CONFIG,
} from "./ForkBadge";
export type {
  ForkType,
  ForkBadgeProps,
  ForkIndicatorProps,
  ForkTypePickerProps,
} from "./ForkBadge";

// ─────────────────────────────────────────────────────────
// Create Fork Modal
// ─────────────────────────────────────────────────────────

export { CreateForkModal } from "./CreateForkModal";
export type {
  CreateForkResult,
  CreateForkModalProps,
} from "./CreateForkModal";

// ─────────────────────────────────────────────────────────
// Fork List Components
// ─────────────────────────────────────────────────────────

export {
  ForkListItem,
  ForkListItemSkeleton,
  ForkListPanel,
  ForkTreeView,
} from "./ForkListPanel";
export type {
  ForkListItemData,
  ForkTreeNode,
  ForkListItemProps,
  ForkListPanelProps,
  ForkTreeViewProps,
} from "./ForkListPanel";

// ─────────────────────────────────────────────────────────
// Merge Request Components
// ─────────────────────────────────────────────────────────

export {
  MergeStatusBadge,
  MergeRequestCard,
  MergeRequestCardSkeleton,
  MergeRequestListPanel,
} from "./MergeRequestPanel";
export type {
  MergeStatus,
  MergeRequestData,
  MergeStatusBadgeProps,
  MergeRequestCardProps,
  MergeRequestListPanelProps,
} from "./MergeRequestPanel";

// ─────────────────────────────────────────────────────────
// Merge Workflow Components — archived (wave 2.2). The
// "./MergeWorkflow" module no longer exists; re-exports removed.
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// Create Merge Request Modal
// ─────────────────────────────────────────────────────────

export { CreateMergeRequestModal } from "./CreateMergeRequestModal";
export type {
  CreateMergeRequestResult,
  CreateMergeRequestModalProps,
} from "./CreateMergeRequestModal";
