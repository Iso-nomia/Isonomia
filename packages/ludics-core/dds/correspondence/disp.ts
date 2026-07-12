/**
 * Disp(D) Operation
 * 
 * Based on Faggian & Hyland (2002) - Proposition 4.27
 * Compute all disputes of design D with orthogonal counter-designs
 */

import type { Action, Dispute, Position } from "../types";
import type { DesignForCorrespondence, DesignAct, DispResult } from "./types";

// Debug logging
const DEBUG_DISP = true;
function logDisp(label: string, ...args: any[]) {
  if (DEBUG_DISP) {
    console.log(`[DISP] ${label}`, ...args);
  }
}

/**
 * Compute Disp(D) - all disputes of design D
 * A dispute is an interaction D ⊢ E with orthogonal counter-design E
 */
export function computeDisp(
  design: DesignForCorrespondence,
  counterDesigns: DesignForCorrespondence[]
): DispResult {
  logDisp("computeDisp called:", {
    designId: design.id,
    designActCount: design.acts.length,
    counterDesignCount: counterDesigns.length,
  });
  
  const disputes: Dispute[] = [];

  // For each counter-design, compute dispute
  for (const counter of counterDesigns) {
    try {
      // Step through interaction
      const dispute = computeDispute(design, counter);
      if (dispute) {
        disputes.push(dispute);
        logDisp("Computed dispute:", {
          posDesign: design.id.slice(-8),
          negDesign: counter.id.slice(-8),
          pairCount: dispute.pairs.length,
          status: dispute.status,
        });
      } else {
        logDisp("No dispute computed for:", { posDesign: design.id.slice(-8), negDesign: counter.id.slice(-8) });
      }
    } catch (error) {
      // Skip failed dispute computations
      console.warn(`Failed to compute dispute: ${error}`);
    }
  }

  // Remove duplicate disputes (same sequence)
  const uniqueDisputes = deduplicateDisputes(disputes);
  logDisp("computeDisp result:", { totalDisputes: uniqueDisputes.length });

  return {
    designId: design.id,
    disputes: uniqueDisputes,
    count: uniqueDisputes.length,
    computedAt: new Date(),
  };
}

/**
 * Compute single dispute between two designs (Faggian-Hyland semantics)
 * 
 * A dispute traces through the locus tree where P and O designs interact.
 * Each locus appears at most once (linearity).
 * Polarity is determined by locus depth (odd = P, even = O).
 * 
 * The interaction follows the tree structure: P at root opens children,
 * O responds at a child, which opens grandchildren, P responds, etc.
 */
export function computeDispute(
  posDesign: DesignForCorrespondence,
  negDesign: DesignForCorrespondence
): Dispute | null {
  const pairs: Dispute["pairs"] = [];

  // Build act maps by locus path
  const posActsByPath = buildActMap(posDesign.acts);
  const negActsByPath = buildActMap(negDesign.acts);
  
  logDisp("computeDispute:", {
    posDesign: posDesign.id.slice(-8),
    negDesign: negDesign.id.slice(-8),
    posPaths: Array.from(posActsByPath.keys()),
    negPaths: Array.from(negActsByPath.keys()),
  });

  // Collect all paths from both designs
  const allPaths = new Set<string>();
  Array.from(posActsByPath.keys()).forEach(path => allPaths.add(path));
  Array.from(negActsByPath.keys()).forEach(path => allPaths.add(path));
  
  if (allPaths.size === 0) {
    logDisp("No paths found in either design");
    return null;
  }
  
  // Sort paths by depth (tree traversal order)
  const sortedPaths = Array.from(allPaths).sort((a, b) => {
    const depthA = a.split(".").length;
    const depthB = b.split(".").length;
    return depthA - depthB || a.localeCompare(b);
  });
  
  logDisp("All locus paths (sorted):", sortedPaths);

  // Build pairs for each locus path
  // In Faggian-Hyland, polarity is determined by locus depth:
  // - Odd depth (1, 3, 5, ...) = P (root "0" is depth 1)
  // - Even depth (2, 4, 6, ...) = O
  let status: Dispute["status"] = "ONGOING";
  
  for (let i = 0; i < sortedPaths.length; i++) {
    const path = sortedPaths[i];
    const depth = path.split(".").length;
    const expectedPolarity: "P" | "O" = depth % 2 === 1 ? "P" : "O";
    
    // Get the act from the design that should act at this depth
    const posAct = posActsByPath.get(path);
    const negAct = negActsByPath.get(path);
    
    // The "owning" act is based on depth parity
    const owningAct = expectedPolarity === "P" ? posAct : negAct;
    const respondingAct = expectedPolarity === "P" ? negAct : posAct;
    
    pairs.push({
      posActId: posAct?.id || "∅",
      negActId: negAct?.id || "∅",
      locusPath: path,
      ts: i,
    });
    
    logDisp(`Pair at ${path}: depth=${depth}, expected=${expectedPolarity}, posAct=${posAct?.id?.slice(-8) || "∅"}, negAct=${negAct?.id?.slice(-8) || "∅"}`);
  }

  if (pairs.length === 0) {
    return null;
  }
  
  // Determine status based on how the interaction ended
  const lastPair = pairs[pairs.length - 1];
  const lastDepth = lastPair.locusPath.split(".").length;
  const lastExpectedPolarity = lastDepth % 2 === 1 ? "P" : "O";
  
  // Check if the expected player has an act at the last position
  const lastOwner = lastExpectedPolarity === "P" ? lastPair.posActId : lastPair.negActId;
  if (lastOwner === "∅") {
    status = "DIVERGENT"; // Expected player didn't have a move
  } else {
    status = "CONVERGENT"; // Normal termination
  }

  logDisp("Dispute computed:", { pairCount: pairs.length, status });

  return {
    id: `dispute-${posDesign.id}-${negDesign.id}`,
    dialogueId: posDesign.deliberationId,
    posDesignId: posDesign.id,
    negDesignId: negDesign.id,
    pairs,
    status,
    length: pairs.length,
    isLegal: true,
  };
}

/**
 * Build map from locus path to act
 */
function buildActMap(acts: DesignAct[]): Map<string, DesignAct> {
  const map = new Map<string, DesignAct>();
  for (const act of acts) {
    if (act.locusPath) {
      map.set(act.locusPath, act);
    }
  }
  return map;
}

/**
 * Remove duplicate disputes (same pair sequence)
 */
function deduplicateDisputes(disputes: Dispute[]): Dispute[] {
  const seen = new Set<string>();
  const unique: Dispute[] = [];

  for (const dispute of disputes) {
    const key = disputeToKey(dispute);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(dispute);
    }
  }

  return unique;
}

/**
 * Create unique key for dispute
 */
function disputeToKey(dispute: Dispute): string {
  return dispute.pairs.map(p => `${p.locusPath}`).join("|");
}

/**
 * Convert disputes to strategy plays (Faggian-Hyland semantics)
 * 
 * Each dispute represents a tree structure. A PLAY is a single path through
 * this tree - it cannot include sibling nodes (nodes at the same depth that
 * share a parent but are different branches).
 * 
 * Key insight: At each branching point, we must choose ONE child branch.
 * This generates multiple plays - one for each complete path through the tree.
 * 
 * Example tree:
 *        0 (P)
 *        |
 *       0.1 (O)
 *        |
 *      0.1.1 (P)
 *      /    \
 *  0.1.1.1  0.1.1.2
 *    (O)      (O)
 * 
 * This generates plays:
 *   - 0:P
 *   - 0:P|0.1:O
 *   - 0:P|0.1:O|0.1.1:P
 *   - 0:P|0.1:O|0.1.1:P|0.1.1.1:O  (left branch)
 *   - 0:P|0.1:O|0.1.1:P|0.1.1.2:O  (right branch)
 */
export function disputesToPlays(
  disputes: Dispute[],
  player: "P" | "O"
): { sequence: Action[]; length: number; isPositive: boolean }[] {
  logDisp("disputesToPlays called:", { disputeCount: disputes.length, player });
  
  const result: { sequence: Action[]; length: number; isPositive: boolean }[] = [];
  const seenSequences = new Set<string>();

  for (const dispute of disputes) {
    // Get all unique locus paths from the dispute
    const pairs = dispute.pairs || [];
    if (pairs.length === 0) continue;
    
    // Build a tree structure from paths
    const pathSet = new Set<string>();
    for (const pair of pairs) {
      pathSet.add(pair.locusPath);
    }
    
    // Find all maximal (leaf) paths - paths that have no children
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
    
    logDisp("Maximal (leaf) paths:", maximalPaths);
    
    // For each maximal path, generate the complete play from root to that leaf
    for (const leafPath of maximalPaths) {
      // Build the path from root to this leaf
      const pathParts = leafPath.split(".");
      const pathSequence: string[] = [];
      
      for (let i = 1; i <= pathParts.length; i++) {
        const ancestorPath = pathParts.slice(0, i).join(".");
        if (pathSet.has(ancestorPath)) {
          pathSequence.push(ancestorPath);
        }
      }
      
      // Build actions for this path
      const actions: Action[] = [];
      for (const locusPath of pathSequence) {
        const depth = locusPath.split(".").length;
        const polarity: "P" | "O" = depth % 2 === 1 ? "P" : "O";
        
        // Find the pair to get act ID
        const pair = pairs.find(p => p.locusPath === locusPath);
        const actId = pair ? (polarity === "P" ? pair.posActId : pair.negActId) : undefined;
        
        // Compute ramification: child indices that exist in pathSet
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
        
        actions.push({
          focus: locusPath,
          ramification,
          polarity,
          actId: actId !== "∅" ? actId : undefined,
        });
      }
      
      // Generate plays for all prefixes of this path
      for (let prefixLen = 1; prefixLen <= actions.length; prefixLen++) {
        const sequence = actions.slice(0, prefixLen);
        
        const seqKey = sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
        if (seenSequences.has(seqKey)) continue;
        seenSequences.add(seqKey);
        
        const lastAction = sequence[sequence.length - 1];
        const isPositive = lastAction.polarity === player;
        
        result.push({
          sequence,
          length: sequence.length,
          isPositive,
        });
      }
    }
  }
  
  logDisp("disputesToPlays result:", { 
    playCount: result.length, 
    samplePlays: result.slice(0, 8).map(r => r.sequence.map(a => `${a.focus}:${a.polarity}`).join("|"))
  });
  return result;
}

/**
 * Extract all locus paths from design
 */
export function extractDesignPaths(design: DesignForCorrespondence): string[] {
  const paths = new Set<string>();
  for (const act of design.acts) {
    if (act.locusPath) {
      paths.add(act.locusPath);
    }
  }
  return Array.from(paths).sort();
}

/**
 * Check if two designs can interact (have overlapping structure)
 */
export function canInteract(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence
): boolean {
  const paths1 = extractDesignPaths(design1);
  const paths2 = extractDesignPaths(design2);

  // Check for root or overlapping paths
  const hasRoot1 = paths1.includes("0");
  const hasRoot2 = paths2.includes("0");

  if (hasRoot1 && hasRoot2) {
    return true;
  }

  // Check for any common path
  for (const path of paths1) {
    if (paths2.includes(path)) {
      return true;
    }
  }

  return false;
}
