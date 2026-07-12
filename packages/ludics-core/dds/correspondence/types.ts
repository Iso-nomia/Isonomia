/**
 * Correspondence Types
 * 
 * Based on §4.3 of Faggian & Hyland (2002)
 * Types for Design ↔ Strategy correspondence
 */

import type { Action, Chronicle, Dispute, View, Position } from "../types";
import type { Strategy, Play } from "../strategy/types";

/**
 * Correspondence between design and strategy
 */
export type Correspondence = {
  id: string;
  designId: string;
  strategyId: string;
  type: "design-to-strategy" | "strategy-to-design";
  isVerified: boolean;
  isomorphisms: IsomorphismResults;
};

/**
 * Results of all four isomorphism checks
 * - Proposition 4.18: Plays(Views(S)) ≅ S
 * - Proposition 4.18: Views(Plays(V)) ≅ V
 * - Proposition 4.27: Disp(Ch(S)) ≅ S
 * - Proposition 4.27: Ch(Disp(D)) ≅ D
 */
export type IsomorphismResults = {
  playsViews: IsomorphismCheck;   // Plays(Views(S)) = S
  viewsPlays: IsomorphismCheck;   // Views(Plays(V)) = V
  dispCh: IsomorphismCheck;       // Disp(Ch(S)) = S
  chDisp: IsomorphismCheck;       // Ch(Disp(D)) = D
};

/**
 * Individual isomorphism check result
 */
export type IsomorphismCheck = {
  holds: boolean;
  checked: boolean;
  evidence?: IsomorphismEvidence;
};

/**
 * Evidence for isomorphism check
 */
export type IsomorphismEvidence = {
  originalCount?: number;
  reconstructedCount?: number;
  difference?: {
    inOriginal: number;
    inReconstructed: number;
    missing: string[];
    extra: string[];
  };
  error?: string;
  // Extended evidence for subset-based checks
  missingPlays?: string[];
  extraPlays?: string[];
  extraPlaysFromBroaderScope?: number;
  // Loci-based comparison
  originalLociCount?: number;
  reconstructedLociCount?: number;
  missingLoci?: string[];
};

/**
 * Disp(D) result - all disputes of design D
 */
export type DispResult = {
  designId: string;
  disputes: Dispute[];
  count: number;
  computedAt?: Date;
};

/**
 * Ch(S) result - all chronicles from strategy S
 */
export type ChResult = {
  strategyId: string;
  chronicles: Chronicle[];
  count: number;
  computedAt?: Date;
};

/**
 * Transformation result
 */
export type TransformResult = {
  source: "design" | "strategy";
  target: "strategy" | "design";
  sourceId: string;
  targetId: string;
  verified: boolean;
  transformedAt: Date;
};

/**
 * Design representation for correspondence
 * 
 * Note: loci is optional when acts already have locusPath embedded
 */
export type DesignForCorrespondence = {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: DesignAct[];
  loci?: DesignLocus[];
};

/**
 * Design act
 * 
 * Note: kind can be:
 * - From Prisma schema: "PROPER" | "DAIMON"
 * - From theoretical types: "INITIAL" | "POSITIVE" | "NEGATIVE" | "DAIMON"
 * 
 * PROPER maps to POSITIVE/NEGATIVE based on polarity context
 */
export type DesignAct = {
  id: string;
  designId: string;
  kind: "INITIAL" | "POSITIVE" | "NEGATIVE" | "DAIMON" | "PROPER";
  polarity: "P" | "O";
  expression?: string;
  locusId?: string;
  locusPath?: string;
  ramification: (string | number)[];
  orderInDesign?: number;
};

/**
 * Design locus
 */
export type DesignLocus = {
  id: string;
  designId: string;
  path: string;
};

/**
 * Verification context for correspondence checking
 */
export type VerificationContext = {
  design: DesignForCorrespondence;
  strategy: Strategy;
  views: View[];
  chronicles: Chronicle[];
  disputes: Dispute[];
};

/**
 * Verification summary
 */
export type VerificationSummary = {
  correspondenceId: string;
  allIsomorphismsHold: boolean;
  isomorphismDetails: {
    name: string;
    holds: boolean;
    checked: boolean;
    reason?: string;
  }[];
  recommendations: string[];
};
