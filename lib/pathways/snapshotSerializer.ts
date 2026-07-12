/**
 * Pathways — Packet item snapshot serializer
 *
 * Produces immutable, hashable snapshots of a packet's items at submission
 * time. The snapshot freezes the textual content of each referenced claim,
 * argument, citation, or note so that subsequent edits to source records do
 * not retroactively alter what was actually submitted.
 *
 * Status: A0 scaffold. Pure functions. Resolution of `content` (looking up
 * the actual Claim/Argument text) is the responsibility of the caller; this
 * module operates on already-resolved `PacketItemSnapshotInput` values.
 */

import { createHash } from "crypto";
import { canonicalJsonStringify } from "./canonicalJson";
import { PacketItemKind, type PacketItemSnapshotInput } from "./types";

export interface PacketItemSnapshot {
  kind: PacketItemKind;
  targetType: string;
  targetId: string;
  orderIndex: number;
  commentary: string | null;
  content: Record<string, unknown>;
  /** Snapshot schema version; increment if the snapshot shape changes. */
  schemaVersion: 1;
}

export interface PacketSnapshotResult {
  /** Per-item snapshot blobs, in order. */
  items: Array<{
    snapshot: PacketItemSnapshot;
    snapshotHash: string;
  }>;
  /** Aggregate hash over all per-item snapshot hashes (Merkle-root-lite). */
  packetSnapshotHash: string;
}

const SCHEMA_VERSION = 1 as const;

function buildSnapshot(input: PacketItemSnapshotInput): PacketItemSnapshot {
  return {
    kind: input.kind,
    targetType: input.targetType,
    targetId: input.targetId,
    orderIndex: input.orderIndex,
    commentary: input.commentary,
    content: input.content,
    schemaVersion: SCHEMA_VERSION,
  };
}

function hashSnapshot(snapshot: PacketItemSnapshot): string {
  const canonical = canonicalJsonStringify(snapshot);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Snapshot a single packet item. Returns the snapshot blob (to store in
 * `RecommendationPacketItem.snapshotJson`) and its sha256 hash (to store in
 * `RecommendationPacketItem.snapshotHash`).
 */
export function snapshotPacketItem(input: PacketItemSnapshotInput): {
  snapshot: PacketItemSnapshot;
  snapshotHash: string;
} {
  const snapshot = buildSnapshot(input);
  return { snapshot, snapshotHash: hashSnapshot(snapshot) };
}

/**
 * Snapshot all items in a packet at submission time and produce an aggregate
 * packet-level hash useful for cross-checking integrity reports.
 *
 * The aggregate hash is computed as
 *   sha256(canonical_json([{orderIndex, snapshotHash}, ...]))
 * after sorting the inner array by orderIndex ascending.
 */
export function snapshotPacket(items: PacketItemSnapshotInput[]): PacketSnapshotResult {
  const snapshots = items.map(snapshotPacketItem);

  const aggregateInput = snapshots
    .map(({ snapshot, snapshotHash }) => ({
      orderIndex: snapshot.orderIndex,
      snapshotHash,
    }))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const aggregate = createHash("sha256")
    .update(canonicalJsonStringify(aggregateInput))
    .digest("hex");

  return {
    items: snapshots,
    packetSnapshotHash: aggregate,
  };
}
