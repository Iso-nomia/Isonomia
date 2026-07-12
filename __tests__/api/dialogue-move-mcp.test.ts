/**
 * S3 smoke — MCP-enabling POST /api/dialogue/move + the §4 side capability.
 *
 * The route swapped getCurrentUserId → resolveCitationCallerUserId and now
 * namespaces the actor via namespaceForSpeakAs. We short-circuit at validateMove
 * (mocked to reject) so we can capture the exact `actorId` that reaches the
 * protocol validator — the value that drives R3_SELF_REPLY / author-only GROUNDS
 * / per-side commitments — without standing up the whole ludics pipeline.
 *
 * Bonus: confirms the Q5 structured R-code surface (code + reasonCodes) end-to-end.
 */
import { describe, test, expect, beforeEach, beforeAll, jest } from "@jest/globals";

const mockValidateMove = jest.fn(async (_i: any) => ({
  ok: false,
  reasons: ["R3_SELF_REPLY"],
}));
const mockComputeLegalMoves = jest.fn(async (_i: any) => ({ moves: [] as any[], meta: {} }));
const mockGetCommitmentStores = jest.fn(async (_id: string) => ({ data: [] as any[] }));
const mockCheckContradictions = jest.fn((_prop: string, _existing: any[]) => [] as any[]);

jest.mock("@/lib/dialogue/validate", () => ({
  validateMove: (i: any) => mockValidateMove(i),
}));
jest.mock("@/lib/dialogue/legalMovesServer", () => ({
  computeLegalMoves: (i: any) => mockComputeLegalMoves(i),
}));
const mockDialogueMoveUpdate = jest.fn(async (_a: any) => ({}));
const mockConflictAppCreate = jest.fn(async (_a: any) => ({ id: "ca-1" }));
const mockDialogueMoveFindFirst = jest.fn(async (_a: any) => null as any);
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    criticalQuestion: { findUnique: jest.fn(async () => null) },
    argument: {
      findFirst: jest.fn(async () => ({ id: "a" })),
      findUnique: jest.fn(async () => ({ text: "arg text" })),
    },
    claim: {
      findFirst: jest.fn(async () => ({ id: "c" })),
      findUnique: jest.fn(async () => ({ text: "the conceded proposition" })),
    },
    cQStatus: { upsert: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({})) },
    conflictApplication: { create: (a: any) => mockConflictAppCreate(a) },
    dialogueMove: {
      update: (a: any) => mockDialogueMoveUpdate(a),
      findFirst: (a: any) => mockDialogueMoveFindFirst(a),
    },
  },
}));
jest.mock("@/packages/ludics-engine/compileFromMoves", () => ({
  compileFromMoves: jest.fn(async () => {}),
}));
jest.mock("@/packages/ludics-engine/stepper", () => ({
  stepInteraction: jest.fn(async () => null),
}));
jest.mock("@/lib/ludics/syncToAif", () => ({ syncLudicsToAif: jest.fn(async () => {}) }));
jest.mock("@/lib/ludics/createDialogueMove", () => ({
  createDialogueMove: jest.fn(async () => ({ move: { id: "m1" }, deduplicated: false })),
}));
jest.mock("@/lib/ludics/insightsCache", () => ({
  invalidateInsightsCache: jest.fn(async () => {}),
}));
jest.mock("@/lib/issues/hooks", () => ({ onDialogueMove: jest.fn(async () => {}) }));
jest.mock("@/lib/server/bus", () => ({ emitBus: jest.fn() }));
// Deferred-compile enqueue seam (roadmap P4). Mock so the route doesn't pull in
// the real BullMQ queue (which opens a Redis connection at import).
jest.mock("@/lib/ludics/compileQueue", () => ({
  enqueueLudicsCompile: jest.fn(async () => ({ id: "job-1" })),
}));
jest.mock("@/lib/aif/graph-builder", () => ({
  invalidateCommitmentStoresCache: jest.fn(async () => {}),
  getCommitmentStores: (id: string) => mockGetCommitmentStores(id),
}));
jest.mock("@/lib/aif/dialogue-contradictions", () => ({
  checkNewCommitmentContradictions: (p: string, e: any[]) => mockCheckContradictions(p, e),
}));
jest.mock("@/lib/argument/aiAuthoring", () => ({
  recordAiDraftEngagement: jest.fn(async () => {}),
}));
jest.mock("@/lib/schemes/protocol/dialogueHooks", () => ({
  onDialogueMoveForObligations: jest.fn(async () => {}),
}));
// Non-bearer fallback auth resolves to null unless a test overrides it.
jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn(async () => null) }));

import { POST } from "@/app/api/dialogue/move/route";

const TOKEN = "test-mcp-token";
beforeAll(() => {
  process.env.MCP_API_TOKEN = TOKEN;
  delete process.env.MCP_AUTHOR_USER_ID; // → default "mcp-bot"
});

function makeReq(body: any, opts: { bearer?: boolean } = {}) {
  const bearer = opts.bearer ?? true;
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === "authorization" && bearer ? `Bearer ${TOKEN}` : null,
    },
    json: async () => body,
  } as any;
}

const whyBody = (over: Record<string, any> = {}) => ({
  deliberationId: "delib-1",
  targetType: "claim",
  targetId: "claim-1",
  kind: "WHY",
  payload: {},
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockValidateMove.mockResolvedValue({ ok: false, reasons: ["R3_SELF_REPLY"] });
  mockComputeLegalMoves.mockResolvedValue({ moves: [], meta: {} });
  mockGetCommitmentStores.mockResolvedValue({ data: [] });
  mockCheckContradictions.mockReturnValue([]);
  mockDialogueMoveFindFirst.mockResolvedValue(null);
});

describe("POST /api/dialogue/move — requestId idempotency pre-flight (rough-edge b)", () => {
  test("a retry with the same requestId replays the prior move BEFORE re-validating", async () => {
    // The prior GROUNDS already discharged the WHY; without the pre-flight the
    // retry would re-run validateMove and wrongly return R2_NO_OPEN_CQ.
    mockDialogueMoveFindFirst.mockResolvedValue({
      id: "prior-grounds",
      kind: "GROUNDS",
      actorId: "mcp-bot:proponent",
      targetType: "claim",
      targetId: "claim-1",
      payload: { requestId: "req-42" },
      signature: "GROUNDS:claim:claim-1:cq1",
    });
    const res = await POST(
      makeReq(
        whyBody({
          kind: "GROUNDS",
          speakAs: "proponent",
          payload: { cqId: "cq1", expression: "because…", requestId: "req-42" },
        }),
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.idempotentReplay).toBe(true);
    expect(json.move.id).toBe("prior-grounds");
    // Short-circuited before the protocol validator ran.
    expect(mockValidateMove).not.toHaveBeenCalled();
    // Lookup scoped to (deliberationId, actorId, requestId).
    const where = (mockDialogueMoveFindFirst.mock.calls[0] as any[])[0].where;
    expect(where.actorId).toBe("mcp-bot:proponent");
    expect(where.payload).toEqual({ path: ["requestId"], equals: "req-42" });
  });
});

describe("POST /api/dialogue/move — §4 side capability", () => {
  test("MCP bearer + speakAs namespaces the actorId into the validator", async () => {
    const res = await POST(makeReq(whyBody({ speakAs: "opponent" })));
    expect((mockValidateMove.mock.calls[0] as any[])[0].actorId).toBe("mcp-bot:opponent");
  });

  test("MCP bearer without speakAs stays the bare service identity (side opt-in)", async () => {
    await POST(makeReq(whyBody()));
    expect((mockValidateMove.mock.calls[0] as any[])[0].actorId).toBe("mcp-bot");
  });

  test("401 when neither bearer nor session is present (validator never runs)", async () => {
    const res = await POST(makeReq(whyBody({ speakAs: "opponent" }), { bearer: false }));
    expect(res.status).toBe(401);
    expect(mockValidateMove).not.toHaveBeenCalled();
  });
});

describe("POST /api/dialogue/move — WHY-on-argument preserves cqId (bug #1 root cause)", () => {
  test("the auto-CA payload merge keeps cqId/expression (does NOT clobber to just conflictApplicationId)", async () => {
    // A WHY on an argument auto-creates a ConflictApplication and then updates
    // the move's payload to add conflictApplicationId. The bug spread the
    // unselected `move.payload` (undefined) and erased cqId; the fix merges the
    // route's in-scope payload. Assert cqId survives so the WHY is answerable.
    mockValidateMove.mockResolvedValue({ ok: true });
    mockComputeLegalMoves.mockResolvedValue({
      moves: [{ kind: "WHY", payload: {} }],
      meta: {},
    });
    const res = await POST(
      makeReq(
        whyBody({
          targetType: "argument",
          targetId: "arg-1",
          kind: "WHY",
          payload: { cqId: "mcp-why-abcd1234", expression: "why accept this?" },
          speakAs: "opponent",
        }),
      ),
    );
    expect(res.status).toBe(200);
    // The move-payload update must retain cqId, not collapse to { conflictApplicationId }.
    expect(mockDialogueMoveUpdate).toHaveBeenCalled();
    const updated = (mockDialogueMoveUpdate.mock.calls[0] as any[])[0].data.payload;
    expect(updated.cqId).toBe("mcp-why-abcd1234");
    expect(updated.expression).toBe("why accept this?");
    expect(updated.conflictApplicationId).toBe("ca-1");
  });
});

describe("POST /api/dialogue/move — durable write survives autoStep failure (bug #3)", () => {
  test("a committed move returns 200 even if autoStep throws (no 500-after-commit)", async () => {
    // Legal CLOSE move that reaches the write + autoStep. autoStep reads
    // prisma.ludicDesign (absent from this mock → throws); the guard must keep
    // the response 200 because the DialogueMove already committed.
    mockValidateMove.mockResolvedValue({ ok: true });
    mockComputeLegalMoves.mockResolvedValue({
      moves: [{ kind: "CLOSE", payload: { locusPath: "0" } }],
      meta: {},
    });
    const res = await POST(makeReq(whyBody({ kind: "CLOSE", speakAs: "opponent" })));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.move).toBeTruthy(); // the move is present in the response
    expect(json.step).toBeNull(); // stepping failed, but non-fatally
  });
});

describe("POST /api/dialogue/move — Q5 structured R-code surface", () => {
  test("a protocol rejection returns a named code + reasonCodes (not a bare 500)", async () => {
    const res = await POST(makeReq(whyBody({ speakAs: "opponent" })));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.code).toBe("R3_SELF_REPLY");
    expect(json.reasonCodes).toContain("R3_SELF_REPLY");
    expect(typeof json.error).toBe("string"); // human-readable message
  });

  test("R7_ACCEPT_ARGUMENT_REQUIRED echoes the computed postAs hint (S4)", async () => {
    mockValidateMove.mockResolvedValue({
      ok: false,
      reasons: ["R7_ACCEPT_ARGUMENT_REQUIRED"],
    });
    // The route re-runs computeLegalMoves to find the ACCEPT_ARGUMENT postAs target.
    mockComputeLegalMoves.mockResolvedValue({
      moves: [{ kind: "ACCEPT_ARGUMENT", postAs: { targetType: "argument", targetId: "arg-9" } }],
      meta: {},
    });
    const res = await POST(makeReq(whyBody({ kind: "CONCEDE", speakAs: "opponent" })));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe("R7_ACCEPT_ARGUMENT_REQUIRED");
    expect(json.postAs).toEqual({ targetType: "argument", targetId: "arg-9" });
  });
});

describe("POST /api/dialogue/move — MCP CONCEDE contradiction (Q4 fix)", () => {
  // Drive the route past validation to the contradiction check: legal CONCEDE,
  // an existing opponent commitment, and a detected contradiction.
  beforeEach(() => {
    mockValidateMove.mockResolvedValue({ ok: true });
    mockComputeLegalMoves.mockResolvedValue({
      moves: [{ kind: "CONCEDE", payload: { locusPath: "0" } }],
      meta: {},
    });
    mockGetCommitmentStores.mockResolvedValue({
      data: [
        {
          participantId: "mcp-bot:opponent",
          commitments: [
            { isActive: true, claimId: "x", claimText: "not-P", moveId: "m0", moveKind: "ASSERT", timestamp: new Date(1) },
          ],
        },
      ],
    });
  });

  test("a contradictory MCP CONCEDE is surfaced and REFUSED (409, no bypass)", async () => {
    mockCheckContradictions.mockReturnValue([{ conflictWith: "not-P", reason: "negation" }]);
    const res = await POST(makeReq(whyBody({ kind: "CONCEDE", speakAs: "opponent" })));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("CONTRADICTION_DETECTED");
    expect(json.contradictions).toHaveLength(1);
    // The check actually ran for the CONCEDE side's ledger.
    expect(mockCheckContradictions).toHaveBeenCalled();
    expect((mockCheckContradictions.mock.calls[0] as any[])[0]).toBe("the conceded proposition");
  });

  test("the check is keyed on the namespaced side (mcp-bot:opponent's ledger)", async () => {
    mockCheckContradictions.mockReturnValue([{ reason: "x" }]);
    await POST(makeReq(whyBody({ kind: "CONCEDE", speakAs: "opponent" })));
    // The existing commitments passed to the checker came from the opponent store.
    const existing = (mockCheckContradictions.mock.calls[0] as any[])[1];
    expect(existing[0].claimText).toBe("not-P");
  });
});
