/**
 * Correspondence Module Index
 * 
 * Exports all correspondence-related functionality
 */

// Types
export type {
  Correspondence,
  IsomorphismResults,
  IsomorphismCheck,
  IsomorphismEvidence,
  DispResult,
  ChResult,
  TransformResult,
  DesignForCorrespondence,
  DesignAct,
  DesignLocus,
  VerificationContext,
  VerificationSummary,
} from "./types";

// Disp(D) operation
export {
  computeDisp,
  computeDispute,
  disputesToPlays,
  extractDesignPaths,
  canInteract,
} from "./disp";

// Ch(S) operation
export {
  computeCh,
  computeChOptimized,
  chroniclesToActs,
  getTerminalActions,
  groupChroniclesByTerminal,
  computeChronicleDepth,
  countUniqueLoci,
} from "./ch";

// Isomorphism checkers
export {
  checkPlaysViewsIsomorphism,
  checkViewsPlaysIsomorphism,
  checkDispChIsomorphism,
  checkChDispIsomorphism,
  checkAllIsomorphisms,
  allIsomorphismsHold,
} from "./isomorphisms";

// Bidirectional transformations
export {
  designToStrategy,
  strategyToDesign,
  roundTripDesign,
  roundTripStrategy,
  verifyCorrespondence,
  createCorrespondenceFromDesign,
  createCorrespondenceFromStrategy,
  getTransformationSummary,
  isValidTransformation,
} from "./transform";
