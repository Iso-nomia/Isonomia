import {
  computeEventHash,
  eventPayloadForHash,
  verifyChain,
  verifyEventHash,
} from "../hashChain";
import { PathwayEventType, type PathwayEvent, type PathwayEventInput } from "../types";

function makeInput(overrides: Partial<PathwayEventInput> = {}): PathwayEventInput {
  return {
    pathwayId: "pw_1",
    eventType: PathwayEventType.DRAFT_OPENED,
    actorId: "auth_alice",
    payloadJson: { foo: "bar" },
    ...overrides,
  };
}

function appendEvent(
  prev: PathwayEvent | null,
  input: PathwayEventInput,
  createdAt: Date,
  id: string,
): PathwayEvent {
  const prevHash = prev?.hashChainSelf ?? null;
  const payload = eventPayloadForHash(input);
  const hashChainSelf = computeEventHash(prevHash, payload, createdAt);
  return {
    id,
    pathwayId: input.pathwayId,
    packetId: input.packetId ?? null,
    submissionId: input.submissionId ?? null,
    responseId: input.responseId ?? null,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole ?? null,
    payloadJson: input.payloadJson,
    hashChainPrev: prevHash,
    hashChainSelf,
    createdAt,
  };
}

describe("computeEventHash", () => {
  it("produces a 64-char hex sha256 digest", () => {
    const h = computeEventHash(null, eventPayloadForHash(makeInput()), new Date(0));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical inputs", () => {
    const t = new Date("2025-01-01T00:00:00.000Z");
    const a = computeEventHash(null, eventPayloadForHash(makeInput()), t);
    const b = computeEventHash(null, eventPayloadForHash(makeInput()), t);
    expect(a).toBe(b);
  });

  it("changes when payload changes", () => {
    const t = new Date("2025-01-01T00:00:00.000Z");
    const a = computeEventHash(null, eventPayloadForHash(makeInput({ payloadJson: { x: 1 } })), t);
    const b = computeEventHash(null, eventPayloadForHash(makeInput({ payloadJson: { x: 2 } })), t);
    expect(a).not.toBe(b);
  });

  it("changes when prevHash changes", () => {
    const t = new Date("2025-01-01T00:00:00.000Z");
    const p = eventPayloadForHash(makeInput());
    const a = computeEventHash(null, p, t);
    const b = computeEventHash("abc", p, t);
    expect(a).not.toBe(b);
  });

  it("changes when timestamp changes", () => {
    const p = eventPayloadForHash(makeInput());
    const a = computeEventHash(null, p, new Date("2025-01-01T00:00:00.000Z"));
    const b = computeEventHash(null, p, new Date("2025-01-01T00:00:00.001Z"));
    expect(a).not.toBe(b);
  });

  it("is insensitive to payloadJson key order", () => {
    const t = new Date("2025-01-01T00:00:00.000Z");
    const a = computeEventHash(
      null,
      eventPayloadForHash(makeInput({ payloadJson: { a: 1, b: 2 } })),
      t,
    );
    const b = computeEventHash(
      null,
      eventPayloadForHash(makeInput({ payloadJson: { b: 2, a: 1 } })),
      t,
    );
    expect(a).toBe(b);
  });
});

describe("verifyEventHash", () => {
  it("returns true for an honest event", () => {
    const ev = appendEvent(null, makeInput(), new Date("2025-01-01T00:00:00.000Z"), "e1");
    expect(verifyEventHash(ev)).toBe(true);
  });

  it("returns false when payload is tampered", () => {
    const ev = appendEvent(null, makeInput(), new Date("2025-01-01T00:00:00.000Z"), "e1");
    const tampered: PathwayEvent = { ...ev, payloadJson: { foo: "MUTATED" } };
    expect(verifyEventHash(tampered)).toBe(false);
  });

  it("returns false when timestamp is tampered", () => {
    const ev = appendEvent(null, makeInput(), new Date("2025-01-01T00:00:00.000Z"), "e1");
    const tampered: PathwayEvent = { ...ev, createdAt: new Date("2025-01-02T00:00:00.000Z") };
    expect(verifyEventHash(tampered)).toBe(false);
  });
});

describe("verifyChain", () => {
  function buildHonestChain(): PathwayEvent[] {
    const t0 = new Date("2025-01-01T00:00:00.000Z");
    const t1 = new Date("2025-01-01T00:00:01.000Z");
    const t2 = new Date("2025-01-01T00:00:02.000Z");

    const e0 = appendEvent(null, makeInput(), t0, "e0");
    const e1 = appendEvent(
      e0,
      makeInput({ eventType: PathwayEventType.ITEM_ADDED, payloadJson: { id: "i1" } }),
      t1,
      "e1",
    );
    const e2 = appendEvent(
      e1,
      makeInput({ eventType: PathwayEventType.SUBMITTED, payloadJson: { packetId: "p1" } }),
      t2,
      "e2",
    );
    return [e0, e1, e2];
  }

  it("rejects empty chain", () => {
    expect(verifyChain([])).toEqual({ valid: false, failedIndex: -1, reason: "EMPTY" });
  });

  it("validates an honest chain", () => {
    const chain = buildHonestChain();
    expect(verifyChain(chain)).toEqual({ valid: true, failedIndex: -1 });
  });

  it("rejects genesis event with non-null prev hash", () => {
    const chain = buildHonestChain();
    chain[0] = { ...chain[0], hashChainPrev: "deadbeef" };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.failedIndex).toBe(0);
    expect(result.reason).toBe("GENESIS_PREV_NOT_NULL");
  });

  it("detects a broken prev-hash link", () => {
    const chain = buildHonestChain();
    chain[1] = { ...chain[1], hashChainPrev: "0".repeat(64) };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.failedIndex).toBe(1);
    expect(result.reason).toBe("PREV_HASH_MISMATCH");
  });

  it("detects a tampered self hash", () => {
    const chain = buildHonestChain();
    chain[2] = { ...chain[2], payloadJson: { packetId: "MUTATED" } };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.failedIndex).toBe(2);
    expect(result.reason).toBe("SELF_HASH_MISMATCH");
  });

  it("detects out-of-order events", () => {
    const chain = buildHonestChain();
    // Force event 2's createdAt to predate event 1's, simulating reordering.
    chain[2] = { ...chain[2], createdAt: new Date("2024-12-31T00:00:00.000Z") };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.failedIndex).toBe(2);
    expect(result.reason).toBe("OUT_OF_ORDER");
  });
});
