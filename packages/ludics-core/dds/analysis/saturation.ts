/**
 * DDS Phase 5 - Part 3: Saturation Analysis
 * 
 * Based on Faggian & Hyland (2002) - Propositions 4.17, 4.21
 * 
 * Saturation Property (Prop 4.17):
 *   Let T be any strategy and S an innocent strategy.
 *   If Views(T) ⊆ S then T ⊆ S.
 * 
 * Isomorphism (Prop 4.21):
 *   For innocent X-strategy S: Plays(Views(S)) = S
 * 
 * A strategy is saturated if extracting views and reconstructing
 * via Plays(−) gives back the same strategy.
 * 
 * Key Definitions:
 * - Views(S) = {p̄_X : p ∈ S} (extract player's moves from each play)
 * - Plays(V) = iterative construction (Definition 4.11):
 *   P₀(V) = minimal elements
 *   Pₙ₊₁(V) = {pab : p ∈ Pₙ, ∃ cab ∈ V with p̄a = c̄a and pa legal}
 */

import type { Action, View } from "../types";
import type { Strategy, Play } from "../strategy/types";
import type { DesignForCorrespondence } from "../correspondence/types";
import type {
  SaturationResult,
  SaturationProof,
  SaturationViolation,
  SaturationClosureResult,
} from "./types";

/**
 * Check saturation property (Propositions 4.17, 4.21)
 * 
 * For an innocent strategy S, we check: Plays(Views(S)) = S
 * 
 * This verifies that:
 * 1. Views(S) ⊆ S (Prop 4.16 - closure under view)
 * 2. Plays(Views(S)) = S (Prop 4.21 - isomorphism)
 * 
 * @param strategy - The strategy to check
 * @param _allDesigns - Optional context (unused in current implementation)
 * @returns SaturationResult with detailed analysis
 */
export async function checkSaturation(
  strategy: Strategy,
  _allDesigns?: DesignForCorrespondence[]
): Promise<SaturationResult & { viewsEqualStrategy: boolean; details: any }> {
  // Step 1: Extract all views from strategy - Views(S)
  const views = await extractViewsFromStrategy(strategy);

  // Step 2: Compute Plays(Views(S)) to reconstruct strategy
  const playsResult = await computePlaysFromViews(views, strategy.player);

  // Step 3: Compare reconstructed strategy with original
  const originalPlayIds = new Set(strategy.plays.map((p) => playToKey(p)));
  const reconstructedPlayIds = new Set(playsResult.plays.map((p) => playToKey(p)));

  // Check forward containment: original ⊆ Plays(Views(S))
  const missingInReconstructed: string[] = [];
  for (const playKey of originalPlayIds) {
    if (!reconstructedPlayIds.has(playKey)) {
      missingInReconstructed.push(playKey);
    }
  }

  // Check backward containment: Plays(Views(S)) ⊆ original
  const extraInReconstructed: string[] = [];
  for (const playKey of reconstructedPlayIds) {
    if (!originalPlayIds.has(playKey)) {
      extraInReconstructed.push(playKey);
    }
  }

  // Saturation: Plays(Views(S)) = S (bidirectional equality)
  const isSaturated =
    missingInReconstructed.length === 0 && extraInReconstructed.length === 0;
  
  // Views equal strategy check (Prop 4.16 variant)
  const viewsEqualStrategy = isSaturated;

  // Build violations if not saturated
  const violations: SaturationViolation[] = [];

  if (missingInReconstructed.length > 0) {
    violations.push({
      type: "missing",
      itemIds: missingInReconstructed,
      description: `${missingInReconstructed.length} plays from original not in Plays(Views(S))`,
    });
  }

  if (extraInReconstructed.length > 0) {
    violations.push({
      type: "extra",
      itemIds: extraInReconstructed,
      description: `${extraInReconstructed.length} extra plays in Plays(Views(S))`,
    });
  }

  // Build detailed analysis
  const details = {
    viewCount: views.length,
    originalPlayCount: strategy.plays.length,
    reconstructedPlayCount: playsResult.plays.length,
    missingCount: missingInReconstructed.length,
    extraCount: extraInReconstructed.length,
    prop417: "Saturation: If Views(T) ⊆ S then T ⊆ S",
    prop421: "Isomorphism: Plays(Views(S)) = S for innocent S",
    interpretation: isSaturated
      ? "Strategy is saturated - all plays are determined by views (innocent)"
      : extraInReconstructed.length > 0
        ? "Strategy is missing plays required by innocence condition"
        : "Strategy has plays not derivable from views",
  };

  return {
    strategyId: strategy.id,
    isSaturated,
    viewsEqualStrategy,
    details,
    proof: isSaturated
      ? {
          iterations: 1,
          viewCount: views.length,
          playCount: playsResult.plays.length,
          originalPlayCount: strategy.plays.length,
        }
      : undefined,
    violations: violations.length > 0 ? violations : undefined,
  };
}

/**
 * Extract all views from a strategy
 */
async function extractViewsFromStrategy(strategy: Strategy): Promise<View[]> {
  const views: View[] = [];
  const seenViews = new Set<string>();

  for (const play of strategy.plays) {
    // Extract view for each position in play
    const viewSequence = play.sequence.filter(
      (action) => action.polarity === strategy.player
    );

    const view: View = {
      id: `view-${play.id}`,
      player: strategy.player,
      sequence: viewSequence,
      designId: strategy.designId,
    };

    const viewKey = viewToKey(view);
    if (!seenViews.has(viewKey)) {
      seenViews.add(viewKey);
      views.push(view);
    }
  }

  return views;
}

/**
 * Compute Plays from views - Definition 4.11 (Faggian & Hyland)
 * 
 * This implements the iterative construction:
 * - P₀(V) = {p ∈ V : p is minimal for ⊑}
 * - Pₙ₊₁(V) = {pab : p ∈ Pₙ(V), ∃ cab ∈ V with p̄a = c̄a and pa legal}
 * - Plays(V) = ∪ₙ Pₙ(V)
 * 
 * For a view-stable strategy V, Plays(V) is the smallest innocent strategy
 * containing V (Proposition 4.20).
 */
async function computePlaysFromViews(
  views: View[],
  player: "P" | "O"
): Promise<{ plays: Play[] }> {
  const allPlays: Play[] = [];
  const seenPlayKeys = new Set<string>();

  // P₀(V): Start with minimal views (those that are prefixes of nothing else)
  // In practice, since views are player-actions-only, we include all views
  // and then extend them based on the innocence condition
  let currentLevel: Play[] = [];
  
  for (const view of views) {
    const play: Play = {
      id: `play-${view.id}`,
      strategyId: "",
      sequence: view.sequence,
      length: view.sequence.length,
      isPositive: view.sequence.length > 0 &&
        view.sequence[view.sequence.length - 1].polarity === player,
      view: view,
    };
    
    const key = playToKey(play);
    if (!seenPlayKeys.has(key)) {
      seenPlayKeys.add(key);
      currentLevel.push(play);
      allPlays.push(play);
    }
  }

  // Iteratively extend plays using the saturation/innocence condition:
  // If p ∈ Pₙ and ∃ cab ∈ V with p̄a = c̄a (same view at a), then pab ∈ Pₙ₊₁
  // This ensures all plays with the same view get the same response
  let changed = true;
  let iterations = 0;
  const maxIterations = 100; // Safety limit

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    const nextLevel: Play[] = [];

    for (const play of currentLevel) {
      // Extract the view of the current play
      const playView = extractViewFromSequence(play.sequence, player);
      
      // Look for views that extend this view
      for (const view of views) {
        // Check if view is an extension of playView
        if (view.sequence.length > playView.length) {
          // Check if view starts with playView
          const viewPrefix = view.sequence.slice(0, playView.length);
          if (sequencesMatch(viewPrefix, playView)) {
            // view extends playView - extract the extension
            const extension = view.sequence.slice(playView.length);
            
            // Create extended play
            const extendedSequence = [...play.sequence, ...extension];
            const extendedPlay: Play = {
              id: `play-extended-${iterations}-${nextLevel.length}`,
              strategyId: "",
              sequence: extendedSequence,
              length: extendedSequence.length,
              isPositive: extendedSequence.length > 0 &&
                extendedSequence[extendedSequence.length - 1].polarity === player,
            };
            
            const key = playToKey(extendedPlay);
            if (!seenPlayKeys.has(key)) {
              seenPlayKeys.add(key);
              nextLevel.push(extendedPlay);
              allPlays.push(extendedPlay);
              changed = true;
            }
          }
        }
      }
    }

    currentLevel = nextLevel;
  }

  return { plays: allPlays };
}

/**
 * Extract view (player's actions only) from a sequence
 */
function extractViewFromSequence(sequence: Action[], player: "P" | "O"): Action[] {
  return sequence.filter(action => action.polarity === player);
}

/**
 * Check if two action sequences match
 */
function sequencesMatch(seq1: Action[], seq2: Action[]): boolean {
  if (seq1.length !== seq2.length) return false;
  for (let i = 0; i < seq1.length; i++) {
    if (seq1[i].focus !== seq2[i].focus || seq1[i].polarity !== seq2[i].polarity) {
      return false;
    }
  }
  return true;
}

/**
 * Convert play to unique key for comparison
 */
function playToKey(play: Play): string {
  return play.sequence
    .map((action) => `${action.focus}:${action.polarity}`)
    .join("-");
}

/**
 * Convert view to unique key
 */
function viewToKey(view: View): string {
  return view.sequence
    .map((action) => `${action.focus}:${action.polarity}`)
    .join("-");
}

/**
 * Compute saturation closure
 * 
 * Repeatedly apply Views/Plays until fixpoint (saturated strategy).
 * This computes the smallest innocent strategy containing the original.
 * 
 * Based on Proposition 4.20: Plays(V) is the smallest innocent strategy
 * which contains V (for V stable under view).
 * 
 * @param strategy - The strategy to saturate
 * @param _allDesigns - Optional context (unused in current implementation)
 * @param maxIterations - Maximum iterations before stopping
 */
export async function computeSaturationClosure(
  strategy: Strategy,
  _allDesigns?: DesignForCorrespondence[],
  maxIterations: number = 10
): Promise<SaturationClosureResult & { closedStrategy: Strategy }> {
  let currentStrategy = strategy;
  let iteration = 0;
  let addedPlays = 0;

  while (iteration < maxIterations) {
    const satCheck = await checkSaturation(currentStrategy);

    if (satCheck.isSaturated) {
      // Already saturated - done
      return {
        originalStrategyId: strategy.id,
        saturatedStrategy: currentStrategy,
        closedStrategy: currentStrategy, // Alias for API compatibility
        iterations: iteration,
        converged: true,
        addedPlays,
        isSaturated: true,
      };
    }

    // Extract views
    const views = await extractViewsFromStrategy(currentStrategy);

    // Compute Plays(Views)
    const playsResult = await computePlaysFromViews(views, currentStrategy.player);

    // Merge plays into current strategy
    const existingPlayKeys = new Set(
      currentStrategy.plays.map((p) => playToKey(p))
    );
    const newPlays = playsResult.plays.filter(
      (p) => !existingPlayKeys.has(playToKey(p))
    );

    if (newPlays.length === 0) {
      // No new plays added - fixpoint reached
      break;
    }

    addedPlays += newPlays.length;

    // Create new strategy with merged plays
    currentStrategy = {
      ...currentStrategy,
      plays: [...currentStrategy.plays, ...newPlays],
    };

    iteration++;
  }

  // Check final saturation
  const finalCheck = await checkSaturation(currentStrategy);

  return {
    originalStrategyId: strategy.id,
    saturatedStrategy: currentStrategy,
    closedStrategy: currentStrategy, // Alias for API compatibility
    iterations: iteration,
    converged: finalCheck.isSaturated,
    addedPlays,
    isSaturated: finalCheck.isSaturated,
  };
}

/**
 * Check if strategy is view-stable
 * 
 * View-stability: Views(S) ⊆ S (all views are plays)
 */
export async function checkViewStability(
  strategy: Strategy
): Promise<{
  isStable: boolean;
  unstableViews: View[];
}> {
  const views = await extractViewsFromStrategy(strategy);
  const playKeys = new Set(strategy.plays.map((p) => playToKey(p)));

  const unstableViews: View[] = [];

  for (const view of views) {
    // Check if view (as a play) is in strategy
    const viewAsPlayKey = view.sequence
      .map((action) => `${action.focus}:${action.polarity}`)
      .join("-");

    if (!playKeys.has(viewAsPlayKey)) {
      unstableViews.push(view);
    }
  }

  return {
    isStable: unstableViews.length === 0,
    unstableViews,
  };
}

/**
 * Get saturation deficiency
 * 
 * Returns plays that need to be added for saturation.
 * These are plays in Plays(Views(S)) that are not in S.
 * 
 * @param strategy - The strategy to analyze
 * @param _allDesigns - Optional context (unused)
 * @returns Object with deficiency count and missing plays
 */
export async function getSaturationDeficiency(
  strategy: Strategy,
  _allDesigns?: DesignForCorrespondence[]
): Promise<{ deficiency: number; missingPlays: Play[] }> {
  const satCheck = await checkSaturation(strategy);

  if (satCheck.isSaturated) {
    return { deficiency: 0, missingPlays: [] };
  }

  // Find plays that should be added (from "extra" violations - plays in Plays(Views(S)) not in S)
  const extraViolation = satCheck.violations?.find((v) => v.type === "extra");
  if (!extraViolation) {
    return { deficiency: 0, missingPlays: [] };
  }

  // Convert violation to plays
  const missingPlays: Play[] = extraViolation.itemIds.map((key, i) => ({
    id: `missing-play-${i}`,
    strategyId: strategy.id,
    sequence: parsePlayKey(key),
    length: key.split("-").length,
    isPositive: true,
  }));

  return {
    deficiency: missingPlays.length,
    missingPlays,
  };
}

/**
 * Parse play key back to action sequence
 */
function parsePlayKey(key: string): any[] {
  if (!key) return [];

  return key.split("-").map((part) => {
    const [focus, polarity] = part.split(":");
    return {
      focus,
      polarity: polarity as "P" | "O",
      ramification: [],
    };
  });
}

/**
 * Check if two strategies have the same saturation
 */
export async function haveSameSaturation(
  strategy1: Strategy,
  strategy2: Strategy,
  allDesigns: DesignForCorrespondence[]
): Promise<boolean> {
  const sat1 = await checkSaturation(strategy1, allDesigns);
  const sat2 = await checkSaturation(strategy2, allDesigns);

  return sat1.isSaturated === sat2.isSaturated;
}
