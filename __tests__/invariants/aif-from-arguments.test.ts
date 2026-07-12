/**
 * AIF ↔ Argument shape invariant tests
 *
 * For every Argument row in a deliberation, the AIF graph (AifNode + AifEdge)
 * must carry:
 *   • one RA AifNode keyed by dialogueMetadata.argumentId
 *   • one I  AifNode per premise + conclusion claim, keyed by dialogueMetadata.claimId
 *   • one premise edge per ArgumentPremise (I_premise → RA, edgeRole: "premise")
 *   • one conclusion edge (RA → I_conclusion, edgeRole: "conclusion") when
 *     conclusionClaimId is set
 *
 * These tests exercise `syncArgumentToAif` against a mocked prisma client,
 * verifying the contract end-to-end (idempotency, edge shapes, DM-stub
 * creation). Re-runs MUST be no-ops.
 */

import { syncArgumentToAif } from "@/services/aif/syncArgument";

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    argument: { findUnique: jest.fn() },
    claim: { findMany: jest.fn() },
    aifNode: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    aifEdge: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    dialogueMove: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const prismaMock = (jest.requireMock("@/lib/prismaclient") as any).prisma as {
  argument: { findUnique: jest.Mock };
  claim: { findMany: jest.Mock };
  aifNode: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  aifEdge: { findFirst: jest.Mock; create: jest.Mock };
  dialogueMove: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
};

const DELIB = "delib_aif_arg_001";
const ARG_ID = "arg_001";
const C_CONCL = "claim_conclusion";
const C_PREM_A = "claim_premise_a";
const C_PREM_B = "claim_premise_b";
const DM_ID = "dm_assert_001";

function seedArgument() {
  prismaMock.argument.findUnique.mockResolvedValue({
    id: ARG_ID,
    deliberationId: DELIB,
    text: "Carbon taxes reduce emissions because pricing externalities works.",
    schemeId: "expert-opinion",
    conclusionClaimId: C_CONCL,
    premises: [{ claimId: C_PREM_A }, { claimId: C_PREM_B }],
  });
  prismaMock.claim.findMany.mockResolvedValue([
    { id: C_CONCL, text: "Carbon taxes reduce emissions." },
    { id: C_PREM_A, text: "Pricing externalities reduces consumption." },
    { id: C_PREM_B, text: "Emissions are a priced externality under a carbon tax." },
  ]);
  prismaMock.dialogueMove.findMany.mockResolvedValue([{ id: DM_ID }]);
  prismaMock.dialogueMove.findUnique.mockResolvedValue({
    id: DM_ID,
    deliberationId: DELIB,
    kind: "ASSERT",
    actorId: "user_alice",
    createdAt: new Date("2026-05-27T00:00:00Z"),
    aifRepresentation: null,
    replyToMoveId: null,
  });
  prismaMock.dialogueMove.update.mockResolvedValue({});
}

/**
 * Make node lookups return null on the first call (write path) and a sentinel
 * with the created id on subsequent calls (idempotent path).
 */
function makeNodeStore() {
  type Stored = { id: string };
  const byArgRa = new Map<string, Stored>();
  const byClaimI = new Map<string, Stored>();
  const byMoveDm = new Map<string, Stored>();
  const byId = new Map<string, Stored>();

  let createSeq = 0;
  prismaMock.aifNode.findFirst.mockImplementation(async ({ where }: any) => {
    const meta = where?.dialogueMetadata;
    if (where?.nodeKind === "RA" && meta?.path?.[0] === "argumentId") {
      return byArgRa.get(meta.equals) ?? null;
    }
    if (where?.nodeKind === "I" && meta?.path?.[0] === "claimId") {
      return byClaimI.get(meta.equals) ?? null;
    }
    if (where?.nodeKind === "DM" && where?.dialogueMoveId) {
      return byMoveDm.get(where.dialogueMoveId) ?? null;
    }
    return null;
  });
  prismaMock.aifNode.findUnique.mockImplementation(async ({ where }: any) =>
    byId.get(where.id) ?? null,
  );
  prismaMock.aifNode.create.mockImplementation(async ({ data }: any) => {
    const id = `node_${++createSeq}`;
    const stored = { id };
    byId.set(id, stored);
    if (data.nodeKind === "RA") byArgRa.set(data.dialogueMetadata.argumentId, stored);
    else if (data.nodeKind === "I") byClaimI.set(data.dialogueMetadata.claimId, stored);
    else if (data.nodeKind === "DM") byMoveDm.set(data.dialogueMoveId, stored);
    return stored;
  });
  return { byArgRa, byClaimI, byMoveDm };
}

function makeEdgeStore() {
  type Edge = { sourceId: string; targetId: string; edgeRole: string; causedByMoveId: string | null };
  const edges: Edge[] = [];
  prismaMock.aifEdge.findFirst.mockImplementation(async ({ where }: any) => {
    const hit = edges.find(
      (e) =>
        e.sourceId === where.sourceId &&
        e.targetId === where.targetId &&
        e.edgeRole === where.edgeRole &&
        (where.causedByMoveId == null || e.causedByMoveId === where.causedByMoveId),
    );
    return hit ? { id: `e_${edges.indexOf(hit)}` } : null;
  });
  prismaMock.aifEdge.create.mockImplementation(async ({ data }: any) => {
    edges.push({
      sourceId: data.sourceId,
      targetId: data.targetId,
      edgeRole: data.edgeRole,
      causedByMoveId: data.causedByMoveId ?? null,
    });
    return { id: `e_${edges.length - 1}` };
  });
  return edges;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("aif-from-arguments invariants", () => {
  it("creates RA + I nodes and premise/conclusion/asserts edges for an Argument", async () => {
    seedArgument();
    makeNodeStore();
    const edges = makeEdgeStore();

    const r = await syncArgumentToAif({ argumentId: ARG_ID, dialogueMoveId: DM_ID });

    // (a) RA node
    expect(r.raNodeCreated).toBe(true);
    expect(r.raNodeId).toBeTruthy();
    // (b) I nodes — one per unique claim (2 premises + 1 conclusion = 3)
    expect(r.iNodesCreated).toBe(3);
    expect(r.iNodesSkipped).toBe(0);
    // (c) premise edges — one per ArgumentPremise
    expect(r.premiseEdgesCreated).toBe(2);
    // (d) conclusion edge
    expect(r.conclusionEdgesCreated).toBe(1);
    // (e) asserts edge — for the supplied DM
    expect(r.assertsEdgesCreated).toBe(1);
    expect(r.dmStubsCreated).toBe(1);

    // Shape: every premise edge points at the RA with edgeRole='premise'
    const premiseEdges = edges.filter((e) => e.edgeRole === "premise");
    expect(premiseEdges).toHaveLength(2);
    for (const e of premiseEdges) expect(e.targetId).toBe(r.raNodeId);

    // Shape: conclusion edge originates at RA
    const conclEdges = edges.filter((e) => e.edgeRole === "conclusion");
    expect(conclEdges).toHaveLength(1);
    expect(conclEdges[0].sourceId).toBe(r.raNodeId);

    // Shape: asserts edge is causedBy the DM
    const assertEdges = edges.filter((e) => e.edgeRole === "asserts");
    expect(assertEdges).toHaveLength(1);
    expect(assertEdges[0].targetId).toBe(r.raNodeId);
    expect(assertEdges[0].causedByMoveId).toBe(DM_ID);
  });

  it("is idempotent — a second call creates nothing new", async () => {
    seedArgument();
    makeNodeStore();
    makeEdgeStore();

    await syncArgumentToAif({ argumentId: ARG_ID, dialogueMoveId: DM_ID });
    const r2 = await syncArgumentToAif({ argumentId: ARG_ID, dialogueMoveId: DM_ID });

    expect(r2.raNodeCreated).toBe(false);
    expect(r2.iNodesCreated).toBe(0);
    expect(r2.iNodesSkipped).toBe(3);
    expect(r2.premiseEdgesCreated).toBe(0);
    expect(r2.premiseEdgesSkipped).toBe(2);
    expect(r2.conclusionEdgesCreated).toBe(0);
    expect(r2.conclusionEdgesSkipped).toBe(1);
    expect(r2.assertsEdgesCreated).toBe(0);
    expect(r2.assertsEdgesSkipped).toBe(1);
    expect(r2.dmStubsCreated).toBe(0);
  });

  it("dry-run reports counts without writing", async () => {
    seedArgument();
    makeNodeStore();
    const edges = makeEdgeStore();

    const r = await syncArgumentToAif({ argumentId: ARG_ID, dialogueMoveId: DM_ID, dryRun: true });

    expect(r.raNodeCreated).toBe(true);
    expect(r.iNodesCreated).toBe(3);
    expect(r.premiseEdgesCreated).toBe(2);
    expect(r.conclusionEdgesCreated).toBe(1);
    expect(r.assertsEdgesCreated).toBe(1);
    // No actual writes happened.
    expect(prismaMock.aifNode.create).not.toHaveBeenCalled();
    expect(prismaMock.aifEdge.create).not.toHaveBeenCalled();
    expect(edges).toHaveLength(0);
  });

  it("throws when the Argument does not exist", async () => {
    prismaMock.argument.findUnique.mockResolvedValue(null);
    await expect(syncArgumentToAif({ argumentId: "missing" })).rejects.toThrow(
      /Argument not found/,
    );
  });
});
