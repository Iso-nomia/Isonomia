/**
 * Spec 4 §3.4 — non-redundancy candidate filter.
 *
 * Pure function. Given a draft scheme and the catalogue, returns the subset
 * of existing schemes the verifier should be run against. Filter rules:
 *
 *   1. clusterTag matches OR existing.clusterTag is unset (null/empty)
 *   2. premise-variable signatures intersect by ≥ 1
 *   3. |existing.cqs| ∈ [max(1, |draft.cqs| - 2), |draft.cqs| + 2]
 *   4. existing.id !== draft.id (do not compare a scheme to itself in edit mode)
 *
 * The intent is to keep the candidate set typically O(10) so the verifier
 * runs synchronously inside the endpoint without surprising the admin.
 */

export type DraftSchemeShape = {
  id?: string | null; // present in edit mode; absent in create mode
  clusterTag?: string | null;
  premises?: unknown; // raw JSON; we extract variables defensively
  cqs: Array<{ cqKey?: string | null; text?: string | null }>;
};

export type CandidateSchemeShape = {
  id: string;
  key: string;
  name: string | null;
  clusterTag: string | null;
  premises: unknown;
  cqs: Array<{ cqKey: string; text: string }>;
};

function premiseVariables(premises: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(premises)) return out;
  for (const p of premises as any[]) {
    const vs = p?.variables;
    if (Array.isArray(vs)) {
      for (const v of vs) {
        if (typeof v === "string" && v.length > 0) out.add(v);
      }
    }
  }
  return out;
}

export function selectCandidates(
  draft: DraftSchemeShape,
  catalogue: CandidateSchemeShape[],
): CandidateSchemeShape[] {
  const draftVars = premiseVariables(draft.premises);
  const draftCqCount = draft.cqs.length;
  const lo = Math.max(1, draftCqCount - 2);
  const hi = draftCqCount + 2;
  const draftCluster = (draft.clusterTag ?? "").trim() || null;

  return catalogue.filter((c) => {
    if (draft.id && c.id === draft.id) return false;

    // Rule 1: clusterTag compatibility
    const cCluster = (c.clusterTag ?? "").trim() || null;
    if (draftCluster && cCluster && cCluster !== draftCluster) return false;
    // (if either side is null, rule passes)

    // Rule 3: CQ count window
    const cqCount = c.cqs.length;
    if (cqCount < lo || cqCount > hi) return false;

    // Rule 2: premise-variable overlap
    // If the draft has no declared variables we cannot apply this filter
    // soundly — fall back to "include" so the verifier still gets a chance.
    if (draftVars.size > 0) {
      const cVars = premiseVariables(c.premises);
      if (cVars.size === 0) {
        // candidate has no declared variables — keep it (cannot exclude soundly)
      } else {
        let overlap = 0;
        for (const v of draftVars) {
          if (cVars.has(v)) {
            overlap += 1;
            break;
          }
        }
        if (overlap < 1) return false;
      }
    }

    return true;
  });
}
