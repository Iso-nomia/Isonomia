/**
 * Integration tests for POST /api/cqs/answer — the MCP-aware
 * `answer_critical_question` write surface (Roadmap S3/S6).
 *
 * Verifies the self-canonicalisation floor and the upsert→submit→canonical
 * sequence:
 *   • self-canonical promote (matching sessionId on an AI/MCP argument)
 *   • cross-session answer → PENDING proposal + CQ_SELF_CANONICAL_DENIED
 *   • human-authored target → never canonical (the hard floor)
 *   • CQStatus upsert keyed on the @@unique tuple
 *   • duplicate-pending → 409 CQ_DUPLICATE_PENDING (nothing written)
 *   • unknown cqKey → CQ_NOT_FOUND; unknown argument → CQ_ARGUMENT_NOT_FOUND
 *   • idempotent replay by requestId (no second CQResponse.create)
 *   • supersede a prior canonical response on a fresh self-canonical answer
 */

import { NextRequest } from "next/server";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const prismaMock: any = {
  argument: { findUnique: jest.fn() },
  claim: { findMany: jest.fn() },
  deliberation: { findUnique: jest.fn() },
  cQStatus: { upsert: jest.fn(), update: jest.fn() },
  cQResponse: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  cQActivityLog: { create: jest.fn() },
  $transaction: jest.fn(async (fn: any) => fn(prismaMock)),
};

jest.mock("@/lib/prismaclient", () => ({ prisma: prismaMock }));

const resolveCitationCallerUserIdMock = jest.fn();
jest.mock("@/lib/citation/mcpAuth", () => ({
  resolveCitationCallerUserId: (...a: any[]) => resolveCitationCallerUserIdMock(...a),
  isMcpBearer: jest.fn(() => true),
}));

const getOrCreatePermalinkMock = jest.fn(async () => ({
  fullUrl: "https://mesh.test/a/abc123",
}));
jest.mock("@/lib/citations/permalinkService", () => ({
  getOrCreatePermalink: (...a: any[]) => getOrCreatePermalinkMock(...a),
}));

// Upstash rate-limit + redis: always allow.
jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow() {
      return null;
    }
    constructor(_: any) {}
    async limit(_: string) {
      return { success: true };
    }
  },
}));
jest.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(_: any) {}
  },
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { POST } from "@/app/api/cqs/answer/route";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/cqs/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Default AI/MCP-authored argument fixture, created in session "s1". */
function aiArgument(overrides: Record<string, unknown> = {}) {
  return {
    id: "arg1",
    authorId: "author1",
    deliberationId: "delib1",
    authorKind: "AI",
    aiProvenance: { via: "mcp", sessionId: "s1" },
    argumentSchemes: [
      {
        isPrimary: true,
        scheme: {
          id: "sch1",
          key: "expert-opinion",
          cqs: [{ cqKey: "expertise" }, { cqKey: "bias" }],
        },
      },
    ],
    ...overrides,
  };
}

const VALID_GROUNDS = "The cited expert holds a tenured chair in the field.";

beforeEach(() => {
  jest.clearAllMocks();

  // Auth default: MCP-bearer caller.
  resolveCitationCallerUserIdMock.mockResolvedValue("mcp-bot");

  // Argument lookup → the default AI/MCP argument.
  prismaMock.argument.findUnique.mockResolvedValue(aiArgument());

  // Evidence + room lookups (defaults: none requested / no room).
  prismaMock.claim.findMany.mockResolvedValue([]);
  prismaMock.deliberation.findUnique.mockResolvedValue({ roomId: null });

  // CQStatus upsert → a fresh OPEN row, no canonical yet.
  prismaMock.cQStatus.upsert.mockResolvedValue({
    id: "cqs1",
    statusEnum: "OPEN",
    canonicalResponseId: null,
  });
  prismaMock.cQStatus.update.mockResolvedValue({});

  // No idempotency replay, no duplicate-pending by default.
  prismaMock.cQResponse.findFirst.mockResolvedValue(null);
  prismaMock.cQResponse.create.mockResolvedValue({ id: "resp1" });
  prismaMock.cQResponse.update.mockResolvedValue({});
  prismaMock.cQActivityLog.create.mockResolvedValue({});
});

// ─── 1. Self-canonical promote ───────────────────────────────────────────────

test("matching sessionId on an AI/MCP argument self-canonicalises", async () => {
  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
      promoteToCanonical: true,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.ok).toBe(true);
  expect(json.canonical).toBe(true);
  expect(json.responseStatus).toBe("CANONICAL");
  expect(json.cqStatusEnum).toBe("SATISFIED");
  expect(json.warnings).toEqual([]);

  // The response was created CANONICAL.
  expect(prismaMock.cQResponse.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ responseStatus: "CANONICAL" }),
    }),
  );

  // CQStatus advanced to SATISFIED + canonicalResponseId set.
  expect(prismaMock.cQStatus.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "cqs1" },
      data: expect.objectContaining({
        statusEnum: "SATISFIED",
        canonicalResponseId: "resp1",
      }),
    }),
  );

  // Two activity logs: RESPONSE_SUBMITTED + CANONICAL_SELECTED.
  const actions = prismaMock.cQActivityLog.create.mock.calls.map(
    (c: any[]) => c[0].data.action,
  );
  expect(actions).toEqual(["RESPONSE_SUBMITTED", "CANONICAL_SELECTED"]);
});

// ─── 2. Cross-session → PENDING proposal ─────────────────────────────────────

test("a different sessionId records a PENDING proposal with a denial warning", async () => {
  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s2",
      promoteToCanonical: true,
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.canonical).toBe(false);
  expect(json.responseStatus).toBe("PENDING");
  expect(json.warnings.map((w: any) => w.code)).toContain(
    "CQ_SELF_CANONICAL_DENIED",
  );

  // The answer was still recorded — as PENDING.
  expect(prismaMock.cQResponse.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ responseStatus: "PENDING" }),
    }),
  );
  // No canonical selection log.
  const actions = prismaMock.cQActivityLog.create.mock.calls.map(
    (c: any[]) => c[0].data.action,
  );
  expect(actions).toEqual(["RESPONSE_SUBMITTED"]);
});

// ─── 3. Human-authored target → never canonical (hard floor) ─────────────────

test("a human-authored argument never self-canonicalises even with a matching sessionId", async () => {
  prismaMock.argument.findUnique.mockResolvedValue(
    aiArgument({
      authorKind: "HUMAN",
      aiProvenance: { via: "mcp", sessionId: "s1" },
    }),
  );

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
      promoteToCanonical: true,
    }),
  );
  const json = await res.json();

  expect(json.canonical).toBe(false);
  expect(json.responseStatus).toBe("PENDING");
  expect(json.warnings.map((w: any) => w.code)).toContain(
    "CQ_SELF_CANONICAL_DENIED",
  );
  expect(prismaMock.cQStatus.update).not.toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ statusEnum: "SATISFIED" }),
    }),
  );
});

// ─── 4. CQStatus upsert keyed on the @@unique tuple ──────────────────────────

test("CQStatus is upserted on the (targetType,targetId,schemeKey,cqKey) tuple", async () => {
  await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
    }),
  );

  expect(prismaMock.cQStatus.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        targetType_targetId_schemeKey_cqKey: {
          targetType: "argument",
          targetId: "arg1",
          schemeKey: "expert-opinion",
          cqKey: "expertise",
        },
      },
      create: expect.objectContaining({
        targetType: "argument",
        targetId: "arg1",
        schemeKey: "expert-opinion",
        cqKey: "expertise",
        createdById: "mcp-bot",
      }),
    }),
  );
});

// ─── 5. Duplicate-pending → 409 ──────────────────────────────────────────────

test("a second pending answer by the same contributor returns 409 and writes nothing", async () => {
  // First findFirst (idempotency by requestId) → null; second (duplicate-pending) → a row.
  prismaMock.cQResponse.findFirst.mockImplementation(async ({ where }: any) => {
    if ("requestId" in where) return null;
    return { id: "existing-pending" };
  });

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s2",
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(409);
  expect(json.code).toBe("CQ_DUPLICATE_PENDING");
  expect(prismaMock.cQResponse.create).not.toHaveBeenCalled();
});

// ─── 6. Not-found cases ──────────────────────────────────────────────────────

test("an unknown cqKey returns CQ_NOT_FOUND", async () => {
  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "no-such-cq",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(400);
  expect(json.code).toBe("CQ_NOT_FOUND");
  expect(prismaMock.cQStatus.upsert).not.toHaveBeenCalled();
});

test("an unknown argument returns CQ_ARGUMENT_NOT_FOUND", async () => {
  prismaMock.argument.findUnique.mockResolvedValue(null);

  const res = await POST(
    makeReq({
      argumentId: "missing",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(404);
  expect(json.code).toBe("CQ_ARGUMENT_NOT_FOUND");
});

// ─── 7. Idempotent replay ────────────────────────────────────────────────────

test("a retry with the same requestId replays the first answer without re-creating it", async () => {
  prismaMock.cQResponse.findFirst.mockImplementation(async ({ where }: any) => {
    if ("requestId" in where) {
      return {
        id: "resp-prior",
        cqStatusId: "cqs1",
        responseStatus: "CANONICAL",
        cqStatus: { statusEnum: "SATISFIED" },
      };
    }
    return null;
  });

  const res = await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
      requestId: "req-1",
    }),
  );
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.idempotentReplay).toBe(true);
  expect(json.responseId).toBe("resp-prior");
  expect(json.canonical).toBe(true);
  expect(prismaMock.cQResponse.create).not.toHaveBeenCalled();
  expect(prismaMock.cQStatus.upsert).not.toHaveBeenCalled();
});

// ─── 8. Supersede a prior canonical response ─────────────────────────────────

test("a fresh self-canonical answer supersedes the prior canonical response", async () => {
  prismaMock.cQStatus.upsert.mockResolvedValue({
    id: "cqs1",
    statusEnum: "SATISFIED",
    canonicalResponseId: "resp-old",
  });

  await POST(
    makeReq({
      argumentId: "arg1",
      cqKey: "expertise",
      groundsText: VALID_GROUNDS,
      sessionId: "s1",
      promoteToCanonical: true,
    }),
  );

  expect(prismaMock.cQResponse.update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "resp-old" },
      data: expect.objectContaining({ responseStatus: "SUPERSEDED" }),
    }),
  );
});
