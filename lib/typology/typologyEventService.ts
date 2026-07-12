/**
 * Typology / Meta-consensus — Event service
 *
 * Append-only, hash-chained event log per (deliberationId, sessionId | null).
 * Keystone service: every other typology service appends events here to
 * record state transitions. Mirrors `lib/facilitation/eventService.ts`.
 *
 * Concurrency model: events are appended inside a Prisma transaction that
 * reads the most recent event's `hashChainSelf` as the new event's
 * `hashChainPrev`. The DB-level `@@unique([deliberationId, sessionId, hashChainSelf])`
 * constraint catches any race. Callers should retry on `P2002` for that
 * constraint.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  Prisma,
  MetaConsensusEvent as PrismaMetaConsensusEvent,
} from "@prisma/client";
import {
  computeEventHash,
  eventPayloadForHash,
  verifyChain,
  type ChainVerificationResult,
} from "./hashChain";
import {
  MetaConsensusEventType,
  type MetaConsensusEvent as DomainEvent,
  type MetaConsensusEventInput,
} from "./types";
import { publishMetaConsensusEvent } from "./eventBus";

type Tx = Prisma.TransactionClient;

function rowToDomain(row: PrismaMetaConsensusEvent): DomainEvent {
  return {
    id: row.id,
    deliberationId: row.deliberationId,
    sessionId: row.sessionId,
    eventType: row.eventType as unknown as MetaConsensusEventType,
    actorId: row.actorId,
    actorRole: row.actorRole,
    payloadJson: row.payloadJson as Record<string, unknown>,
    hashChainPrev: row.hashChainPrev,
    hashChainSelf: row.hashChainSelf,
    tagId: row.tagId,
    summaryId: row.summaryId,
    candidateId: row.candidateId,
    createdAt: row.createdAt,
  };
}

export async function appendEvent(
  input: MetaConsensusEventInput,
  tx?: Tx,
): Promise<PrismaMetaConsensusEvent> {
  const sessionId = input.sessionId ?? null;
  const run = async (client: Tx | typeof prisma) => {
    const prev = await client.metaConsensusEvent.findFirst({
      where: { deliberationId: input.deliberationId, sessionId },
      orderBy: { createdAt: "desc" },
      select: { hashChainSelf: true },
    });

    const createdAt = new Date();
    const prevHash = prev?.hashChainSelf ?? null;
    const hashChainSelf = computeEventHash(
      prevHash,
      eventPayloadForHash(input),
      createdAt,
    );

    return client.metaConsensusEvent.create({
      data: {
        deliberationId: input.deliberationId,
        sessionId,
        eventType: input.eventType,
        actorId: input.actorId,
        actorRole: input.actorRole,
        payloadJson: input.payloadJson as Prisma.InputJsonValue,
        tagId: input.tagId ?? null,
        summaryId: input.summaryId ?? null,
        candidateId: input.candidateId ?? null,
        hashChainPrev: prevHash,
        hashChainSelf,
        createdAt,
      },
    });
  };

  if (tx) {
    const row = await run(tx);
    // NOTE: when called inside an outer transaction, the publish fires
    // before the outer tx commits. Subscribers MUST be defensive
    // (idempotent + re-read by id when they need authoritative state).
    void publishMetaConsensusEvent(row);
    return row;
  }
  const row = await prisma.$transaction((t) => run(t));
  void publishMetaConsensusEvent(row);
  return row;
}

export interface ListEventsOptions {
  limit?: number;
  cursor?: string;
  eventType?: string;
  /** When provided, only events on the given session chain are returned. */
  sessionId?: string | null;
}

export async function listEvents(
  deliberationId: string,
  opts: ListEventsOptions = {},
): Promise<PrismaMetaConsensusEvent[]> {
  const { limit = 100, cursor, eventType } = opts;
  return prisma.metaConsensusEvent.findMany({
    where: {
      deliberationId,
      ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
      ...(eventType ? { eventType: eventType as never } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

/**
 * Load the full chain for a (deliberationId, sessionId | null) scope and
 * verify it end-to-end. O(n) in event count; intended for admin / audit
 * endpoints, not per-request reads.
 */
export async function verifyMetaConsensusChain(
  deliberationId: string,
  sessionId: string | null = null,
): Promise<ChainVerificationResult> {
  const events = await prisma.metaConsensusEvent.findMany({
    where: { deliberationId, sessionId },
    orderBy: { createdAt: "asc" },
  });
  return verifyChain(events.map(rowToDomain));
}

/** Convenience: head hash for a chain (used as `metaConsensusChainHead` in Scope A packet snapshots). */
export async function chainHead(
  deliberationId: string,
  sessionId: string | null = null,
): Promise<string | null> {
  const last = await prisma.metaConsensusEvent.findFirst({
    where: { deliberationId, sessionId },
    orderBy: { createdAt: "desc" },
    select: { hashChainSelf: true },
  });
  return last?.hashChainSelf ?? null;
}
