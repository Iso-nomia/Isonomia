/**
 * S2 smoke — MCP-enabling POST /api/ca (attack_argument write seam).
 * Handler tests under the mocked-prisma harness (mirrors ca-ratify.test.ts).
 *
 * Covers the new paths added in S2:
 *  · MCP bearer resolves the caller to `mcp-bot` (no session cookie);
 *  · ratificationStatus is actor-agnostic — EFFECTIVE under policy `none`,
 *    PROPOSED under a gating policy (so mcp-bot lands "filed, pending sign-off");
 *  · additive response fields (conflictApplicationId, attackMoveId, ratificationStatus);
 *  · requestId idempotency — a replay returns the prior CA and does NOT re-create;
 *  · requestId is stored in metaJson on a fresh create;
 *  · 401 when neither bearer nor session is present.
 */
import { describe, test, expect, beforeEach, beforeAll, jest } from "@jest/globals";

const mockCAFindFirst = jest.fn(async (_a: any) => null as any);
const mockCACreate = jest.fn(async (_a: any) => ({ id: "ca-new" }));
const mockCAUpdate = jest.fn(async (_a: any) => ({}));
const mockArgFind = jest.fn(async (_a: any) => ({ authorId: "human-author" }));
const mockClaimFind = jest.fn(async (_a: any) => ({ createdById: "human-author" }));
const mockCqUpdateMany = jest.fn(async (_a: any) => ({}));
const mockArgEdgeCreate = jest.fn(async (_a: any) => ({}));
const mockResolvePolicy = jest.fn(async (_a: any) => ({ kind: "none" } as any));
const mockCreateDialogueMove = jest.fn(async (_a: any) => ({ move: { id: "move-1" } }));

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    conflictApplication: {
      findFirst: (a: any) => mockCAFindFirst(a),
      create: (a: any) => mockCACreate(a),
      update: (a: any) => mockCAUpdate(a),
    },
    argument: { findUnique: (a: any) => mockArgFind(a) },
    claim: { findUnique: (a: any) => mockClaimFind(a) },
    cQStatus: { updateMany: (a: any) => mockCqUpdateMany(a) },
    argumentEdge: { create: (a: any) => mockArgEdgeCreate(a) },
  },
}));
jest.mock("@/lib/ludics/createDialogueMove", () => ({
  createDialogueMove: (a: any) => mockCreateDialogueMove(a),
}));
jest.mock("@/packages/ludics-engine/compileFromMoves", () => ({
  compileFromMoves: jest.fn(async () => {}),
}));
jest.mock("@/lib/ludics/syncToAif", () => ({ syncLudicsToAif: jest.fn(async () => {}) }));
jest.mock("@/lib/ludics/insightsCache", () => ({
  invalidateInsightsCache: jest.fn(async () => {}),
}));
jest.mock("@/lib/aspic/conflictHelpers", () => ({
  computeAspicConflictMetadata: jest.fn(() => ({
    aspicAttackType: null,
    aspicDefeatStatus: null,
    aspicMetadata: null,
  })),
}));
jest.mock("@/lib/aspic/ratification/policy", () => ({
  resolveRatificationPolicy: (a: any) => mockResolvePolicy(a),
}));
jest.mock("@/lib/actions/notification.actions", () => ({
  createRatificationNeededNotif: jest.fn(async () => {}),
}));
const mockMintObjection = jest.fn(async (_a: any) => ({ id: "obj-1" }));
jest.mock("@/lib/claims/mintObjectionClaim", () => ({
  mintObjectionClaim: (a: any) => mockMintObjection(a),
}));
const mockRateLimit = jest.fn(async () => true);
jest.mock("@/lib/rateLimit", () => ({ rateLimit: (...a: any[]) => mockRateLimit(...a) }));
// Deferred-compile enqueue seam (roadmap P4). Mock so the route doesn't pull in
// the real BullMQ queue (which opens a Redis connection at import).
const mockEnqueueCompile = jest.fn(async () => ({ id: "job-1" }));
jest.mock("@/lib/ludics/compileQueue", () => ({
  enqueueLudicsCompile: (...a: any[]) => mockEnqueueCompile(...a),
}));
// Fallback (non-bearer) auth path resolves to null unless a test overrides it.
jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn(async () => null) }));

import { POST } from "@/app/api/ca/route";

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

const baseBody = {
  deliberationId: "delib-123456",
  conflictingClaimId: "objection-claim-1",
  conflictedArgumentId: "target-arg-1",
  legacyAttackType: "REBUTS",
  legacyTargetScope: "conclusion",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCAFindFirst.mockResolvedValue(null);
  mockCACreate.mockResolvedValue({ id: "ca-new" });
  mockResolvePolicy.mockResolvedValue({ kind: "none" });
  mockCreateDialogueMove.mockResolvedValue({ move: { id: "move-1" } });
  mockMintObjection.mockResolvedValue({ id: "obj-1" });
  mockRateLimit.mockResolvedValue(true);
});

describe("POST /api/ca — MCP bearer auth", () => {
  test("resolves the caller to mcp-bot and returns additive fields (policy none → EFFECTIVE)", async () => {
    const res = await POST(makeReq(baseBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      id: "ca-new",
      conflictApplicationId: "ca-new",
      attackMoveId: "move-1",
      ratificationStatus: "EFFECTIVE",
    });
    expect((mockCACreate.mock.calls[0] as any[])[0].data.createdById).toBe("mcp-bot");
  });

  test("401 when neither bearer nor session is present", async () => {
    const res = await POST(makeReq(baseBody, { bearer: false }));
    expect(res.status).toBe(401);
    expect(mockCACreate).not.toHaveBeenCalled();
  });

  test("speakAs namespaces the attacker into mcp-bot:<side> (§4)", async () => {
    const res = await POST(makeReq({ ...baseBody, speakAs: "opponent" }));
    expect(res.status).toBe(200);
    expect((mockCACreate.mock.calls[0] as any[])[0].data.createdById).toBe("mcp-bot:opponent");
  });

  test("MCP branch enqueues a deferred compile instead of compiling inline (P4)", async () => {
    await POST(makeReq(baseBody));
    expect(mockEnqueueCompile).toHaveBeenCalledWith("delib-123456");
  });
});

describe("POST /api/ca — groundsText mint (attack_argument)", () => {
  const grounds = {
    deliberationId: "delib-123456",
    conflictedArgumentId: "target-arg-1",
    legacyAttackType: "REBUTS",
    legacyTargetScope: "conclusion",
    groundsText: "The cited study was retracted, so the conclusion is unsupported.",
  };

  test("mints an objection claim and uses it as the conflicting side", async () => {
    const res = await POST(makeReq(grounds));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.objectionClaimId).toBe("obj-1");
    // Minted claim authored by the namespaced caller, in the deliberation.
    expect((mockMintObjection.mock.calls[0] as any[])[0]).toMatchObject({
      text: grounds.groundsText,
      createdById: "mcp-bot",
      deliberationId: "delib-123456",
      moidPrefix: "attack-objection",
    });
    // The CA is filed with the minted claim as the conflicting element.
    expect((mockCACreate.mock.calls[0] as any[])[0].data.conflictingClaimId).toBe("obj-1");
  });

  test("does NOT mint when an explicit attacker node is supplied", async () => {
    await POST(makeReq({ ...grounds, conflictingClaimId: "existing-claim", groundsText: undefined }));
    expect(mockMintObjection).not.toHaveBeenCalled();
    expect((mockCACreate.mock.calls[0] as any[])[0].data.conflictingClaimId).toBe("existing-claim");
  });

  test("replay does NOT mint a duplicate objection claim, and echoes objectionClaimId", async () => {
    mockCAFindFirst.mockResolvedValue({
      id: "ca-prior",
      createdByMoveId: "move-prior",
      ratificationStatus: "PROPOSED",
      conflictingClaimId: "obj-prior",
    });
    const res = await POST(makeReq({ ...grounds, requestId: "req-x" }));
    const json = await res.json();
    expect(json.idempotentReplay).toBe(true);
    // Replay envelope is not slimmer than the first call — the objection claim
    // id is recoverable after a lost/timed-out original response.
    expect(json.objectionClaimId).toBe("obj-prior");
    expect(json.attackMoveId).toBe("move-prior");
    expect(mockMintObjection).not.toHaveBeenCalled();
    expect(mockCACreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/ca — rate limit (Q6)", () => {
  test("429 with MOVE_RATE_LIMITED when the MCP bucket is exhausted", async () => {
    mockRateLimit.mockResolvedValue(false);
    const res = await POST(makeReq(baseBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("MOVE_RATE_LIMITED");
    expect(mockCACreate).not.toHaveBeenCalled();
  });

  test("rate limit is keyed on the bare bearer identity (20/h attack bucket)", async () => {
    await POST(makeReq({ ...baseBody, speakAs: "opponent" }));
    const [key, opts, prefix] = mockRateLimit.mock.calls[0] as any[];
    expect(key).toBe("mcp-bot"); // bare identity, not the namespaced side
    expect(opts).toMatchObject({ max: 20, window: "1 h" });
    expect(prefix).toBe("rl:mcp_attack");
  });
});

describe("POST /api/ca — ratification lifecycle (Q8)", () => {
  test("lands PROPOSED under a gating policy (actor-agnostic)", async () => {
    mockResolvePolicy.mockResolvedValue({ kind: "single" });
    const res = await POST(makeReq(baseBody));
    const json = await res.json();
    expect(json.ratificationStatus).toBe("PROPOSED");
    const data = (mockCACreate.mock.calls[0] as any[])[0].data;
    expect(data.ratificationStatus).toBe("PROPOSED");
    expect(data.ratifiedAt).toBeNull();
  });
});

describe("POST /api/ca — requestId idempotency", () => {
  test("replays a prior CA and does not re-create", async () => {
    mockCAFindFirst.mockResolvedValue({
      id: "ca-prior",
      createdByMoveId: "move-prior",
      ratificationStatus: "PROPOSED",
    });
    const res = await POST(makeReq({ ...baseBody, requestId: "req-1" }));
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      id: "ca-prior",
      conflictApplicationId: "ca-prior",
      attackMoveId: "move-prior",
      ratificationStatus: "PROPOSED",
      idempotentReplay: true,
    });
    expect(mockCACreate).not.toHaveBeenCalled();
    // Idempotency lookup is scoped to (deliberationId, metaJson.requestId).
    const where = (mockCAFindFirst.mock.calls[0] as any[])[0].where;
    expect(where.deliberationId).toBe("delib-123456");
    expect(where.metaJson).toEqual({ path: ["requestId"], equals: "req-1" });
  });

  test("stores requestId in metaJson on a fresh create", async () => {
    const res = await POST(makeReq({ ...baseBody, requestId: "req-2" }));
    expect(res.status).toBe(200);
    const data = (mockCACreate.mock.calls[0] as any[])[0].data;
    expect(data.metaJson).toMatchObject({ requestId: "req-2" });
  });

  test("no metaJson.requestId when none supplied", async () => {
    await POST(makeReq(baseBody));
    const data = (mockCACreate.mock.calls[0] as any[])[0].data;
    expect(data.metaJson.requestId).toBeUndefined();
  });
});
