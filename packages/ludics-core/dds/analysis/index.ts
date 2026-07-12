/**
 * DDS Phase 5 - Part 3: Analysis Module Index
 * 
 * Based on Faggian & Hyland (2002)
 * 
 * This module implements:
 * - Saturation analysis (Proposition 4.17)
 * - Correspondence validation
 * - Property checking for designs, strategies, and games
 * - Complexity metrics
 * - Performance tracking
 */

// Types
export * from "./types";

// Saturation analysis
export {
  checkSaturation,
  computeSaturationClosure,
  checkViewStability,
  getSaturationDeficiency,
  haveSameSaturation,
} from "./saturation";

// Correspondence validation
export {
  validateFullCorrespondence,
  validateCorrespondenceLevel,
  validatePlaysViewsIsomorphism,
  validateDispChIsomorphism,
} from "./correspondence";

// Property checking
export {
  analyzeDesignProperties,
  analyzeStrategyProperties,
  analyzeGameProperties,
  analyzeComplexity,
  batchAnalyzeDesigns,
  summarizeProperties,
} from "./properties";

// Performance tracking
export {
  trackPerformance,
  trackPerformanceSync,
  getAllMetrics,
  getMetricsForOperation,
  getPerformanceStats,
  getAllPerformanceStats,
  analyzeBottlenecks,
  clearMetrics,
  getRecentMetrics,
  getMetricsInWindow,
  tracked,
  generatePerformanceReport,
  exportMetricsToJSON,
  importMetricsFromJSON,
} from "./performance";
