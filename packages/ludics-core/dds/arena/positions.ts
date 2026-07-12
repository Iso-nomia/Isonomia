/**
 * DDS Phase 5 - Position Operations
 * 
 * Based on Faggian & Hyland (2002) - Definition 3.7 (Legal Positions)
 * 
 * Implements position validation, view computation, and move application.
 */

import type {
  UniversalArena,
  ArenaMove,
  LegalPosition,
  PositionValidity,
  PlayerView,
} from "./types";
import {
  createArenaMove,
  createInitialPosition,
  createPositionValidity,
  getPlayerFromAddress,
} from "./types";
import { checkEnabling, getMovesAtAddress } from "./arena";

// ============================================================================
// Position Validation (Definition 3.7)
// ============================================================================

/**
 * Validate a position against all legality conditions
 * 
 * A position is legal if it satisfies:
 * 1. Parity: Moves alternate between P and O
 * 2. Justification: Each non-initial move is justified by earlier move
 * 3. Linearity: Each address appears at most once
 * 4. Visibility: Justifier of move κ occurs in view at κ
 */
export function validatePosition(
  sequence: ArenaMove[],
  arena: UniversalArena
): PositionValidity {
  const errors: string[] = [];
  
  // 1. Parity check
  let parityOk = true;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i].player === sequence[i - 1].player) {
      parityOk = false;
      errors.push(`Parity violation at move ${i + 1}: consecutive ${sequence[i].player} moves`);
    }
  }
  
  // 2. Justification check
  let justificationOk = true;
  for (let i = 0; i < sequence.length; i++) {
    const move = sequence[i];
    if (!move.isInitial) {
      const hasJustifier = sequence.slice(0, i).some(
        prev => checkEnabling(prev, move)
      );
      if (!hasJustifier) {
        justificationOk = false;
        errors.push(`Move ${i + 1} (${move.address}) has no justifier in prior moves`);
      }
    }
  }
  
  // 3. Linearity check
  let linearityOk = true;
  const addresses = new Set<string>();
  for (let i = 0; i < sequence.length; i++) {
    const move = sequence[i];
    if (addresses.has(move.address)) {
      linearityOk = false;
      errors.push(`Linearity violation: address "${move.address}" appears twice`);
    }
    addresses.add(move.address);
  }
  
  // 4. Visibility check
  let visibilityOk = true;
  for (let i = 1; i < sequence.length; i++) {
    const move = sequence[i];
    if (!move.isInitial) {
      const prefix = sequence.slice(0, i);
      const view = computeViewForSequence(prefix, move.player);
      
      // Find the justifier
      const justifier = findJustifierInSequence(move, prefix);
      
      if (justifier && !view.some(v => v.id === justifier.id)) {
        visibilityOk = false;
        errors.push(
          `Visibility violation at move ${i + 1}: justifier not in ${move.player}-view`
        );
      }
    }
  }
  
  return createPositionValidity({
    parityOk,
    justificationOk,
    linearityOk,
    visibilityOk,
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * Find the justifier of a move within a sequence
 */
function findJustifierInSequence(
  move: ArenaMove,
  sequence: ArenaMove[]
): ArenaMove | undefined {
  // Justifier has address that is prefix of move's address
  // and ramification includes the extending index
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (checkEnabling(sequence[i], move)) {
      return sequence[i];
    }
  }
  return undefined;
}

// ============================================================================
// View Computation (Definition 3.5)
// ============================================================================

/**
 * Compute view for a player at a position
 * 
 * Definition 3.5:
 * - ε̅ = ε (empty view)
 * - s̅κ⁺ = s̅⁻κ⁺ (positive: include move, continue with negative prefix)
 * - s̅κ⁻ = κ⁻ if initial (negative initial: just the move)
 * - s̅κ'tκ⁻ = s̅⁻κ'κ (negative: jump to justifier)
 */
export function computeView(
  position: LegalPosition,
  player: "P" | "O"
): PlayerView {
  const viewSequence = computeViewForSequence(position.sequence, player);
  
  return {
    player,
    positionId: position.id,
    viewSequence,
  };
}

/**
 * Compute view for a raw sequence
 */
export function computeViewForSequence(
  sequence: ArenaMove[],
  player: "P" | "O"
): ArenaMove[] {
  if (sequence.length === 0) return [];
  
  const view: ArenaMove[] = [];
  let i = sequence.length - 1;
  
  while (i >= 0) {
    const move = sequence[i];
    const isPositive = move.player === player;
    
    if (isPositive) {
      // Positive move: include it and continue backwards
      view.unshift(move);
      i--;
    } else {
      // Negative move
      if (move.isInitial) {
        // Initial negative: include and stop
        view.unshift(move);
        break;
      } else {
        // Non-initial negative: include move, then jump to justifier
        view.unshift(move);
        
        // Find justifier in prior sequence
        const justifier = findJustifierInSequence(move, sequence.slice(0, i));
        if (justifier) {
          // Continue from justifier position
          const justifierIdx = sequence.findIndex(m => m.id === justifier.id);
          if (justifierIdx >= 0) {
            // Include justifier (it's positive for this player)
            view.unshift(justifier);
            i = justifierIdx - 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
  }
  
  return view;
}

/**
 * Compute P-view of a position
 */
export function computePView(position: LegalPosition): ArenaMove[] {
  return computeViewForSequence(position.sequence, "P");
}

/**
 * Compute O-view of a position
 */
export function computeOView(position: LegalPosition): ArenaMove[] {
  return computeViewForSequence(position.sequence, "O");
}

// ============================================================================
// Move Operations
// ============================================================================

/**
 * Get available moves from a position
 * 
 * Key constraints for tree-structured arenas:
 * 1. Branch commitment: once a branch is chosen, the game is committed to that branch
 * 2. Sibling exclusion: once one child of a node is played, siblings are excluded
 * 3. Parent requirement: a move is only available if its parent has been played
 */
export function getAvailableMoves(
  position: LegalPosition,
  arena: UniversalArena
): ArenaMove[] {
  if (position.isTerminal) return [];
  
  const usedAddresses = new Set(position.sequence.map(m => m.address));
  const currentPlayer = position.currentPlayer;
  
  // Build set of "blocked" parent addresses - parents where a sibling was already chosen
  const blockedParents = new Set<string>();
  for (const playedMove of position.sequence) {
    if (playedMove.address.length > 0) {
      const parentAddr = playedMove.address.slice(0, -1);
      // If a child of this parent was played, the parent is "consumed"
      blockedParents.add(parentAddr);
    }
  }
  
  return arena.moves.filter(move => {
    // Must be for current player
    if (move.player !== currentPlayer) return false;
    
    // Address must not be used (linearity)
    if (usedAddresses.has(move.address)) return false;
    
    // Initial moves are always available (if not used)
    if (move.isInitial) return true;
    
    // Non-initial moves: parent address must have been played
    const parentAddress = move.address.slice(0, -1);
    if (!usedAddresses.has(parentAddress)) return false;
    
    // Sibling exclusion: if parent already has a child played (but not this one),
    // this move is blocked
    if (blockedParents.has(parentAddress) && !usedAddresses.has(move.address)) {
      // Check if a DIFFERENT child of this parent was played
      const siblingPlayed = position.sequence.some(m => 
        m.address.length === move.address.length &&
        m.address.slice(0, -1) === parentAddress &&
        m.address !== move.address
      );
      if (siblingPlayed) return false;
    }
    
    // Also verify the parent actually enables this move (ramification check)
    const parentMove = position.sequence.find(m => m.address === parentAddress);
    if (!parentMove) return false;
    
    return checkEnabling(parentMove, move);
  });
}

/**
 * Apply a move to a position, creating a new position
 */
export function applyMove(
  position: LegalPosition,
  move: ArenaMove,
  arena: UniversalArena
): LegalPosition | null {
  // Validate move is legal
  if (move.player !== position.currentPlayer) return null;
  if (position.isTerminal) return null;
  
  // Check linearity
  if (position.sequence.some(m => m.address === move.address)) return null;
  
  // Build new sequence
  const newSequence = [...position.sequence, move];
  
  // Validate new position
  const validity = validatePosition(newSequence, arena);
  if (!validity.isValid) return null;
  
  // Determine next player
  const nextPlayer: "P" | "O" = move.player === "P" ? "O" : "P";
  
  // Check if terminal (no more available moves)
  const tempPosition: LegalPosition = {
    id: `pos-temp`,
    arenaId: arena.id,
    sequence: newSequence,
    length: newSequence.length,
    currentPlayer: nextPlayer,
    pView: [],
    oView: [],
    isTerminal: false,
    validity,
  };
  
  const availableNextMoves = getAvailableMoves(tempPosition, arena);
  const isTerminal = availableNextMoves.length === 0;
  
  // Compute views
  const pView = computeViewForSequence(newSequence, "P");
  const oView = computeViewForSequence(newSequence, "O");
  
  return {
    id: `pos-${Date.now()}-${newSequence.length}`,
    arenaId: arena.id,
    sequence: newSequence,
    length: newSequence.length,
    currentPlayer: nextPlayer,
    pView,
    oView,
    isTerminal,
    validity,
  };
}

/**
 * Check if a position is terminal (game over)
 */
export function isTerminalPosition(
  position: LegalPosition,
  arena: UniversalArena
): boolean {
  return getAvailableMoves(position, arena).length === 0;
}

/**
 * Get the winner of a terminal position
 * 
 * In Faggian-Hyland game semantics:
 * - The player who CANNOT move loses
 * - currentPlayer at a terminal position is the one who's stuck
 * - The winner is the OPPONENT of currentPlayer
 */
export function getWinner(position: LegalPosition): "P" | "O" | null {
  if (!position.isTerminal) return null;
  
  // The current player has no moves - they lose, opponent wins
  // currentPlayer is stuck, so the OTHER player wins
  return position.currentPlayer === "P" ? "O" : "P";
}

// ============================================================================
// Position Cache (for performance)
// ============================================================================

/**
 * LRU Cache for computed positions
 */
export class PositionCache {
  private cache = new Map<string, LegalPosition>();
  private maxSize: number;
  
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }
  
  /**
   * Compute cache key from move sequence
   */
  private computeKey(sequence: ArenaMove[]): string {
    return sequence.map(m => `${m.address}:${m.ramification.join(",")}`).join("|");
  }
  
  /**
   * Get position from cache or compute
   */
  getOrCompute(
    arena: UniversalArena,
    sequence: ArenaMove[]
  ): LegalPosition {
    const key = this.computeKey(sequence);
    
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const pos = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, pos);
      return pos;
    }
    
    // Compute position
    const validity = validatePosition(sequence, arena);
    const currentPlayer = sequence.length % 2 === 0 ? "P" as const : "O" as const;
    
    const position: LegalPosition = {
      id: `pos-${key.slice(0, 16)}-${Date.now()}`,
      arenaId: arena.id,
      sequence,
      length: sequence.length,
      currentPlayer,
      pView: computeViewForSequence(sequence, "P"),
      oView: computeViewForSequence(sequence, "O"),
      isTerminal: false, // Will be updated
      validity,
    };
    
    // Check terminal
    if (validity.isValid) {
      const availableMoves = getAvailableMoves(position, arena);
      position.isTerminal = availableMoves.length === 0;
    }
    
    // LRU eviction
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, position);
    return position;
  }
  
  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}

// ============================================================================
// Position Enumeration
// ============================================================================

/**
 * Enumerate legal positions up to a depth limit
 * Uses BFS to explore position tree
 */
export function enumerateLegalPositions(
  arena: UniversalArena,
  maxDepth: number,
  maxPositions = 1000
): LegalPosition[] {
  const positions: LegalPosition[] = [];
  const initial = createInitialPosition(arena.id);
  positions.push(initial);
  
  const queue: LegalPosition[] = [initial];
  
  while (queue.length > 0 && positions.length < maxPositions) {
    const current = queue.shift()!;
    
    if (current.length >= maxDepth) continue;
    
    const availableMoves = getAvailableMoves(current, arena);
    
    for (const move of availableMoves) {
      const nextPos = applyMove(current, move, arena);
      if (nextPos) {
        positions.push(nextPos);
        queue.push(nextPos);
        
        if (positions.length >= maxPositions) break;
      }
    }
  }
  
  return positions;
}
