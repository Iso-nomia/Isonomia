/**
 * Phase 4: UI Integration Types
 * Analysis state and configuration types for DDS UI components
 */

import type { View, Chronicle } from "@/packages/ludics-core/dds/types";
import type { InnocenceCheck, PropagationCheck } from "@/packages/ludics-core/dds/strategy/types";
import type { IsomorphismResults } from "@/packages/ludics-core/dds/correspondence/types";

/**
 * Analysis state for LudicsPanel integration
 */
export interface LudicsAnalysisState {
  // View/Chronicle Analysis
  selectedView: View | null;
  selectedChronicle: Chronicle | null;
  viewsExpanded: boolean;
  chroniclesExpanded: boolean;
  
  // Strategy Analysis
  strategyAnalysis: {
    innocenceCheck?: InnocenceCheck;
    propagationCheck?: PropagationCheck;
    inProgress: boolean;
  };
  
  // Correspondence Analysis
  correspondence: {
    strategyId?: string;
    verified: boolean;
    isomorphisms?: IsomorphismResults;
    disputes?: any[];
    chronicles?: Chronicle[];
    inProgress: boolean;
  };
  
  // Active analysis mode
  analysisMode: "design" | "strategy" | "correspondence" | null;
}

/**
 * Filter state for analysis filtering
 */
export interface AnalysisFilterState {
  showOnlyInnocent: boolean;
  showOnlyVerified: boolean;
  showOnlyWithDisputes: boolean;
}

/**
 * Forest analysis state for LudicsForest enhancements
 */
export interface ForestAnalysisState {
  // Batch analysis
  batchAnalysisInProgress: boolean;
  analyzedDesigns: Set<string>;
  
  // Quick filters
  filters: AnalysisFilterState;
  
  // Hover states
  hoveredDesignId: string | null;
  
  // Comparison mode
  comparisonMode: boolean;
  comparedDesigns: string[];
}

/**
 * Analysis section type for AnalysisPanel
 */
export type AnalysisSection = "overview" | "views" | "chronicles" | "strategy" | "correspondence" | "debugger";

/**
 * View debugger mode
 */
export type ViewDebugMode = "step" | "compare" | "trace";

/**
 * Chronicle navigator view mode
 */
export type ChronicleViewMode = "tree" | "list" | "graph";

/**
 * Tool type for AnalysisDashboard
 */
export type AnalysisTool = "view-debugger" | "dispute-trace" | "chronicle-nav" | null;

/**
 * Default analysis state factory
 */
export function createDefaultAnalysisState(): LudicsAnalysisState {
  return {
    selectedView: null,
    selectedChronicle: null,
    viewsExpanded: false,
    chroniclesExpanded: false,
    strategyAnalysis: {
      inProgress: false,
    },
    correspondence: {
      verified: false,
      inProgress: false,
    },
    analysisMode: null,
  };
}

/**
 * Default filter state factory
 */
export function createDefaultFilterState(): AnalysisFilterState {
  return {
    showOnlyInnocent: false,
    showOnlyVerified: false,
    showOnlyWithDisputes: false,
  };
}

/**
 * Default forest analysis state factory
 */
export function createDefaultForestAnalysisState(): ForestAnalysisState {
  return {
    batchAnalysisInProgress: false,
    analyzedDesigns: new Set(),
    filters: createDefaultFilterState(),
    hoveredDesignId: null,
    comparisonMode: false,
    comparedDesigns: [],
  };
}
