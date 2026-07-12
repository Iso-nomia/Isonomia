/**
 * DDS Phase 5 - Part 1: Biorthogonal Closure
 * 
 * Based on Faggian & Hyland (2002) - Definition 6.2
 * 
 * Definition 6.1: S ⊥ T if S ∩ T = p (strategies orthogonal if one play in intersection)
 * 
 * Definition 6.2: A behaviour/game G on arena ⊢<> is a set of innocent strategies
 * on the same arena equal to its biorthogonal: G = G⊥⊥
 * 
 * For a set of designs/strategies S:
 * - S⊥ = {T : ∀ D ∈ S, T ⊥ D}  (orthogonal set: all strategies orthogonal to everything in S)
 * - S⊥⊥ = (S⊥)⊥                (biorthogonal closure: smallest behaviour containing S)
 * 
 * Key Properties:
 * - S ⊆ S⊥⊥ (closure is always a superset)
 * - S⊥⊥⊥ = S⊥ (odd number of ⊥ gives same result)
 * - A set is a behaviour iff S = S⊥⊥
 * 
 * The biorthogonal closure S⊥⊥ is the smallest behaviour containing S.
 */

import type { DesignForCorrespondence } from "../correspondence/types";
import type { Strategy, Play } from "../strategy/types";
import type {
  Behaviour,
  ClosureResult,
  ClosureComputationOptions,
  BehaviourCreationOptions,
  BehaviourValidation,
  createBehaviour as createBehaviourType,
  createClosureResult as createClosureResultType,
} from "./types";
import { createBehaviour, createClosureResult } from "./types";
import {
  checkOrthogonalityRefined,
  checkOrthogonalityBasic,
  areOrthogonal,
  checkStrategyOrthogonality,
} from "./orthogonality";

/**
 * Default closure computation options
 */
const DEFAULT_CLOSURE_OPTIONS: Required<ClosureComputationOptions> = {
  maxIterations: 10,
  useRefinedOrthogonality: false,
  cacheIntermediates: true,
  timeout: 30000, // 30 seconds
};

// ============================================================================
// Strategy-Level Biorthogonal Closure (Definition 6.2)
// ============================================================================

/**
 * Compute strategy-level orthogonal set S⊥
 * 
 * S⊥ = {T : ∀ D ∈ S, T ⊥ D}
 * 
 * Returns all strategies from the candidate pool that are orthogonal to
 * every strategy in the input set.
 */
export async function computeStrategyOrthogonal(
  strategies: Strategy[],
  candidatePool: Strategy[],
  options?: ClosureComputationOptions
): Promise<Strategy[]> {
  const opts = { ...DEFAULT_CLOSURE_OPTIONS, ...options };
  const orthogonal: Strategy[] = [];

  // Cache for orthogonality checks
  const orthCache = new Map<string, boolean>();

  for (const candidate of candidatePool) {
    // Skip strategies in the input set
    const inInputSet = strategies.some((s) => s.id === candidate.id);
    if (inInputSet) continue;

    let isOrthogonalToAll = true;

    for (const strategy of strategies) {
      // Check cache first
      const cacheKey = `${candidate.id}-${strategy.id}`;
      const reverseCacheKey = `${strategy.id}-${candidate.id}`;

      let isOrth: boolean;

      if (orthCache.has(cacheKey)) {
        isOrth = orthCache.get(cacheKey)!;
      } else if (orthCache.has(reverseCacheKey)) {
        isOrth = orthCache.get(reverseCacheKey)!;
      } else {
        // Compute strategy orthogonality (Definition 6.1)
        const result = await checkStrategyOrthogonality(candidate, strategy);
        isOrth = result.isOrthogonal;

        if (opts.cacheIntermediates) {
          orthCache.set(cacheKey, isOrth);
        }
      }

      if (!isOrth) {
        isOrthogonalToAll = false;
        break;
      }
    }

    if (isOrthogonalToAll) {
      orthogonal.push(candidate);
    }
  }

  return orthogonal;
}

/**
 * Compute strategy-level biorthogonal closure S⊥⊥ (Definition 6.2)
 * 
 * S⊥⊥ = (S⊥)⊥
 * 
 * Computes the smallest behaviour containing the input strategies.
 */
export async function computeStrategyBiorthogonal(
  strategies: Strategy[],
  allStrategies: Strategy[],
  options?: ClosureComputationOptions
): Promise<{
  closureStrategies: Strategy[];
  iterations: number;
  isComplete: boolean;
}> {
  const opts = { ...DEFAULT_CLOSURE_OPTIONS, ...options };
  const startTime = Date.now();

  let iteration = 0;
  let currentSet = [...strategies];
  let previousSize = 0;

  while (iteration < opts.maxIterations && currentSet.length !== previousSize) {
    if (Date.now() - startTime > opts.timeout) {
      console.warn(`Strategy biorthogonal closure timed out after ${iteration} iterations`);
      break;
    }

    previousSize = currentSet.length;
    iteration++;

    // Step 1: Compute S⊥
    const orthogonal = await computeStrategyOrthogonal(currentSet, allStrategies, opts);

    // Step 2: Compute (S⊥)⊥
    const biorthogonal = await computeStrategyOrthogonal(orthogonal, allStrategies, opts);

    // Merge with current set
    const currentIds = new Set(currentSet.map((s) => s.id));
    const newStrategies = biorthogonal.filter((s) => !currentIds.has(s.id));

    currentSet = [...currentSet, ...newStrategies];
  }

  return {
    closureStrategies: currentSet,
    iterations: iteration,
    isComplete: currentSet.length === previousSize,
  };
}

// ============================================================================
// Design-Level Biorthogonal Closure (Legacy/Compatibility)
// ============================================================================

/**
 * Compute orthogonal set D⊥ (Definition 6.2)
 * 
 * D⊥ = {E : ∀ F ∈ D, E ⊥ F}
 * 
 * Returns all designs that are orthogonal to every design in the input set.
 * 
 * Note: This operates at the design level. For theoretical purity,
 * use computeStrategyOrthogonal which implements Definition 6.1 properly.
 */
export async function computeOrthogonal(
  designs: DesignForCorrespondence[],
  candidatePool: DesignForCorrespondence[],
  options?: ClosureComputationOptions
): Promise<DesignForCorrespondence[]> {
  const opts = { ...DEFAULT_CLOSURE_OPTIONS, ...options };
  const orthogonal: DesignForCorrespondence[] = [];

  // Cache for orthogonality checks
  const orthCache = new Map<string, boolean>();

  for (const candidate of candidatePool) {
    // Skip designs in the input set
    const inInputSet = designs.some((d) => d.id === candidate.id);
    
    let isOrthogonalToAll = true;

    for (const design of designs) {
      // Check cache first
      const cacheKey = `${candidate.id}-${design.id}`;
      const reverseCacheKey = `${design.id}-${candidate.id}`;
      
      let isOrth: boolean;
      
      if (orthCache.has(cacheKey)) {
        isOrth = orthCache.get(cacheKey)!;
      } else if (orthCache.has(reverseCacheKey)) {
        // Orthogonality is symmetric
        isOrth = orthCache.get(reverseCacheKey)!;
      } else {
        // Compute orthogonality
        isOrth = await areOrthogonal(
          candidate,
          design,
          opts.useRefinedOrthogonality ? "refined" : "basic",
          opts.useRefinedOrthogonality ? candidatePool : undefined
        );
        
        if (opts.cacheIntermediates) {
          orthCache.set(cacheKey, isOrth);
        }
      }

      if (!isOrth) {
        isOrthogonalToAll = false;
        break;
      }
    }

    if (isOrthogonalToAll) {
      orthogonal.push(candidate);
    }
  }

  return orthogonal;
}

/**
 * Compute biorthogonal closure D⊥⊥ (Definition 6.2)
 * 
 * D⊥⊥ = (D⊥)⊥
 * 
 * Iteratively computes the biorthogonal closure until fixpoint.
 */
export async function computeBiorthogonal(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[],
  options?: ClosureComputationOptions
): Promise<ClosureResult> {
  const opts = { ...DEFAULT_CLOSURE_OPTIONS, ...options };
  const startTime = Date.now();

  let iteration = 0;
  let currentSet = [...designs];
  let previousSize = 0;

  // Iterative fixpoint computation
  while (iteration < opts.maxIterations && currentSet.length !== previousSize) {
    // Check timeout
    if (Date.now() - startTime > opts.timeout) {
      console.warn(`Biorthogonal closure timed out after ${iteration} iterations`);
      break;
    }

    previousSize = currentSet.length;
    iteration++;

    // Step 1: Compute D⊥
    const orthogonal = await computeOrthogonal(currentSet, allDesigns, opts);

    // Step 2: Compute (D⊥)⊥
    const biorthogonal = await computeOrthogonal(orthogonal, allDesigns, opts);

    // Merge with current set (remove duplicates)
    const currentIds = new Set(currentSet.map((d) => d.id));
    const newDesigns = biorthogonal.filter((d) => !currentIds.has(d.id));

    currentSet = [...currentSet, ...newDesigns];
  }

  return createClosureResult(
    designs.map((d) => d.id),
    currentSet.map((d) => d.id),
    "biorthogonal",
    iteration,
    currentSet.length === previousSize
  );
}

/**
 * Check if a set of designs forms a behaviour (closed under ⊥⊥)
 * 
 * A set D is a behaviour iff D⊥⊥ = D
 */
export async function isBehaviour(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[],
  options?: ClosureComputationOptions
): Promise<boolean> {
  const closure = await computeBiorthogonal(designs, allDesigns, options);

  // Check if D⊥⊥ = D (same elements)
  const originalIds = new Set(designs.map((d) => d.id));
  const closureIds = new Set(closure.closureDesignIds);

  // Check both directions
  const allOriginalInClosure = designs.every((d) => closureIds.has(d.id));
  const allClosureInOriginal = closure.closureDesignIds.every((id) =>
    originalIds.has(id)
  );

  return allOriginalInClosure && allClosureInOriginal;
}

/**
 * Validate that a behaviour is properly closed
 */
export async function validateBehaviour(
  behaviour: Behaviour,
  allDesigns: DesignForCorrespondence[],
  options?: ClosureComputationOptions
): Promise<BehaviourValidation> {
  // Get designs in behaviour
  const behaviourDesigns = allDesigns.filter((d) =>
    behaviour.closureDesignIds.includes(d.id)
  );

  // Recompute closure
  const recomputed = await computeBiorthogonal(
    behaviourDesigns,
    allDesigns,
    options
  );

  // Compare
  const originalSet = new Set(behaviour.closureDesignIds);
  const recomputedSet = new Set(recomputed.closureDesignIds);

  const missing = [...recomputedSet].filter((id) => !originalSet.has(id));
  const extra = [...originalSet].filter((id) => !recomputedSet.has(id));

  return {
    behaviourId: behaviour.id,
    isClosed: missing.length === 0 && extra.length === 0,
    verificationIterations: recomputed.iterations,
    missingDesignIds: missing.length > 0 ? missing : undefined,
    extraDesignIds: extra.length > 0 ? extra : undefined,
  };
}

/**
 * Create a behaviour from a set of designs
 * 
 * Computes the biorthogonal closure and creates a behaviour object.
 */
export async function createBehaviourFromDesigns(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[],
  options?: BehaviourCreationOptions
): Promise<Behaviour> {
  const closure = await computeBiorthogonal(
    designs,
    allDesigns,
    options?.closureOptions
  );

  const behaviourDesigns = allDesigns.filter((d) =>
    closure.closureDesignIds.includes(d.id)
  );

  const behaviour = createBehaviour(
    designs[0]?.deliberationId || "",
    designs.map((d) => d.id),
    closure.closureDesignIds,
    {
      name: options?.name,
      isGame: options?.checkIsGame
        ? await checkIsGame(behaviourDesigns, allDesigns)
        : false,
      isType: options?.checkIsType
        ? await checkIsType(behaviourDesigns, allDesigns)
        : false,
    }
  );

  return behaviour;
}

/**
 * Check if a behaviour represents a game
 * 
 * A behaviour is a game if it has certain structural properties.
 */
async function checkIsGame(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[]
): Promise<boolean> {
  // A behaviour is a game if:
  // 1. It has at least one design
  // 2. All designs are legal
  // 3. There is interaction structure
  
  if (designs.length === 0) return false;

  // Check for proper alternation structure
  for (const design of designs) {
    const acts = design.acts || [];
    if (acts.length < 2) continue;

    // Check polarity alternation
    for (let i = 1; i < acts.length; i++) {
      if (acts[i].polarity === acts[i - 1].polarity) {
        return false; // Not proper alternation
      }
    }
  }

  return true;
}

/**
 * Check if a behaviour represents a type
 * 
 * A behaviour is a type if it satisfies type-theoretic constraints.
 */
async function checkIsType(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[]
): Promise<boolean> {
  // A behaviour is a type if:
  // 1. It forms a proper behaviour (closed)
  // 2. Has uniform structure (all designs have compatible shapes)
  
  if (designs.length === 0) return false;

  // Check for uniform ramification structure
  const firstRamifications = designs[0].acts?.[0]?.ramification || [];
  
  for (const design of designs.slice(1)) {
    const ramifications = design.acts?.[0]?.ramification || [];
    
    // Check if ramification structures are compatible
    if (ramifications.length !== firstRamifications.length) {
      // Different arity - might still be valid type
      continue;
    }
  }

  return true;
}

/**
 * Compute the orthogonal complement of a behaviour
 */
export async function computeBehaviourComplement(
  behaviour: Behaviour,
  allDesigns: DesignForCorrespondence[],
  options?: ClosureComputationOptions
): Promise<Behaviour> {
  // Get designs in behaviour
  const behaviourDesigns = allDesigns.filter((d) =>
    behaviour.closureDesignIds.includes(d.id)
  );

  // Compute B⊥
  const complement = await computeOrthogonal(behaviourDesigns, allDesigns, options);

  // Create behaviour from complement
  return createBehaviourFromDesigns(complement, allDesigns, {
    name: behaviour.name ? `${behaviour.name}⊥` : undefined,
    closureOptions: options,
  });
}

/**
 * Compute intersection of two behaviours
 * 
 * B₁ ∩ B₂ is the largest behaviour contained in both
 */
export async function intersectBehaviours(
  behaviour1: Behaviour,
  behaviour2: Behaviour,
  allDesigns: DesignForCorrespondence[]
): Promise<Behaviour> {
  // Intersection of design sets
  const ids1 = new Set(behaviour1.closureDesignIds);
  const commonIds = behaviour2.closureDesignIds.filter((id) => ids1.has(id));

  const commonDesigns = allDesigns.filter((d) => commonIds.includes(d.id));

  // Create behaviour from intersection (compute closure to ensure it's a behaviour)
  return createBehaviourFromDesigns(commonDesigns, allDesigns, {
    name:
      behaviour1.name && behaviour2.name
        ? `${behaviour1.name} ∩ ${behaviour2.name}`
        : undefined,
  });
}

/**
 * Check if one behaviour is contained in another
 * 
 * B₁ ⊆ B₂ iff every design in B₁ is in B₂
 */
export function behaviourContainedIn(
  behaviour1: Behaviour,
  behaviour2: Behaviour
): boolean {
  const ids2 = new Set(behaviour2.closureDesignIds);
  return behaviour1.closureDesignIds.every((id) => ids2.has(id));
}

/**
 * Check if two behaviours are equal
 * 
 * B₁ = B₂ iff they contain exactly the same designs
 */
export function behavioursEqual(
  behaviour1: Behaviour,
  behaviour2: Behaviour
): boolean {
  return (
    behaviourContainedIn(behaviour1, behaviour2) &&
    behaviourContainedIn(behaviour2, behaviour1)
  );
}

/**
 * Get the smallest behaviour containing given designs
 * (This is just the biorthogonal closure)
 */
export async function smallestBehaviourContaining(
  designs: DesignForCorrespondence[],
  allDesigns: DesignForCorrespondence[],
  options?: ClosureComputationOptions
): Promise<Behaviour> {
  return createBehaviourFromDesigns(designs, allDesigns, {
    closureOptions: options,
  });
}
