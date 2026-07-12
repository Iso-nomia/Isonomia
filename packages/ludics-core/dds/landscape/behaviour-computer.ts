/**
 * ============================================
 * BEHAVIOUR COMPUTER
 * ============================================
 * 
 * Compute behaviours via biorthogonal closure.
 * 
 * Based on Girard's ludics:
 * - A behaviour is a set G such that G = G⊥⊥ (biorthogonal closure)
 * - Two designs D and E are orthogonal (D ⊥ E) if they converge
 * - The orthogonal G⊥ = { D | D ⊥ E for all E ∈ G }
 * 
 * From Faggian & Hyland "Designs, disputes and strategies":
 * - Convergence = interaction terminates with daimon
 * - Divergence = interaction gets stuck without daimon
 * - Biorthogonal closure captures all "equivalent" strategies
 */

import type {
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  Chronicle,
  DialogueAct,
  Polarity,
} from "../types/ludics-theory";

import {
  addressEquals,
  addressToKey,
  keyToAddress,
  isAddressPrefix,
  flipPolarity,
  getParentAddress,
} from "../types/ludics-theory";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of behaviour computation
 */
export interface BehaviourComputationResult {
  /** The computed behaviour */
  behaviour: LudicBehaviourTheory;

  /** Orthogonal designs (G⊥) */
  orthogonal: LudicDesignTheory[];

  /** Is the behaviour complete (G = G⊥⊥)? */
  isComplete: boolean;

  /** Statistics about the closure process */
  closureStats: ClosureStatistics;
}

/**
 * Closure statistics
 */
export interface ClosureStatistics {
  /** Number of designs in original set */
  originalCount: number;

  /** Number of designs after closure */
  closedCount: number;

  /** Number of designs added during closure */
  addedDesigns: number;

  /** Number of iterations to reach fixed point */
  iterations: number;

  /** Time taken (ms) */
  computeTime: number;
}

/**
 * Convergence test result
 */
export interface ConvergenceResult {
  /** Do the designs converge? */
  converges: boolean;

  /** The interaction trace (if computed) */
  trace?: DialogueAct[];

  /** How the interaction terminated */
  termination: "daimon" | "stuck" | "max_depth" | "loop";

  /** Who played daimon or got stuck */
  terminatedBy?: "P" | "O";

  /** Depth of interaction */
  depth: number;
}

/**
 * Options for behaviour computation
 */
export interface BehaviourComputationOptions {
  /** Maximum iterations for closure */
  maxIterations?: number;

  /** Maximum designs to generate */
  maxDesigns?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Include verbose tracing */
  verbose?: boolean;
}

// ============================================================================
// CONVERGENCE CHECKING
// ============================================================================

/**
 * Check if two designs converge (D ⊥ E)
 *
 * Two designs converge if their interaction terminates with a daimon.
 * Divergence occurs when the interaction gets stuck (no legal move).
 *
 * ⚠️ APPROXIMATION ONLY — NOT THE CANONICAL ORTHOGONALITY PREDICATE.
 * This in-memory checker (predicate "A") is faithful to Ludics orthogonality
 * ONLY on the linear, daimon-terminated, additive-free fragment. The Phase-0
 * audit (`RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/02-foundational-bridge-dung-ludics-2026-06-02.md`
 * §0b) established it is NOT equivalent to the production predicate in general:
 * it follows only `ramification[0]` (a single linear path), its loop guard is
 * dead code (see below), it can short-circuit on the `hasDaimon` flag, and it
 * has no notion of additives / directory collisions / consensus draws.
 *
 * The canonical orthogonality relation (D0.1) is
 *   D ⊥ E  ⟺  stepInteraction(D, E).status === 'CONVERGENT'
 * — see `packages/ludics-engine/behaviourClosure.ts` and `checkOrthogonal.ts`.
 * Do NOT rest any bridge / behaviour-completeness result on this function.
 *
 * @param d1 First design (plays as P)
 * @param d2 Second design (plays as O)
 * @param maxDepth Maximum interaction depth
 * @returns Whether the designs converge
 * @deprecated For canonical orthogonality use `makeCanonicalOracle` /
 *   `biorthogonalClosureForDialogue` in `packages/ludics-engine/behaviourClosure.ts`.
 */
export function converges(
  d1: LudicDesignTheory,
  d2: LudicDesignTheory,
  maxDepth: number = 100
): boolean {
  const result = checkConvergence(d1, d2, maxDepth);
  return result.converges;
}

/**
 * Check convergence with detailed result
 * 
 * @param d1 First design (P perspective)
 * @param d2 Second design (O perspective)
 * @param maxDepth Maximum depth to explore
 * @returns Detailed convergence result
 */
export function checkConvergence(
  d1: LudicDesignTheory,
  d2: LudicDesignTheory,
  maxDepth: number = 100
): ConvergenceResult {
  const trace: DialogueAct[] = [];
  const visited = new Set<string>();
  let depth = 0;

  // P starts (or O if d1 is negative polarity)
  let activePolarity: Polarity = d1.polarity;
  let currentAddress: LudicAddress = d1.base[0] ?? [];

  // Build response maps for quick lookup
  const d1Responses = buildResponseMap(d1);
  const d2Responses = buildResponseMap(d2);

  while (depth < maxDepth) {
    // Get the active design's response map
    const activeMap = activePolarity === "+" ? d1Responses : d2Responses;
    const addrKey = addressToKey(currentAddress);

    // Check for loops
    // ⚠️ KNOWN-UNSOUND (D0.4): including `depth` in the key makes every state
    // distinct (depth strictly increases), so this guard never fires and the
    // `termination: "loop"` branch is effectively dead — real loops silently
    // fall through to `max_depth`. A faithful guard would key on
    // `${addrKey}:${activePolarity}` only; left as-is because this whole
    // function is approximation-only (see the `converges` banner) and changing
    // the guard alters its (already non-canonical) verdicts.
    const stateKey = `${addrKey}:${activePolarity}:${depth}`;
    if (visited.has(stateKey)) {
      return {
        converges: false,
        trace,
        termination: "loop",
        depth,
      };
    }
    visited.add(stateKey);

    // Find response for current address
    const response = findResponse(activeMap, currentAddress, activePolarity);

    if (!response) {
      // No response available - check if it's a daimon position
      const hasDaimonHere = checkDaimonAt(
        activePolarity === "+" ? d1 : d2,
        currentAddress
      );

      if (hasDaimonHere) {
        // Interaction converges via daimon
        return {
          converges: true,
          trace,
          termination: "daimon",
          terminatedBy: activePolarity === "+" ? "P" : "O",
          depth,
        };
      }

      // No move and no daimon - divergent (stuck)
      return {
        converges: false,
        trace,
        termination: "stuck",
        terminatedBy: activePolarity === "+" ? "P" : "O",
        depth,
      };
    }

    // Execute the response
    trace.push(response);

    // Check if response is daimon
    if (response.type === "daimon") {
      return {
        converges: true,
        trace,
        termination: "daimon",
        terminatedBy: activePolarity === "+" ? "P" : "O",
        depth: depth + 1,
      };
    }

    // Move to the first ramification address (or stay if no ramification)
    if (response.ramification.length > 0) {
      currentAddress = response.ramification[0];
    } else {
      // Terminal action with no ramification
      // If opponent has no response, they're stuck
      const opponentMap = activePolarity === "+" ? d2Responses : d1Responses;
      const oppResponse = findResponse(
        opponentMap,
        currentAddress,
        flipPolarity(activePolarity)
      );

      if (!oppResponse) {
        // Opponent stuck - check for daimon
        const oppDaimon = checkDaimonAt(
          activePolarity === "+" ? d2 : d1,
          currentAddress
        );
        
        if (oppDaimon) {
          return {
            converges: true,
            trace,
            termination: "daimon",
            terminatedBy: activePolarity === "+" ? "O" : "P",
            depth: depth + 1,
          };
        }

        return {
          converges: false,
          trace,
          termination: "stuck",
          terminatedBy: activePolarity === "+" ? "O" : "P",
          depth: depth + 1,
        };
      }
    }

    // Switch polarity
    activePolarity = flipPolarity(activePolarity);
    depth++;
  }

  return {
    converges: false,
    trace,
    termination: "max_depth",
    depth: maxDepth,
  };
}

/**
 * Build a response map from a design for quick lookup
 */
function buildResponseMap(
  design: LudicDesignTheory
): Map<string, DialogueAct[]> {
  const map = new Map<string, DialogueAct[]>();

  for (const chronicle of design.chronicles) {
    for (const action of chronicle.actions) {
      const key = addressToKey(action.focus);
      const existing = map.get(key) ?? [];
      existing.push(action);
      map.set(key, existing);
    }
  }

  return map;
}

/**
 * Find a response from the response map for a given address
 */
function findResponse(
  responseMap: Map<string, DialogueAct[]>,
  address: LudicAddress,
  polarity: Polarity
): DialogueAct | null {
  const key = addressToKey(address);
  const responses = responseMap.get(key);

  if (!responses || responses.length === 0) {
    return null;
  }

  // Find response with matching polarity
  return responses.find((r) => r.polarity === polarity) ?? null;
}

/**
 * Check if a design has a daimon at a specific address
 *
 * ⚠️ KNOWN-UNSOUND short-circuit (D0.4): this reports a daimon whenever the
 * design carries the `hasDaimon` flag AND has a daimon action at `address`,
 * independent of whether the strict alternating traversal would actually reach
 * it. The canonical predicate (`stepInteraction`) only converges when a DAIMON
 * act is the next positive act genuinely reached. This is one of the reasons
 * `converges` is approximation-only.
 */
function checkDaimonAt(
  design: LudicDesignTheory,
  address: LudicAddress
): boolean {
  if (!design.hasDaimon) return false;

  for (const chronicle of design.chronicles) {
    for (const action of chronicle.actions) {
      if (
        action.type === "daimon" &&
        addressEquals(action.focus, address)
      ) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// ORTHOGONAL COMPUTATION
// ============================================================================

/**
 * Compute the orthogonal of a set of designs: G⊥
 * 
 * G⊥ = { D | D ⊥ E for all E ∈ G }
 * 
 * The orthogonal is the set of all designs that converge with
 * every design in the input set.
 * 
 * ⚠️ APPROXIMATION ONLY — built on the non-canonical `converges` predicate
 * (see its banner). The canonical replacement is `orthogonalSet` /
 * `biorthogonalClosureForDialogue` in
 * `packages/ludics-engine/behaviourClosure.ts` (D0.3). Do not rest bridge
 * results on this.
 *
 * @param designs The set of designs G
 * @param candidatePool Optional pool of candidate designs to check
 * @returns The orthogonal G⊥
 * @deprecated Use the canonical closure in `packages/ludics-engine/behaviourClosure.ts`.
 */
export function computeOrthogonal(
  designs: LudicDesignTheory[],
  candidatePool?: LudicDesignTheory[]
): LudicDesignTheory[] {
  if (designs.length === 0) {
    return [];
  }

  // Generate candidates if not provided
  const candidates = candidatePool ?? generateCandidateDesigns(designs);
  const orthogonal: LudicDesignTheory[] = [];

  for (const candidate of candidates) {
    // Check if candidate converges with ALL designs in G
    let convergesWithAll = true;

    for (const design of designs) {
      // Candidate plays against design
      // If designs have same polarity, one needs to be "flipped" conceptually
      if (!converges(candidate, design)) {
        convergesWithAll = false;
        break;
      }
    }

    if (convergesWithAll) {
      orthogonal.push(candidate);
    }
  }

  return orthogonal;
}

/**
 * Compute the biorthogonal closure: G⊥⊥
 * 
 * The biorthogonal closure is the smallest behaviour containing G.
 * A set is a behaviour iff G = G⊥⊥.
 *
 * ⚠️ APPROXIMATION ONLY — NOT CANONICAL. This is the function the §1 bridge
 * conjecture is *about*, but it is built on the non-canonical `converges`
 * heuristic (predicate "A"). Per the Phase-0 audit (D0.3), no bridge or
 * behaviour-completeness result may rest on it as it stands. The canonical
 * replacement is `biorthogonalClosure` / `biorthogonalClosureForDialogue` in
 * `packages/ludics-engine/behaviourClosure.ts`, which is founded on
 * `stepInteraction` orthogonality (D0.1).
 *
 * @param designs The set of designs G
 * @param options Computation options
 * @returns The biorthogonal closure G⊥⊥
 * @deprecated Use `biorthogonalClosureForDialogue` in
 *   `packages/ludics-engine/behaviourClosure.ts`.
 */
export function computeBiorthogonalClosure(
  designs: LudicDesignTheory[],
  options?: BehaviourComputationOptions
): LudicDesignTheory[] {
  const maxIterations = options?.maxIterations ?? 10;
  
  if (designs.length === 0) {
    return [];
  }

  // First compute G⊥
  const orthogonal = computeOrthogonal(designs);
  
  // Then compute (G⊥)⊥ = G⊥⊥
  const biorthogonal = computeOrthogonal(orthogonal, designs);
  
  // Add any new designs from biorthogonal not in original
  const result = [...designs];
  const seen = new Set(designs.map((d) => d.id));

  for (const design of biorthogonal) {
    if (!seen.has(design.id)) {
      result.push(design);
      seen.add(design.id);
    }
  }

  return result;
}

// ============================================================================
// BEHAVIOUR COMPUTATION
// ============================================================================

/**
 * Compute a behaviour from a set of designs
 * 
 * Performs biorthogonal closure until G = G⊥⊥.
 * 
 * @param designs Initial set of designs
 * @param options Computation options
 * @returns The computed behaviour
 */
export function computeBehaviour(
  designs: LudicDesignTheory[],
  options?: BehaviourComputationOptions
): BehaviourComputationResult {
  const startTime = Date.now();
  const maxIterations = options?.maxIterations ?? 10;
  const timeout = options?.timeout ?? 30000;

  if (designs.length === 0) {
    const emptyBehaviour: LudicBehaviourTheory = {
      id: `behaviour-empty-${Date.now()}`,
      base: [],
      designs: [],
      polarity: "+",
      isComplete: true,
    };

    return {
      behaviour: emptyBehaviour,
      orthogonal: [],
      isComplete: true,
      closureStats: {
        originalCount: 0,
        closedCount: 0,
        addedDesigns: 0,
        iterations: 0,
        computeTime: Date.now() - startTime,
      },
    };
  }

  let current = [...designs];
  let iteration = 0;
  let previousCount = 0;

  // Iterate until fixed point or max iterations
  while (iteration < maxIterations) {
    if (Date.now() - startTime > timeout) {
      break;
    }

    const closed = computeBiorthogonalClosure(current, options);

    // Check if we've reached a fixed point
    if (closed.length === current.length) {
      // Same size - check if actually equal
      if (designSetsEqual(current, closed)) {
        break;
      }
    }

    current = closed;
    iteration++;

    // Safety check for growth
    if (current.length === previousCount) {
      break; // No change, we're done
    }
    previousCount = current.length;
  }

  // Compute final orthogonal
  const orthogonal = computeOrthogonal(current);

  // Check completeness: G = G⊥⊥
  const biorth = computeBiorthogonalClosure(current, options);
  const isComplete = designSetsEqual(current, biorth);

  // Get polarity from first design
  const polarity = designs[0]?.polarity ?? "+";

  // Get base from first design
  const base = designs[0]?.base ?? [];

  const behaviour: LudicBehaviourTheory = {
    id: `behaviour-${Date.now()}`,
    base,
    designs: current,
    polarity,
    isComplete,
    deliberationId: designs[0]?.deliberationId,
  };

  return {
    behaviour,
    orthogonal,
    isComplete,
    closureStats: {
      originalCount: designs.length,
      closedCount: current.length,
      addedDesigns: current.length - designs.length,
      iterations: iteration,
      computeTime: Date.now() - startTime,
    },
  };
}

// ============================================================================
// DESIGN SET OPERATIONS
// ============================================================================

/**
 * Check if two sets of designs are equal
 * 
 * @param s1 First set
 * @param s2 Second set
 * @returns True if sets contain the same designs
 */
export function designSetsEqual(
  s1: LudicDesignTheory[],
  s2: LudicDesignTheory[]
): boolean {
  if (s1.length !== s2.length) {
    return false;
  }

  const ids1 = new Set(s1.map((d) => d.id));
  const ids2 = new Set(s2.map((d) => d.id));

  if (ids1.size !== ids2.size) {
    return false;
  }

  for (const id of ids1) {
    if (!ids2.has(id)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two designs are structurally equivalent
 * 
 * Two designs are equivalent if they have the same chronicles
 * (same responses to all positions).
 */
export function designsEquivalent(
  d1: LudicDesignTheory,
  d2: LudicDesignTheory
): boolean {
  // Same ID means same design
  if (d1.id === d2.id) return true;

  // Check basic properties
  if (d1.polarity !== d2.polarity) return false;
  if (d1.hasDaimon !== d2.hasDaimon) return false;
  if (d1.base.length !== d2.base.length) return false;

  // Check base addresses
  for (let i = 0; i < d1.base.length; i++) {
    if (!addressEquals(d1.base[i], d2.base[i])) return false;
  }

  // Check chronicles
  if (d1.chronicles.length !== d2.chronicles.length) return false;

  // Build signature for each chronicle and compare
  const sigs1 = d1.chronicles.map(chronicleSignature).sort();
  const sigs2 = d2.chronicles.map(chronicleSignature).sort();

  for (let i = 0; i < sigs1.length; i++) {
    if (sigs1[i] !== sigs2[i]) return false;
  }

  return true;
}

/**
 * Compute a unique signature for a chronicle
 */
function chronicleSignature(chronicle: Chronicle): string {
  return chronicle.actions
    .map(
      (a) =>
        `${a.polarity}:${addressToKey(a.focus)}:${a.ramification.map(addressToKey).join(",")}`
    )
    .join("|");
}

// ============================================================================
// CANDIDATE GENERATION
// ============================================================================

/**
 * Generate candidate designs for orthogonal computation
 * 
 * This generates designs of the opposite polarity that could
 * potentially be in the orthogonal.
 * 
 * @param designs Source designs
 * @returns Generated candidate designs
 */
export function generateCandidateDesigns(
  designs: LudicDesignTheory[]
): LudicDesignTheory[] {
  if (designs.length === 0) return [];

  const candidates: LudicDesignTheory[] = [];
  const sourcePolarity = designs[0].polarity;
  const targetPolarity = flipPolarity(sourcePolarity);

  // Collect all addresses used in the source designs
  const addresses = new Set<string>();
  for (const design of designs) {
    for (const chronicle of design.chronicles) {
      for (const action of chronicle.actions) {
        addresses.add(addressToKey(action.focus));
        for (const ram of action.ramification) {
          addresses.add(addressToKey(ram));
        }
      }
    }
  }

  // Generate simple response designs
  // Strategy 1: Daimon at each position
  const daimonDesign = createDaimonDesign(
    [...addresses].map(keyToAddress),
    targetPolarity
  );
  candidates.push(daimonDesign);

  // Strategy 2: Mirror structures with opposite polarity
  for (const design of designs) {
    const mirrored = mirrorDesign(design);
    if (mirrored) {
      candidates.push(mirrored);
    }
  }

  // Strategy 3: Generate winning designs (no daimon)
  // This is complex - simplified version creates designs that
  // respond to all positions without using daimon
  const winningDesigns = generateWinningCandidates(designs);
  candidates.push(...winningDesigns);

  return candidates;
}

/**
 * Create a design that plays daimon at specified positions
 */
function createDaimonDesign(
  positions: LudicAddress[],
  polarity: Polarity
): LudicDesignTheory {
  const chronicles: Chronicle[] = positions.map((pos) => ({
    id: `chronicle-daimon-${addressToKey(pos)}`,
    actions: [
      {
        polarity,
        focus: pos,
        ramification: [],
        expression: "†",
        type: "daimon" as const,
      },
    ],
    isComplete: true,
  }));

  return {
    id: `design-daimon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    base: positions.length > 0 ? [positions[0]] : [[]],
    polarity,
    chronicles,
    hasDaimon: true,
    isWinning: false,
  };
}

/**
 * Mirror a design to opposite polarity
 */
function mirrorDesign(design: LudicDesignTheory): LudicDesignTheory | null {
  const mirroredChronicles: Chronicle[] = design.chronicles.map((chr) => ({
    id: `mirrored-${chr.id ?? "chronicle"}`,
    actions: chr.actions.map((action) => ({
      ...action,
      polarity: flipPolarity(action.polarity),
    })),
    isComplete: chr.isComplete,
  }));

  return {
    id: `mirrored-${design.id}`,
    base: design.base,
    polarity: flipPolarity(design.polarity),
    chronicles: mirroredChronicles,
    hasDaimon: design.hasDaimon,
    isWinning: !design.hasDaimon,
  };
}

/**
 * Generate winning candidate designs
 */
function generateWinningCandidates(
  designs: LudicDesignTheory[]
): LudicDesignTheory[] {
  // For each source design, generate candidates that might force it to play daimon
  const candidates: LudicDesignTheory[] = [];

  for (const design of designs) {
    if (design.hasDaimon) {
      // This design can give up - generate candidates that force that
      const forcingDesign = generateForcingDesign(design);
      if (forcingDesign) {
        candidates.push(forcingDesign);
      }
    }
  }

  return candidates;
}

/**
 * Generate a design that forces the opponent to play daimon
 */
function generateForcingDesign(
  opponent: LudicDesignTheory
): LudicDesignTheory | null {
  // Find positions where opponent plays daimon
  const daimonPositions: LudicAddress[] = [];

  for (const chronicle of opponent.chronicles) {
    for (const action of chronicle.actions) {
      if (action.type === "daimon") {
        daimonPositions.push(action.focus);
      }
    }
  }

  if (daimonPositions.length === 0) {
    return null;
  }

  // Create design that drives to daimon positions
  const polarity = flipPolarity(opponent.polarity);
  const chronicles: Chronicle[] = [];

  for (const pos of daimonPositions) {
    // Create chronicle leading to this position
    const actions: DialogueAct[] = [];

    // If position is not root, we need to create path to it
    if (pos.length > 0) {
      const parentAddr = getParentAddress(pos);
      actions.push({
        polarity,
        focus: parentAddr,
        ramification: [pos],
        expression: "forcing move",
        type: "claim",
      });
    }

    chronicles.push({
      id: `forcing-chronicle-${addressToKey(pos)}`,
      actions,
      isComplete: false, // Let opponent finish with daimon
    });
  }

  return {
    id: `forcing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    base: daimonPositions[0] ? [getParentAddress(daimonPositions[0])] : [[]],
    polarity,
    chronicles,
    hasDaimon: false,
    isWinning: true,
    name: "Forcing design",
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all unique addresses from a set of designs
 */
export function getAllAddresses(
  designs: LudicDesignTheory[]
): LudicAddress[] {
  const addressSet = new Set<string>();

  for (const design of designs) {
    for (const base of design.base) {
      addressSet.add(addressToKey(base));
    }

    for (const chronicle of design.chronicles) {
      for (const action of chronicle.actions) {
        addressSet.add(addressToKey(action.focus));
        for (const ram of action.ramification) {
          addressSet.add(addressToKey(ram));
        }
      }
    }
  }

  return [...addressSet].map(keyToAddress);
}

/**
 * Get the depth (maximum chronicle length) of designs
 */
export function getMaxDesignDepth(designs: LudicDesignTheory[]): number {
  let maxDepth = 0;

  for (const design of designs) {
    for (const chronicle of design.chronicles) {
      maxDepth = Math.max(maxDepth, chronicle.actions.length);
    }
  }

  return maxDepth;
}

/**
 * Count total actions across all designs
 */
export function getTotalActionCount(designs: LudicDesignTheory[]): number {
  let count = 0;

  for (const design of designs) {
    for (const chronicle of design.chronicles) {
      count += chronicle.actions.length;
    }
  }

  return count;
}
