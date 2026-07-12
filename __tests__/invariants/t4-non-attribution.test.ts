/**
 * T4 Non-Attribution Invariant Tests (Phase 1a)
 *
 * Verifies that the witnessRecord service layer enforces the T4 separation:
 * participantId is stored in WitnessRecord but is NEVER returned by default.
 *
 * §4.2 contract (Session 1 Dev-Spec):
 *   Every response from a dialectical-layer tool MUST NOT include participantId.
 *   Participant identity is surfaced only by:
 *     - get_witnesses     (with includeIdentity: true)
 *     - get_fossil_record (provenance context)
 *     - bind_participant_to_design (write seam, write-time only)
 *
 * Phase 1c/1d will extend this file with per-handler response-shape tests
 * once the MCP tool handlers are wired.
 */

import {
  create,
  findByLudicMoveId,
  fossilize,
  type WitnessRecordPublic,
  type WitnessRecordWithIdentity,
} from "@/server/ludics/witnessRecord";

// ─── Type-level T4 assertions ─────────────────────────────────────────────────
// These compile-time checks fail the build if participantId ever leaks into
// the default public type.

type AssertNoParticipantIdInPublic =
  "participantId" extends keyof WitnessRecordPublic ? never : true;
const _noParticipantIdInPublic: AssertNoParticipantIdInPublic = true;
void _noParticipantIdInPublic;

type AssertParticipantIdInIdentityShape =
  "participantId" extends keyof WitnessRecordWithIdentity ? true : never;
const _participantIdInIdentityShape: AssertParticipantIdInIdentityShape = true;
void _participantIdInIdentityShape;

// ─── Runtime mock setup ───────────────────────────────────────────────────────
// Factory must be self-contained (no closure over hoisted-above-init vars).

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    witnessRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const prismaMock = (jest.requireMock("@/lib/prismaclient") as any).prisma as {
  witnessRecord: {
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
};

beforeEach(() => {
  prismaMock.witnessRecord.create.mockReset();
  prismaMock.witnessRecord.findMany.mockReset();
  prismaMock.witnessRecord.update.mockReset();
  prismaMock.witnessRecord.findUnique.mockReset();
});

// A mock DB row that includes participantId (as stored in the DB)
const mockRow = {
  id: "wit_abc",
  ludicMoveId: "lm_xyz",
  dialogueMoveId: "dm_001",
  participantId: "user_secret_should_not_leak",
  canonicalText: "Carbon taxes reduce emissions.",
  schemeKey: "cause_to_effect",
  timestamp: new Date("2026-05-19T00:00:00Z"),
  fossilizedAt: null,
  retractReason: null,
};

// ─── findByLudicMoveId — T4 enforcement ──────────────────────────────────────

describe("findByLudicMoveId — T4 non-attribution invariant", () => {
  it("returns public shape WITHOUT participantId by default", async () => {
    prismaMock.witnessRecord.findMany.mockResolvedValueOnce([mockRow]);

    const result = await findByLudicMoveId("lm_xyz");

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("participantId");
  });

  it("returns all required public fields", async () => {
    prismaMock.witnessRecord.findMany.mockResolvedValueOnce([mockRow]);

    const result = await findByLudicMoveId("lm_xyz");
    const record = result[0];

    expect(record).toHaveProperty("id", "wit_abc");
    expect(record).toHaveProperty("ludicMoveId", "lm_xyz");
    expect(record).toHaveProperty("dialogueMoveId", "dm_001");
    expect(record).toHaveProperty("timestamp");
    expect(record).toHaveProperty("fossilizedAt", null);
    expect(record).toHaveProperty("retractReason", null);
  });

  it("queries only active records (fossilizedAt: null)", async () => {
    prismaMock.witnessRecord.findMany.mockResolvedValueOnce([]);

    await findByLudicMoveId("lm_xyz");

    expect(prismaMock.witnessRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fossilizedAt: null }),
      }),
    );
  });

  it("returns identity shape WITH participantId when includeIdentity: true", async () => {
    prismaMock.witnessRecord.findMany.mockResolvedValueOnce([mockRow]);

    const result = await findByLudicMoveId("lm_xyz", { includeIdentity: true });

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty(
      "participantId",
      "user_secret_should_not_leak",
    );
  });
});

// ─── create — T4 enforcement ──────────────────────────────────────────────────

describe("create — T4 non-attribution invariant", () => {
  it("create returns public shape WITHOUT participantId", async () => {
    prismaMock.witnessRecord.create.mockResolvedValueOnce(mockRow);

    const result = await create({
      ludicMoveId: "lm_xyz",
      dialogueMoveId: "dm_001",
      participantId: "user_secret_should_not_leak",
      canonicalText: "Carbon taxes reduce emissions.",
      schemeKey: "cause_to_effect",
    });

    expect(result).not.toHaveProperty("participantId");
    expect(result).toHaveProperty("id", "wit_abc");
  });

  it("stores participantId in DB even though it is not returned", async () => {
    prismaMock.witnessRecord.create.mockResolvedValueOnce(mockRow);

    await create({
      ludicMoveId: "lm_xyz",
      dialogueMoveId: "dm_001",
      participantId: "user_secret_should_not_leak",
      canonicalText: "Carbon taxes reduce emissions.",
    });

    expect(prismaMock.witnessRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participantId: "user_secret_should_not_leak",
        }),
      }),
    );
  });
});

// ─── fossilize — T4 enforcement ───────────────────────────────────────────────

describe("fossilize — T4 non-attribution invariant", () => {
  const fossilizedRow = {
    ...mockRow,
    fossilizedAt: new Date("2026-05-19T12:00:00Z"),
    retractReason: "argument_superseded",
  };

  it("fossilize returns public shape WITHOUT participantId", async () => {
    // findUnique short-circuits the idempotence guard to update only when
    // fossilizedAt is null.
    prismaMock.witnessRecord.findUnique.mockResolvedValueOnce({
      ...mockRow,
      fossilizedAt: null,
    });
    prismaMock.witnessRecord.update.mockResolvedValueOnce(fossilizedRow);

    const result = await fossilize("wit_abc", "argument_superseded");

    expect(result).not.toHaveProperty("participantId");
    expect(result).toHaveProperty("fossilizedAt");
    expect(result).toHaveProperty("retractReason", "argument_superseded");
  });
});

// ─── Dialectical-layer tool registry (contract documentation) ─────────────────
// Extended in Phase 1c/1d with per-handler response checks.

describe("T4 — dialectical-layer tool registry", () => {
  const DIALECTICAL_LAYER_TOOLS = [
    "get_exposure_map",
    "get_articulation_lattice",
    "find_minimal_incarnations",
    "find_equivalent_articulations",
    "find_substitute_premises",
    "compress_articulation",
    "compute_articulation_join",
    "get_behaviour_at_locus",
    "get_deliberation_schema",
  ] as const;

  const IDENTITY_PERMITTED_TOOLS = [
    "get_witnesses",
    "get_fossil_record",
    "bind_participant_to_design",
  ] as const;

  it("covers exactly 9 dialectical-layer tools that must never return participantId", () => {
    expect(DIALECTICAL_LAYER_TOOLS).toHaveLength(9);
  });

  it("identity-permitted tools are not in the dialectical-layer list", () => {
    for (const tool of IDENTITY_PERMITTED_TOOLS) {
      expect(DIALECTICAL_LAYER_TOOLS).not.toContain(tool);
    }
  });
});
