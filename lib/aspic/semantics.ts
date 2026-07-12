/**
 * ASPIC+ Semantics and Extension Computation
 * 
 * Implements grounded semantics for abstract argumentation frameworks.
 * Computes which arguments are justified (IN), defeated (OUT), or undecided (UNDECIDED).
 * 
 * Based on:
 * - Dung (1995) "On the acceptability of arguments and its fundamental role in nonmonotonic reasoning"
 * - Modgil & Prakken (2013) "A general account of argumentation with preferences"
 * - Caminada & Amgoud (2007) "On the evaluation of argumentation formalisms"
 */

import type {
  Argument,
  Defeat,
  JustificationStatus,
  ArgumentationTheory,
} from "./types";
import { instantiateDefeatGraph } from "@/lib/argumentation/instantiate";
import { groundedLabellingDetailed } from "@/lib/argumentation/labelling";

// ============================================================================
// GROUNDED EXTENSION
// ============================================================================

/**
 * Result of grounded semantics computation
 */
export interface GroundedExtension {
  /** Arguments in the grounded extension (justified/accepted) */
  inArguments: Set<string>;

  /** Arguments defeated by the grounded extension */
  outArguments: Set<string>;

  /** Arguments with undecided status */
  undecidedArguments: Set<string>;

  /** Mapping from argument ID to justification status */
  status: Map<string, JustificationStatus>;

  /** Number of iterations required to reach fixpoint */
  iterations: number;
}

/**
 * Compute the grounded extension using Dung's characteristic function
 * 
 * The grounded extension is the least fixed point of the characteristic function F,
 * computed iteratively:
 * 
 * F(S) = {A ∈ Args | all defeaters of A are defeated by S}
 * 
 * Algorithm:
 * 1. Start with E₀ = ∅
 * 2. Eᵢ₊₁ = F(Eᵢ) = {A | all defeaters of A are in OUT(Eᵢ)}
 * 3. Continue until Eᵢ₊₁ = Eᵢ (fixpoint reached)
 * 
 * Complexity: O(n²) where n = |Args|
 * Iterations: ≤ |Args|/2 + 1 in practice
 *
 * As of Phase 2 of the argumentation-semantics consolidation, this delegates to
 * the shared labelling core (`@/lib/argumentation`) via the ASPIC+
 * instantiation contract (`instantiateDefeatGraph`) instead of running its own
 * fixpoint loop. The structured (ASPIC+) and abstract (Dung) layers now share
 * one engine of record; the `GroundedExtension` shape below is preserved for
 * existing callers.
 * 
 * @param args All arguments in the framework
 * @param defeats All defeat relations
 * @returns Grounded extension with IN/OUT/UNDECIDED status for all arguments
 */
export function computeGroundedExtension(
  args: Argument[],
  defeats: Defeat[]
): GroundedExtension {
  // Instantiate the shared Dung defeat graph from the ASPIC+ defeat relation.
  const dg = instantiateDefeatGraph(args, defeats);
  const { labelling, rounds } = groundedLabellingDetailed(dg);

  const inSet = new Set<string>();
  const outSet = new Set<string>();
  const undecidedSet = new Set<string>();
  for (const arg of args) {
    const label = labelling.get(arg.id);
    if (label === "IN") inSet.add(arg.id);
    else if (label === "OUT") outSet.add(arg.id);
    else undecidedSet.add(arg.id);
  }

  // Build status map (ASPIC+ JustificationStatus vocabulary).
  const statusMap = new Map<string, JustificationStatus>();
  for (const id of inSet) {
    statusMap.set(id, "defended");
  }
  for (const id of outSet) {
    statusMap.set(id, "out");
  }
  for (const id of undecidedSet) {
    statusMap.set(id, "blocked");
  }

  return {
    inArguments: inSet,
    outArguments: outSet,
    undecidedArguments: undecidedSet,
    status: statusMap,
    iterations: rounds,
  };
}

/**
 * Characteristic function F(S)
 * 
 * Returns all arguments whose defeaters are all in OUT(S).
 * An argument is acceptable w.r.t. S if S defends it against all attacks.
 * 
 * F(S) = {A ∈ Args | ∀B: B defeats A → B ∈ OUT(S)}
 *
 * NOTE (Phase 2): the grounded fixpoint that used to drive
 * `computeGroundedExtension` now lives in the shared labelling core
 * (`@/lib/argumentation`). `buildDefeatersMap` below is retained because it is
 * still consumed by the labelling/diagnostic helpers later in this module.
 */

/**
 * Build mapping from argument ID to set of defeater IDs
 * 
 * @param args All arguments
 * @param defeats All defeat relations
 * @returns Map from argument ID to set of arguments that defeat it
 */
function buildDefeatersMap(
  args: Argument[],
  defeats: Defeat[]
): Map<string, Set<string>> {
  const defeatersMap = new Map<string, Set<string>>();

  // Initialize with empty sets
  for (const arg of args) {
    defeatersMap.set(arg.id, new Set());
  }

  // Populate defeaters
  for (const defeat of defeats) {
    const defeaters = defeatersMap.get(defeat.defeated.id);
    if (defeaters) {
      defeaters.add(defeat.defeater.id);
    }
  }

  return defeatersMap;
}

// ============================================================================
// LABELING COMPUTATION
// ============================================================================

/**
 * Argument labeling for grounded semantics
 */
export interface ArgumentLabeling {
  /** Arguments labeled IN */
  in: Set<string>;

  /** Arguments labeled OUT */
  out: Set<string>;

  /** Arguments labeled UNDECIDED */
  undecided: Set<string>;
}

/**
 * Compute argument labeling using iterative algorithm
 * 
 * Alternative formulation of grounded semantics using labels.
 * More efficient for certain use cases (e.g., visualization).
 * 
 * Algorithm:
 * 1. Label arguments with no defeaters as IN
 * 2. Label arguments defeated by IN as OUT
 * 3. Label arguments with undecided defeaters as UNDECIDED
 * 4. Repeat until no changes
 * 
 * @param args All arguments
 * @param defeats All defeat relations
 * @returns Argument labeling (IN/OUT/UNDECIDED)
 */
export function computeArgumentLabeling(
  args: Argument[],
  defeats: Defeat[]
): ArgumentLabeling {
  const labels = new Map<string, JustificationStatus>();
  const defeatersMap = buildDefeatersMap(args, defeats);

  // Initialize all as UNDECIDED
  for (const arg of args) {
    labels.set(arg.id, "blocked");
  }

  let changed = true;
  let maxIterations = args.length * 2;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const arg of args) {
      const currentLabel = labels.get(arg.id);
      const defeaters = defeatersMap.get(arg.id) || new Set();

      // Rule 1: No defeaters → IN
      if (defeaters.size === 0) {
        if (currentLabel !== "defended") {
          labels.set(arg.id, "defended");
          changed = true;
        }
        continue;
      }

      // Rule 2: All defeaters OUT → IN
      const allDefeatersOut = Array.from(defeaters).every(
        (defId) => labels.get(defId) === "out"
      );
      if (allDefeatersOut) {
        if (currentLabel !== "defended") {
          labels.set(arg.id, "defended");
          changed = true;
        }
        continue;
      }

      // Rule 3: At least one defeater IN → OUT
      const someDefeaterIn = Array.from(defeaters).some(
        (defId) => labels.get(defId) === "defended"
      );
      if (someDefeaterIn) {
        if (currentLabel !== "out") {
          labels.set(arg.id, "out");
          changed = true;
        }
        continue;
      }

      // Otherwise: UNDECIDED (has defeaters but none are IN, not all are OUT)
    }
  }

  // Partition by label
  const inSet = new Set<string>();
  const outSet = new Set<string>();
  const undecidedSet = new Set<string>();

  for (const [id, label] of labels.entries()) {
    if (label === "defended") inSet.add(id);
    else if (label === "out") outSet.add(id);
    else undecidedSet.add(id);
  }

  return {
    in: inSet,
    out: outSet,
    undecided: undecidedSet,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Evaluate justification status for a specific argument
 * 
 * @param argId Argument ID to evaluate
 * @param extension Grounded extension
 * @returns Justification status (defended/out/blocked)
 */
export function getJustificationStatus(
  argId: string,
  extension: GroundedExtension
): JustificationStatus {
  return extension.status.get(argId) || "blocked";
}

/**
 * Check if an argument is justified (IN the grounded extension)
 * 
 * @param argId Argument ID
 * @param extension Grounded extension
 * @returns true if argument is justified
 */
export function isJustified(
  argId: string,
  extension: GroundedExtension
): boolean {
  return extension.inArguments.has(argId);
}

/**
 * Check if an argument is defeated (OUT of the grounded extension)
 * 
 * @param argId Argument ID
 * @param extension Grounded extension
 * @returns true if argument is defeated
 */
export function isDefeated(
  argId: string,
  extension: GroundedExtension
): boolean {
  return extension.outArguments.has(argId);
}

/**
 * Get all arguments with a specific justification status
 * 
 * @param args All arguments
 * @param extension Grounded extension
 * @param status Desired justification status
 * @returns Arguments with the specified status
 */
export function getArgumentsByStatus(
  args: Argument[],
  extension: GroundedExtension,
  status: JustificationStatus
): Argument[] {
  return args.filter((arg) => getJustificationStatus(arg.id, extension) === status);
}

/**
 * Generate a summary of the grounded extension
 * 
 * @param args All arguments
 * @param extension Grounded extension
 * @returns Human-readable summary
 */
export function summarizeExtension(
  args: Argument[],
  extension: GroundedExtension
): string {
  const lines: string[] = [];

  lines.push(`Grounded Extension Summary:`);
  lines.push(`  Total arguments: ${args.length}`);
  lines.push(`  IN (justified): ${extension.inArguments.size}`);
  lines.push(`  OUT (defeated): ${extension.outArguments.size}`);
  lines.push(`  UNDECIDED: ${extension.undecidedArguments.size}`);
  lines.push(`  Iterations: ${extension.iterations}`);

  if (extension.inArguments.size > 0) {
    lines.push(`\nJustified arguments:`);
    for (const id of extension.inArguments) {
      const arg = args.find((a) => a.id === id);
      if (arg) {
        lines.push(`  - ${arg.conclusion} (${id})`);
      }
    }
  }

  if (extension.outArguments.size > 0) {
    lines.push(`\nDefeated arguments:`);
    for (const id of extension.outArguments) {
      const arg = args.find((a) => a.id === id);
      if (arg) {
        lines.push(`  - ${arg.conclusion} (${id})`);
      }
    }
  }

  if (extension.undecidedArguments.size > 0) {
    lines.push(`\nUndecided arguments:`);
    for (const id of extension.undecidedArguments) {
      const arg = args.find((a) => a.id === id);
      if (arg) {
        lines.push(`  - ${arg.conclusion} (${id})`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Check if the grounded extension is complete
 * 
 * A complete extension has no UNDECIDED arguments.
 * This happens when the argumentation framework has no odd cycles.
 * 
 * @param extension Grounded extension
 * @returns true if no arguments are UNDECIDED
 */
export function isCompleteExtension(extension: GroundedExtension): boolean {
  return extension.undecidedArguments.size === 0;
}

/**
 * Compute defeat graph statistics
 * 
 * @param args All arguments
 * @param defeats All defeats
 * @returns Statistics about the defeat graph
 */
export function computeDefeatGraphStats(
  args: Argument[],
  defeats: Defeat[]
): {
  nodes: number;
  edges: number;
  maxInDegree: number;
  maxOutDegree: number;
  avgDegree: number;
  hasCycles: boolean;
} {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  // Initialize
  for (const arg of args) {
    inDegree.set(arg.id, 0);
    outDegree.set(arg.id, 0);
  }

  // Count degrees
  for (const defeat of defeats) {
    outDegree.set(defeat.defeater.id, (outDegree.get(defeat.defeater.id) || 0) + 1);
    inDegree.set(defeat.defeated.id, (inDegree.get(defeat.defeated.id) || 0) + 1);
  }

  const inDegrees = Array.from(inDegree.values());
  const outDegrees = Array.from(outDegree.values());

  const maxInDegree = Math.max(...inDegrees, 0);
  const maxOutDegree = Math.max(...outDegrees, 0);
  const avgDegree =
    args.length > 0
      ? (inDegrees.reduce((a, b) => a + b, 0) + outDegrees.reduce((a, b) => a + b, 0)) /
        (args.length * 2)
      : 0;

  // Cycle detection (simple check via SCC - approximate)
  const hasCycles = detectCycles(args, defeats);

  return {
    nodes: args.length,
    edges: defeats.length,
    maxInDegree,
    maxOutDegree,
    avgDegree,
    hasCycles,
  };
}

/**
 * Simple cycle detection using DFS
 * 
 * @param args All arguments
 * @param defeats All defeats
 * @returns true if graph contains cycles
 */
function detectCycles(args: Argument[], defeats: Defeat[]): boolean {
  // Build adjacency list
  const adjList = new Map<string, string[]>();
  for (const arg of args) {
    adjList.set(arg.id, []);
  }
  for (const defeat of defeats) {
    const neighbors = adjList.get(defeat.defeater.id);
    if (neighbors) {
      neighbors.push(defeat.defeated.id);
    }
  }

  // DFS with recursion stack
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true; // Back edge = cycle
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const arg of args) {
    if (!visited.has(arg.id)) {
      if (dfs(arg.id)) return true;
    }
  }

  return false;
}
