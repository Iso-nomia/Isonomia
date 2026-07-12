/**
 * Deferred Ludics Compile — enqueue seam (roadmap Design A, §4.4).
 *
 * MCP dialogue moves / attacks are RECORD-ONLY (spec #7b/#9): the dialectic
 * substrate is written synchronously, but the DERIVED Ludics compile + AIF graph
 * are refreshed off the request path. This helper schedules that deferred,
 * COALESCED recompile.
 *
 * Coalescing (Q1 — delayed-job dedup, no schema): we enqueue with a STABLE
 * jobId (`compile:<deliberationId>`) and a `delay` of DEBOUNCE_MS. While a
 * delayed job with that id is still pending, BullMQ rejects further adds with
 * the same id, so a burst of N moves on one deliberation collapses to exactly
 * ONE compile ~DEBOUNCE_MS after the first move of the burst. `compileFromMoves`
 * is idempotent (wipe+recreate) and self-serializes via `withCompileLock`, so a
 * coalesced "compile once after the burst" loses nothing.
 *
 * Fire-and-forget: callers MUST `.catch()` — a Redis hiccup must never fail the
 * (already-committed) move. The worker lives in
 * workers/ludics/compileWorker.ts.
 */
import { ludicsCompileQueue } from "@/lib/queue";

/** Debounce window (Q3). One compile per deliberation per ~10s burst. */
export const DEBOUNCE_MS = Number(process.env.LUDICS_COMPILE_DEBOUNCE_MS ?? 10_000) || 10_000;

export interface LudicsCompileJobData {
  deliberationId: string;
  /** When the enqueue was requested (informational; workers stamp their own). */
  enqueuedAtMs: number;
}

export function ludicsCompileJobId(deliberationId: string): string {
  return `compile:${deliberationId}`;
}

/**
 * Schedule a debounced, coalesced background recompile of a deliberation's
 * derived Ludics/AIF view. Safe to call on every MCP move; duplicate calls
 * within the debounce window are no-ops (jobId dedup).
 *
 * Resolves to the enqueued job (or the existing pending one) — but callers on
 * the request path should treat this as fire-and-forget and `.catch(() => {})`.
 */
export async function enqueueLudicsCompile(
  deliberationId: string,
  nowMs: number = Date.now(),
) {
  return ludicsCompileQueue.add(
    "compile",
    { deliberationId, enqueuedAtMs: nowMs } satisfies LudicsCompileJobData,
    {
      jobId: ludicsCompileJobId(deliberationId),
      delay: DEBOUNCE_MS,
      removeOnComplete: true,
      // Keep a small tail of failures for inspection; a failed compile is
      // non-fatal because the next move re-enqueues.
      removeOnFail: 50,
      attempts: 2,
      backoff: { type: "exponential", delay: 5_000 },
    },
  );
}
