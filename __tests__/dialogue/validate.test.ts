/**
 * S7 — protocol validator R-codes (lib/dialogue/validate.ts). This is the
 * function whose verdicts /api/dialogue/move relays to the MCP agent as the
 * structured `code` (post_dialogue_move's whole feedback loop). Unit-tested
 * against a mocked prisma so each R-code path is pinned.
 *
 * Also pins the §4 claim that a DIFFERENT speakAs (→ different actorId) avoids
 * R3_SELF_REPLY, which is what lets an agent legally challenge its own argument.
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockFindUnique = jest.fn(async (_a: any) => null as any);
const mockFindMany = jest.fn(async (_a: any) => [] as any[]);
const mockFindFirst = jest.fn(async (_a: any) => null as any);

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    dialogueMove: {
      findUnique: (a: any) => mockFindUnique(a),
      findMany: (a: any) => mockFindMany(a),
      findFirst: (a: any) => mockFindFirst(a),
    },
  },
}));

import { validateMove } from "@/lib/dialogue/validate";

const base = {
  deliberationId: "d1",
  targetType: "claim" as const,
  targetId: "c1",
  payload: {} as any,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUnique.mockResolvedValue(null);
  mockFindMany.mockResolvedValue([]);
  mockFindFirst.mockResolvedValue(null);
});

describe("validateMove — R3_SELF_REPLY (§4 side distinction)", () => {
  test("replying to your OWN move on the same side → R3", async () => {
    mockFindUnique.mockResolvedValue({ actorId: "mcp-bot:proponent", kind: "WHY" });
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot:proponent",
      kind: "CONCEDE",
      replyToMoveId: "m-parent",
      targetType: "argument",
    });
    expect(res).toEqual({ ok: false, reasons: expect.arrayContaining(["R3_SELF_REPLY"]) });
  });

  test("replying as a DIFFERENT speakAs → no R3 (steelmanning works)", async () => {
    mockFindUnique.mockResolvedValue({ actorId: "mcp-bot:proponent", kind: "WHY" });
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot:opponent", // different side → different actorId
      kind: "CONCEDE",
      replyToMoveId: "m-parent",
      targetType: "argument",
    });
    expect(res).toEqual({ ok: true });
  });
});

describe("validateMove — GROUNDS obligations", () => {
  test("GROUNDS with no matching open WHY → R2_NO_OPEN_CQ", async () => {
    mockFindMany.mockResolvedValue([]); // no prior WHY/GROUNDS
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot",
      kind: "GROUNDS",
      payload: { cqId: "cq1" }, // cqId → isCQMove, so R5 is skipped
    });
    expect(res).toEqual({ ok: false, reasons: expect.arrayContaining(["R2_NO_OPEN_CQ"]) });
  });
});

describe("validateMove — R7_ACCEPT_ARGUMENT_REQUIRED (fallback)", () => {
  test("CONCEDE on a claim already answered by GROUNDS → R7", async () => {
    mockFindMany.mockResolvedValue([
      { kind: "WHY", payload: { cqId: "k1" }, createdAt: new Date(1000) },
      { kind: "GROUNDS", payload: { cqId: "k1" }, createdAt: new Date(2000) },
    ]);
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot",
      kind: "CONCEDE",
      targetType: "claim", // fallback requires a claim target + no replyToMoveId
    });
    expect(res).toEqual({
      ok: false,
      reasons: expect.arrayContaining(["R7_ACCEPT_ARGUMENT_REQUIRED"]),
    });
  });
});

describe("validateMove — surrender / duplicate / discharge", () => {
  test("a non-CQ WHY after a CLOSE/CONCEDE terminator → R5_AFTER_SURRENDER", async () => {
    mockFindFirst.mockImplementation(async (a: any) =>
      a?.where?.OR ? { id: "term" } : null,
    );
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot",
      kind: "WHY",
      payload: {}, // no cqId/schemeKey → NOT a CQ move → R5 branch active
    });
    expect(res).toEqual({ ok: false, reasons: expect.arrayContaining(["R5_AFTER_SURRENDER"]) });
  });

  test("a WHY whose signature already exists → R4_DUPLICATE_REPLY", async () => {
    mockFindFirst.mockImplementation(async (a: any) =>
      a?.where?.signature ? { id: "dup" } : null,
    );
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot",
      kind: "WHY",
      payload: { cqId: "c1" }, // isCQMove → R5 skipped, isolates R4
    });
    expect(res).toEqual({ ok: false, reasons: expect.arrayContaining(["R4_DUPLICATE_REPLY"]) });
  });

  test("DISCHARGE with no open SUPPOSE at the locus → R8_NO_OPEN_SUPPOSE", async () => {
    mockFindFirst.mockResolvedValue(null); // no SUPPOSE
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot",
      kind: "DISCHARGE",
      payload: { locusPath: "0" },
    });
    expect(res).toEqual({ ok: false, reasons: expect.arrayContaining(["R8_NO_OPEN_SUPPOSE"]) });
  });
});

describe("validateMove — legal move", () => {
  test("a RETRACT with no threaded reply is legal → { ok: true }", async () => {
    const res = await validateMove({
      ...base,
      actorId: "mcp-bot",
      kind: "RETRACT",
      targetType: "argument",
    });
    expect(res).toEqual({ ok: true });
  });
});
