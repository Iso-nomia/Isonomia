/**
 * ============================================
 * LUDICS THEORY TYPES
 * ============================================
 * 
 * Core type system aligned with theoretical foundations:
 * - Girard, J.-Y. "Locus Solum: From the rules of logic to the logic of rules"
 * - Faggian & Hyland "Designs, disputes and strategies"
 * - Fouqueré & Quatrini "Study of Behaviours via Visitable Paths"
 * - Fouqueré & Quatrini "Ludics and Natural Language: First Approaches"
 * 
 * These types form the theoretical foundation for the deliberation-ludics
 * integration, providing a player-agnostic model where P/O are perspectives
 * (active/reactive) rather than fixed roles.
 * 
 * Key Concepts:
 * - Arena = Deliberation design space (addresses from argument tree)
 * - Design = Strategy (set of coherent chronicles)
 * - Chronicle = Single path through design
 * - Dialogue Act = Atomic unit of interaction (from Fouqueré & Quatrini)
 * - Visitable Path = Proof trace (incarnation = essential core)
 * - Behaviour = Equivalence class via biorthogonal closure
 */

// ============================================
// FOUNDATIONAL TYPES
// ============================================

/**
 * Ludic Address (Girard's locus/focus)
 * 
 * A path through the interaction tree, derived from argument/claim
 * position in deliberation.
 * 
 * Examples:
 * - [] = root position (ξ in Girard notation)
 * - [0] = first child of root (ξ.0)
 * - [0, 1, 2] = path through tree (ξ.0.1.2)
 * - [2, 0] = third child of root, then its first child (ξ.2.0)
 * 
 * The address encodes the position in the argument tree and determines
 * polarity: even-length addresses are positive (+), odd-length are negative (-).
 */
export type LudicAddress = number[];

/**
 * Polarity in interaction
 * 
 * + = active/asserting (Proponent perspective when viewing own moves)
 * - = reactive/challenging (Opponent perspective when viewing own moves)
 * 
 * CRITICAL: These are PERSPECTIVES, not fixed roles.
 * - Each participant sees their own moves as positive (active/asserting)
 * - Each participant sees counterparty moves as negative (reactive)
 * - The same interaction looks different from each viewpoint
 * - This enables player-agnostic design: same system for 1 or N participants
 */
export type Polarity = "+" | "-";

/**
 * Dialogue Act Type (Speech act classification)
 * 
 * Based on Fouqueré & Quatrini's formalization of argumentation dialogues.
 * Maps to common argumentative speech acts.
 */
export type DialogueActType =
  | "claim"      // Pose thesis (positive, opens new loci)
  | "argue"      // Provide premises + structure (positive, multiple ramifications)
  | "negate"     // Refuse/counter (positive, justified by prior claim)
  | "ask"        // Request justification (positive, same structure as negate)
  | "concede"    // Accept opponent's point (sequence: pos then neg, closes branch)
  | "daimon";    // Give up / end interaction (special positive, terminates)

/**
 * Dialogue Act (from Fouqueré & Quatrini)
 * 
 * The atomic unit of deliberative interaction. This is the ludics formalization
 * of a dialogue move, capturing:
 * - WHO is acting (polarity)
 * - WHERE in the argument space (focus)
 * - WHAT branches are opened (ramification)
 * - WHAT is said (expression)
 * - WHAT kind of speech act (type)
 * 
 * Definition (from paper):
 * A dialogue act κ is a tuple (ε, ξ, I, e) where:
 * - ε is the polarity (+/-)
 * - ξ is the focus (address in interaction tree)
 * - I is the ramification (new addresses opened)
 * - e is the expression (the actual content)
 */
export interface DialogueAct {
  /** Active (+) or reactive (-) */
  polarity: Polarity;

  /** Position being addressed (Girard's focus ξ) */
  focus: LudicAddress;

  /** New positions opened by this act (Girard's ramification I) */
  ramification: LudicAddress[];

  /** Content (claim text, argument, etc.) */
  expression: string;

  /** Type of speech act */
  type: DialogueActType;

  /** Optional unique identifier */
  id?: string;

  /** Optional timestamp */
  timestamp?: number;

  /** Optional source (argument ID, move ID, etc.) */
  sourceId?: string;
}

// ============================================
// DESIGN & CHRONICLE TYPES
// ============================================

/**
 * Chronicle = Single path through a design
 * 
 * An alternating sequence of actions representing one possible play.
 * Chronicles are the building blocks of designs.
 * 
 * From Girard: A chronicle is a maximal branch in the design tree,
 * ending either in a daimon (†) or at a negative action.
 */
export interface Chronicle {
  /** Ordered sequence of dialogue acts */
  actions: DialogueAct[];

  /** Does this chronicle end in daimon or terminal? */
  isComplete: boolean;

  /** Optional identifier */
  id?: string;
}

/**
 * Design = Strategy = Complete response pattern
 * 
 * A design is a set of coherent chronicles that represents a complete
 * strategy for interaction. In game-theoretic terms, it specifies
 * a response for every possible opponent move.
 * 
 * Key properties:
 * - hasDaimon: If true, the design can "give up" (end interaction convergently)
 * - isWinning: If no daimon, the design forces opponent to give up
 * 
 * From Faggian & Hyland: A design is winning if it contains no daimon,
 * meaning every interaction either diverges or ends with opponent's daimon.
 */
export interface LudicDesignTheory {
  /** Unique identifier */
  id: string;

  /** Initial addresses (base of the design) */
  base: LudicAddress[];

  /** Starting polarity */
  polarity: Polarity;

  /** All possible response paths (chronicles) */
  chronicles: Chronicle[];

  /** Can this design give up? (contains daimon) */
  hasDaimon: boolean;

  /** Is this a winning design? (no daimon = forces opponent to daimon) */
  isWinning: boolean;

  /** Optional human-readable name */
  name?: string;

  /** Optional source deliberation ID */
  deliberationId?: string;

  /** Optional source participant ID */
  participantId?: string;
}

// ============================================
// ARENA TYPES
// ============================================

/**
 * Arena Position
 * 
 * A position in the deliberation arena, representing a single
 * argument, claim, or response in the deliberation tree.
 */
export interface ArenaPositionTheory {
  /** Address in the arena (path through tree) */
  address: LudicAddress;

  /** Content of this position (claim text, argument, etc.) */
  content: string;

  /** Type of position */
  type: "claim" | "support" | "attack" | "question" | "response" | "premise";

  /** Indices of possible responses (ramification) */
  ramification: number[];

  /** Polarity at this position (determined by address depth) */
  polarity: Polarity;

  /** Depth in tree (length of address) - optional, can be computed from address.length */
  depth?: number;

  /** Optional source ID (argument ID, claim ID, etc.) */
  sourceId?: string;

  /** Type of source element (claim or argument) */
  sourceType?: "claim" | "argument";
}

/**
 * Deliberation Arena
 * 
 * The complete space of interaction built from a deliberation's structure.
 * This is the ludics formalization of an argument space.
 * 
 * From Girard (Universal Arena): Arena A = (Moves, Labels, Enabling) where
 * moves are all possible actions, labels determine ownership, and enabling
 * specifies justification relationships.
 */
export interface DeliberationArena {
  /** Source deliberation ID */
  deliberationId: string;

  /** Root address (typically empty []) */
  rootAddress: LudicAddress;

  /** All positions in the arena, keyed by address */
  positions: Map<string, ArenaPositionTheory>;

  /** All available designs (strategies) in this arena */
  availableDesigns: LudicDesignTheory[];

  /** Optional arena ID */
  id?: string;

  /** Arena statistics */
  statistics?: ArenaStatistics;
}

/**
 * Arena Statistics
 */
export interface ArenaStatistics {
  /** Total number of positions */
  positionCount: number;

  /** Maximum depth of the tree */
  maxDepth: number;

  /** Average branching factor */
  branchingFactor: number;

  /** Number of terminal positions (no ramification) */
  terminalCount: number;

  /** Number of available designs */
  designCount: number;
}

// ============================================
// INTERACTION TYPES
// ============================================

/**
 * Interaction State
 * 
 * The current state of an interaction (game play) on an arena.
 */
export interface InteractionState {
  /** The arena being played on */
  arena: DeliberationArena;

  /** Actions taken so far */
  currentPath: DialogueAct[];

  /** Current position (focus of last action) */
  currentAddress: LudicAddress;

  /** Whose turn (which polarity moves next) */
  activePolarity: Polarity;

  /** P's current design (strategy) */
  pDesign: LudicDesignTheory | null;

  /** O's current design (strategy) */
  oDesign: LudicDesignTheory | null;

  /** Has interaction terminated? */
  terminated: boolean;

  /** Optional interaction ID */
  id?: string;
}

/**
 * Interaction Result
 * 
 * The outcome of a completed interaction.
 */
export interface InteractionResult {
  /** The visitable path (proof trace) */
  path: VisitablePath;

  /** Outcome type */
  outcome: "convergent" | "divergent";

  /** Who got stuck (if divergent) or gave up (if convergent) */
  stuckPlayer: "P" | "O" | null;

  /** Full trace of actions */
  trace: DialogueAct[];

  /** Number of moves */
  moveCount: number;

  /** Optional interaction ID */
  id?: string;
}

// ============================================
// PLAY & GAME SESSION TYPES
// ============================================

/**
 * Participant in a play
 */
export interface Participant {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Current perspective in the interaction */
  perspective: Polarity;

  /** Is this an AI participant? */
  isAI?: boolean;

  /** AI difficulty if applicable */
  aiDifficulty?: "easy" | "medium" | "hard";
}

/**
 * Play = Complete game session
 * 
 * A Play is a complete record of an interaction on an arena,
 * including all moves, participants, and timing information.
 */
export interface Play {
  /** Unique identifier */
  id: string;

  /** Arena being played on */
  arena: DeliberationArena;

  /** Source deliberation ID */
  deliberationId: string;

  /** Participants in the play */
  participants: Participant[];

  /** All moves in order */
  moves: PlayMove[];

  /** Current interaction state */
  state: InteractionState;

  /** Result (if completed) */
  result?: InteractionResult;

  /** When the play started */
  startedAt: Date;

  /** When the play ended (if completed) */
  endedAt?: Date;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * PlayMove = Single move in a play
 * 
 * Records a single action in a play with timing and attribution.
 */
export interface PlayMove {
  /** Unique identifier */
  id: string;

  /** Play this move belongs to */
  playId: string;

  /** Sequence number (0-indexed) */
  sequence: number;

  /** The dialogue act */
  action: DialogueAct;

  /** Participant who made this move (if attributed) */
  participantId?: string;

  /** When this move was made */
  timestamp: Date;

  /** Time taken to make this move (ms) */
  thinkTime?: number;

  /** Optional annotation/comment */
  annotation?: string;
}

/**
 * Strategy = Response pattern
 * 
 * A strategy specifies which move to make at each position.
 * This is a practical representation of a design.
 */
export interface Strategy {
  /** Unique identifier */
  id: string;

  /** Associated design (if any) */
  designId?: string;

  /** Polarity of the strategist */
  polarity: Polarity;

  /** Response map: address → chosen response index */
  responses: Map<string, number>;

  /** Should this strategy include daimon moves? */
  allowDaimon: boolean;

  /** Optional name */
  name?: string;
}

/**
 * Move validation result
 */
export interface MoveValidation {
  /** Is the move valid? */
  valid: boolean;

  /** Validation errors (if any) */
  errors: MoveValidationError[];
}

/**
 * Move validation error
 */
export interface MoveValidationError {
  /** Error code */
  code: "WRONG_POLARITY" | "INVALID_ADDRESS" | "INVALID_RAMIFICATION" | "NOT_YOUR_TURN" | "GAME_OVER" | "UNKNOWN";

  /** Human-readable message */
  message: string;

  /** Additional details */
  details?: Record<string, unknown>;
}

// ============================================
// VISITABLE PATH & INCARNATION TYPES
// ============================================

/**
 * Visitable Path = Proof Trace
 * 
 * The actual interaction that occurred, representing a path through
 * the design space that was "visited" during interaction.
 * 
 * From Fouqueré & Quatrini: A visitable path is a path in a design
 * that may be traversed by interaction with a design of the orthogonal.
 * The set of visitable paths characterizes a behaviour.
 */
export interface VisitablePath {
  /** All actions in order */
  actions: DialogueAct[];

  /** Did interaction end with daimon? (convergent = success) */
  convergent: boolean;

  /** Who could still move when it ended? (winner = not stuck) */
  winner: "P" | "O" | null;

  /** Essential core of the path (incarnation) */
  incarnation: DialogueAct[];

  /** Optional path ID */
  id?: string;
}

/**
 * Justified Narrative
 * 
 * Human-readable representation of a proof trace, converting
 * the incarnation into an understandable argument flow.
 */
export interface JustifiedNarrative {
  /** Steps in the narrative */
  steps: NarrativeStep[];

  /** Final conclusion */
  conclusion: string;

  /** Chain of justifications */
  justificationChain: string[];
}

/**
 * Narrative Step
 */
export interface NarrativeStep {
  /** The claim/argument at this step */
  position: string;

  /** Why this step follows from previous */
  justification: string;

  /** Who made this move (Proponent/Opponent) */
  speaker: "Proponent" | "Opponent";

  /** Type of move */
  type: "claim" | "support" | "attack" | "concession";
}

// ============================================
// BEHAVIOUR TYPES
// ============================================

/**
 * Ludic Behaviour
 * 
 * A behaviour is a set of designs closed under biorthogonal closure.
 * It represents an equivalence class of strategies.
 * 
 * From Girard: G is a behaviour iff G = G⊥⊥ (biorthogonal closure)
 * 
 * Key concepts:
 * - Orthogonal (G⊥): All designs that converge with all designs in G
 * - Biorthogonal (G⊥⊥): Orthogonal of orthogonal
 * - A set is a behaviour iff it equals its biorthogonal
 */
export interface LudicBehaviourTheory {
  /** Unique identifier */
  id: string;

  /** Base addresses */
  base: LudicAddress[];

  /** All designs in this behaviour */
  designs: LudicDesignTheory[];

  /** Polarity of the behaviour */
  polarity: Polarity;

  /** Is this a complete behaviour? (equals its biorthogonal) */
  isComplete: boolean;

  /** Optional source deliberation */
  deliberationId?: string;
}

/**
 * Position Strength Analysis
 * 
 * Analysis of how "strong" a position is strategically.
 */
export interface PositionStrength {
  /** Address of the position */
  address: LudicAddress;

  /** Number of winning designs from this position */
  winningDesignCount: number;

  /** Total designs from this position */
  totalDesignCount: number;

  /** Simulation win rate (0-1) */
  winRate: number;

  /** Does a winning strategy exist from here? */
  hasWinningStrategy: boolean;

  /** Average depth to termination */
  depth: number;
}

/**
 * Landscape Data
 * 
 * Complete analysis of the strategic landscape over an arena.
 */
export interface LandscapeData {
  /** Source arena */
  arena: DeliberationArena;

  /** Strength analysis per position */
  positions: PositionStrength[];

  /** Heat map data for visualization */
  heatMap: HeatMapData;

  /** Common traversal patterns */
  flowPaths: FlowPath[];

  /** Positions where outcome is determined */
  criticalPoints: LudicAddress[];
}

/**
 * Heat Map Data
 */
export interface HeatMapData {
  positions: Array<{
    address: LudicAddress;
    x: number;
    y: number;
    strength: number;
    polarity: Polarity;
  }>;
}

/**
 * Flow Path (common traversal pattern)
 */
export interface FlowPath {
  addresses: LudicAddress[];
  frequency: number;
  outcome: "convergent" | "divergent";
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert address to string key for Map lookup
 * 
 * @example
 * addressToKey([0, 1, 2]) // "0.1.2"
 * addressToKey([]) // ""
 */
export function addressToKey(addr: LudicAddress): string {
  return addr.join(".");
}

/**
 * Parse string key back to address
 * 
 * @example
 * keyToAddress("0.1.2") // [0, 1, 2]
 * keyToAddress("") // []
 */
export function keyToAddress(key: string): LudicAddress {
  if (key === "") return [];
  return key.split(".").map((s) => parseInt(s, 10));
}

/**
 * Check if two addresses are equal
 */
export function addressEquals(a: LudicAddress, b: LudicAddress): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Check if address `a` is a prefix of address `b`
 * 
 * @example
 * isAddressPrefix([0], [0, 1, 2]) // true
 * isAddressPrefix([0, 1], [0, 2]) // false
 */
export function isAddressPrefix(a: LudicAddress, b: LudicAddress): boolean {
  return a.length <= b.length && a.every((v, i) => v === b[i]);
}

/**
 * Alias for isAddressPrefix
 */
export const isPrefix = isAddressPrefix;

/**
 * Get parent address (remove last element)
 * 
 * @example
 * getParentAddress([0, 1, 2]) // [0, 1]
 * getParentAddress([]) // []
 */
export function getParentAddress(addr: LudicAddress): LudicAddress {
  if (addr.length === 0) return [];
  return addr.slice(0, -1);
}

/**
 * Get child address (append index)
 * 
 * @example
 * getChildAddress([0, 1], 2) // [0, 1, 2]
 */
export function getChildAddress(addr: LudicAddress, index: number): LudicAddress {
  return [...addr, index];
}

/**
 * Get polarity at address (even depth = +, odd depth = -)
 * 
 * This follows the Faggian-Hyland convention:
 * - P plays at even-length addresses (0, 2, 4, ...)
 * - O plays at odd-length addresses (1, 3, 5, ...)
 * 
 * @example
 * polarityAtAddress([]) // "+"
 * polarityAtAddress([0]) // "-"
 * polarityAtAddress([0, 1]) // "+"
 */
export function polarityAtAddress(addr: LudicAddress): Polarity {
  return addr.length % 2 === 0 ? "+" : "-";
}

/**
 * Create daimon action at address
 * 
 * A daimon (†) is a special positive action that ends interaction.
 * It represents "giving up" or accepting the current state.
 */
export function createDaimon(focus: LudicAddress, expression = "†"): DialogueAct {
  return {
    polarity: "+",
    focus,
    ramification: [],
    expression,
    type: "daimon",
  };
}

/**
 * Check if a dialogue act is a daimon
 */
export function isDaimon(act: DialogueAct): boolean {
  return act.type === "daimon";
}

/**
 * Create a proper dialogue act
 */
export function createDialogueAct(
  polarity: Polarity,
  focus: LudicAddress,
  ramification: LudicAddress[],
  expression: string,
  type: DialogueActType = "claim"
): DialogueAct {
  return { polarity, focus, ramification, expression, type };
}

/**
 * Flip polarity
 */
export function flipPolarity(p: Polarity): Polarity {
  return p === "+" ? "-" : "+";
}

/**
 * Check if chronicle is positive-ended (ends with positive action)
 */
export function isPositiveChronicle(chronicle: Chronicle): boolean {
  if (chronicle.actions.length === 0) return false;
  return chronicle.actions[chronicle.actions.length - 1].polarity === "+";
}

/**
 * Check if chronicle contains daimon
 */
export function chronicleHasDaimon(chronicle: Chronicle): boolean {
  return chronicle.actions.some(isDaimon);
}

/**
 * Get the depth (length) of a chronicle
 */
export function chronicleDepth(chronicle: Chronicle): number {
  return chronicle.actions.length;
}

/**
 * Validate that actions alternate in polarity correctly
 */
export function validatePolairtyAlternation(actions: DialogueAct[]): boolean {
  for (let i = 1; i < actions.length; i++) {
    if (actions[i].polarity === actions[i - 1].polarity) {
      // Same polarity twice in a row - invalid unless daimon
      if (!isDaimon(actions[i]) && !isDaimon(actions[i - 1])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Extract all addresses used in an action sequence
 */
export function extractAddresses(actions: DialogueAct[]): Set<string> {
  const addresses = new Set<string>();
  for (const act of actions) {
    addresses.add(addressToKey(act.focus));
    for (const r of act.ramification) {
      addresses.add(addressToKey(r));
    }
  }
  return addresses;
}
