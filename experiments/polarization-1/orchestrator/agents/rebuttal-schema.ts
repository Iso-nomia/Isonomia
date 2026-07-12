/**
 * agents/rebuttal-schema.ts
 *
 * Zod contract for Advocate A and Advocate B Phase-3 (Dialectical Testing)
 * output. Each advocate symmetrically:
 *   1. Raises or waives one or more critical questions on each opposing
 *      argument that has open CQs in its scheme catalog. (`cqResponses[]`)
 *   2. Mints rebuttal arguments against opposing arguments it judges
 *      materially flawed. Each rebuttal is REBUT (attacks conclusion),
 *      UNDERMINE (attacks a specific premise), or UNDERCUT (attacks the
 *      warrant). (`rebuttals[]`)
 *
 * Per-target cap: ≤ 4 rebuttals against any single opposing argument.
 * Per-advocate global cap: see Phase-3 prompt §5 for tunable budgets.
 *
 * Defenses (3c) are deferred to Phase 4. This schema does not include them.
 *
 * Hard-validation rules mirror `prompts/4-rebuttal-a.md` §5 and the
 * identical block in `prompts/5-rebuttal-b.md` §5. Soft-track checks
 * (attack-targeting, scheme-cq-validity, mutual-rebut detection,
 * evidence fidelity) live in `review/phase-3-checks.ts`.
 */

import { z } from "zod";
import { EXPERIMENT_SCHEME_KEYS, type ExperimentSchemeKey } from "../scheme-catalog";
import {
  CitationTokenZ,
  SchemeKeyZ,
  WebCitationZ,
  isSchemeAllowedForLayer,
  type AdvocateLayer,
} from "./advocate-schema";

// ─────────────────────────────────────────────────────────────────
// Per-element schemas
// ─────────────────────────────────────────────────────────────────

/** Same premise constraints as Phase-2 (capital-start, period-end, no leading conjunction, declarative). */
const RebuttalPremiseZ = z.object({
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
  // `.nullish().transform(... ?? null)` — accept either an explicit
  // `null` or a missing field and normalize both to `null`. LLMs
  // frequently omit the field on premises with no citation; the
  // post-validation pass still catches every actually-present token
  // that fails to resolve in EVIDENCE_CORPUS / webCitations.
  citationToken: CitationTokenZ.nullish().transform((v) => v ?? null),
});

/** Attack types map onto ArgumentEdge.attackType. */
export const AttackTypeZ = z.enum(["REBUT", "UNDERMINE", "UNDERCUT"]);
export type AttackType = z.infer<typeof AttackTypeZ>;

/**
 * Iter-3 multi-round Phase 3. `"1"` = current behavior (attacks on
 * opposing Phase-2 args). `"2"` = round-2 attacks; may target either
 * an opposing Phase-2 arg (NEW direct attack) OR a round-1 rebuttal
 * filed against THIS advocate's own Phase-2 args (attack-on-attack).
 * Default `"1"` preserves Iter-2 outputs.
 */
export const RebuttalRoundZ = z.enum(["1", "2"]);
export type RebuttalRound = z.infer<typeof RebuttalRoundZ>;

/**
 * Explicit tag identifying which kind of object the `targetArgumentId`
 * resolves to. Required for Iter-3 round-2 disambiguation; defaults to
 * `"phase2-arg"` so Iter-2 outputs validate unchanged.
 */
export const TargetKindZ = z.enum(["phase2-arg", "round1-rebuttal"]);
export type TargetKind = z.infer<typeof TargetKindZ>;

/**
 * A CQ raise OR waive against an opposing argument. Action `raise` opens
 * the CQ (sets `CQStatus.statusEnum = OPEN` if absent); `waive` records
 * the advocate's affirmative concession that the CQ is non-blocking
 * (sets `CQStatus.statusEnum = SATISFIED` with `responses` empty —
 * advocate marks the question moot rather than challenging it).
 */
const CqResponseZ = z.object({
  /** Argument-id of the opposing argument (or round-1 rebuttal in Iter-3 round-2) this CQ targets. */
  targetArgumentId: z.string().min(4),
  /** Iter-3: which kind of object `targetArgumentId` resolves to. */
  targetKind: TargetKindZ.default("phase2-arg"),
  /** Critical-question key from the target argument's scheme. */
  cqKey: z.string().min(1).max(80),
  action: z.enum(["raise", "waive"]),
  /**
   * Why this CQ is being raised (or waived). 40–400 chars.
   * For `raise`: state the specific weakness the CQ exposes.
   * For `waive`: state why the CQ is non-blocking in this case.
   * 400 ceiling: anything longer is rebuttal-shaped reasoning that
   * belongs in `rebuttals[]`, not in a CQ rationale.
   */
  rationale: z.string().min(40).max(400),
});
export type CqResponse = z.infer<typeof CqResponseZ>;

/**
 * A single rebuttal argument. Same structural shape as a Phase-2
 * advocate argument (premises + scheme + warrant), plus the targeting
 * fields that turn it into an attack.
 *
 * Targeting rules (validated in superRefine):
 *   - REBUT: targetPremiseIndex MUST be null. The rebuttal's conclusion
 *     contradicts the target argument's conclusion.
 *   - UNDERMINE: targetPremiseIndex REQUIRED, in [0, target.premises.length).
 *     The rebuttal's conclusion contradicts that premise.
 *   - UNDERCUT: targetPremiseIndex MUST be null. The rebuttal's
 *     conclusion is "the inference from premises to conclusion fails"
 *     (warrant attack); premises and conclusion-text describe why.
 */
const RebuttalArgumentZ = z.object({
  /** Argument-id of the opposing argument (or round-1 rebuttal in Iter-3 round-2) being attacked. */
  targetArgumentId: z.string().min(4),
  /** Iter-3: which kind of object `targetArgumentId` resolves to. */
  targetKind: TargetKindZ.default("phase2-arg"),
  attackType: AttackTypeZ,
  /** 0-based premise index in the target argument; required iff attackType === "UNDERMINE". */
  targetPremiseIndex: z.number().int().nonnegative().nullable(),
  /**
   * The rebuttal's conclusion text. Will be minted as a Claim and used as
   * the rebuttal Argument's `conclusionClaimId`. Same shape constraints as
   * a premise (declarative sentence).
   */
  conclusionText: z
    .string()
    .min(1)
    .max(400)
    .refine((s) => /^[A-Z(\u201c"\u2018']/.test(s.trim()), {
      message: "conclusionText must begin with a capital letter",
    })
    .refine((s) => /[.!?]\s*$/.test(s.trim()), {
      message: "conclusionText must end with a sentence-terminating punctuation mark",
    }),
  premises: z.array(RebuttalPremiseZ).min(1).max(6),
  schemeKey: SchemeKeyZ,
  warrant: z.string().min(1).max(300).nullable(),
  /**
   * Optional `cqKey` to attach to the resulting `ArgumentEdge.cqKey`. When
   * provided, the rebuttal also auto-marks that CQ as `answered` on the
   * target argument. Must be a real CQ on the target argument's scheme.
   */
  cqKey: z.string().min(1).max(80).nullable(),
});
export type RebuttalArgument = z.infer<typeof RebuttalArgumentZ>;

// ─────────────────────────────────────────────────────────────────
// Top-level Phase-3 output
// ─────────────────────────────────────────────────────────────────

export const REBUTTAL_PER_TARGET_MAX = 4;

const RebuttalOutputZ = z.object({
  phase: z.literal("3"),
  advocateRole: z.enum(["A", "B"]),
  /** Iter-3 multi-round indicator. Defaults to "1" so Iter-2 outputs validate. */
  round: RebuttalRoundZ.default("1"),
  cqResponses: z.array(CqResponseZ).default([]),
  rebuttals: z.array(RebuttalArgumentZ).default([]),
  /**
   * Loosened-mode web sources discovered via web search during the rebuttal
   * round. Same shape as Phase-2 webCitations; resolved by argument-mint
   * (and re-used by attack-mint) before edge attachment.
   */
  webCitations: z.array(WebCitationZ).max(40).optional().default([]),
});

export type RebuttalOutput = z.infer<typeof RebuttalOutputZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal (mirrors AdvocateRefusal but with Phase-3-appropriate codes)
// ─────────────────────────────────────────────────────────────────

export const RebuttalRefusalZ = z.object({
  error: z.enum([
    /** No materially flawed opposing arguments to attack and no CQs worth raising. */
    "NO_DEFENSIBLE_ATTACKS",
    /** Opposing arguments are evidence-grounded and scheme-appropriate; principled disagreement only. */
    "OPPONENT_CASE_SOUND",
    /** The framing rules out this advocate's position so completely that even targeted attacks would re-litigate established items. */
    "FRAMING_BLOCKS_ATTACKS",
  ]),
  details: z.string().max(500),
  targetArgumentIdsAttempted: z.array(z.string()).default([]),
});
export type RebuttalRefusal = z.infer<typeof RebuttalRefusalZ>;

export function isRebuttalRefusal(r: unknown): r is RebuttalRefusal {
  return typeof (r as any)?.error === "string" && !Array.isArray((r as any)?.rebuttals);
}

// ─────────────────────────────────────────────────────────────────
// Targeting binding: opposing arguments + CQ catalog per scheme
// ─────────────────────────────────────────────────────────────────

/**
 * Information about each opposing argument needed for hard validation:
 * the argument's scheme's CQ keys (so cqResponses.cqKey is bounded), the
 * argument's premise count (so UNDERMINE.targetPremiseIndex is bounded),
 * and the conclusion sub-claim's layer (so the rebuttal's schemeKey is
 * checked for layer-plausibility against what it ATTACKS — same rule as
 * Phase 2).
 */
export interface OpposingArgumentBinding {
  argumentId: string;
  /** Scheme key of the opposing argument. Used to look up its CQ catalog. */
  schemeKey: ExperimentSchemeKey;
  /** Number of premises in the opposing argument; bounds UNDERMINE.targetPremiseIndex. */
  premiseCount: number;
  /** Layer of the conclusion sub-claim the opposing argument concludes to. */
  conclusionLayer: AdvocateLayer;
}

export interface RebuttalSchemaOpts {
  advocateRole: "A" | "B";
  /** Keyed by argumentId. The Zod schema uses this to validate targeting. */
  opposingArguments: ReadonlyMap<string, OpposingArgumentBinding>;
  /** Per-scheme valid CQ keys (loaded from `CriticalQuestion` table). */
  cqKeysByScheme: ReadonlyMap<ExperimentSchemeKey, ReadonlySet<string>>;
  /** Bound evidence corpus tokens (same source as Phase 2). */
  allowedCitationTokens: ReadonlySet<string>;
  /** Defaults from prompt §5; override only for testing. */
  cqResponsesMax?: number; // default 32 (loosened from 16)
  rebuttalsMax?: number; // default 32 (loosened from 16)
  rebuttalsPerTargetMax?: number; // default 4 (REBUTTAL_PER_TARGET_MAX)
}

/**
 * Build the parameterized Zod schema for a Phase-3 rebuttal output.
 * Apply the result with `.safeParse(json)`. Failures contain the precise
 * §5 rule that fired in `error.issues[i].message`.
 */
export function buildRebuttalOutputSchema(opts: RebuttalSchemaOpts) {
  const {
    advocateRole,
    opposingArguments,
    cqKeysByScheme,
    allowedCitationTokens,
    cqResponsesMax = 32,
    rebuttalsMax = 32,
    rebuttalsPerTargetMax = REBUTTAL_PER_TARGET_MAX,
  } = opts;

  // Pre-normalization helpers: tolerate two common LLM mistakes.
  // (1) cqKey suffix drift: model emits "causal_strength?" but the
  //     scheme catalog uses "causal_strength" (or vice-versa).
  // (2) targetArgumentId truncation: model emits a short prefix
  //     (e.g. "cmoupg0n4") of a real argument id.
  const argIdByPrefix = new Map<string, string>();
  for (const id of opposingArguments.keys()) {
    // Index increasing-length prefixes ≥ 8 chars.
    for (let n = 8; n <= id.length; n++) {
      const p = id.slice(0, n);
      // Only register prefixes that are unambiguous.
      if (argIdByPrefix.has(p)) argIdByPrefix.set(p, "__ambiguous__");
      else argIdByPrefix.set(p, id);
    }
  }
  function resolveArgId(raw: string): string {
    if (opposingArguments.has(raw)) return raw;
    const hit = argIdByPrefix.get(raw);
    if (hit && hit !== "__ambiguous__") return hit;
    return raw;
  }
  function normalizeCqKey(raw: string, schemeKey: ExperimentSchemeKey): string {
    const cqs = cqKeysByScheme.get(schemeKey);
    if (!cqs) return raw;
    if (cqs.has(raw)) return raw;
    // Try toggling trailing "?".
    const flipped = raw.endsWith("?") ? raw.slice(0, -1) : raw + "?";
    if (cqs.has(flipped)) return flipped;
    return raw;
  }

  return RebuttalOutputZ.superRefine((data, ctx) => {
    // Apply normalizers in place before any downstream checks see the data.
    for (const c of data.cqResponses) {
      c.targetArgumentId = resolveArgId(c.targetArgumentId);
      const target = opposingArguments.get(c.targetArgumentId);
      if (target) c.cqKey = normalizeCqKey(c.cqKey, target.schemeKey);
    }
    for (const r of data.rebuttals) {
      r.targetArgumentId = resolveArgId(r.targetArgumentId);
      const target = opposingArguments.get(r.targetArgumentId);
      if (target && r.cqKey != null) {
        r.cqKey = normalizeCqKey(r.cqKey, target.schemeKey);
        // If still not a valid CQ for the target's scheme (i.e. the model
        // picked a key from a DIFFERENT scheme's catalog), null it. The
        // rebuttal's substantive content is unaffected; only the optional
        // CQ-link annotation is dropped.
        const cqs = cqKeysByScheme.get(target.schemeKey);
        if (cqs && !cqs.has(r.cqKey)) r.cqKey = null;
      }
    }

    if (data.advocateRole !== advocateRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `advocateRole must equal "${advocateRole}" (got "${data.advocateRole}")`,
        path: ["advocateRole"],
      });
    }

    // Loosened-mode: union corpus tokens with this output's declared web tokens.
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
          message: `cqResponses[${i}].targetArgumentId "${c.targetArgumentId}" is not a known opposing argument`,
          path: ["cqResponses", i, "targetArgumentId"],
        });
        continue;
      }
      const cqs = cqKeysByScheme.get(target.schemeKey);
      if (!cqs) {
        // Scheme has no registered CQs in the catalog. Skip with a soft
        // note — the soft-checks layer will surface this if it matters.
        continue;
      }
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
          message: `rebuttals[${i}].targetArgumentId "${r.targetArgumentId}" is not a known opposing argument`,
          path: ["rebuttals", i, "targetArgumentId"],
        });
        continue;
      }

      // Targeting consistency.
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
            message: `rebuttals[${i}]: targetPremiseIndex ${r.targetPremiseIndex} out of range; target argument has ${target.premiseCount} premises`,
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

      // Citation tokens resolve (corpus OR declared web citation).
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

      // Scheme-layer plausibility — checked against the LAYER OF THE
      // OPPOSING ARGUMENT's conclusion sub-claim (since the rebuttal's
      // conclusion lives in the same epistemic register as what it
      // attacks: an empirical-causal claim is rebutted by empirical-causal
      // counter-evidence; a normative claim by normative counter-reasons).
      if (!isSchemeAllowedForLayer(r.schemeKey, target.conclusionLayer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `rebuttals[${i}]: schemeKey "${r.schemeKey}" is not appropriate for layer "${target.conclusionLayer}" (the layer of the opposing argument's conclusion)`,
          path: ["rebuttals", i, "schemeKey"],
        });
      }

      // Optional cqKey on rebuttal: should be a real CQ for the target's
      // scheme, but this is a pure annotation linking the rebuttal to a
      // critical question on the target. Invalid keys are silently coerced
      // to null in a post-process transform below; the rebuttal itself
      // (premises, conclusion, attack-type) is unaffected. Soft-checks may
      // surface a warning. We do NOT hard-reject here because the rebuttal's
      // substantive content is independent of this annotation, and Haiku
      // frequently picks a key from its own scheme's catalog instead of
      // the target's.
    }
  });
}

export type RebuttalSchema = ReturnType<typeof buildRebuttalOutputSchema>;
