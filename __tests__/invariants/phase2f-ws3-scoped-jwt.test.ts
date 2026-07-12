/**
 * Phase 2f Invariant Tests — WS-3 / B6 scoped session tokens (jose)
 *
 * Covers:
 *   T11  valid happy path                  → caller identity + scope
 *   T12  scope mismatch                    → SCOPE_MISMATCH (403)
 *   T13  expired token                     → EXPIRED_TOKEN (401)
 *   T14  legacy bearer OFF                 → 401 (INVALID_TOKEN)
 *   T15  legacy bearer ON                  → caller = mcp-system + deprecation warn
 *
 * The route surface (T11–T15 in the production-readiness suite) is left to
 * WS-4. These unit tests pin the auth primitive itself.
 */

import {
  issueScopedToken,
  verifyScopedToken,
  resolveLudicsCaller,
  enforceTokenScope,
  LudicsAuthError,
  type LudicsCaller,
} from "@/server/ludics/auth";

// ── Env setup ────────────────────────────────────────────────────────────────
const SIGNING_KEY = "test-signing-key-with-sufficient-entropy-for-hs256-1234567890";
const ISSUER = "mesh-ludics-test";
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.LUDICS_JWT_SIGNING_KEY = SIGNING_KEY;
  process.env.LUDICS_JWT_ISSUER = ISSUER;
  delete process.env.LUDICS_LEGACY_BEARER;
  delete process.env.MCP_API_TOKEN;
  delete process.env.MCP_AUTHOR_USER_ID;
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ── Session-cookie fallback mock ─────────────────────────────────────────────
jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(async () => null),
}));
const { getCurrentUserId } = jest.requireMock("@/lib/serverutils") as {
  getCurrentUserId: jest.Mock;
};

beforeEach(() => {
  getCurrentUserId.mockReset();
  getCurrentUserId.mockResolvedValue(null);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(headers: Record<string, string> = {}): any {
  const map = new Map<string, string>(Object.entries(headers));
  return {
    headers: {
      get: (k: string) => map.get(k.toLowerCase()) ?? map.get(k) ?? null,
    },
  };
}

// ─── T11: happy path ─────────────────────────────────────────────────────────

describe("WS-3 T11 — issue + verify happy path", () => {
  it("round-trips deliberationId and participantId", async () => {
    const token = await issueScopedToken({
      deliberationId: "delib_42",
      participantId: "alice",
      ttlSeconds: 60,
    });
    expect(token.split(".")).toHaveLength(3);

    const verified = await verifyScopedToken(token);
    expect(verified.participantId).toBe("alice");
    expect(verified.deliberationId).toBe("delib_42");
    expect(verified.iss).toBe(ISSUER);
    expect(verified.exp).toBeGreaterThan(verified.iat);
  });

  it("resolveLudicsCaller returns JWT mode + scope on valid Bearer", async () => {
    const token = await issueScopedToken({
      deliberationId: "delib_42",
      participantId: "alice",
    });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const caller = await resolveLudicsCaller(req);
    expect(caller).toEqual<LudicsCaller>({
      callerId: "alice",
      scope: { deliberationId: "delib_42" },
      authMode: "jwt",
    });
  });
});

// ─── T12: scope mismatch ─────────────────────────────────────────────────────

describe("WS-3 T12 — scope mismatch", () => {
  it("verifyScopedToken throws SCOPE_MISMATCH (403) when requireDeliberationId differs", async () => {
    const token = await issueScopedToken({
      deliberationId: "delib_A",
      participantId: "alice",
    });
    await expect(
      verifyScopedToken(token, { requireDeliberationId: "delib_B" }),
    ).rejects.toMatchObject({
      name: "LudicsAuthError",
      code: "SCOPE_MISMATCH",
      status: 403,
    });
  });

  it("enforceTokenScope throws SCOPE_MISMATCH on caller/route mismatch", () => {
    const caller: LudicsCaller = {
      callerId: "alice",
      scope: { deliberationId: "delib_A" },
      authMode: "jwt",
    };
    expect(() => enforceTokenScope(caller, "delib_B")).toThrow(LudicsAuthError);
  });

  it("enforceTokenScope is a no-op for session callers (no scope claim)", () => {
    const session: LudicsCaller = { callerId: "u_1", authMode: "session" };
    expect(() => enforceTokenScope(session, "delib_X")).not.toThrow();
  });
});

// ─── T13: expired token ──────────────────────────────────────────────────────

describe("WS-3 T13 — expired token", () => {
  it("verifyScopedToken throws EXPIRED_TOKEN (401) on past exp", async () => {
    // Issue with ttl=1 and wait it out via fake clock manipulation.
    // Easier: monkey-patch Date.now to issue a token that's already expired.
    const realNow = Date.now;
    Date.now = () => realNow() - 120_000; // 2 min in the past
    const token = await issueScopedToken({
      deliberationId: "delib_42",
      participantId: "alice",
      ttlSeconds: 30,
    });
    Date.now = realNow;

    await expect(verifyScopedToken(token)).rejects.toMatchObject({
      name: "LudicsAuthError",
      code: "EXPIRED_TOKEN",
      status: 401,
    });
  });
});

// ─── T14: any non-JWT bearer → 401 (legacy MCP_API_TOKEN bearer removed in v2.5) ─

describe("WS-3 T14 — legacy MCP_API_TOKEN bearer path removed (v2.5 cutover)", () => {
  it("resolveLudicsCaller rejects any bearer that isn't a valid scoped JWT", async () => {
    process.env.MCP_API_TOKEN = "legacy-secret";
    // v2.5: LUDICS_LEGACY_BEARER no longer recognised; setting it has no effect.
    process.env.LUDICS_LEGACY_BEARER = "1";
    const req = makeRequest({ authorization: "Bearer legacy-secret" });
    await expect(resolveLudicsCaller(req)).rejects.toMatchObject({
      name: "LudicsAuthError",
      code: "INVALID_TOKEN",
      status: 401,
    });
  });
});

// T15 ("legacy bearer ON → 200 + deprecation warn") was deleted in the v2.5
// cutover — the legacy MCP_API_TOKEN bearer fallback was removed from
// `server/ludics/auth.ts` per LUDICS_V2_SPRINT_PLAN.md sprint-exit row.

// ── Session-cookie fallback ────────────────────────────────────────────────

describe("WS-3 — session cookie fallback", () => {
  it("returns null when no Authorization header and no session", async () => {
    getCurrentUserId.mockResolvedValueOnce(null);
    const req = makeRequest({});
    const caller = await resolveLudicsCaller(req);
    expect(caller).toBeNull();
  });

  it("returns session caller when getCurrentUserId resolves", async () => {
    getCurrentUserId.mockResolvedValueOnce(1234n);
    const req = makeRequest({});
    const caller = await resolveLudicsCaller(req);
    expect(caller).toEqual<LudicsCaller>({
      callerId: "1234",
      authMode: "session",
    });
  });
});
