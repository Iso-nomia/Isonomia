/**
 * P2 — enqueue helper for the debounced background compile (roadmap Design A).
 * Asserts the coalescing contract: stable jobId, debounce delay, removeOnComplete.
 */
import { describe, test, expect, beforeEach, jest } from "@jest/globals";

const mockAdd = jest.fn(async (_name: string, _data: any, _opts: any) => ({ id: "job-1" }));
jest.mock("@/lib/queue", () => ({ ludicsCompileQueue: { add: (...a: any[]) => mockAdd(...a) } }));

import { enqueueLudicsCompile, ludicsCompileJobId, DEBOUNCE_MS } from "@/lib/ludics/compileQueue";

beforeEach(() => jest.clearAllMocks());

describe("enqueueLudicsCompile", () => {
  test("uses a stable per-deliberation jobId so a burst coalesces to one compile", async () => {
    await enqueueLudicsCompile("delib-abc", 1000);
    const [name, data, opts] = mockAdd.mock.calls[0] as any[];
    expect(name).toBe("compile");
    expect(data).toEqual({ deliberationId: "delib-abc", enqueuedAtMs: 1000 });
    expect(opts.jobId).toBe("compile:delib-abc");
    expect(opts.jobId).toBe(ludicsCompileJobId("delib-abc"));
  });

  test("debounces via a delay and cleans up on complete", async () => {
    await enqueueLudicsCompile("delib-abc", 0);
    const opts = (mockAdd.mock.calls[0] as any[])[2];
    expect(opts.delay).toBe(DEBOUNCE_MS);
    expect(opts.removeOnComplete).toBe(true);
    expect(opts.removeOnFail).toBe(50);
    expect(opts.attempts).toBe(2);
  });

  test("distinct deliberations get distinct jobIds (no cross-coalescing)", async () => {
    await enqueueLudicsCompile("delib-a", 0);
    await enqueueLudicsCompile("delib-b", 0);
    const idA = (mockAdd.mock.calls[0] as any[])[2].jobId;
    const idB = (mockAdd.mock.calls[1] as any[])[2].jobId;
    expect(idA).not.toBe(idB);
  });
});
