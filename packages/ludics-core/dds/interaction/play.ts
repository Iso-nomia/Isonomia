/**
 * ============================================
 * PLAY MANAGEMENT
 * ============================================
 * 
 * Manages complete game sessions (plays) on deliberation arenas.
 * Provides higher-level API for running interactions with full
 * tracking, timing, and persistence support.
 * 
 * A Play represents a complete game session with:
 * - Full move history
 * - Participant attribution
 * - Timing information
 * - Undo/redo support
 */

import type {
  Play,
  PlayMove,
  DeliberationArena,
  InteractionState,
  InteractionResult,
  DialogueAct,
  Participant,
  Polarity,
} from "../types/ludics-theory";

import {
  createInitialState,
  stepInteraction,
  isTerminated,
  validateMove,
} from "./stepper";

import {
  detectOutcome,
  isConvergent,
  isDivergent,
} from "./outcome";

// ============================================================================
// PLAY CREATION
// ============================================================================

/**
 * Create a new play from an arena
 * 
 * @param arena The arena to play on
 * @param options Play options
 * @returns New Play instance
 */
export function createPlay(
  arena: DeliberationArena,
  options?: {
    id?: string;
    participants?: Participant[];
    metadata?: Record<string, unknown>;
  }
): Play {
  const id = options?.id || generatePlayId();
  const state = createInitialState(arena, { id });

  return {
    id,
    arena,
    deliberationId: arena.deliberationId,
    participants: options?.participants || [],
    moves: [],
    state,
    startedAt: new Date(),
    metadata: options?.metadata,
  };
}

/**
 * Generate unique play ID
 */
function generatePlayId(): string {
  return `play-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique move ID
 */
function generateMoveId(): string {
  return `move-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// MOVE MANAGEMENT
// ============================================================================

/**
 * Make a move in the play
 * 
 * @param play Current play state
 * @param action The dialogue act to play
 * @param options Move options
 * @returns Updated play (immutable)
 */
export function makeMove(
  play: Play,
  action: DialogueAct,
  options?: {
    participantId?: string;
    thinkTime?: number;
    annotation?: string;
  }
): Play {
  // Validate the move
  const validation = validateMove(play.state, action);
  if (!validation.valid) {
    throw new Error(
      `Invalid move: ${validation.errors.map((e) => e.message).join(", ")}`
    );
  }

  // Step the interaction
  const newState = stepInteraction(play.state, action);

  // Create the move record
  const move: PlayMove = {
    id: generateMoveId(),
    playId: play.id,
    sequence: play.moves.length,
    action,
    participantId: options?.participantId,
    timestamp: new Date(),
    thinkTime: options?.thinkTime,
    annotation: options?.annotation,
  };

  // Check if game ended
  const result = detectOutcome(newState);

  return {
    ...play,
    moves: [...play.moves, move],
    state: newState,
    result: result || undefined,
    endedAt: result ? new Date() : undefined,
  };
}

/**
 * Undo the last move
 * 
 * @param play Current play state
 * @returns Updated play with last move removed
 */
export function undoMove(play: Play): Play {
  if (play.moves.length === 0) {
    throw new Error("No moves to undo");
  }

  // Remove last move
  const newMoves = play.moves.slice(0, -1);

  // Rebuild state from scratch
  let state = createInitialState(play.arena, { id: play.id });
  for (const move of newMoves) {
    state = stepInteraction(state, move.action);
  }

  return {
    ...play,
    moves: newMoves,
    state,
    result: undefined,
    endedAt: undefined,
  };
}

/**
 * Undo multiple moves
 * 
 * @param play Current play state
 * @param count Number of moves to undo
 * @returns Updated play
 */
export function undoMoves(play: Play, count: number): Play {
  let current = play;
  for (let i = 0; i < Math.min(count, play.moves.length); i++) {
    current = undoMove(current);
  }
  return current;
}

/**
 * Replay a play up to a certain move
 * 
 * @param play The play to replay
 * @param upToMove Move index to replay up to (exclusive)
 * @returns New play state at that point
 */
export function replayUpTo(play: Play, upToMove: number): Play {
  const movesToReplay = play.moves.slice(0, upToMove);
  
  let newPlay = createPlay(play.arena, {
    id: play.id,
    participants: play.participants,
    metadata: play.metadata,
  });

  for (const move of movesToReplay) {
    newPlay = makeMove(newPlay, move.action, {
      participantId: move.participantId,
      thinkTime: move.thinkTime,
      annotation: move.annotation,
    });
  }

  return newPlay;
}

// ============================================================================
// PLAY COMPLETION
// ============================================================================

/**
 * Complete a play (force termination if still in progress)
 * 
 * If the play hasn't naturally ended, this will detect the
 * current outcome based on the state.
 * 
 * @param play The play to complete
 * @returns Completed play with result
 */
export function completePlay(play: Play): Play & { result: InteractionResult } {
  if (play.result) {
    return play as Play & { result: InteractionResult };
  }

  // Force outcome detection
  const result = detectOutcome(play.state);
  
  if (!result) {
    // Create a "incomplete" result
    const incompleteResult: InteractionResult = {
      path: {
        actions: play.state.currentPath,
        convergent: false,
        winner: null,
        incarnation: play.state.currentPath,
      },
      outcome: "divergent",
      stuckPlayer: null,
      trace: play.state.currentPath,
      moveCount: play.moves.length,
    };

    return {
      ...play,
      result: incompleteResult,
      endedAt: new Date(),
    };
  }

  return {
    ...play,
    result,
    endedAt: new Date(),
  };
}

/**
 * Forfeit the play (current player gives up)
 * 
 * @param play Current play state
 * @param participantId Participant who is forfeiting
 * @returns Completed play with forfeit result
 */
export function forfeitPlay(
  play: Play,
  participantId?: string
): Play & { result: InteractionResult } {
  // Create daimon action at current position
  const daimonAction: DialogueAct = {
    polarity: play.state.activePolarity,
    focus: play.state.currentAddress,
    ramification: [],
    expression: "†",
    type: "daimon",
  };

  // Make the daimon move
  const updatedPlay = makeMove(play, daimonAction, { participantId });

  return completePlay(updatedPlay);
}

// ============================================================================
// SERIALIZATION
// ============================================================================

/**
 * Serialize play to JSON string
 * 
 * @param play The play to serialize
 * @returns JSON string
 */
export function serializePlay(play: Play): string {
  // Convert Map to array for JSON serialization
  const serializable = {
    ...play,
    arena: {
      ...play.arena,
      positions: Array.from(play.arena.positions.entries()),
    },
    state: {
      ...play.state,
      arena: null, // Don't duplicate arena
    },
  };

  return JSON.stringify(serializable);
}

/**
 * Deserialize play from JSON string
 * 
 * @param data JSON string
 * @returns Play instance
 */
export function deserializePlay(data: string): Play {
  const parsed = JSON.parse(data);

  // Reconstruct Map from array
  const positions = new Map(parsed.arena.positions);
  const arena: DeliberationArena = {
    ...parsed.arena,
    positions,
  };

  // Rebuild state
  let state = createInitialState(arena, { id: parsed.id });
  for (const move of parsed.moves) {
    state = stepInteraction(state, move.action);
  }

  return {
    ...parsed,
    arena,
    state,
    startedAt: new Date(parsed.startedAt),
    endedAt: parsed.endedAt ? new Date(parsed.endedAt) : undefined,
    moves: parsed.moves.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  };
}

// ============================================================================
// PLAY QUERIES
// ============================================================================

/**
 * Check if play is complete
 */
export function isPlayComplete(play: Play): boolean {
  return !!play.result || isTerminated(play.state);
}

/**
 * Check if it's a specific participant's turn
 */
export function isParticipantsTurn(
  play: Play,
  participantId: string
): boolean {
  const participant = play.participants.find((p) => p.id === participantId);
  if (!participant) return false;
  return participant.perspective === play.state.activePolarity;
}

/**
 * Get the current player
 */
export function getCurrentPlayer(play: Play): Participant | undefined {
  return play.participants.find(
    (p) => p.perspective === play.state.activePolarity
  );
}

/**
 * Get the winning participant (if game ended)
 */
export function getWinner(play: Play): Participant | undefined {
  if (!play.result) return undefined;
  
  const winnerPolarity = play.result.path.winner;
  if (!winnerPolarity) return undefined;

  const targetPerspective: Polarity = winnerPolarity === "P" ? "+" : "-";
  return play.participants.find((p) => p.perspective === targetPerspective);
}

/**
 * Get move history as readable format
 */
export function getMoveHistory(play: Play): Array<{
  sequence: number;
  player: "P" | "O";
  content: string;
  timestamp: Date;
  participant?: Participant;
}> {
  return play.moves.map((move) => ({
    sequence: move.sequence,
    player: move.action.polarity === "+" ? "P" : "O",
    content: move.action.expression,
    timestamp: move.timestamp,
    participant: play.participants.find((p) => p.id === move.participantId),
  }));
}

/**
 * Get play duration in milliseconds
 */
export function getPlayDuration(play: Play): number {
  const endTime = play.endedAt || new Date();
  return endTime.getTime() - play.startedAt.getTime();
}

/**
 * Get total think time across all moves
 */
export function getTotalThinkTime(play: Play): number {
  return play.moves.reduce((total, move) => total + (move.thinkTime || 0), 0);
}

// ============================================================================
// PLAY CLONING
// ============================================================================

/**
 * Clone a play (for branching exploration)
 * 
 * @param play The play to clone
 * @param options Clone options
 * @returns Cloned play with new ID
 */
export function clonePlay(
  play: Play,
  options?: { newId?: string }
): Play {
  return {
    ...play,
    id: options?.newId || generatePlayId(),
    moves: [...play.moves],
    state: { ...play.state },
  };
}

/**
 * Branch from a specific move (clone and replay up to that point)
 * 
 * @param play The play to branch from
 * @param fromMove Move index to branch from
 * @returns New play branched from that point
 */
export function branchFromMove(play: Play, fromMove: number): Play {
  const cloned = clonePlay(play, { newId: generatePlayId() });
  return replayUpTo(cloned, fromMove);
}
