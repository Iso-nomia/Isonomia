/**
 * Spec 2 well-formedness validator (WF1–WF3).
 *
 * Plan: Development and Ideation Documents/ARCHITECTURE/FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md
 *   §Phase 3 steps 11–12.
 * Detailed contract: Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_ADMIN_TIGHTENING.md
 *   §3.1–§3.2.
 *
 * Enforces the T003-coherence conditions at scheme creation/edit time:
 *
 *   WF1 — CQ-bundle consistency.
 *     Declared CQs plus inherited CQs (from the parent scheme, if any) are
 *     mutually consistent: no duplicate `cqKey` with different
 *     `attackType` / `targetScope`. Cosmetic `text` differences for the same
 *     structural CQ are a `warn` only (Spec 2 §7 R1; verifier's territory).
 *
 *   WF2 — Non-vacuity sentinel.
 *     The declared CQ-bundle is non-empty AND not trivially vacuous (every CQ
 *     has a `targetScope`, at least one CQ has an `attackType` in
 *     {REBUTS, UNDERCUTS, UNDERMINES}, every CQ has ≥3 chars of `text`).
 *     This is the conservative syntactic sentinel of Spec 2 §3.2 — semantic
 *     non-redundancy is the verifier's job (Spec 4).
 *
 *   WF3 — Inheritance monotonicity.
 *     If `parentSchemeId` is set, the child's CQ-key set is a superset of the
 *     parent's. Closes the breach that `inheritCQs: false` would have opened.
 *     Q-019 audit (audits/q019-inherit-cqs-false-20260528.md) returned zero
 *     rows, so this ships at error severity from the start.
 *
 * Phase 3 of FROM_FOLKSONOMY_TO_ONTOLOGY_SCHEMES.md compresses Spec 2's
 * phase 2a (warn) and 2b (error): all rules ship at `error` severity from
 * landing. A back-test against the live catalogue
 * (scripts/audits/back-test-wf-validator.ts) runs before this is wired to
 * confirm zero existing rows would be rejected.
 */

export type DraftCq = {
  cqKey: string | null;
  text?: string | null;
  attackType: string | null;
  targetScope: string | null;
};

export type SchemeDraft = {
  key: string;
  parentSchemeId?: string | null;
  cqs: DraftCq[];
};

export type ParentSchemeShape = {
  id: string;
  key: string;
  cqs: DraftCq[];
};

export type ValidationViolation = {
  rule: "WF1" | "WF2-empty" | "WF2-vacuous" | "WF3";
  severity: "warn" | "error";
  message: string;
  cqKey?: string;
  parentCqKey?: string;
};

export type ValidationResult =
  | { ok: true; warnings: ValidationViolation[] }
  | { ok: false; errors: ValidationViolation[]; warnings: ValidationViolation[] };

const PROPER_ATTACK_TYPES = new Set(["REBUTS", "UNDERCUTS", "UNDERMINES"]);
const MIN_CQ_TEXT_CHARS = 3;

function trimText(t: string | null | undefined): string {
  return (t ?? "").trim();
}

/**
 * WF1 — declared CQs are internally consistent and consistent with the
 * parent's CQs. Duplicate `cqKey`s with mismatched structural fields are
 * errors; cosmetic `text` mismatches for the same structural CQ are warnings.
 */
function checkWF1(draft: SchemeDraft, parent: ParentSchemeShape | null): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const seen = new Map<string, DraftCq>();

  // Internal consistency among declared CQs.
  for (const cq of draft.cqs) {
    const key = cq.cqKey ?? "";
    if (!key) continue;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, cq);
      continue;
    }
    if (
      (prior.attackType ?? "") !== (cq.attackType ?? "") ||
      (prior.targetScope ?? "") !== (cq.targetScope ?? "")
    ) {
      violations.push({
        rule: "WF1",
        severity: "error",
        cqKey: key,
        message: `Duplicate CQ key "${key}" with mismatched structure (attackType/targetScope must agree).`,
      });
    } else if (trimText(prior.text) !== trimText(cq.text)) {
      violations.push({
        rule: "WF1",
        severity: "warn",
        cqKey: key,
        message: `Duplicate CQ key "${key}" with differently-worded text; same structure, but cosmetic divergence.`,
      });
    }
  }

  // Consistency vs parent's CQs.
  if (parent) {
    const childByKey = new Map<string, DraftCq>();
    for (const cq of draft.cqs) {
      if (cq.cqKey) childByKey.set(cq.cqKey, cq);
    }
    for (const pcq of parent.cqs) {
      const key = pcq.cqKey ?? "";
      if (!key) continue;
      const child = childByKey.get(key);
      if (!child) continue;
      if (
        (child.attackType ?? "") !== (pcq.attackType ?? "") ||
        (child.targetScope ?? "") !== (pcq.targetScope ?? "")
      ) {
        violations.push({
          rule: "WF1",
          severity: "error",
          cqKey: key,
          parentCqKey: key,
          message: `Child CQ "${key}" overrides parent's structural fields (attackType/targetScope must agree across the inheritance edge).`,
        });
      } else if (trimText(child.text) !== trimText(pcq.text)) {
        violations.push({
          rule: "WF1",
          severity: "warn",
          cqKey: key,
          parentCqKey: key,
          message: `Child CQ "${key}" re-words parent's text; same structure but cosmetic divergence.`,
        });
      }
    }
  }

  return violations;
}

/**
 * WF2 — the declared CQ-bundle is non-empty and not trivially vacuous.
 * Conservative syntactic sentinel only (Spec 2 §3.2).
 */
function checkWF2(draft: SchemeDraft): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  if (draft.cqs.length === 0) {
    violations.push({
      rule: "WF2-empty",
      severity: "error",
      message: "Scheme must declare at least one critical question.",
    });
    return violations;
  }

  if (draft.cqs.every((cq) => !cq.targetScope)) {
    violations.push({
      rule: "WF2-vacuous",
      severity: "error",
      message: "Every CQ has no targetScope — the scheme cannot attack anything.",
    });
  }
  if (!draft.cqs.some((cq) => PROPER_ATTACK_TYPES.has((cq.attackType ?? "").toUpperCase()))) {
    violations.push({
      rule: "WF2-vacuous",
      severity: "error",
      message: `At least one CQ must have attackType ∈ {REBUTS, UNDERCUTS, UNDERMINES}.`,
    });
  }
  for (const cq of draft.cqs) {
    if (trimText(cq.text).length < MIN_CQ_TEXT_CHARS) {
      violations.push({
        rule: "WF2-vacuous",
        severity: "error",
        cqKey: cq.cqKey ?? undefined,
        message: `CQ "${cq.cqKey ?? "<unkeyed>"}" has empty or near-empty text (${MIN_CQ_TEXT_CHARS}+ chars required).`,
      });
    }
  }
  return violations;
}

/**
 * WF3 — inheritance monotonicity. If `parentSchemeId` is set, the child's
 * CQ-key set must be a superset of the parent's. Q-019 (0 rows) means this
 * ships at error severity from landing.
 */
function checkWF3(draft: SchemeDraft, parent: ParentSchemeShape | null): ValidationViolation[] {
  if (!parent) return [];
  const childKeys = new Set(draft.cqs.map((c) => c.cqKey ?? "").filter(Boolean));
  const violations: ValidationViolation[] = [];
  for (const pcq of parent.cqs) {
    const key = pcq.cqKey ?? "";
    if (!key) continue;
    if (!childKeys.has(key)) {
      violations.push({
        rule: "WF3",
        severity: "error",
        cqKey: key,
        parentCqKey: key,
        message: `Child must include parent CQ "${key}" (inheritance monotonicity — a child scheme's behaviour is contained in its parent's).`,
      });
    }
  }
  return violations;
}

/**
 * Runs WF1, WF2, WF3 over a draft and returns the verdict.
 *
 * `ok: true` iff there are no `error`-severity violations. Warnings can still
 * be present on success; callers may surface them to the author.
 */
export function validateSchemePresentation(
  draft: SchemeDraft,
  ctx: { parentScheme: ParentSchemeShape | null },
): ValidationResult {
  const violations: ValidationViolation[] = [
    ...checkWF1(draft, ctx.parentScheme),
    ...checkWF2(draft),
    ...checkWF3(draft, ctx.parentScheme),
  ];
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warn");
  if (errors.length === 0) return { ok: true, warnings };
  return { ok: false, errors, warnings };
}
