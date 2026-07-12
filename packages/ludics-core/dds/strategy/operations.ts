/**
 * DDS Phase 2: Views(S) and Plays(V) Operations
 * Based on Faggian & Hyland (2002) - Definitions 4.10 and 4.11
 * 
 * Views(S): Extract all player views from a strategy
 * Plays(V): Generate smallest innocent strategy containing a view set V
 * 
 * These operations establish the fundamental correspondence between
 * strategies and views, which underlies the Design ↔ Strategy isomorphism.
 */

import type { Action, Position, View } from "../types";
import type { Strategy, Play, ViewsResult, PlaysResult } from "./types";
import { extractView, viewToKey, isViewPrefix } from "../views";

// Debug logging
const DEBUG_OPERATIONS = true;
function logOp(label: string, ...args: any[]) {
  if (DEBUG_OPERATIONS) {
    console.log(`[OPS] ${label}`, ...args);
  }
}

/**
 * Views(S) - Extract all views from strategy (Definition 4.10)
 * 
 * For each prefix of each play, extract the player's view.
 * Returns the set of all unique views in the strategy.
 * 
 * @param strategy - Strategy to extract views from
 * @returns ViewsResult with all unique views
 */
export function computeViews(strategy: Strategy): ViewsResult {
  logOp("computeViews called:", { playCount: strategy.plays.length, player: strategy.player });
  
  const viewsSet = new Set<string>();
  const views: View[] = [];

  for (const play of strategy.plays) {
    for (let i = 1; i <= play.sequence.length; i++) {
      const prefix = play.sequence.slice(0, i);
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const viewSeq = extractView(position, strategy.player);
      const viewKey = viewToKey(viewSeq);

      if (!viewsSet.has(viewKey)) {
        viewsSet.add(viewKey);
        views.push({
          id: `view-${views.length}`,
          player: strategy.player,
          sequence: viewSeq,
          designId: strategy.designId,
        });
      }
    }
  }
  
  logOp("computeViews result:", { uniqueViews: views.length });

  // Check view stability: p̄ = p for all views
  // A view is stable if extracting view from it returns itself
  let isStable = true;
  for (const view of views) {
    const viewPosition: Position = {
      id: "temp",
      sequence: view.sequence,
      player: strategy.player,
      isLinear: true,
      isLegal: true,
    };

    const viewOfView = extractView(viewPosition, strategy.player);

    if (JSON.stringify(view.sequence) !== JSON.stringify(viewOfView)) {
      isStable = false;
      break;
    }
  }

  return {
    strategyId: strategy.id,
    views,
    viewCount: views.length,
    isStable,
  };
}

/**
 * Plays(V) - Generate plays from views (Definition 4.11)
 * Returns the smallest innocent strategy containing view set V.
 * 
 * Construction:
 * P₀(V) = {p ∈ V : p is minimal for ⊑}
 * Pₙ₊₁(V) = Pₙ(V) ∪ {pab : p ∈ Pₙ(V), ∃cab ∈ V, p̄a = c̄a, pa is legal}
 * Plays(V) = ⋃ₙ Pₙ(V)
 * 
 * @param views - View set to generate plays from
 * @param options - Optional configuration
 * @returns PlaysResult with generated plays
 */
export function computePlays(
  views: View[],
  options: { maxIterations?: number; maxPlays?: number } = {}
): PlaysResult {
  logOp("computePlays called:", { viewCount: views.length });
  
  const maxIterations = options.maxIterations ?? 100;
  const maxPlays = options.maxPlays ?? 10000;

  if (views.length === 0) {
    logOp("computePlays: empty views, returning empty");
    return {
      plays: [],
      playCount: 0,
      isSmallest: true,
      iterations: 0,
    };
  }

  const player = views[0].player;
  const designId = views[0].designId;

  // P₀(V) = minimal views (not proper prefixes of other views)
  const minimalViews = findMinimalViews(views);
  logOp("computePlays: minimal views (P₀):", minimalViews.length);

  const plays: Play[] = minimalViews.map((view, idx) => ({
    id: `play-${idx}`,
    strategyId: designId,
    sequence: view.sequence,
    length: view.sequence.length,
    isPositive:
      view.sequence.length > 0 &&
      view.sequence[view.sequence.length - 1].polarity === player,
    view,
  }));

  const playSequences = new Set(plays.map((p) => JSON.stringify(p.sequence)));
  logOp("computePlays: initial plays from minimal views:", plays.length);

  // Iteratively extend plays: Pₙ₊₁(V) = Pₙ(V) ∪ extensions
  let iterations = 0;
  let prevSize = 0;

  while (plays.length > prevSize && iterations < maxIterations && plays.length < maxPlays) {
    prevSize = plays.length;
    iterations++;

    const newPlays: Play[] = [];

    // Try to extend each existing play
    for (const play of plays) {
      // Find views that can extend this play
      for (const view of views) {
        const extension = tryExtendPlay(play, view, player);
        if (extension) {
          const seqKey = JSON.stringify(extension.sequence);
          if (!playSequences.has(seqKey)) {
            playSequences.add(seqKey);
            newPlays.push({
              ...extension,
              id: `play-${plays.length + newPlays.length}`,
              strategyId: designId,
            });

            if (plays.length + newPlays.length >= maxPlays) break;
          }
        }
      }
      if (plays.length + newPlays.length >= maxPlays) break;
    }

    plays.push(...newPlays);
    logOp(`computePlays: iteration ${iterations}, added ${newPlays.length} plays, total: ${plays.length}`);
  }

  logOp("computePlays result:", { totalPlays: plays.length, iterations });

  return {
    plays,
    playCount: plays.length,
    isSmallest: true, // By construction, this is the minimal closure
    iterations,
  };
}

/**
 * Find minimal views (views that are not proper EXTENSIONS of other views)
 * These are the "starting points" - shortest views in prefix chains
 * 
 * A view v is minimal if there's no other view that is a proper prefix of v.
 * i.e., v is minimal if it's not an extension of anything else.
 */
function findMinimalViews(views: View[]): View[] {
  const minimal = views.filter((v1) => {
    // v1 is minimal if no other view v2 is a proper prefix of v1
    const hasShorterPrefix = views.some((v2) => {
      if (v1.id === v2.id) return false;
      // Check if v2 is a proper prefix of v1 (v2 is shorter and v1 extends it)
      return isProperPrefix(v2.sequence, v1.sequence);
    });
    return !hasShorterPrefix;
  });
  
  logOp("findMinimalViews:", {
    totalViews: views.length,
    minimalCount: minimal.length,
    minimalLengths: minimal.map(v => v.sequence.length),
  });
  
  return minimal;
}

/**
 * Check if seq1 is a proper prefix of seq2
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
 * Try to extend a play using a view
 * Returns extended play if possible, null otherwise
 */
function tryExtendPlay(
  play: Play,
  view: View,
  player: "P" | "O"
): Play | null {
  // View must be longer than play
  if (view.sequence.length <= play.sequence.length) return null;

  // Extract view from play
  const playPosition: Position = {
    id: "temp",
    sequence: play.sequence,
    player,
    isLinear: true,
    isLegal: true,
  };
  const playView = extractView(playPosition, player);

  // Views must match up to play length (p̄a = c̄a condition)
  if (!viewsMatch(playView, view.sequence.slice(0, playView.length))) {
    return null;
  }

  // Get the extension action
  const nextAction = view.sequence[play.sequence.length];
  if (!nextAction) return null;

  // Build extended sequence
  const extendedSequence = [...play.sequence, nextAction];

  return {
    id: "temp",
    strategyId: play.strategyId,
    sequence: extendedSequence,
    length: extendedSequence.length,
    isPositive: nextAction.polarity === player,
    view,
  };
}

/**
 * Check if two view sequences match
 */
function viewsMatch(v1: Action[], v2: Action[]): boolean {
  if (v1.length !== v2.length) return false;

  for (let i = 0; i < v1.length; i++) {
    if (!actionsEqual(v1[i], v2[i])) {
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
 * Verify Plays(Views(S)) = S for innocent strategies
 * This is part of the isomorphism between innocent strategies and view sets
 */
export function verifyPlaysViewsIdentity(strategy: Strategy): {
  holds: boolean;
  originalPlayCount: number;
  reconstructedPlayCount: number;
  missingPlays: Play[];
  extraPlays: Play[];
} {
  // Compute Views(S)
  const viewsResult = computeViews(strategy);

  // Compute Plays(Views(S))
  const playsResult = computePlays(viewsResult.views);

  // Compare original plays with reconstructed plays
  const originalKeys = new Set(
    strategy.plays.map((p) => JSON.stringify(p.sequence))
  );
  const reconstructedKeys = new Set(
    playsResult.plays.map((p) => JSON.stringify(p.sequence))
  );

  const missingPlays: Play[] = [];
  const extraPlays: Play[] = [];

  // Find plays in original but not in reconstructed
  for (const play of strategy.plays) {
    const key = JSON.stringify(play.sequence);
    if (!reconstructedKeys.has(key)) {
      missingPlays.push(play);
    }
  }

  // Find plays in reconstructed but not in original
  for (const play of playsResult.plays) {
    const key = JSON.stringify(play.sequence);
    if (!originalKeys.has(key)) {
      extraPlays.push(play);
    }
  }

  return {
    holds: missingPlays.length === 0 && extraPlays.length === 0,
    originalPlayCount: strategy.plays.length,
    reconstructedPlayCount: playsResult.plays.length,
    missingPlays,
    extraPlays,
  };
}

/**
 * Verify Views(Plays(V)) = V for view-closed sets
 * This is the other half of the isomorphism
 */
export function verifyViewsPlaysIdentity(views: View[]): {
  holds: boolean;
  originalViewCount: number;
  reconstructedViewCount: number;
  missingViews: View[];
  extraViews: View[];
} {
  if (views.length === 0) {
    return {
      holds: true,
      originalViewCount: 0,
      reconstructedViewCount: 0,
      missingViews: [],
      extraViews: [],
    };
  }

  // Compute Plays(V)
  const playsResult = computePlays(views);

  // Build strategy from plays
  const player = views[0].player;
  const designId = views[0].designId;
  const tempStrategy: Strategy = {
    id: "temp",
    designId,
    player,
    plays: playsResult.plays,
    isInnocent: false,
    satisfiesPropagation: false,
  };

  // Compute Views(Plays(V))
  const viewsResult = computeViews(tempStrategy);

  // Compare
  const originalKeys = new Set(views.map((v) => viewToKey(v.sequence)));
  const reconstructedKeys = new Set(
    viewsResult.views.map((v) => viewToKey(v.sequence))
  );

  const missingViews: View[] = [];
  const extraViews: View[] = [];

  for (const view of views) {
    const key = viewToKey(view.sequence);
    if (!reconstructedKeys.has(key)) {
      missingViews.push(view);
    }
  }

  for (const view of viewsResult.views) {
    const key = viewToKey(view.sequence);
    if (!originalKeys.has(key)) {
      extraViews.push(view);
    }
  }

  return {
    holds: missingViews.length === 0 && extraViews.length === 0,
    originalViewCount: views.length,
    reconstructedViewCount: viewsResult.viewCount,
    missingViews,
    extraViews,
  };
}
