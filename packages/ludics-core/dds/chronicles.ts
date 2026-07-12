/**
 * DDS Chronicle Extraction
 * Based on Faggian & Hyland (2002) - Proposition 3.6
 * 
 * Chronicles are branches in the design tree. Each chronicle represents
 * a complete interaction path from root to a terminal position.
 * 
 * The key insight: view extracts the "identifying chronicle" for each action.
 */

import type { 
  Action, 
  Position, 
  Chronicle, 
  Dispute, 
  ChronicleExtractionOptions 
} from "./types";
import { extractView } from "./views";

/**
 * Extract chronicles from dispute (Proposition 3.6)
 * View extracts the identifying chronicle for each action
 * 
 * @param dispute - The dispute to extract chronicles from
 * @param player - Which player's chronicles to extract
 * @param options - Optional extraction parameters
 * @returns Array of chronicles for the player
 */
export function extractChronicles(
  dispute: Dispute,
  player: "P" | "O",
  options: ChronicleExtractionOptions = {}
): Chronicle[] {
  const chronicles: Chronicle[] = [];
  const position = disputeToPosition(dispute);

  // For each prefix of the position, extract the view
  // Each view corresponds to a chronicle
  for (let i = 0; i < position.sequence.length; i++) {
    const prefix: Position = {
      ...position,
      sequence: position.sequence.slice(0, i + 1),
    };

    const view = extractView(prefix, player);

    if (view.length > 0) {
      const chronicle: Chronicle = {
        id: `chronicle-${dispute.id}-${player}-${i}`,
        designId: player === "P" ? dispute.posDesignId : dispute.negDesignId,
        actions: view,
        polarity: player,
        isPositive: view[view.length - 1].polarity === player,
      };

      // Check if we should include this chronicle
      if (!options.onlyPositive || chronicle.isPositive) {
        chronicles.push(chronicle);
      }

      // Limit number of chronicles if specified
      if (options.maxChronicles && chronicles.length >= options.maxChronicles) {
        break;
      }
    }
  }

  return chronicles;
}

/**
 * Convert dispute to position (Faggian-Hyland semantics)
 * 
 * A position is a single path through the tree. Since a dispute may contain
 * multiple branches, we pick the FIRST maximal (deepest) path.
 * 
 * Each action is at a UNIQUE address (linearity constraint).
 * Polarity is determined by depth: odd depth = P, even depth = O.
 */
export function disputeToPosition(dispute: Dispute): Position {
  const sequence: Action[] = [];

  // Convert pairs to action sequence - use actionPairs from DB or pairs from type
  const pairs = (dispute as any).actionPairs || dispute.pairs || [];
  
  if (pairs.length === 0) {
    return {
      id: dispute.id,
      sequence: [],
      player: "P",
      isLinear: true,
      isLegal: true,
      disputeId: dispute.id,
    };
  }
  
  // Build set of all paths
  const pathSet = new Set<string>();
  for (const pair of pairs) {
    pathSet.add(pair.locusPath);
  }
  
  // Find all maximal (leaf) paths
  const maximalPaths: string[] = [];
  const allPaths = Array.from(pathSet);
  for (const path of allPaths) {
    const hasChild = allPaths.some(other => 
      other !== path && other.startsWith(path + ".")
    );
    if (!hasChild) {
      maximalPaths.push(path);
    }
  }
  
  // Sort maximal paths to pick a consistent one (deepest, then lexicographically first)
  maximalPaths.sort((a, b) => {
    const depthA = a.split(".").length;
    const depthB = b.split(".").length;
    return depthB - depthA || a.localeCompare(b); // Deeper first
  });
  
  // Use the first (deepest) maximal path
  const chosenLeaf = maximalPaths[0];
  const leafParts = chosenLeaf.split(".");
  
  // Build path from root to chosen leaf
  const pathSequence: string[] = [];
  for (let i = 1; i <= leafParts.length; i++) {
    const ancestorPath = leafParts.slice(0, i).join(".");
    if (pathSet.has(ancestorPath)) {
      pathSequence.push(ancestorPath);
    }
  }
  
  // Build actions for this path
  const usedAddresses = new Set<string>();
  for (const locusPath of pathSequence) {
    if (usedAddresses.has(locusPath)) continue;
    usedAddresses.add(locusPath);
    
    const depth = locusPath.split(".").length;
    const polarity: "P" | "O" = depth % 2 === 1 ? "P" : "O";
    
    // Find the pair to get act IDs
    const pair = pairs.find((p: any) => p.locusPath === locusPath);
    
    // Compute ramification
    const ramification: number[] = [];
    for (const otherPath of allPaths) {
      if (otherPath.startsWith(locusPath + ".")) {
        const suffix = otherPath.slice(locusPath.length + 1);
        const childIdx = parseInt(suffix.split(".")[0], 10);
        if (!isNaN(childIdx) && !ramification.includes(childIdx)) {
          ramification.push(childIdx);
        }
      }
    }
    ramification.sort((a, b) => a - b);
    
    sequence.push({
      focus: locusPath,
      ramification,
      polarity,
      actId: polarity === "P" ? pair?.posActId : pair?.negActId,
      ts: pair?.ts,
    });
  }

  // Validate linearity
  const isLinear = sequence.length === usedAddresses.size;
  
  // Validate parity alternation
  let parityValid = true;
  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i].polarity === sequence[i - 1].polarity) {
      parityValid = false;
      break;
    }
  }

  return {
    id: dispute.id,
    sequence,
    player: sequence.length % 2 === 0 ? "O" : "P",
    isLinear,
    isLegal: isLinear && parityValid,
    disputeId: dispute.id,
  };
}

/**
 * Extract all unique chronicles from a position
 * Returns chronicles for both players
 */
export function extractAllChronicles(
  position: Position,
  options: ChronicleExtractionOptions = {}
): { proponent: Chronicle[]; opponent: Chronicle[] } {
  const proponent: Chronicle[] = [];
  const opponent: Chronicle[] = [];

  const seenP = new Set<string>();
  const seenO = new Set<string>();

  for (let i = 0; i < position.sequence.length; i++) {
    const prefix: Position = {
      ...position,
      sequence: position.sequence.slice(0, i + 1),
    };

    // Extract proponent view/chronicle
    const pView = extractView(prefix, "P");
    const pKey = chronicleKey(pView);
    if (!seenP.has(pKey) && pView.length > 0) {
      seenP.add(pKey);
      const chronicle: Chronicle = {
        id: `chronicle-P-${i}`,
        designId: "", // Will be set by caller
        actions: pView,
        polarity: "P",
        isPositive: pView[pView.length - 1].polarity === "P",
      };
      if (!options.onlyPositive || chronicle.isPositive) {
        proponent.push(chronicle);
      }
    }

    // Extract opponent view/chronicle
    const oView = extractView(prefix, "O");
    const oKey = chronicleKey(oView);
    if (!seenO.has(oKey) && oView.length > 0) {
      seenO.add(oKey);
      const chronicle: Chronicle = {
        id: `chronicle-O-${i}`,
        designId: "",
        actions: oView,
        polarity: "O",
        isPositive: oView[oView.length - 1].polarity === "O",
      };
      if (!options.onlyPositive || chronicle.isPositive) {
        opponent.push(chronicle);
      }
    }
  }

  return { proponent, opponent };
}

/**
 * Generate a unique key for a chronicle/view sequence
 */
function chronicleKey(actions: Action[]): string {
  return JSON.stringify(
    actions.map((a) => ({
      f: a.focus,
      p: a.polarity,
      r: a.ramification.sort(),
    }))
  );
}

/**
 * Check if chronicle ends positively (player's own action)
 */
export function isPositiveChronicle(chronicle: Chronicle): boolean {
  if (chronicle.actions.length === 0) return false;
  return chronicle.actions[chronicle.actions.length - 1].polarity === chronicle.polarity;
}

/**
 * Check if chronicle ends negatively (opponent's action)
 */
export function isNegativeChronicle(chronicle: Chronicle): boolean {
  if (chronicle.actions.length === 0) return false;
  return chronicle.actions[chronicle.actions.length - 1].polarity !== chronicle.polarity;
}

/**
 * Get the depth of a chronicle (number of moves from root)
 */
export function chronicleDepth(chronicle: Chronicle): number {
  return chronicle.actions.length;
}

/**
 * Extract the locus path from the tip of a chronicle
 */
export function chronicleTipLocus(chronicle: Chronicle): string | undefined {
  if (chronicle.actions.length === 0) return undefined;
  return chronicle.actions[chronicle.actions.length - 1].focus;
}

/**
 * Check if one chronicle is a prefix of another
 */
export function isChroniclePrefix(
  prefix: Chronicle,
  full: Chronicle
): boolean {
  if (prefix.actions.length > full.actions.length) return false;
  
  for (let i = 0; i < prefix.actions.length; i++) {
    const a1 = prefix.actions[i];
    const a2 = full.actions[i];
    
    if (a1.focus !== a2.focus) return false;
    if (a1.polarity !== a2.polarity) return false;
    if (JSON.stringify(a1.ramification) !== JSON.stringify(a2.ramification)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get all positive-ended chronicles from a set
 */
export function getPositiveChronicles(chronicles: Chronicle[]): Chronicle[] {
  return chronicles.filter((c) => c.isPositive);
}

/**
 * Get all negative-ended chronicles from a set
 */
export function getNegativeChronicles(chronicles: Chronicle[]): Chronicle[] {
  return chronicles.filter((c) => !c.isPositive);
}

/**
 * Group chronicles by their terminal locus
 */
export function groupChroniclesByLocus(
  chronicles: Chronicle[]
): Map<string, Chronicle[]> {
  const groups = new Map<string, Chronicle[]>();

  for (const chronicle of chronicles) {
    const locus = chronicleTipLocus(chronicle);
    if (locus) {
      if (!groups.has(locus)) {
        groups.set(locus, []);
      }
      groups.get(locus)!.push(chronicle);
    }
  }

  return groups;
}
