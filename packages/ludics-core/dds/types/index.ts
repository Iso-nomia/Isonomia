/**
 * DDS Phase 5 - Part 2: Type System Module Index
 * 
 * Based on Faggian & Hyland (2002) - §6.3-6.4
 * 
 * This module implements:
 * - Incarnation checking (lax and sharp)
 * - Type system (base, arrow, product, sum types)
 * - Type inference (structural, behavioural, and chronicle-based)
 * - Type checking (D : A judgment verification)
 * - Type equivalence
 * 
 * Phase 0 Addition: Theory-aligned types from:
 * - Girard "Locus Solum"
 * - Fouqueré & Quatrini "Study of Behaviours via Visitable Paths"
 */

// Types
export * from "./types";

// Theory-aligned types (Phase 0)
export * from "./ludics-theory";

// Incarnation operations
export {
  checkLaxIncarnation,
  checkSharpIncarnation,
  checkIncarnation,
  computeIncarnationClosure,
  findMostSpecificTarget,
  findLeastSpecificTarget,
  verifyIncarnationTransitivity,
} from "./incarnation";

// Type operations
export {
  createTypeFromBehaviour,
  createTypeFromDesigns,
  checkTyping,
  checkTypeEquivalence,
  createArrowType,
  createProductType,
  createSumType,
  createUnitType,
  createVoidType,
  getTypeInhabitants,
  getDesignTypes,
  isSubtype,
  isSupertype,
  typeLeastUpperBound,
  typeGreatestLowerBound,
} from "./operations";

// Type inference
export {
  inferTypeStructural,
  inferTypeBehavioural,
  inferDesignType,
  inferTypesForDesigns,
  suggestTypeRefinements,
  unifyTypes,
  // Chronicle-based inference (leverages Prop 4.27)
  analyzeChronicles,
  inferTypeFromChronicles,
  inferTypeFromDesignChronicles,
  computeChronicleConfidence,
  type ChronicleAnalysis,
} from "./inference";

// Type checking (D : A judgment)
export {
  checkDesignType,
  typeToString,
  type TypeCheckOptions,
} from "./typecheck";
