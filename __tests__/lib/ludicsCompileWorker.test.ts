/**
 * P3 — background compile worker job handler (roadmap Design A).
 * Tests runLudicsCompileJob against mocked substrate: it compiles under the
 * lock, syncs ludics→AIF, rebuilds the per-argument AIF slice (Q7), and
 * invalidates caches — in that order.
 *
 * Avoids importing the Worker (which would open a live Redis connection) by
 * mocking bullmq + the queue connection.
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const order: string[] = [];
const mockCompile = jest.fn(async () => {
  order.push("compile");
  return { designs: ["d1", "d2"] };
});
const mockSyncLudics = jest.fn(async () => {
  order.push("syncLudics");
  return {};
});
const mockSyncArg = jest.fn(async () => {
  order.push("syncArg");
  return {};
});
const mockInvalidate = jest.fn(async () => {
  order.push("invalidate");
});
const mockFindMany = jest.fn(async () => [{ targetId: "arg-1" }, { targetId: "arg-2" }]);

// Prevent the Worker ctor from touching Redis.
jest.mock("bullmq", () => ({ Worker: class { on() {} } }));
jest.mock("@/lib/queue", () => ({ connection: {} }));
jest.mock("@/lib/prismaclient", () => ({
  prisma: { dialogueMove: { findMany: (a: any) => mockFindMany(a) } },
}));
jest.mock("@/packages/ludics-engine/compileFromMoves", () => ({
  compileFromMoves: (...a: any[]) => mockCompile(...a),
}));
jest.mock("@/lib/ludics/syncToAif", () => ({ syncLudicsToAif: (...a: any[]) => mockSyncLudics(...a) }));
jest.mock("@/services/aif/syncArgument", () => ({ syncArgumentToAif: (...a: any[]) => mockSyncArg(...a) }));
jest.mock("@/lib/ludics/insightsCache", () => ({ invalidateInsightsCache: (...a: any[]) => mockInvalidate(...a) }));

import { runLudicsCompileJob } from "@/workers/ludics/compileWorker";

beforeEach(() => {
  jest.clearAllMocks();
  order.length = 0;
  // Restore the order-recording implementations (clearAllMocks keeps them, but
  // be explicit so per-test overrides below reset cleanly).
  mockCompile.mockImplementation(async () => {
    order.push("compile");
    return { designs: ["d1", "d2"] } as any;
  });
  mockSyncArg.mockImplementation(async () => {
    order.push("syncArg");
    return {} as any;
  });
  mockFindMany.mockResolvedValue([{ targetId: "arg-1" }, { targetId: "arg-2" }] as any);
});

describe("runLudicsCompileJob", () => {
  test("runs compile → syncLudics → per-argument sync → invalidate", async () => {
    await runLudicsCompileJob({ deliberationId: "delib-x", enqueuedAtMs: 0 });

    // forceRecompile: true (idempotent wipe+recreate). compileFromMoves
    // self-serializes via withCompileLock; the worker must NOT wrap it again on
    // the same key (non-reentrant mutex → self-deadlock, caught in P6 smoke).
    expect(mockCompile).toHaveBeenCalledWith("delib-x", { forceRecompile: true });
    expect(mockSyncLudics).toHaveBeenCalledWith("delib-x");
    expect(mockInvalidate).toHaveBeenCalledWith("delib-x");

    // Q7: one syncArgumentToAif per distinct argument-typed dialogue target.
    expect(mockSyncArg).toHaveBeenCalledTimes(2);
    expect(mockSyncArg).toHaveBeenCalledWith({ argumentId: "arg-1" });
    expect(mockSyncArg).toHaveBeenCalledWith({ argumentId: "arg-2" });

    // Ordering contract.
    expect(order).toEqual(["compile", "syncLudics", "syncArg", "syncArg", "invalidate"]);
  });

  test("a per-argument sync failure does not abort the rest of the job", async () => {
    mockSyncArg.mockRejectedValueOnce(new Error("bad arg"));
    await expect(runLudicsCompileJob({ deliberationId: "delib-x", enqueuedAtMs: 0 })).resolves.toBeUndefined();
    // Second argument still synced; cache still invalidated.
    expect(mockSyncArg).toHaveBeenCalledTimes(2);
    expect(mockInvalidate).toHaveBeenCalledWith("delib-x");
  });

  test("queries distinct argument-typed targets for the deliberation", async () => {
    await runLudicsCompileJob({ deliberationId: "delib-x", enqueuedAtMs: 0 });
    const arg = (mockFindMany.mock.calls[0] as any[])[0];
    expect(arg.where).toEqual({ deliberationId: "delib-x", targetType: "argument" });
    expect(arg.distinct).toEqual(["targetId"]);
  });
});
