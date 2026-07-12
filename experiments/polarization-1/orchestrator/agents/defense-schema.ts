/**
 * agents/defense-schema.ts
 *
 * Zod contract for Advocate A and Advocate B Phase-4 (Concessions &
 * Defenses) output. Each advocate symmetrically:
 *   1. For every rebuttal the OTHER advocate filed against one of their
 *      Phase-2 arguments, emits exactly one response: defend / concede /
 *      narrow. (`responses[]`)
 *   2. For every CQ raise the OTHER advocate filed against one of their
 *      Phase-2 arguments, emits exactly one response: answer / concede.
 *      (`cqAnswers[]`)
 *
 * Per-attack response cap: 1. (Phase 4 is the defenses-only round per
 * the user's scoping decision; rejoinders are deferred.)
 *
 * This is the symmetric mirror of `rebuttal-schema.ts`. Hard-validation
 * rules mirror `prompts/6-defense-a.md` §5 and the identical block in
 * `prompts/7-defense-b.md` §5.
 */

import { z } from "zod";
import {
  CitationTokenZ,
  SchemeKeyZ,
  WebCitationZ,
} from "./advocate-schema";

// ─────────────────────────────────────────────────────────────────
// Shared building blocks (mirroring rebuttal-schema)
// ─────────────────────────────────────────────────────────────────

/** Same premise constraints as Phase-2 / Phase-3. */
const DefensePremiseZ = z.object({
  text: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() && !/[.!?]\s*$/.test(v.trim()) ? v.trim() + "." : v),
      z.string(),
    )
    .pipe(
      z
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
    ),
  citationToken: z.preprocess(
    (v) => {
      if (v == null) return null;
      if (typeof v !== "string") return v;
      // If LLM concatenates multiple tokens (comma/space/pipe-separated),
      // keep only the first well-formed token.
      const parts = v.split(/[,;\s|]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1) return parts[0];
      return v;
    },
    CitationTokenZ.nullish().transform((v) => v ?? null),
  ),
});

const DeclarativeSentenceZ = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      let s = v.trim();
      if (!s) return v;
      if (s.length > 400) s = s.slice(0, 397).trimEnd() + "...";
      if (!/[.!?]\s*$/.test(s)) s = s + ".";
      return s;
    },
    z.string(),
  )
  .pipe(
    z
      .string()
      .min(1)
      .max(400)
      .refine((s) => /^[A-Z(\u201c"\u2018']/.test(s.trim()), {
        message: "must begin with a capital letter (declarative sentence)",
      })
      .refine((s) => /[.!?]\s*$/.test(s.trim()), {
        message: "must end with a sentence-terminating punctuation mark",
      }),
  );

/** Defense attack types: same three modes as Phase 3, but here the
 *  defense's `to` argument is the OPPONENT's REBUTTAL (a CA-node),
 *  not one of their Phase-2 arguments. The defense attacks the attack. */
export const DefenseAttackTypeZ = z.enum(["REBUT", "UNDERMINE", "UNDERCUT"]);
export type DefenseAttackType = z.infer<typeof DefenseAttackTypeZ>;

/**
 * A defense argument — a fully-formed argument that attacks one of the
 * opponent's REBUTTALS (the rebuttal arg from Phase 3, by id). Same shape
 * as a Phase-3 rebuttal: premises, scheme, conclusion, attack type.
 *
 * Targeting rules (validated in superRefine on the parent ResponseZ):
 *   - REBUT: targetPremiseIndex MUST be null (attack the rebuttal's conclusion).
 *   - UNDERMINE: targetPremiseIndex REQUIRED, in [0, rebuttal.premises.length).
 *   - UNDERCUT: targetPremiseIndex MUST be null (attack the rebuttal's warrant).
 */
const DefenseArgumentZ = z.object({
  attackType: DefenseAttackTypeZ,
  /** 0-based premise index in the targeted REBUTTAL; required iff attackType === "UNDERMINE". */
  targetPremiseIndex: z.number().int().nonnegative().nullable(),
  conclusionText: DeclarativeSentenceZ,
  premises: z.array(DefensePremiseZ).min(1).max(6),
  schemeKey: SchemeKeyZ,
  warrant: z.string().min(1).max(300).nullable(),
});
export type DefenseArgument = z.infer<typeof DefenseArgumentZ>;

/**
 * One advocate's response to one rebuttal target.
 *   - defend: defense REQUIRED non-null, narrowedConclusionText null.
 *   - concede: defense MUST be null, narrowedConclusionText null.
 *   - narrow: narrowedConclusionText REQUIRED non-null, defense optional.
 */
const ResponseZ = z.object({
  /** rebuttalArgumentId — the opponent's Phase-3 rebuttal arg this response addresses. */
  targetAttackId: z.string().min(4),
  kind: z.enum(["defend", "concede", "narrow"]),
  rationale: z.preprocess(
    (v) => (typeof v === "string" && v.length > 600 ? v.slice(0, 597).trimEnd() + "..." : v),
    z.string().min(40).max(600),
  ),
  defense: z.preprocess((v) => (v === undefined ? null : v), DefenseArgumentZ.nullable()),
  /** REQUIRED when kind === "narrow"; null otherwise. The new narrower conclusion claim. */
  narrowedConclusionText: z.preprocess(
    (v) => (v === undefined ? null : v),
    DeclarativeSentenceZ.nullable(),
  ),
});
export type DefenseResponse = z.infer<typeof ResponseZ>;

/**
 * One advocate's response to one CQ raise. The opponent's `action: "raise"`
 * cqResponses are the only ones requiring an answer; `action: "waive"` raises
 * are concessions by the raiser themselves and the orchestrator omits them
 * from the input prompt.
 */
const CqAnswerZ = z.object({
  /** cqResponseId — the opponent's Phase-3 cqResponse this answer addresses. */
  targetCqRaiseId: z.string().min(4),
  kind: z.enum(["answer", "concede"]),
  rationale: z.preprocess(
    (v) => (typeof v === "string" && v.length > 600 ? v.slice(0, 597).trimEnd() + "..." : v),
    z.string().min(40).max(600),
  ),
});
export type CqAnswer = z.infer<typeof CqAnswerZ>;

// ─────────────────────────────────────────────────────────────────
// Top-level Phase-4 output
// ─────────────────────────────────────────────────────────────────

/**
 * Iter-3 multi-round Phase 4. `"a"` = sub-round-a, defending against
 * Phase-3 round-1 attacks (current Iter-2 behavior). `"b"` = sub-round-b,
 * defending against Phase-3 round-2 attacks (which themselves may have
 * targeted either THIS advocate's Phase-2 args OR THIS advocate's
 * round-1 rebuttals). Default `"a"` preserves Iter-2 behavior.
 */
export const DefenseSubRoundZ = z.enum(["a", "b"]);
export type DefenseSubRound = z.infer<typeof DefenseSubRoundZ>;

const DefenseOutputZ = z.object({
  phase: z.literal("4"),
  advocateRole: z.enum(["A", "B"]),
  /** Iter-3: which sub-round of Phase 4. Defaults to "a" so Iter-2 outputs validate. */
  subRound: DefenseSubRoundZ.default("a"),
  responses: z.array(ResponseZ).default([]),
  cqAnswers: z.array(CqAnswerZ).default([]),
  /** Loosened-mode web sources discovered while drafting defenses. */
  webCitations: z.array(WebCitationZ).max(40).optional().default([]),
});

export type DefenseOutput = z.infer<typeof DefenseOutputZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal (mirrors RebuttalRefusal but with Phase-4-appropriate codes)
// ─────────────────────────────────────────────────────────────────

export const DefenseRefusalZ = z.object({
  error: z.enum([
    /** Every attack you tried to defend would require evidence not in the bound corpus, OR every defense would be trivial / fabricated. */
    "NO_VIABLE_DEFENSES",
    /** Opponent's attacks are collectively decisive; the appropriate response is total concession but the concession framing itself is structurally blocked. */
    "ATTACKS_DECISIVE",
    /** The framing rules out evidence that would defend your position so thoroughly that any honest defense would re-litigate established items. */
    "FRAMING_BLOCKS_DEFENSES",
  ]),
  details: z.string().max(500),
  targetAttackIdsAttempted: z.array(z.string()).default([]),
});
export type DefenseRefusal = z.infer<typeof DefenseRefusalZ>;

export function isDefenseRefusal(r: unknown): r is DefenseRefusal {
  return typeof (r as any)?.error === "string" && !Array.isArray((r as any)?.responses);
}

// ─────────────────────────────────────────────────────────────────
// Targeting binding: opposing rebuttals + CQ raises this advocate must answer
// ─────────────────────────────────────────────────────────────────

/**
 * Information about each opposing REBUTTAL needed for hard validation:
 * the rebuttal's premise count (so UNDERMINE.targetPremiseIndex on the
 * defense is bounded) and the targeted Phase-2 argumentId (so the
 * orchestrator can wire the defense's resulting ArgumentEdge to the
 * right Phase-2 argument's defense chain).
 */
export interface OpposingRebuttalBinding {
  /** rebuttalArgumentId — the opponent's Phase-3 rebuttal Argument id. */
  rebuttalArgumentId: string;
  /** The Phase-2 argument id this rebuttal attacks (one of THIS advocate's args). */
  targetArgumentId: string;
  /** Number of premises in the OPPONENT'S REBUTTAL; bounds UNDERMINE.targetPremiseIndex on the defense. */
  rebuttalPremiseCount: number;
  /** attackType the opponent declared (REBUT/UNDERMINE/UNDERCUT). */
  rebuttalAttackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
  /** premise index the opponent's REBUTTAL targets in THIS advocate's Phase-2 argument (for UNDERMINE rebuttals; null otherwise). */
  rebuttalTargetPremiseIndex: number | null;
  /** Optional cqKey on the rebuttal (the rebuttal answers this CQ on the target Phase-2 argument). */
  cqKey: string | null;
}

/**
 * Information about each opposing CQ raise (action="raise" only) this
 * advocate must answer.
 */
export interface OpposingCqRaiseBinding {
  /** cqResponseId — the opponent's Phase-3 cqResponse id (action="raise"). */
  cqResponseId: string;
  /** Phase-2 argumentId of THIS advocate that the CQ targets. */
  targetArgumentId: string;
  cqKey: string;
}

export interface DefenseSchemaOpts {
  advocateRole: "A" | "B";
  /** Keyed by rebuttalArgumentId. Bounds defense targeting + provides per-attack response coverage check. */
  opposingRebuttals: ReadonlyMap<string, OpposingRebuttalBinding>;
  /** Keyed by cqResponseId. Used for cqAnswer coverage check. */
  opposingCqRaises: ReadonlyMap<string, OpposingCqRaiseBinding>;
  /** Bound evidence corpus tokens (same source as Phase 2/3). */
  allowedCitationTokens: ReadonlySet<string>;
}

// ─────────────────────────────────────────────────────────────────
// Parameterized schema builder
// ─────────────────────────────────────────────────────────────────

/**
 * Build the parameterized Zod schema for a Phase-4 defense output.
 * Apply with `.safeParse(json)`. Failures contain the precise §5 rule
 * that fired in `error.issues[i].message`.
 */
export function buildDefenseOutputSchema(opts: DefenseSchemaOpts) {
  const {
    advocateRole,
    opposingRebuttals,
    opposingCqRaises,
    allowedCitationTokens,
  } = opts;

  return DefenseOutputZ.superRefine((data, ctx) => {
    // 0. Pre-normalize: resolve truncated/prefix attack & cq-raise IDs in-place.
    {
      const attackIdByPrefix = new Map<string, string>();
      for (const id of opposingRebuttals.keys()) {
        for (let len = 8; len <= id.length; len++) {
          const p = id.slice(0, len);
          if (attackIdByPrefix.has(p)) attackIdByPrefix.set(p, "__ambiguous__");
          else attackIdByPrefix.set(p, id);
        }
      }
      const cqIdByPrefix = new Map<string, string>();
      for (const id of opposingCqRaises.keys()) {
        for (let len = 8; len <= id.length; len++) {
          const p = id.slice(0, len);
          if (cqIdByPrefix.has(p)) cqIdByPrefix.set(p, "__ambiguous__");
          else cqIdByPrefix.set(p, id);
        }
      }
      const resolveAttack = (raw: string): string => {
        if (opposingRebuttals.has(raw)) return raw;
        const m = attackIdByPrefix.get(raw);
        return m && m !== "__ambiguous__" ? m : raw;
      };
      const resolveCq = (raw: string): string => {
        if (opposingCqRaises.has(raw)) return raw;
        const m = cqIdByPrefix.get(raw);
        return m && m !== "__ambiguous__" ? m : raw;
      };
      for (const r of data.responses) r.targetAttackId = resolveAttack(r.targetAttackId);
      for (const c of data.cqAnswers) c.targetCqRaiseId = resolveCq(c.targetCqRaiseId);
    }

    // 1. advocateRole consistency.
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
    {
      const seen = new Set<string>();
      for (let i = 0; i < (data.webCitations ?? []).length; i++) {
        const t = data.webCitations![i].token;
        if (seen.has(t)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `webCitations[${i}].token "${t}" is duplicated`,
            path: ["webCitations", i, "token"],
          });
        }
        seen.add(t);
      }
    }

    // 2. Coverage: every opposing rebuttal must receive exactly one response.
    const seenAttackIds = new Set<string>();
    for (let i = 0; i < data.responses.length; i++) {
      const r = data.responses[i];
      const binding = opposingRebuttals.get(r.targetAttackId);
      if (!binding) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `responses[${i}].targetAttackId "${r.targetAttackId}" is not a known opposing rebuttal`,
          path: ["responses", i, "targetAttackId"],
        });
        continue;
      }
      if (seenAttackIds.has(r.targetAttackId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `responses[${i}]: duplicate response to attack "${r.targetAttackId}" (per-attack defense cap is 1)`,
          path: ["responses", i, "targetAttackId"],
        });
      }
      seenAttackIds.add(r.targetAttackId);
    }
    for (const expectedAttackId of opposingRebuttals.keys()) {
      if (!seenAttackIds.has(expectedAttackId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `responses[]: missing response for attack "${expectedAttackId}"; every opposing rebuttal must receive exactly one response`,
          path: ["responses"],
        });
      }
    }

    // 3. kind / defense / narrowedConclusionText consistency per response.
    for (let i = 0; i < data.responses.length; i++) {
      const r = data.responses[i];
      if (r.kind === "defend") {
        if (r.defense === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}]: kind="defend" requires defense to be non-null`,
            path: ["responses", i, "defense"],
          });
        }
        if (r.narrowedConclusionText !== null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}]: kind="defend" requires narrowedConclusionText to be null`,
            path: ["responses", i, "narrowedConclusionText"],
          });
        }
      } else if (r.kind === "concede") {
        if (r.defense !== null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}]: kind="concede" requires defense to be null`,
            path: ["responses", i, "defense"],
          });
        }
        if (r.narrowedConclusionText !== null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}]: kind="concede" requires narrowedConclusionText to be null`,
            path: ["responses", i, "narrowedConclusionText"],
          });
        }
      } else if (r.kind === "narrow") {
        if (r.narrowedConclusionText === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}]: kind="narrow" requires narrowedConclusionText to be non-null`,
            path: ["responses", i, "narrowedConclusionText"],
          });
        }
      }
    }

    // 4. Defense targeting: UNDERMINE requires premise index in range, REBUT/UNDERCUT require null.
    for (let i = 0; i < data.responses.length; i++) {
      const r = data.responses[i];
      if (!r.defense) continue;
      const binding = opposingRebuttals.get(r.targetAttackId);
      if (!binding) continue; // already flagged above

      if (r.defense.attackType === "UNDERMINE") {
        if (r.defense.targetPremiseIndex === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}].defense: UNDERMINE requires targetPremiseIndex`,
            path: ["responses", i, "defense", "targetPremiseIndex"],
          });
        } else if (r.defense.targetPremiseIndex >= binding.rebuttalPremiseCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}].defense: targetPremiseIndex ${r.defense.targetPremiseIndex} out of range; targeted rebuttal has ${binding.rebuttalPremiseCount} premises`,
            path: ["responses", i, "defense", "targetPremiseIndex"],
          });
        }
      } else if (r.defense.targetPremiseIndex !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `responses[${i}].defense: targetPremiseIndex must be null for ${r.defense.attackType} (only UNDERMINE targets a specific premise)`,
          path: ["responses", i, "defense", "targetPremiseIndex"],
        });
      }
    }

    // 5. Citation tokens on defense premises must resolve to corpus OR declared web tokens.
    for (let i = 0; i < data.responses.length; i++) {
      const r = data.responses[i];
      if (!r.defense) continue;
      for (let j = 0; j < r.defense.premises.length; j++) {
        const tok = r.defense.premises[j].citationToken;
        if (tok !== null && !allowedCitationTokens.has(tok) && !declaredWebTokens.has(tok)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `responses[${i}].defense.premises[${j}].citationToken "${tok}" is not in EVIDENCE_CORPUS or in webCitations`,
            path: ["responses", i, "defense", "premises", j, "citationToken"],
          });
        }
      }
    }

    // 6. CQ-answer coverage: every opposing CQ raise must receive exactly one answer.
    const seenCqIds = new Set<string>();
    for (let i = 0; i < data.cqAnswers.length; i++) {
      const c = data.cqAnswers[i];
      if (!opposingCqRaises.has(c.targetCqRaiseId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cqAnswers[${i}].targetCqRaiseId "${c.targetCqRaiseId}" is not a known opposing CQ raise`,
          path: ["cqAnswers", i, "targetCqRaiseId"],
        });
        continue;
      }
      if (seenCqIds.has(c.targetCqRaiseId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cqAnswers[${i}]: duplicate answer to CQ raise "${c.targetCqRaiseId}"`,
          path: ["cqAnswers", i, "targetCqRaiseId"],
        });
      }
      seenCqIds.add(c.targetCqRaiseId);
    }
    for (const expectedCqId of opposingCqRaises.keys()) {
      if (!seenCqIds.has(expectedCqId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cqAnswers[]: missing answer for CQ raise "${expectedCqId}"; every opposing CQ raise must receive exactly one answer`,
          path: ["cqAnswers"],
        });
      }
    }
  });
}

export type DefenseOutputSchema = ReturnType<typeof buildDefenseOutputSchema>;
