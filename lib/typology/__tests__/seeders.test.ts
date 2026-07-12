import { interventionSeeder } from "../seeders/interventionSeeder";
import { metricSeeder } from "../seeders/metricSeeder";
import { repeatedAttackSeeder } from "../seeders/repeatedAttackSeeder";
import { valueLexiconSeeder } from "../seeders/valueLexiconSeeder";
import {
  DisagreementAxisKey,
  DisagreementTagSeedSource,
  DisagreementTagTargetType,
} from "../types";

function fakeEvent(over: Record<string, unknown> = {}): any {
  return {
    id: "fe_1",
    sessionId: "sess_1",
    eventType: "INTERVENTION_APPLIED",
    actorId: "auth_alice",
    actorRole: "facilitator",
    payloadJson: {},
    interventionId: null,
    metricSnapshotId: null,
    createdAt: new Date(),
    ...over,
  };
}

describe("interventionSeeder", () => {
  it("maps PROMPT_EVIDENCE → EMPIRICAL with claim target", () => {
    const out = interventionSeeder.run({
      event: fakeEvent({
        payloadJson: { kind: "PROMPT_EVIDENCE", targetType: "CLAIM", targetId: "c_1" },
      }),
    });
    expect(out).not.toBeNull();
    expect(out!.suggestedAxisKey).toBe(DisagreementAxisKey.EMPIRICAL);
    expect(out!.targetType).toBe(DisagreementTagTargetType.CLAIM);
    expect(out!.targetId).toBe("c_1");
    expect(out!.seedSource).toBe(DisagreementTagSeedSource.INTERVENTION_SEED);
    expect((out!.seedReferenceJson as any).facilitationEventId).toBe("fe_1");
  });

  it("maps ELICIT_UNHEARD → INTEREST", () => {
    const out = interventionSeeder.run({
      event: fakeEvent({ payloadJson: { kind: "ELICIT_UNHEARD" } }),
    });
    expect(out!.suggestedAxisKey).toBe(DisagreementAxisKey.INTEREST);
  });

  it("maps REFRAME_QUESTION → FRAMING", () => {
    const out = interventionSeeder.run({
      event: fakeEvent({ payloadJson: { kind: "REFRAME_QUESTION" } }),
    });
    expect(out!.suggestedAxisKey).toBe(DisagreementAxisKey.FRAMING);
  });

  it("returns null for INVITE_RESPONSE / OTHER / unknown", () => {
    for (const kind of ["INVITE_RESPONSE", "OTHER", "MYSTERY"]) {
      expect(
        interventionSeeder.run({ event: fakeEvent({ payloadJson: { kind } }) }),
      ).toBeNull();
    }
  });

  it("session-scoped (null target) when facilitation target is USER/ROOM", () => {
    const out = interventionSeeder.run({
      event: fakeEvent({
        payloadJson: { kind: "PROMPT_EVIDENCE", targetType: "USER", targetId: "auth_x" },
      }),
    });
    expect(out!.targetType).toBeNull();
    expect(out!.targetId).toBeNull();
  });
});

describe("metricSeeder", () => {
  it("maps CHALLENGE_CONCENTRATION → FRAMING", () => {
    const out = metricSeeder.run({
      event: fakeEvent({
        eventType: "METRIC_THRESHOLD_CROSSED",
        payloadJson: { metricKind: "CHALLENGE_CONCENTRATION", value: 0.78 },
        metricSnapshotId: "snap_1",
      }),
    });
    expect(out).not.toBeNull();
    expect(out!.suggestedAxisKey).toBe(DisagreementAxisKey.FRAMING);
    expect(out!.targetType).toBeNull();
    expect((out!.seedReferenceJson as any).metricSnapshotId).toBe("snap_1");
  });

  it("maps PARTICIPATION_GINI → INTEREST", () => {
    const out = metricSeeder.run({
      event: fakeEvent({
        eventType: "METRIC_THRESHOLD_CROSSED",
        payloadJson: { metricKind: "PARTICIPATION_GINI" },
      }),
    });
    expect(out!.suggestedAxisKey).toBe(DisagreementAxisKey.INTEREST);
  });

  it("returns null for unmapped metrics", () => {
    expect(
      metricSeeder.run({
        event: fakeEvent({
          eventType: "METRIC_THRESHOLD_CROSSED",
          payloadJson: { metricKind: "RESPONSE_LATENCY_P50" },
        }),
      }),
    ).toBeNull();
  });
});

describe("repeatedAttackSeeder.synthesize", () => {
  it("priority 3 when ≥4 distinct authors", () => {
    const out = repeatedAttackSeeder.synthesize({
      targetType: DisagreementTagTargetType.ARGUMENT,
      targetId: "a_1",
      detectorRunId: "run_1",
      attackEdgeIds: ["e1", "e2", "e3", "e4"],
      distinctAuthorCount: 4,
    });
    expect(out.priority).toBe(3);
    expect(out.suggestedAxisKey).toBe(DisagreementAxisKey.EMPIRICAL);
    expect(out.seedSource).toBe(DisagreementTagSeedSource.REPEATED_ATTACK_SEED);
  });

  it("priority 2 when fewer authors", () => {
    const out = repeatedAttackSeeder.synthesize({
      targetType: DisagreementTagTargetType.ARGUMENT,
      targetId: "a_1",
      detectorRunId: "run_1",
      attackEdgeIds: ["e1", "e2"],
      distinctAuthorCount: 2,
    });
    expect(out.priority).toBe(2);
  });
});

describe("valueLexiconSeeder.scan", () => {
  it("hits on word-boundary keywords", () => {
    const out = valueLexiconSeeder.scan({
      targetType: DisagreementTagTargetType.CLAIM,
      targetId: "c_1",
      text: "The proposal is unfair to communities valuing tradition over efficiency.",
    });
    expect(out).not.toBeNull();
    expect(out!.suggestedAxisKey).toBe(DisagreementAxisKey.VALUE);
    expect((out!.seedReferenceJson as any).keywords).toEqual(
      expect.arrayContaining(["tradition", "efficiency"]),
    );
  });

  it("no hits on partial-word matches", () => {
    const out = valueLexiconSeeder.scan({
      targetType: DisagreementTagTargetType.CLAIM,
      targetId: "c_1",
      text: "We need libertarianism, not anarchy.", // contains 'libert' but not the word 'liberty'
    });
    // 'libertarianism' contains 'liberty' as a prefix? no — 'libert' is the prefix.
    // The keyword 'liberty' will not match 'libertarianism' because of \b after 'liberty'.
    expect(out).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(
      valueLexiconSeeder.scan({
        targetType: DisagreementTagTargetType.CLAIM,
        targetId: "c_1",
        text: "   ",
      }),
    ).toBeNull();
  });

  it("emits stable lexiconScanId", () => {
    const a = valueLexiconSeeder.scan({
      targetType: DisagreementTagTargetType.CLAIM,
      targetId: "c_1",
      text: "equity matters",
    });
    const b = valueLexiconSeeder.scan({
      targetType: DisagreementTagTargetType.CLAIM,
      targetId: "c_1",
      text: "equity is central",
    });
    expect((a!.seedReferenceJson as any).lexiconScanId).toBe(
      (b!.seedReferenceJson as any).lexiconScanId,
    );
  });
});
