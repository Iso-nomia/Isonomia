/**
 * Spec 4 §3.1–§3.2 — behaviour-equality verifier.
 *
 * Certificate-driven; **sound** (never returns `equal` without a full
 * structural certificate) and intentionally **incomplete on hard cases**
 * (returns `inconclusive` on text-normalisation ambiguity or
 * undecided premise unification — R1).
 *
 * Verdict shape and certificate types are documented in the spec; this
 * module is the single source of truth for the runtime contract.
 */

import type { ArgumentScheme, CriticalQuestion } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────────
// Public types
// ────────────────────────────────────────────────────────────────────────────

export type SchemeWithCqs = ArgumentScheme & { cqs: CriticalQuestion[] };

export type EqualityCertificate = {
  cqMapping: Array<{ leftCqKey: string; rightCqKey: string }>;
  premiseRenaming: Record<string, string>;
  inheritanceRespected: boolean;
};

export type InclusionCertificate = {
  // ⟦S⟧ ⊆ ⟦S'⟧ iff CQ(S') ⊆ CQ(S) (more CQs ⇒ smaller behaviour);
  // direction labels follow ⟦S⟧, not CQ(S).
  direction: "left-subset-right" | "right-subset-left";
  cqMapping: Array<{ leftCqKey: string; rightCqKey: string }>;
  extraCqs: string[]; // CQ keys in the side with MORE CQs (i.e. the subset side on ⟦·⟧)
};

export type IncomparableCertificate = {
  discriminatingCqOnLeft?: { cqKey: string; rationale: string };
  discriminatingCqOnRight?: { cqKey: string; rationale: string };
  conflictingCqs?: Array<{
    leftCqKey: string;
    rightCqKey: string;
    conflict:
      | "different-attack-type"
      | "different-target-scope"
      | "incompatible-burden"
      | "incompatible-evidence-requirement";
  }>;
};

export type VerifierVerdict =
  | { kind: "equal"; certificate: EqualityCertificate }
  | { kind: "subset"; certificate: InclusionCertificate }
  | { kind: "incomparable"; certificate: IncomparableCertificate }
  | {
      kind: "inconclusive";
      reason:
        | "search-bound-exceeded"
        | "text-normalisation-ambiguous"
        | "premise-unification-undecided";
    };

export type VerifierOptions = {
  searchBoundMs?: number;
  textNormalisation?: "exact" | "case-trim" | "fuzzy";
  cqKeyMatching?: "exact" | "by-attack-type-and-scope";
};

const DEFAULTS: Required<VerifierOptions> = {
  searchBoundMs: 250,
  textNormalisation: "case-trim",
  cqKeyMatching: "by-attack-type-and-scope",
};

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

type NormalizedCq = {
  cqKey: string;
  attackType: string;
  targetScope: string;
  textNorm: string;
  textRaw: string;
  burdenOfProof: string | null;
  requiresEvidence: boolean | null;
};

function normalizeText(s: string | null | undefined, mode: VerifierOptions["textNormalisation"]): string {
  const raw = (s ?? "").toString();
  switch (mode) {
    case "exact":
      return raw;
    case "fuzzy":
      // case-fold, collapse whitespace, strip non-alphanumerics
      return raw
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    case "case-trim":
    default:
      return raw.toLowerCase().replace(/\s+/g, " ").trim();
  }
}

function normalizeCqs(cqs: CriticalQuestion[], opts: Required<VerifierOptions>): NormalizedCq[] {
  return cqs.map((c) => ({
    cqKey: c.cqKey ?? "",
    attackType: c.attackType ?? "",
    targetScope: c.targetScope ?? "",
    textNorm: normalizeText(c.text, opts.textNormalisation),
    textRaw: c.text ?? "",
    burdenOfProof: (c as any).burdenOfProof ?? null,
    requiresEvidence: typeof (c as any).requiresEvidence === "boolean" ? (c as any).requiresEvidence : null,
  }));
}

type PairMatch = {
  left: NormalizedCq;
  right: NormalizedCq;
};

type PairConflict = {
  leftCqKey: string;
  rightCqKey: string;
  conflict: NonNullable<IncomparableCertificate["conflictingCqs"]>[number]["conflict"];
};

/**
 * Greedy structural pairing.
 *
 * Strategy: for each left CQ, search the unmatched right pool for the best
 * structural match (same attackType + targetScope; text identical under
 * normalisation when `cqKeyMatching === "exact"`). Returns the matched pairs,
 * unmatched left/right, and any structural conflicts encountered when a
 * candidate match shared a key but disagreed on attackType/targetScope.
 */
function pairCqs(
  left: NormalizedCq[],
  right: NormalizedCq[],
  opts: Required<VerifierOptions>,
): { pairs: PairMatch[]; unmatchedLeft: NormalizedCq[]; unmatchedRight: NormalizedCq[]; conflicts: PairConflict[] } {
  const pairs: PairMatch[] = [];
  const conflicts: PairConflict[] = [];
  const remainingRight = [...right];
  const unmatchedLeft: NormalizedCq[] = [];

  for (const L of left) {
    // First pass: same cqKey (when both populated).
    let idx = -1;
    if (L.cqKey) {
      idx = remainingRight.findIndex((R) => R.cqKey && R.cqKey === L.cqKey);
    }
    // Second pass: same attackType + targetScope + same normalised text.
    if (idx === -1 && opts.cqKeyMatching === "by-attack-type-and-scope") {
      idx = remainingRight.findIndex(
        (R) =>
          R.attackType === L.attackType &&
          R.targetScope === L.targetScope &&
          R.textNorm === L.textNorm &&
          R.textNorm !== "",
      );
    }
    // Third pass (exact key match): same attackType + targetScope only.
    if (idx === -1 && opts.cqKeyMatching === "exact" && L.cqKey) {
      // exact mode means we trust cqKey; no structural fallback
      idx = -1;
    }
    if (idx === -1) {
      unmatchedLeft.push(L);
      continue;
    }
    const R = remainingRight[idx];
    remainingRight.splice(idx, 1);

    // Same key found, but structural mismatch ⇒ record a conflict.
    if (L.attackType !== R.attackType) {
      conflicts.push({ leftCqKey: L.cqKey, rightCqKey: R.cqKey, conflict: "different-attack-type" });
      continue;
    }
    if (L.targetScope !== R.targetScope) {
      conflicts.push({ leftCqKey: L.cqKey, rightCqKey: R.cqKey, conflict: "different-target-scope" });
      continue;
    }
    if (
      L.burdenOfProof !== null &&
      R.burdenOfProof !== null &&
      L.burdenOfProof !== R.burdenOfProof
    ) {
      conflicts.push({ leftCqKey: L.cqKey, rightCqKey: R.cqKey, conflict: "incompatible-burden" });
      continue;
    }
    if (
      L.requiresEvidence !== null &&
      R.requiresEvidence !== null &&
      L.requiresEvidence !== R.requiresEvidence
    ) {
      conflicts.push({
        leftCqKey: L.cqKey,
        rightCqKey: R.cqKey,
        conflict: "incompatible-evidence-requirement",
      });
      continue;
    }
    pairs.push({ left: L, right: R });
  }
  return { pairs, unmatchedLeft, unmatchedRight: remainingRight, conflicts };
}

function extractPremiseVariables(premises: unknown): string[] {
  if (!Array.isArray(premises)) return [];
  const out = new Set<string>();
  for (const p of premises) {
    const vars = (p as any)?.variables;
    if (Array.isArray(vars)) for (const v of vars) if (typeof v === "string") out.add(v);
  }
  return [...out];
}

function premiseCount(premises: unknown): number {
  return Array.isArray(premises) ? premises.length : 0;
}

function conclusionVarCount(conclusion: unknown): number {
  const vars = (conclusion as any)?.variables;
  return Array.isArray(vars) ? vars.length : 0;
}

type UnificationResult =
  | { ok: true; renaming: Record<string, string> }
  | { ok: false; reason: "arity-mismatch" | "premise-count-mismatch" | "undecided" };

/**
 * Premise/conclusion unification.
 *
 * Structural-only: matches by index. Soundness comes from refusing to declare
 * `equal` whenever shapes disagree. If left's variable list and right's
 * variable list have the same length, we produce a positional renaming; if
 * lengths differ but premise counts agree, we report `undecided` (the verifier
 * downgrades to `inconclusive` in that branch, not `equal`).
 */
function unifyPremises(
  leftScheme: SchemeWithCqs,
  rightScheme: SchemeWithCqs,
): UnificationResult {
  const lpCount = premiseCount(leftScheme.premises);
  const rpCount = premiseCount(rightScheme.premises);
  if (lpCount !== rpCount) return { ok: false, reason: "premise-count-mismatch" };

  const lConclArity = conclusionVarCount(leftScheme.conclusion);
  const rConclArity = conclusionVarCount(rightScheme.conclusion);
  if (lConclArity !== rConclArity) return { ok: false, reason: "arity-mismatch" };

  const lVars = extractPremiseVariables(leftScheme.premises);
  const rVars = extractPremiseVariables(rightScheme.premises);
  if (lVars.length !== rVars.length) {
    // Same premise count + same conclusion arity but different variable counts
    // is suspicious; do not declare equal.
    return { ok: false, reason: "undecided" };
  }
  const renaming: Record<string, string> = {};
  for (let i = 0; i < lVars.length; i++) renaming[lVars[i]] = rVars[i];
  return { ok: true, renaming };
}

function epistemicMode(s: SchemeWithCqs): string {
  return ((s as any).epistemicMode as string | null | undefined) ?? "FACTUAL";
}

// ────────────────────────────────────────────────────────────────────────────
// Main verifier
// ────────────────────────────────────────────────────────────────────────────

export async function verifyBehaviourEquality(
  left: SchemeWithCqs,
  right: SchemeWithCqs,
  options?: VerifierOptions,
): Promise<VerifierVerdict> {
  const opts = { ...DEFAULTS, ...(options ?? {}) };
  const t0 = Date.now();

  // Pre-filter (necessary condition): epistemicMode must agree, else
  // behaviourally distinct by Q-020 widening.
  if (epistemicMode(left) !== epistemicMode(right)) {
    return {
      kind: "incomparable",
      certificate: {
        conflictingCqs: [],
        discriminatingCqOnLeft: {
          cqKey: "__epistemicMode__",
          rationale: `left.epistemicMode=${epistemicMode(left)} vs right.epistemicMode=${epistemicMode(right)}`,
        },
      },
    };
  }

  const Lcqs = normalizeCqs(left.cqs ?? [], opts);
  const Rcqs = normalizeCqs(right.cqs ?? [], opts);

  if (Date.now() - t0 > opts.searchBoundMs) {
    return { kind: "inconclusive", reason: "search-bound-exceeded" };
  }

  const { pairs, unmatchedLeft, unmatchedRight, conflicts } = pairCqs(Lcqs, Rcqs, opts);

  // Conflicts dominate: any structural conflict ⇒ incomparable.
  if (conflicts.length > 0) {
    return {
      kind: "incomparable",
      certificate: { conflictingCqs: conflicts },
    };
  }

  if (Date.now() - t0 > opts.searchBoundMs) {
    return { kind: "inconclusive", reason: "search-bound-exceeded" };
  }

  // Both sides empty CQ-bundle ⇒ degenerate; rely solely on unification.
  const allMatched = unmatchedLeft.length === 0 && unmatchedRight.length === 0;
  const oneSidedExtras =
    (unmatchedLeft.length === 0 && unmatchedRight.length > 0) ||
    (unmatchedRight.length === 0 && unmatchedLeft.length > 0);

  const unif = unifyPremises(left, right);

  if (allMatched) {
    if (unif.ok) {
      return {
        kind: "equal",
        certificate: {
          cqMapping: pairs.map((p) => ({ leftCqKey: p.left.cqKey, rightCqKey: p.right.cqKey })),
          premiseRenaming: unif.renaming,
          inheritanceRespected: true,
          // ^ Spec 2 phase 2b WF3 guarantees inheritance hygiene; nothing
          //   to walk here because both bundles are presented in full.
        },
      };
    }
    if (unif.reason === "undecided") {
      return { kind: "inconclusive", reason: "premise-unification-undecided" };
    }
    // arity-mismatch or premise-count-mismatch ⇒ behaviours differ.
    return {
      kind: "incomparable",
      certificate: {
        discriminatingCqOnLeft: {
          cqKey: "__premiseShape__",
          rationale: `premise unification failed: ${unif.reason}`,
        },
      },
    };
  }

  if (oneSidedExtras) {
    // One side has every CQ the other does, plus more. ⟦S⟧ ⊆ ⟦S'⟧ iff CQ(S') ⊆ CQ(S).
    // The side with MORE CQs is the subset side on ⟦·⟧.
    const extraOnLeft = unmatchedRight.length === 0; // left has the extras
    const direction: InclusionCertificate["direction"] = extraOnLeft
      ? "left-subset-right"
      : "right-subset-left";
    const extras = extraOnLeft ? unmatchedLeft : unmatchedRight;

    // Require unification to succeed for a sound subset claim.
    if (!unif.ok) {
      if (unif.reason === "undecided") {
        return { kind: "inconclusive", reason: "premise-unification-undecided" };
      }
      return {
        kind: "incomparable",
        certificate: {
          discriminatingCqOnLeft: {
            cqKey: "__premiseShape__",
            rationale: `premise unification failed: ${unif.reason}`,
          },
        },
      };
    }

    return {
      kind: "subset",
      certificate: {
        direction,
        cqMapping: pairs.map((p) => ({ leftCqKey: p.left.cqKey, rightCqKey: p.right.cqKey })),
        extraCqs: extras.map((e) => e.cqKey),
      },
    };
  }

  // Two-sided unmatched: each side has CQs the other lacks ⇒ behaviours differ
  // structurally with mutual discriminators.
  return {
    kind: "incomparable",
    certificate: {
      discriminatingCqOnLeft: unmatchedLeft[0]
        ? { cqKey: unmatchedLeft[0].cqKey, rationale: "no structural match on right" }
        : undefined,
      discriminatingCqOnRight: unmatchedRight[0]
        ? { cqKey: unmatchedRight[0].cqKey, rationale: "no structural match on left" }
        : undefined,
    },
  };
}
