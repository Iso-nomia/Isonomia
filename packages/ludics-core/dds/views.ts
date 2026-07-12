/**
 * DDS View Extraction
 * Based on Faggian & Hyland (2002) - Definition 3.5
 * 
 * View extracts the relevant actions visible to a player from a position.
 * The view is what a player "sees" at any point in the interaction.
 * 
 * Key semantic: In the tree-traversal model, polarity is determined by
 * locus depth. Odd depth = P (Proponent), Even depth = O (Opponent).
 * Root "0" is depth 1 = P, "0.1" is depth 2 = O, etc.
 */

import type { Action, Position, View, ViewExtractionOptions } from "./types";

/**
 * Extract view for player X from position
 * Definition 3.5 from paper:
 * - ε̄ = ε (empty stays empty)
 * - sκ⁺ = s̄⁻κ⁺ (positive move: keep from opponent's view + this move)
 * - sκ⁻ = κ⁻ if κ initial (negative initial: just that move)
 * - sκ′tκ⁻ = s̄⁻κ′κ if κ justified by κ′ (negative: jump to justifier + this)
 * 
 * @param position - The current position in the dispute
 * @param player - Which player's view to extract ("P" or "O")
 * @param options - Optional extraction parameters
 * @returns Array of actions visible to the player
 */
export function extractView(
  position: Position,
  player: "P" | "O",
  options: ViewExtractionOptions = {}
): Action[] {
  const view: Action[] = [];

  for (const action of position.sequence) {
    // Determine if this action is positive for the player
    // In tree-traversal model: odd depth = P, even depth = O
    const depth = action.focus.split(".").length;
    const depthPolarity: "P" | "O" = depth % 2 === 1 ? "P" : "O";
    const isPositiveForPlayer = depthPolarity === player;
    
    if (isPositiveForPlayer) {
      // Positive move (player's own): keep previous view + this move
      // Definition 3.5: sκ⁺ = s̄⁻κ⁺
      view.push(action);
    } else {
      // Negative move (opponent's)
      if (isInitial(action)) {
        // Initial negative move: just the move
        // Definition 3.5: sκ⁻ = κ⁻ if κ initial
        view.length = 0;
        view.push(action);
      } else {
        // Non-initial negative: find justifier and jump back
        // Definition 3.5: sκ′tκ⁻ = s̄⁻κ′κ
        const justifier = findJustifier(action, view);
        if (justifier) {
          // Find position of justifier in view and truncate there
          const justifierIdx = view.findIndex(a => 
            a.focus === justifier.focus && 
            a.polarity === justifier.polarity
          );
          if (justifierIdx >= 0) {
            // Keep up to and including justifier, then add this action
            view.length = justifierIdx + 1;
          } else {
            // Justifier not in current view - start fresh with it
            view.length = 0;
            view.push(justifier);
          }
          view.push(action);
        } else {
          // No justifier found - treat as initial-like
          view.length = 0;
          view.push(action);
        }
      }
    }
  }

  return view;
}

/**
 * Check if action is initial (not justified by prior action)
 * Initial actions are at depth 1 (root locus)
 */
export function isInitial(action: Action): boolean {
  const depth = action.focus.split(".").filter(p => p !== "").length;
  return depth <= 1 || action.focus === "<>" || action.focus === "";
}

/**
 * Find justifier for an action in the current view
 * Action at (ξ.i, J) is justified by action at (ξ, I) if i ∈ I
 * 
 * In tree-traversal: parent address must have opened this child index
 * For sparse trees (where intermediate levels may be missing), we walk
 * up the tree to find the nearest ancestor that exists in the view.
 * 
 * @param action - The action needing justification
 * @param view - The current view to search
 * @returns The justifying action, or null if not found
 */
export function findJustifier(action: Action, view: Action[]): Action | null {
  const focusParts = action.focus.split(".");
  if (focusParts.length <= 1) return null;

  // Walk up the tree looking for an ancestor that exists in the view
  for (let depth = focusParts.length - 1; depth >= 1; depth--) {
    const ancestorFocus = focusParts.slice(0, depth).join(".");
    const childIndex = parseInt(focusParts[depth], 10);
    
    // Search backwards through view for matching justifier at this ancestor level
    for (let i = view.length - 1; i >= 0; i--) {
      const candidate = view[i];
      if (candidate.focus === ancestorFocus) {
        // Found ancestor - check if ramification allows this descendant
        // If ramification is empty or includes any child, accept it (sparse tree tolerance)
        if (candidate.ramification.length === 0 || candidate.ramification.includes(childIndex)) {
          return candidate;
        }
        // Even if ramification doesn't include this child, in a sparse tree
        // the ancestor is still the best justifier we have
        return candidate;
      }
    }
  }

  // If not found in view, no justifier available
  return null;
}

/**
 * Get the polarity for an action based on locus depth
 * Odd depth (1, 3, 5...) = P, Even depth (2, 4, 6...) = O
 */
export function getPolarityForDepth(focus: string): "P" | "O" {
  const depth = focus.split(".").filter(p => p !== "").length;
  return depth % 2 === 1 ? "P" : "O";
}

/**
 * Extract proponent view from position
 * Convenience wrapper for extractView with player = "P"
 */
export function extractProponentView(
  position: Position,
  options: ViewExtractionOptions = {}
): Action[] {
  return extractView(position, "P", options);
}

/**
 * Extract opponent view from position
 * Convenience wrapper for extractView with player = "O"
 */
export function extractOpponentView(
  position: Position,
  options: ViewExtractionOptions = {}
): Action[] {
  return extractView(position, "O", options);
}

/**
 * Create a View object from extracted actions
 */
export function createView(
  id: string,
  player: "P" | "O",
  sequence: Action[],
  designId: string,
  parentDisputeId?: string
): View {
  return {
    id,
    player,
    sequence,
    designId,
    parentDisputeId,
  };
}

/**
 * Compare two views for equality
 * Views are equal if they have the same sequence of actions at the same foci
 */
export function viewsEqual(v1: View | Action[], v2: View | Action[]): boolean {
  const seq1 = Array.isArray(v1) ? v1 : v1.sequence;
  const seq2 = Array.isArray(v2) ? v2 : v2.sequence;

  if (seq1.length !== seq2.length) return false;

  for (let i = 0; i < seq1.length; i++) {
    const a1 = seq1[i];
    const a2 = seq2[i];

    if (a1.focus !== a2.focus) return false;
    if (a1.polarity !== a2.polarity) return false;
    if (JSON.stringify(a1.ramification) !== JSON.stringify(a2.ramification)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if view v1 is a prefix of view v2
 */
export function isViewPrefix(
  v1: View | Action[],
  v2: View | Action[]
): boolean {
  const seq1 = Array.isArray(v1) ? v1 : v1.sequence;
  const seq2 = Array.isArray(v2) ? v2 : v2.sequence;

  if (seq1.length > seq2.length) return false;

  for (let i = 0; i < seq1.length; i++) {
    const a1 = seq1[i];
    const a2 = seq2[i];

    if (a1.focus !== a2.focus) return false;
    if (a1.polarity !== a2.polarity) return false;
    if (JSON.stringify(a1.ramification) !== JSON.stringify(a2.ramification)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the last action in a view
 */
export function getViewTip(view: View | Action[]): Action | undefined {
  const seq = Array.isArray(view) ? view : view.sequence;
  return seq.length > 0 ? seq[seq.length - 1] : undefined;
}

/**
 * Serialize a view to a string key for comparison/hashing
 */
export function viewToKey(view: View | Action[]): string {
  const seq = Array.isArray(view) ? view : view.sequence;
  return JSON.stringify(
    seq.map((a) => ({
      f: a.focus,
      p: a.polarity,
      r: a.ramification,
    }))
  );
}
