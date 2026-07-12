/**
 * DDS Phase 5 - Part 2: Incarnation Checking
 * 
 * Based on Faggian & Hyland (2002) - Definition 6.3
 * 
 * D incarnates in E (D ⊂ E) if D's actions are a subset of E's actions.
 * Sharp incarnation additionally requires that every E-branch contains a D-branch.
 */

import type { Action } from "../types";
import type { DesignForCorrespondence, DesignAct } from "../correspondence/types";
import type {
  Incarnation,
  IncarnationCheck,
  WitnessAction,
  createIncarnation,
} from "./types";

/**
 * Check lax incarnation (Definition 6.3)
 * 
 * D incarnates in E (D ⊂ E) if D's actions are a subset of E's actions.
 * This is the basic form of incarnation.
 */
export function checkLaxIncarnation(
  source: DesignForCorrespondence,
  target: DesignForCorrespondence
): Incarnation {
  const sourceActions = source.acts || [];
  const targetActions = target.acts || [];

  const witnesses: WitnessAction[] = [];
  const missingActions: DesignAct[] = [];

  // Check if all source actions appear in target
  for (const srcAct of sourceActions) {
    const matchingTarget = targetActions.find((tgtAct) =>
      actionsMatch(srcAct, tgtAct)
    );

    if (matchingTarget) {
      witnesses.push({
        sourceActId: srcAct.id,
        targetActId: matchingTarget.id,
        locusPath: srcAct.locusPath || "",
      });
    } else {
      missingActions.push(srcAct);
    }
  }

  const isValid = missingActions.length === 0;

  return {
    id: `inc-lax-${source.id}-${target.id}`,
    sourceDesignId: source.id,
    targetDesignId: target.id,
    type: "lax",
    isValid,
    witnessActions: witnesses,
    invalidReason: isValid
      ? undefined
      : `Missing ${missingActions.length} actions in target`,
  };
}

/**
 * Check sharp incarnation (Definition 6.3)
 * 
 * D sharply incarnates in E if:
 * 1. D ⊂ E (lax incarnation holds)
 * 2. Every E-branch contains a D-branch
 * 
 * This is the stronger form ensuring structural containment.
 */
export function checkSharpIncarnation(
  source: DesignForCorrespondence,
  target: DesignForCorrespondence
): Incarnation {
  // First check lax incarnation
  const laxCheck = checkLaxIncarnation(source, target);

  if (!laxCheck.isValid) {
    return {
      ...laxCheck,
      id: `inc-sharp-${source.id}-${target.id}`,
      type: "sharp",
      invalidReason: `Lax incarnation failed: ${laxCheck.invalidReason}`,
    };
  }

  // Check branch containment
  const sourceBranches = extractBranches(source);
  const targetBranches = extractBranches(target);

  const nonContainedBranches: DesignAct[][] = [];

  // Every target branch must contain some source branch
  for (const targetBranch of targetBranches) {
    const containsSourceBranch = sourceBranches.some((srcBranch) =>
      branchContains(targetBranch, srcBranch)
    );

    if (!containsSourceBranch && sourceBranches.length > 0) {
      nonContainedBranches.push(targetBranch);
    }
  }

  const isValid = nonContainedBranches.length === 0;

  return {
    id: `inc-sharp-${source.id}-${target.id}`,
    sourceDesignId: source.id,
    targetDesignId: target.id,
    type: "sharp",
    isValid,
    witnessActions: laxCheck.witnessActions,
    invalidReason: isValid
      ? undefined
      : `${nonContainedBranches.length} target branches don't contain source branches`,
  };
}

/**
 * Full incarnation check returning both lax and sharp results
 */
export function checkIncarnation(
  source: DesignForCorrespondence,
  target: DesignForCorrespondence
): IncarnationCheck {
  const laxInc = checkLaxIncarnation(source, target);
  const sharpInc = checkSharpIncarnation(source, target);

  const sourceActions = source.acts || [];
  const targetActions = target.acts || [];

  // Find missing actions for reporting
  const missingActions: Action[] = [];
  for (const srcAct of sourceActions) {
    const found = targetActions.some((t) => actionsMatch(srcAct, t));
    if (!found) {
      missingActions.push({
        focus: srcAct.locusPath || "",
        ramification: srcAct.ramification.map((r) =>
          typeof r === "string" ? parseInt(r, 10) || 0 : r
        ),
        polarity: srcAct.polarity === "P" ? "P" : "O",
        actId: srcAct.id,
        expression: srcAct.expression,
      });
    }
  }

  return {
    sourceDesignId: source.id,
    targetDesignId: target.id,
    laxIncarnation: laxInc.isValid,
    sharpIncarnation: sharpInc.isValid,
    witnesses: laxInc.witnessActions || [],
    missingActions: missingActions.length > 0 ? missingActions : undefined,
    nonContainedBranches: sharpInc.isValid
      ? undefined
      : extractBranches(target)
          .filter(
            (tb) =>
              !extractBranches(source).some((sb) => branchContains(tb, sb))
          )
          .map((branch) =>
            branch.map((act) => ({
              focus: act.locusPath || "",
              ramification: act.ramification.map((r) =>
                typeof r === "string" ? parseInt(r, 10) || 0 : r
              ),
              polarity: act.polarity === "P" ? "P" : ("O" as const),
              actId: act.id,
            }))
          ),
  };
}

/**
 * Check if two actions match (same locus, polarity, and ramification)
 */
function actionsMatch(act1: DesignAct, act2: DesignAct): boolean {
  return (
    act1.locusPath === act2.locusPath &&
    act1.polarity === act2.polarity &&
    ramificationsEqual(act1.ramification, act2.ramification)
  );
}

/**
 * Check if two ramifications are equal
 */
function ramificationsEqual(
  ram1: (string | number)[],
  ram2: (string | number)[]
): boolean {
  if (ram1.length !== ram2.length) return false;

  const normalized1 = ram1
    .map((r) => (typeof r === "string" ? parseInt(r, 10) || 0 : r))
    .sort();
  const normalized2 = ram2
    .map((r) => (typeof r === "string" ? parseInt(r, 10) || 0 : r))
    .sort();

  for (let i = 0; i < normalized1.length; i++) {
    if (normalized1[i] !== normalized2[i]) return false;
  }

  return true;
}

/**
 * Extract branches (maximal paths) from a design
 * 
 * A branch is a sequence of actions from root to a terminal point.
 */
function extractBranches(design: DesignForCorrespondence): DesignAct[][] {
  const acts = design.acts || [];
  if (acts.length === 0) return [];

  // Build tree structure from acts
  const locusToActs = new Map<string, DesignAct[]>();

  for (const act of acts) {
    const locus = act.locusPath || "0";
    if (!locusToActs.has(locus)) {
      locusToActs.set(locus, []);
    }
    locusToActs.get(locus)!.push(act);
  }

  // Find root loci (no parent in the set)
  const allLoci = new Set(locusToActs.keys());
  const rootLoci = [...allLoci].filter((locus) => {
    const parent = getParentLocus(locus);
    return !parent || !allLoci.has(parent);
  });

  // DFS to extract branches
  const branches: DesignAct[][] = [];

  function dfs(locus: string, currentBranch: DesignAct[]): void {
    const actsAtLocus = locusToActs.get(locus) || [];

    if (actsAtLocus.length === 0) {
      // Leaf node - end of branch
      if (currentBranch.length > 0) {
        branches.push([...currentBranch]);
      }
      return;
    }

    for (const act of actsAtLocus) {
      currentBranch.push(act);

      // Check for children
      const children = act.ramification || [];
      if (children.length === 0) {
        // No children - end of branch
        branches.push([...currentBranch]);
      } else {
        // Recurse into children
        for (const child of children) {
          const childLocus = `${locus}.${child}`;
          dfs(childLocus, currentBranch);
        }
      }

      currentBranch.pop();
    }
  }

  for (const root of rootLoci) {
    dfs(root, []);
  }

  // If no branches found, treat all acts as single branch
  if (branches.length === 0 && acts.length > 0) {
    return [acts];
  }

  return branches;
}

/**
 * Get parent locus path
 */
function getParentLocus(locus: string): string | null {
  const parts = locus.split(".");
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

/**
 * Check if branch contains another branch as prefix
 */
function branchContains(branch: DesignAct[], subbranch: DesignAct[]): boolean {
  if (subbranch.length > branch.length) return false;
  if (subbranch.length === 0) return true;

  // Check if subbranch is a prefix of branch
  for (let i = 0; i < subbranch.length; i++) {
    if (!actionsMatch(branch[i], subbranch[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Compute incarnation closure
 * 
 * Returns all designs that incarnate in the given design.
 */
export function computeIncarnationClosure(
  design: DesignForCorrespondence,
  candidates: DesignForCorrespondence[],
  type: "lax" | "sharp" = "lax"
): DesignForCorrespondence[] {
  return candidates.filter((candidate) => {
    if (candidate.id === design.id) return true; // Design incarnates in itself

    const check =
      type === "lax"
        ? checkLaxIncarnation(candidate, design)
        : checkSharpIncarnation(candidate, design);

    return check.isValid;
  });
}

/**
 * Find the most specific incarnation target
 * 
 * Given a design and candidates, find the smallest design
 * that the source incarnates in.
 */
export function findMostSpecificTarget(
  source: DesignForCorrespondence,
  candidates: DesignForCorrespondence[],
  type: "lax" | "sharp" = "lax"
): DesignForCorrespondence | null {
  const validTargets = candidates.filter((candidate) => {
    if (candidate.id === source.id) return false;

    const check =
      type === "lax"
        ? checkLaxIncarnation(source, candidate)
        : checkSharpIncarnation(source, candidate);

    return check.isValid;
  });

  if (validTargets.length === 0) return null;

  // Find the smallest (fewest actions) valid target
  return validTargets.reduce((smallest, current) => {
    const smallestSize = (smallest.acts || []).length;
    const currentSize = (current.acts || []).length;
    return currentSize < smallestSize ? current : smallest;
  });
}

/**
 * Find the least specific incarnation target
 * 
 * Given a design and candidates, find the largest design
 * that the source incarnates in.
 */
export function findLeastSpecificTarget(
  source: DesignForCorrespondence,
  candidates: DesignForCorrespondence[],
  type: "lax" | "sharp" = "lax"
): DesignForCorrespondence | null {
  const validTargets = candidates.filter((candidate) => {
    if (candidate.id === source.id) return false;

    const check =
      type === "lax"
        ? checkLaxIncarnation(source, candidate)
        : checkSharpIncarnation(source, candidate);

    return check.isValid;
  });

  if (validTargets.length === 0) return null;

  // Find the largest (most actions) valid target
  return validTargets.reduce((largest, current) => {
    const largestSize = (largest.acts || []).length;
    const currentSize = (current.acts || []).length;
    return currentSize > largestSize ? current : largest;
  });
}

/**
 * Check incarnation transitivity
 * 
 * If A incarnates in B and B incarnates in C, then A incarnates in C.
 */
export function verifyIncarnationTransitivity(
  designA: DesignForCorrespondence,
  designB: DesignForCorrespondence,
  designC: DesignForCorrespondence,
  type: "lax" | "sharp" = "lax"
): {
  isTransitive: boolean;
  aToB: Incarnation;
  bToC: Incarnation;
  aToC: Incarnation;
} {
  const checkFn =
    type === "lax" ? checkLaxIncarnation : checkSharpIncarnation;

  const aToB = checkFn(designA, designB);
  const bToC = checkFn(designB, designC);
  const aToC = checkFn(designA, designC);

  // Transitivity: if A→B and B→C both hold, then A→C should hold
  const shouldHold = aToB.isValid && bToC.isValid;
  const isTransitive = !shouldHold || aToC.isValid;

  return {
    isTransitive,
    aToB,
    bToC,
    aToC,
  };
}
