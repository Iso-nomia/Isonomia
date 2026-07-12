/**
 * DDS Phase 5 - Part 1: Behaviours Types
 * 
 * Based on Faggian & Hyland (2002) - §6: Orthogonality and Behaviours
 * 
 * A behaviour is a set of designs closed under biorthogonality (D⊥⊥ = D).
 * Behaviours provide the semantic foundation for types in ludics.
 */

import type { Action, View, Chronicle, Dispute, Position } from "../types";
import type { Strategy, Play } from "../strategy/types";

// ============================================================================
// Core Behaviour Types
// ============================================================================

/**
 * Behaviour - Biorthogonal closure of designs (Definition 6.2)
 * A behaviour B is a set of designs such that B⊥⊥ = B
 */
export type Behaviour = {
  id: string;
  name?: string;
  deliberationId: string;
  /** IDs of base designs used to generate this behaviour */
  baseDesignIds: string[];
  /** IDs of all designs in the closure (D⊥⊥) */
  closureDesignIds: string[];
  /** Whether this behaviour represents a game */
  isGame: boolean;
  /** Whether this behaviour represents a type */
  isType: boolean;
  /** Dimension (cardinality) of the behaviour */
  dimension: number;
  /** Creation timestamp */
  createdAt?: Date;
};

/**
 * OrthogonalityResult - Result of checking D ⊥ E
 * Two designs are orthogonal if their interaction converges
 */
export type OrthogonalityResult = {
  design1Id: string;
  design2Id: string;
  /** Whether designs are orthogonal */
  isOrthogonal: boolean;
  /** Method used for checking */
  method: "basic" | "dispute-intersection";
  /** Type of convergence (if orthogonal) */
  convergenceType?: "positive" | "negative" | "divergent";
  /** Number of disputes analyzed */
  disputeCount?: number;
  /** Evidence/counterexample */
  evidence?: OrthogonalityEvidence;
};

/**
 * Evidence for orthogonality check
 */
export type OrthogonalityEvidence = {
  /** Disputes from design 1 */
  disputes1?: Dispute[];
  /** Disputes from design 2 */
  disputes2?: Dispute[];
  /** Intersection traces (if using dispute-intersection method) */
  intersectionTraces?: DisputeIntersection[];
  /** Counterexample if not orthogonal */
  counterexample?: {
    dispute1?: Dispute;
    dispute2?: Dispute;
    divergencePoint?: string;
  };
};

/**
 * Dispute intersection result
 */
export type DisputeIntersection = {
  dispute1Id: string;
  dispute2Id: string;
  converges: boolean;
  convergenceType?: "positive" | "negative" | "divergent";
  trace?: IntersectionTraceStep[];
};

/**
 * Single step in intersection trace
 */
export type IntersectionTraceStep = {
  step: number;
  action1?: Action;
  action2?: Action;
  compatible: boolean;
};

/**
 * ClosureResult - Result of computing D⊥ or D⊥⊥
 */
export type ClosureResult = {
  /** IDs of base designs */
  baseDesignIds: string[];
  /** IDs of designs in the closure */
  closureDesignIds: string[];
  /** Type of closure computed */
  closureType: "orthogonal" | "biorthogonal";
  /** Number of iterations to reach fixpoint */
  iterations: number;
  /** Whether fixpoint was reached */
  isComplete: boolean;
};

// ============================================================================
// Game Types (derived from behaviours)
// ============================================================================

/**
 * Game - Derived from a behaviour (Section 6.2)
 * Games are behaviours with additional structure for playing
 */
export type Game = {
  id: string;
  behaviourId: string;
  /** Arena structure */
  arena: Arena;
  /** Set of valid moves */
  moves: Move[];
  /** Legal game positions */
  positions: GamePosition[];
  /** Strategies available in this game */
  strategies: GameStrategy[];
};

/**
 * Arena - The playing field for a game (Definition 3.1)
 * Arena = (Γ, Λ, λ) where Γ is addresses, Λ is legal positions, λ is labeling
 */
export type Arena = {
  /** Set of addresses (Γ) */
  addresses: string[];
  /** Set of legal position identifiers (Λ) */
  legalPositionIds: string[];
  /** Labeling function - maps addresses to their properties */
  labeling: Record<string, ArenaLabel>;
  /** Initial position address */
  initialPosition?: string;
};

/**
 * Label for an address in the arena
 */
export type ArenaLabel = {
  /** Whose turn at this address */
  polarity: "P" | "O";
  /** Available sub-addresses (ramification) */
  ramification: number[];
  /** Optional semantic label */
  label?: string;
};

/**
 * Move - Action taken in a game
 */
export type Move = {
  id: string;
  /** Address where move is played */
  address: string;
  /** Player making the move */
  polarity: "P" | "O";
  /** Justifying previous move (if any) */
  justifier?: string;
  /** Sub-addresses opened by this move */
  ramification: number[];
};

/**
 * GamePosition - Position in game play
 */
export type GamePosition = {
  id: string;
  gameId: string;
  /** Sequence of moves leading to this position */
  sequence: Move[];
  /** Is this a legal position? */
  isLegal: boolean;
  /** Whose turn is next */
  player: "P" | "O";
  /** Is this a terminal position? */
  isTerminal: boolean;
  /** Winner if terminal (undefined if draw or ongoing) */
  winner?: "P" | "O";
};

/**
 * GameStrategy - Strategy within a specific game
 */
export type GameStrategy = {
  strategyId: string;
  designId: string;
  isInnocent: boolean;
  /** Response function for this game */
  responseMap: Record<string, Move>;
};

// ============================================================================
// Behaviour Computation Types
// ============================================================================

/**
 * Options for computing biorthogonal closure
 */
export type ClosureComputationOptions = {
  /** Maximum iterations before giving up */
  maxIterations?: number;
  /** Whether to use refined orthogonality check */
  useRefinedOrthogonality?: boolean;
  /** Whether to cache intermediate results */
  cacheIntermediates?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
};

/**
 * Options for behaviour creation
 */
export type BehaviourCreationOptions = {
  /** Name for the behaviour */
  name?: string;
  /** Whether to check if it forms a game */
  checkIsGame?: boolean;
  /** Whether to check if it forms a type */
  checkIsType?: boolean;
  /** Closure computation options */
  closureOptions?: ClosureComputationOptions;
};

/**
 * Options for game construction
 */
export type GameConstructionOptions = {
  /** Maximum positions to compute */
  maxPositions?: number;
  /** Whether to compute all strategies */
  computeStrategies?: boolean;
  /** Whether to validate legality of all positions */
  validatePositions?: boolean;
};

/**
 * Behaviour validation result
 */
export type BehaviourValidation = {
  behaviourId: string;
  /** Is D⊥⊥ = D? */
  isClosed: boolean;
  /** Iteration count to verify */
  verificationIterations: number;
  /** Missing designs if not closed */
  missingDesignIds?: string[];
  /** Extra designs if not closed */
  extraDesignIds?: string[];
};

/**
 * Behaviour membership check result
 */
export type BehaviourMembershipCheck = {
  designId: string;
  behaviourId: string;
  isMember: boolean;
  /** If not member, why */
  reason?: string;
  /** Witness design showing non-membership */
  witnessDesignId?: string;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new behaviour
 */
export function createBehaviour(
  deliberationId: string,
  baseDesignIds: string[],
  closureDesignIds: string[],
  options?: Partial<Behaviour>
): Behaviour {
  return {
    id: options?.id ?? `behaviour-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    deliberationId,
    baseDesignIds,
    closureDesignIds,
    isGame: options?.isGame ?? false,
    isType: options?.isType ?? false,
    dimension: closureDesignIds.length,
    name: options?.name,
    createdAt: options?.createdAt ?? new Date(),
  };
}

/**
 * Create an orthogonality result
 */
export function createOrthogonalityResult(
  design1Id: string,
  design2Id: string,
  isOrthogonal: boolean,
  method: "basic" | "dispute-intersection",
  options?: Partial<OrthogonalityResult>
): OrthogonalityResult {
  return {
    design1Id,
    design2Id,
    isOrthogonal,
    method,
    convergenceType: options?.convergenceType,
    disputeCount: options?.disputeCount,
    evidence: options?.evidence,
  };
}

/**
 * Create a closure result
 */
export function createClosureResult(
  baseDesignIds: string[],
  closureDesignIds: string[],
  closureType: "orthogonal" | "biorthogonal",
  iterations: number,
  isComplete: boolean
): ClosureResult {
  return {
    baseDesignIds,
    closureDesignIds,
    closureType,
    iterations,
    isComplete,
  };
}

/**
 * Create a game from behaviour
 */
export function createGame(
  behaviourId: string,
  arena: Arena,
  moves: Move[],
  positions: GamePosition[],
  strategies: GameStrategy[]
): Game {
  return {
    id: `game-${behaviourId}`,
    behaviourId,
    arena,
    moves,
    positions,
    strategies,
  };
}

/**
 * Create an arena
 */
export function createArena(
  addresses: string[],
  labeling: Record<string, ArenaLabel>,
  initialPosition?: string
): Arena {
  return {
    addresses,
    legalPositionIds: [],
    labeling,
    initialPosition,
  };
}
