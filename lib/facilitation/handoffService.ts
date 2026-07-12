/**
 * Facilitation — Handoff service
 *
 * Atomic transfer of an OPEN session to a new facilitator (locked decision #1).
 *
 * Lifecycle:
 *   PENDING ── accept ──> ACCEPTED  (closes source session as HANDED_OFF and
 *                                    opens a fresh successor session in one tx)
 *   PENDING ── decline ──> DECLINED (source session stays OPEN; chain logs the decline)
 *   PENDING ── cancel ──> CANCELED (source session stays OPEN; initiator withdrew)
 *
 * Concurrency:
 *   - The partial unique index `facilitation_handoff_pending_unique` guarantees
 *     at most one PENDING handoff per source session.
 *   - The accept path performs the source-session status flip (OPEN → HANDED_OFF)
 *     before inserting the successor session, so the partial unique index
 *     `facilitation_session_open_unique` is never violated within the tx.
 */

import { prisma } from "@/lib/prismaclient";
import type { Prisma } from "@prisma/client";
import { appendEvent } from "./eventService";
import {
  FacilitationEventType,
  FacilitationHandoffStatus,
  FacilitationSessionStatus,
} from "./types";

type Tx = Prisma.TransactionClient;

async function snapshotOutstandingInterventionIds(
  client: Tx | typeof prisma,
  sessionId: string,
): Promise<string[]> {
  const rows = await client.facilitationIntervention.findMany({
    where: { sessionId, appliedAt: null, dismissedAt: null },
    select: { id: true },
    orderBy: { recommendedAt: "asc" },
  });
  return rows.map((r) => r.id);
}

export interface InitiateHandoffInput {
  fromSessionId: string;
  initiatedById: string; // auth_id of caller (must be active facilitator)
  toUserId: string;
  notesText?: string | null;
}

export async function initiateHandoff(input: InitiateHandoffInput) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.facilitationSession.findUnique({
      where: { id: input.fromSessionId },
      select: { id: true, status: true, deliberationId: true, openedById: true },
    });
    if (!session) throw new Error(`session not found: ${input.fromSessionId}`);
    if (session.status !== FacilitationSessionStatus.OPEN) {
      throw new Error(
        `session inactive (status=${session.status}); cannot initiate handoff from ${input.fromSessionId}`,
      );
    }

    const pending = await tx.facilitationHandoff.findFirst({
      where: {
        fromSessionId: input.fromSessionId,
        status: FacilitationHandoffStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new Error(
        `handoff pending for session ${input.fromSessionId} (handoff=${pending.id})`,
      );
    }

    const outstandingIds = await snapshotOutstandingInterventionIds(tx, input.fromSessionId);

    const handoff = await tx.facilitationHandoff.create({
      data: {
        fromSessionId: input.fromSessionId,
        toUserId: input.toUserId,
        initiatedById: input.initiatedById,
        notesText: input.notesText ?? null,
        outstandingInterventionIds: outstandingIds as unknown as Prisma.InputJsonValue,
      },
    });

    await appendEvent(
      {
        sessionId: input.fromSessionId,
        eventType: FacilitationEventType.HANDOFF_INITIATED,
        actorId: input.initiatedById,
        actorRole: "facilitator",
        payloadJson: {
          handoffId: handoff.id,
          toUserId: input.toUserId,
          outstandingInterventionCount: outstandingIds.length,
          notesProvided: input.notesText != null,
        },
      },
      tx,
    );

    return handoff;
  });
}

export interface AcceptHandoffInput {
  handoffId: string;
  acceptedById: string; // auth_id of caller; must equal handoff.toUserId
  notesText?: string | null;
}

/**
 * Atomic accept: marks source session HANDED_OFF, creates successor OPEN
 * session, links the handoff. Two new chain entries are produced:
 *   1) HANDOFF_ACCEPTED on the source session (terminal entry on that chain).
 *   2) SESSION_OPENED genesis on the successor session.
 */
export async function acceptHandoff(input: AcceptHandoffInput) {
  return prisma.$transaction(async (tx) => {
    const handoff = await tx.facilitationHandoff.findUnique({
      where: { id: input.handoffId },
      select: {
        id: true,
        status: true,
        fromSessionId: true,
        toUserId: true,
        notesText: true,
        outstandingInterventionIds: true,
      },
    });
    if (!handoff) throw new Error(`handoff not found: ${input.handoffId}`);
    if (handoff.status !== FacilitationHandoffStatus.PENDING) {
      throw new Error(
        `handoff inactive (status=${handoff.status}); cannot accept ${input.handoffId}`,
      );
    }
    if (handoff.toUserId !== input.acceptedById) {
      throw new Error(
        `handoff target mismatch: caller ${input.acceptedById} is not the intended receiver`,
      );
    }

    const source = await tx.facilitationSession.findUnique({
      where: { id: handoff.fromSessionId },
      select: { id: true, status: true, deliberationId: true, isPublic: true },
    });
    if (!source) throw new Error(`source session not found: ${handoff.fromSessionId}`);
    if (source.status !== FacilitationSessionStatus.OPEN) {
      throw new Error(
        `source session inactive (status=${source.status}); cannot accept handoff`,
      );
    }

    const acceptedAt = new Date();

    // 1. Flip source status BEFORE creating successor so the partial unique
    //    index on (deliberationId WHERE status='OPEN') is satisfied.
    await tx.facilitationSession.update({
      where: { id: source.id },
      data: { status: FacilitationSessionStatus.HANDED_OFF, closedAt: acceptedAt },
    });

    // 2. Terminal entry on source chain.
    await appendEvent(
      {
        sessionId: source.id,
        eventType: FacilitationEventType.HANDOFF_ACCEPTED,
        actorId: input.acceptedById,
        actorRole: "facilitator",
        payloadJson: {
          handoffId: handoff.id,
          fromSessionId: source.id,
          acceptedAt: acceptedAt.toISOString(),
          outstandingInterventionCount: Array.isArray(handoff.outstandingInterventionIds)
            ? (handoff.outstandingInterventionIds as unknown[]).length
            : 0,
        },
      },
      tx,
    );

    // 3. Successor session — same deliberation, new openedBy.
    const successor = await tx.facilitationSession.create({
      data: {
        deliberationId: source.deliberationId,
        openedById: handoff.toUserId,
        isPublic: source.isPublic,
        summary: null,
      },
    });

    // 4. Genesis SESSION_OPENED on successor chain (cross-references handoff).
    await appendEvent(
      {
        sessionId: successor.id,
        eventType: FacilitationEventType.SESSION_OPENED,
        actorId: handoff.toUserId,
        actorRole: "facilitator",
        payloadJson: {
          deliberationId: source.deliberationId,
          isPublic: successor.isPublic,
          handoffId: handoff.id,
          predecessorSessionId: source.id,
        },
      },
      tx,
    );

    // 5. Mark handoff ACCEPTED, link successor.
    const updated = await tx.facilitationHandoff.update({
      where: { id: handoff.id },
      data: {
        status: FacilitationHandoffStatus.ACCEPTED,
        acceptedAt,
        toSessionId: successor.id,
        notesText: input.notesText ?? handoff.notesText,
      },
    });

    return { handoff: updated, successor };
  });
}

export interface RespondHandoffInput {
  handoffId: string;
  actorId: string; // auth_id of caller
  notesText?: string | null;
}

export async function declineHandoff(input: RespondHandoffInput) {
  return prisma.$transaction(async (tx) => {
    const handoff = await tx.facilitationHandoff.findUnique({
      where: { id: input.handoffId },
      select: { id: true, status: true, fromSessionId: true, toUserId: true, notesText: true },
    });
    if (!handoff) throw new Error(`handoff not found: ${input.handoffId}`);
    if (handoff.status !== FacilitationHandoffStatus.PENDING) {
      throw new Error(
        `handoff inactive (status=${handoff.status}); cannot decline ${input.handoffId}`,
      );
    }
    if (handoff.toUserId !== input.actorId) {
      throw new Error(
        `handoff target mismatch: caller ${input.actorId} is not the intended receiver`,
      );
    }

    const declinedAt = new Date();
    const updated = await tx.facilitationHandoff.update({
      where: { id: handoff.id },
      data: {
        status: FacilitationHandoffStatus.DECLINED,
        declinedAt,
        notesText: input.notesText ?? handoff.notesText,
      },
    });

    await appendEvent(
      {
        sessionId: handoff.fromSessionId,
        eventType: FacilitationEventType.HANDOFF_DECLINED,
        actorId: input.actorId,
        actorRole: "facilitator",
        payloadJson: {
          handoffId: handoff.id,
          declinedAt: declinedAt.toISOString(),
          notesProvided: input.notesText != null,
        },
      },
      tx,
    );

    return updated;
  });
}

export async function cancelHandoff(input: RespondHandoffInput) {
  return prisma.$transaction(async (tx) => {
    const handoff = await tx.facilitationHandoff.findUnique({
      where: { id: input.handoffId },
      select: { id: true, status: true, fromSessionId: true, initiatedById: true, notesText: true },
    });
    if (!handoff) throw new Error(`handoff not found: ${input.handoffId}`);
    if (handoff.status !== FacilitationHandoffStatus.PENDING) {
      throw new Error(
        `handoff inactive (status=${handoff.status}); cannot cancel ${input.handoffId}`,
      );
    }
    if (handoff.initiatedById !== input.actorId) {
      throw new Error(
        `handoff initiator mismatch: caller ${input.actorId} did not initiate this handoff`,
      );
    }

    const canceledAt = new Date();
    const updated = await tx.facilitationHandoff.update({
      where: { id: handoff.id },
      data: {
        status: FacilitationHandoffStatus.CANCELED,
        canceledAt,
        notesText: input.notesText ?? handoff.notesText,
      },
    });

    await appendEvent(
      {
        sessionId: handoff.fromSessionId,
        eventType: FacilitationEventType.HANDOFF_CANCELED,
        actorId: input.actorId,
        actorRole: "facilitator",
        payloadJson: {
          handoffId: handoff.id,
          canceledAt: canceledAt.toISOString(),
          notesProvided: input.notesText != null,
        },
      },
      tx,
    );

    return updated;
  });
}
