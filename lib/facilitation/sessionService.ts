/**
 * Facilitation — Session service
 *
 * Locked decision #1: at most one OPEN session per deliberation. Enforced
 * application-side here AND by the partial unique index
 * `facilitation_session_open_unique` (see scripts/apply-facilitation-indexes.ts).
 *
 * Status: C1.3 — open / close implemented; handoff lifecycle in handoffService.ts.
 */

import { prisma } from "@/lib/prismaclient";
import { appendEvent } from "./eventService";
import {
  FacilitationEventType,
  FacilitationSessionStatus,
} from "./types";

export interface OpenSessionInput {
  deliberationId: string;
  openedById: string; // auth_id (User.id stringified bigint per Mesh convention)
  isPublic?: boolean;
  summary?: string | null;
}

export async function openSession(input: OpenSessionInput) {
  // Pre-check (clean error). The partial unique index is the safety net.
  const existing = await prisma.facilitationSession.findFirst({
    where: { deliberationId: input.deliberationId, status: FacilitationSessionStatus.OPEN },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `session already open for deliberation ${input.deliberationId} (id=${existing.id})`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.facilitationSession.create({
      data: {
        deliberationId: input.deliberationId,
        openedById: input.openedById,
        isPublic: input.isPublic ?? false,
        summary: input.summary ?? null,
      },
    });

    await appendEvent(
      {
        sessionId: session.id,
        eventType: FacilitationEventType.SESSION_OPENED,
        actorId: input.openedById,
        actorRole: "facilitator",
        payloadJson: {
          deliberationId: input.deliberationId,
          isPublic: session.isPublic,
        },
      },
      tx,
    );

    return session;
  });
}

export interface CloseSessionInput {
  sessionId: string;
  closedById: string;
  summary?: string | null;
}

/**
 * Close an OPEN session. Idempotent only via explicit re-call: the partial
 * unique index permits closing because the resulting status is `CLOSED`,
 * not `OPEN`. Concurrent closers are serialized by the transaction; the
 * second one will see status != OPEN and raise `session inactive`.
 *
 * Caller responsibility: the snapshot worker (C1.6) is in charge of writing
 * `isFinal = true` snapshots. This service does not block on the worker —
 * the SESSION_CLOSED event is the durable signal the worker subscribes to.
 */
export async function closeSession(input: CloseSessionInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.facilitationSession.findUnique({
      where: { id: input.sessionId },
      select: { id: true, status: true, deliberationId: true },
    });
    if (!current) throw new Error(`session not found: ${input.sessionId}`);
    if (current.status !== FacilitationSessionStatus.OPEN) {
      throw new Error(
        `session inactive (status=${current.status}); cannot close session ${input.sessionId}`,
      );
    }

    const closedAt = new Date();
    const updated = await tx.facilitationSession.update({
      where: { id: input.sessionId },
      data: {
        status: FacilitationSessionStatus.CLOSED,
        closedAt,
        closedById: input.closedById,
        summary: input.summary ?? undefined,
      },
    });

    await appendEvent(
      {
        sessionId: updated.id,
        eventType: FacilitationEventType.SESSION_CLOSED,
        actorId: input.closedById,
        actorRole: "facilitator",
        payloadJson: {
          deliberationId: current.deliberationId,
          closedAt: closedAt.toISOString(),
          summaryProvided: input.summary != null,
        },
      },
      tx,
    );

    return updated;
  });
}
