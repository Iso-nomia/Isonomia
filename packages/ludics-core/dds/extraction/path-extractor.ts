/**
 * ============================================
 * PATH EXTRACTOR
 * ============================================
 * 
 * Extract visitable paths from interactions and behaviours.
 * 
 * Based on Fouqueré & Quatrini "Study of Behaviours via Visitable Paths":
 * A visitable path is a path in a design that may be traversed by 
 * interaction with a design of the orthogonal.
 * 
 * Key concepts:
 * - Visitable path = proof trace
 * - The set of visitable paths characterizes a behaviour
 * - Path extraction enables proof extraction (Curry-Howard correspondence)
 */

import type {
  InteractionResult,
  VisitablePath,
  DialogueAct,
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  Chronicle,
} from "../types/ludics-theory";

import {
  addressEquals,
  addressToKey,
  isDaimon,
  flipPolarity,
} from "../types/ludics-theory";

import { computeIncarnation } from "./incarnation";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Path validation result
 */
export interface PathValidation {
  /** Is the path valid? */
  valid: boolean;

  /** Validation errors */
  errors: PathValidationError[];

  /** Warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Path validation error
 */
export interface PathValidationError {
  /** Error type */
  type: "POLARITY_SEQUENCE" | "ADDRESS_SEQUENCE" | "INCOMPLETE" | "EMPTY" | "UNKNOWN";

  /** Error message */
  message: string;

  /** Index in path where error occurred */
  index?: number;
}

/**
 * Path comparison result
 */
export interface PathComparison {
  /** Are the paths equal? */
  equal: boolean;

  /** Do they share a common prefix? */
  hasCommonPrefix: boolean;

  /** Length of common prefix */
  commonPrefixLength: number;

  /** Points where paths diverge */
  divergencePoints: number[];

  /** Similarity score (0-1) */
  similarity: number;
}

/**
 * Merged path result
 */
export interface MergedPath {
  /** The merged path (common prefix) */
  commonPrefix: DialogueAct[];

  /** Branches after divergence */
  branches: DialogueAct[][];

  /** Total unique actions */
  uniqueActionCount: number;
}

/**
 * PathExtractor interface - main API for path extraction
 */
export interface PathExtractor {
  /**
   * Extract the visitable path from a completed interaction
   * This IS the proof trace
   */
  extractPath(interaction: InteractionResult): VisitablePath;

  /**
   * Compute all visitable paths for a behaviour
   * Used for landscape mapping
   */
  extractAllPaths(behaviour: LudicBehaviourTheory): VisitablePath[];

  /**
   * Extract paths from multiple interactions (batch)
   */
  extractPaths(interactions: InteractionResult[]): VisitablePath[];
}

// ============================================================================
// PATH EXTRACTION
// ============================================================================

/**
 * Extract the visitable path from a completed interaction
 * 
 * This is the core extraction function that converts an interaction
 * result into a visitable path (proof trace).
 * 
 * @param interaction The completed interaction result
 * @returns The extracted visitable path
 */
export function extractPath(interaction: InteractionResult): VisitablePath {
  const { trace, outcome, stuckPlayer } = interaction;

  // Compute incarnation (essential core)
  const incarnation = computeIncarnation(trace);

  // Determine winner
  let winner: "P" | "O" | null = null;
  if (stuckPlayer) {
    winner = stuckPlayer === "P" ? "O" : "P";
  }

  return {
    actions: [...trace],
    convergent: outcome === "convergent",
    winner,
    incarnation,
    id: interaction.id ? `path-${interaction.id}` : undefined,
  };
}

/**
 * Extract visitable paths from multiple interactions (batch)
 * 
 * @param interactions Array of interaction results
 * @returns Array of extracted paths
 */
export function extractPaths(interactions: InteractionResult[]): VisitablePath[] {
  return interactions.map(extractPath);
}

/**
 * Extract all visitable paths from a behaviour
 * 
 * This function enumerates all possible visitable paths for a behaviour,
 * which is useful for landscape mapping (Phase 4).
 * 
 * From the paper: The set of visitable paths characterizes a behaviour.
 * Two designs have the same visitable paths iff they are equivalent.
 * 
 * @param behaviour The behaviour to extract paths from
 * @returns All visitable paths in the behaviour
 */
export function extractAllPaths(behaviour: LudicBehaviourTheory): VisitablePath[] {
  const paths: VisitablePath[] = [];
  const seenPaths = new Set<string>();

  for (const design of behaviour.designs) {
    const designPaths = extractPathsFromDesign(design);
    
    for (const path of designPaths) {
      // Deduplicate by path signature
      const signature = getPathSignature(path);
      if (!seenPaths.has(signature)) {
        seenPaths.add(signature);
        paths.push(path);
      }
    }
  }

  return paths;
}

/**
 * Extract all possible paths from a single design
 * 
 * @param design The design to extract paths from
 * @returns All paths in the design
 */
export function extractPathsFromDesign(design: LudicDesignTheory): VisitablePath[] {
  const paths: VisitablePath[] = [];

  for (const chronicle of design.chronicles) {
    const path = chronicleToPath(chronicle);
    paths.push(path);
  }

  return paths;
}

/**
 * Convert a chronicle to a visitable path
 * 
 * @param chronicle The chronicle to convert
 * @returns The visitable path
 */
export function chronicleToPath(chronicle: Chronicle): VisitablePath {
  const actions = chronicle.actions;
  const lastAction = actions[actions.length - 1];
  
  // Check if ends in daimon
  const convergent = lastAction ? isDaimon(lastAction) : false;

  // Determine winner
  let winner: "P" | "O" | null = null;
  if (lastAction) {
    if (isDaimon(lastAction)) {
      // Daimon player loses
      winner = lastAction.polarity === "+" ? "O" : "P";
    } else if (chronicle.isComplete) {
      // Terminal position reached
      const nextPolarity = flipPolarity(lastAction.polarity);
      winner = nextPolarity === "+" ? "O" : "P";
    }
  }

  // Compute incarnation
  const incarnation = computeIncarnation(actions);

  return {
    actions: [...actions],
    convergent,
    winner,
    incarnation,
    id: chronicle.id ? `path-${chronicle.id}` : undefined,
  };
}

// ============================================================================
// PATH VALIDATION
// ============================================================================

/**
 * Validate a visitable path
 * 
 * Checks that the path satisfies the structural requirements
 * of ludics interaction:
 * 1. Alternating polarities
 * 2. Proper address sequences
 * 3. Non-empty (unless explicitly allowed)
 * 
 * @param path The path to validate
 * @returns Validation result
 */
export function validatePath(path: VisitablePath): PathValidation {
  const errors: PathValidationError[] = [];
  const warnings: string[] = [];

  // Check for empty path
  if (path.actions.length === 0) {
    errors.push({
      type: "EMPTY",
      message: "Path is empty",
    });
    return { valid: false, errors, warnings };
  }

  // Check polarity alternation
  for (let i = 1; i < path.actions.length; i++) {
    const prev = path.actions[i - 1];
    const curr = path.actions[i];

    if (prev.polarity === curr.polarity) {
      errors.push({
        type: "POLARITY_SEQUENCE",
        message: `Polarity should alternate but found ${prev.polarity} followed by ${curr.polarity}`,
        index: i,
      });
    }
  }

  // Check address sequence (each action should relate to previous)
  for (let i = 1; i < path.actions.length; i++) {
    const prev = path.actions[i - 1];
    const curr = path.actions[i];

    if (!isValidAddressSequence(prev, curr)) {
      warnings.push(
        `Action at index ${i} has address ${addressToKey(curr.focus)} which may not follow from previous action`
      );
    }
  }

  // Check incarnation validity
  if (path.incarnation.length > path.actions.length) {
    errors.push({
      type: "INCOMPLETE",
      message: "Incarnation cannot be longer than the full path",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if address sequence is valid (curr follows from prev)
 */
function isValidAddressSequence(prev: DialogueAct, curr: DialogueAct): boolean {
  // Current focus should be in previous ramification OR be a parent address
  const currFocus = curr.focus;
  const prevRamification = prev.ramification;

  // Check if current focus is in previous ramification
  for (const ramAddr of prevRamification) {
    if (addressEquals(ramAddr, currFocus)) {
      return true;
    }
    // Check if focus extends the ramification address
    if (isPrefix(ramAddr, currFocus)) {
      return true;
    }
  }

  // Check if going back to parent (valid in some dialogue patterns)
  if (isPrefix(currFocus, prev.focus)) {
    return true;
  }

  return false;
}

// ============================================================================
// PATH COMPARISON
// ============================================================================

/**
 * Compare two visitable paths
 * 
 * @param path1 First path
 * @param path2 Second path
 * @returns Comparison result
 */
export function comparePaths(path1: VisitablePath, path2: VisitablePath): PathComparison {
  const actions1 = path1.actions;
  const actions2 = path2.actions;

  // Find common prefix length
  let commonPrefixLength = 0;
  const minLength = Math.min(actions1.length, actions2.length);

  while (
    commonPrefixLength < minLength &&
    actionsEqual(actions1[commonPrefixLength], actions2[commonPrefixLength])
  ) {
    commonPrefixLength++;
  }

  // Check for equality
  const equal =
    actions1.length === actions2.length &&
    commonPrefixLength === actions1.length;

  // Find divergence points
  const divergencePoints: number[] = [];
  if (!equal) {
    for (let i = commonPrefixLength; i < Math.max(actions1.length, actions2.length); i++) {
      const a1 = actions1[i];
      const a2 = actions2[i];
      if (!a1 || !a2 || !actionsEqual(a1, a2)) {
        divergencePoints.push(i);
      }
    }
  }

  // Calculate similarity score
  const maxLength = Math.max(actions1.length, actions2.length);
  const similarity = maxLength > 0 ? commonPrefixLength / maxLength : 1;

  return {
    equal,
    hasCommonPrefix: commonPrefixLength > 0,
    commonPrefixLength,
    divergencePoints,
    similarity,
  };
}

/**
 * Check if two actions are equal
 */
function actionsEqual(a1: DialogueAct, a2: DialogueAct): boolean {
  return (
    a1.polarity === a2.polarity &&
    addressEquals(a1.focus, a2.focus) &&
    a1.type === a2.type &&
    a1.expression === a2.expression &&
    ramificationsEqual(a1.ramification, a2.ramification)
  );
}

/**
 * Check if two ramifications are equal
 */
function ramificationsEqual(r1: LudicAddress[], r2: LudicAddress[]): boolean {
  if (r1.length !== r2.length) return false;
  
  // Sort for comparison
  const sorted1 = [...r1].sort((a, b) => addressToKey(a).localeCompare(addressToKey(b)));
  const sorted2 = [...r2].sort((a, b) => addressToKey(a).localeCompare(addressToKey(b)));
  
  return sorted1.every((addr, i) => addressEquals(addr, sorted2[i]));
}

// ============================================================================
// PATH MERGING
// ============================================================================

/**
 * Merge multiple paths into a common structure
 * 
 * Useful for analyzing multiple interaction traces to find
 * common patterns and divergence points.
 * 
 * @param paths Paths to merge
 * @returns Merged path structure
 */
export function mergePaths(paths: VisitablePath[]): MergedPath {
  if (paths.length === 0) {
    return {
      commonPrefix: [],
      branches: [],
      uniqueActionCount: 0,
    };
  }

  if (paths.length === 1) {
    return {
      commonPrefix: [...paths[0].actions],
      branches: [],
      uniqueActionCount: paths[0].actions.length,
    };
  }

  // Find common prefix among all paths
  const commonPrefix: DialogueAct[] = [];
  let prefixIndex = 0;
  let allMatch = true;

  while (allMatch) {
    const firstAction = paths[0].actions[prefixIndex];
    if (!firstAction) break;

    allMatch = paths.every((path) => {
      const action = path.actions[prefixIndex];
      return action && actionsEqual(action, firstAction);
    });

    if (allMatch) {
      commonPrefix.push(firstAction);
      prefixIndex++;
    }
  }

  // Collect branches (divergent suffixes)
  const branches = paths.map((path) => path.actions.slice(prefixIndex));

  // Count unique actions
  const uniqueActions = new Set<string>();
  for (const path of paths) {
    for (const action of path.actions) {
      uniqueActions.add(getActionSignature(action));
    }
  }

  return {
    commonPrefix,
    branches: branches.filter((b) => b.length > 0),
    uniqueActionCount: uniqueActions.size,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a unique signature for a path (for deduplication)
 */
function getPathSignature(path: VisitablePath): string {
  return path.actions.map(getActionSignature).join("|");
}

/**
 * Get a unique signature for an action
 */
function getActionSignature(action: DialogueAct): string {
  return `${action.polarity}:${addressToKey(action.focus)}:${action.type}:${action.expression}`;
}

/**
 * Check if address a is a prefix of address b
 */
function isPrefix(a: LudicAddress, b: LudicAddress): boolean {
  if (a.length > b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get statistics about a path
 */
export function getPathStatistics(path: VisitablePath): {
  totalMoves: number;
  positiveMoves: number;
  negativeMoves: number;
  maxDepth: number;
  avgDepth: number;
  incarnationLength: number;
  compressionRatio: number;
} {
  const actions = path.actions;
  const positiveMoves = actions.filter((a) => a.polarity === "+").length;
  const negativeMoves = actions.filter((a) => a.polarity === "-").length;
  
  const depths = actions.map((a) => a.focus.length);
  const maxDepth = depths.length > 0 ? Math.max(...depths) : 0;
  const avgDepth = depths.length > 0 
    ? depths.reduce((a, b) => a + b, 0) / depths.length 
    : 0;

  const incarnationLength = path.incarnation.length;
  const compressionRatio = actions.length > 0 
    ? incarnationLength / actions.length 
    : 1;

  return {
    totalMoves: actions.length,
    positiveMoves,
    negativeMoves,
    maxDepth,
    avgDepth,
    incarnationLength,
    compressionRatio,
  };
}

/**
 * Get aggregated statistics for multiple paths
 */
export function getPathsStatistics(paths: VisitablePath[]): {
  pathCount: number;
  convergentCount: number;
  divergentCount: number;
  avgPathLength: number;
  avgIncarnationLength: number;
  avgCompressionRatio: number;
  pWins: number;
  oWins: number;
} {
  const stats = paths.map(getPathStatistics);

  const convergentCount = paths.filter((p) => p.convergent).length;
  const pWins = paths.filter((p) => p.winner === "P").length;
  const oWins = paths.filter((p) => p.winner === "O").length;

  const avgPathLength = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.totalMoves, 0) / stats.length
    : 0;
  
  const avgIncarnationLength = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.incarnationLength, 0) / stats.length
    : 0;

  const avgCompressionRatio = stats.length > 0
    ? stats.reduce((sum, s) => sum + s.compressionRatio, 0) / stats.length
    : 0;

  return {
    pathCount: paths.length,
    convergentCount,
    divergentCount: paths.length - convergentCount,
    avgPathLength,
    avgIncarnationLength,
    avgCompressionRatio,
    pWins,
    oWins,
  };
}
