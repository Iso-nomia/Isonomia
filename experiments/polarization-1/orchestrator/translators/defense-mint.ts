/**
 * orchestrator/translators/defense-mint.ts
 *
 * Materializes a validated `DefenseOutput` (Phase 4 — Concessions &
 * Defenses) onto the live deliberation. For each response in the
 * advocate's output:
 *
 *   - kind="defend":  Mint the defense as a fully-formed `Argument`
 *       (premises + scheme + conclusion + citations, exactly as Phase
 *       2/3 do), then create an `ArgumentEdge` from the defense
 *       Argument to the OPPOSING REBUTTAL Argument with the declared
 *       `attackType` (REBUTS / UNDERMINES / UNDERCUTS). The defense
 *       attacks the attack.
 *
 *   - kind="concede": Update the bot's `Commitment` row on the targeted
 *       claim to `isRetracted=true` (REBUT-targeted attacks → original
 *       conclusion claim; UNDERMINE-targeted attacks → original premise
 *       claim; UNDERCUT-targeted attacks → no commitment change because
 *       UNDERCUT challenges the inference rule, not a proposition).
 *       Also: if the conceded rebuttal carried a `cqKey`, upsert the
 *       corresponding CQStatus to `statusEnum=REJECTED` to record the
 *       advocate's acceptance of the CQ as unanswerable.
 *
 *   - kind="narrow":  Mint the `narrowedConclusionText` as a new Claim,
 *       create a variant `Argument` that re-uses the original argument's
 *       premises (no new citations needed; premises are already cited
 *       in the original) but concludes to the narrower claim. Retract
 *       the original conclusion commitment and ASSERT (via the new
 *       Argument route's auto-DialogueMove) the narrowed commitment.
 *       If `defense` is also non-null, mint the defense and attach it
 *       against the rebuttal as in `defend`.
 *
 * Then for each `cqAnswers[]` entry:
 *
 *   - kind="answer":  Upsert CQStatus on (targetArgumentId, cqKey) of
 *       THIS advocate's Phase-2 argument to `statusEnum=SATISFIED`,
 *       `status="answered"`, with the rationale stored as `groundsText`.
 *
 *   - kind="concede": Upsert CQStatus to `statusEnum=REJECTED`,
 *       `status="conceded"`, with the rationale as `groundsText`.
 *
 * Orphan-guard:
 *   - Phase 4 has no partial-resume — every run re-mints from scratch.
 *     Before doing any of the above, delete: (a) any defense `Argument`
 *     authored by this bot whose outgoing `ArgumentEdge` points at one
 *     of the opposing rebuttals; (b) any narrow-variant `Argument`
 *     authored by this bot whose `text` starts with the narrow-variant
 *     marker. Cascading from Argument deletion handles the edges.
 *   - We do NOT un-retract prior Commitment rows on partial re-runs;
 *     `Commitment.isRetracted=true` is idempotent at the row level. If
 *     the new run drops a previously-conceded response, that commitment
 *     stays retracted — but Phase 4's hard validation forces every
 *     attack to receive a response, so the only way a prior concession
 *     could "vanish" is if the run pivots to defend/narrow, in which
 *     case the new defend/narrow logic re-asserts the relevant claim.
 *   - CQStatus updates are idempotent (last write wins by composite
 *     key).
 *
 * Author signing:
 *   - Each advocate signs all of its own writes ("advocate-a" /
 *     "advocate-b"), same convention as Phase 2/3.
 */

import type { IsonomiaClient, IsonomiaCallContext } from "../isonomia-client";
import type { RoundLogger } from "../log/round-logger";
import { agentByRole } from "../config";
import type { OrchestratorConfig } from "../config";
import type {
  DefenseOutput,
  DefenseResponse,
  DefenseArgument,
  CqAnswer,
} from "../agents/defense-schema";
import { ClaimRegistry, resolvePremiseClaimIds } from "./claim-mint";
import { materializeWebCitations } from "./argument-mint";
import { postDialogueMove } from "./dialogue-move-mint";
import { prisma } from "@/lib/prismaclient";

// ─────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────

/**
 * Per-Phase-2 argument metadata this bot OWNS — needed to resolve
 * concede targets, build narrow variants, and upsert CQStatus rows.
 */
export interface OwnArgumentBinding {
  /** This bot's Phase-2 argumentId. */
  argumentId: string;
  /** This bot's Phase-2 argument scheme key (composite-key for CQStatus). */
  schemeKey: string;
  /** Resolved schemeId (cached from /api/schemes). */
  schemeId: string;
  /** Conclusion claim id of the Phase-2 argument (REBUT concedes retract this). */
  conclusionClaimId: string;
  /** Conclusion claim text (used to find the Commitment row by proposition). */
  conclusionText: string;
  /** Ordered premise claim ids of the Phase-2 argument (UNDERMINE concedes). */
  premiseClaimIds: readonly string[];
  /** Ordered premise claim texts (used for Commitment row by proposition). */
  premiseTexts: readonly string[];
}

/**
 * Per-rebuttal binding the OPPOSING advocate filed against this bot's
 * Phase-2 args during Phase 3. Each one of these MUST receive exactly
 * one Phase-4 response.
 */
export interface OpposingRebuttalBinding {
  /** Opposing rebuttal Argument id (the Phase-3 Argument created against THIS advocate). */
  rebuttalArgumentId: string;
  /** This advocate's Phase-2 argument id this rebuttal targets. */
  targetArgumentId: string;
  /** Premise count of the OPPOSING REBUTTAL — bounds defense UNDERMINE.targetPremiseIndex. */
  rebuttalPremiseCount: number;
  /** Ordered premise claim ids of the OPPOSING REBUTTAL — used to resolve defense UNDERMINE targetPremiseId. */
  rebuttalPremiseClaimIds: readonly string[];
  /** attackType the opposing rebuttal declared. */
  rebuttalAttackType: "REBUT" | "UNDERMINE" | "UNDERCUT";
  /** premise index in this bot's Phase-2 arg the opposing rebuttal targeted (for UNDERMINE rebuttals). */
  rebuttalTargetPremiseIndex: number | null;
  /** Conclusion claim id of the rebuttal — needed for defense REBUT (against the rebuttal's conclusion). */
  rebuttalConclusionClaimId: string;
  /** cqKey on the rebuttal (if any) — drives CQStatus update on REJECTED on concede. */
  cqKey: string | null;
}

/**
 * Per-CQ-raise binding the OPPOSING advocate filed against this bot's
 * Phase-2 args during Phase 3 (action="raise" only — waives are
 * concessions by the raiser themselves).
 */
export interface OpposingCqRaiseBinding {
  /** Opposing cqResponseId. */
  cqResponseId: string;
  /** This advocate's Phase-2 argument id the CQ targets. */
  targetArgumentId: string;
  /** cqKey raised. */
  cqKey: string;
}

export interface DefenseMintResult {
  responses: Array<{
    inputIndex: number;
    targetAttackId: string;
    kind: "defend" | "concede" | "narrow";
    /** Defense Argument id, if a defense was minted. */
    defenseArgumentId: string | null;
    /** Defense → rebuttal ArgumentEdge id, if minted. */
    defenseEdgeId: string | null;
    /** Narrowed conclusion Claim id, if a narrow variant was minted. */
    narrowedConclusionClaimId: string | null;
    /** Narrow-variant Argument id, if minted. */
    narrowVariantArgumentId: string | null;
    /** For concede: the Claim id whose Commitment was retracted (null for UNDERCUT concedes). */
    retractedCommitmentClaimId: string | null;
    /** For concede with cqKey: the CQStatus id marked REJECTED. */
    cqStatusIdRejected: string | null;
    /** Citations attached to the defense Argument. */
    citations: Array<{ sourceId: string; citationId: string; citationToken: string }>;
  }>;
  cqAnswers: Array<{
    inputIndex: number;
    targetCqRaiseId: string;
    kind: "answer" | "concede";
    cqStatusId: string;
  }>;
  totals: {
    defensesCreated: number;
    edgesCreated: number;
    narrowsCreated: number;
    concedesApplied: number;
    commitmentsRetracted: number;
    cqStatusesUpserted: number;
    citationsAttached: number;
    premiseClaimsMinted: number;
    premiseClaimsDeduped: number;
  };
}

export interface TranslateDefenseOpts {
  output: DefenseOutput;
  deliberationId: string;
  iso: IsonomiaClient;
  logger: RoundLogger;
  cfg: OrchestratorConfig;

  /** Citation token → sourceId map (same as Phase 2/3). */
  tokenToSourceId: Record<string, string>;

  /** Single registry shared across both advocates within a Phase-4 round. */
  registry: ClaimRegistry;

  /** Author role for write signing. */
  authorRole: "advocate-a" | "advocate-b";

  /** This advocate's own Phase-2 arguments — keyed by argumentId. */
  ownArguments: ReadonlyMap<string, OwnArgumentBinding>;

  /** Opposing rebuttals targeting this advocate — keyed by rebuttalArgumentId. */
  opposingRebuttals: ReadonlyMap<string, OpposingRebuttalBinding>;

  /** Opposing CQ raises targeting this advocate — keyed by cqResponseId. */
  opposingCqRaises: ReadonlyMap<string, OpposingCqRaiseBinding>;

  /** Optional pre-fetched scheme catalog. */
  schemeCatalog?: Array<{ id: string; key: string }>;

  /**
   * Loosened-mode evidence stack id. Required when the defense output
   * carries `webCitations`. See materializeWebCitations() in argument-mint.
   */
  stackId?: string | null;

  /**
   * Iter-3 sub-round identifier. Defaults to "a" (sub-round-a / Iter-2
   * behavior unchanged). When set to "b", the orphan-guard's
   * narrow-variant cleanup branch is skipped so sub-round-a's narrow
   * variants are preserved. The defense-edge cleanup branch is keyed
   * by `opposingRebuttalArgIds` (sub-round-b passes round-2 attack
   * ids), so it correctly only deletes any prior sub-round-b defense
   * edges on resume and never touches sub-round-a edges.
   */
  subRound?: "a" | "b";
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const DEFENSE_ATTACK_TYPE_TO_API: Record<DefenseArgument["attackType"], "REBUTS" | "UNDERMINES" | "UNDERCUTS"> = {
  REBUT: "REBUTS",
  UNDERMINE: "UNDERMINES",
  UNDERCUT: "UNDERCUTS",
};

const DEFENSE_ATTACK_TYPE_TO_SCOPE: Record<DefenseArgument["attackType"], "conclusion" | "inference" | "premise"> = {
  REBUT: "conclusion",
  UNDERCUT: "inference",
  UNDERMINE: "premise",
};

/** Marker prefix on narrow-variant Argument.text for orphan-guard identification. */
const NARROW_VARIANT_MARKER = "[NARROW-VARIANT]";

// ─────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────

export async function translateDefenseOutput(opts: TranslateDefenseOpts): Promise<DefenseMintResult> {
  const ctx: IsonomiaCallContext = { role: opts.authorRole, logger: opts.logger };
  const author = agentByRole(opts.cfg, opts.authorRole);
  const authorId = String(author.userId);

  // ─────────────────────────────────────────────────────────────────
  // 0. Orphan guard
  // ─────────────────────────────────────────────────────────────────
  await orphanGuard({
    authorId,
    deliberationId: opts.deliberationId,
    opposingRebuttalArgIds: [...opts.opposingRebuttals.keys()],
    logger: opts.logger,
    advocate: opts.authorRole,
    skipNarrowVariantCleanup: opts.subRound === "b",
  });

  // ─────────────────────────────────────────────────────────────────
  // 1. Resolve scheme catalog → key→id map
  // ─────────────────────────────────────────────────────────────────
  const catalog = opts.schemeCatalog ?? (await opts.iso.listSchemes(opts.authorRole, opts.logger));
  const schemeIdByKey = new Map<string, string>();
  for (const s of catalog) schemeIdByKey.set(s.key, s.id);

  const missingSchemes = new Set<string>();
  for (const r of opts.output.responses) {
    if (r.defense && !schemeIdByKey.has(r.defense.schemeKey)) missingSchemes.add(r.defense.schemeKey);
  }
  if (missingSchemes.size > 0) {
    throw new Error(
      `defense-mint: scheme catalog missing keys [${[...missingSchemes].join(", ")}]; run scripts/seed-experiment-schemes.ts`,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. Pre-flight checks
  // ─────────────────────────────────────────────────────────────────
  // Loosened-mode: materialize any web citations declared in this output
  // first so per-premise resolution sees them.
  let tokenToSourceId = opts.tokenToSourceId;
  const webCitations = (opts.output as any).webCitations as
    | import("../agents/advocate-schema").WebCitation[]
    | undefined;
  if (webCitations && webCitations.length > 0) {
    const materialized = await materializeWebCitations({
      iso: opts.iso,
      ctx,
      stackId: opts.stackId ?? null,
      webCitations,
      logger: opts.logger,
    });
    tokenToSourceId = { ...opts.tokenToSourceId, ...materialized };
  }

  const missingAttackIds = new Set<string>();
  const missingTokens = new Set<string>();
  const missingCqIds = new Set<string>();
  for (const r of opts.output.responses) {
    if (!opts.opposingRebuttals.has(r.targetAttackId)) missingAttackIds.add(r.targetAttackId);
    if (r.defense) {
      for (const p of r.defense.premises) {
        if (p.citationToken && !tokenToSourceId[p.citationToken]) missingTokens.add(p.citationToken);
      }
    }
  }
  for (const c of opts.output.cqAnswers) {
    if (!opts.opposingCqRaises.has(c.targetCqRaiseId)) missingCqIds.add(c.targetCqRaiseId);
  }
  if (missingAttackIds.size > 0) {
    throw new Error(
      `defense-mint: opposingRebuttals map missing rebuttalArgumentIds [${[...missingAttackIds].join(", ")}]; check Phase-4 driver binding`,
    );
  }
  if (missingTokens.size > 0) {
    throw new Error(
      `defense-mint: tokenToSourceId map missing tokens [${[...missingTokens].join(", ")}]; check evidence-context binding`,
    );
  }
  if (missingCqIds.size > 0) {
    throw new Error(
      `defense-mint: opposingCqRaises map missing cqResponseIds [${[...missingCqIds].join(", ")}]; check Phase-4 driver binding`,
    );
  }
  // Cross-check that for every targeted rebuttal, the targetArgumentId
  // is one of THIS bot's known Phase-2 args (otherwise the concede /
  // narrow logic can't resolve commitment claim ids).
  for (const r of opts.output.responses) {
    const oppRebuttal = opts.opposingRebuttals.get(r.targetAttackId)!;
    if (!opts.ownArguments.has(oppRebuttal.targetArgumentId)) {
      throw new Error(
        `defense-mint: opposing rebuttal ${r.targetAttackId} targets unknown own-arg ${oppRebuttal.targetArgumentId}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. Process each response
  // ─────────────────────────────────────────────────────────────────
  const sizeBefore = opts.registry.size();
  const responseResults: DefenseMintResult["responses"] = [];
  let citationsAttached = 0;
  let edgesCreated = 0;
  let defensesCreated = 0;
  let narrowsCreated = 0;
  let concedesApplied = 0;
  let commitmentsRetracted = 0;
  let cqStatusesUpserted = 0;

  for (let i = 0; i < opts.output.responses.length; i++) {
    const r = opts.output.responses[i];
    const oppRebuttal = opts.opposingRebuttals.get(r.targetAttackId)!;
    const ownArg = opts.ownArguments.get(oppRebuttal.targetArgumentId)!;

    let defenseArgumentId: string | null = null;
    let defenseEdgeId: string | null = null;
    let narrowedConclusionClaimId: string | null = null;
    let narrowVariantArgumentId: string | null = null;
    let retractedCommitmentClaimId: string | null = null;
    let cqStatusIdRejected: string | null = null;
    let citations: Array<{ sourceId: string; citationId: string; citationToken: string }> = [];

    // 3a. defend / narrow → mint defense argument + edge (if defense present).
    if (r.defense) {
      const minted = await mintDefenseArgument({
        defense: r.defense,
        oppRebuttal,
        inputIndex: i,
        authorId,
        authorRole: opts.authorRole,
        ctx,
        iso: opts.iso,
        registry: opts.registry,
        tokenToSourceId: tokenToSourceId,
        schemeIdByKey,
        deliberationId: opts.deliberationId,
        logger: opts.logger,
      });
      defenseArgumentId = minted.defenseArgumentId;
      defenseEdgeId = minted.edgeId;
      citations = minted.citations;
      citationsAttached += minted.citations.length;
      edgesCreated += 1;
      defensesCreated += 1;
    }

    // 3b. narrow → mint narrowed-conclusion Claim + variant Argument.
    if (r.kind === "narrow") {
      if (!r.narrowedConclusionText) {
        throw new Error(`defense-mint: response[${i}] kind="narrow" requires narrowedConclusionText (validation should have caught this)`);
      }
      const variant = await mintNarrowVariant({
        narrowedConclusionText: r.narrowedConclusionText,
        ownArg,
        authorId,
        ctx,
        iso: opts.iso,
        registry: opts.registry,
        deliberationId: opts.deliberationId,
        logger: opts.logger,
      });
      narrowedConclusionClaimId = variant.narrowedConclusionClaimId;
      narrowVariantArgumentId = variant.narrowVariantArgumentId;
      narrowsCreated += 1;

      // Retract original conclusion commitment (the narrow supersedes it).
      const retractedCount = await retractCommitment({
        deliberationId: opts.deliberationId,
        participantId: authorId,
        proposition: ownArg.conclusionText,
        logger: opts.logger,
        advocate: opts.authorRole,
        reason: `narrow:${r.targetAttackId}`,
      });
      if (retractedCount > 0) {
        retractedCommitmentClaimId = ownArg.conclusionClaimId;
        commitmentsRetracted += retractedCount;
      }

      // Emit RETRACT for the original conclusion claim (the narrow
      // supersedes it). The narrow-variant Argument's createArgument
      // call already auto-emitted ASSERT for the narrowed claim.
      await postDialogueMove({
        deliberationId: opts.deliberationId,
        targetType: "claim",
        targetId: ownArg.conclusionClaimId,
        kind: "RETRACT",
        actorId: authorId,
        signature: `retract:${opts.authorRole}:narrow:${ownArg.argumentId}:${ownArg.conclusionClaimId}`,
        payload: {
          reason: "narrow",
          ownArgumentId: ownArg.argumentId,
          targetAttackId: r.targetAttackId,
          narrowedConclusionClaimId,
          narrowVariantArgumentId,
        },
        logger: opts.logger,
        step: "defense-mint",
        advocate: opts.authorRole,
      });
    }

    // 3c. concede → retract relevant commitment + mark CQStatus REJECTED if cqKey.
    if (r.kind === "concede") {
      concedesApplied += 1;
      const concedeResult = await applyConcede({
        oppRebuttal,
        ownArg,
        deliberationId: opts.deliberationId,
        participantId: authorId,
        ownArgSchemeKey: ownArg.schemeKey,
        rationale: r.rationale,
        logger: opts.logger,
        advocate: opts.authorRole,
      });
      retractedCommitmentClaimId = concedeResult.retractedClaimId;
      cqStatusIdRejected = concedeResult.cqStatusIdRejected;
      commitmentsRetracted += concedeResult.commitmentsRetracted;
      if (concedeResult.cqStatusIdRejected) cqStatusesUpserted += 1;

      // Emit CONCEDE on the opposing rebuttal Argument so the dialogue
      // log shows the advocate accepting the attack.
      await postDialogueMove({
        deliberationId: opts.deliberationId,
        targetType: "argument",
        targetId: oppRebuttal.rebuttalArgumentId,
        kind: "CONCEDE",
        actorId: authorId,
        signature: `concede:${opts.authorRole}:${oppRebuttal.rebuttalArgumentId}`,
        payload: {
          targetAttackId: r.targetAttackId,
          ownArgumentId: ownArg.argumentId,
          rebuttalAttackType: oppRebuttal.rebuttalAttackType,
          cqKey: oppRebuttal.cqKey ?? null,
          rationale: r.rationale,
        },
        logger: opts.logger,
        step: "defense-mint",
        advocate: opts.authorRole,
      });

      // Emit RETRACT on the conceded proposition (REBUT → conclusion;
      // UNDERMINE → premise). UNDERCUT concedes have no proposition to
      // retract (the inference rule is what's challenged).
      if (concedeResult.retractedClaimId) {
        await postDialogueMove({
          deliberationId: opts.deliberationId,
          targetType: "claim",
          targetId: concedeResult.retractedClaimId,
          kind: "RETRACT",
          actorId: authorId,
          signature: `retract:${opts.authorRole}:concede:${oppRebuttal.rebuttalArgumentId}:${concedeResult.retractedClaimId}`,
          payload: {
            reason: "concede",
            ownArgumentId: ownArg.argumentId,
            rebuttalArgumentId: oppRebuttal.rebuttalArgumentId,
            rebuttalAttackType: oppRebuttal.rebuttalAttackType,
          },
          logger: opts.logger,
          step: "defense-mint",
          advocate: opts.authorRole,
        });
      }
    }

    responseResults.push({
      inputIndex: i,
      targetAttackId: r.targetAttackId,
      kind: r.kind,
      defenseArgumentId,
      defenseEdgeId,
      narrowedConclusionClaimId,
      narrowVariantArgumentId,
      retractedCommitmentClaimId,
      cqStatusIdRejected,
      citations,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. Process each cqAnswer
  // ─────────────────────────────────────────────────────────────────
  const cqAnswerResults: DefenseMintResult["cqAnswers"] = [];
  for (let i = 0; i < opts.output.cqAnswers.length; i++) {
    const c = opts.output.cqAnswers[i];
    const binding = opts.opposingCqRaises.get(c.targetCqRaiseId)!;
    const ownArg = opts.ownArguments.get(binding.targetArgumentId);
    if (!ownArg) {
      throw new Error(
        `defense-mint: cqAnswer[${i}] targets cq raise ${c.targetCqRaiseId} on unknown own-arg ${binding.targetArgumentId}`,
      );
    }
    const cqStatusId = await upsertCqAnswerStatus({
      cqAnswer: c,
      binding,
      ownArgSchemeKey: ownArg.schemeKey,
      authorId,
      logger: opts.logger,
      advocate: opts.authorRole,
    });
    cqStatusesUpserted += 1;
    cqAnswerResults.push({
      inputIndex: i,
      targetCqRaiseId: c.targetCqRaiseId,
      kind: c.kind,
      cqStatusId,
    });

    // Emit GROUNDS (answer) or CONCEDE (concede) DialogueMove on the
    // own argument that the cq was raised against.
    await postDialogueMove({
      deliberationId: opts.deliberationId,
      targetType: "argument",
      targetId: binding.targetArgumentId,
      kind: c.kind === "answer" ? "GROUNDS" : "CONCEDE",
      actorId: authorId,
      signature: `${c.kind === "answer" ? "grounds" : "concede"}:${opts.authorRole}:cq:${binding.targetArgumentId}:${binding.cqKey}`,
      payload: {
        cqId: binding.cqKey,
        cqKey: binding.cqKey,
        schemeKey: ownArg.schemeKey,
        targetCqRaiseId: c.targetCqRaiseId,
        rationale: c.rationale,
        source: "orchestrator-cq-answer",
      },
      logger: opts.logger,
      step: "defense-mint",
      advocate: opts.authorRole,
    });
  }

  const sizeAfter = opts.registry.size();
  const totalNewClaimTextsSeen =
    opts.output.responses.reduce((n, r) => {
      let claims = 0;
      if (r.defense) claims += r.defense.premises.length + 1; // +1 for defense conclusion
      if (r.kind === "narrow" && r.narrowedConclusionText) claims += 1;
      return n + claims;
    }, 0);
  const premiseClaimsMinted = sizeAfter - sizeBefore;
  const premiseClaimsDeduped = totalNewClaimTextsSeen - premiseClaimsMinted;

  const totals = {
    defensesCreated,
    edgesCreated,
    narrowsCreated,
    concedesApplied,
    commitmentsRetracted,
    cqStatusesUpserted,
    citationsAttached,
    premiseClaimsMinted,
    premiseClaimsDeduped,
  };

  opts.logger.event("round_summary", {
    step: "defense-mint",
    advocate: opts.authorRole,
    ...totals,
  });

  return { responses: responseResults, cqAnswers: cqAnswerResults, totals };
}

// ─────────────────────────────────────────────────────────────────
// Orphan guard
// ─────────────────────────────────────────────────────────────────

async function orphanGuard(opts: {
  authorId: string;
  deliberationId: string;
  opposingRebuttalArgIds: string[];
  logger: RoundLogger;
  advocate: "advocate-a" | "advocate-b";
  skipNarrowVariantCleanup?: boolean;
}) {
  // (a) Defense Arguments: this bot's args with an outgoing edge whose
  // toArgumentId is one of the opposing rebuttals.
  if (opts.opposingRebuttalArgIds.length > 0) {
    const priorDefenseIds = await prisma.argument.findMany({
      where: {
        deliberationId: opts.deliberationId,
        authorId: opts.authorId,
        outgoingEdges: {
          some: {
            deliberationId: opts.deliberationId,
            createdById: opts.authorId,
            toArgumentId: { in: opts.opposingRebuttalArgIds },
          },
        },
      },
      select: { id: true },
    });
    if (priorDefenseIds.length > 0) {
      const dropped = await prisma.argument.deleteMany({
        where: { id: { in: priorDefenseIds.map((r) => r.id) } },
      });
      opts.logger.event("orphan_cleanup", {
        step: "defense-mint",
        advocate: opts.advocate,
        droppedDefenseArguments: dropped.count,
      });
    }
  }

  // (b) Narrow-variant Arguments: this bot's args whose text starts
  // with the narrow-variant marker. These have no outgoing edges but
  // do have ASSERT moves attached. Cascade handles related rows.
  // Skipped under sub-round-b so we don't wipe sub-round-a narrows.
  if (opts.skipNarrowVariantCleanup) {
    opts.logger.event("orphan_cleanup_skipped", {
      step: "defense-mint",
      advocate: opts.advocate,
      reason: "sub-round-b: preserve sub-round-a narrow variants",
    });
    return;
  }
  const droppedNarrows = await prisma.argument.deleteMany({
    where: {
      deliberationId: opts.deliberationId,
      authorId: opts.authorId,
      text: { startsWith: NARROW_VARIANT_MARKER },
    },
  });
  if (droppedNarrows.count > 0) {
    opts.logger.event("orphan_cleanup", {
      step: "defense-mint",
      advocate: opts.advocate,
      droppedNarrowVariantArguments: droppedNarrows.count,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// Defense Argument minting
// ─────────────────────────────────────────────────────────────────

interface MintDefenseOpts {
  defense: DefenseArgument;
  oppRebuttal: OpposingRebuttalBinding;
  inputIndex: number;
  authorId: string;
  authorRole: "advocate-a" | "advocate-b";
  ctx: IsonomiaCallContext;
  iso: IsonomiaClient;
  registry: ClaimRegistry;
  tokenToSourceId: Record<string, string>;
  schemeIdByKey: Map<string, string>;
  deliberationId: string;
  logger: RoundLogger;
}

async function mintDefenseArgument(opts: MintDefenseOpts): Promise<{
  defenseArgumentId: string;
  edgeId: string;
  citations: Array<{ sourceId: string; citationId: string; citationToken: string }>;
}> {
  const { defense, oppRebuttal } = opts;
  const schemeId = opts.schemeIdByKey.get(defense.schemeKey)!;

  // 1. Mint conclusion + premise claims (deduped via registry).
  const [conclusionClaimId] = await resolvePremiseClaimIds({
    iso: opts.iso,
    ctx: opts.ctx,
    deliberationId: opts.deliberationId,
    registry: opts.registry,
    premiseTexts: [defense.conclusionText],
    defaultClaimType: "EMPIRICAL",
  });
  const premiseTexts = defense.premises.map((p) => p.text);
  const premiseClaimIds = await resolvePremiseClaimIds({
    iso: opts.iso,
    ctx: opts.ctx,
    deliberationId: opts.deliberationId,
    registry: opts.registry,
    premiseTexts,
    defaultClaimType: "EMPIRICAL",
  });

  // 2. Build display text.
  const argumentText = buildDefenseDisplayText(defense, oppRebuttal.rebuttalArgumentId);

  // 3. Create the defense Argument.
  const { argumentId: defenseArgumentId } = await opts.iso.createArgument(
    {
      deliberationId: opts.deliberationId,
      authorId: opts.authorId,
      conclusionClaimId,
      premiseClaimIds,
      schemeId,
      implicitWarrant: defense.warrant,
      text: argumentText,
      ruleType: "DEFEASIBLE",
    },
    opts.ctx,
  );

  // 4. Attach citations (one per source per arg, dedup as in attack-mint).
  const citations: Array<{ sourceId: string; citationId: string; citationToken: string }> = [];
  const seenSourceIds = new Set<string>();
  for (let p = 0; p < defense.premises.length; p++) {
    const premise = defense.premises[p];
    if (!premise.citationToken) continue;
    const sourceId = opts.tokenToSourceId[premise.citationToken];
    if (seenSourceIds.has(sourceId)) continue;
    seenSourceIds.add(sourceId);
    try {
      const { citationId } = await opts.iso.attachCitation(
        {
          targetType: "argument",
          targetId: defenseArgumentId,
          sourceId,
          quote: premise.text.length <= 280 ? premise.text : premise.text.slice(0, 277) + "...",
          intent: "supports",
        },
        opts.ctx,
      );
      citations.push({ sourceId, citationId, citationToken: premise.citationToken });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      // Soft-degrade FK violations on stale evidence-context source IDs:
      // log+skip, keep the defense argument. A single bad source must not
      // abort the whole phase. Same pattern as attack-mint / argument-mint.
      if (msg.includes("Citation_sourceId_fkey")) {
        opts.logger.event("citation_attach_fk_skip", {
          step: "defense-mint",
          targetRebuttalArgumentId: oppRebuttal.rebuttalArgumentId,
          premiseIndex: p,
          sourceId,
          citationToken: premise.citationToken,
          message: msg,
        });
        continue;
      }
      throw err;
    }
  }

  // 5. Resolve edge targeting fields against the OPPOSING REBUTTAL.
  let targetPremiseClaimId: string | null = null;
  let targetClaimIdField: string | null = null;
  if (defense.attackType === "UNDERMINE") {
    const idx = defense.targetPremiseIndex;
    if (idx === null || idx >= oppRebuttal.rebuttalPremiseClaimIds.length) {
      throw new Error(
        `defense-mint: response[${opts.inputIndex}] UNDERMINE has out-of-range targetPremiseIndex=${idx} (rebuttal has ${oppRebuttal.rebuttalPremiseClaimIds.length} premises)`,
      );
    }
    targetPremiseClaimId = oppRebuttal.rebuttalPremiseClaimIds[idx];
  } else if (defense.attackType === "REBUT") {
    targetClaimIdField = oppRebuttal.rebuttalConclusionClaimId;
    if (!targetClaimIdField) {
      throw new Error(
        `defense-mint: response[${opts.inputIndex}] REBUT cannot resolve rebuttal.conclusionClaimId for ${oppRebuttal.rebuttalArgumentId}`,
      );
    }
  }
  // UNDERCUT: no extra targeting fields.

  // 6. Create the ArgumentEdge against the rebuttal.
  const { edgeId } = await opts.iso.attachAttack(
    oppRebuttal.rebuttalArgumentId,
    {
      deliberationId: opts.deliberationId,
      createdById: opts.authorId,
      fromArgumentId: defenseArgumentId,
      toArgumentId: oppRebuttal.rebuttalArgumentId,
      attackType: DEFENSE_ATTACK_TYPE_TO_API[defense.attackType],
      targetScope: DEFENSE_ATTACK_TYPE_TO_SCOPE[defense.attackType],
      targetClaimId: targetClaimIdField,
      targetPremiseId: targetPremiseClaimId,
      // Defenses don't carry cqKey (CQs are answered via cqAnswers[], not via defense edges).
      cqKey: null,
    },
    opts.ctx,
  );

  // 6b. Emit ATTACK DialogueMove for the defense edge (createArgument
  // already auto-emitted ASSERT for the defense Argument itself).
  await postDialogueMove({
    deliberationId: opts.deliberationId,
    targetType: "argument",
    targetId: oppRebuttal.rebuttalArgumentId,
    kind: "ATTACK" as any,
    actorId: opts.authorId,
    signature: `attack:${defenseArgumentId}->${oppRebuttal.rebuttalArgumentId}:${edgeId}`,
    payload: {
      fromArgumentId: defenseArgumentId,
      edgeId,
      attackType: DEFENSE_ATTACK_TYPE_TO_API[defense.attackType],
      targetScope: DEFENSE_ATTACK_TYPE_TO_SCOPE[defense.attackType],
      targetClaimId: targetClaimIdField,
      targetPremiseId: targetPremiseClaimId,
      role: "defense",
    },
    logger: opts.logger,
    step: "defense-mint",
    advocate: opts.authorRole,
  });

  return { defenseArgumentId, edgeId, citations };
}

function buildDefenseDisplayText(d: DefenseArgument, rebuttalArgId: string): string {
  const premiseSentences = d.premises.map((p) => p.text.trim()).join(" ");
  const conclusion = d.conclusionText.trim();
  const warrantParen = d.warrant ? ` (Warrant: ${d.warrant.trim()})` : "";
  const attackLabel =
    d.attackType === "REBUT"
      ? `[DEFENSE-REBUT → ${rebuttalArgId.slice(-6)}]`
      : d.attackType === "UNDERMINE"
        ? `[DEFENSE-UNDERMINE → ${rebuttalArgId.slice(-6)} premise #${d.targetPremiseIndex}]`
        : `[DEFENSE-UNDERCUT → ${rebuttalArgId.slice(-6)}]`;
  return `${attackLabel} ${premiseSentences} Therefore, ${conclusion}${warrantParen}`;
}

// ─────────────────────────────────────────────────────────────────
// Narrow-variant Argument minting
// ─────────────────────────────────────────────────────────────────

interface MintNarrowVariantOpts {
  narrowedConclusionText: string;
  ownArg: OwnArgumentBinding;
  authorId: string;
  ctx: IsonomiaCallContext;
  iso: IsonomiaClient;
  registry: ClaimRegistry;
  deliberationId: string;
  logger: RoundLogger;
}

async function mintNarrowVariant(opts: MintNarrowVariantOpts): Promise<{
  narrowedConclusionClaimId: string;
  narrowVariantArgumentId: string;
}> {
  // Mint the narrowed-conclusion claim.
  const [narrowedConclusionClaimId] = await resolvePremiseClaimIds({
    iso: opts.iso,
    ctx: opts.ctx,
    deliberationId: opts.deliberationId,
    registry: opts.registry,
    premiseTexts: [opts.narrowedConclusionText],
    defaultClaimType: "EMPIRICAL",
  });

  // Variant Argument re-uses the original argument's premises + scheme.
  // Display text gets the NARROW_VARIANT_MARKER so orphan-guard can find it.
  const premiseSentences = opts.ownArg.premiseTexts.map((t) => t.trim()).join(" ");
  const variantText = `${NARROW_VARIANT_MARKER} ${premiseSentences} Therefore (narrowed), ${opts.narrowedConclusionText.trim()}`;

  const { argumentId: narrowVariantArgumentId } = await opts.iso.createArgument(
    {
      deliberationId: opts.deliberationId,
      authorId: opts.authorId,
      conclusionClaimId: narrowedConclusionClaimId,
      premiseClaimIds: [...opts.ownArg.premiseClaimIds],
      schemeId: opts.ownArg.schemeId,
      implicitWarrant: null,
      text: variantText,
      ruleType: "DEFEASIBLE",
    },
    opts.ctx,
  );

  return { narrowedConclusionClaimId, narrowVariantArgumentId };
}

// ─────────────────────────────────────────────────────────────────
// Concede application
// ─────────────────────────────────────────────────────────────────

interface ApplyConcedeOpts {
  oppRebuttal: OpposingRebuttalBinding;
  ownArg: OwnArgumentBinding;
  deliberationId: string;
  participantId: string;
  ownArgSchemeKey: string;
  rationale: string;
  logger: RoundLogger;
  advocate: "advocate-a" | "advocate-b";
}

async function applyConcede(opts: ApplyConcedeOpts): Promise<{
  retractedClaimId: string | null;
  commitmentsRetracted: number;
  cqStatusIdRejected: string | null;
}> {
  const { oppRebuttal, ownArg } = opts;
  let retractedClaimId: string | null = null;
  let commitmentsRetracted = 0;

  if (oppRebuttal.rebuttalAttackType === "REBUT") {
    // Retract original conclusion commitment.
    commitmentsRetracted = await retractCommitment({
      deliberationId: opts.deliberationId,
      participantId: opts.participantId,
      proposition: ownArg.conclusionText,
      logger: opts.logger,
      advocate: opts.advocate,
      reason: `concede:REBUT:${oppRebuttal.rebuttalArgumentId}`,
    });
    if (commitmentsRetracted > 0) retractedClaimId = ownArg.conclusionClaimId;
  } else if (oppRebuttal.rebuttalAttackType === "UNDERMINE") {
    // Retract the targeted premise commitment.
    const idx = oppRebuttal.rebuttalTargetPremiseIndex;
    if (idx === null || idx >= ownArg.premiseTexts.length) {
      throw new Error(
        `defense-mint: concede on UNDERMINE rebuttal ${oppRebuttal.rebuttalArgumentId} has invalid targetPremiseIndex=${idx} for own-arg ${ownArg.argumentId} (${ownArg.premiseTexts.length} premises)`,
      );
    }
    const premiseText = ownArg.premiseTexts[idx];
    commitmentsRetracted = await retractCommitment({
      deliberationId: opts.deliberationId,
      participantId: opts.participantId,
      proposition: premiseText,
      logger: opts.logger,
      advocate: opts.advocate,
      reason: `concede:UNDERMINE:${oppRebuttal.rebuttalArgumentId}`,
    });
    if (commitmentsRetracted > 0) retractedClaimId = ownArg.premiseClaimIds[idx];
  } else {
    // UNDERCUT: no commitment to retract (the attack is on the inference,
    // not on a proposition). The concession is recorded in the structured
    // defense output JSON and surfaces in the tracker verdict.
    opts.logger.event("concede_undercut_no_commitment", {
      advocate: opts.advocate,
      rebuttalArgumentId: oppRebuttal.rebuttalArgumentId,
      targetArgumentId: ownArg.argumentId,
    });
  }

  // If the rebuttal carried a cqKey, mark CQStatus REJECTED.
  let cqStatusIdRejected: string | null = null;
  if (oppRebuttal.cqKey) {
    const row = await prisma.cQStatus.upsert({
      where: {
        targetType_targetId_schemeKey_cqKey: {
          targetType: "argument",
          targetId: ownArg.argumentId,
          schemeKey: opts.ownArgSchemeKey,
          cqKey: oppRebuttal.cqKey,
        },
      },
      update: {
        status: "conceded",
        statusEnum: "DISPUTED" as any,
        groundsText: opts.rationale,
        lastReviewedAt: new Date(),
        lastReviewedBy: opts.participantId,
      },
      create: {
        targetType: "argument",
        targetId: ownArg.argumentId,
        schemeKey: opts.ownArgSchemeKey,
        cqKey: oppRebuttal.cqKey,
        status: "conceded",
        statusEnum: "DISPUTED" as any,
        groundsText: opts.rationale,
        createdById: opts.participantId,
        lastReviewedAt: new Date(),
        lastReviewedBy: opts.participantId,
      },
    });
    cqStatusIdRejected = row.id;
    opts.logger.event("cq_status_upserted", {
      step: "defense-mint",
      advocate: opts.advocate,
      targetArgumentId: ownArg.argumentId,
      cqKey: oppRebuttal.cqKey,
      action: "concede-via-rebuttal",
      cqStatusId: row.id,
    });
  }

  return { retractedClaimId, commitmentsRetracted, cqStatusIdRejected };
}

async function retractCommitment(opts: {
  deliberationId: string;
  participantId: string;
  proposition: string;
  logger: RoundLogger;
  advocate: "advocate-a" | "advocate-b";
  reason: string;
}): Promise<number> {
  const result = await prisma.commitment.updateMany({
    where: {
      deliberationId: opts.deliberationId,
      participantId: opts.participantId,
      proposition: opts.proposition,
      isRetracted: false,
    },
    data: { isRetracted: true },
  });
  if (result.count > 0) {
    opts.logger.event("commitment_retracted", {
      step: "defense-mint",
      advocate: opts.advocate,
      participantId: opts.participantId,
      proposition: opts.proposition.slice(0, 120),
      reason: opts.reason,
      retractedCount: result.count,
    });
  } else {
    opts.logger.event("commitment_retract_noop", {
      step: "defense-mint",
      advocate: opts.advocate,
      participantId: opts.participantId,
      proposition: opts.proposition.slice(0, 120),
      reason: opts.reason,
      note: "no matching active commitment row (already retracted, or never asserted under this exact text)",
    });
  }
  return result.count;
}

// ─────────────────────────────────────────────────────────────────
// CQ-answer CQStatus upsert
// ─────────────────────────────────────────────────────────────────

interface UpsertCqAnswerStatusOpts {
  cqAnswer: CqAnswer;
  binding: OpposingCqRaiseBinding;
  ownArgSchemeKey: string;
  authorId: string;
  logger: RoundLogger;
  advocate: "advocate-a" | "advocate-b";
}

async function upsertCqAnswerStatus(opts: UpsertCqAnswerStatusOpts): Promise<string> {
  const { cqAnswer, binding } = opts;
  const legacyStatus = cqAnswer.kind === "answer" ? "answered" : "conceded";
  const statusEnum = cqAnswer.kind === "answer" ? "SATISFIED" : "DISPUTED";

  const row = await prisma.cQStatus.upsert({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: "argument",
        targetId: binding.targetArgumentId,
        schemeKey: opts.ownArgSchemeKey,
        cqKey: binding.cqKey,
      },
    },
    update: {
      status: legacyStatus,
      statusEnum: statusEnum as any,
      groundsText: cqAnswer.rationale,
      lastReviewedAt: new Date(),
      lastReviewedBy: opts.authorId,
    },
    create: {
      targetType: "argument",
      targetId: binding.targetArgumentId,
      schemeKey: opts.ownArgSchemeKey,
      cqKey: binding.cqKey,
      status: legacyStatus,
      statusEnum: statusEnum as any,
      groundsText: cqAnswer.rationale,
      createdById: opts.authorId,
      lastReviewedAt: new Date(),
      lastReviewedBy: opts.authorId,
    },
  });

  opts.logger.event("cq_status_upserted", {
    step: "defense-mint",
    advocate: opts.advocate,
    targetArgumentId: binding.targetArgumentId,
    cqKey: binding.cqKey,
    action: cqAnswer.kind,
    cqStatusId: row.id,
  });

  return row.id;
}
