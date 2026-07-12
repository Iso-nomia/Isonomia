/**
 * DDS Phase 2: Strategy Construction
 * Based on Faggian & Hyland (2002)
 * 
 * Constructs strategies from designs via disputes (Disp(D))
 */

import type { Action, Position, Dispute } from "../types";
import type { Strategy, Play, StrategyConstructionOptions } from "./types";
import { extractView } from "../views";
import { disputeToPosition } from "../chronicles";

/**
 * Construct strategy from design by computing all disputes
 * Disp(D) = all disputes between D and orthogonal counter-designs
 * 
 * @param designId - The design to construct strategy for
 * @param player - Which player's strategy ("P" or "O")
 * @param disputes - Pre-computed disputes involving this design
 * @param options - Construction options
 * @returns Constructed strategy
 */
export function constructStrategy(
  designId: string,
  player: "P" | "O",
  disputes: Dispute[],
  options: StrategyConstructionOptions = {}
): Strategy {
  const plays: Play[] = [];
  const seenSequences = new Set<string>();

  const maxPlays = options.maxPlays ?? 1000;

  for (const dispute of disputes) {
    if (plays.length >= maxPlays) break;

    // Convert dispute to position
    const position = disputeToPosition(dispute);

    // Extract plays for this player
    const playerPlays = extractPlaysFromPosition(position, player, designId);

    for (const play of playerPlays) {
      const seqKey = JSON.stringify(play.sequence);
      if (!seenSequences.has(seqKey)) {
        seenSequences.add(seqKey);
        plays.push({
          ...play,
          id: `play-${plays.length}`,
          strategyId: designId,
        });

        if (plays.length >= maxPlays) break;
      }
    }
  }

  return {
    id: `strategy-${designId}-${player}`,
    designId,
    player,
    plays,
    isInnocent: false, // Will be checked separately
    satisfiesPropagation: false, // Will be checked separately
  };
}

/**
 * Extract plays from a position for a specific player
 * Each prefix of the position that ends on player's turn is a play
 */
function extractPlaysFromPosition(
  position: Position,
  player: "P" | "O",
  designId: string
): Play[] {
  const plays: Play[] = [];

  // Each prefix ending on player's polarity is a valid play
  for (let i = 0; i < position.sequence.length; i++) {
    const prefix = position.sequence.slice(0, i + 1);
    const lastAction = prefix[prefix.length - 1];

    plays.push({
      id: `play-${i}`,
      strategyId: designId,
      sequence: prefix,
      length: prefix.length,
      isPositive: lastAction.polarity === player,
    });
  }

  return plays;
}

/**
 * Create an empty strategy for a player
 */
export function createEmptyStrategy(
  designId: string,
  player: "P" | "O"
): Strategy {
  return {
    id: `strategy-${designId}-${player}`,
    designId,
    player,
    plays: [],
    isInnocent: true, // Empty strategy is trivially innocent
    satisfiesPropagation: true,
  };
}

/**
 * Create a strategy from a single play
 */
export function strategyFromPlay(play: Play): Strategy {
  return {
    id: `strategy-${play.strategyId}-single`,
    designId: play.strategyId,
    player: play.isPositive ? "P" : "O",
    plays: [play],
    isInnocent: true, // Single play is trivially innocent
    satisfiesPropagation: true,
  };
}

/**
 * Merge multiple strategies (union of plays)
 */
export function mergeStrategies(strategies: Strategy[]): Strategy {
  if (strategies.length === 0) {
    throw new Error("Cannot merge empty strategy list");
  }

  const first = strategies[0];
  const seenSequences = new Set<string>();
  const mergedPlays: Play[] = [];

  for (const strategy of strategies) {
    if (strategy.player !== first.player) {
      throw new Error("Cannot merge strategies for different players");
    }

    for (const play of strategy.plays) {
      const seqKey = JSON.stringify(play.sequence);
      if (!seenSequences.has(seqKey)) {
        seenSequences.add(seqKey);
        mergedPlays.push({
          ...play,
          id: `merged-play-${mergedPlays.length}`,
        });
      }
    }
  }

  return {
    id: `strategy-merged-${first.designId}`,
    designId: first.designId,
    player: first.player,
    plays: mergedPlays,
    isInnocent: false, // Must be re-checked
    satisfiesPropagation: false,
  };
}

/**
 * Filter strategy to only positive-ended plays
 */
export function filterPositivePlays(strategy: Strategy): Strategy {
  return {
    ...strategy,
    id: `${strategy.id}-positive`,
    plays: strategy.plays.filter((p) => p.isPositive),
  };
}

/**
 * Filter strategy to only negative-ended plays
 */
export function filterNegativePlays(strategy: Strategy): Strategy {
  return {
    ...strategy,
    id: `${strategy.id}-negative`,
    plays: strategy.plays.filter((p) => !p.isPositive),
  };
}

/**
 * Get the longest plays in a strategy (maximal plays)
 */
export function getMaximalPlays(strategy: Strategy): Play[] {
  const plays = strategy.plays;
  const maximal: Play[] = [];

  for (const play of plays) {
    // Check if any other play properly extends this one
    const isExtended = plays.some(
      (other) =>
        other.id !== play.id &&
        other.length > play.length &&
        isPrefix(play.sequence, other.sequence)
    );

    if (!isExtended) {
      maximal.push(play);
    }
  }

  return maximal;
}

/**
 * Get the shortest plays in a strategy (minimal plays)
 */
export function getMinimalPlays(strategy: Strategy): Play[] {
  const plays = strategy.plays;
  const minimal: Play[] = [];

  for (const play of plays) {
    // Check if this play properly extends any other
    const extendsOther = plays.some(
      (other) =>
        other.id !== play.id &&
        play.length > other.length &&
        isPrefix(other.sequence, play.sequence)
    );

    if (!extendsOther) {
      minimal.push(play);
    }
  }

  return minimal;
}

/**
 * Check if seq1 is a prefix of seq2
 */
function isPrefix(seq1: Action[], seq2: Action[]): boolean {
  if (seq1.length > seq2.length) return false;

  for (let i = 0; i < seq1.length; i++) {
    if (!actionsEqual(seq1[i], seq2[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two actions are equal
 */
function actionsEqual(a1: Action, a2: Action): boolean {
  return (
    a1.focus === a2.focus &&
    a1.polarity === a2.polarity &&
    JSON.stringify(a1.ramification.sort()) ===
      JSON.stringify(a2.ramification.sort())
  );
}

/**
 * Compute strategy statistics
 */
export function computeStrategyStats(strategy: Strategy): {
  playCount: number;
  maxLength: number;
  minLength: number;
  avgLength: number;
  positivePlayCount: number;
  negativePlayCount: number;
  uniqueLoci: number;
} {
  const plays = strategy.plays;
  
  if (plays.length === 0) {
    return {
      playCount: 0,
      maxLength: 0,
      minLength: 0,
      avgLength: 0,
      positivePlayCount: 0,
      negativePlayCount: 0,
      uniqueLoci: 0,
    };
  }

  const lengths = plays.map((p) => p.length);
  const lociSet = new Set<string>();

  for (const play of plays) {
    for (const action of play.sequence) {
      lociSet.add(action.focus);
    }
  }

  return {
    playCount: plays.length,
    maxLength: Math.max(...lengths),
    minLength: Math.min(...lengths),
    avgLength: lengths.reduce((a, b) => a + b, 0) / lengths.length,
    positivePlayCount: plays.filter((p) => p.isPositive).length,
    negativePlayCount: plays.filter((p) => !p.isPositive).length,
    uniqueLoci: lociSet.size,
  };
}
