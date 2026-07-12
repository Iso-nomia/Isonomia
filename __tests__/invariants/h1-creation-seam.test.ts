/**
 * H1 creation seam invariants — `lib/ludics/createDialogueMove`.
 *
 * Validates the contract from
 * `Development and Ideation Documents/ARCHITECTURE/LUDICS_HARMONIZATION_PASS_2_SPRINT_LIST.md` §H1:
 *
 *   • **I-Seam:** every newly-created DialogueMove ends with either a
 *     `WitnessRecord` row or `payload.unbridgeable = { reason }`.
 *   • **I-AIF-min:** when a move targets an `argument`, the AIF write
 *     helper (`services/aif/syncArgument.syncArgumentToAif`) is invoked
 *     with `(argumentId, dialogueMoveId, tx)`.
 *   • Substrate writes are idempotent: re-running the seam on an
 *     existing `(deliberationId, locus)` updates rather than collides;
 *     re-running on an existing `dialogueMoveId` updates the
 *     `WitnessRecord` rather than throwing.
 *   • P2002 collisions on `(deliberationId, signature)` return the
 *     pre-existing row with `deduplicated: true` and SKIP substrate
 *     writes.
 *   • A move with no resolvable locus path is auto-marked
 *     `unbridgeable: { reason: "missing_locus_path" }` and the substrate
 *     plumbing is skipped.
 */

import { Prisma } from "@prisma/client";

// Mock the AIF helper so these tests stay focused on seam plumbing.
// The full AIF contract is exercised in `aif-from-arguments.test.ts`.
jest.mock("@/services/aif/syncArgument", () => ({
  syncArgumentToAif: jest.fn(),
}));

jest.mock("@/lib/prismaclient", () => {
  const dialogueMove = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const behaviour = { upsert: jest.fn() };
  const ludicMove = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const witnessRecord = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  // N-1 capture: the seam atomically upserts an ActProvenance row per move.
  const actProvenance = { upsert: jest.fn() };
  const tx = { dialogueMove, behaviour, ludicMove, witnessRecord, actProvenance };
  return {
    prisma: {
      ...tx,
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    },
  };
});

import { prisma as prismaSingleton } from "@/lib/prismaclient";
import { syncArgumentToAif } from "@/services/aif/syncArgument";
import { createDialogueMove } from "@/lib/ludics/createDialogueMove";

const prismaMock = prismaSingleton as unknown as {
  $transaction: jest.Mock;
  dialogueMove: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  behaviour: { upsert: jest.Mock };
  ludicMove: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  witnessRecord: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  actProvenance: { upsert: jest.Mock };
};
const syncArgumentToAifMock = syncArgumentToAif as jest.MockedFunction<
  typeof syncArgumentToAif
>;

const DELIB = "delib_h1_seam_001";
const ARG_ID = "arg_h1_001";
const ACTOR = "user_h1_alice";

function aifResultStub() {
  return {
    argumentId: ARG_ID,
    deliberationId: DELIB,
    raNodeId: "ra_aif_001",
    raNodeCreated: true,
    iNodesCreated: 2,
    iNodesSkipped: 0,
    premiseEdgesCreated: 2,
    premiseEdgesSkipped: 0,
    conclusionEdgesCreated: 1,
    conclusionEdgesSkipped: 0,
    assertsEdgesCreated: 1,
    assertsEdgesSkipped: 0,
    dmStubsCreated: 0,
  };
}

function freshMocks() {
  jest.clearAllMocks();
  // Default: no existing rows; create paths return synthetic ids.
  prismaMock.dialogueMove.findUnique.mockResolvedValue(null);
  prismaMock.dialogueMove.update.mockResolvedValue({});
  prismaMock.behaviour.upsert.mockResolvedValue({ id: "beh_001" });
  prismaMock.ludicMove.findUnique.mockResolvedValue(null);
  prismaMock.ludicMove.create.mockImplementation(async () => ({
    id: "lm_created_001",
  }));
  prismaMock.ludicMove.update.mockResolvedValue({});
  prismaMock.witnessRecord.findUnique.mockResolvedValue(null);
  prismaMock.witnessRecord.create.mockImplementation(async () => ({
    id: "wr_created_001",
  }));
  prismaMock.witnessRecord.update.mockResolvedValue({});
  syncArgumentToAifMock.mockResolvedValue(aifResultStub());
}

describe("H1 — createDialogueMove seam (I-Seam, I-AIF-min, idempotency)", () => {
  beforeEach(() => {
    freshMocks();
  });

  it("happy path: writes DM + AIF + Behaviour + LudicMove + WitnessRecord in one transaction", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_happy_001",
      signature: "ASSERT:argument:arg_h1_001:cq_default",
      deliberationId: DELIB,
    });

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "ASSERT",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "ASSERT:argument:arg_h1_001:cq_default",
      payload: { expression: "Carbon taxes reduce emissions." },
      locusPath: "0.1",
      argumentId: ARG_ID,
      polarity: "P",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(out.deduplicated).toBe(false);
    expect(out.unbridgeable).toBeNull();
    expect(out.move.id).toBe("dm_happy_001");
    expect(out.aif).toEqual({
      raNodeId: "ra_aif_001",
      assertsEdgesCreated: 1,
      premiseEdgesCreated: 2,
      conclusionEdgesCreated: 1,
    });
    expect(out.ludicMoveId).toBe("lm_created_001");
    expect(out.witnessRecordId).toBe("wr_created_001");

    // I-AIF-min: the helper was invoked with our DM id and tx.
    expect(syncArgumentToAifMock).toHaveBeenCalledTimes(1);
    expect(syncArgumentToAifMock).toHaveBeenCalledWith(
      expect.objectContaining({
        argumentId: ARG_ID,
        dialogueMoveId: "dm_happy_001",
      }),
    );

    // Behaviour upsert keyed on `(deliberationId, rootLocus)`.
    expect(prismaMock.behaviour.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deliberationId_rootLocus: {
            deliberationId: DELIB,
            rootLocus: "⊢A.0",
          },
        },
      }),
    );

    // LudicMove substrate write uses the prefixed locus address.
    expect(prismaMock.ludicMove.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deliberationId: DELIB,
          locus: "⊢A.0.1",
          stratumLabel: "witnessable",
          argumentId: ARG_ID,
        }),
      }),
    );

    // I-Seam: WitnessRecord exists and is bound to the DM.
    expect(prismaMock.witnessRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dialogueMoveId: "dm_happy_001",
          ludicMoveId: "lm_created_001",
          participantId: ACTOR,
        }),
      }),
    );
  });

  it("payload.locusPath is honored when input.locusPath is absent", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_pl_001",
      signature: "GROUNDS:argument:arg_h1_001:cq_default:0.2.3::abcd",
      deliberationId: DELIB,
    });

    await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "GROUNDS",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "GROUNDS:argument:arg_h1_001:cq_default:0.2.3::abcd",
      payload: { locusPath: "0.2.3", expression: "Because pricing works." },
    });

    expect(prismaMock.ludicMove.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locus: "⊢A.0.2.3" }),
      }),
    );
  });

  it("P2002 dedup: returns existing DM, sets deduplicated:true, skips substrate", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "test" } as never,
    );
    prismaMock.dialogueMove.create.mockRejectedValue(p2002);
    prismaMock.dialogueMove.findUnique.mockResolvedValue({
      id: "dm_existing_001",
      signature: "WHY:argument:arg_h1_001:cq_bias",
      deliberationId: DELIB,
    });

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "WHY",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "WHY:argument:arg_h1_001:cq_bias",
      payload: { cqId: "cq_bias" },
      locusPath: "0.1",
    });

    expect(out.deduplicated).toBe(true);
    expect(out.move.id).toBe("dm_existing_001");
    expect(out.ludicMoveId).toBeNull();
    expect(out.witnessRecordId).toBeNull();
    expect(prismaMock.ludicMove.create).not.toHaveBeenCalled();
    expect(prismaMock.ludicMove.update).not.toHaveBeenCalled();
    expect(prismaMock.witnessRecord.create).not.toHaveBeenCalled();
    expect(prismaMock.behaviour.upsert).not.toHaveBeenCalled();
    expect(syncArgumentToAifMock).not.toHaveBeenCalled();
  });

  it("missing locus path: auto-marks payload.unbridgeable and skips substrate", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_nolocus_001",
      signature: "CONCEDE:argument:arg_h1_001:abcd",
      deliberationId: DELIB,
    });

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "CONCEDE",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "CONCEDE:argument:arg_h1_001:abcd",
      payload: { as: "CONCEDE", expression: "OK." },
      // no locusPath, no payload.locusPath
    });

    expect(out.unbridgeable).toEqual({ reason: "missing_locus_path" });
    expect(out.ludicMoveId).toBeNull();
    expect(out.witnessRecordId).toBeNull();

    // The DM was updated to record the unbridgeable marker.
    expect(prismaMock.dialogueMove.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dm_nolocus_001" },
        data: expect.objectContaining({
          payload: expect.objectContaining({
            unbridgeable: { reason: "missing_locus_path" },
          }),
        }),
      }),
    );
    expect(prismaMock.ludicMove.create).not.toHaveBeenCalled();
    expect(prismaMock.witnessRecord.create).not.toHaveBeenCalled();
  });

  it("caller-supplied unbridgeable: writes the marker, skips substrate, still runs AIF", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_unbr_001",
      signature: "ASSERT:argument:arg_h1_001:explicit",
      deliberationId: DELIB,
    });

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "ASSERT",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "ASSERT:argument:arg_h1_001:explicit",
      locusPath: "0.1",
      unbridgeable: { reason: "cross_scope" },
    });

    expect(out.unbridgeable).toEqual({ reason: "cross_scope" });
    expect(out.ludicMoveId).toBeNull();
    expect(out.witnessRecordId).toBeNull();

    // Marker was persisted on the initial create (not a follow-up update).
    expect(prismaMock.dialogueMove.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            unbridgeable: { reason: "cross_scope" },
          }),
        }),
      }),
    );
    // AIF still ran (per spec — the move is still a real DM).
    expect(syncArgumentToAifMock).toHaveBeenCalledTimes(1);
    // Substrate suppressed.
    expect(prismaMock.behaviour.upsert).not.toHaveBeenCalled();
    expect(prismaMock.ludicMove.create).not.toHaveBeenCalled();
    expect(prismaMock.witnessRecord.create).not.toHaveBeenCalled();
  });

  it("idempotent re-run: existing LudicMove + WitnessRecord trigger updates, not creates", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_idem_001",
      signature: "GROUNDS:argument:arg_h1_001:cq_default:0.1::ef01",
      deliberationId: DELIB,
    });
    prismaMock.ludicMove.findUnique.mockResolvedValue({ id: "lm_pre_001" });
    prismaMock.witnessRecord.findUnique.mockResolvedValue({ id: "wr_pre_001" });

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "GROUNDS",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "GROUNDS:argument:arg_h1_001:cq_default:0.1::ef01",
      payload: { locusPath: "0.1", expression: "Because." },
    });

    expect(out.ludicMoveId).toBe("lm_pre_001");
    expect(out.witnessRecordId).toBe("wr_pre_001");
    expect(prismaMock.ludicMove.create).not.toHaveBeenCalled();
    expect(prismaMock.witnessRecord.create).not.toHaveBeenCalled();
    expect(prismaMock.ludicMove.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "lm_pre_001" } }),
    );
    expect(prismaMock.witnessRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wr_pre_001" } }),
    );
  });

  it("non-argument target: skips AIF helper, still writes substrate", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_claim_001",
      signature: "CONCEDE:claim:claim_x:ab12",
      deliberationId: DELIB,
    });

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "CONCEDE",
      targetType: "claim",
      targetId: "claim_x",
      signature: "CONCEDE:claim:claim_x:ab12",
      locusPath: "0.4",
      payload: { as: "CONCEDE", expression: "Fine." },
    });

    expect(syncArgumentToAifMock).not.toHaveBeenCalled();
    expect(out.aif).toBeNull();
    expect(out.witnessRecordId).toBe("wr_created_001");
    expect(out.ludicMoveId).toBe("lm_created_001");
  });

  it("syncAif=false: skips AIF helper even for argument-targeted moves", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_nosync_001",
      signature: "ASSERT:argument:arg_h1_001:nosync",
      deliberationId: DELIB,
    });

    const out = await createDialogueMove(
      {
        deliberationId: DELIB,
        actorId: ACTOR,
        kind: "ASSERT",
        targetType: "argument",
        targetId: ARG_ID,
        signature: "ASSERT:argument:arg_h1_001:nosync",
        locusPath: "0.5",
      },
      { syncAif: false },
    );

    expect(syncArgumentToAifMock).not.toHaveBeenCalled();
    expect(out.aif).toBeNull();
    expect(out.witnessRecordId).toBe("wr_created_001");
  });

  it("AIF helper failure does NOT break the DM/substrate write (logged, not thrown)", async () => {
    prismaMock.dialogueMove.create.mockResolvedValue({
      id: "dm_aiferr_001",
      signature: "ASSERT:argument:arg_h1_001:aiferr",
      deliberationId: DELIB,
    });
    syncArgumentToAifMock.mockRejectedValue(new Error("AIF down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const out = await createDialogueMove({
      deliberationId: DELIB,
      actorId: ACTOR,
      kind: "ASSERT",
      targetType: "argument",
      targetId: ARG_ID,
      signature: "ASSERT:argument:arg_h1_001:aiferr",
      locusPath: "0.6",
    });

    expect(out.aif).toBeNull();
    expect(out.witnessRecordId).toBe("wr_created_001");
    expect(warn).toHaveBeenCalledWith(
      "[createDialogueMove] AIF sync failed:",
      expect.stringContaining("AIF down"),
    );
    warn.mockRestore();
  });

  it("moveType selection: WHY→negative, ASSERT→positive, DAIMON→daimon", async () => {
    const cases: Array<{
      kind: string;
      polarity?: "P" | "O";
      expected: "positive" | "negative" | "daimon";
    }> = [
      { kind: "WHY", expected: "negative" },
      { kind: "ATTACK", expected: "negative" },
      { kind: "ASSERT", expected: "positive" },
      { kind: "GROUNDS", expected: "positive" },
      { kind: "DAIMON", expected: "daimon" },
      { kind: "CLOSE", expected: "daimon" },
      { kind: "ASSERT", polarity: "O", expected: "negative" },
    ];

    for (const c of cases) {
      freshMocks();
      prismaMock.dialogueMove.create.mockResolvedValue({
        id: `dm_${c.kind}_${c.polarity ?? "x"}`,
        signature: `${c.kind}:argument:arg_h1_001:case`,
        deliberationId: DELIB,
      });
      await createDialogueMove({
        deliberationId: DELIB,
        actorId: ACTOR,
        kind: c.kind,
        targetType: "argument",
        targetId: ARG_ID,
        signature: `${c.kind}:argument:arg_h1_001:case`,
        locusPath: "0.9",
        polarity: c.polarity ?? null,
      });
      expect(prismaMock.ludicMove.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ moveType: c.expected }),
        }),
      );
    }
  });
});
