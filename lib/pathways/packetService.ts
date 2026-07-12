/**
 * Pathways — Packet service
 *
 * Draft / add items / submit lifecycle for `RecommendationPacket`.
 * On submit: freezes item content into `snapshotJson` + `snapshotHash`
 * via the snapshot serializer, updates pathway's `currentPacketId`, and
 * appends `PACKET_FINALIZED` event.
 *
 * Status: A1 scaffold. Content resolution (`resolveContent`) is a caller
 * responsibility hook — the packet service does not know how to fetch
 * Claim / Argument / Citation / Note text from the DB. A default resolver
 * wired against existing Mesh models can be added in a follow-up.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  Prisma,
  RecommendationPacket,
  RecommendationPacketItem,
} from "@prisma/client";
import { appendEvent } from "./pathwayEventService";
import { snapshotPacket } from "./snapshotSerializer";
import {
  PacketItemKind,
  PacketStatus,
  PathwayEventType,
  type AuthId,
  type PacketItemSnapshotInput,
} from "./types";

export interface CreateDraftInput {
  pathwayId: string;
  title: string;
  summary?: string | null;
  createdById: AuthId;
  parentPacketId?: string | null;
}

export async function createDraft(
  input: CreateDraftInput,
): Promise<RecommendationPacket> {
  return prisma.$transaction(async (tx) => {
    const maxVersion = await tx.recommendationPacket.aggregate({
      where: { pathwayId: input.pathwayId },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? 0) + 1;

    return tx.recommendationPacket.create({
      data: {
        pathwayId: input.pathwayId,
        parentPacketId: input.parentPacketId ?? null,
        version: nextVersion,
        title: input.title,
        summary: input.summary ?? null,
        status: PacketStatus.DRAFT,
        createdById: input.createdById,
      },
    });
  });
}

export interface AddItemInput {
  packetId: string;
  kind: PacketItemKind;
  targetType: string;
  targetId: string;
  orderIndex?: number;
  commentary?: string | null;
  actorId: AuthId;
}

export async function addItem(
  input: AddItemInput,
): Promise<RecommendationPacketItem> {
  return prisma.$transaction(async (tx) => {
    const packet = await tx.recommendationPacket.findUnique({
      where: { id: input.packetId },
      select: { pathwayId: true, status: true },
    });
    if (!packet) throw new Error(`Packet ${input.packetId} not found`);
    if (packet.status !== PacketStatus.DRAFT) {
      throw new Error(`Cannot add items to packet in status ${packet.status}`);
    }

    let orderIndex = input.orderIndex;
    if (orderIndex === undefined) {
      const maxOrder = await tx.recommendationPacketItem.aggregate({
        where: { packetId: input.packetId },
        _max: { orderIndex: true },
      });
      orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;
    }

    const item = await tx.recommendationPacketItem.create({
      data: {
        packetId: input.packetId,
        kind: input.kind,
        targetType: input.targetType,
        targetId: input.targetId,
        orderIndex,
        commentary: input.commentary ?? null,
      },
    });

    await appendEvent(
      {
        pathwayId: packet.pathwayId,
        packetId: input.packetId,
        eventType: PathwayEventType.ITEM_ADDED,
        actorId: input.actorId,
        payloadJson: {
          itemId: item.id,
          kind: input.kind,
          targetType: input.targetType,
          targetId: input.targetId,
          orderIndex,
        },
      },
      tx,
    );

    return item;
  });
}

export async function removeItem(
  itemId: string,
  actorId: AuthId,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await tx.recommendationPacketItem.findUnique({
      where: { id: itemId },
      include: { packet: { select: { pathwayId: true, status: true } } },
    });
    if (!item) throw new Error(`Item ${itemId} not found`);
    if (item.packet.status !== PacketStatus.DRAFT) {
      throw new Error(`Cannot remove items from packet in status ${item.packet.status}`);
    }

    await tx.recommendationPacketItem.delete({ where: { id: itemId } });

    await appendEvent(
      {
        pathwayId: item.packet.pathwayId,
        packetId: item.packetId,
        eventType: PathwayEventType.ITEM_REMOVED,
        actorId,
        payloadJson: {
          itemId,
          kind: item.kind,
          targetType: item.targetType,
          targetId: item.targetId,
        },
      },
      tx,
    );
  });
}

/**
 * Resolver signature: given a packet item, return the canonical content blob
 * to snapshot. Callers (e.g. API route handlers) plug in a resolver that
 * knows how to fetch Claim / Argument / Citation / Note payloads.
 */
export type ContentResolver = (
  item: Pick<RecommendationPacketItem, "kind" | "targetType" | "targetId">,
) => Promise<Record<string, unknown>>;

export interface FinalizePacketInput {
  packetId: string;
  actorId: AuthId;
  resolveContent: ContentResolver;
}

export interface FinalizePacketResult {
  packet: RecommendationPacket;
  packetSnapshotHash: string;
}

/**
 * Freeze item content, mark packet SUBMITTED, update the pathway's
 * currentPacketId, and append `PACKET_FINALIZED`. Does not itself create
 * an `InstitutionalSubmission` — that is the submission service's job.
 */
export async function finalizePacket(
  input: FinalizePacketInput,
): Promise<FinalizePacketResult> {
  const items = await prisma.recommendationPacketItem.findMany({
    where: { packetId: input.packetId },
    orderBy: { orderIndex: "asc" },
  });

  if (items.length === 0) {
    throw new Error(`Cannot finalize empty packet ${input.packetId}`);
  }

  const resolved: PacketItemSnapshotInput[] = await Promise.all(
    items.map(async (item) => ({
      kind: item.kind as unknown as PacketItemKind,
      targetType: item.targetType,
      targetId: item.targetId,
      orderIndex: item.orderIndex,
      commentary: item.commentary,
      content: await input.resolveContent({
        kind: item.kind,
        targetType: item.targetType,
        targetId: item.targetId,
      }),
    })),
  );

  const { items: snaps, packetSnapshotHash } = snapshotPacket(resolved);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.recommendationPacket.findUnique({
      where: { id: input.packetId },
      select: { status: true, pathwayId: true },
    });
    if (!existing) throw new Error(`Packet ${input.packetId} not found`);
    if (existing.status !== PacketStatus.DRAFT) {
      throw new Error(`Cannot finalize packet in status ${existing.status}`);
    }

    // Snapshot each item in order — items[i] corresponds to snaps[i].
    for (let i = 0; i < items.length; i++) {
      const { snapshot, snapshotHash } = snaps[i];
      await tx.recommendationPacketItem.update({
        where: { id: items[i].id },
        data: {
          snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
          snapshotHash,
        },
      });
    }

    const packet = await tx.recommendationPacket.update({
      where: { id: input.packetId },
      data: {
        status: PacketStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await tx.institutionalPathway.update({
      where: { id: existing.pathwayId },
      data: { currentPacketId: input.packetId },
    });

    await appendEvent(
      {
        pathwayId: existing.pathwayId,
        packetId: input.packetId,
        eventType: PathwayEventType.PACKET_FINALIZED,
        actorId: input.actorId,
        payloadJson: {
          packetSnapshotHash,
          itemCount: items.length,
        },
      },
      tx,
    );

    return { packet, packetSnapshotHash };
  });
}

export async function getPacket(id: string): Promise<RecommendationPacket | null> {
  return prisma.recommendationPacket.findUnique({ where: { id } });
}

export async function listPacketItems(
  packetId: string,
): Promise<RecommendationPacketItem[]> {
  return prisma.recommendationPacketItem.findMany({
    where: { packetId },
    orderBy: { orderIndex: "asc" },
  });
}
