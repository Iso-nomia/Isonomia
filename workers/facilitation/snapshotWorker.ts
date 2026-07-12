/**
 * Facilitation snapshot worker (C1.6)
 *
 * Periodically computes equity metric snapshots for every OPEN session.
 * Listens for SESSION_CLOSED events to write the `isFinal=true` snapshot.
 *
 * Cadence is configurable via env:
 *   FACILITATION_SNAPSHOT_INTERVAL_SECONDS (default 60)
 *   FACILITATION_FINALIZE_POLL_SECONDS    (default 30)
 *
 * The worker is intentionally side-effect-free at module load when not run
 * inside `workers/index.ts` — exports are usable from tests / smoke scripts.
 * Set FACILITATION_SNAPSHOT_WORKER_AUTO=1 to enable the interval.
 */

import { prisma } from "@/lib/prismaclient";
import { computeWindow, finalizeSession } from "@/lib/facilitation/metricService";
import { FacilitationSessionStatus } from "@/lib/facilitation/types";

const INTERVAL_SECONDS = Number(process.env.FACILITATION_SNAPSHOT_INTERVAL_SECONDS ?? 60);
const FINALIZE_POLL_SECONDS = Number(process.env.FACILITATION_FINALIZE_POLL_SECONDS ?? 30);

export interface CycleResult {
  ranAt: Date;
  open: { sessionId: string; ok: boolean; error?: string }[];
  finalized: { sessionId: string; ok: boolean; error?: string }[];
}

/**
 * One cycle: compute window snapshots for all OPEN sessions, then write
 * isFinal snapshots for any CLOSED/HANDED_OFF session that hasn't been
 * finalized yet.
 */
export async function runSnapshotCycle(opts: { now?: Date } = {}): Promise<CycleResult> {
  const now = opts.now ?? new Date();
  const result: CycleResult = { ranAt: now, open: [], finalized: [] };

  const openSessions = await prisma.facilitationSession.findMany({
    where: { status: FacilitationSessionStatus.OPEN },
    select: { id: true },
  });

  for (const s of openSessions) {
    try {
      await computeWindow(s.id, { now });
      result.open.push({ sessionId: s.id, ok: true });
    } catch (err) {
      result.open.push({
        sessionId: s.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Finalize: status != OPEN and no isFinal snapshot yet.
  const needsFinal = await prisma.facilitationSession.findMany({
    where: {
      status: { not: FacilitationSessionStatus.OPEN },
      // raw subquery would be ideal; this is fine since the count of
      // recently-closed sessions is small per cycle.
    },
    select: { id: true },
  });

  for (const s of needsFinal) {
    const has = await prisma.equityMetricSnapshot.count({
      where: { sessionId: s.id, isFinal: true },
    });
    if (has > 0) continue;
    try {
      await finalizeSession(s.id, { now });
      result.finalized.push({ sessionId: s.id, ok: true });
    } catch (err) {
      result.finalized.push({
        sessionId: s.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

if (process.env.FACILITATION_SNAPSHOT_WORKER_AUTO === "1") {
  console.log(
    `[facilitationSnapshotWorker] starting (interval=${INTERVAL_SECONDS}s, finalizePoll=${FINALIZE_POLL_SECONDS}s)`,
  );
  // Initial run.
  runSnapshotCycle().catch((e) =>
    console.error("[facilitationSnapshotWorker] initial run failed:", e),
  );
  setInterval(() => {
    runSnapshotCycle().catch((e) =>
      console.error("[facilitationSnapshotWorker] scheduled run failed:", e),
    );
  }, INTERVAL_SECONDS * 1000);
}
