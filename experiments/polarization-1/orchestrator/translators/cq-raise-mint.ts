/**
 * orchestrator/translators/cq-raise-mint.ts
 *
 * Phase-7 translator: converts each `ChallengerPlan.raises[]` entry
 * into two platform writes, in this order:
 *
 *   1. POST /api/arguments/{targetId}/cqs/{cqKey}/ask
 *        — opens a CQStatus(open) row + a WHY DialogueMove
 *          authored by the challenger's bearer token (= the
 *          challenger's userId). Contributes to `cqCoverage`
 *          (denominator) and `challengerCoverage` (via WHY-move
 *          authors).
 *
 *   2. POST /api/ca
 *        — creates a ConflictApplication row binding voiceArg →
 *          targetArg. The fingerprint's `challengerAuthorsByArg`
 *          set credits `CA.createdById` (= the challenger's userId,
 *          via getCurrentUserId). schemeKey/cqKey are passed only
 *          inside `metaJson` so the route does NOT auto-answer the
 *          CQ — the raise must remain `open` until a defender
 *          actually answers it.
 *
 * Soft-degrade: per-raise failures (either /ask or /ca) are caught
 * individually and surfaced as `SkippedRaiseRecord`s. The other
 * raises in the plan continue. A `RaiseMintReport` is returned to
 * the finalizer for inclusion in PHASE_7_COMPLETE.json + CHALLENGES.md.
 *
 * Authorship: each challenger's plan is minted under THAT
 * challenger's role (`advocate-a` / `advocate-b` / `methodologist`).
 * The role drives both bearer-token selection (via IsonomiaClient
 * routing on `ctx.role`) and `authorId` resolution
 * (`agentByRole(cfg, role).userId`).
 */

import type { OrchestratorConfig } from "../config";
import { agentByRole } from "../config";
import type { IsonomiaClient } from "../isonomia-client";
import type { RoundLogger } from "../log/round-logger";
import type { ChallengerPlan } from "../agents/challenger-schema";
import type { ChallengerRole } from "../phases/phase-7-cq-raise";

export interface MintedRaiseRecord {
  agentRole: ChallengerRole;
  targetArgumentId: string;
  voiceArgumentId: string;
  schemeKey: string;
  cqKey: string;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "conclusion" | "inference" | "premise";
  caId: string;
}

export interface SkippedRaiseRecord {
  agentRole: ChallengerRole;
  targetArgumentId: string;
  voiceArgumentId: string;
  schemeKey: string;
  cqKey: string;
  /** Which step failed. */
  step: "raiseCq" | "createConflictApplication";
  reason: string;
  errorMessage: string;
}

export interface RaiseMintReport {
  deliberationId: string;
  totals: {
    raisesRequested: number;
    raisesMinted: number;
    raisesSkipped: number;
    /** Number of distinct (target, cqKey) pairs that were already in
     *  CQStatus before this run (translator pre-filter, NOT counted in
     *  `raisesRequested`). */
    raisesPreFiltered: number;
  };
  perAgent: Array<{
    agentRole: ChallengerRole;
    requested: number;
    minted: number;
    skipped: number;
    preFiltered: number;
  }>;
  raised: MintedRaiseRecord[];
  skipped: SkippedRaiseRecord[];
}

export interface MintCqRaisesOpts {
  cfg: OrchestratorConfig;
  iso: IsonomiaClient;
  deliberationId: string;
  /** Plans grouped by the agent that produced them. */
  plansByAgent: Array<{ agentRole: ChallengerRole; plan: ChallengerPlan }>;
  /** Pre-existing per-agent CA dedup keys, `${createdById}::${argId}::${cqKey}`.
   *  Translator skips raises whose key matches a CA the same agent has
   *  already minted (so re-runs of finalize after a partial failure
   *  remain idempotent without blocking unrelated agents). */
  existingCqStateKeys: ReadonlySet<string>;
  logger: RoundLogger;
}

export async function mintCqRaises(opts: MintCqRaisesOpts): Promise<RaiseMintReport> {
  const raised: MintedRaiseRecord[] = [];
  const skipped: SkippedRaiseRecord[] = [];
  const perAgent: RaiseMintReport["perAgent"] = [];
  let preFilteredTotal = 0;
  let requestedTotal = 0;

  // Per-run dedup so two challengers can't both raise the same
  // (target, cqKey) — first one wins.
  const mintedKeys = new Set<string>(opts.existingCqStateKeys);

  for (const { agentRole, plan } of opts.plansByAgent) {
    const ctx = { role: agentRole, logger: opts.logger };
    const agent = agentByRole(opts.cfg, agentRole);
    let agentMinted = 0;
    let agentSkipped = 0;
    let agentPreFiltered = 0;
    requestedTotal += plan.raises.length;

    for (const raise of plan.raises) {
      const dedupKey = `${agent.userId}::${raise.targetArgumentId}::${raise.cqKey}`;
      if (mintedKeys.has(dedupKey)) {
        agentPreFiltered++;
        preFilteredTotal++;
        opts.logger.event("cq_raise_skip_duplicate", {
          step: "cq-raise-mint",
          agent: agentRole,
          targetArgumentId: raise.targetArgumentId,
          cqKey: raise.cqKey,
          reason: "duplicate-of-existing-or-prior-mint",
        });
        continue;
      }

      // Step 1: /ask — open CQStatus + WHY move.
      try {
        await opts.iso.raiseCq(
          raise.targetArgumentId,
          raise.cqKey,
          {
            deliberationId: opts.deliberationId,
            authorId: agent.userId,
            schemeKey: raise.schemeKey,
          },
          ctx,
        );
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        opts.logger.event("cq_raise_skip", {
          step: "cq-raise-mint",
          phase: 7,
          agent: agentRole,
          targetArgumentId: raise.targetArgumentId,
          cqKey: raise.cqKey,
          failure: "raiseCq",
          error: msg,
        });
        skipped.push({
          agentRole,
          targetArgumentId: raise.targetArgumentId,
          voiceArgumentId: raise.voiceArgumentId,
          schemeKey: raise.schemeKey,
          cqKey: raise.cqKey,
          step: "raiseCq",
          reason: "POST /ask failed",
          errorMessage: msg.slice(0, 500),
        });
        agentSkipped++;
        continue;
      }

      // Step 2: /api/ca — anchor the challenger event.
      let caId: string;
      try {
        const r = await opts.iso.createConflictApplication(
          {
            deliberationId: opts.deliberationId,
            conflictingArgumentId: raise.voiceArgumentId,
            conflictedArgumentId: raise.targetArgumentId,
            legacyAttackType: raise.attackType,
            legacyTargetScope: raise.targetScope,
            metaJson: {
              schemeKey: raise.schemeKey,
              cqKey: raise.cqKey,
              ...(raise.cqContext ? { cqContext: raise.cqContext } : {}),
              source: "phase-7-challenger",
            },
          },
          ctx,
        );
        caId = r.caId;
      } catch (err) {
        const msg = (err as Error)?.message ?? String(err);
        opts.logger.event("cq_raise_skip", {
          step: "cq-raise-mint",
          phase: 7,
          agent: agentRole,
          targetArgumentId: raise.targetArgumentId,
          cqKey: raise.cqKey,
          failure: "createConflictApplication",
          error: msg,
        });
        skipped.push({
          agentRole,
          targetArgumentId: raise.targetArgumentId,
          voiceArgumentId: raise.voiceArgumentId,
          schemeKey: raise.schemeKey,
          cqKey: raise.cqKey,
          step: "createConflictApplication",
          reason: "POST /api/ca failed (CQStatus row created but un-anchored)",
          errorMessage: msg.slice(0, 500),
        });
        // Note: the /ask side-effect already happened; we record the
        // partial as a skipped raise so the finalizer + CHALLENGES.md
        // surface the inconsistency. Manual cleanup is rare since
        // the /ca route is purely additive.
        agentSkipped++;
        continue;
      }

      raised.push({
        agentRole,
        targetArgumentId: raise.targetArgumentId,
        voiceArgumentId: raise.voiceArgumentId,
        schemeKey: raise.schemeKey,
        cqKey: raise.cqKey,
        attackType: raise.attackType,
        targetScope: raise.targetScope,
        caId,
      });
      mintedKeys.add(dedupKey);
      agentMinted++;
      opts.logger.event("cq_raise_minted", {
        step: "cq-raise-mint",
        phase: 7,
        agent: agentRole,
        targetArgumentId: raise.targetArgumentId,
        cqKey: raise.cqKey,
        schemeKey: raise.schemeKey,
        caId,
      });
    }

    perAgent.push({
      agentRole,
      requested: plan.raises.length,
      minted: agentMinted,
      skipped: agentSkipped,
      preFiltered: agentPreFiltered,
    });
  }

  const report: RaiseMintReport = {
    deliberationId: opts.deliberationId,
    totals: {
      raisesRequested: requestedTotal,
      raisesMinted: raised.length,
      raisesSkipped: skipped.length,
      raisesPreFiltered: preFilteredTotal,
    },
    perAgent,
    raised,
    skipped,
  };

  opts.logger.event("cq_raise_mint_complete", {
    step: "cq-raise-mint",
    phase: 7,
    ...report.totals,
  });

  return report;
}
