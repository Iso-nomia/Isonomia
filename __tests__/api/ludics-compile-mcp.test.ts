/**
 * P1 smoke — MCP-enabling POST /api/ludics/compile (compile_deliberation seam).
 * Deferred Ludics Compile roadmap, Design B. Handler tests under mocked
 * substrate (mirrors ca-mcp.test.ts).
 *
 * Covers:
 *  · MCP bearer resolves the caller (no session cookie) and compiles;
 *  · response echoes designs / designCount / tookMs;
 *  · syncLudicsToAif + invalidateInsightsCache are wired (run after compile);
 *  · 401 when neither bearer nor session is present (compile never runs);
 *  · 429 with COMPILE_RATE_LIMITED when the rl:mcp_compile bucket is exhausted;
 *  · rate limit is keyed on the bare bearer identity with the 6/h bucket;
 *  · a compile failure surfaces a 500 (does not crash the handler).
 */
import { describe, test, expect, beforeEach, beforeAll, jest } from "@jest/globals";

const mockCompile = jest.fn(async (_id: string, _opts: any) => ({ designs: ["d1", "d2"] }));
const mockSyncToAif = jest.fn(async (_id: string) => ({}));
const mockInvalidate = jest.fn(async (_id: string) => {});
const mockRateLimit = jest.fn(async () => true);

jest.mock("@/packages/ludics-engine/compileFromMoves", () => ({
  compileFromMoves: (id: string, opts: any) => mockCompile(id, opts),
}));
jest.mock("@/lib/ludics/syncToAif", () => ({ syncLudicsToAif: (id: string) => mockSyncToAif(id) }));
jest.mock("@/lib/ludics/insightsCache", () => ({
  invalidateInsightsCache: (id: string) => mockInvalidate(id),
}));
jest.mock("@/lib/rateLimit", () => ({ rateLimit: (...a: any[]) => mockRateLimit(...a) }));
// Fallback (non-bearer) auth path resolves to null unless a test overrides it.
jest.mock("@/lib/serverutils", () => ({ getCurrentUserId: jest.fn(async () => null) }));

import { POST } from "@/app/api/ludics/compile/route";

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

const baseBody = { deliberationId: "delib-123456" };

beforeEach(() => {
  jest.clearAllMocks();
  mockCompile.mockResolvedValue({ designs: ["d1", "d2"] });
  mockRateLimit.mockResolvedValue(true);
});

describe("POST /api/ludics/compile — MCP bearer auth", () => {
  test("bearer compiles and echoes designs / designCount / tookMs", async () => {
    const res = await POST(makeReq(baseBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      ok: true,
      designs: ["d1", "d2"],
      designCount: 2,
      scopingStrategy: "legacy",
    });
    expect(typeof json.tookMs).toBe("number");
    // Compile defaults to legacy strategy + forceRecompile true.
    expect(mockCompile).toHaveBeenCalledWith("delib-123456", {
      scopingStrategy: "legacy",
      forceRecompile: true,
    });
  });

  test("wires the derived-view refresh: syncToAif + invalidateInsightsCache", async () => {
    await POST(makeReq(baseBody));
    expect(mockSyncToAif).toHaveBeenCalledWith("delib-123456");
    expect(mockInvalidate).toHaveBeenCalledWith("delib-123456");
  });

  test("401 when neither bearer nor session is present — compile never runs", async () => {
    const res = await POST(makeReq(baseBody, { bearer: false }));
    expect(res.status).toBe(401);
    expect(mockCompile).not.toHaveBeenCalled();
  });

  test("honours an explicit scopingStrategy / forceRecompile", async () => {
    await POST(makeReq({ ...baseBody, scopingStrategy: "per-scope", forceRecompile: false }));
    expect(mockCompile).toHaveBeenCalledWith("delib-123456", {
      scopingStrategy: "per-scope",
      forceRecompile: false,
    });
  });
});

describe("POST /api/ludics/compile — rate limit (Q5: rl:mcp_compile 6/h)", () => {
  test("429 with COMPILE_RATE_LIMITED when the MCP bucket is exhausted", async () => {
    mockRateLimit.mockResolvedValue(false);
    const res = await POST(makeReq(baseBody));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("COMPILE_RATE_LIMITED");
    expect(mockCompile).not.toHaveBeenCalled();
  });

  test("keyed on the bare bearer identity with the 6/h bucket", async () => {
    await POST(makeReq(baseBody));
    const [key, opts, prefix] = mockRateLimit.mock.calls[0] as any[];
    expect(key).toBe("mcp-bot");
    expect(opts).toMatchObject({ max: 6, window: "1 h" });
    expect(prefix).toBe("rl:mcp_compile");
  });
});

describe("POST /api/ludics/compile — failure handling", () => {
  test("a compile throw surfaces a 500 without crashing the handler", async () => {
    mockCompile.mockRejectedValue(new Error("boom"));
    const res = await POST(makeReq(baseBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("boom");
  });
});
