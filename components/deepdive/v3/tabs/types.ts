/**
 * Type definitions for Deliberation Panel Tab Components
 * 
 * Defines standard prop interfaces for all extracted tab components.
 * Follows a hierarchical pattern where tabs can extend base interfaces
 * based on their specific needs (state management, sheet access, etc.).
 * 
 * @module components/deepdive/v3/tabs/types
 */

import type { DeliberationState, DeliberationStateActions } from "../hooks/useDeliberationState";
import type { SheetState, SheetActions } from "../hooks/useSheetPersistence";

/**
 * Common props for all deliberation panel tabs
 * 
 * Every tab component should accept at minimum these props.
 */
export interface BaseTabProps {
  /** The deliberation ID being viewed */
  deliberationId: string;
  
  /** Current user ID (from auth context) */
  currentUserId?: string;
  
  /** Optional class name for styling */
  className?: string;
}

/**
 * Extended props for tabs needing state management
 * 
 * Use this interface for tabs that need access to deliberation state
 * (tab navigation, configuration, UI state, etc.)
 * 
 * @example
 * ```tsx
 * export function DialogueTab({ 
 *   deliberationId, 
 *   delibState, 
 *   delibActions 
 * }: StatefulTabProps) {
 *   // Access state: delibState.highlightedDialogueMoveId
 *   // Update state: delibActions.setHighlightedDialogueMoveId(id)
 * }
 * ```
 */
export interface StatefulTabProps extends BaseTabProps {
  /** Deliberation state (from useDeliberationState) */
  delibState: DeliberationState;
  
  /** Deliberation actions (from useDeliberationState) */
  delibActions: DeliberationStateActions;
}

/**
 * Extended props for tabs needing sheet control
 * 
 * Use this interface for tabs that need to open/close floating sheets
 * (left sheet for graph explorer, right sheet for actions, etc.)
 * 
 * @example
 * ```tsx
 * export function DebateTab({ 
 *   sheets, 
 *   sheetActions 
 * }: SheetAwareTabProps) {
 *   // Open left sheet with claim
 *   const handleClaimClick = (claimId: string) => {
 *     sheetActions.setLeft(claimId);
 *     if (!sheets.left) sheetActions.toggleLeft();
 *   };
 * }
 * ```
 */
export interface SheetAwareTabProps extends StatefulTabProps {
  /** Sheet state (from useSheetPersistence) */
  sheets: SheetState;
  
  /** Sheet actions (from useSheetPersistence) */
  sheetActions: SheetActions;
}

/**
 * Props for tabs with refresh capability
 * 
 * Use this interface for tabs that can trigger data refresh
 * (typically tabs with forms or actions that modify data)
 * 
 * @example
 * ```tsx
 * export function DebateTab({ 
 *   onRefresh, 
 *   refreshCounter 
 * }: RefreshableTabProps) {
 *   const handleSubmit = async () => {
 *     await postArgument(data);
 *     onRefresh?.(); // Trigger refresh
 *   };
 * }
 * ```
 */
export interface RefreshableTabProps extends BaseTabProps {
  /** Trigger refresh of tab content */
  onRefresh?: () => void;
  
  /** Current refresh counter (increments on refresh) */
  refreshCounter?: number;
}

/**
 * Combined props for tabs needing full control
 * 
 * Most complex tabs (like DebateTab) will use this interface as it
 * combines state management, sheet access, and refresh capability.
 * 
 * @example
 * ```tsx
 * interface DebateTabProps extends SheetAwareTabProps, RefreshableTabProps {
 *   // Tab-specific additional props if needed
 * }
 * ```
 */
export type FullTabProps = SheetAwareTabProps & RefreshableTabProps;

/**
 * Utility type for extracting tab-specific additional props
 * 
 * Use this when you need to define additional props beyond the base interfaces.
 * 
 * @example
 * ```tsx
 * interface AnalyticsTabProps extends BaseTabProps, AdditionalTabProps {
 *   showAdvancedMetrics?: boolean;
 * }
 * 
 * type AdditionalTabProps = {
 *   showAdvancedMetrics?: boolean;
 * };
 * ```
 */
export type AdditionalTabProps<T = Record<string, unknown>> = T;
