/**
 * orchestrator/translators/dialogue-move-mint.ts
 *
 * Thin helper that writes `DialogueMove` rows directly via prisma.
 *
 * The Phase-2/3/4/5 translators previously relied solely on
 * `app/api/arguments/route.ts` to auto-emit one `ASSERT` move per minted
 * argument. As a result every dialectical record on the wire was an
 * ASSERT — there were no `WHY` (challenges), `ATTACK` (rebuttal edges),
 * `CONCEDE` (concessions), `RETRACT` (narrows / concede-REBUTs), or
 * `GROUNDS` (cqAnswer answers) moves.
 *
 * This helper closes that gap. It is intentionally *additive*: it does
 * NOT replace the existing prisma-direct `CQStatus` / `Commitment`
 * writes; it simply records the corresponding speech act so the dialogue
 * log reflects the full move sequence.
 *
 * Idempotency: the `DialogueMove` table has a unique index on
 * `(deliberationId, signature)`. Callers must supply a deterministic
 * signature; on `P2002` we no-op silently so re-runs of the same phase
 * don't fail.
 */

import { prisma } from "@/lib/prismaclient";
import { createDialogueMove } from "@/lib/ludics/createDialogueMove";
import type { RoundLogger } from "../log/round-logger";

export type DialogueMoveKind =
  | "ASSERT"
  | "WHY"
  | "GROUNDS"
  | "CONCEDE"
  | "RETRACT"
  | "ATTACK"
  | "CLOSE"
  | "THEREFORE"
  | "SUPPOSE"
  | "DISCHARGE";

export interface PostDialogueMoveOpts {
  deliberationId: string;
  targetType: "argument" | "claim" | "card";
  targetId: string;
  kind: DialogueMoveKind;
  actorId: string;
  /** Deterministic signature, unique within deliberation. */
  signature: string;
  payload?: Record<string, unknown>;
  logger: RoundLogger;
  /** Translator step name, e.g. "attack-mint" or "defense-mint". */
  step: string;
  /** Role label for log events, e.g. "advocate-a" / "methodologist". */
  advocate: string;
}

/**
 * Insert a `DialogueMove` row and emit a logger event. Returns the new
 * row id, or `null` if the row already existed (signature collision).
 */
export async function postDialogueMove(opts: PostDialogueMoveOpts): Promise<string | null> {
  try {
    const seamResult = await createDialogueMove({
      deliberationId: opts.deliberationId,
      targetType: opts.targetType as any,
      targetId: opts.targetId,
      kind: opts.kind as any,
      actorId: opts.actorId,
      signature: opts.signature,
      payload: (opts.payload ?? {}) as any,
    });
    if (seamResult.deduplicated) {
      opts.logger.event("dialogue_move_dedup", {
        step: opts.step,
        advocate: opts.advocate,
        kind: opts.kind,
        signature: opts.signature,
      });
      return null;
    }
    const row = seamResult.move;
    opts.logger.event("dialogue_move_posted", {
      step: opts.step,
      advocate: opts.advocate,
      kind: opts.kind,
      targetType: opts.targetType,
      targetId: opts.targetId,
      moveId: row.id,
      signature: opts.signature,
    });
    return row.id;
  } catch (e: any) {
    if (e?.code === "P2002") {
      opts.logger.event("dialogue_move_dedup", {
        step: opts.step,
        advocate: opts.advocate,
        kind: opts.kind,
        signature: opts.signature,
      });
      return null;
    }
    opts.logger.event("dialogue_move_error", {
      step: opts.step,
      advocate: opts.advocate,
      kind: opts.kind,
      signature: opts.signature,
      error: e?.message ?? String(e),
    });
    throw e;
  }
}
