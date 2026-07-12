/**
 * Pathways — Event service
 *
 * Append-only, hash-chained event log per pathway. The keystone service:
 * all other services call `appendEvent` to record state transitions.
 *
 * Concurrency model: events are appended inside a Prisma transaction that
 * reads the most recent event's `hashChainSelf` as the new event's
 * `hashChainPrev`. The database-level `@@unique([pathwayId, hashChainSelf])`
 * constraint catches any race. Callers should retry on `P2002` for that
 * constraint.
 *
 * Status: A1 scaffold. Pilot-scale only; production hardening (advisory
 * locks, retry wrapper) deferred.
 */

import { prisma } from "@/lib/prismaclient";
import type { Prisma, PathwayEvent as PrismaPathwayEvent } from "@prisma/client";
import {
  computeEventHash,
  eventPayloadForHash,
  verifyChain,
  type ChainVerificationResult,
} from "./hashChain";
import { PathwayEventType, type PathwayEventInput } from "./types";

type Tx = Prisma.TransactionClient;

/**
 * Append a new event to a pathway's hash chain. If called inside an existing
 * transaction, pass `tx`; otherwise a fresh transaction is opened.
 */
export async function appendEvent(
  input: PathwayEventInput,
  tx?: Tx,
): Promise<PrismaPathwayEvent> {
  const run = async (client: Tx | typeof prisma) => {
    const prev = await client.pathwayEvent.findFirst({
      where: { pathwayId: input.pathwayId },
      orderBy: { createdAt: "desc" },
      select: { hashChainSelf: true, eventType: true },
    });

    const isGenesis = prev === null;
    if (isGenesis && input.eventType !== PathwayEventType.DRAFT_OPENED) {
      throw new Error(
        `First event for pathway ${input.pathwayId} must be DRAFT_OPENED, got ${input.eventType}`,
      );
    }

    const createdAt = new Date();
    const prevHash = prev?.hashChainSelf ?? null;
    const hashChainSelf = computeEventHash(
      prevHash,
      eventPayloadForHash(input),
      createdAt,
    );

    return client.pathwayEvent.create({
      data: {
        pathwayId: input.pathwayId,
        packetId: input.packetId ?? null,
        submissionId: input.submissionId ?? null,
        responseId: input.responseId ?? null,
        eventType: input.eventType,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        payloadJson: input.payloadJson as Prisma.InputJsonValue,
        hashChainPrev: prevHash,
        hashChainSelf,
        createdAt,
      },
    });
  };

  if (tx) return run(tx);
  return prisma.$transaction((t) => run(t));
}

export interface ListEventsOptions {
  limit?: number;
  cursor?: string;
}

export async function listEvents(
  pathwayId: string,
  opts: ListEventsOptions = {},
): Promise<PrismaPathwayEvent[]> {
  const { limit = 100, cursor } = opts;
  return prisma.pathwayEvent.findMany({
    where: { pathwayId },
    orderBy: { createdAt: "asc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

/**
 * Load the full chain for a pathway and verify it end-to-end. O(n) in
 * event count; intended for admin / audit endpoints, not per-request reads.
 */
export async function verifyPathwayChain(
  pathwayId: string,
): Promise<ChainVerificationResult> {
  const events = await prisma.pathwayEvent.findMany({
    where: { pathwayId },
    orderBy: { createdAt: "asc" },
  });
  return verifyChain(
    events.map((e) => ({
      id: e.id,
      pathwayId: e.pathwayId,
      packetId: e.packetId,
      submissionId: e.submissionId,
      responseId: e.responseId,
      eventType: e.eventType as unknown as PathwayEventType,
      actorId: e.actorId,
      actorRole: e.actorRole,
      payloadJson: e.payloadJson as Record<string, unknown>,
      hashChainPrev: e.hashChainPrev,
      hashChainSelf: e.hashChainSelf,
      createdAt: e.createdAt,
    })),
  );
}
