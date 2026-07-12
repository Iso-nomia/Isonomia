/**
 * Phase 2f §6.6 Production-Readiness Invariant Suite — WS-4 of the LUDICS v2 sprint.
 *
 * 17 tests grouped T1–T17 per [LUDICS_V2_SPRINT_PLAN.md §WS-4]:
 *
 *   T1–T4   Fingerprint cache (B12 / WS-1)
 *   T5–T10  Compound rate-limit (B11 / WS-2)
 *   T11–T14 Scoped JWT (B6 / WS-3) — exercised through propose-synthesis route
 *           (T15 "legacy bearer on" deleted in v2.5 cutover — legacy path removed)
 *   T16     Cache warming (WARM_LUDICS_CACHE_JOB — TODO until warmer ships)
 *   T17     OQ-5b deterministic rule-firing order
 *
 * Unit-level coverage of the same primitives lives in:
 *   - phase1f-fossil-fingerprint.test.ts (B12 internals)
 *   - phase2d-compound-rate-limit.test.ts (B11 adapter)
 *   - phase2f-ws3-scoped-jwt.test.ts (B6 auth primitive)
 *
 * This file is the *integration perimeter* — it checks the cross-module
 * invariants those unit suites cannot.
 */

// ─── Prisma global mock setup ────────────────────────────────────────────────
jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    briefingFingerprintHistory: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    witnessRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const { prisma } = jest.requireMock("@/lib/prismaclient") as {
  prisma: {
    briefingFingerprintHistory: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    witnessRecord: { findMany: jest.Mock; count: jest.Mock };
  };
};

// Upstream readout dependencies of computeBriefingFingerprint:
jest.mock("@/lib/deliberation/syntheticReadout", () => ({
  computeSyntheticReadout: jest.fn(),
}));
jest.mock("@/lib/deliberation/cqPrioritizer", () => ({
  derivePrioritizedOpenCqs: jest.fn(),
}));
jest.mock("@/server/ludics/deliberationSchema", () => ({
  getDeliberationSchema: jest.fn(),
}));
// propose-synthesis route delegates to this; we only test the auth gate here.
jest.mock("@/server/ludics/synthesisProposalAgent", () => ({
  proposeSynthesis: jest.fn(async () => ({ kind: "same-cone-join", witnessId: "wr-1" })),
  SynthesisError: class extends Error {
    code: string; status: number;
    constructor(code: string, message: string, status: number) {
      super(message); this.code = code; this.status = status;
    }
  },
}));
// Session-cookie fallback used by resolveLudicsCaller:
jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(async () => null),
}));

const { computeSyntheticReadout } = jest.requireMock("@/lib/deliberation/syntheticReadout");
const { derivePrioritizedOpenCqs } = jest.requireMock("@/lib/deliberation/cqPrioritizer");
const { getDeliberationSchema } = jest.requireMock("@/server/ludics/deliberationSchema");

import {
  computeBriefingFingerprint,
  checkBriefingFingerprint,
  evaluateStalenessRules,
  __resetBriefingFingerprintL0,
  type MaterialFields,
} from "@/server/ludics/briefingFingerprint";
import { compoundRateLimit, __resetMemoryRateLimits } from "@/lib/rateLimit";
import { issueScopedToken } from "@/server/ludics/auth";

// ─── Env / lifecycle ────────────────────────────────────────────────────────
const ORIGINAL_ENV = { ...process.env };
const SIGNING_KEY = "production-readiness-test-key-with-32+-chars-of-entropy";

beforeEach(() => {
  jest.clearAllMocks();
  __resetMemoryRateLimits();
  __resetBriefingFingerprintL0();
  process.env = { ...ORIGINAL_ENV };
  process.env.LUDICS_JWT_SIGNING_KEY = SIGNING_KEY;
  process.env.LUDICS_JWT_ISSUER = "mesh-ludics-test";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.LUDICS_LEGACY_BEARER;
  delete process.env.MCP_API_TOKEN;
});
afterAll(() => { process.env = ORIGINAL_ENV; });

// ─── Fixtures ───────────────────────────────────────────────────────────────
const DELIB_A = "delib-ws4-A";
const DELIB_B = "delib-ws4-B";

function makeReadout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    topology: {
      hubs: {
        set: [{ argumentId: "arg-hub-1", score: 95 }],
        shape: "single-dominant",
        topScore: 95,
        coequalThreshold: 19,
      },
    },
    frontier: {
      loadBearingnessRanking: [
        "arg-1","arg-2","arg-3","arg-4","arg-5",
        "arg-6","arg-7","arg-8","arg-9","arg-10",
      ],
    },
    refusalSurface: { cannotConcludeBecause: [{ conclusionClaimId: "claim-A" }] },
    ...overrides,
  };
}
function makeSchema() {
  return {
    witnessableLoci: [],
    latentLoci: [],
    rootLocus: "⊢A.0",
    behaviour: { positive: [], negative: [], shared: [] },
  };
}
function primeReadoutMocks(readout = makeReadout()) {
  computeSyntheticReadout.mockResolvedValue(readout);
  // derivePrioritizedOpenCqs is called synchronously inside extractMaterialFields:
  derivePrioritizedOpenCqs.mockReturnValue([]);
  getDeliberationSchema.mockResolvedValue(makeSchema());
  prisma.witnessRecord.findMany.mockResolvedValue([]);
  prisma.witnessRecord.count.mockResolvedValue(0);
}

// ════════════════════════════════════════════════════════════════════════════
// T1–T4 — Fingerprint cache (B12 / WS-1)
// ════════════════════════════════════════════════════════════════════════════

describe("T1–T4 · Fingerprint cache integration", () => {
  it("T1 cold-miss writes Postgres (L2) with computed hash + rule=null on first call", async () => {
    primeReadoutMocks();
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([]); // L2 latest empty
    const res = await computeBriefingFingerprint(DELIB_A);
    expect(res).not.toBeNull();
    expect(prisma.briefingFingerprintHistory.create).toHaveBeenCalledTimes(1);
    const call = prisma.briefingFingerprintHistory.create.mock.calls[0][0];
    expect(call.data.deliberationId).toBe(DELIB_A);
    expect(call.data.fingerprint).toBe(res!.contentHash);
    expect(call.data.materialChangeRule).toBeNull(); // first computation → no rule
  });

  it("T2 warm-hit returns identical hash and reports rule=null on second identical call", async () => {
    primeReadoutMocks();
    // First call: no prior history.
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([]);
    const first = await computeBriefingFingerprint(DELIB_A);
    // Second call: L2 returns the row we just inserted.
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([
      {
        fingerprint: first!.contentHash,
        materialChangeRule: null,
        computedAt: new Date(first!.computedAt),
      },
    ]);
    const second = await computeBriefingFingerprint(DELIB_A);
    expect(second!.contentHash).toBe(first!.contentHash);
    expect(second!.lastMaterialChangeRule).toBeNull();
  });

  it("T3 `computeBriefingFingerprint` invalidates and rotates hash when material fields change", async () => {
    primeReadoutMocks();
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([]);
    const first = await computeBriefingFingerprint(DELIB_A);

    // Change hubSet → R1 should fire.
    const changed = makeReadout({
      topology: {
        hubs: {
          set: [{ argumentId: "arg-hub-NEW", score: 99 }],
          shape: "single-dominant",
          topScore: 99,
          coequalThreshold: 19,
        },
      },
    });
    computeSyntheticReadout.mockResolvedValue(changed);
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([
      {
        fingerprint: first!.contentHash,
        materialChangeRule: null,
        computedAt: new Date(first!.computedAt),
      },
    ]);
    // prevEntry rehydration from L2:
    prisma.briefingFingerprintHistory.findFirst.mockResolvedValueOnce({
      deliberationId: DELIB_A,
      materialChangeSummary: {
        fields: first!.materialFields,
        components: first!.components,
        computedAt: first!.computedAt,
      },
    });

    const second = await computeBriefingFingerprint(DELIB_A);
    expect(second!.contentHash).not.toBe(first!.contentHash);
    expect(second!.lastMaterialChangeRule).toBe("R1");
    // L2 append called for both computations:
    expect(prisma.briefingFingerprintHistory.create).toHaveBeenCalledTimes(2);
  });

  it("T4 horizontal-scale convergence: after L0 reset, L2 rehydration yields same hash", async () => {
    primeReadoutMocks();
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([]);
    const instance1 = await computeBriefingFingerprint(DELIB_A);

    // Simulate cross-process boundary: clear in-memory L0 on "instance 2".
    __resetBriefingFingerprintL0();

    // Instance 2 sees the row instance 1 wrote.
    prisma.briefingFingerprintHistory.findMany.mockResolvedValueOnce([
      {
        fingerprint: instance1!.contentHash,
        materialChangeRule: null,
        computedAt: new Date(instance1!.computedAt),
      },
    ]);
    const instance2 = await computeBriefingFingerprint(DELIB_A);
    expect(instance2!.contentHash).toBe(instance1!.contentHash);
    expect(instance2!.lastMaterialChangeRule).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// T5–T10 — Compound rate-limit (B11 / WS-2)
// ════════════════════════════════════════════════════════════════════════════

describe("T5–T10 · Compound rate-limit integration", () => {
  const cfg = {
    perParticipant: { max: 3, window: "1 m" as const },
    perIp:          { max: 5, window: "1 m" as const },
  };

  it("T5 per-participant cap denies the 4th request from the same participant", async () => {
    for (let i = 0; i < 3; i++) {
      const ok = await compoundRateLimit(
        { scopeId: DELIB_A, participantId: "alice", ip: "1.1.1.1", action: "propose_synthesis" },
        cfg,
      );
      expect(ok.success).toBe(true);
    }
    const denied = await compoundRateLimit(
      { scopeId: DELIB_A, participantId: "alice", ip: "1.1.1.1", action: "propose_synthesis" },
      cfg,
    );
    expect(denied.success).toBe(false);
    expect(denied.retryAfter).toBeGreaterThan(0);
  });

  it("T6 per-IP cap denies when two participants share an IP and exceed the IP bucket", async () => {
    const perIp = { perParticipant: { max: 99, window: "1 m" as const }, perIp: { max: 4, window: "1 m" as const } };
    for (let i = 0; i < 2; i++) {
      await compoundRateLimit({ scopeId: DELIB_A, participantId: "alice", ip: "7.7.7.7", action: "bind" }, perIp);
      await compoundRateLimit({ scopeId: DELIB_A, participantId: "bob",   ip: "7.7.7.7", action: "bind" }, perIp);
    }
    // 5th request from any participant on this IP exceeds perIp.max=4
    const denied = await compoundRateLimit(
      { scopeId: DELIB_A, participantId: "carol", ip: "7.7.7.7", action: "bind" },
      perIp,
    );
    expect(denied.success).toBe(false);
  });

  it("T7 cross-deliberation isolation: exhausting scope A's IP bucket does not affect scope B", async () => {
    for (let i = 0; i < 5; i++) {
      await compoundRateLimit({ scopeId: DELIB_A, participantId: `p${i}`, ip: "9.9.9.9", action: "bind" }, cfg);
    }
    const denyA = await compoundRateLimit({ scopeId: DELIB_A, participantId: "p99", ip: "9.9.9.9", action: "bind" }, cfg);
    expect(denyA.success).toBe(false);
    const allowB = await compoundRateLimit({ scopeId: DELIB_B, participantId: "p99", ip: "9.9.9.9", action: "bind" }, cfg);
    expect(allowB.success).toBe(true);
  });

  it("T8 `Retry-After` is a positive integer second-count on denial", async () => {
    for (let i = 0; i < 3; i++) {
      await compoundRateLimit({ scopeId: DELIB_A, participantId: "alice", ip: null, action: "X" }, cfg);
    }
    const denied = await compoundRateLimit({ scopeId: DELIB_A, participantId: "alice", ip: null, action: "X" }, cfg);
    expect(denied.success).toBe(false);
    expect(Number.isInteger(denied.retryAfter)).toBe(true);
    expect(denied.retryAfter).toBeGreaterThan(0);
    expect(denied.retryAfter).toBeLessThanOrEqual(60);
  });

  it("T9 window rollover unblocks once `reset` time elapses", async () => {
    const fast = { perParticipant: { max: 1, window: "1 m" as const } };
    const first = await compoundRateLimit(
      { scopeId: DELIB_A, participantId: "alice", action: "ping" }, fast,
    );
    expect(first.success).toBe(true);
    const denied = await compoundRateLimit(
      { scopeId: DELIB_A, participantId: "alice", action: "ping" }, fast,
    );
    expect(denied.success).toBe(false);

    // Advance Date.now past the window
    const realNow = Date.now;
    Date.now = () => realNow() + 61_000;
    try {
      const unblocked = await compoundRateLimit(
        { scopeId: DELIB_A, participantId: "alice", action: "ping" }, fast,
      );
      expect(unblocked.success).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it("T10 missing IP gracefully skips the IP bucket (does not throw, does not deny)", async () => {
    const res = await compoundRateLimit(
      { scopeId: DELIB_A, participantId: "alice", ip: null, action: "Y" },
      { perParticipant: { max: 10, window: "1 m" }, perIp: { max: 1, window: "1 m" } },
    );
    expect(res.success).toBe(true);
    // Repeat 9 more times — perIp would deny after 1, but ip is null so skipped:
    for (let i = 0; i < 9; i++) {
      const ok = await compoundRateLimit(
        { scopeId: DELIB_A, participantId: "alice", ip: null, action: "Y" },
        { perParticipant: { max: 10, window: "1 m" }, perIp: { max: 1, window: "1 m" } },
      );
      expect(ok.success).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// T11–T14 — Scoped JWT through propose-synthesis route (B6 / WS-3)
// ════════════════════════════════════════════════════════════════════════════

describe("T11–T14 · Scoped JWT route-level integration", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/v3/ludics/propose-synthesis/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  function makeReq(body: unknown, authHeader?: string): Request {
    return new Request("http://localhost/api/v3/ludics/propose-synthesis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
  }
  const VALID_BODY = {
    deliberationId: DELIB_A,
    designIds: ["d1", "d2"],
    canonicalText: "hello",
  };

  it("T11 valid scoped JWT for matching deliberation → 200", async () => {
    const token = await issueScopedToken({ deliberationId: DELIB_A, participantId: "alice" });
    const res = await POST(makeReq(VALID_BODY, `Bearer ${token}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it("T12 valid token + wrong body deliberationId → 403 SCOPE_MISMATCH", async () => {
    const token = await issueScopedToken({ deliberationId: DELIB_A, participantId: "alice" });
    const res = await POST(makeReq({ ...VALID_BODY, deliberationId: DELIB_B }, `Bearer ${token}`));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("SCOPE_MISMATCH");
  });

  it("T13 expired token → 401 EXPIRED_TOKEN at the route boundary", async () => {
    const realNow = Date.now;
    Date.now = () => realNow() - 120_000;
    const token = await issueScopedToken({ deliberationId: DELIB_A, participantId: "alice", ttlSeconds: 30 });
    Date.now = realNow;
    const res = await POST(makeReq(VALID_BODY, `Bearer ${token}`));
    // v2.5 cutover: the legacy MCP_API_TOKEN bearer fallback is gone, so
    // resolveLudicsCaller now re-throws JWT failures (SCOPE_MISMATCH /
    // EXPIRED_TOKEN / INVALID_TOKEN) with their precise code + status
    // instead of collapsing them to INVALID_TOKEN to allow legacy fallback.
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("EXPIRED_TOKEN");
  });

  it("T14 bearer that isn't a valid JWT → 401 INVALID_TOKEN (legacy bearer path removed in v2.5)", async () => {
    const res = await POST(makeReq(VALID_BODY, "Bearer ws4-not-a-jwt"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("INVALID_TOKEN");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// T16 — Cache warming (WARM_LUDICS_CACHE_JOB)
// ════════════════════════════════════════════════════════════════════════════

describe("T16 · Cache warming", () => {
  // The WARM_LUDICS_CACHE_JOB worker has not landed yet (see
  // LUDICS_V2_SPRINT_PLAN.md §WS-4 — listed without an owning workstream).
  // This test is intentionally pending so it surfaces in `it.todo` output
  // and reminds the next sprint to wire it up.
  it.todo(
    "WARM_LUDICS_CACHE_JOB populates fingerprint + readout caches (pending worker)",
  );
});

// ════════════════════════════════════════════════════════════════════════════
// T17 — OQ-5b deterministic R1→R5 ordering
// ════════════════════════════════════════════════════════════════════════════

describe("T17 · OQ-5b deterministic rule ordering", () => {
  function makeFields(overrides: Partial<MaterialFields> = {}): MaterialFields {
    return {
      hubSet: ["arg-1"],
      hubShape: "single-dominant",
      loadBearingRankingTop10: [
        "arg-1","arg-2","arg-3","arg-4","arg-5",
        "arg-6","arg-7","arg-8","arg-9","arg-10",
      ],
      openExposurePoints: 0,
      refusalCount: 0,
      prioritizedCqTop15: [],
      refusalConclusionIds: [],
      ...overrides,
    };
  }

  it("R1 wins when hubSet AND loadBearingRanking AND openExposurePoints all change", () => {
    const prev = makeFields();
    const curr = makeFields({
      hubSet: ["arg-NEW"],                                  // triggers R1
      loadBearingRankingTop10: [                            // would trigger R3
        "arg-2","arg-1","arg-3","arg-4","arg-5",
        "arg-6","arg-7","arg-8","arg-9","arg-10",
      ],
      openExposurePoints: 100,                              // would trigger R5
    });
    expect(evaluateStalenessRules(prev, curr)).toBe("R1");
  });

  it("R3 wins over R5 when hubSet is unchanged", () => {
    const prev = makeFields();
    const curr = makeFields({
      loadBearingRankingTop10: [
        "arg-2","arg-1","arg-3","arg-4","arg-5",
        "arg-6","arg-7","arg-8","arg-9","arg-10",
      ],
      openExposurePoints: 100,
    });
    expect(evaluateStalenessRules(prev, curr)).toBe("R3");
  });

  it("returns null when no material rule fires", () => {
    const prev = makeFields();
    const curr = makeFields(); // identical
    expect(evaluateStalenessRules(prev, curr)).toBeNull();
  });
});
