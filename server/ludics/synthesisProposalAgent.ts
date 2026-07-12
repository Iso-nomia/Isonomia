/**
 * Synthesis Proposal Agent — Phase 2c. *[CORRECTED post-2e/2f (B8 Round 6)]*
 *
 * Orchestrates the AI-synthesis workflow: given two existing Design rows,
 * computes their articulation join, enforces structural invariants, and
 * (when the join is trivially closed within a cone) commits a WitnessRecord.
 *
 * Discriminated result shape per LUDICS_SESSION_2_DEV_SPEC.md §3.3:
 *   - `same-cone-join`               — join exists in B; WitnessRecord committed.
 *   - `same-cone-delocation-required` — join requires within-cone negative-branch
 *                                      extension (Daimon Lock Lemma); candidate
 *                                      Design row identifier surfaced for the
 *                                      caller to bind separately. No WitnessRecord
 *                                      is written.
 *   - `cross-cone-rejected`          — inputs span disjoint cones; ∨_⊥⊥ is
 *                                      undefined in B (Phase 2e cross-cone
 *                                      incompatibility). Returned as a value
 *                                      with HTTP 200; not an error.
 *
 * Invariant enforcement (inherited from S1–S4 framework, applied on
 * `same-cone-join` path only):
 *   S1  Root locus ⊢A.0 LudicMove must exist for the deliberation
 *   S3  canonicalText must be non-empty
 *
 * Error codes (true error conditions; the three discriminated outcomes
 * above are returned as values, not thrown):
 *   409  ROOT_LOCUS_MISSING         — root locus ⊢A.0 absent from D_P
 *   422  EMPTY_CANONICAL_TEXT       — canonicalText empty / blank
 *   404  DESIGNS_NOT_FOUND          — one or both designIds are missing in DB
 *   422  CLOSURE_STEPS_INVARIANT    — articulationLattice returned closureSteps != 0
 *                                     for a same-cone-join (Phase 2f Reading A
 *                                     defensive guard)
 *
 * Idempotence: a deterministic `dialogueMoveId` derived from the input
 * ensures that re-issuing identical inputs returns the existing record on
 * the `same-cone-join` path with the original witnessId.
 *
 * T4 invariant: participantId is stored but NEVER returned in any kind.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import { computeArticulationJoin } from "@/server/ludics/articulationLattice";
import { create as createWitnessRecord } from "@/server/ludics/witnessRecord";
import { publishAnnouncement } from "@/lib/ludics/announcementBus";

// ── Error class ───────────────────────────────────────────────────────────────

export type SynthesisErrorCode =
  | "ROOT_LOCUS_MISSING"
  | "EMPTY_CANONICAL_TEXT"
  | "DESIGNS_NOT_FOUND"
  | "CLOSURE_STEPS_INVARIANT";

export class SynthesisError extends Error {
  readonly code: SynthesisErrorCode;
  readonly status: 409 | 422 | 404;

  constructor(
    code: SynthesisErrorCode,
    message: string,
    status: 409 | 422 | 404,
  ) {
    super(message);
    this.name = "SynthesisError";
    this.code = code;
    this.status = status;
  }
}

// ── Public shapes ─────────────────────────────────────────────────────────────

export interface SynthesisProposalInput {
  deliberationId: string;
  /** The two Design rows to join. Order is normalised internally. */
  designIds: [string, string];
  /** The participant proposing the synthesis (T4: stored, never returned). */
  participantId: string;
  /**
   * Agent-generated synthesis statement that textually represents the
   * join locus. Stored verbatim in the WitnessRecord.canonicalText
   * column (plain text, NOT JSON.stringify({text:…}) — synthesis
   * statements are not subjected to canonicalize pipeline gating).
   */
  canonicalText: string;
}

/**
 * Discriminated by `kind`. Mirrors LUDICS_SESSION_2_DEV_SPEC.md §3.3.
 *
 * Note on `same-cone-delocation-required`: under Phase 2f Reading A
 * (literal locus-set union), this branch is structurally unreachable when
 * loci are plain strings — no collisions are possible. The branch is
 * preserved in the type as forward-compatibility for a richer chronicle
 * representation. If a future revision of `computeArticulationJoin` emits
 * this kind, `joinDesignId` will be the empty string until the candidate
 * Design row is created (TODO: persist on first reachable invocation).
 */
export type SynthesisProposalResult =
  | {
      kind: "same-cone-join";
      witnessId: string;
      joinDesignId: string;
      /** Loci added by literal union beyond either input alone. */
      newLoci: string[];
      /** Always 0 within a cone (Phase 2f Reading A). */
      closureSteps: 0;
    }
  | {
      kind: "same-cone-delocation-required";
      /**
       * Candidate Design row id; empty string when the row has not yet
       * been created (current unreachable-in-practice path).
       */
      joinDesignId: string;
      /** Negative-branch extensions per Daimon Lock Lemma. */
      newLoci: string[];
      /** First-locus convenience accessor; equal to `newLoci[0] ?? ""`. */
      delocationCandidateLocus: string;
    }
  | {
      kind: "cross-cone-rejected";
      reason: "cross-cone-incompatibility";
      /** First input design (in caller-supplied order); resides in cone 1. */
      cone1DesignId: string;
      /** Second input design (in caller-supplied order); resides in cone 2. */
      cone2DesignId: string;
    };

// ── proposeSynthesis ──────────────────────────────────────────────────────────

export async function proposeSynthesis(
  input: SynthesisProposalInput,
): Promise<SynthesisProposalResult> {
  const { deliberationId, designIds, participantId, canonicalText } = input;

  // S3 — canonicalText must not be blank.
  if (!canonicalText.trim()) {
    throw new SynthesisError(
      "EMPTY_CANONICAL_TEXT",
      "canonicalText must not be empty",
      422,
    );
  }

  // Compute the articulation join of the two input designs.
  const joinResult = await computeArticulationJoin([...designIds]);
  if (!joinResult) {
    throw new SynthesisError(
      "DESIGNS_NOT_FOUND",
      "one or both designIds not found or do not share a common Behaviour",
      404,
    );
  }

  // Phase 2e: cross-cone inputs are undefined for ∨_⊥⊥. Returned as a value
  // (HTTP 200) with the discriminated `cross-cone-rejected` kind — not an
  // error. The two input designs are surfaced in caller-supplied order as
  // `cone1DesignId` / `cone2DesignId`.
  if (joinResult.kind === "cross-cone-rejected") {
    return {
      kind: "cross-cone-rejected",
      reason: "cross-cone-incompatibility",
      cone1DesignId: designIds[0],
      cone2DesignId: designIds[1],
    };
  }

  // Same-cone delocation: within-cone negative-branch extension required
  // (Daimon Lock Lemma). Structurally unreachable under the current literal
  // locus-set union semantics, but the type and code path are preserved for
  // forward-compatibility with richer chronicle representations.
  if (joinResult.kind === "same-cone-delocation-required") {
    const collidingLoci = joinResult.collidingLoci ?? [];
    return {
      kind: "same-cone-delocation-required",
      // TODO: persist candidate Design row when this branch becomes
      // reachable in a future revision of computeArticulationJoin.
      joinDesignId: "",
      newLoci: collidingLoci,
      delocationCandidateLocus: collidingLoci[0] ?? "",
    };
  }

  // From here on: kind === "same-cone-join".
  const { join, newLoci, closureSteps } = joinResult;

  // Phase 2f Reading A defensive guard: literal chronicle-set union means
  // closureSteps must be 0 within a cone. A non-zero value indicates either
  // a regression in the lattice service or a silent revert to Reading B
  // semantics — surface it loudly rather than swallowing it.
  if (closureSteps !== 0) {
    throw new SynthesisError(
      "CLOSURE_STEPS_INVARIANT",
      `Phase 2f Reading A invariant violated: computeArticulationJoin returned ` +
        `closureSteps=${closureSteps} for same-cone-join (expected 0). ` +
        `Cone ${joinResult.coneId}, designs [${designIds.join(", ")}].`,
      422,
    );
  }

  const wasNontrivial = newLoci.length > 0;

  // If the join created a new Design row, persist DesignInclusion edges
  // (same-cone only — articulationLattice already guarantees this).
  if (wasNontrivial) {
    for (const dId of designIds) {
      await prisma.designInclusion.upsert({
        where: {
          smallerId_largerId: { smallerId: dId, largerId: join.designId },
        },
        create: { smallerId: dId, largerId: join.designId },
        update: {},
      });
    }
  }

  // S1 — root locus LudicMove must exist in D_P.
  const rootMove = await prisma.ludicMove.findFirst({
    where: { deliberationId, locus: "\u22a2A.0" },
    select: { id: true },
  });

  if (!rootMove) {
    throw new SynthesisError(
      "ROOT_LOCUS_MISSING",
      "root locus \u22a2A.0 not found in D_P for this deliberation",
      409,
    );
  }

  // Deterministic dialogueMoveId for idempotency across identical inputs.
  const sorted = [...designIds].sort();
  const hash = crypto
    .createHash("sha256")
    .update(`${deliberationId}:${sorted.join(",")}:${participantId}`)
    .digest("hex")
    .slice(0, 24);
  const dialogueMoveId = `synthesis:${hash}`;

  // Check for existing WitnessRecord (idempotency).
  const existing = await prisma.witnessRecord.findUnique({
    where: { dialogueMoveId },
    select: { id: true },
  });

  if (existing) {
    return {
      kind: "same-cone-join",
      witnessId: existing.id,
      joinDesignId: join.designId,
      newLoci: [],
      closureSteps: 0,
    };
  }

  // Commit the WitnessRecord.
  const witness = await createWitnessRecord({
    ludicMoveId: rootMove.id,
    dialogueMoveId,
    participantId,
    canonicalText,
  });

  // A2 announcement (WS-5b): emit `design_revealed` on the fresh-commit
  // branch only — NOT on the idempotent `existing` short-circuit above.
  // Protocol §7.0 + §8. Bus failures MUST NOT fail synthesis.
  try {
    await publishAnnouncement({
      eventType: "design_revealed",
      version: 1,
      scopeId: deliberationId,
      actorParticipantId: participantId,
      subjectId: join.designId,
      occurredAt: witness.timestamp.toISOString(),
      payload: {
        designId: join.designId,
        joinedDesignIds: sorted,
        newLoci,
        witnessId: witness.id,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[synthesisProposalAgent] announcement publish failed", err);
  }

  return {
    kind: "same-cone-join",
    witnessId: witness.id,
    joinDesignId: join.designId,
    newLoci,
    closureSteps: 0,
  };
}
