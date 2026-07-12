/**
 * Roadmap A.2 — per-field-group round-trip soundness for the AIF export.
 *
 * Surfaces the Q-020 "exposed-vs-absent" classification: for each Carneades
 * premise-type group the primary scheme carries CQs for, is that obligation
 * *exposed* as AIF structure (so a re-importer can reconstruct it) or *absent*
 * (silently dropped on round-trip)?
 *
 *   - ORDINARY   → exposed via `aif:Premise` edges (I → RA)
 *   - ASSUMPTION → exposed via `as:HasPresumption` edges (RA → I)
 *   - EXCEPTION  → exposed via `as:HasException` edges (RA → I)
 *
 * A group with `cqCount > 0` but `aifExposure === "absent"` is lossy: the
 * dialectical obligation exists in the scheme apparatus but has no carrier in
 * the exported subgraph. `lossy` flips true if any group is in that state.
 */

import type { ArgumentAttestation } from "@/lib/citations/argumentAttestation";

export type PremiseGroup = "ORDINARY" | "ASSUMPTION" | "EXCEPTION";

export interface RoundTripSoundness {
  schemeKey: string | null;
  groups: Record<
    PremiseGroup,
    { cqCount: number; aifExposure: "exposed" | "absent" }
  >;
  lossy: boolean;
}

export function computeRoundTripSoundness(
  att: ArgumentAttestation,
  aifGraph: { "@graph"?: unknown[] } | null,
): RoundTripSoundness {
  const cqs = att.criticalQuestions;
  const schemeKey = att.scheme?.key ?? null;
  const sNodeId = `S:${att.argumentId}`;
  const nodes = Array.isArray(aifGraph?.["@graph"]) ? aifGraph!["@graph"]! : [];

  const hasEdgeOfType = (type: string, endpoint: "from" | "to") =>
    nodes.some((raw) => {
      const n = raw as Record<string, unknown>;
      const t = n["@type"];
      const matchesType = Array.isArray(t) ? t.includes(type) : t === type;
      if (!matchesType) return false;
      return n[`aif:${endpoint}`] === sNodeId;
    });

  const exposure: Record<PremiseGroup, boolean> = {
    ORDINARY: hasEdgeOfType("aif:Premise", "to"),
    ASSUMPTION: hasEdgeOfType("as:HasPresumption", "from"),
    EXCEPTION: hasEdgeOfType("as:HasException", "from"),
  };

  const allCqs = cqs
    ? [...cqs.answered, ...cqs.partiallyAnswered, ...cqs.unanswered]
    : [];
  const countOf = (g: PremiseGroup) =>
    allCqs.filter((c) => c.premiseType === g).length;

  const groups = (["ORDINARY", "ASSUMPTION", "EXCEPTION"] as PremiseGroup[]).reduce(
    (acc, g) => {
      const cqCount = countOf(g);
      acc[g] = {
        cqCount,
        aifExposure: exposure[g] ? ("exposed" as const) : ("absent" as const),
      };
      return acc;
    },
    {} as RoundTripSoundness["groups"],
  );

  const lossy = (Object.keys(groups) as PremiseGroup[]).some(
    (g) => groups[g].cqCount > 0 && groups[g].aifExposure === "absent",
  );

  return { schemeKey, groups, lossy };
}
