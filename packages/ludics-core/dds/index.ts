/**
 * DDS Module Index
 * Phase 1: Core Abstractions (Views, Chronicles, Legal Positions)
 * Phase 2: Strategy Layer (Strategies, Innocence, Propagation)
 * Phase 3: Correspondences & Isomorphisms
 * Phase 5: Advanced Features (Behaviours, Types, Analysis)
 * 
 * Based on "Designs, disputes and strategies" by Faggian & Hyland (2002)
 * 
 * Phase 0 Addition: Theory-aligned types and adapters for deliberation integration
 * Based on Girard, Fouqueré & Quatrini theoretical foundations
 */

// Core types
export * from "./types";

// Phase 0: Theory-aligned types and adapters
export * as LudicsTheory from "./types/ludics-theory";
export * as Adapters from "./adapters";

// View extraction
export {
  extractView,
  extractProponentView,
  extractOpponentView,
  createView,
  viewsEqual,
  isViewPrefix,
  getViewTip,
  viewToKey,
  isInitial,
  findJustifier,
} from "./views";

// Chronicle extraction
export {
  extractChronicles,
  extractAllChronicles,
  disputeToPosition,
  isPositiveChronicle,
  isNegativeChronicle,
  chronicleDepth,
  chronicleTipLocus,
  isChroniclePrefix,
  getPositiveChronicles,
  getNegativeChronicles,
  groupChroniclesByLocus,
} from "./chronicles";

// Legality validation
export {
  validateLegality,
  isLegal,
  createPosition,
  extendPosition,
  getValidNextAddresses,
} from "./legality";

// Phase 2: Strategy Layer
// Explicitly re-export the names that also appear in "./types" so the
// Phase 2 (richer) definitions win and the `export *` ambiguity is resolved.
export type {
  Strategy,
  Play,
  InnocenceCheck,
  PropagationCheck,
  ViewsResult,
  PlaysResult,
} from "./strategy";
export * from "./strategy";

// Phase 3: Correspondences & Isomorphisms
export * from "./correspondence";

// Phase 5: Advanced Features

// Behaviours - Orthogonality & Biorthogonal Closure
export * from "./behaviours";

// Types - Incarnation & Type System
// Export as namespace to avoid conflict with core types.ts
export * as LudicsTypes from "./types/index";

// Analysis - Saturation, Validation & Performance
export * from "./analysis";

// Arena - Universal Arena, Positions, Games
export * as Arena from "./arena";

// Game - Game Construction, Play, AI, Simulation
export * as Game from "./game";

// Interaction - Stepper, Outcome, Play, Strategy (Phase 2)
export * as Interaction from "./interaction";

// Extraction - Path Extraction, Incarnation, Completion, Narrative (Phase 3)
export * as Extraction from "./extraction";

// Landscape - Behaviour Computation, Position Analysis, Visualization (Phase 4)
export * as Landscape from "./landscape";
