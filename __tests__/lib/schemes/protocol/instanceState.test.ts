import { projectSchemeInstanceState } from "@/lib/schemes/protocol/instanceState";

// Stub the (write-path) backfill so the projection runs read-only against the
// fake tx; keep every other protocolState export real.
jest.mock("@/lib/schemes/protocol/protocolState", () => ({
  ...jest.requireActual("@/lib/schemes/protocol/protocolState"),
  ensureObligationRowsForInstance: jest.fn(async () => 0),
}));

type CqDef = {
  id: string;
  cqKey: string;
  text: string;
  attackKind: string;
  premiseType: string | null;
  schemeId: string | null;
};

type Obl = {
  cqKey: string;
  status: string;
  burdenOfProof?: string;
  requiresEvidence?: boolean;
  premiseType?: string | null;
  subLocusId?: string | null;
  closingMoveId?: string | null;
  evidenceRefs?: string[];
  updatedAt?: Date;
};

type Instance = {
  id: string;
  schemeId: string;
  status: string;
  closedAt: Date | null;
  scheme: { key: string | null; cqs: CqDef[] };
  obligations: Obl[];
};

function fakeTx(instances: Instance[]) {
  return {
    schemeInstance: {
      findUnique: async ({ where }: any) => {
        const inst = instances.find((i) => i.id === where.id);
        if (!inst) return null;
        return {
          id: inst.id,
          schemeId: inst.schemeId,
          status: inst.status,
          closedAt: inst.closedAt,
          scheme: inst.scheme,
          obligations: inst.obligations.map((o) => ({
            cqKey: o.cqKey,
            status: o.status,
            burdenOfProof: o.burdenOfProof ?? "PROPONENT",
            requiresEvidence: o.requiresEvidence ?? false,
            premiseType: o.premiseType ?? null,
            subLocusId: o.subLocusId ?? null,
            closingMoveId: o.closingMoveId ?? null,
            evidenceRefs: o.evidenceRefs ?? [],
            updatedAt: o.updatedAt ?? new Date("2026-05-30T00:00:00Z"),
          })),
        };
      },
    },
  } as any;
}

const DEF = (cqKey: string, over: Partial<CqDef> = {}): CqDef => ({
  id: `cq_${cqKey}`,
  cqKey,
  text: `Question ${cqKey}?`,
  attackKind: "UNDERCUTS",
  premiseType: null,
  schemeId: "scheme_1",
  ...over,
});

const INSTANCE = (over: Partial<Instance> = {}): Instance => ({
  id: "inst_1",
  schemeId: "scheme_1",
  status: "open",
  closedAt: null,
  scheme: { key: "expert_opinion", cqs: [DEF("cq1"), DEF("cq2")] },
  obligations: [
    { cqKey: "cq1", status: "not-offered" },
    { cqKey: "cq2", status: "not-offered" },
  ],
  ...over,
});

describe("projectSchemeInstanceState (E2)", () => {
  test("missing instance → instance-not-found", async () => {
    const tx = fakeTx([]);
    const res = await projectSchemeInstanceState("nope", tx);
    expect("error" in res && res.error).toBe("instance-not-found");
  });

  test("N open CQs → openObligations=N, none discharged, closeHookEligible=false", async () => {
    const tx = fakeTx([INSTANCE()]);
    const res = await projectSchemeInstanceState("inst_1", tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.status).toBe("open");
    expect(res.openObligations.length).toBe(2);
    expect(res.dischargedObligations.length).toBe(0);
    expect(res.closeHookEligible).toBe(false);
    // projection carries the CQ definition fields.
    const cq1 = res.openObligations.find((o) => o.cqKey === "cq1")!;
    expect(cq1.cqId).toBe("cq_cq1");
    expect(cq1.text).toBe("Question cq1?");
    expect(cq1.attackKind).toBe("UNDERCUTS");
    expect(cq1.isSchemeRequired).toBe(true); // null premiseType → required
    expect(cq1.inheritedFromParentScheme).toBe(false);
  });

  test("all discharged (with evidence where required) → closeHookEligible=true", async () => {
    const tx = fakeTx([
      INSTANCE({
        status: "closed",
        closedAt: new Date("2026-05-31T12:00:00Z"),
        obligations: [
          {
            cqKey: "cq1",
            status: "discharged",
            closingMoveId: "move_a",
            updatedAt: new Date("2026-05-31T11:00:00Z"),
          },
          {
            cqKey: "cq2",
            status: "discharged",
            closingMoveId: "move_b",
            updatedAt: new Date("2026-05-31T11:30:00Z"),
          },
        ],
      }),
    ]);
    const res = await projectSchemeInstanceState("inst_1", tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.status).toBe("closed");
    expect(res.openObligations.length).toBe(0);
    expect(res.dischargedObligations.length).toBe(2);
    expect(res.closeHookEligible).toBe(true);
    const d = res.dischargedObligations.find((o) => o.cqKey === "cq1")!;
    expect(d.dischargedByMoveId).toBe("move_a");
    expect(d.dischargedAt).toBe("2026-05-31T11:00:00.000Z");
    // lastTransitionAt = latest of closedAt / obligation updates.
    expect(res.lastTransitionAt).toBe("2026-05-31T12:00:00.000Z");
  });

  test("Carneades ASSUMPTION auto-waives: not-offered assumption doesn't block close", async () => {
    const tx = fakeTx([
      INSTANCE({
        scheme: {
          key: "expert_opinion",
          cqs: [DEF("cq1", { premiseType: "ASSUMPTION" })],
        },
        obligations: [
          { cqKey: "cq1", status: "not-offered", premiseType: "ASSUMPTION" },
        ],
      }),
    ]);
    const res = await projectSchemeInstanceState("inst_1", tx);
    if ("error" in res) throw new Error("unexpected error");
    // It is still "open" (not-offered) but not scheme-required and not blocking.
    expect(res.openObligations.length).toBe(1);
    expect(res.openObligations[0].isSchemeRequired).toBe(false);
    expect(res.closeHookEligible).toBe(true);
  });

  test("inheritedFromParentScheme=true when the CQ def is anchored on a different scheme", async () => {
    const tx = fakeTx([
      INSTANCE({
        scheme: {
          key: "expert_opinion",
          cqs: [DEF("cq1", { schemeId: "parent_scheme" })],
        },
        obligations: [{ cqKey: "cq1", status: "offered-open" }],
      }),
    ]);
    const res = await projectSchemeInstanceState("inst_1", tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.openObligations[0].inheritedFromParentScheme).toBe(true);
  });

  test("missing evidence on a discharge blocks close (gate reused verbatim)", async () => {
    const tx = fakeTx([
      INSTANCE({
        scheme: { key: "expert_opinion", cqs: [DEF("cq1")] },
        obligations: [
          {
            cqKey: "cq1",
            status: "discharged",
            requiresEvidence: true,
            evidenceRefs: [],
            closingMoveId: "move_a",
          },
        ],
      }),
    ]);
    const res = await projectSchemeInstanceState("inst_1", tx);
    if ("error" in res) throw new Error("unexpected error");
    expect(res.dischargedObligations.length).toBe(1);
    expect(res.closeHookEligible).toBe(false);
  });
});
