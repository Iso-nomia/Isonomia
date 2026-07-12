/**
 * Bidirectional Transformations
 * 
 * Based on Faggian & Hyland (2002) - §4.3
 * Design ↔ Strategy transformations via Disp and Ch
 */

import type { Action, View, Chronicle } from "../types";
import type { Strategy, Play } from "../strategy/types";
import type {
  TransformResult,
  DesignForCorrespondence,
  DesignAct,
  Correspondence,
  IsomorphismResults,
} from "./types";
import { computeDisp, disputesToPlays } from "./disp";
import { computeCh, chroniclesToActs } from "./ch";
import { checkAllIsomorphisms, allIsomorphismsHold } from "./isomorphisms";

/**
 * Transform Design → Strategy (via Disp)
 */
export function designToStrategy(
  design: DesignForCorrespondence,
  counterDesigns: DesignForCorrespondence[]
): { strategy: Strategy; transform: TransformResult } {
  // Compute Disp(D)
  const dispResult = computeDisp(design, counterDesigns);

  // Determine player
  const player: "P" | "O" = design.participantId === "Proponent" ? "P" : "O";

  // Convert disputes to plays
  const playData = disputesToPlays(dispResult.disputes, player);
  const plays: Play[] = playData.map((p, idx) => ({
    id: `play-${design.id}-${idx}`,
    strategyId: design.id,
    sequence: p.sequence,
    length: p.length,
    isPositive: p.isPositive,
  }));

  // Create strategy
  const strategy: Strategy = {
    id: `strategy-${design.id}`,
    designId: design.id,
    player,
    plays,
    isInnocent: false, // Will need to be checked separately
    satisfiesPropagation: false,
  };

  // Create transform result
  const transform: TransformResult = {
    source: "design",
    target: "strategy",
    sourceId: design.id,
    targetId: strategy.id,
    verified: false,
    transformedAt: new Date(),
  };

  return { strategy, transform };
}

/**
 * Transform Strategy → Design (via Ch)
 */
export function strategyToDesign(
  strategy: Strategy,
  originalDesignId?: string
): { design: DesignForCorrespondence; transform: TransformResult } {
  // Compute Ch(S)
  const chResult = computeCh(strategy);

  // Convert chronicles to design acts
  const actsData = chroniclesToActs(chResult.chronicles, strategy.designId);

  // Create design acts
  const acts: DesignAct[] = actsData.map((act, idx) => ({
    id: `act-${strategy.id}-${idx}`,
    designId: originalDesignId || strategy.designId,
    kind: act.locusPath === "0" ? "INITIAL" : "POSITIVE",
    polarity: act.polarity,
    locusPath: act.locusPath,
    ramification: act.ramification,
  }));

  // Create design
  const design: DesignForCorrespondence = {
    id: originalDesignId || `design-from-${strategy.id}`,
    deliberationId: "",
    participantId: strategy.player === "P" ? "Proponent" : "Opponent",
    acts,
    loci: actsData.map((act, idx) => ({
      id: `locus-${strategy.id}-${idx}`,
      designId: originalDesignId || strategy.designId,
      path: act.locusPath,
    })),
  };

  // Create transform result
  const transform: TransformResult = {
    source: "strategy",
    target: "design",
    sourceId: strategy.id,
    targetId: design.id,
    verified: false,
    transformedAt: new Date(),
  };

  return { design, transform };
}

/**
 * Round-trip: Design → Strategy → Design
 * Returns true if design is preserved
 */
export function roundTripDesign(
  design: DesignForCorrespondence,
  counterDesigns: DesignForCorrespondence[]
): {
  preserved: boolean;
  originalDesign: DesignForCorrespondence;
  strategy: Strategy;
  reconstructedDesign: DesignForCorrespondence;
} {
  // Design → Strategy
  const { strategy } = designToStrategy(design, counterDesigns);

  // Strategy → Design
  const { design: reconstructedDesign } = strategyToDesign(strategy, design.id);

  // Compare
  const preserved = designsEqual(design, reconstructedDesign);

  return {
    preserved,
    originalDesign: design,
    strategy,
    reconstructedDesign,
  };
}

/**
 * Round-trip: Strategy → Design → Strategy
 * Returns true if strategy is preserved
 */
export function roundTripStrategy(
  strategy: Strategy,
  counterDesigns: DesignForCorrespondence[]
): {
  preserved: boolean;
  originalStrategy: Strategy;
  design: DesignForCorrespondence;
  reconstructedStrategy: Strategy;
} {
  // Strategy → Design
  const { design } = strategyToDesign(strategy);

  // Design → Strategy
  const { strategy: reconstructedStrategy } = designToStrategy(design, counterDesigns);

  // Compare
  const preserved = strategiesEqual(strategy, reconstructedStrategy);

  return {
    preserved,
    originalStrategy: strategy,
    design,
    reconstructedStrategy,
  };
}

/**
 * Verify full correspondence between design and strategy
 */
export function verifyCorrespondence(
  design: DesignForCorrespondence,
  strategy: Strategy,
  counterDesigns: DesignForCorrespondence[]
): Correspondence {
  // Check all isomorphisms
  const isomorphisms = checkAllIsomorphisms(design, strategy, counterDesigns);
  const isVerified = allIsomorphismsHold(isomorphisms);

  return {
    id: `correspondence-${design.id}-${strategy.id}`,
    designId: design.id,
    strategyId: strategy.id,
    type: "design-to-strategy",
    isVerified,
    isomorphisms,
  };
}

/**
 * Create correspondence from design
 */
export function createCorrespondenceFromDesign(
  design: DesignForCorrespondence,
  counterDesigns: DesignForCorrespondence[]
): {
  correspondence: Correspondence;
  strategy: Strategy;
} {
  // Transform design to strategy
  const { strategy } = designToStrategy(design, counterDesigns);

  // Verify correspondence
  const correspondence = verifyCorrespondence(design, strategy, counterDesigns);

  return { correspondence, strategy };
}

/**
 * Create correspondence from strategy
 */
export function createCorrespondenceFromStrategy(
  strategy: Strategy,
  counterDesigns: DesignForCorrespondence[]
): {
  correspondence: Correspondence;
  design: DesignForCorrespondence;
} {
  // Transform strategy to design
  const { design } = strategyToDesign(strategy);

  // Verify correspondence
  const correspondence = verifyCorrespondence(design, strategy, counterDesigns);

  return { correspondence, design };
}

// Helper functions

/**
 * Check if two designs are equal
 */
function designsEqual(
  d1: DesignForCorrespondence,
  d2: DesignForCorrespondence
): boolean {
  // Compare by act structure
  if (d1.acts.length !== d2.acts.length) return false;

  const acts1 = new Map(d1.acts.map(a => [a.locusPath, a]));
  const acts2 = new Map(d2.acts.map(a => [a.locusPath, a]));

  for (const [path, act1] of acts1) {
    const act2 = acts2.get(path);
    if (!act2) return false;
    if (act1.polarity !== act2.polarity) return false;
    if (JSON.stringify(act1.ramification.sort()) !== JSON.stringify(act2.ramification.sort())) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two strategies are equal
 */
function strategiesEqual(s1: Strategy, s2: Strategy): boolean {
  if (s1.plays.length !== s2.plays.length) return false;

  const keys1 = new Set(s1.plays.map(p => playToKey(p)));
  const keys2 = new Set(s2.plays.map(p => playToKey(p)));

  for (const key of keys1) {
    if (!keys2.has(key)) return false;
  }

  return true;
}

/**
 * Create key for play
 */
function playToKey(play: Play): string {
  return play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
}

/**
 * Get transformation summary
 */
export function getTransformationSummary(result: TransformResult): string {
  const direction = result.source === "design" 
    ? "Design → Strategy (via Disp)" 
    : "Strategy → Design (via Ch)";
  
  return `${direction}: ${result.sourceId} → ${result.targetId}${result.verified ? " ✓" : ""}`;
}

/**
 * Check if transformation is valid
 */
export function isValidTransformation(
  transform: TransformResult,
  correspondence: Correspondence
): boolean {
  return (
    transform.sourceId === correspondence.designId ||
    transform.sourceId === correspondence.strategyId
  ) && correspondence.isVerified;
}
