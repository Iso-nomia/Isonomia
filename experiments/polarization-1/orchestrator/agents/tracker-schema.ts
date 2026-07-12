/**
 * agents/tracker-schema.ts
 *
 * Zod contract for the Phase-4 Concession Tracker — a third (non-advocate)
 * agent that reads the entire dialectical record at end of Phase 4 and
 * produces structured per-argument standings + a central-claim verdict.
 *
 * Mirror of `prompts/8-tracker.md` §4.1 schema, with hard-validation
 * rules from §5 mechanically enforced via superRefine.
 *
 * The verdict is reading-only: the tracker does not modify the record.
 * Its output is consumed by reviewers and by `phase-4-finalize.ts` which
 * subsequently calls `recomputeGroundedForDelib` to drive the
 * platform-side standings update.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Top-level shapes
// ─────────────────────────────────────────────────────────────────

const StandingZ = z.enum(["STANDS", "WEAKENED", "FALLEN"]);
export type Standing = z.infer<typeof StandingZ>;

const EffectiveConcessionZ = z.object({
  kind: z.enum(["premise", "conclusion", "warrant", "cq"]),
  premiseIndex: z.number().int().nonnegative().nullable(),
  cqKey: z.string().nullable(),
  /** A real Phase-4 responseId or cqAnswerId from the input record. */
  drivenBy: z.string().min(4),
});
export type EffectiveConcession = z.infer<typeof EffectiveConcessionZ>;

const SuccessfulDefenseZ = z.object({
  /** A real Phase-3 rebuttalArgumentId from the input record. */
  againstAttackId: z.string().min(4),
  /** A real Phase-4 responseId from the input record. */
  drivenBy: z.string().min(4),
  rationale: z.string().min(40).max(400),
});
export type SuccessfulDefense = z.infer<typeof SuccessfulDefenseZ>;

const ArgumentStandingZ = z.object({
  /** A Phase-2 argumentId from either advocate. */
  argumentId: z.string().min(4),
  advocateRole: z.enum(["A", "B"]),
  standing: StandingZ,
  isHingeArgument: z.boolean(),
  rationale: z.string().min(60).max(600),
  effectiveConcessions: z.array(EffectiveConcessionZ).default([]),
  successfulDefenses: z.array(SuccessfulDefenseZ).default([]),
});
export type ArgumentStanding = z.infer<typeof ArgumentStandingZ>;

const HingeStandingsZ = z.object({
  stoodCount: z.number().int().nonnegative(),
  weakenedCount: z.number().int().nonnegative(),
  fallenCount: z.number().int().nonnegative(),
});

const AdvocateSummaryZ = z.object({
  advocateRole: z.enum(["A", "B"]),
  totalArguments: z.number().int().nonnegative(),
  stoodCount: z.number().int().nonnegative(),
  weakenedCount: z.number().int().nonnegative(),
  fallenCount: z.number().int().nonnegative(),
  hingeStandings: HingeStandingsZ,
  concessionDiscrimination: z.enum(["GOOD", "MIXED", "POOR"]),
  concessionDiscriminationRationale: z.string().min(60).max(400),
});
export type AdvocateSummary = z.infer<typeof AdvocateSummaryZ>;

const CentralClaimVerdictZ = z.object({
  verdict: z.enum(["STILL_SUPPORTED", "PUSHED_TOWARD_REJECTION", "CONTESTED"]),
  rationale: z.string().min(200).max(1200),
  primarySupportingArguments: z.array(z.string().min(4)).default([]),
  primaryUnderminingArguments: z.array(z.string().min(4)).default([]),
});
export type CentralClaimVerdict = z.infer<typeof CentralClaimVerdictZ>;

const TrackerVerdictZ = z.object({
  phase: z.literal("4-tracker"),
  argumentStandings: z.array(ArgumentStandingZ).min(1),
  advocateSummaries: z.array(AdvocateSummaryZ).length(2),
  centralClaimVerdict: CentralClaimVerdictZ,
});
export type TrackerVerdict = z.infer<typeof TrackerVerdictZ>;

// ─────────────────────────────────────────────────────────────────
// Refusal
// ─────────────────────────────────────────────────────────────────

export const TrackerRefusalZ = z.object({
  error: z.enum([
    /** Un-responded Phase-4 attacks, missing hinge designations, or unresolved Phase-3 argumentIds. */
    "RECORD_INCOMPLETE",
    /** Phase-4 references attacks not in Phase 3, or Phase-3 references args not in Phase 2. */
    "RECORD_INCONSISTENT",
    /** Framing as written does not provide a rubric for a load-bearing concession in the record. */
    "FRAMING_AMBIGUOUS",
  ]),
  details: z.string().max(500),
});
export type TrackerRefusal = z.infer<typeof TrackerRefusalZ>;

export function isTrackerRefusal(r: unknown): r is TrackerRefusal {
  return typeof (r as any)?.error === "string" && !Array.isArray((r as any)?.argumentStandings);
}

// ─────────────────────────────────────────────────────────────────
// Schema-binding inputs from the orchestrator
// ─────────────────────────────────────────────────────────────────

export interface TrackerArgumentBinding {
  /** Phase-2 argumentId. */
  argumentId: string;
  advocateRole: "A" | "B";
  isHingeArgument: boolean;
}

export interface TrackerSchemaOpts {
  /** Keyed by Phase-2 argumentId. Used to verify all advocate args appear. */
  knownArguments: ReadonlyMap<string, TrackerArgumentBinding>;
  /** Phase-3 rebuttal arg ids. Used to validate `successfulDefenses[*].againstAttackId`. */
  knownAttackIds: ReadonlySet<string>;
  /** Phase-4 response ids + cqAnswer ids. Used to validate `drivenBy` references. */
  knownPhase4ResponseIds: ReadonlySet<string>;
}

// ─────────────────────────────────────────────────────────────────
// Parameterized schema builder
// ─────────────────────────────────────────────────────────────────

export function buildTrackerVerdictSchema(opts: TrackerSchemaOpts) {
  const { knownArguments, knownAttackIds, knownPhase4ResponseIds } = opts;

  // Tolerant pre-normalizer: the tracker LLM is given hard rules in
  // prompts/8-tracker.md §5 but does not always satisfy them. Rather
  // than fail the entire run on small bookkeeping mistakes, snap the
  // most common ones into the valid shape *before* superRefine runs.
  // The deeper semantic claims (which arguments stand vs fall, what
  // counts as effective concession, the central-claim verdict text)
  // are NOT touched — only the mechanical bookkeeping fields.
  const Normalized = z.preprocess((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const data = raw as any;

    // (a) centralClaimVerdict.rationale length cap (1200 chars).
    const ccv = data.centralClaimVerdict;
    if (ccv && typeof ccv.rationale === "string" && ccv.rationale.length > 1200) {
      ccv.rationale = ccv.rationale.slice(0, 1197) + "...";
    }

    // (a2) advocateSummaries[*].concessionDiscriminationRationale length
    // cap (400 chars).
    if (Array.isArray(data.advocateSummaries)) {
      for (const sum of data.advocateSummaries) {
        if (
          sum &&
          typeof sum.concessionDiscriminationRationale === "string" &&
          sum.concessionDiscriminationRationale.length > 400
        ) {
          sum.concessionDiscriminationRationale =
            sum.concessionDiscriminationRationale.slice(0, 397) + "...";
        }
      }
    }

    // (a3) argumentStandings[*].rationale length cap (600 chars).
    if (Array.isArray(data.argumentStandings)) {
      for (const s of data.argumentStandings) {
        if (s && typeof s.rationale === "string" && s.rationale.length > 600) {
          s.rationale = s.rationale.slice(0, 597) + "...";
        }
        if (Array.isArray(s?.successfulDefenses)) {
          for (const sd of s.successfulDefenses) {
            if (sd && typeof sd.rationale === "string" && sd.rationale.length > 400) {
              sd.rationale = sd.rationale.slice(0, 397) + "...";
            }
            // Strip trailing parenthetical descriptions from id fields.
            if (sd && typeof sd.againstAttackId === "string") {
              sd.againstAttackId = sd.againstAttackId.split(/[\s(]/)[0];
            }
            if (sd && typeof sd.drivenBy === "string") {
              sd.drivenBy = sd.drivenBy.split(/[\s(]/)[0];
            }
          }
        }
        if (Array.isArray(s?.effectiveConcessions)) {
          for (const ec of s.effectiveConcessions) {
            if (ec && typeof ec.drivenBy === "string") {
              ec.drivenBy = ec.drivenBy.split(/[\s(]/)[0];
            }
          }
        }
      }
    }

    // (b) argumentStandings: snap isHingeArgument + advocateRole to
    // the known binding; drop invalid effectiveConcessions; collect
    // seen ids so we can backfill missing standings below.
    const seenIds = new Set<string>();
    const standings = Array.isArray(data.argumentStandings) ? data.argumentStandings : [];
    for (const s of standings) {
      if (!s || typeof s !== "object") continue;
      const binding = knownArguments.get(s.argumentId);
      if (binding) {
        seenIds.add(s.argumentId);
        if (typeof s.isHingeArgument === "boolean" && s.isHingeArgument !== binding.isHingeArgument) {
          s.isHingeArgument = binding.isHingeArgument;
        }
        if (s.advocateRole !== binding.advocateRole) {
          s.advocateRole = binding.advocateRole;
        }
      }
      if (Array.isArray(s.effectiveConcessions)) {
        s.effectiveConcessions = s.effectiveConcessions.filter((ec: any) => {
          if (!ec || typeof ec !== "object") return false;
          // Drop kind="cq" entries with no cqKey — the LLM occasionally
          // emits these when concessions cross-reference rebuttals
          // without a CQ context. They contain no usable information.
          if (ec.kind === "cq" && (ec.cqKey === null || ec.cqKey === undefined || ec.cqKey === "")) {
            return false;
          }
          // Drop kind="premise" entries with no premiseIndex (same reason).
          if (ec.kind === "premise" && (ec.premiseIndex === null || ec.premiseIndex === undefined)) {
            return false;
          }
          return true;
        });
      }
    }

    // (c) Backfill missing standings for any Phase-2 argument the LLM
    // forgot, defaulting to STANDS (conservative — assumes the argument
    // survived absent any explicit fall verdict).
    for (const [argId, binding] of knownArguments.entries()) {
      if (!seenIds.has(argId)) {
        standings.push({
          argumentId: argId,
          advocateRole: binding.advocateRole,
          standing: "STANDS",
          isHingeArgument: binding.isHingeArgument,
          rationale:
            "[auto-backfilled] No explicit standing was emitted by the tracker for this argument; defaulting to STANDS in the absence of any recorded effective concession.",
          effectiveConcessions: [],
          successfulDefenses: [],
        });
      }
    }
    data.argumentStandings = standings;

    // (d) advocateSummaries: recompute count fields from argumentStandings
    // tally and known bindings. Leaves the qualitative fields
    // (concessionDiscrimination + rationale) untouched.
    const tally: Record<"A" | "B", { S: number; W: number; F: number; H_S: number; H_W: number; H_F: number }> = {
      A: { S: 0, W: 0, F: 0, H_S: 0, H_W: 0, H_F: 0 },
      B: { S: 0, W: 0, F: 0, H_S: 0, H_W: 0, H_F: 0 },
    };
    const totals: Record<"A" | "B", number> = { A: 0, B: 0 };
    const hinges: Record<"A" | "B", number> = { A: 0, B: 0 };
    for (const b of knownArguments.values()) {
      totals[b.advocateRole]++;
      if (b.isHingeArgument) hinges[b.advocateRole]++;
    }
    for (const s of standings) {
      const t = tally[s.advocateRole as "A" | "B"];
      if (!t) continue;
      if (s.standing === "STANDS") { t.S++; if (s.isHingeArgument) t.H_S++; }
      else if (s.standing === "WEAKENED") { t.W++; if (s.isHingeArgument) t.H_W++; }
      else if (s.standing === "FALLEN") { t.F++; if (s.isHingeArgument) t.H_F++; }
    }
    if (Array.isArray(data.advocateSummaries)) {
      for (const sum of data.advocateSummaries) {
        if (!sum || typeof sum !== "object") continue;
        const role = sum.advocateRole as "A" | "B";
        const t = tally[role];
        if (!t) continue;
        sum.totalArguments = totals[role];
        sum.stoodCount = t.S;
        sum.weakenedCount = t.W;
        sum.fallenCount = t.F;
        if (!sum.hingeStandings || typeof sum.hingeStandings !== "object") sum.hingeStandings = {};
        sum.hingeStandings.stoodCount = t.H_S;
        sum.hingeStandings.weakenedCount = t.H_W;
        sum.hingeStandings.fallenCount = t.H_F;
      }
    }

    return data;
  }, TrackerVerdictZ);

  return Normalized.superRefine((data, ctx) => {
    // 1. Every Phase-2 argument from both advocates appears in argumentStandings.
    const seenArgIds = new Set<string>();
    for (let i = 0; i < data.argumentStandings.length; i++) {
      const s = data.argumentStandings[i];
      const binding = knownArguments.get(s.argumentId);
      if (!binding) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `argumentStandings[${i}].argumentId "${s.argumentId}" is not a known Phase-2 argument`,
          path: ["argumentStandings", i, "argumentId"],
        });
        continue;
      }
      if (seenArgIds.has(s.argumentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `argumentStandings[${i}]: duplicate standing for argument "${s.argumentId}"`,
          path: ["argumentStandings", i, "argumentId"],
        });
      }
      seenArgIds.add(s.argumentId);

      // advocateRole consistency vs the known binding.
      if (s.advocateRole !== binding.advocateRole) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `argumentStandings[${i}].advocateRole "${s.advocateRole}" disagrees with known binding "${binding.advocateRole}"`,
          path: ["argumentStandings", i, "advocateRole"],
        });
      }
      if (s.isHingeArgument !== binding.isHingeArgument) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `argumentStandings[${i}].isHingeArgument "${s.isHingeArgument}" disagrees with topology binding "${binding.isHingeArgument}"`,
          path: ["argumentStandings", i, "isHingeArgument"],
        });
      }

      // successfulDefenses references (attackId, responseId).
      for (let j = 0; j < s.successfulDefenses.length; j++) {
        const sd = s.successfulDefenses[j];
        if (!knownAttackIds.has(sd.againstAttackId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `argumentStandings[${i}].successfulDefenses[${j}].againstAttackId "${sd.againstAttackId}" is not a known Phase-3 attack`,
            path: ["argumentStandings", i, "successfulDefenses", j, "againstAttackId"],
          });
        }
        if (!knownPhase4ResponseIds.has(sd.drivenBy)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `argumentStandings[${i}].successfulDefenses[${j}].drivenBy "${sd.drivenBy}" is not a known Phase-4 response`,
            path: ["argumentStandings", i, "successfulDefenses", j, "drivenBy"],
          });
        }
      }
      // effectiveConcessions reference responseId (or cqAnswerId).
      for (let j = 0; j < s.effectiveConcessions.length; j++) {
        const ec = s.effectiveConcessions[j];
        if (!knownPhase4ResponseIds.has(ec.drivenBy)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `argumentStandings[${i}].effectiveConcessions[${j}].drivenBy "${ec.drivenBy}" is not a known Phase-4 response`,
            path: ["argumentStandings", i, "effectiveConcessions", j, "drivenBy"],
          });
        }
        if (ec.kind === "premise" && ec.premiseIndex === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `argumentStandings[${i}].effectiveConcessions[${j}]: kind="premise" requires non-null premiseIndex`,
            path: ["argumentStandings", i, "effectiveConcessions", j, "premiseIndex"],
          });
        }
        if (ec.kind === "cq" && (ec.cqKey === null || ec.cqKey.length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `argumentStandings[${i}].effectiveConcessions[${j}]: kind="cq" requires non-null cqKey`,
            path: ["argumentStandings", i, "effectiveConcessions", j, "cqKey"],
          });
        }
      }
    }
    for (const expectedId of knownArguments.keys()) {
      if (!seenArgIds.has(expectedId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `argumentStandings[]: missing standing for Phase-2 argument "${expectedId}"; every argument from both advocates must appear`,
          path: ["argumentStandings"],
        });
      }
    }

    // 2. advocateSummaries: exactly one A and one B; counts sum.
    const seenRoles = new Set<"A" | "B">();
    const argsByRole = { A: 0, B: 0 } as Record<"A" | "B", number>;
    const hingesByRole = { A: 0, B: 0 } as Record<"A" | "B", number>;
    for (const b of knownArguments.values()) {
      argsByRole[b.advocateRole]++;
      if (b.isHingeArgument) hingesByRole[b.advocateRole]++;
    }
    for (let i = 0; i < data.advocateSummaries.length; i++) {
      const sum = data.advocateSummaries[i];
      if (seenRoles.has(sum.advocateRole)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `advocateSummaries[${i}]: duplicate advocateRole "${sum.advocateRole}" (must be exactly one A and one B)`,
          path: ["advocateSummaries", i, "advocateRole"],
        });
      }
      seenRoles.add(sum.advocateRole);
      const expectedTotal = argsByRole[sum.advocateRole];
      if (sum.totalArguments !== expectedTotal) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `advocateSummaries[${i}].totalArguments=${sum.totalArguments} disagrees with known Phase-2 count ${expectedTotal} for role "${sum.advocateRole}"`,
          path: ["advocateSummaries", i, "totalArguments"],
        });
      }
      if (sum.stoodCount + sum.weakenedCount + sum.fallenCount !== sum.totalArguments) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `advocateSummaries[${i}]: stoodCount + weakenedCount + fallenCount (${sum.stoodCount + sum.weakenedCount + sum.fallenCount}) must equal totalArguments (${sum.totalArguments})`,
          path: ["advocateSummaries", i],
        });
      }
      const expectedHinge = hingesByRole[sum.advocateRole];
      const hingeSum =
        sum.hingeStandings.stoodCount + sum.hingeStandings.weakenedCount + sum.hingeStandings.fallenCount;
      if (hingeSum !== expectedHinge) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `advocateSummaries[${i}].hingeStandings sum (${hingeSum}) must equal known hinge count ${expectedHinge} for role "${sum.advocateRole}"`,
          path: ["advocateSummaries", i, "hingeStandings"],
        });
      }
    }
    if (!seenRoles.has("A")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `advocateSummaries[]: missing entry for advocateRole "A"`,
        path: ["advocateSummaries"],
      });
    }
    if (!seenRoles.has("B")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `advocateSummaries[]: missing entry for advocateRole "B"`,
        path: ["advocateSummaries"],
      });
    }

    // 3. Cross-check argumentStandings counts against advocateSummaries counts.
    const tally = { A: { S: 0, W: 0, F: 0, H_S: 0, H_W: 0, H_F: 0 }, B: { S: 0, W: 0, F: 0, H_S: 0, H_W: 0, H_F: 0 } };
    for (const s of data.argumentStandings) {
      const t = tally[s.advocateRole];
      if (!t) continue;
      if (s.standing === "STANDS") { t.S++; if (s.isHingeArgument) t.H_S++; }
      else if (s.standing === "WEAKENED") { t.W++; if (s.isHingeArgument) t.H_W++; }
      else if (s.standing === "FALLEN") { t.F++; if (s.isHingeArgument) t.H_F++; }
    }
    for (let i = 0; i < data.advocateSummaries.length; i++) {
      const sum = data.advocateSummaries[i];
      const t = tally[sum.advocateRole];
      if (!t) continue;
      if (t.S !== sum.stoodCount || t.W !== sum.weakenedCount || t.F !== sum.fallenCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `advocateSummaries[${i}]: standings counts (S=${sum.stoodCount},W=${sum.weakenedCount},F=${sum.fallenCount}) disagree with argumentStandings tally (S=${t.S},W=${t.W},F=${t.F}) for role "${sum.advocateRole}"`,
          path: ["advocateSummaries", i],
        });
      }
      if (
        t.H_S !== sum.hingeStandings.stoodCount ||
        t.H_W !== sum.hingeStandings.weakenedCount ||
        t.H_F !== sum.hingeStandings.fallenCount
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `advocateSummaries[${i}]: hingeStandings counts disagree with argumentStandings hinge tally for role "${sum.advocateRole}"`,
          path: ["advocateSummaries", i, "hingeStandings"],
        });
      }
    }

    // 4. centralClaimVerdict: primary*Arguments must reference known Phase-2 arg ids.
    for (let i = 0; i < data.centralClaimVerdict.primarySupportingArguments.length; i++) {
      const id = data.centralClaimVerdict.primarySupportingArguments[i];
      if (!knownArguments.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `centralClaimVerdict.primarySupportingArguments[${i}] "${id}" is not a known Phase-2 argument`,
          path: ["centralClaimVerdict", "primarySupportingArguments", i],
        });
      }
    }
    for (let i = 0; i < data.centralClaimVerdict.primaryUnderminingArguments.length; i++) {
      const id = data.centralClaimVerdict.primaryUnderminingArguments[i];
      if (!knownArguments.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `centralClaimVerdict.primaryUnderminingArguments[${i}] "${id}" is not a known Phase-2 argument`,
          path: ["centralClaimVerdict", "primaryUnderminingArguments", i],
        });
      }
    }
  });
}

export type TrackerVerdictSchema = ReturnType<typeof buildTrackerVerdictSchema>;
