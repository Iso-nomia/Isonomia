// lib/schemes/protocol/dialogueHooks.ts
//
// Phase 4 / Spec 3 §3.4 — translate substrate dialogue events into
// `recordObligationTransition` calls. Centralised here so the
// dialogue/move route and the schemes/questions/counter route share
// the same mapping.
//
// Defensive by design: every hook is wrapped to never throw, so a
// transition-tracking failure cannot block the underlying move.

import { prisma } from "@/lib/prismaclient";
import {
  isLegalTransition,
  recordObligationTransition,
  type CqObligationStatus,
} from "./protocolState";

type MoveKind = "WHY" | "GROUNDS" | "CONCEDE" | "RETRACT" | "CLOSE" | string;

/**
 * Resolve (cqKey, instanceId) from a dialogue-move payload. The
 * payload's `cqId` is the CriticalQuestion.id (per
 * `app/api/dialogue/move/route.ts` lines 64–92), which FKs to
 * `SchemeInstance.id` via `CriticalQuestion.instanceId`. Returns null
 * if the CQ is not bound to an instance (e.g. catalogue-level CQs or
 * the synthetic `generic_why_*` cqId used for unkeyed WHY moves).
 */
async function resolveCqBinding(
  payloadCqId: unknown
): Promise<{ cqKey: string; instanceId: string } | null> {
  if (typeof payloadCqId !== "string" || !payloadCqId) return null;
  if (payloadCqId.startsWith("generic_why_")) return null;

  const cq = await prisma.criticalQuestion
    .findUnique({
      where: { id: payloadCqId },
      select: { cqKey: true, instanceId: true },
    })
    .catch(() => null);
  if (!cq || !cq.cqKey || !cq.instanceId) return null;
  return { cqKey: cq.cqKey, instanceId: cq.instanceId };
}

export type DialogueObligationHookInput = {
  kind: MoveKind;
  payload: Record<string, unknown> | null | undefined;
  moveId: string;
};

/**
 * Maps a dialogue move to the obligation transition it implies.
 * Returns the desired status (or null for no-op).
 *
 * Mapping table (Spec 3 §3.3 + §3.4):
 *   WHY     -> offered-open    (proponent or opponent raises the CQ)
 *   GROUNDS -> offered-engaged (counterparty answers the WHY)
 *   CONCEDE on a CQ-keyed move -> discharged
 *   RETRACT on a CQ-keyed move -> waived
 *   CLOSE / ACCEPT_ARGUMENT etc -> no obligation transition here
 */
function targetStatus(kind: MoveKind, payload: any): CqObligationStatus | null {
  switch (kind) {
    case "WHY":
      return "offered-open";
    case "GROUNDS":
      return "offered-engaged";
    case "CONCEDE":
      return payload?.cqId ? "discharged" : null;
    case "RETRACT":
      return payload?.cqId ? "waived" : null;
    default:
      return null;
  }
}

/**
 * Fire-and-forget hook. Never throws; logs and returns on any error.
 * Safe to invoke from the hot path of `app/api/dialogue/move/route.ts`.
 */
export async function onDialogueMoveForObligations(
  input: DialogueObligationHookInput
): Promise<void> {
  try {
    const to = targetStatus(input.kind, input.payload);
    if (!to) return;

    const binding = await resolveCqBinding(
      (input.payload as any)?.cqId
    );
    if (!binding) return;

    // Fetch current status so we can skip illegal transitions silently
    // (e.g. duplicate WHY on an already-engaged obligation).
    const current = await prisma.cqObligationRecord
      .findUnique({
        where: {
          instanceId_cqKey: {
            instanceId: binding.instanceId,
            cqKey: binding.cqKey,
          },
        },
        select: { status: true },
      })
      .catch(() => null);

    if (current && !isLegalTransition(current.status as CqObligationStatus, to)) {
      return;
    }

    const evidenceRefs = Array.isArray((input.payload as any)?.evidenceRefs)
      ? ((input.payload as any).evidenceRefs as unknown[]).filter(
          (x): x is string => typeof x === "string"
        )
      : undefined;

    await recordObligationTransition(binding.instanceId, binding.cqKey, {
      to,
      moveId: input.moveId,
      evidenceRefs,
    });
  } catch (err) {
    console.warn("[obligation-hook] non-fatal failure", err);
  }
}

/**
 * Counter-post hook (used by app/api/schemes/questions/[id]/counter/route.ts).
 * A counter-post = the CQ defeated the scheme instance for the
 * counter-poster's purposes; mark it `failed`.
 */
export async function onCqCounterPost(args: {
  criticalQuestionId: string;
  moveId?: string;
}): Promise<void> {
  try {
    const cq = await prisma.criticalQuestion
      .findUnique({
        where: { id: args.criticalQuestionId },
        select: { cqKey: true, instanceId: true },
      })
      .catch(() => null);
    if (!cq?.cqKey || !cq.instanceId) return;

    const current = await prisma.cqObligationRecord
      .findUnique({
        where: {
          instanceId_cqKey: {
            instanceId: cq.instanceId,
            cqKey: cq.cqKey,
          },
        },
        select: { status: true },
      })
      .catch(() => null);

    if (current && !isLegalTransition(current.status as CqObligationStatus, "failed")) {
      return;
    }

    await recordObligationTransition(cq.instanceId, cq.cqKey, {
      to: "failed",
      moveId: args.moveId ?? null,
    });
  } catch (err) {
    console.warn("[obligation-hook] counter-post failure", err);
  }
}
