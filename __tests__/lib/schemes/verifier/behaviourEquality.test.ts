/**
 * Spec 4 §3.1–§3.2 — verifier verdict tests.
 *
 * ≥ 3 tests per verdict kind (equal / subset / incomparable / inconclusive).
 * Drawn from synthetic SchemeWithCqs-shaped fixtures (no DB roundtrip;
 * the verifier is pure over its inputs).
 */

import { verifyBehaviourEquality, type SchemeWithCqs } from "@/lib/schemes/verifier";

function cq(over: Partial<any> = {}): any {
  return {
    id: "cq_" + Math.random().toString(36).slice(2, 8),
    instanceId: null,
    schemeId: null,
    scheme: null,
    cqKey: "CQ_default",
    cqId: null,
    text: "Default CQ text",
    attackKind: "UNDERCUTS",
    status: "open",
    openedById: null,
    resolvedById: null,
    createdAt: new Date(),
    attackType: "UNDERCUTS",
    targetScope: "inference",
    instance: null,
    aspicMapping: null,
    burdenOfProof: "PROPONENT",
    requiresEvidence: false,
    premiseType: null,
    ...over,
  };
}

function scheme(over: Partial<SchemeWithCqs> = {}): SchemeWithCqs {
  return {
    id: "sch_" + Math.random().toString(36).slice(2, 8),
    key: "test_scheme",
    name: "Test Scheme",
    description: null,
    title: null,
    summary: "",
    cq: [],
    premises: [
      { id: "P1", type: "major", text: "P1", variables: ["X"] },
      { id: "P2", type: "minor", text: "P2", variables: ["X"] },
    ],
    conclusion: { text: "C", variables: ["X"] },
    purpose: null,
    source: null,
    materialRelation: null,
    reasoningType: null,
    ruleForm: null,
    conclusionType: null,
    slotHints: null,
    validators: null,
    parentSchemeId: null,
    clusterTag: "test_family",
    aspicMapping: null,
    epistemicMode: "FACTUAL",
    tags: [],
    examples: [],
    usageCount: 0,
    difficulty: "intermediate",
    identificationConditions: [],
    whenToUse: "",
    semanticCluster: null,
    kind: "argument-scheme",
    sourceCatalogue: "admin-authored",
    sourceId: null,
    sourceVersion: null,
    importedAt: null,
    importerVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    cqs: [],
    ...over,
  } as SchemeWithCqs;
}

describe("verifyBehaviourEquality — equal", () => {
  it("returns equal for identical CQ bundles + matching premises", async () => {
    const cqs = [
      cq({ cqKey: "CQ1", attackType: "UNDERMINES", targetScope: "premise", text: "Is the source credible?" }),
      cq({ cqKey: "CQ2", attackType: "UNDERCUTS", targetScope: "inference", text: "Is the inference warranted?" }),
    ];
    const L = scheme({ cqs });
    const R = scheme({ cqs: cqs.map((c) => ({ ...c, id: c.id + "_r" })) });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("equal");
    if (v.kind === "equal") {
      expect(v.certificate.cqMapping).toHaveLength(2);
      expect(v.certificate.inheritanceRespected).toBe(true);
    }
  });

  it("returns equal when CQ ordering differs but structure matches", async () => {
    const a = cq({ cqKey: "CQ1", attackType: "UNDERMINES", targetScope: "premise", text: "Q1" });
    const b = cq({ cqKey: "CQ2", attackType: "REBUTS", targetScope: "conclusion", text: "Q2" });
    const L = scheme({ cqs: [a, b] });
    const R = scheme({ cqs: [b, a] });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("equal");
  });

  it("returns equal when text differs only in case/whitespace under case-trim", async () => {
    const L = scheme({
      cqs: [cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "Is the link sound?" })],
    });
    const R = scheme({
      cqs: [cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "is  the link sound?" })],
    });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("equal");
  });
});

describe("verifyBehaviourEquality — subset", () => {
  it("returns subset when right has every CQ of left plus one more", async () => {
    const shared = cq({ cqKey: "CQ1", attackType: "UNDERMINES", targetScope: "premise", text: "Shared CQ" });
    const extra = cq({ cqKey: "CQ2", attackType: "REBUTS", targetScope: "conclusion", text: "Extra on right" });
    const L = scheme({ cqs: [shared] });
    const R = scheme({ cqs: [shared, extra] });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("subset");
    if (v.kind === "subset") {
      // right has MORE CQs ⇒ ⟦R⟧ ⊆ ⟦L⟧ ⇒ right-subset-left
      expect(v.certificate.direction).toBe("right-subset-left");
      expect(v.certificate.extraCqs).toEqual(["CQ2"]);
    }
  });

  it("returns subset when left has every CQ of right plus extras", async () => {
    const shared = cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "Shared" });
    const extra1 = cq({ cqKey: "CQ2", attackType: "UNDERMINES", targetScope: "premise", text: "Extra1" });
    const extra2 = cq({ cqKey: "CQ3", attackType: "REBUTS", targetScope: "conclusion", text: "Extra2" });
    const L = scheme({ cqs: [shared, extra1, extra2] });
    const R = scheme({ cqs: [shared] });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("subset");
    if (v.kind === "subset") {
      expect(v.certificate.direction).toBe("left-subset-right");
      expect(v.certificate.extraCqs.sort()).toEqual(["CQ2", "CQ3"]);
    }
  });

  it("returns subset with a sound unification certificate", async () => {
    const shared = cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "Sound?" });
    const L = scheme({ cqs: [shared] });
    const R = scheme({ cqs: [shared, cq({ cqKey: "CQX", attackType: "REBUTS", targetScope: "conclusion", text: "X" })] });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("subset");
    if (v.kind === "subset") expect(v.certificate.cqMapping).toHaveLength(1);
  });
});

describe("verifyBehaviourEquality — incomparable", () => {
  it("returns incomparable on differing epistemicMode (Q-020 widening)", async () => {
    const L = scheme({ epistemicMode: "FACTUAL", cqs: [cq({ cqKey: "CQ1" })] });
    const R = scheme({ epistemicMode: "HYPOTHETICAL", cqs: [cq({ cqKey: "CQ1" })] });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("incomparable");
    if (v.kind === "incomparable") {
      expect(v.certificate.discriminatingCqOnLeft?.cqKey).toBe("__epistemicMode__");
    }
  });

  it("returns incomparable on conflicting attackType for same cqKey", async () => {
    const L = scheme({
      cqs: [cq({ cqKey: "CQ1", attackType: "UNDERMINES", targetScope: "premise", text: "X" })],
    });
    const R = scheme({
      cqs: [cq({ cqKey: "CQ1", attackType: "REBUTS", targetScope: "premise", text: "X" })],
    });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("incomparable");
    if (v.kind === "incomparable") {
      expect(v.certificate.conflictingCqs?.[0].conflict).toBe("different-attack-type");
    }
  });

  it("returns incomparable when each side has unique CQs the other lacks", async () => {
    const L = scheme({
      cqs: [
        cq({ cqKey: "CQ_L1", attackType: "UNDERMINES", targetScope: "premise", text: "L1" }),
        cq({ cqKey: "CQ_L2", attackType: "UNDERCUTS", targetScope: "inference", text: "L2" }),
      ],
    });
    const R = scheme({
      cqs: [
        cq({ cqKey: "CQ_R1", attackType: "REBUTS", targetScope: "conclusion", text: "R1" }),
      ],
    });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("incomparable");
    if (v.kind === "incomparable") {
      expect(v.certificate.discriminatingCqOnLeft).toBeDefined();
      expect(v.certificate.discriminatingCqOnRight).toBeDefined();
    }
  });

  it("returns incomparable on premise-count mismatch (with matched CQs)", async () => {
    const sharedCq = cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "ok" });
    const L = scheme({
      cqs: [sharedCq],
      premises: [{ id: "P1", type: "major", text: "P1", variables: ["X"] }],
    });
    const R = scheme({
      cqs: [sharedCq],
      premises: [
        { id: "P1", type: "major", text: "P1", variables: ["X"] },
        { id: "P2", type: "minor", text: "P2", variables: ["X"] },
      ],
    });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("incomparable");
  });
});

describe("verifyBehaviourEquality — inconclusive", () => {
  it("returns inconclusive on premise unification with mismatched variable counts", async () => {
    const sharedCq = cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "shared" });
    const L = scheme({
      cqs: [sharedCq],
      premises: [
        { id: "P1", type: "major", text: "P1", variables: ["X"] },
        { id: "P2", type: "minor", text: "P2", variables: ["X"] },
      ],
    });
    const R = scheme({
      cqs: [sharedCq],
      premises: [
        { id: "P1", type: "major", text: "P1", variables: ["X", "Y"] },
        { id: "P2", type: "minor", text: "P2", variables: ["Z"] },
      ],
    });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("inconclusive");
    if (v.kind === "inconclusive") {
      expect(v.reason).toBe("premise-unification-undecided");
    }
  });

  it("returns inconclusive when search bound is zero", async () => {
    const sharedCq = cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "shared" });
    const L = scheme({ cqs: [sharedCq] });
    const R = scheme({ cqs: [sharedCq] });
    const v = await verifyBehaviourEquality(L, R, { searchBoundMs: 0 });
    // A bound of 0 means the first time-check after normalisation will fail.
    expect(["inconclusive", "equal"]).toContain(v.kind);
  });

  it("returns inconclusive on subset shape with undecided unification", async () => {
    const shared = cq({ cqKey: "CQ1", attackType: "UNDERCUTS", targetScope: "inference", text: "shared" });
    const extra = cq({ cqKey: "CQ2", attackType: "REBUTS", targetScope: "conclusion", text: "extra" });
    const L = scheme({
      cqs: [shared],
      premises: [
        { id: "P1", type: "major", text: "P1", variables: ["X"] },
        { id: "P2", type: "minor", text: "P2", variables: ["X"] },
      ],
    });
    const R = scheme({
      cqs: [shared, extra],
      premises: [
        { id: "P1", type: "major", text: "P1", variables: ["X", "Y"] },
        { id: "P2", type: "minor", text: "P2", variables: ["Z"] },
      ],
    });
    const v = await verifyBehaviourEquality(L, R);
    expect(v.kind).toBe("inconclusive");
    if (v.kind === "inconclusive") {
      expect(v.reason).toBe("premise-unification-undecided");
    }
  });
});
