/**
 * Barrel export for DeepDivePanel V3 Tabs
 * 
 * Provides centralized exports for all tab components and their type definitions.
 * Part of DeepDivePanel V3 migration - Week 4, Task 4.6
 * 
 * Usage:
 * ```tsx
 * import { AnalyticsTab, DebateTab, ArgumentsTab, type BaseTabProps } from './v3/tabs';
 * ```
 */

// Tab Components
export { AnalyticsTab } from "./AnalyticsTab";
export { DebateTab, type DebateTabProps } from "./DebateTab";
export { ArgumentsTab } from "./ArgumentsTab";
export { ThreadedDiscussionTab, type ThreadedDiscussionTabProps } from "./ThreadedDiscussionTab";
export { ChainsTab } from "./ChainsTab"; // Task 1.7: Chains tab

// Type Definitions
export type {
  BaseTabProps,
  StatefulTabProps,
  SheetAwareTabProps,
  RefreshableTabProps,
  FullTabProps,
  AdditionalTabProps,
} from "./types";
