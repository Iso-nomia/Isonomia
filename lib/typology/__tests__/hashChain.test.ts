import {
  computeEventHash,
  eventPayloadForHash,
  verifyChain,
  verifyEventHash,
} from "../hashChain";
import {
  MetaConsensusEventType,
  type MetaConsensusEvent,
  type MetaConsensusEventInput,
} from "../types";

function makeInput(overrides: Partial<MetaConsensusEventInput> = {}): MetaConsensusEventInput {
  return {
    deliberationId: "delib_1",
    sessionId: null,
    eventType: MetaConsensusEventType.TAG_PROPOSED,
    actorId: "auth_alice",
    actorRole: "participant",
    payloadJson: { axisKey: "VALUE" },
    ...overrides,
  };
}

function appendEvent(
  prev: MetaConsensusEvent | null,
  input: MetaConsensusEventInput,
  createdAt: Date,
  id: string,
): MetaConsensusEvent {
  const prevHash = prev?.hashChainSelf ?? null;
  const payload = eventPayloadForHash(input);
  const hashChainSelf = computeEventHash(prevHash, payload, createdAt);
  return {
    id,
    deliberationId: input.deliberationId,
    sessionId: input.sessionId ?? null,
    eventType: input.eventType,
    actorId: input.actorId,
    actorRole: input.actorRole,
    payloadJson: input.payloadJson,
    tagId: input.tagId ?? null,
    summaryId: input.summaryId ?? null,
    candidateId: input.candidateId ?? null,
    hashChainPrev: prevHash,
    hashChainSelf,
    createdAt,
  };
}

describe("typology computeEventHash", () => {
  it("produces a 64-char hex sha256 digest", () => {
    const h = computeEventHash(null, eventPayloadForHash(makeInput()), new Date(0));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when payload changes", () => {
    const t = new Date("2025-01-01T00:00:00.000Z");
    const a = computeEventHash(null, eventPayloadForHash(makeInput({ payloadJson: { x: 1 } })), t);
    const b = computeEventHash(null, eventPayloadForHash(makeInput({ payloadJson: { x: 2 } })), t);
    expect(a).not.toBe(b);
  });

  it("changes when prev hash changes", () => {
    const t = new Date("2025-01-01T00:00:00.000Z");
    const a = computeEventHash(null, eventPayloadForHash(makeInput()), t);
    const b = computeEventHash("0".repeat(64), eventPayloadForHash(makeInput()), t);
    expect(a).not.toBe(b);
  });
});

describe("typology verifyChain", () => {
  const t0 = new Date("2025-01-01T00:00:00.000Z");
  const t1 = new Date("2025-01-01T00:00:01.000Z");
  const t2 = new Date("2025-01-01T00:00:02.000Z");

  function buildChain(): MetaConsensusEvent[] {
    const e0 = appendEvent(null, makeInput(), t0, "e0");
    const e1 = appendEvent(
      e0,
      makeInput({ eventType: MetaConsensusEventType.TAG_CONFIRMED, payloadJson: { tagId: "t" } }),
      t1,
      "e1",
    );
    const e2 = appendEvent(
      e1,
      makeInput({ eventType: MetaConsensusEventType.SUMMARY_DRAFTED, payloadJson: { v: 1 } }),
      t2,
      "e2",
    );
    return [e0, e1, e2];
  }

  it("verifies a clean chain", () => {
    expect(verifyChain(buildChain())).toEqual({ valid: true, failedIndex: -1 });
  });

  it("rejects empty chain", () => {
    expect(verifyChain([])).toEqual({ valid: false, failedIndex: -1, reason: "EMPTY" });
  });

  it("rejects when genesis prev is not null", () => {
    const events = buildChain();
    events[0] = { ...events[0], hashChainPrev: "0".repeat(64) };
    expect(verifyChain(events)).toMatchObject({ valid: false, failedIndex: 0 });
  });

  it("detects tampered payload", () => {
    const events = buildChain();
    events[1] = { ...events[1], payloadJson: { tagId: "tampered" } };
    expect(verifyChain(events)).toMatchObject({ valid: false, failedIndex: 1 });
  });

  it("detects out-of-order events", () => {
    const events = buildChain();
    events[1] = { ...events[1], createdAt: new Date(t0.getTime() - 1) };
    expect(verifyChain(events)).toMatchObject({ valid: false, reason: "OUT_OF_ORDER" });
  });

  it("verifyEventHash agrees with verifyChain on clean events", () => {
    for (const e of buildChain()) expect(verifyEventHash(e)).toBe(true);
  });
});
