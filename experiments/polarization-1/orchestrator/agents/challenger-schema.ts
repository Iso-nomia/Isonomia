/**
 * agents/challenger-schema.ts
 *
 * Zod contract for the Phase-7 Challenger — a single-shot read-only
 * agent that runs after Phase 6 is finalized. Each challenger turn is
 * scoped to one agent role (advocate-a, advocate-b, methodologist) and
 * produces a `ChallengerPlan` enumerating up to N (target, scheme,
 * cq) raise tuples against load-bearing arguments owned by other
 * sides.
 *
 * Contract:
 *   • `targetArgumentId` must resolve in `knownArgumentIds` (the load-
 *     bearing P2/P3/P4 argument set), MUST NOT be in
 *     `ownArgumentIds` (no self-raises).
 *   • `voiceArgumentId` must resolve in `ownArgumentIds` — the
 *     challenger speaks under one of its already-minted P2/P3/P4
 *     arguments. No new arguments are minted by Phase 7.
 *   • `schemeKey` must be in `validSchemeKeys`; `cqKey` must be in
 *     `cqsBySchemeKey[schemeKey]`. The (target, schemeKey, cqKey)
 *     triple must not already appear as an open CQStatus on the target
 *     (that's the orchestrator's job to filter — schema accepts it but
 *     the translator skips duplicates).
 *   • `attackType` + `targetScope` mirror the catalog defaults for the
 *     CQ but the agent may override; the translator validates the
 *     attackType ↔ targetScope alignment per `legacyAttackType` ⇒
 *     `legacyTargetScope` mapping.
 */

import { z } from "zod";

export const ChallengerAttackTypeZ = z.enum([
  "REBUTS",
  "UNDERCUTS",
  "UNDERMINES",
]);
export type ChallengerAttackType = z.infer<typeof ChallengerAttackTypeZ>;

export const ChallengerTargetScopeZ = z.enum([
  "conclusion",
  "inference",
  "premise",
]);
export type ChallengerTargetScope = z.infer<typeof ChallengerTargetScopeZ>;

const RaisePlanZBase = z.object({
  targetArgumentId: z.string().min(4),
  voiceArgumentId: z.string().min(4),
  schemeKey: z.string().min(2),
  cqKey: z.string().min(1),
  attackType: ChallengerAttackTypeZ,
  targetScope: ChallengerTargetScopeZ,
  /**
   * 80-400 char justification — name the load-bearingness signal
   * (degree, contestednessRanking position, role in a chain) and the
   * specific gap the CQ surfaces.
   */
  rationale: z.string().min(80).max(400),
  /**
   * Optional 40-200 char in-context citation of the target's premise
   * or conclusion that the CQ speaks to. Used as `metaJson.cqContext`.
   */
  cqContext: z.string().min(40).max(200).optional(),
});

export const ChallengerPlanRefusalZ = z.object({
  outcome: z.literal("refused"),
  error: z.string().min(8).max(800),
});
export type ChallengerPlanRefusal = z.infer<typeof ChallengerPlanRefusalZ>;

export interface ChallengerSchemaOpts {
  /** Load-bearing target arguments (P2 + P3 + P4). */
  knownArgumentIds: Set<string>;
  /** Arguments the challenger may use as its `voiceArgumentId`. */
  ownArgumentIds: Set<string>;
  /** Scheme keys present in the catalog. */
  validSchemeKeys: Set<string>;
  /** For each scheme, the cqKeys defined on it. */
  cqsBySchemeKey: Record<string, Set<string>>;
  /** Maximum raises the challenger may emit in one turn. */
  maxRaises: number;
}

export interface ChallengerPlan {
  outcome: "ok";
  raises: Array<z.infer<typeof RaisePlanZBase>>;
  /** 200-1500 char executive summary of the agent's CQ-raise strategy
   *  for this turn (which targets, why, what gaps). */
  summary: string;
}

export const ChallengerPlanRefusalGuard = ChallengerPlanRefusalZ;

export function isChallengerRefusal(
  v: unknown,
): v is ChallengerPlanRefusal {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { outcome?: unknown }).outcome === "refused"
  );
}

export function buildChallengerPlanSchema(opts: ChallengerSchemaOpts) {
  const RaisePlanZ = RaisePlanZBase.superRefine((v, ctx) => {
    if (!opts.knownArgumentIds.has(v.targetArgumentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetArgumentId"],
        message: `targetArgumentId "${v.targetArgumentId}" is not in the load-bearing argument set.`,
      });
    }
    if (opts.ownArgumentIds.has(v.targetArgumentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetArgumentId"],
        message: `targetArgumentId "${v.targetArgumentId}" is owned by the calling agent — no self-raises.`,
      });
    }
    if (!opts.ownArgumentIds.has(v.voiceArgumentId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["voiceArgumentId"],
        message: `voiceArgumentId "${v.voiceArgumentId}" must be one of the calling agent's own P2/P3/P4 arguments.`,
      });
    }
    if (!opts.validSchemeKeys.has(v.schemeKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schemeKey"],
        message: `schemeKey "${v.schemeKey}" is not in the experiment scheme catalog.`,
      });
    } else {
      const cqs = opts.cqsBySchemeKey[v.schemeKey];
      if (!cqs || !cqs.has(v.cqKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cqKey"],
          message: `cqKey "${v.cqKey}" is not defined on scheme "${v.schemeKey}".`,
        });
      }
    }
    // Catalog parity guards on the (attackType, targetScope) pair.
    const allowed: Record<ChallengerAttackType, ChallengerTargetScope> = {
      REBUTS: "conclusion",
      UNDERCUTS: "inference",
      UNDERMINES: "premise",
    };
    if (allowed[v.attackType] !== v.targetScope) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetScope"],
        message: `targetScope must be "${allowed[v.attackType]}" when attackType="${v.attackType}" (catalog parity).`,
      });
    }
  });

  return z.discriminatedUnion("outcome", [
    z.object({
      outcome: z.literal("ok"),
      raises: z.array(RaisePlanZ).min(1).max(opts.maxRaises),
      summary: z.string().min(200).max(1500),
    }),
    ChallengerPlanRefusalZ,
  ]);
}
