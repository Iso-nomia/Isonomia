/**
 * agents/methodologist-schema.ts
 *
 * Zod contract for the Phase-3 Methodologist (cross-side critic). The
 * Methodologist is a third voice in Phase 3 — distinct from Advocate A
 * and Advocate B — that files rebuttals + critical-question raises
 * against arguments from BOTH sides.
 *
 * Design choices:
 *   - Output shape mirrors `RebuttalOutputZ` (rebuttals[] + cqResponses[]
 *     + webCitations[]), so we can reuse `translateRebuttalOutput()` with
 *     `authorRole: "methodologist"`. The translator only consumes the
 *     fields it knows about; extra fields like `targetAdvocateRole` are
 *     stripped before invocation.
 *   - Each rebuttal/cqResponse carries an explicit `targetAdvocateRole`
 *     ("A" | "B") so the Phase-4 driver can route the attack to the
 *     correct advocate's "ATTACKS_AGAINST_YOU" prompt block. This is
 *     redundant with `targetArgumentId` (which uniquely identifies an
 *     advocate) but makes the LLM's intent explicit and is cheap to
 *     validate.
 *   - `advocateRole` is the literal `"M"` (not "A" or "B"). The literal
 *     keeps the union exhaustive without contaminating other agent
 *     schemas that assume role ∈ {A, B}.
 *   - `phase` is `"3-methodologist"` (vs. Rebuttal's `"3"`) so any
 *     downstream consumer can disambiguate the two record types.
 *   - SAME per-rebuttal validation as Rebuttal (UNDERMINE requires
 *     premise index, layer plausibility, citation-token resolution,
 *     scheme-CQ validity).
 *   - Soft-symmetry guidance: the prompt asks the Methodologist to
 *     attack BOTH sides; the schema does not hard-enforce a balance
 *     (a 100/0 split could be substantively correct in a record where
 *     one side's methodology is genuinely worse). Soft-checks layer (if
 *     ever extended to Methodologist) can flag asymmetric attack
 *     distributions for human review.
 *
 * Hard-validation rules: see `prompts/10-methodologist.md` §5.
 */

import { z } from "zod";
import type { ExperimentSchemeKey } from "../scheme-catalog";
import {
  CitationTokenZ,
  SchemeKeyZ,
  WebCitationZ,
  isSchemeAllowedForLayer,
  type AdvocateLayer,
} from "./advocate-schema";
import { AttackTypeZ, type OpposingArgumentBinding } from "./rebuttal-schema";

// ─────────────────────────────────────────────────────────────────
// Per-element schemas
// ─────────────────────────────────────────────────────────────────

const MethodologistPremiseZ = z.object({
  text: z
    .string()
    .min(1)
    .max(400)
    .refine((s) => /^[A-Z(\u201c"\u2018']/.test(s.trim()), {
      message: "premise text must begin with a capital letter (declarative sentence)",
    })
    .refine((s) => /[.!?]\s*$/.test(s.trim()), {
      message: "premise text must end with a sentence-terminating punctuation mark",
    })
    .refine((s) => !/^(and|or|but|so|because|therefore|thus|hence)\b/i.test(s.trim()), {
      message: "premise text must not begin with a leading conjunction",
    })
    .refine((s) => !/\?\s*$/.test(s.trim()), {
      message: "premise text must be declarative, not a question",
    }),
  citationToken: CitationTokenZ.nullish().transform((v) => v ?? null),
});

const TargetAdvocateRoleZ = z.enum(["A", "B"]);

/** Iter-3: tag identifying which kind of object `targetArgumentId`
 *  resolves to. Default `"phase2-arg"` preserves Iter-2 behavior. */
const MethTargetKindZ = z.enum(["phase2-arg", "round1-rebuttal"]).default("phase2-arg");
/** Iter-3 round indicator. Default `"1"` preserves Iter-2 behavior. */
const MethRoundZ = z.enum(["1", "2"]).default("1");

const MethodologistCqResponseZ = z.object({
  /** Argument-id of the targeted advocate's argument (or round-1 rebuttal in Iter-3 round-2). */
  targetArgumentId: z.string().min(4),
  targetKind: MethTargetKindZ,
  /** Which advocate authored the targeted argument. */
  targetAdvocateRole: TargetAdvocateRoleZ,
  /** Critical-question key from the target argument's scheme. */
  cqKey: z.string().min(1).max(80),
  /** Methodologist only RAISES — it does not waive (waiving is for the
   *  advocate whose own argument is at issue; the Methodologist as
   *  cross-side critic has no "satisfied" stance to record). */
  action: z.literal("raise"),
  rationale: z.string().min(40).max(400),
});
export type MethodologistCqResponse = z.infer<typeof MethodologistCqResponseZ>;

const MethodologistRebuttalZ = z.object({
  targetArgumentId: z.string().min(4),
  targetKind: MethTargetKindZ,
  targetAdvocateRole: TargetAdvocateRoleZ,
  attackType: AttackTypeZ,
  targetPremiseIndex: z.number().int().nonnegative().nullable(),
  conclusionText: z.string().min(1).max(400),
  premises: z.array(MethodologistPremiseZ).min(1).max(6),
  schemeKey: SchemeKeyZ,
  warrant: z.string().min(1).max(300).nullable(),
  cqKey: z.string().min(1).max(80).nullable(),
});
export type MethodologistRebuttal = z.infer<typeof MethodologistRebuttalZ>;

// ─────────────────────────────────────────────────────────────────
// Top-level shape
// ─────────────────────────────────────────────────────────────────

export const MethodologistOutputZ = z.object({
  phase: z.literal("3-methodologist"),
  advocateRole: z.literal("M"),
  /** Iter-3 multi-round indicator. Defaults to "1" so Iter-2 outputs validate. */
  round: MethRoundZ,
  cqResponses: z.array(MethodologistCqResponseZ).default([]),
  rebuttals: z.array(MethodologistRebuttalZ).default([]),
  webCitations: z.array(WebCitationZ).max(40).optional().default([]),
});
export type MethodologistOutput = z.infer<typeof MethodologistOutputZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal
// ─────────────────────────────────────────────────────────────────

export const MethodologistRefusalZ = z.object({
  error: z.enum([
    /** Both advocates' Phase-2 records are missing or malformed. */
    "RECORD_INCOMPLETE",
    /** Framing as written does not specify a methodological-rigor rubric the Methodologist can apply. */
    "FRAMING_AMBIGUOUS",
    /** Both sides' methodology is judged uniformly sound (no methodological flaws of the kind the Methodologist exists to find).
     *  Use this only when the record genuinely shows no methodological weakness — not as a way to avoid hard work. */
    "NO_METHODOLOGICAL_FLAWS_IDENTIFIED",
  ]),
  details: z.string().min(1).max(500),
});
export type MethodologistRefusal = z.infer<typeof MethodologistRefusalZ>;

export function isMethodologistRefusal(r: unknown): r is MethodologistRefusal {
  return typeof (r as any)?.error === "string" && !Array.isArray((r as any)?.rebuttals);
}

// ─────────────────────────────────────────────────────────────────
// Schema-build options
// ─────────────────────────────────────────────────────────────────

export interface MethodologistSchemaOpts {
  /** Union of A's and B's Phase-2 arguments, keyed by argumentId. The
   *  binding's `advocateRole` (A | B) is the canonical assertion of which
   *  side authored each arg; the Methodologist's `targetAdvocateRole`
   *  field is validated against it. */
  opposingArguments: ReadonlyMap<string, OpposingArgumentBinding & { advocateRole: "A" | "B" }>;
  cqKeysByScheme: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>;
  allowedCitationTokens: ReadonlySet<string>;
  /** Defaults: rebuttals across BOTH sides up to 24 (≈ 12 per side), CQ
   *  raises across both sides up to 24. Lower than per-advocate caps
   *  because the Methodologist runs once, not twice. Per-target cap
   *  remains 4. */
  cqResponsesMax?: number;
  rebuttalsMax?: number;
  rebuttalsPerTargetMax?: number;
}

const DEFAULT_CQ_MAX = 24;
const DEFAULT_REBUTTALS_MAX = 24;
const DEFAULT_PER_TARGET_MAX = 4;

export function buildMethodologistOutputSchema(opts: MethodologistSchemaOpts) {
  const {
    opposingArguments,
    cqKeysByScheme,
    allowedCitationTokens,
    cqResponsesMax = DEFAULT_CQ_MAX,
    rebuttalsMax = DEFAULT_REBUTTALS_MAX,
    rebuttalsPerTargetMax = DEFAULT_PER_TARGET_MAX,
  } = opts;

  return MethodologistOutputZ.superRefine((data, ctx) => {
    // Web citations: dedupe.
    const declaredWebTokens = new Set<string>(
      (data.webCitations ?? []).map((w) => w.token),
    );
    const seenWebTokens = new Set<string>();
    for (let i = 0; i < (data.webCitations ?? []).length; i++) {
      const t = data.webCitations![i].token;
      if (seenWebTokens.has(t)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `webCitations[${i}].token "${t}" is duplicated`,
          path: ["webCitations", i, "token"],
        });
      }
      seenWebTokens.add(t);
    }

    // Global budget caps.
    if (data.cqResponses.length > cqResponsesMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `cqResponses.length (${data.cqResponses.length}) exceeds max (${cqResponsesMax})`,
        path: ["cqResponses"],
      });
    }
    if (data.rebuttals.length > rebuttalsMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `rebuttals.length (${data.rebuttals.length}) exceeds max (${rebuttalsMax})`,
        path: ["rebuttals"],
      });
    }

    // Per-target rebuttal cap.
    const rebuttalsByTarget = new Map<string, number>();
    for (let i = 0; i < data.rebuttals.length; i++) {
      const r = data.rebuttals[i];
      const n = (rebuttalsByTarget.get(r.targetArgumentId) ?? 0) + 1;
      rebuttalsByTarget.set(r.targetArgumentId, n);
      if (n > rebuttalsPerTargetMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rebuttals against target ${r.targetArgumentId} exceed per-target cap (${rebuttalsPerTargetMax}); collapse multi-flaw critiques into a single argument with multiple premises`,
          path: ["rebuttals", i, "targetArgumentId"],
        });
      }
    }

    // CQ-response validation.
    for (let i = 0; i < data.cqResponses.length; i++) {
      const c = data.cqResponses[i];
      const target = opposingArguments.get(c.targetArgumentId);
      if (!target) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cqResponses[${i}].targetArgumentId "${c.targetArgumentId}" is not a known Phase-2 argument`,
          path: ["cqResponses", i, "targetArgumentId"],
        });
        continue;
      }
      if (c.targetAdvocateRole !== target.advocateRole) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cqResponses[${i}].targetAdvocateRole "${c.targetAdvocateRole}" disagrees with binding "${target.advocateRole}" for argument ${c.targetArgumentId}`,
          path: ["cqResponses", i, "targetAdvocateRole"],
        });
      }
      const cqs = cqKeysByScheme.get(target.schemeKey);
      if (!cqs) continue;
      if (!cqs.has(c.cqKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cqResponses[${i}].cqKey "${c.cqKey}" is not a valid CQ for scheme "${target.schemeKey}". Valid keys: [${[...cqs].join(", ")}]`,
          path: ["cqResponses", i, "cqKey"],
        });
      }
    }

    // Rebuttal validation.
    for (let i = 0; i < data.rebuttals.length; i++) {
      const r = data.rebuttals[i];
      const target = opposingArguments.get(r.targetArgumentId);
      if (!target) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rebuttals[${i}].targetArgumentId "${r.targetArgumentId}" is not a known Phase-2 argument`,
          path: ["rebuttals", i, "targetArgumentId"],
        });
        continue;
      }
      if (r.targetAdvocateRole !== target.advocateRole) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rebuttals[${i}].targetAdvocateRole "${r.targetAdvocateRole}" disagrees with binding "${target.advocateRole}" for argument ${r.targetArgumentId}`,
          path: ["rebuttals", i, "targetAdvocateRole"],
        });
      }

      // Targeting consistency (same as Rebuttal).
      if (r.attackType === "UNDERMINE") {
        if (r.targetPremiseIndex === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `rebuttals[${i}]: UNDERMINE requires targetPremiseIndex`,
            path: ["rebuttals", i, "targetPremiseIndex"],
          });
        } else if (r.targetPremiseIndex >= target.premiseCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `rebuttals[${i}]: targetPremiseIndex ${r.targetPremiseIndex} out of range; target has ${target.premiseCount} premises`,
            path: ["rebuttals", i, "targetPremiseIndex"],
          });
        }
      } else if (r.targetPremiseIndex !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rebuttals[${i}]: targetPremiseIndex must be null for ${r.attackType} (only UNDERMINE targets a specific premise)`,
          path: ["rebuttals", i, "targetPremiseIndex"],
        });
      }

      // Citation tokens resolve.
      for (let p = 0; p < r.premises.length; p++) {
        const tok = r.premises[p].citationToken;
        if (tok !== null && !allowedCitationTokens.has(tok) && !declaredWebTokens.has(tok)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `rebuttals[${i}].premises[${p}].citationToken "${tok}" does not resolve in EVIDENCE_CORPUS or in webCitations`,
            path: ["rebuttals", i, "premises", p, "citationToken"],
          });
        }
      }

      // Layer plausibility — methodological critique can in principle
      // attack any layer, but we keep the same scheme-layer check so the
      // record stays uniform with Phase-2/3.
      if (!isSchemeAllowedForLayer(r.schemeKey, target.conclusionLayer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rebuttals[${i}]: schemeKey "${r.schemeKey}" is not appropriate for layer "${target.conclusionLayer}" (the layer of the targeted argument's conclusion)`,
          path: ["rebuttals", i, "schemeKey"],
        });
      }
    }
  });
}
