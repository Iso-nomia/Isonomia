/**
 * Facilitation — Event service
 *
 * Append-only, hash-chained event log per session. The keystone service:
 * all other facilitation services call `appendEvent` to record state
 * transitions. Mirrors `lib/pathways/pathwayEventService.ts`.
 *
 * Concurrency model: events are appended inside a Prisma transaction that
 * reads the most recent event's `hashChainSelf` as the new event's
 * `hashChainPrev`. The DB-level `@@unique([sessionId, hashChainSelf])`
 * constraint catches any race. Callers should retry on `P2002` for that
 * constraint.
 */

import { prisma } from "@/lib/prismaclient";
import type { Prisma, FacilitationEvent as PrismaFacilitationEvent } from "@prisma/client";
import {
  computeEventHash,
  eventPayloadForHash,
  verifyChain,
  type ChainVerificationResult,
} from "./hashChain";
import {
  FacilitationEventType,
  type FacilitationEvent as DomainEvent,
  type FacilitationEventInput,
} from "./types";
import { publishFacilitationEvent } from "./eventBus";

type Tx = Prisma.TransactionClient;

function rowToDomain(row: PrismaFacilitationEvent): DomainEvent {
  return {
    id: row.id,
    sessionId: row.sessionId,
    eventType: row.eventType as unknown as FacilitationEventType,
    actorId: row.actorId,
    actorRole: row.actorRole,
    payloadJson: row.payloadJson as Record<string, unknown>,
    hashChainPrev: row.hashChainPrev,
    hashChainSelf: row.hashChainSelf,
    interventionId: row.interventionId,
    metricSnapshotId: row.metricSnapshotId,
    createdAt: row.createdAt,
  };
}

export async function appendEvent(
  input: FacilitationEventInput,
  tx?: Tx,
): Promise<PrismaFacilitationEvent> {
  const run = async (client: Tx | typeof prisma) => {
    const prev = await client.facilitationEvent.findFirst({
      where: { sessionId: input.sessionId },
      orderBy: { createdAt: "desc" },
      select: { hashChainSelf: true, eventType: true },
    });

    const isGenesis = prev === null;
    if (isGenesis && input.eventType !== FacilitationEventType.SESSION_OPENED) {
      throw new Error(
        `First event for session ${input.sessionId} must be SESSION_OPENED, got ${input.eventType}`,
      );
    }

    const createdAt = new Date();
    const prevHash = prev?.hashChainSelf ?? null;
    const hashChainSelf = computeEventHash(
      prevHash,
      eventPayloadForHash(input) as unknown as Parameters<typeof computeEventHash>[1],
      createdAt,
    );

    return client.facilitationEvent.create({
      data: {
        sessionId: input.sessionId,
        eventType: input.eventType,
        actorId: input.actorId,
        actorRole: input.actorRole,
        payloadJson: input.payloadJson as Prisma.InputJsonValue,
        interventionId: input.interventionId ?? null,
        metricSnapshotId: input.metricSnapshotId ?? null,
        hashChainPrev: prevHash,
        hashChainSelf,
        createdAt,
      },
    });
  };

  if (tx) {
    const row = await run(tx);
    // NOTE: when called inside an outer transaction, the publish fires
    // before the outer tx commits. If the parent rolls back, subscribers
    // may observe a "ghost" event for a row that doesn't end up persisted.
    // Subscribers MUST be defensive (idempotent + re-read by id when they
    // need authoritative state). See `lib/facilitation/eventBus.ts`.
    void publishFacilitationEvent(row);
    return row;
  }
  const row = await prisma.$transaction((t) => run(t));
  // Best-effort outbound publish AFTER the row is durably committed.
  // Subscribers run synchronously in registration order but their errors
  // are swallowed by the bus so they cannot affect the write path.
  void publishFacilitationEvent(row);
  return row;
}

export interface ListEventsOptions {
  limit?: number;
  cursor?: string;
  eventType?: string;
}

export async function listEvents(
  sessionId: string,
  opts: ListEventsOptions = {},
): Promise<PrismaFacilitationEvent[]> {
  const { limit = 100, cursor, eventType } = opts;
  return prisma.facilitationEvent.findMany({
    where: { sessionId, ...(eventType ? { eventType: eventType as never } : {}) },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

/**
 * Load the full chain for a session and verify it end-to-end. O(n) in
 * event count; intended for admin / audit endpoints, not per-request reads.
 */
export async function verifyFacilitationChain(
  sessionId: string,
): Promise<ChainVerificationResult> {
  const events = await prisma.facilitationEvent.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });
  return verifyChain(events.map(rowToDomain));
}
