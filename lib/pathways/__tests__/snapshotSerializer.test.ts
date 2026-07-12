import { snapshotPacket, snapshotPacketItem } from "../snapshotSerializer";
import { PacketItemKind, type PacketItemSnapshotInput } from "../types";

function item(overrides: Partial<PacketItemSnapshotInput> = {}): PacketItemSnapshotInput {
  return {
    kind: PacketItemKind.CLAIM,
    targetType: "Claim",
    targetId: "claim_1",
    orderIndex: 0,
    commentary: null,
    content: { text: "Hello world" },
    ...overrides,
  };
}

describe("snapshotPacketItem", () => {
  it("returns a sha256 hex hash and snapshot blob with schemaVersion 1", () => {
    const { snapshot, snapshotHash } = snapshotPacketItem(item());
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across content key reordering", () => {
    const a = snapshotPacketItem(item({ content: { a: 1, b: 2, c: { x: 1, y: 2 } } }));
    const b = snapshotPacketItem(item({ content: { c: { y: 2, x: 1 }, b: 2, a: 1 } }));
    expect(a.snapshotHash).toBe(b.snapshotHash);
  });

  it("changes hash when content changes", () => {
    const a = snapshotPacketItem(item({ content: { text: "v1" } }));
    const b = snapshotPacketItem(item({ content: { text: "v2" } }));
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });

  it("changes hash when commentary changes", () => {
    const a = snapshotPacketItem(item({ commentary: null }));
    const b = snapshotPacketItem(item({ commentary: "Note" }));
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });

  it("changes hash when orderIndex changes", () => {
    const a = snapshotPacketItem(item({ orderIndex: 0 }));
    const b = snapshotPacketItem(item({ orderIndex: 1 }));
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });
});

describe("snapshotPacket", () => {
  it("returns per-item snapshots and an aggregate hash", () => {
    const result = snapshotPacket([
      item({ orderIndex: 0, targetId: "c1", content: { text: "one" } }),
      item({ orderIndex: 1, targetId: "c2", content: { text: "two" } }),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.packetSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("aggregate hash is invariant under input reordering (orders by orderIndex)", () => {
    const i0 = item({ orderIndex: 0, targetId: "c1", content: { text: "one" } });
    const i1 = item({ orderIndex: 1, targetId: "c2", content: { text: "two" } });
    const a = snapshotPacket([i0, i1]);
    const b = snapshotPacket([i1, i0]);
    expect(a.packetSnapshotHash).toBe(b.packetSnapshotHash);
  });

  it("aggregate hash changes when an item's content changes", () => {
    const a = snapshotPacket([
      item({ orderIndex: 0, targetId: "c1", content: { text: "one" } }),
      item({ orderIndex: 1, targetId: "c2", content: { text: "two" } }),
    ]);
    const b = snapshotPacket([
      item({ orderIndex: 0, targetId: "c1", content: { text: "ONE" } }),
      item({ orderIndex: 1, targetId: "c2", content: { text: "two" } }),
    ]);
    expect(a.packetSnapshotHash).not.toBe(b.packetSnapshotHash);
  });

  it("aggregate hash changes when items are added", () => {
    const a = snapshotPacket([item({ orderIndex: 0, targetId: "c1" })]);
    const b = snapshotPacket([
      item({ orderIndex: 0, targetId: "c1" }),
      item({ orderIndex: 1, targetId: "c2" }),
    ]);
    expect(a.packetSnapshotHash).not.toBe(b.packetSnapshotHash);
  });

  it("aggregate hash differs when orderIndex assignments swap (semantic order matters)", () => {
    const a = snapshotPacket([
      item({ orderIndex: 0, targetId: "c1", content: { text: "one" } }),
      item({ orderIndex: 1, targetId: "c2", content: { text: "two" } }),
    ]);
    const b = snapshotPacket([
      item({ orderIndex: 1, targetId: "c1", content: { text: "one" } }),
      item({ orderIndex: 0, targetId: "c2", content: { text: "two" } }),
    ]);
    expect(a.packetSnapshotHash).not.toBe(b.packetSnapshotHash);
  });

  it("handles empty item list deterministically", () => {
    const a = snapshotPacket([]);
    const b = snapshotPacket([]);
    expect(a.items).toEqual([]);
    expect(a.packetSnapshotHash).toBe(b.packetSnapshotHash);
    expect(a.packetSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
