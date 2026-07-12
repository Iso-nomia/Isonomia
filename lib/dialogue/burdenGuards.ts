// lib/dialogue/burdenGuards.ts
//
// Phase 3d (dialogue-UI polish) — pure legality helpers that gate
// the move composer's affordances against a CQ's burdenOfProof and
// the current actor's role (proponent vs other).
//
// No React, no DB, no fetches. Composer UI imports these to decide
// disabled state + tooltip; the server `/api/dialogue/move` route
// uses an analogous evidence-required check (defence-in-depth).
//
// Legality table (spec §4.1):
//
//   | Move    | PROPONENT burden | CHALLENGER burden |
//   |---------|------------------|-------------------|
//   | WHY     | challenger       | challenger        |
//   | GROUNDS | proponent        | challenger        |
//   | CONCEDE | proponent        | challenger        |
//   | RETRACT | proponent        | challenger        |
//
// OPPONENT is treated as a synonym for CHALLENGER (unused in
// catalogue today; preserved for forward-compatibility).

import type { BurdenOfProof, PremiseType } from "@prisma/client";

export type MoveKind = "WHY" | "GROUNDS" | "CONCEDE" | "RETRACT";

/** Normalise the enum: OPPONENT → CHALLENGER for legality purposes. */
function normalize(burden: BurdenOfProof): "PROPONENT" | "CHALLENGER" {
  return burden === "PROPONENT" ? "PROPONENT" : "CHALLENGER";
}

/** A challenger may always WHY-question, regardless of where the burden lies. */
export function canPostWhy(burden: BurdenOfProof, isProponent: boolean): boolean {
  return !isProponent;
}

/** The party who carries the burden owes the GROUNDS. */
export function canPostGrounds(burden: BurdenOfProof, isProponent: boolean): boolean {
  const n = normalize(burden);
  return (n === "PROPONENT" && isProponent) || (n === "CHALLENGER" && !isProponent);
}

/** Concede is symmetric to grounds: the burdened party concedes. */
export function canConcede(burden: BurdenOfProof, isProponent: boolean): boolean {
  return canPostGrounds(burden, isProponent);
}

/** Retract follows the same pattern. */
export function canRetract(burden: BurdenOfProof, isProponent: boolean): boolean {
  return canPostGrounds(burden, isProponent);
}

export interface CqEvidenceContext {
  burdenOfProof: BurdenOfProof;
  requiresEvidence: boolean;
}

/**
 * Whether the *current actor* owes evidence on this CQ.
 * Short-circuits to `false` when `requiresEvidence` is false.
 */
export function requiresEvidenceFromActor(
  cq: CqEvidenceContext,
  isProponent: boolean
): boolean {
  if (!cq.requiresEvidence) return false;
  const n = normalize(cq.burdenOfProof);
  return (n === "PROPONENT" && isProponent) || (n === "CHALLENGER" && !isProponent);
}

/** Single dispatch helper for the composer's per-button gating. */
export function canPostMove(
  kind: MoveKind,
  burden: BurdenOfProof,
  isProponent: boolean
): boolean {
  switch (kind) {
    case "WHY":     return canPostWhy(burden, isProponent);
    case "GROUNDS": return canPostGrounds(burden, isProponent);
    case "CONCEDE": return canConcede(burden, isProponent);
    case "RETRACT": return canRetract(burden, isProponent);
  }
}

/** Tooltip copy for a disabled button. */
export function disabledTooltip(kind: MoveKind, burden: BurdenOfProof): string {
  const owner = normalize(burden) === "PROPONENT" ? "proponent" : "challenger";
  switch (kind) {
    case "WHY":
      return `Only the challenger can ask WHY on this question.`;
    case "GROUNDS":
      return `Only the ${owner} can post GROUNDS on this question.`;
    case "CONCEDE":
      return `Only the ${owner} can concede this question.`;
    case "RETRACT":
      return `Only the ${owner} can retract on this question.`;
  }
}

/** PremiseType-tinted header copy (spec §4.3). */
export function premiseTypeHeader(premiseType?: PremiseType | null): {
  text: string | null;
  borderClass: string | null;
} {
  switch (premiseType) {
    case "ASSUMPTION":
      return {
        text: "Assumption — accepted unless explicitly challenged.",
        borderClass: "border-l-2 border-sky-300 pl-2",
      };
    case "EXCEPTION":
      return {
        text: "Exception — the challenger must establish that this exception applies.",
        borderClass: "border-l-2 border-amber-300 pl-2",
      };
    default:
      return { text: null, borderClass: null };
  }
}
