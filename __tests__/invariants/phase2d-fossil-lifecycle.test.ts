/**
 * Phase 2d invariant tests — Fossil Retraction Lifecycle.
 *
 * 18 tests covering:
 *   T1-T2   fossilize() correctness and idempotency
 *   T3-T4   fossilizeByArgument() happy path and zero-match
 *   T5-T8   getFossilRecord() queries (empty, filled, includeActive, ludicMoveId)
 *   T9      Argument delete hook → fossil with "argument_superseded"
 *   T10-T13 Manual retract endpoint (401, 200, 404, idempotent 200)
 *   T13b    Manual retract endpoint emits witness_rescinded announcement event (A11.3)
 *   T14     RetractReason covers all four values
 *   T15     fossilizeByArgument where-clause includes argumentId column
 *   T16     fossilizeByArgument returns correct count for 3 witnesses
 *   T17     bind_participant_to_design passes argumentId to ludicMove.update
 *   T18     getFossilRecord with deliberationId scopes to correct deliberation
 */

// ─── Import code under test ───────────────────────────────────────────────────

import { fossilize, fossilizeByArgument, type RetractLayer } from "@/server/ludics/witnessRecord";
import { getFossilRecord } from "@/server/ludics/fossilRecord";
import { bindParticipantToDesign, BindError } from "@/server/ludics/bindParticipantToDesign";
import { canonicalizeClaimText } from "@/lib/ids/mintMoid";

// ─── Mock prisma ──────────────────────────────────────────────────────────────

jest.mock("@/lib/prismaclient", () => ({
  prisma: {
    witnessRecord: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    ludicMove: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    argumentScheme: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const { prisma } = jest.requireMock("@/lib/prismaclient") as {
  prisma: {
    witnessRecord: {
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    ludicMove: { findUnique: jest.Mock; update: jest.Mock };
    argumentScheme: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
};

// ─── Mock serverutils for retract-witness route tests ────────────────────────

jest.mock("@/lib/serverutils", () => ({
  getCurrentUserId: jest.fn(),
}));

const { getCurrentUserId } = jest.requireMock("@/lib/serverutils") as {
  getCurrentUserId: jest.Mock;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFossilRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wr-1",
    ludicMoveId: "lm-1",
    dialogueMoveId: "dm-1",
    participantId: "p-1",
    canonicalText: '{"text":"some claim"}',
    schemeKey: null,
    timestamp: new Date("2025-01-01T00:00:00Z"),
    fossilizedAt: new Date("2025-01-02T00:00:00Z"),
    retractLayer: "argument_superseded",
    retractReason: null,
    ludicMove: { locus: "⊢A.0" },
    ...overrides,
  };
}

function makeActiveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wr-2",
    ludicMoveId: "lm-2",
    dialogueMoveId: "dm-2",
    participantId: "p-2",
    canonicalText: '{"text":"active claim"}',
    schemeKey: null,
    timestamp: new Date("2025-01-01T00:00:00Z"),
    fossilizedAt: null,
    retractLayer: null,
    retractReason: null,
    ludicMove: { locus: "⊢A.1" },
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
});

// ─── T1: fossilize() sets fossilizedAt and retractLayer ─────────────────────

describe("T1: fossilize() correctness", () => {
  it("sets fossilizedAt and retractLayer on the target row", async () => {
    const now = new Date();
    const expectedRecord = {
      id: "wr-1",
      ludicMoveId: "lm-1",
      dialogueMoveId: "dm-1",
      participantId: "p-1",
      timestamp: now,
      fossilizedAt: now,
      retractLayer: "manual_retract" as RetractLayer,
      retractReason: null,
    };

    // findUnique short-circuits to update only when fossilizedAt is null.
    prisma.witnessRecord.findUnique.mockResolvedValueOnce({
      ...expectedRecord,
      fossilizedAt: null,
      retractLayer: null,
    });
    prisma.witnessRecord.update.mockResolvedValueOnce(expectedRecord);

    const result = await fossilize("wr-1", "manual_retract");

    expect(prisma.witnessRecord.update).toHaveBeenCalledWith({
      where: { id: "wr-1" },
      data: { fossilizedAt: expect.any(Date), retractLayer: "manual_retract", retractReason: null },
    });
    expect(result.fossilizedAt).toBeTruthy();
    expect(result.retractLayer).toBe("manual_retract");
  });
});

// ─── T2: fossilize() idempotency (A11.4 — direct service-layer test) ─────────

describe("T2: fossilize() idempotency at the DB layer (A11.4)", () => {
  it("second fossilize() call is a no-op: preserves original fossilizedAt/retractLayer/retractReason and issues no UPDATE", async () => {
    const firstFossilizedAt = new Date("2025-01-02T10:00:00Z");
    const alreadyFossilized = {
      id: "wr-1",
      ludicMoveId: "lm-1",
      dialogueMoveId: "dm-1",
      participantId: "p-1",
      timestamp: new Date("2025-01-01T00:00:00Z"),
      fossilizedAt: firstFossilizedAt,
      retractLayer: "manual_retract" as RetractLayer,
      retractReason: "first-call reason",
    };

    // findUnique returns the already-fossilized row on the (second) call.
    prisma.witnessRecord.findUnique.mockResolvedValueOnce(alreadyFossilized);

    const result = await fossilize("wr-1", "argument_superseded", "second-call reason");

    // (a) Observably idempotent: returns the original values, NOT the new ones.
    expect(result.fossilizedAt?.toISOString()).toBe(firstFossilizedAt.toISOString());
    expect(result.retractLayer).toBe("manual_retract");
    expect(result.retractReason).toBe("first-call reason");

    // (b) No second UPDATE issued — only the findUnique read.
    expect(prisma.witnessRecord.update).not.toHaveBeenCalled();
    expect(prisma.witnessRecord.findUnique).toHaveBeenCalledWith({
      where: { id: "wr-1" },
    });
  });

  it("two sequential fossilize() calls on the same id are observably equivalent (first writes, second is no-op)", async () => {
    const baseRow = {
      id: "wr-1",
      ludicMoveId: "lm-1",
      dialogueMoveId: "dm-1",
      participantId: "p-1",
      timestamp: new Date("2025-01-01T00:00:00Z"),
      fossilizedAt: null as Date | null,
      retractLayer: null as string | null,
      retractReason: null as string | null,
    };
    const firstFossilizedAt = new Date("2025-01-02T10:00:00Z");
    const afterFirst = {
      ...baseRow,
      fossilizedAt: firstFossilizedAt,
      retractLayer: "manual_retract",
      retractReason: null,
    };

    // Call 1: findUnique → active row; update → after-first row.
    prisma.witnessRecord.findUnique.mockResolvedValueOnce(baseRow);
    prisma.witnessRecord.update.mockResolvedValueOnce(afterFirst);
    // Call 2: findUnique → after-first row (already fossilized); update must not run.
    prisma.witnessRecord.findUnique.mockResolvedValueOnce(afterFirst);

    const r1 = await fossilize("wr-1", "manual_retract");
    const r2 = await fossilize("wr-1", "manual_retract");

    expect(r1.fossilizedAt?.toISOString()).toBe(r2.fossilizedAt?.toISOString());
    expect(r1.retractLayer).toBe(r2.retractLayer);
    expect(prisma.witnessRecord.update).toHaveBeenCalledTimes(1);
    expect(prisma.witnessRecord.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ─── T3: fossilizeByArgument happy path ──────────────────────────────────────

describe("T3: fossilizeByArgument() fossilizes all active witnesses for argumentId", () => {
  it("calls updateMany with correct filter and returns fossilizedCount", async () => {
    prisma.witnessRecord.updateMany.mockResolvedValueOnce({ count: 2 });

    const result = await fossilizeByArgument("arg-abc", "argument_superseded");

    expect(prisma.witnessRecord.updateMany).toHaveBeenCalledWith({
      where: {
        ludicMove: { argumentId: "arg-abc" },
        fossilizedAt: null,
      },
      data: {
        fossilizedAt: expect.any(Date),
        retractLayer: "argument_superseded",
        retractReason: null,
      },
    });
    expect(result.fossilizedCount).toBe(2);
  });
});

// ─── T4: fossilizeByArgument with no matching witnesses ───────────────────────

describe("T4: fossilizeByArgument() with no matches returns fossilizedCount: 0", () => {
  it("returns { fossilizedCount: 0 } when no active witnesses match", async () => {
    prisma.witnessRecord.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await fossilizeByArgument("arg-missing", "argument_superseded");

    expect(result.fossilizedCount).toBe(0);
  });
});

// ─── T5: getFossilRecord before any fossilization ─────────────────────────────

describe("T5: getFossilRecord returns totalFossils === 0 when no fossils exist", () => {
  it("returns empty fossils array and totalFossils 0", async () => {
    prisma.witnessRecord.findMany.mockResolvedValueOnce([]);
    prisma.witnessRecord.count.mockResolvedValueOnce(0);

    const result = await getFossilRecord({ ludicMoveId: "lm-none" });

    expect(result.fossils).toHaveLength(0);
    expect(result.totalFossils).toBe(0);
  });
});

// ─── T6: getFossilRecord after fossilization returns correct retractLayer ─────

describe("T6: getFossilRecord returns fossil with correct retractLayer", () => {
  it("maps fossil row to FossilEntry with retractLayer", async () => {
    const fossil = makeFossilRow({ retractLayer: "design_excised" });
    prisma.witnessRecord.findMany.mockResolvedValueOnce([fossil]);
    prisma.witnessRecord.count.mockResolvedValueOnce(1);

    const result = await getFossilRecord({ ludicMoveId: "lm-1" });

    expect(result.fossils).toHaveLength(1);
    expect(result.fossils[0].retractLayer).toBe("design_excised");
    expect(result.fossils[0].witnessId).toBe("wr-1");
    expect(result.totalFossils).toBe(1);
  });
});

// ─── T7: getFossilRecord with includeActive: true ─────────────────────────────

describe("T7: getFossilRecord with includeActive returns both active and fossilized", () => {
  it("returns activeCount when includeActive is true", async () => {
    const fossil = makeFossilRow();
    prisma.witnessRecord.findMany.mockResolvedValueOnce([fossil]);
    // First count call is for totalFossils, second is for activeCount
    prisma.witnessRecord.count
      .mockResolvedValueOnce(1)  // totalFossils
      .mockResolvedValueOnce(3); // activeCount

    const result = await getFossilRecord({ ludicMoveId: "lm-1", includeActive: true });

    expect(result.fossils).toHaveLength(1);
    expect(result.totalFossils).toBe(1);
    expect(result.activeCount).toBeDefined();
    expect(result.activeCount).toBe(3);
  });
});

// ─── T8: getFossilRecord with ludicMoveId filter ──────────────────────────────

describe("T8: getFossilRecord with ludicMoveId filter returns only fossils for that move", () => {
  it("passes ludicMoveId to prisma where clause", async () => {
    const fossil = makeFossilRow({ ludicMoveId: "lm-target" });
    prisma.witnessRecord.findMany.mockResolvedValueOnce([fossil]);
    prisma.witnessRecord.count.mockResolvedValueOnce(1);

    await getFossilRecord({ ludicMoveId: "lm-target" });

    const callArgs = prisma.witnessRecord.findMany.mock.calls[0][0];
    expect(callArgs.where.ludicMoveId).toBe("lm-target");
  });
});

// ─── T9: Argument delete hook produces "argument_superseded" fossil ───────────

describe("T9: argument delete hook fossilizes with argument_superseded", () => {
  it("fossilizeByArgument called with argument_superseded produces correct retractLayer", async () => {
    // Simulate the argument deletion sequence: fossilize → then delete
    prisma.witnessRecord.updateMany.mockResolvedValueOnce({ count: 1 });

    const { fossilizedCount } = await fossilizeByArgument("arg-del", "argument_superseded");
    expect(fossilizedCount).toBe(1);

    // Verify the updateMany was called with "argument_superseded" layer
    const updateCall = prisma.witnessRecord.updateMany.mock.calls[0][0];
    expect(updateCall.data.retractLayer).toBe("argument_superseded");

    // Post-deletion: getFossilRecord should return this fossil
    const fossil = makeFossilRow({ retractLayer: "argument_superseded" });
    prisma.witnessRecord.findMany.mockResolvedValueOnce([fossil]);
    prisma.witnessRecord.count.mockResolvedValueOnce(1);

    const record = await getFossilRecord({ ludicMoveId: "lm-1" });
    expect(record.fossils[0].retractLayer).toBe("argument_superseded");
  });
});

// ─── T10-T13: Manual retract endpoint ─────────────────────────────────────────

describe("Manual retract endpoint", () => {
  // Import the route handler lazily AFTER scoped mocks for the auth + bus
  // modules are in place. v2.5 cutover: the legacy MCP_API_TOKEN bearer path
  // is gone, so tests now mock `resolveLudicsCaller` directly and assert on
  // the announcement-bus publish (the console.info dual-emit was removed
  // per LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md §7.0).
  let POST: (req: Request) => Promise<Response>;
  let resolveLudicsCallerMock: jest.Mock;
  let publishAnnouncementMock: jest.Mock;
  let LudicsAuthErrorCtor: new (code: string, message: string, status: number) => Error;

  beforeAll(async () => {
    jest.doMock("@/server/ludics/auth", () => {
      class LudicsAuthError extends Error {
        code: string;
        status: number;
        constructor(code: string, message: string, status: number) {
          super(message);
          this.name = "LudicsAuthError";
          this.code = code;
          this.status = status;
        }
      }
      return {
        resolveLudicsCaller: jest.fn(),
        LudicsAuthError,
      };
    });
    jest.doMock("@/lib/ludics/announcementBus", () => ({
      publishAnnouncement: jest.fn(async () => ({
        ok: true,
        eventId: "ann-phase2d",
        deduped: false,
      })),
    }));

    const authMod = jest.requireMock("@/server/ludics/auth") as {
      resolveLudicsCaller: jest.Mock;
      LudicsAuthError: new (code: string, message: string, status: number) => Error;
    };
    const busMod = jest.requireMock("@/lib/ludics/announcementBus") as {
      publishAnnouncement: jest.Mock;
    };
    resolveLudicsCallerMock = authMod.resolveLudicsCaller;
    LudicsAuthErrorCtor = authMod.LudicsAuthError;
    publishAnnouncementMock = busMod.publishAnnouncement;

    const mod = await import("@/app/api/v3/ludics/retract-witness/route");
    POST = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    resolveLudicsCallerMock.mockReset();
    publishAnnouncementMock.mockClear();
  });

  function makeRequest(body: unknown, authHeader?: string): Request {
    return new Request("http://localhost/api/v3/ludics/retract-witness", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  // T10: returns 401 without token
  it("T10: returns 401 when no auth provided", async () => {
    resolveLudicsCallerMock.mockResolvedValueOnce(null);

    const req = makeRequest({ witnessId: "wr-1" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  // T11: returns { ok: true } with a valid session caller and witnessId
  it("T11: returns ok:true with valid session caller and existing unfossilized witnessId", async () => {
    resolveLudicsCallerMock.mockResolvedValue({ callerId: "u-1", authMode: "session" });

    prisma.witnessRecord.findUnique.mockResolvedValueOnce({
      id: "wr-ok",
      fossilizedAt: null,
      ludicMove: { deliberationId: "delib-1" },
    });
    const fossilizedAt = new Date("2025-06-01T00:00:00Z");
    prisma.witnessRecord.update.mockResolvedValueOnce({
      id: "wr-ok",
      ludicMoveId: "lm-1",
      dialogueMoveId: "dm-1",
      participantId: "p-1",
      timestamp: new Date(),
      fossilizedAt,
      retractLayer: "manual_retract",
      retractReason: null,
    });

    const req = makeRequest({ witnessId: "wr-ok" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(typeof json.fossilizedAt).toBe("string");
    expect(json.alreadyFossilized).toBe(false);
  });

  // T12: returns 404 for unknown witnessId
  it("T12: returns 404 for unknown witnessId", async () => {
    resolveLudicsCallerMock.mockResolvedValue({ callerId: "u-1", authMode: "session" });

    prisma.witnessRecord.findUnique.mockResolvedValueOnce(null);

    const req = makeRequest({ witnessId: "wr-unknown" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);

    expect(res.status).toBe(404);
  });

  // T13: idempotent 200 with alreadyFossilized:true (spec §4.5 [CORRECTED post-review])
  it("T13: returns 200 alreadyFossilized:true when witnessId is already fossilized", async () => {
    resolveLudicsCallerMock.mockResolvedValue({ callerId: "u-1", authMode: "session" });

    const previouslyFossilizedAt = new Date("2025-01-01T00:00:00Z");
    prisma.witnessRecord.findUnique.mockResolvedValueOnce({
      id: "wr-fossilized",
      fossilizedAt: previouslyFossilizedAt,
      ludicMove: { deliberationId: "delib-1" },
    });

    const req = makeRequest({ witnessId: "wr-fossilized" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.alreadyFossilized).toBe(true);
    expect(json.fossilizedAt).toBe(previouslyFossilizedAt.toISOString());
    // No fresh fossilize() write should be issued on the idempotent path.
    expect(prisma.witnessRecord.update).not.toHaveBeenCalled();
  });

  // T13b: A11.3 — manual retract endpoint emits witness_rescinded via the
  // A1–A4 announcement bus (LUDICS_ANNOUNCEMENT_BUS_PROTOCOL.md §6+§7).
  // v2.5 cutover: the v0 `console.info` dual-emit was removed; the bus
  // publish is now the sole channel. Idempotent repeats MUST NOT re-publish.
  it("T13b: publishes witness_rescinded on fresh retract; does not publish on idempotent repeat", async () => {
    resolveLudicsCallerMock.mockResolvedValue({ callerId: "u-1", authMode: "session" });

    // Fresh retract → publish.
    const fossilizedAt = new Date("2025-06-02T00:00:00Z");
    prisma.witnessRecord.findUnique.mockResolvedValueOnce({
      id: "wr-fresh",
      fossilizedAt: null,
      ludicMove: { deliberationId: "delib-1" },
    });
    prisma.witnessRecord.update.mockResolvedValueOnce({
      id: "wr-fresh",
      ludicMoveId: "lm-1",
      dialogueMoveId: "dm-1",
      participantId: "p-1",
      timestamp: new Date(),
      fossilizedAt,
      retractLayer: "manual_retract",
      retractReason: null,
    });

    const freshReq = makeRequest({ witnessId: "wr-fresh" });
    const freshRes = await POST(freshReq as unknown as Parameters<typeof POST>[0]);
    expect(freshRes.status).toBe(200);

    expect(publishAnnouncementMock).toHaveBeenCalledTimes(1);
    const env = publishAnnouncementMock.mock.calls[0][0] as {
      eventType: string;
      scopeId: string;
      subjectId: string;
      occurredAt: string;
    };
    expect(env.eventType).toBe("witness_rescinded");
    expect(env.scopeId).toBe("delib-1");
    expect(env.subjectId).toBe("wr-fresh");
    expect(env.occurredAt).toBe(fossilizedAt.toISOString());

    // Repeat retract (already fossilized) → NO new publish.
    publishAnnouncementMock.mockClear();
    prisma.witnessRecord.findUnique.mockResolvedValueOnce({
      id: "wr-fresh",
      fossilizedAt,
      ludicMove: { deliberationId: "delib-1" },
    });
    const repeatReq = makeRequest({ witnessId: "wr-fresh" });
    const repeatRes = await POST(repeatReq as unknown as Parameters<typeof POST>[0]);
    expect(repeatRes.status).toBe(200);
    expect((await repeatRes.json()).alreadyFossilized).toBe(true);
    expect(publishAnnouncementMock).not.toHaveBeenCalled();

    // Suppress unused-var lint on the harness symbols.
    void LudicsAuthErrorCtor;
    void getCurrentUserId;
  });
});

// ─── T14: All four RetractLayer values are modeled ──────────────────────

describe("T14: RetractLayer covers all four event types", () => {
  it("includes argument_superseded, locus_deleted, design_excised, manual_retract", () => {
    const reasons: RetractLayer[] = [
      "argument_superseded",
      "locus_deleted",
      "design_excised",
      "manual_retract",
    ];
    // If any value above is not a valid RetractLayer, TypeScript would flag it at compile-time.
    // This test documents the expected set at runtime.
    expect(reasons).toHaveLength(4);
    expect(new Set(reasons).size).toBe(4);
  });
});

// ─── T15: argumentId column included in fossilizeByArgument where clause ─────

describe("T15: argumentId column is included in Prisma query where clause", () => {
  it("uses ludicMove: { argumentId } in the updateMany filter", async () => {
    prisma.witnessRecord.updateMany.mockResolvedValueOnce({ count: 0 });

    await fossilizeByArgument("arg-xyz", "locus_deleted");

    const callArgs = prisma.witnessRecord.updateMany.mock.calls[0][0];
    expect(callArgs.where.ludicMove).toEqual({ argumentId: "arg-xyz" });
  });

  // B9: defensive guard against text-match regression. The legacy fuzzy
  // fallback (canonicalText contains/ilike argument text) was deleted once
  // LudicMove.argumentId was plumbed (P1.h.5). Re-introducing any such key
  // in the fossilizeByArgument where-clause must fail this test.
  it("the where-clause is purely structural — no canonicalText / contains / OR keys", async () => {
    prisma.witnessRecord.updateMany.mockResolvedValueOnce({ count: 0 });

    await fossilizeByArgument("arg-xyz", "argument_superseded");

    const callArgs = prisma.witnessRecord.updateMany.mock.calls[0][0];
    const whereKeys = Object.keys(callArgs.where);
    expect(whereKeys.sort()).toEqual(["fossilizedAt", "ludicMove"]);
    expect(callArgs.where).not.toHaveProperty("canonicalText");
    expect(callArgs.where).not.toHaveProperty("OR");
    expect(callArgs.where.ludicMove).not.toHaveProperty("canonicalText");
  });
});

// ─── T16: fossilizeByArgument returns correct count for 3 witnesses ───────────

describe("T16: fossilizeByArgument returns fossilizedCount: 3 when 3 witnesses exist", () => {
  it("returns { fossilizedCount: 3 } when updateMany reports count 3", async () => {
    prisma.witnessRecord.updateMany.mockResolvedValueOnce({ count: 3 });

    const result = await fossilizeByArgument("arg-3witnesses", "argument_superseded");

    expect(result.fossilizedCount).toBe(3);
  });
});

// ─── T17: bind_participant_to_design passes argumentId through ────────────────

describe("T17: bindParticipantToDesign passes argumentId to ludicMove.update", () => {
  it("when argumentId is provided, updates the LudicMove row inside the transaction", async () => {
    const ludicMoveId = "lm-bind-test";
    const argumentId = "arg-bind-test";

    const canonicalText = canonicalizeClaimText("test claim for bind");

    prisma.ludicMove.findUnique.mockResolvedValueOnce({
      id: ludicMoveId,
      deliberationId: "delib-1",
      locus: "⊢A.0",
      moveType: "positive",
    });

    // Capture the transaction executor to inspect it
    let transactionExecutor: ((tx: unknown) => Promise<unknown>) | undefined;
    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        transactionExecutor = fn;
        // Simulate tx object
        const tx = {
          ludicMove: { update: jest.fn().mockResolvedValue({}) },
          witnessRecord: {
            create: jest.fn().mockResolvedValue({
              id: "wr-new",
              ludicMoveId,
              dialogueMoveId: "dm-new",
              participantId: "p-1",
              timestamp: new Date(),
              fossilizedAt: null,
              retractReason: null,
            }),
          },
        };
        const result = await fn(tx);
        // Verify ludicMove.update was called with the argumentId
        expect(tx.ludicMove.update).toHaveBeenCalledWith({
          where: { id: ludicMoveId },
          data: { argumentId },
        });
        return result;
      },
    );

    await bindParticipantToDesign({
      dialogueMoveId: "dm-new",
      ludicMoveId,
      participantId: "p-1",
      canonicalText,
      argumentId,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

// ─── T18: getFossilRecord with deliberationId scopes correctly ────────────────

describe("T18: getFossilRecord with deliberationId filters to correct deliberation", () => {
  it("passes deliberationId as ludicMove filter in the where clause", async () => {
    const fossil = makeFossilRow();
    prisma.witnessRecord.findMany.mockResolvedValueOnce([fossil]);
    prisma.witnessRecord.count.mockResolvedValueOnce(1);

    const result = await getFossilRecord({ deliberationId: "delib-scoped" });

    const callArgs = prisma.witnessRecord.findMany.mock.calls[0][0];
    expect(callArgs.where.ludicMove).toEqual({ deliberationId: "delib-scoped" });
    expect(result.totalFossils).toBe(1);
  });
});
