// lib/schemes/divergence-type.ts
//
// Item 5 of the practical-reasoning enhancements
// (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/11b-practical-reasoning-enhancements-2026-06-12.md):
// the FACTUAL / EVALUATIVE / STRUCTURAL read-model over CQ metadata.
//
// This is the de-Lumered shadow of the spec's "typed divergence locus" (docs/
// Practical Argumentation Research for Isonomia.md §4) — WITHOUT the netting
// object, the DesirabilityProfile, or any new schema. When two parties disagree
// at a critical question, the *kind* of disagreement is read off the CQ's
// semantics:
//   • FACTUAL    — the dispute is about whether something is the case (a
//                  consequence, a causal/means-end link, a probability).
//                  Resolvable by evidence → route to citation machinery.
//   • EVALUATIVE — the dispute is about a value, a goal's acceptability, a
//                  weight, or a norm. Resolvable (if at all) by deliberation
//                  → route to facilitation.
//   • STRUCTURAL — the dispute is about the option/alternatives set or
//                  feasibility (which actions are even on the table).
//                  Resolvable by instantiation (name the alternative).
//
// It is a pure heuristic read-model: no DB write, no migration, no theorem. The
// session-11 conjecture that the *minimal separating context* is canonically
// typed lives at Q-047(iv) and is NOT claimed here — this is its engineering
// shadow, and every classification discloses its `basis` ("mapped" | "heuristic"
// | "unknown") so the routing is auditable and never silently guessed.

export type DivergenceType = "FACTUAL" | "EVALUATIVE" | "STRUCTURAL";

export type DivergenceBasis = "mapped" | "heuristic" | "unknown";

export interface DivergenceClassification {
  type: DivergenceType | null;
  basis: DivergenceBasis;
  rationale: string;
}

export type TargetScope = "conclusion" | "premise" | "inference";

/**
 * Explicit per-CQ divergence types for the practical-reasoning family — the
 * single source of truth, decided from each CQ's actual semantics (which a
 * generic targetScope rule cannot recover: e.g. PR.SIDE_EFFECTS and
 * PR.MEANS_EFFECTIVE are both FACTUAL but sit on different scopes, and
 * PR.PERMISSIBILITY is EVALUATIVE despite being conclusion-scoped).
 */
const PRACTICAL_DIVERGENCE_TYPES: Record<string, Record<string, DivergenceType>> = {
  practical_reasoning: {
    "PR.GOAL_ACCEPTED": "EVALUATIVE", // is the goal/value acceptable
    "PR.MEANS_EFFECTIVE": "FACTUAL", // does A actually achieve G (causal link)
    "PR.ALTERNATIVES": "STRUCTURAL", // is a better option on the table
    "PR.SIDE_EFFECTS": "FACTUAL", // do the consequences occur
    "PR.FEASIBILITY": "STRUCTURAL", // is A even doable (option viability)
    "PR.PERMISSIBILITY": "EVALUATIVE", // is A permissible given norms
  },
  positive_consequences: {
    "PC.LIKELIHOOD": "FACTUAL", // are the good consequences likely
    "PC.SIGNIFICANCE": "EVALUATIVE", // significant enough to justify
    "PC.NEG_SIDE": "FACTUAL", // are there overlooked negative effects
  },
  negative_consequences: {
    "NC.LIKELIHOOD": "FACTUAL", // are the bad consequences likely
    "NC.MITIGATION": "FACTUAL", // can the effects be mitigated
    "NC.TRADEOFFS": "EVALUATIVE", // do benefits outweigh the bad effects
  },
  value_based_pr: {
    "VB.RELEVANCE": "EVALUATIVE", // is value V applicable here
    "VB.PROMOTES": "FACTUAL", // does A actually promote V
    "VB.CONFLICT": "EVALUATIVE", // is there a weightier conflicting value
  },
};

export const DIVERGENCE_TYPES = PRACTICAL_DIVERGENCE_TYPES;

/**
 * Generic fallback for CQs without an explicit mapping. Honest and coarse:
 *   • inference-scope → FACTUAL  (inferential/warrant links are typically
 *                                 empirical "does X support Y" disputes)
 *   • premise-scope   → FACTUAL  (premise truth is usually a matter of fact;
 *                                 value premises are the exception, which is
 *                                 exactly why the explicit map exists)
 *   • conclusion-scope → EVALUATIVE (rebuttals at the conclusion of an action/
 *                                 ought argument usually turn on values/norms)
 * Returns `null` when even the scope is unknown.
 */
function heuristicFromScope(scope: TargetScope | null | undefined): {
  type: DivergenceType | null;
  rationale: string;
} {
  switch (scope) {
    case "inference":
      return { type: "FACTUAL", rationale: "inference-scope CQ → factual warrant dispute (heuristic)" };
    case "premise":
      return { type: "FACTUAL", rationale: "premise-scope CQ → premise-truth dispute (heuristic)" };
    case "conclusion":
      return { type: "EVALUATIVE", rationale: "conclusion-scope CQ on an action/ought argument → value/norm dispute (heuristic)" };
    default:
      return { type: null, rationale: "no explicit mapping and no targetScope — type unknown" };
  }
}

/**
 * Classify the kind of disagreement a critical question represents.
 * Prefers the explicit per-CQ map; falls back to a transparent scope heuristic.
 */
export function classifyDivergence(
  schemeKey: string,
  cqKey: string,
  targetScope?: TargetScope | null
): DivergenceClassification {
  const mapped = PRACTICAL_DIVERGENCE_TYPES[schemeKey]?.[cqKey];
  if (mapped) {
    return { type: mapped, basis: "mapped", rationale: `explicit ${schemeKey}.${cqKey} mapping` };
  }
  const h = heuristicFromScope(targetScope);
  return {
    type: h.type,
    basis: h.type ? "heuristic" : "unknown",
    rationale: h.rationale,
  };
}

/** The mapped divergence type for a (schemeKey, cqKey), or undefined if unmapped. */
export function divergenceTypeFor(
  schemeKey: string,
  cqKey: string
): DivergenceType | undefined {
  return PRACTICAL_DIVERGENCE_TYPES[schemeKey]?.[cqKey];
}
