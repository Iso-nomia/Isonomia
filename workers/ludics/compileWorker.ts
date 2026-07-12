/**
 * Deferred Ludics Compile — background worker (roadmap Design A, §4.3).
 *
 * Drains the `ludics-compile` queue (see lib/queue.ts + lib/ludics/compileQueue.ts):
 * for each coalesced job, recompiles a deliberation's DERIVED view OFF the request
 * path — the compile that #7b removed from the synchronous MCP move path because on
 * a large deliberation it takes 60–120s and starves concurrent foreground writes.
 *
 * Per job (mirrors POST /api/ludics/compile so both paths behave identically):
 *   1. compileFromMoves(deliberationId, { forceRecompile: true }) — rebuild designs/
 *      acts/traces (idempotent wipe+recreate). It ALREADY self-serializes per
 *      deliberation via withCompileLock(dialogueId, …), so a concurrent cookie-user
 *      compile coalesces on the same key. We must NOT wrap it in another
 *      withCompileLock(deliberationId, …): withCompileLock is a NON-reentrant keyed
 *      mutex, so a second acquisition on the same key from inside the first would
 *      self-deadlock (the inner wait never resolves). That was a real bug caught in
 *      the P6 live smoke — the job sat active forever at ~0 CPU with no DB session.
 *   2. syncLudicsToAif(deliberationId) — LudicAct → AifNode correspondence.
 *   3. AIF per-argument rebuild (Q7): the per-move syncArgumentToAif is ALSO skipped
 *      for MCP (spec #9), and it populates a DISTINCT graph slice — RA-nodes keyed by
 *      argumentId + premise/conclusion I-nodes + DM `asserts` edges — that the
 *      LudicAct→AIF path does not reconstruct. So we re-run it (idempotent, findFirst-
 *      keyed) for every argument that appears as an argument-typed DialogueMove target
 *      in the deliberation — exactly the set the synchronous path would have synced.
 *   4. invalidateInsightsCache(deliberationId).
 *
 * Concurrency 1 (Q3): compiles are DB-heavy; keeping pressure low is the whole point
 * of moving them off the request path. Failures are non-fatal — the next move
 * re-enqueues (removeOnFail keeps a small tail for inspection).
 *
 * Bootstrapping: self-registers on import via workers/index.ts (mirrors
 * workers/ludics/announcementDispatcher.ts).
 */
import { Worker, type Job } from "bullmq";
import { prisma } from "@/lib/prismaclient";
import { connection } from "@/lib/queue";
import { compileFromMoves } from "@/packages/ludics-engine/compileFromMoves";
import { syncLudicsToAif } from "@/lib/ludics/syncToAif";
import { syncArgumentToAif } from "@/services/aif/syncArgument";
import { invalidateInsightsCache } from "@/lib/ludics/insightsCache";
import type { LudicsCompileJobData } from "@/lib/ludics/compileQueue";

export const LUDICS_COMPILE_QUEUE = "ludics-compile";

/**
 * Rebuild the AIF graph slice that per-move `syncArgumentToAif` would have
 * produced for every argument-typed dialogue target in the deliberation.
 * Idempotent; each argument is guarded independently so one bad row does not
 * abort the rest. Returns the count of arguments synced.
 */
async function rebuildArgumentAif(deliberationId: string): Promise<number> {
  const argTargets = await prisma.dialogueMove.findMany({
    where: { deliberationId, targetType: "argument" },
    select: { targetId: true },
    distinct: ["targetId"],
  });
  let synced = 0;
  for (const { targetId } of argTargets) {
    if (!targetId) continue;
    try {
      await syncArgumentToAif({ argumentId: targetId });
      synced++;
    } catch (err) {
      console.error("[ludics-compile] syncArgumentToAif failed for argument", targetId, err);
    }
  }
  return synced;
}

export async function runLudicsCompileJob(data: LudicsCompileJobData): Promise<void> {
  const { deliberationId } = data;
  const startedAt = Date.now();
  // compileFromMoves self-serializes per-deliberation via withCompileLock — do NOT
  // wrap it again on the same key (non-reentrant mutex → self-deadlock). Mirror
  // /api/ludics/compile: compile (self-locked), then refresh the derived view.
  const result = await compileFromMoves(deliberationId, { forceRecompile: true });
  await syncLudicsToAif(deliberationId).catch((err) => {
    console.error("[ludics-compile] syncLudicsToAif failed:", err);
  });
  const argsSynced = await rebuildArgumentAif(deliberationId);
  await invalidateInsightsCache(deliberationId).catch((err) => {
    console.error("[ludics-compile] invalidateInsightsCache failed:", err);
  });
  console.info("[ludics-compile] compiled", {
    deliberationId,
    designCount: result.designs.length,
    argsSynced,
    tookMs: Date.now() - startedAt,
  });
}

export const ludicsCompileWorker = new Worker<LudicsCompileJobData>(
  LUDICS_COMPILE_QUEUE,
  async (job: Job<LudicsCompileJobData>) => {
    await runLudicsCompileJob(job.data);
  },
  {
    connection,
    // Q3 — keep compiles serialized so background work never re-introduces the
    // #7b foreground-write starvation.
    concurrency: 1,
  },
);

ludicsCompileWorker.on("failed", (job, err) => {
  console.error("[ludics-compile] job failed", { jobId: job?.id, deliberationId: job?.data?.deliberationId, err: err?.message });
});
