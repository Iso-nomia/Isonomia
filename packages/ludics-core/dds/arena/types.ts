/**
 * DDS Phase 5 - Arena Types
 * 
 * Based on Faggian & Hyland (2002) - Definition 3.1 (Universal Arena)
 * 
 * The Universal Arena is the foundational structure for ludics games.
 * It defines the space of possible moves and their relationships.
 */

// ============================================================================
// Core Arena Types
// ============================================================================

/**
 * Universal Arena (Definition 3.1)
 * 
 * Arena A = (Moves, Labels, Enabling) where:
 * - Moves: All actions (ξ, J) with address ξ and ramification J ∈ ℘fin(N)
 * - Labels: Implicit in address parity (even-length ↔ P, odd-length ↔ O)
 * - Enabling: (ξ, I) justifies (ξi, J) if i ∈ I
 */
export type UniversalArena = {
  id: string;
  /** Base address (e.g., "" for universal, or specific address for atomic) */
  base: string;
  /** All moves in this arena */
  moves: ArenaMove[];
  /** Enabling relation graph (edges) */
  enablingRelation: EnablingEdge[];
  /** Whether this is universal (base "") or atomic (delocalized) */
  isUniversal: boolean;
  /** Delocalization address (if atomic arena) */
  delocalizationAddress?: string;
  /** Arena metadata */
  createdAt?: Date;
  deliberationId?: string;
};

/**
 * Move in the arena (Definition 3.1)
 * 
 * A move is an action (ξ, J) where:
 * - ξ is the focus address
 * - J is the ramification (sub-addresses opened)
 */
export type ArenaMove = {
  id: string;
  /** Focus address ξ (e.g., "", "0", "01", "012") */
  address: string;
  /** Ramification J ∈ ℘fin(N) - indices of sub-addresses opened */
  ramification: number[];
  /** Player determined by address parity */
  player: "P" | "O";
  /** Is this an initial move (address is base)? */
  isInitial: boolean;
  /** Parent move ID that justifies this (if not initial) */
  justifierId?: string;
  /** Optional semantic label/expression */
  label?: string;
  /** Optional metadata for extended information */
  metadata?: Record<string, unknown>;
};

/**
 * Enabling edge in arena
 * 
 * Represents: (ξ, I) justifies (ξi, J) if i ∈ I
 */
export type EnablingEdge = {
  /** Move (ξ, I) that enables */
  justifierId: string;
  /** Move (ξi, J) that is enabled */
  enabledId: string;
  /** The index i ∈ I that creates the sub-address */
  index: number;
};

/**
 * Arena label for an address
 */
export type ArenaLabel = {
  /** Address this label applies to */
  address: string;
  /** Player owning this address */
  player: "P" | "O";
  /** Ramification available from this address */
  ramification: number[];
  /** Optional semantic label */
  label?: string;
};

// ============================================================================
// Legal Position Types
// ============================================================================

/**
 * Legal Position / Play (Definition 3.7)
 * 
 * A play is a linear sequence of actions satisfying:
 * 1. Parity: Alternates between P and O
 * 2. Justification: Each non-initial move is justified by earlier move
 * 3. Linearity: Any address appears at most once
 * 4. Visibility: Justifier of κ occurs in view tκ⁺
 */
export type LegalPosition = {
  id: string;
  arenaId: string;
  /** Sequence of moves in this position */
  sequence: ArenaMove[];
  /** Length of sequence */
  length: number;
  /** Whose turn is next */
  currentPlayer: "P" | "O";
  /** P-view of this position */
  pView: ArenaMove[];
  /** O-view of this position */
  oView: ArenaMove[];
  /** Is this position terminal (no more legal moves)? */
  isTerminal: boolean;
  /** Validation status */
  validity: PositionValidity;
};

/**
 * Position validity check results
 */
export type PositionValidity = {
  /** Overall validity */
  isValid: boolean;
  /** Parity alternation satisfied */
  parityOk: boolean;
  /** All non-initial moves justified */
  justificationOk: boolean;
  /** No address repeated */
  linearityOk: boolean;
  /** Visibility condition satisfied */
  visibilityOk: boolean;
  /** Error details if invalid */
  errors?: string[];
};

/**
 * Player View (Definition 3.5)
 * 
 * The view extracts the relevant history from a player's perspective.
 */
export type PlayerView = {
  player: "P" | "O";
  positionId: string;
  /** The computed view sequence */
  viewSequence: ArenaMove[];
};

// ============================================================================
// Game Types
// ============================================================================

/**
 * Ludics Game (derived from behaviours)
 * 
 * A game G is a pair (A, A⊥) of orthogonal behaviours
 */
export type LudicsGame = {
  id: string;
  name?: string;
  deliberationId: string;
  /** Positive behaviour (A) */
  positiveBehaviourId: string;
  /** Negative behaviour (A⊥) */
  negativeBehaviourId: string;
  /** The arena structure */
  arena: UniversalArena;
  /** Available strategies in this game */
  strategies: GameStrategy[];
  /** Current game state (for live play) */
  gameState?: GamePlayState;
  createdAt?: Date;
};

/**
 * Strategy in a game context
 */
export type GameStrategy = {
  id: string;
  gameId: string;
  /** Original design/strategy ID from behaviour */
  sourceId: string;
  /** Which player uses this strategy */
  player: "P" | "O";
  /** Response map: position key → move */
  responseMap: Record<string, ArenaMove>;
  /** Is this strategy winning? */
  isWinning?: boolean;
};

/**
 * Live game play state
 */
export type GamePlayState = {
  gameId: string;
  /** Current position */
  currentPosition: LegalPosition;
  /** Selected strategy for P (if any) */
  pStrategyId?: string;
  /** Selected strategy for O (if any) */
  oStrategyId?: string;
  /** Game status */
  status: "setup" | "playing" | "p_wins" | "o_wins" | "draw";
  /** Move log */
  moveLog: MoveLogEntry[];
};

/**
 * Move log entry
 */
export type MoveLogEntry = {
  moveNumber: number;
  player: "P" | "O";
  move: ArenaMove;
  timestamp: Date;
  /** Position ID after this move */
  resultingPositionId: string;
};

// ============================================================================
// Compact Encoding Types (for storage)
// ============================================================================

/**
 * Compact encoded game state for storage
 * Designed for minimal storage footprint (~200 bytes vs ~5KB)
 */
export type EncodedGameState = {
  /** Version for forward compatibility */
  v: number;
  /** Game ID */
  g: string;
  /** Arena ID reference */
  a: string;
  /** Move sequence as address:ramification pairs */
  m: string; // e.g., "0:1,2|01:3|012:1,4"
  /** Current player: 0=P, 1=O */
  p: 0 | 1;
  /** Status: 0=playing, 1=p_wins, 2=o_wins, 3=draw */
  s: 0 | 1 | 2 | 3;
  /** Timestamp (unix seconds) */
  t: number;
};

/**
 * Compact encoded arena for storage
 */
export type EncodedArena = {
  /** Version */
  v: number;
  /** Arena ID */
  id: string;
  /** Base address */
  b: string;
  /** Moves as "addr:ram1,ram2|addr:ram1,ram2" */
  m: string;
  /** Enabling as "justId>enabledId:idx|..." */
  e: string;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new arena move
 */
export function createArenaMove(
  address: string,
  ramification: number[],
  options?: Partial<ArenaMove>
): ArenaMove {
  const player = getPlayerFromAddress(address);
  const isInitial = address === "" || address === options?.justifierId;
  
  return {
    id: options?.id ?? `move-${address}-${Date.now()}`,
    address,
    ramification,
    player,
    isInitial: isInitial || !options?.justifierId,
    justifierId: options?.justifierId,
    label: options?.label,
    metadata: options?.metadata,
  };
}

/**
 * Get player from address based on parity (Definition 3.1)
 * 
 * Even-length addresses → one player (P by convention)
 * Odd-length addresses → other player (O by convention)
 */
export function getPlayerFromAddress(address: string): "P" | "O" {
  // Empty string has length 0 (even) → P starts
  // Each digit adds 1 to length
  const depth = address.length;
  return depth % 2 === 0 ? "P" : "O";
}

/**
 * Create an empty legal position (initial position)
 */
export function createInitialPosition(arenaId: string): LegalPosition {
  return {
    id: `pos-initial-${Date.now()}`,
    arenaId,
    sequence: [],
    length: 0,
    currentPlayer: "P", // P starts by convention
    pView: [],
    oView: [],
    isTerminal: false,
    validity: {
      isValid: true,
      parityOk: true,
      justificationOk: true,
      linearityOk: true,
      visibilityOk: true,
    },
  };
}

/**
 * Create position validity result
 */
export function createPositionValidity(
  checks: Partial<PositionValidity>
): PositionValidity {
  const validity: PositionValidity = {
    parityOk: checks.parityOk ?? true,
    justificationOk: checks.justificationOk ?? true,
    linearityOk: checks.linearityOk ?? true,
    visibilityOk: checks.visibilityOk ?? true,
    isValid: true,
    errors: checks.errors,
  };
  
  validity.isValid = 
    validity.parityOk && 
    validity.justificationOk && 
    validity.linearityOk && 
    validity.visibilityOk;
  
  return validity;
}

/**
 * Serialize position to string key (for response maps)
 */
export function serializePosition(position: LegalPosition): string {
  return position.sequence
    .map(m => `${m.address}:${m.ramification.join(",")}`)
    .join("|");
}

/**
 * Serialize move to compact string
 */
export function serializeMove(move: ArenaMove): string {
  return `${move.address}:${move.ramification.join(",")}`;
}
