/**
 * Ch(S) Operation
 * 
 * Based on Faggian & Hyland (2002) - Proposition 4.27
 * Extract all chronicles from strategy S
 */

import type { Action, Chronicle, Position } from "../types";
import type { Strategy, Play } from "../strategy/types";
import type { ChResult } from "./types";
import { extractView } from "../views";

/**
 * Compute Ch(S) - extract all chronicles from strategy S
 * For innocent strategies, chronicles correspond to branches
 */
export function computeCh(strategy: Strategy): ChResult {
  const chronicles: Chronicle[] = [];
  const seen = new Set<string>();

  // For each play in strategy
  for (const play of strategy.plays) {
    // Extract all chronicles from this play
    const playChronicles = extractChroniclesFromPlay(play, strategy.player);

    // Add to collection (deduplicate)
    for (const chronicle of playChronicles) {
      const key = chronicleToKey(chronicle);
      if (!seen.has(key)) {
        seen.add(key);
        chronicles.push(chronicle);
      }
    }
  }

  return {
    strategyId: strategy.id,
    chronicles,
    count: chronicles.length,
    computedAt: new Date(),
  };
}

/**
 * Optimized Ch(S) for innocent strategies
 * For innocent strategies, chronicles = branches (simpler computation)
 */
export function computeChOptimized(strategy: Strategy): ChResult {
  if (!strategy.isInnocent) {
    return computeCh(strategy); // Fall back to general algorithm
  }

  // For innocent strategies, use branch structure
  const branches = extractBranches(strategy);

  const chronicles: Chronicle[] = branches.map((branch, idx) => ({
    id: `chronicle-${strategy.id}-${idx}`,
    designId: strategy.designId,
    actions: branch,
    polarity: strategy.player,
    isPositive: branch.length > 0 && branch[branch.length - 1].polarity === strategy.player,
  }));

  return {
    strategyId: strategy.id,
    chronicles,
    count: chronicles.length,
    computedAt: new Date(),
  };
}

/**
 * Extract chronicles from a single play
 * Uses depth-based polarity: odd depth = P, even depth = O
 */
function extractChroniclesFromPlay(play: Play, player: "P" | "O"): Chronicle[] {
  const chronicles: Chronicle[] = [];

  // For each prefix of the play, extract the view
  for (let i = 1; i <= play.sequence.length; i++) {
    const prefix = play.sequence.slice(0, i);
    
    // Determine current player based on last action's depth
    const lastAction = prefix[prefix.length - 1];
    const lastDepth = lastAction.focus.split(".").length;
    const lastPolarity: "P" | "O" = lastDepth % 2 === 1 ? "P" : "O";
    
    const position: Position = {
      id: `${play.id}-prefix-${i}`,
      sequence: prefix,
      player: lastPolarity === "P" ? "O" : "P", // Next player is opposite of last
      isLinear: true,
      isLegal: true,
    };

    // Extract view at this position
    const view = extractView(position, player);

    // View forms a chronicle
    if (view.length > 0) {
      // Determine if chronicle is positive (ends on player's own move)
      const tipAction = view[view.length - 1];
      const tipDepth = tipAction.focus.split(".").length;
      const tipPolarity: "P" | "O" = tipDepth % 2 === 1 ? "P" : "O";
      
      chronicles.push({
        id: `chronicle-${play.id}-${i}`,
        designId: play.strategyId,
        actions: view,
        polarity: player,
        isPositive: tipPolarity === player,
      });
    }
  }

  return chronicles;
}

/**
 * Extract branches (maximal plays) from innocent strategy
 */
function extractBranches(strategy: Strategy): Action[][] {
  // Find all maximal plays (not proper prefixes of others)
  const maximalPlays = strategy.plays.filter(p1 => {
    return !strategy.plays.some(p2 => {
      if (p1.id === p2.id) return false;
      return isProperPrefix(p1.sequence, p2.sequence);
    });
  });

  return maximalPlays.map(p => p.sequence);
}

/**
 * Check if seq1 is proper prefix of seq2
 */
function isProperPrefix(seq1: Action[], seq2: Action[]): boolean {
  if (seq1.length >= seq2.length) return false;
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
    JSON.stringify(a1.ramification) === JSON.stringify(a2.ramification)
  );
}

/**
 * Create unique key for chronicle
 */
function chronicleToKey(chronicle: Chronicle): string {
  return JSON.stringify({
    focus: chronicle.actions.map(a => a.focus),
    polarity: chronicle.polarity,
    ramifications: chronicle.actions.map(a => a.ramification),
  });
}

/**
 * Convert chronicles back to design acts
 * In Faggian-Hyland: polarity is determined by locus depth
 * Odd depth (1, 3, 5...) = P, Even depth (2, 4, 6...) = O
 * 
 * @param chronicles - The chronicles to convert
 * @param designId - The design ID (unused, kept for compatibility)
 * @param filterToPlayer - If provided, only include acts matching this player's polarity
 */
export function chroniclesToActs(
  chronicles: Chronicle[],
  designId: string,
  filterToPlayer?: "P" | "O"
): { locusPath: string; polarity: "P" | "O"; ramification: number[] }[] {
  const actsMap = new Map<string, { polarity: "P" | "O"; ramification: number[] }>();

  for (const chronicle of chronicles) {
    for (const action of chronicle.actions) {
      // Determine polarity from depth (Faggian-Hyland semantics)
      const depth = action.focus.split(".").length;
      const depthPolarity: "P" | "O" = depth % 2 === 1 ? "P" : "O";
      
      // If filtering to a specific player, skip acts that don't match
      if (filterToPlayer && depthPolarity !== filterToPlayer) {
        continue;
      }
      
      const existing = actsMap.get(action.focus);
      
      if (!existing) {
        actsMap.set(action.focus, {
          polarity: depthPolarity,
          ramification: [...action.ramification],
        });
      } else {
        // Merge ramifications
        for (const r of action.ramification) {
          if (!existing.ramification.includes(r)) {
            existing.ramification.push(r);
          }
        }
      }
    }
  }

  return Array.from(actsMap.entries()).map(([locusPath, data]) => ({
    locusPath,
    polarity: data.polarity,
    ramification: data.ramification.sort((a, b) => a - b),
  }));
}

/**
 * Get all terminal actions (end of chronicles)
 */
export function getTerminalActions(chronicles: Chronicle[]): Action[] {
  const terminals: Action[] = [];
  const seen = new Set<string>();

  for (const chronicle of chronicles) {
    if (chronicle.actions.length > 0) {
      const terminal = chronicle.actions[chronicle.actions.length - 1];
      const key = `${terminal.focus}-${terminal.polarity}`;
      if (!seen.has(key)) {
        seen.add(key);
        terminals.push(terminal);
      }
    }
  }

  return terminals;
}

/**
 * Group chronicles by their terminal focus
 */
export function groupChroniclesByTerminal(
  chronicles: Chronicle[]
): Map<string, Chronicle[]> {
  const groups = new Map<string, Chronicle[]>();

  for (const chronicle of chronicles) {
    if (chronicle.actions.length === 0) continue;
    
    const terminal = chronicle.actions[chronicle.actions.length - 1];
    const key = terminal.focus;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(chronicle);
  }

  return groups;
}

/**
 * Compute chronicle depth (longest path)
 */
export function computeChronicleDepth(chronicle: Chronicle): number {
  let maxDepth = 0;
  for (const action of chronicle.actions) {
    const depth = action.focus.split(".").length;
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }
  return maxDepth;
}

/**
 * Count unique loci in chronicles
 */
export function countUniqueLoci(chronicles: Chronicle[]): number {
  const loci = new Set<string>();
  for (const chronicle of chronicles) {
    for (const action of chronicle.actions) {
      loci.add(action.focus);
    }
  }
  return loci.size;
}
