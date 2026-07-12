// lib/schemes/practical-premise-types.ts
//
// Item 4 of the practical-reasoning enhancements
// (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/11b-practical-reasoning-enhancements-2026-06-12.md):
// "open-by-default, raise-by-instantiation" critical questions.
//
// This is the per-CQ Carneades `premiseType` assignment for the practical-
// reasoning scheme — the data half of the planned Spec 3 phase 3d rollout
// ("Carneades premiseType defaults"). The MACHINERY already exists and ships:
//   • `CriticalQuestion.premiseType` column (ORDINARY | ASSUMPTION | EXCEPTION)
//   • `autoWaiveAssumptions` in lib/schemes/protocol/soundnessGate.ts:
//       a `not-offered` ASSUMPTION premise auto-waives at instance-close, i.e.
//       it does NOT block close unless a challenger actually raises it.
//   • `isSchemeRequired` in lib/schemes/protocol/instanceState.ts: ASSUMPTION is
//       NOT scheme-required; ORDINARY / EXCEPTION / unset ARE.
//
// What was missing: the PR-family CQs carried NO premiseType (null → treated as
// required, blocking close until each is discharged). That makes every CQ a
// proponent obligation, which is NOT how Walton's practical reasoning works —
// PR is a "fast and frugal" presumption: goal + means yield a presumptive
// `ought`, and the remaining CQs are the *challenger's* tools, not the
// proponent's burden.
//
// The default for any CQ NOT mapped here remains ORDINARY (Walton 2008 §11.1;
// audits/phase4-closure-20260529.md) — so `premiseTypeFor` returns `undefined`
// for unmapped CQs and the seed leaves their premiseType untouched. Only the
// `practical_reasoning` CQs below are assigned, conservatively.

import type { PremiseType } from "@prisma/client";

/**
 * Carneades premiseType for the `practical_reasoning` CQs (Walton 2008 PR;
 * Gordon & Walton 2007 Carneades). Rationale per entry:
 *
 *   PR.GOAL_ACCEPTED  ASSUMPTION  — the agent's goal G is presumed (Walton: "I
 *                                   have a goal G"); challengeable but not a
 *                                   standing proponent burden.
 *   PR.MEANS_EFFECTIVE ORDINARY   — the means-end link ("A achieves G") is the
 *                                   inferential warrant; the proponent must
 *                                   support it. This is the one CQ that blocks
 *                                   close by default.
 *   PR.ALTERNATIVES   ASSUMPTION  — the canonical "is there a better
 *                                   alternative?" CQ; raise-by-instantiation
 *                                   (challenger must name an alternative).
 *   PR.SIDE_EFFECTS   ASSUMPTION  — the side-effects CQ; raise-by-instantiation
 *                                   (challenger must name a consequence). Pairs
 *                                   with the item-2 `opens` edge to
 *                                   negative_consequences.
 *   PR.FEASIBILITY    ASSUMPTION  — feasibility is presumed unless questioned.
 *   PR.PERMISSIBILITY ASSUMPTION  — permissibility is presumed unless questioned.
 *
 * Net effect: a PR argument offering only goal + means closes presumptively
 * (the four ASSUMPTION CQs auto-waive); any of them that a challenger actually
 * raises re-blocks close until adjudicated — exactly "open-by-default,
 * raise-by-instantiation."
 */
const PRACTICAL_REASONING_PREMISE_TYPES: Record<string, PremiseType> = {
  "PR.GOAL_ACCEPTED": "ASSUMPTION",
  "PR.MEANS_EFFECTIVE": "ORDINARY",
  "PR.ALTERNATIVES": "ASSUMPTION",
  "PR.SIDE_EFFECTS": "ASSUMPTION",
  "PR.FEASIBILITY": "ASSUMPTION",
  "PR.PERMISSIBILITY": "ASSUMPTION",
};

/**
 * The full per-scheme premiseType map. Only schemes with a deliberate,
 * Walton-grounded assignment appear; everything else defaults to ORDINARY at
 * consumption time (i.e. `premiseTypeFor` returns `undefined`, and callers
 * leave the column untouched / treat it as the ORDINARY default).
 */
export const PRACTICAL_PREMISE_TYPES: Record<string, Record<string, PremiseType>> = {
  practical_reasoning: PRACTICAL_REASONING_PREMISE_TYPES,
};

/**
 * The mapped Carneades premiseType for a (schemeKey, cqKey), or `undefined`
 * when there is no deliberate assignment (caller should leave premiseType as-is
 * / treat as the ORDINARY default — do NOT coerce unmapped CQs).
 */
export function premiseTypeFor(
  schemeKey: string,
  cqKey: string
): PremiseType | undefined {
  return PRACTICAL_PREMISE_TYPES[schemeKey]?.[cqKey];
}
