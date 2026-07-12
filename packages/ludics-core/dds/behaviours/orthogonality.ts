/**
 * DDS Phase 5 - Part 1: Orthogonality Operations
 * 
 * Based on Faggian & Hyland (2002) - Definition 6.1
 * 
 * Definition 6.1 (Orthogonality): S ⊥ T if S ∩ T = p
 * Two strategies belonging to opposite players are orthogonal if they
 * intersect in exactly one play p.
 * 
 * For designs (as representatives of strategies), orthogonality is checked
 * by verifying that the interaction normalizes to a successful termination.
 * 
 * Key theoretical points:
 * - Orthogonality is defined on STRATEGIES, not designs
 * - A strategy is a set of plays (innocent: determined by views)
 * - S ⊥ T means the strategies share exactly one play when interacting
 * - This play is the result of normalization (cut elimination)
 * 
 * Orthogonality is the fundamental relation that defines behaviours.
 */

import type { Action, Dispute } from "../types";
import type { Strategy, Play } from "../strategy/types";
import type { DesignForCorrespondence } from "../correspondence/types";
import type {
  OrthogonalityResult,
  OrthogonalityEvidence,
  DisputeIntersection,
  IntersectionTraceStep,
  createOrthogonalityResult,
} from "./types";

// ============================================================================
// Strategy-Level Orthogonality (Definition 6.1)
// ============================================================================

/**
 * Check strategy-level orthogonality (Definition 6.1)
 * 
 * S ⊥ T if S ∩ T = p (exactly one play in intersection)
 * 
 * Two strategies are orthogonal if when played against each other,
 * they produce exactly one resulting play (convergent interaction).
 */
export async function checkStrategyOrthogonality(
  strategy1: Strategy,
  strategy2: Strategy
): Promise<{
  isOrthogonal: boolean;
  intersectionPlay?: Play;
  intersectionSize: number;
  reason?: string;
}> {
  // Strategies must be of opposite polarity
  if (strategy1.player === strategy2.player) {
    return {
      isOrthogonal: false,
      intersectionSize: 0,
      reason: `Both strategies are ${strategy1.player}-strategies. Orthogonality requires opposite polarities.`,
    };
  }

  // Compute intersection of play sets
  // Two plays "intersect" if they represent the same interaction
  const plays1Keys = new Set(strategy1.plays.map(p => playToKey(p)));
  const plays2Keys = new Set(strategy2.plays.map(p => playToKey(p)));
  
  // Find common plays (by key)
  const intersection: Play[] = [];
  for (const play of strategy1.plays) {
    const key = playToKey(play);
    if (plays2Keys.has(key)) {
      intersection.push(play);
    }
  }

  // Orthogonality: exactly one play in intersection
  const isOrthogonal = intersection.length === 1;

  return {
    isOrthogonal,
    intersectionPlay: intersection.length === 1 ? intersection[0] : undefined,
    intersectionSize: intersection.length,
    reason: isOrthogonal
      ? "Strategies intersect in exactly one play"
      : intersection.length === 0
        ? "No common plays - strategies don't interact"
        : `Multiple intersection plays (${intersection.length}) - not deterministic`,
  };
}

/**
 * Helper: Convert play to unique key for comparison
 */
function playToKey(play: Play): string {
  return play.sequence
    .map((action) => `${action.focus}:${action.polarity}`)
    .join("-");
}

// ============================================================================
// Design-Level Orthogonality (Derived from Strategy Orthogonality)
// ============================================================================

/**
 * Check orthogonality via dispute intersection (Definition 6.1)
 * 
 * D ⊥ E iff for all disputes [D F] and [E G], [D F] ∩ [E G] converges
 * 
 * This is the refined orthogonality check that analyzes all pairwise
 * dispute intersections to determine if two designs are orthogonal.
 */
export async function checkOrthogonalityRefined(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): Promise<OrthogonalityResult> {
  // Compute all disputes for both designs
  const disputes1 = await computeDesignDisputes(design1, allDesigns);
  const disputes2 = await computeDesignDisputes(design2, allDesigns);

  // Check all pairwise dispute intersections
  let allConverge = true;
  const intersectionTraces: DisputeIntersection[] = [];
  let counterexample: OrthogonalityEvidence["counterexample"] | undefined;

  for (const d1 of disputes1) {
    for (const d2 of disputes2) {
      const intersection = computeDisputeIntersection(d1, d2);
      intersectionTraces.push(intersection);

      if (!intersection.converges) {
        allConverge = false;
        counterexample = {
          dispute1: d1,
          dispute2: d2,
          divergencePoint: findDivergencePoint(intersection),
        };
        break;
      }
    }
    if (!allConverge) break;
  }

  return {
    design1Id: design1.id,
    design2Id: design2.id,
    isOrthogonal: allConverge,
    method: "dispute-intersection",
    convergenceType: allConverge ? "positive" : "divergent",
    disputeCount: disputes1.length + disputes2.length,
    evidence: {
      disputes1,
      disputes2,
      intersectionTraces,
      counterexample: allConverge ? undefined : counterexample,
    },
  };
}

/**
 * Basic orthogonality check (Definition 6.1 simplified)
 * 
 * D ⊥ E iff [[D, E]] converges
 * 
 * Simpler check that only looks at direct interaction between designs.
 */
export async function checkOrthogonalityBasic(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence
): Promise<OrthogonalityResult> {
  // Check direct interaction convergence
  const interactionResult = await checkDesignInteraction(design1, design2);

  return {
    design1Id: design1.id,
    design2Id: design2.id,
    isOrthogonal: interactionResult.converges,
    method: "basic",
    convergenceType: interactionResult.converges
      ? interactionResult.convergenceType
      : "divergent",
    evidence: interactionResult.converges
      ? undefined
      : {
          counterexample: {
            divergencePoint: interactionResult.divergencePoint,
          },
        },
  };
}

/**
 * Compute all disputes of a design with counter-designs
 */
async function computeDesignDisputes(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): Promise<Dispute[]> {
  const disputes: Dispute[] = [];
  const designPolarity = inferDesignPolarity(design);

  // Find counter-designs (opposite polarity)
  const counterDesigns = allDesigns.filter((d) => {
    if (d.id === design.id) return false;
    const counterPolarity = inferDesignPolarity(d);
    return counterPolarity !== designPolarity;
  });

  // Compute dispute with each counter-design
  for (const counter of counterDesigns) {
    const dispute = await computeDispute(design, counter, designPolarity);
    if (dispute) {
      disputes.push(dispute);
    }
  }

  return disputes;
}

/**
 * Compute dispute between two designs
 */
async function computeDispute(
  posDesign: DesignForCorrespondence,
  negDesign: DesignForCorrespondence,
  posPolarity: "P" | "O"
): Promise<Dispute | null> {
  const pairs: Dispute["pairs"] = [];
  const posActs = posDesign.acts || [];
  const negActs = negDesign.acts || [];

  // Match actions at the same locus
  for (const posAct of posActs) {
    const matchingNegAct = negActs.find(
      (neg) =>
        neg.locusPath === posAct.locusPath &&
        neg.polarity !== posAct.polarity
    );

    if (matchingNegAct) {
      pairs.push({
        posActId: posAct.id,
        negActId: matchingNegAct.id,
        locusPath: posAct.locusPath || "",
        ts: Date.now(),
      });
    }
  }

  if (pairs.length === 0) {
    return null;
  }

  // Determine status based on interaction
  const status = determineDisputeStatus(posActs, negActs, pairs);

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
 * Determine the status of a dispute based on action matching
 */
function determineDisputeStatus(
  posActs: DesignForCorrespondence["acts"],
  negActs: DesignForCorrespondence["acts"],
  pairs: Dispute["pairs"]
): Dispute["status"] {
  // Check for daimon (convergence)
  const hasDaimon =
    posActs.some((a) => a.kind === "DAIMON") ||
    negActs.some((a) => a.kind === "DAIMON");

  if (hasDaimon) {
    return "CONVERGENT";
  }

  // If all actions are paired, check if we reached a terminal state
  const allPosPaired = posActs.every((p) =>
    pairs.some((pair) => pair.posActId === p.id)
  );
  const allNegPaired = negActs.every((n) =>
    pairs.some((pair) => pair.negActId === n.id)
  );

  if (allPosPaired && allNegPaired) {
    return "CONVERGENT";
  }

  // If there are unmatched actions, interaction is ongoing or stuck
  if (pairs.length > 0) {
    return "ONGOING";
  }

  return "STUCK";
}

/**
 * Compute intersection of two disputes
 * 
 * [D F] ∩ [E G] = interaction between two disputes
 */
function computeDisputeIntersection(
  dispute1: Dispute,
  dispute2: Dispute
): DisputeIntersection {
  const trace: IntersectionTraceStep[] = [];
  const maxSteps = 100;
  let step = 0;

  // Get action sequences from disputes
  const actions1 = dispute1.pairs.map((p) => ({
    focus: p.locusPath,
    posActId: p.posActId,
    negActId: p.negActId,
  }));

  const actions2 = dispute2.pairs.map((p) => ({
    focus: p.locusPath,
    posActId: p.posActId,
    negActId: p.negActId,
  }));

  // Simulate intersection by comparing action sequences
  while (step < maxSteps) {
    const action1 = actions1[step];
    const action2 = actions2[step];

    // One dispute terminated - convergence
    if (!action1 || !action2) {
      return {
        dispute1Id: dispute1.id,
        dispute2Id: dispute2.id,
        converges: true,
        convergenceType: determineConvergenceType(dispute1, dispute2),
        trace,
      };
    }

    // Check if actions are compatible (same focus)
    const compatible = action1.focus === action2.focus;

    trace.push({
      step,
      action1: {
        focus: action1.focus,
        ramification: [],
        polarity: "P",
        actId: action1.posActId,
      },
      action2: {
        focus: action2.focus,
        ramification: [],
        polarity: "O",
        actId: action2.posActId,
      },
      compatible,
    });

    // Incompatible actions - divergence
    if (!compatible) {
      return {
        dispute1Id: dispute1.id,
        dispute2Id: dispute2.id,
        converges: false,
        convergenceType: "divergent",
        trace,
      };
    }

    step++;
  }

  // Reached max steps without termination - divergence
  return {
    dispute1Id: dispute1.id,
    dispute2Id: dispute2.id,
    converges: false,
    convergenceType: "divergent",
    trace,
  };
}

/**
 * Determine convergence type based on dispute outcomes
 */
function determineConvergenceType(
  dispute1: Dispute,
  dispute2: Dispute
): "positive" | "negative" | "divergent" {
  if (
    dispute1.status === "CONVERGENT" &&
    dispute2.status === "CONVERGENT"
  ) {
    return "positive";
  }
  if (
    dispute1.status === "DIVERGENT" ||
    dispute2.status === "DIVERGENT"
  ) {
    return "divergent";
  }
  return "negative";
}

/**
 * Find the point of divergence in an intersection
 */
function findDivergencePoint(intersection: DisputeIntersection): string {
  const divergentStep = intersection.trace?.find((t) => !t.compatible);
  if (divergentStep) {
    return `Step ${divergentStep.step}: ${divergentStep.action1?.focus} vs ${divergentStep.action2?.focus}`;
  }
  return "Unknown";
}

/**
 * Check direct interaction between two designs
 */
async function checkDesignInteraction(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence
): Promise<{
  converges: boolean;
  convergenceType?: "positive" | "negative";
  divergencePoint?: string;
}> {
  const acts1 = design1.acts || [];
  const acts2 = design2.acts || [];

  // Check for compatible initial actions
  const initial1 = acts1[0];
  const initial2 = acts2[0];

  if (!initial1 || !initial2) {
    return { converges: true, convergenceType: "positive" };
  }

  // Check polarity compatibility
  if (initial1.polarity === initial2.polarity) {
    return {
      converges: false,
      divergencePoint: "Initial actions have same polarity",
    };
  }

  // Check locus compatibility
  if (initial1.locusPath !== initial2.locusPath) {
    return {
      converges: false,
      divergencePoint: `Locus mismatch: ${initial1.locusPath} vs ${initial2.locusPath}`,
    };
  }

  // Simulate interaction
  let convergent = false;
  for (let i = 0; i < Math.min(acts1.length, acts2.length); i++) {
    const act1 = acts1[i];
    const act2 = acts2[i];

    // Check for daimon
    if (act1.kind === "DAIMON" || act2.kind === "DAIMON") {
      convergent = true;
      break;
    }

    // Check for ramification compatibility
    const ram1 = new Set(act1.ramification);
    const ram2 = new Set(act2.ramification);
    const hasCommonRam = [...ram1].some((r) => ram2.has(r));

    if (!hasCommonRam && ram1.size > 0 && ram2.size > 0) {
      return {
        converges: false,
        divergencePoint: `Ramification mismatch at step ${i}`,
      };
    }
  }

  return {
    converges: convergent,
    convergenceType: convergent ? "positive" : undefined,
    divergencePoint: convergent ? undefined : "No convergence point found",
  };
}

/**
 * Infer the polarity of a design from its first action
 */
function inferDesignPolarity(design: DesignForCorrespondence): "P" | "O" {
  const firstAct = design.acts?.[0];
  if (!firstAct) return "P";
  
  // Map different polarity representations
  if (firstAct.polarity === "P" || firstAct.polarity === "O") {
    return firstAct.polarity;
  }
  
  // Handle positive/negative naming
  if (firstAct.kind === "POSITIVE") return "P";
  if (firstAct.kind === "NEGATIVE") return "O";
  
  return "P"; // Default to proponent
}

/**
 * Check if two designs are orthogonal (convenience function)
 */
export async function areOrthogonal(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence,
  method: "basic" | "refined" = "basic",
  allDesigns?: DesignForCorrespondence[]
): Promise<boolean> {
  if (method === "refined" && allDesigns) {
    const result = await checkOrthogonalityRefined(design1, design2, allDesigns);
    return result.isOrthogonal;
  }
  const result = await checkOrthogonalityBasic(design1, design2);
  return result.isOrthogonal;
}

/**
 * Find all designs orthogonal to a given design
 */
export async function findOrthogonalDesigns(
  design: DesignForCorrespondence,
  candidates: DesignForCorrespondence[],
  method: "basic" | "refined" = "basic"
): Promise<DesignForCorrespondence[]> {
  const orthogonals: DesignForCorrespondence[] = [];

  for (const candidate of candidates) {
    if (candidate.id === design.id) continue;

    const isOrth = await areOrthogonal(
      design,
      candidate,
      method,
      method === "refined" ? candidates : undefined
    );

    if (isOrth) {
      orthogonals.push(candidate);
    }
  }

  return orthogonals;
}

/**
 * Check orthogonality symmetry: D ⊥ E implies E ⊥ D
 */
export async function verifyOrthogonalitySymmetry(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence
): Promise<{
  isSymmetric: boolean;
  forward: OrthogonalityResult;
  backward: OrthogonalityResult;
}> {
  const forward = await checkOrthogonalityBasic(design1, design2);
  const backward = await checkOrthogonalityBasic(design2, design1);

  return {
    isSymmetric: forward.isOrthogonal === backward.isOrthogonal,
    forward,
    backward,
  };
}
