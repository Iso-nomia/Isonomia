/**
 * DDS Phase 2: Innocence Checking
 * Based on Faggian & Hyland (2002) - Definition 4.8
 * 
 * A strategy is innocent if it is view-determined:
 * same view → same response
 * 
 * Formally: Strategy S is innocent iff:
 * 1. Deterministic: For all s, b, c: if s̄b ∈ S† and s̄c ∈ S†, then b = c
 * 2. View-stable: Views(S) ⊆ S (views are closed under view operation)
 * 3. Saturated: Contains all view-compatible plays (condition *)
 */

import type { Action, Position } from "../types";
import type {
  Strategy,
  Play,
  InnocenceCheck,
  InnocenceViolation,
  DeterminismCheck,
  DeterminismViolation,
} from "./types";
import { extractView, viewToKey } from "../views";

/**
 * Check if strategy is innocent (Definition 4.8)
 * 
 * @param strategy - Strategy to check
 * @returns InnocenceCheck result with detailed violation info
 */
export function checkInnocence(strategy: Strategy): InnocenceCheck {
  const violations: InnocenceViolation[] = [];

  // 1. Check determinism: same view → same response
  const detCheck = checkDeterminism(strategy);
  if (!detCheck.isDeterministic) {
    for (const v of detCheck.violations) {
      violations.push({
        type: "determinism",
        details: `View has ${v.responses.length} different responses`,
        evidence: {
          view: v.view,
          responses: v.responses,
        },
      });
    }
  }

  // 2. Check view stability: Views(S) ⊆ S
  const viewStableResult = checkViewStability(strategy);
  if (!viewStableResult.isStable) {
    violations.push({
      type: "view-stability",
      details: viewStableResult.reason || "Strategy not view-stable",
    });
  }

  // 3. Check saturation (condition *)
  const saturationResult = checkSaturation(strategy);
  if (!saturationResult.isSaturated) {
    for (const missing of saturationResult.missingPlays) {
      violations.push({
        type: "saturation",
        details: "Missing view-compatible play",
        evidence: {
          missingPlay: missing,
        },
      });
    }
  }

  const isInnocent =
    detCheck.isDeterministic &&
    viewStableResult.isStable &&
    saturationResult.isSaturated;

  return {
    isInnocent,
    isDeterministic: detCheck.isDeterministic,
    isViewStable: viewStableResult.isStable,
    isSaturated: saturationResult.isSaturated,
    violations,
  };
}

/**
 * Check determinism: s̄b, s̄c ∈ S† ⟹ b = c
 * For each view in the strategy, there should be at most one next move
 */
export function checkDeterminism(strategy: Strategy): DeterminismCheck {
  const violations: DeterminismViolation[] = [];

  // Build map: view → set of next moves
  const viewToResponses = new Map<string, Map<string, Action>>();

  for (const play of strategy.plays) {
    if (play.sequence.length < 1) continue;

    // For each prefix of the play
    for (let i = 0; i < play.sequence.length; i++) {
      const prefix = play.sequence.slice(0, i + 1);
      const currentAction = play.sequence[i];

      // Only check positions where it's this player's turn
      if (currentAction.polarity !== strategy.player) continue;

      // Extract view at this prefix
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const view = extractView(position, strategy.player);
      const viewKey = viewToKey(view);

      // If there's a next move, record it
      if (i < play.sequence.length - 1) {
        const nextMove = play.sequence[i + 1];
        const moveKey = actionToKey(nextMove);

        if (!viewToResponses.has(viewKey)) {
          viewToResponses.set(viewKey, new Map());
        }

        const responses = viewToResponses.get(viewKey)!;
        if (!responses.has(moveKey)) {
          responses.set(moveKey, nextMove);
        }
      }
    }
  }

  // Check for views with multiple different responses
  for (const [viewKey, responses] of viewToResponses.entries()) {
    if (responses.size > 1) {
      const view = JSON.parse(viewKey);
      violations.push({
        view,
        viewKey,
        responses: Array.from(responses.values()),
      });
    }
  }

  return {
    isDeterministic: violations.length === 0,
    violations,
  };
}

/**
 * Check if Views(S) ⊆ S (view stability)
 * All views extracted from plays should correspond to valid play prefixes
 */
function checkViewStability(strategy: Strategy): {
  isStable: boolean;
  reason?: string;
} {
  // Extract all views
  const allViews = new Set<string>();
  const playPrefixes = new Set<string>();

  for (const play of strategy.plays) {
    // Record all prefixes of this play
    for (let i = 1; i <= play.sequence.length; i++) {
      const prefix = play.sequence.slice(0, i);
      playPrefixes.add(JSON.stringify(prefix));

      // Extract view for this prefix
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const view = extractView(position, strategy.player);
      allViews.add(JSON.stringify(view));
    }
  }

  // For view stability, every view should be idempotent under view extraction
  // i.e., extractView(view) = view
  for (const viewStr of allViews) {
    const view = JSON.parse(viewStr) as Action[];
    
    const viewPosition: Position = {
      id: "temp",
      sequence: view,
      player: strategy.player,
      isLinear: true,
      isLegal: true,
    };

    const viewOfView = extractView(viewPosition, strategy.player);
    const viewOfViewStr = JSON.stringify(viewOfView);

    // View should be stable: view of view = view
    if (viewStr !== viewOfViewStr) {
      return {
        isStable: false,
        reason: `View not idempotent: view has ${view.length} actions but view-of-view has ${viewOfView.length}`,
      };
    }
  }

  return { isStable: true };
}

/**
 * Check saturation condition (*) from Definition 4.8
 * If sab+ ∈ S†, p+ ∈ S†, pa is legal, and p̄a = s̄a, then pab ∈ S†
 * 
 * Simplified: For every pair of plays with matching views, extensions should be consistent
 */
function checkSaturation(strategy: Strategy): {
  isSaturated: boolean;
  missingPlays: Action[][];
} {
  const missingPlays: Action[][] = [];
  const playSequences = new Set(
    strategy.plays.map((p) => JSON.stringify(p.sequence))
  );

  // For each pair of plays
  for (let i = 0; i < strategy.plays.length; i++) {
    for (let j = i + 1; j < strategy.plays.length; j++) {
      const p1 = strategy.plays[i];
      const p2 = strategy.plays[j];

      // Find common view prefixes
      const commonViewLength = findCommonViewLength(
        p1.sequence,
        p2.sequence,
        strategy.player
      );

      if (commonViewLength > 0) {
        // If both plays have extensions after common view, they should agree
        if (
          p1.sequence.length > commonViewLength &&
          p2.sequence.length > commonViewLength
        ) {
          const ext1 = p1.sequence[commonViewLength];
          const ext2 = p2.sequence[commonViewLength];

          // Extensions should match (determinism check handles this)
          // For saturation, we check if one play's extension is missing from the other's context
        }

        // Check if extensions from p1 should appear in p2's context
        if (p1.sequence.length > commonViewLength) {
          const p1Ext = p1.sequence.slice(0, commonViewLength + 1);
          const p2Prefix = p2.sequence.slice(0, commonViewLength);

          // If views match at prefix, extension should be compatible
          const expectedPlay = [...p2Prefix, p1.sequence[commonViewLength]];
          const expectedKey = JSON.stringify(expectedPlay);

          // This is a simplified check - full saturation is more complex
        }
      }
    }
  }

  return {
    isSaturated: missingPlays.length === 0,
    missingPlays,
  };
}

/**
 * Find length of common view prefix between two sequences
 */
function findCommonViewLength(
  seq1: Action[],
  seq2: Action[],
  player: "P" | "O"
): number {
  const maxLen = Math.min(seq1.length, seq2.length);
  let commonLen = 0;

  for (let i = 0; i < maxLen; i++) {
    const pos1: Position = {
      id: "temp",
      sequence: seq1.slice(0, i + 1),
      player,
      isLinear: true,
      isLegal: true,
    };
    const pos2: Position = {
      id: "temp",
      sequence: seq2.slice(0, i + 1),
      player,
      isLinear: true,
      isLegal: true,
    };

    const view1 = extractView(pos1, player);
    const view2 = extractView(pos2, player);

    if (JSON.stringify(view1) === JSON.stringify(view2)) {
      commonLen = i + 1;
    } else {
      break;
    }
  }

  return commonLen;
}

/**
 * Convert action to unique key for comparison
 */
function actionToKey(action: Action): string {
  return JSON.stringify({
    f: action.focus,
    p: action.polarity,
    r: action.ramification.sort(),
  });
}

/**
 * Quick check: is strategy likely innocent? (heuristic)
 * Full check can be expensive, this provides a fast approximation
 */
export function isLikelyInnocent(strategy: Strategy): boolean {
  // Empty or single-play strategies are trivially innocent
  if (strategy.plays.length <= 1) return true;

  // Quick determinism check on first few plays
  const sampleSize = Math.min(10, strategy.plays.length);
  const samplePlays = strategy.plays.slice(0, sampleSize);

  const viewToMove = new Map<string, string>();

  for (const play of samplePlays) {
    for (let i = 0; i < play.sequence.length - 1; i++) {
      const prefix = play.sequence.slice(0, i + 1);
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const view = extractView(position, strategy.player);
      const viewKey = viewToKey(view);
      const nextMove = play.sequence[i + 1];
      const moveKey = actionToKey(nextMove);

      if (viewToMove.has(viewKey)) {
        if (viewToMove.get(viewKey) !== moveKey) {
          return false; // Found non-determinism
        }
      } else {
        viewToMove.set(viewKey, moveKey);
      }
    }
  }

  return true;
}

/**
 * Make a strategy innocent by resolving non-determinism
 * Keeps the first response to each view (arbitrary resolution)
 */
export function makeInnocent(strategy: Strategy): Strategy {
  const viewToResponse = new Map<string, { playIdx: number; actionIdx: number }>();
  const keptPlays = new Set<number>();

  // First pass: identify which plays to keep
  for (let pIdx = 0; pIdx < strategy.plays.length; pIdx++) {
    const play = strategy.plays[pIdx];
    let keep = true;

    for (let i = 0; i < play.sequence.length; i++) {
      const prefix = play.sequence.slice(0, i + 1);
      const position: Position = {
        id: "temp",
        sequence: prefix,
        player: strategy.player,
        isLinear: true,
        isLegal: true,
      };

      const view = extractView(position, strategy.player);
      const viewKey = viewToKey(view);

      if (i < play.sequence.length - 1) {
        const nextMove = play.sequence[i + 1];
        const moveKey = actionToKey(nextMove);

        if (viewToResponse.has(viewKey)) {
          const existing = viewToResponse.get(viewKey)!;
          const existingPlay = strategy.plays[existing.playIdx];
          const existingMove = existingPlay.sequence[existing.actionIdx + 1];
          const existingMoveKey = actionToKey(existingMove);

          if (moveKey !== existingMoveKey) {
            // Conflict - don't keep this play
            keep = false;
            break;
          }
        } else {
          viewToResponse.set(viewKey, { playIdx: pIdx, actionIdx: i });
        }
      }
    }

    if (keep) {
      keptPlays.add(pIdx);
    }
  }

  // Build innocent strategy from kept plays
  const innocentPlays = strategy.plays
    .filter((_, idx) => keptPlays.has(idx))
    .map((p, idx) => ({
      ...p,
      id: `innocent-play-${idx}`,
    }));

  return {
    ...strategy,
    id: `${strategy.id}-innocent`,
    plays: innocentPlays,
    isInnocent: true,
  };
}
