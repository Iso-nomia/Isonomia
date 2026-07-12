/**
 * Phase 1b Invariant Tests — bind_participant_to_design write seam
 *
 * Verifies that bindParticipantToDesign correctly:
 *   S1 — rejects missing ludicMoveId with DELOCATION_REQUIRED (409)
 *   S2 — rejects ludicMove with missing deliberationId with DELOCATION_REQUIRED (409)
 *   S3 — rejects malformed canonicalText with CANON_GATE_FAILED (422)
 *   S4 — rejects unknown schemeKey with SCHEME_REQUIRED (422)
 *   S4 — rejects daimon move with missing schemeKey with SCHEME_REQUIRED (422)
 *
 * Happy path: all invariants pass → WitnessRecord written, BindResult returned.
 */

import {
  bindParticipantToDesign,
  BindError,
  type BindResult,
} from "@/server/ludics/bindParticipantToDesign";
import { canonicalizeClaimText } from "@/lib/ids/mintMoid";
import { __resetMemoryRateLimits } from "@/lib/rateLimit";

// ─── Mock setup ──────────────────────────────────────────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    ludicMove: {
      findUnique: jest.fn(),
    },
    argumentScheme: {
      findUnique: jest.fn(),
    },
    witnessRecord: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prismaMock = (jest.requireMock("@/lib/prismaclient") as any).prisma as {
  ludicMove: { findUnique: jest.Mock };
  argumentScheme: { findUnique: jest.Mock };
  witnessRecord: { create: jest.Mock };
  $transaction: jest.Mock;
};

beforeEach(() => {
  prismaMock.ludicMove.findUnique.mockReset();
  prismaMock.argumentScheme.findUnique.mockReset();
  prismaMock.witnessRecord.create.mockReset();
  prismaMock.$transaction.mockReset();

  // WS-2: reset compound rate-limit in-memory buckets between tests so the
  // per-participant 10/min limit does not bleed across cases.
  __resetMemoryRateLimits();

  // Default $transaction: execute the callback and return its result
  prismaMock.$transaction.mockImplementation(async (cb: (tx: any) => any) => {
    const txWitnessRecord = { create: prismaMock.witnessRecord.create };
    return cb({ witnessRecord: txWitnessRecord });
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_LOCUS_MOVE = {
  id: "lm_001",
  deliberationId: "delib_001",
  locus: "0.1",
  moveType: "positive",
};

const VALID_CANONICAL = canonicalizeClaimText("Carbon taxes reduce emissions.");

const BASE_INPUT = {
  dialogueMoveId: "dm_001",
  ludicMoveId: "lm_001",
  participantId: "user_abc",
  canonicalText: VALID_CANONICAL,
};

// ─── S1: DELOCATION_REQUIRED — ludicMoveId not found ───────────────────────────

describe("S1 — existingLocus", () => {
  it("throws DELOCATION_REQUIRED (409) when LudicMove does not exist", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(null);

    await expect(bindParticipantToDesign(BASE_INPUT)).rejects.toMatchObject({
      code: "DELOCATION_REQUIRED",
      status: 409,
    });
  });

  it("throws DELOCATION_REQUIRED (409) when LudicMove has empty locus", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      ...VALID_LOCUS_MOVE,
      locus: "",
    });

    await expect(bindParticipantToDesign(BASE_INPUT)).rejects.toMatchObject({
      code: "DELOCATION_REQUIRED",
      status: 409,
    });
  });
});

// ─── S2: DELOCATION_REQUIRED — deliberationId missing ────────────────────────

describe("S2 — existingStructure", () => {
  it("throws DELOCATION_REQUIRED (409) when LudicMove has no deliberationId", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      ...VALID_LOCUS_MOVE,
      deliberationId: null,
    });

    await expect(bindParticipantToDesign(BASE_INPUT)).rejects.toMatchObject({
      code: "DELOCATION_REQUIRED",
      status: 409,
    });
  });
});

// ─── S3: CANON_GATE_FAILED ────────────────────────────────────────────────────

describe("S3 — canonPipelineGated", () => {
  beforeEach(() => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(VALID_LOCUS_MOVE);
  });

  it("throws CANON_GATE_FAILED (422) when canonicalText is empty", async () => {
    await expect(
      bindParticipantToDesign({ ...BASE_INPUT, canonicalText: "" })
    ).rejects.toMatchObject({ code: "CANON_GATE_FAILED", status: 422 });
  });

  it("throws CANON_GATE_FAILED (422) when canonicalText is raw text (not JSON)", async () => {
    await expect(
      bindParticipantToDesign({ ...BASE_INPUT, canonicalText: "Carbon taxes reduce emissions." })
    ).rejects.toMatchObject({ code: "CANON_GATE_FAILED", status: 422 });
  });

  it("throws CANON_GATE_FAILED (422) when canonicalText is JSON but not {text:…} shape", async () => {
    await expect(
      bindParticipantToDesign({ ...BASE_INPUT, canonicalText: JSON.stringify({ claim: "x" }) })
    ).rejects.toMatchObject({ code: "CANON_GATE_FAILED", status: 422 });
  });

  it("throws CANON_GATE_FAILED (422) when canonicalText is not idempotent under canonicalizeClaimText", async () => {
    // Manually crafted JSON that looks right but has extra whitespace inside
    const notIdempotent = JSON.stringify({ text: "  extra space  " });
    await expect(
      bindParticipantToDesign({ ...BASE_INPUT, canonicalText: notIdempotent })
    ).rejects.toMatchObject({ code: "CANON_GATE_FAILED", status: 422 });
  });

  it("accepts well-formed canonicalText that passes the pipeline", async () => {
    prismaMock.argumentScheme.findUnique.mockResolvedValue(null); // not queried for non-daimon
    prismaMock.witnessRecord.create.mockResolvedValue({
      id: "wit_001",
      ludicMoveId: "lm_001",
      dialogueMoveId: "dm_001",
      participantId: "user_abc",
      canonicalText: VALID_CANONICAL,
      schemeKey: null,
      timestamp: new Date(),
      fossilizedAt: null,
      retractReason: null,
    });

    const result = await bindParticipantToDesign(BASE_INPUT);
    expect(result.invariantChecks.S3_canonPipelineGated).toBe(true);
  });
});

// ─── S4: SCHEME_REQUIRED ─────────────────────────────────────────────────────

describe("S4 — schemeTyped", () => {
  beforeEach(() => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(VALID_LOCUS_MOVE);
  });

  it("throws SCHEME_REQUIRED (422) when schemeKey is not in catalog", async () => {
    prismaMock.argumentScheme.findUnique.mockResolvedValue(null);

    await expect(
      bindParticipantToDesign({ ...BASE_INPUT, schemeKey: "nonexistent_scheme" })
    ).rejects.toMatchObject({ code: "SCHEME_REQUIRED", status: 422 });
  });

  it("throws SCHEME_REQUIRED (422) when moveType=daimon and schemeKey is absent", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      ...VALID_LOCUS_MOVE,
      moveType: "daimon",
    });

    await expect(bindParticipantToDesign(BASE_INPUT)).rejects.toMatchObject({
      code: "SCHEME_REQUIRED",
      status: 422,
    });
  });

  it("accepts a valid schemeKey present in the catalog", async () => {
    prismaMock.argumentScheme.findUnique.mockResolvedValue({ key: "cause_to_effect" });
    prismaMock.witnessRecord.create.mockResolvedValue({
      id: "wit_002",
      ludicMoveId: "lm_001",
      dialogueMoveId: "dm_001",
      participantId: "user_abc",
      canonicalText: VALID_CANONICAL,
      schemeKey: "cause_to_effect",
      timestamp: new Date(),
      fossilizedAt: null,
      retractReason: null,
    });

    const result = await bindParticipantToDesign({
      ...BASE_INPUT,
      schemeKey: "cause_to_effect",
    });
    expect(result.invariantChecks.S4_schemeTyped).toBe(true);
  });

  it("skips the S4 catalog lookup for dialogue-only moves (schemeKey optional)", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue({
      ...VALID_LOCUS_MOVE,
      moveType: "dialogue-only",
    });
    prismaMock.witnessRecord.create.mockResolvedValue({
      id: "wit_003",
      ludicMoveId: "lm_001",
      dialogueMoveId: "dm_001",
      participantId: "user_abc",
      canonicalText: VALID_CANONICAL,
      schemeKey: null,
      timestamp: new Date(),
      fossilizedAt: null,
      retractReason: null,
    });

    const result = await bindParticipantToDesign(BASE_INPUT);
    // S4 passes trivially for dialogue-only; argumentScheme should NOT be queried
    expect(prismaMock.argumentScheme.findUnique).not.toHaveBeenCalled();
    expect(result.invariantChecks.S4_schemeTyped).toBe(true);
  });
});

// ─── Happy path: all invariants pass ─────────────────────────────────────────

describe("happy path", () => {
  it("creates WitnessRecord and returns BindResult with all checks true", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(VALID_LOCUS_MOVE);
    const mockWitness = {
      id: "wit_happy",
      ludicMoveId: "lm_001",
      dialogueMoveId: "dm_001",
      participantId: "user_abc",
      canonicalText: VALID_CANONICAL,
      schemeKey: null,
      timestamp: new Date(),
      fossilizedAt: null,
      retractReason: null,
    };
    prismaMock.witnessRecord.create.mockResolvedValue(mockWitness);

    const result: BindResult = await bindParticipantToDesign(BASE_INPUT);

    expect(result.witnessId).toBe("wit_happy");
    expect(result.ludicMoveId).toBe("lm_001");
    expect(result.dialogueMoveId).toBe("dm_001");
    expect(result.invariantChecks).toEqual({
      S1_existingLocus: true,
      S2_existingStructure: true,
      S3_canonPipelineGated: true,
      S4_schemeTyped: true,
    });

    // participantId must NOT appear in result (T4)
    expect("participantId" in result).toBe(false);
  });

  it("creates WitnessRecord inside a transaction", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(VALID_LOCUS_MOVE);
    prismaMock.witnessRecord.create.mockResolvedValue({
      id: "wit_tx",
      ludicMoveId: "lm_001",
      dialogueMoveId: "dm_001",
      participantId: "user_abc",
      canonicalText: VALID_CANONICAL,
      schemeKey: null,
      timestamp: new Date(),
      fossilizedAt: null,
      retractReason: null,
    });

    await bindParticipantToDesign(BASE_INPUT);

    // $transaction must have been called once
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // witnessRecord.create must be called with participantId (internal storage)
    expect(prismaMock.witnessRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participantId: "user_abc",
          canonicalText: VALID_CANONICAL,
        }),
      })
    );
  });
});

// ─── BindError shape ─────────────────────────────────────────────────────────

describe("BindError", () => {
  it("is an instance of Error", async () => {
    prismaMock.ludicMove.findUnique.mockResolvedValue(null);
    await expect(bindParticipantToDesign(BASE_INPUT)).rejects.toBeInstanceOf(BindError);
    await expect(bindParticipantToDesign(BASE_INPUT)).rejects.toBeInstanceOf(Error);
  });
});
