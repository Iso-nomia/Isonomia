/**
 * Smoke test for C1.6: metric service + snapshot worker.
 *
 * Validates:
 *   1. computeWindow over real DB inputs writes 5 snapshots (one per kind)
 *      with correct metricVersion + breakdown shape.
 *   2. runSnapshotCycle picks up the OPEN session and runs once.
 *   3. finalizeSession writes one isFinal snapshot per kind (5 total).
 *   4. Calling finalizeSession twice raises "final snapshot already recorded".
 *   5. Partial unique index `equity_metric_snapshot_final_unique` enforced
 *      at the DB level (raw insert duplicate fails).
 *   6. getCurrentSnapshot / getHistory read paths work.
 *
 * Run: npx tsx scripts/smoke-facilitation-metrics.ts
 */

import { PrismaClient } from "@prisma/client";
import { openSession, closeSession } from "../lib/facilitation/sessionService";
import {
  computeWindow,
  finalizeSession,
  getCurrentSnapshot,
  getHistory,
} from "../lib/facilitation/metricService";
import { runSnapshotCycle } from "../workers/facilitation/snapshotWorker";
import { EquityMetricKind } from "../lib/facilitation/types";
import { METRIC_REGISTRY } from "../lib/facilitation/metrics";

const prisma = new PrismaClient();
const createdSessionIds: string[] = [];

async function cleanup() {
  await prisma.facilitationEvent.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.facilitationIntervention.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.equityMetricSnapshot.deleteMany({
    where: { sessionId: { in: createdSessionIds } },
  });
  await prisma.facilitationSession.deleteMany({
    where: { id: { in: createdSessionIds } },
  });
}

function ok(label: string, cond: boolean, detail?: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${cond ? "" : ` — ${detail ?? ""}`}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const d = await prisma.deliberation.findFirst({
    select: { id: true, createdById: true },
  });
  if (!d) {
    console.log("NO_DELIBERATION (skipping)");
    return;
  }

  const session = await openSession({ deliberationId: d.id, openedById: d.createdById });
  createdSessionIds.push(session.id);

  // ── 1. computeWindow over real inputs ────────────────────────────────
  const r1 = await computeWindow(session.id);
  ok("compute.fiveSnapshots", r1.snapshots.length === 5, `got=${r1.snapshots.length}`);
  ok(
    "compute.allKinds",
    METRIC_REGISTRY.every((c) => r1.snapshots.some((s) => s.metricKind === c.kind)),
  );

  // version pinning verification
  const giniRow = await prisma.equityMetricSnapshot.findFirst({
    where: { sessionId: session.id, metricKind: EquityMetricKind.PARTICIPATION_GINI },
    orderBy: { windowEnd: "desc" },
  });
  ok("compute.versionPinned", giniRow?.metricVersion === 1);
  ok("compute.breakdownIsObject", giniRow?.breakdownJson != null && typeof giniRow.breakdownJson === "object");

  // ── 2. worker cycle picks up the open session ─────────────────────────
  const cycle = await runSnapshotCycle();
  const ours = cycle.open.find((o) => o.sessionId === session.id);
  ok("worker.cyclePicksOpenSession", !!ours && ours.ok, JSON.stringify(ours));

  // After cycle, we should have at least 10 snapshots for this session
  // (5 from compute.cycle1 + 5 from worker).
  const totalAfter = await prisma.equityMetricSnapshot.count({ where: { sessionId: session.id } });
  ok("worker.snapshotsAccumulate", totalAfter >= 10, `got=${totalAfter}`);

  // ── 3. finalize after close ──────────────────────────────────────────
  // Cannot finalize an OPEN session.
  let openRejected = false;
  try {
    await finalizeSession(session.id);
  } catch {
    openRejected = true;
  }
  ok("finalize.rejectsOpen", openRejected);

  await closeSession({ sessionId: session.id, closedById: d.createdById });
  const final = await finalizeSession(session.id);
  ok("finalize.fiveFinalSnapshots", final.snapshots.length === 5);

  const finalRows = await prisma.equityMetricSnapshot.findMany({
    where: { sessionId: session.id, isFinal: true },
  });
  ok("finalize.exactlyFiveIsFinalRows", finalRows.length === 5);
  ok(
    "finalize.allKindsFinal",
    METRIC_REGISTRY.every((c) => finalRows.some((r) => r.metricKind === c.kind)),
  );

  // ── 4. double-finalize guarded ───────────────────────────────────────
  let doubleRejected = false;
  try {
    await finalizeSession(session.id);
  } catch (err) {
    doubleRejected = /already recorded/.test(err instanceof Error ? err.message : "");
  }
  ok("finalize.doubleGuard", doubleRejected);

  // ── 5. partial unique index — raw insert must fail ────────────────────
  let dbDupRejected = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EquityMetricSnapshot" ("id","deliberationId","sessionId","windowStart","windowEnd","metricKind","metricVersion","value","breakdownJson","isFinal","createdAt") VALUES ($1,$2,$3,NOW(),NOW(),'PARTICIPATION_GINI',1,0,'{}'::jsonb,true,NOW())`,
      `dup_${session.id}`,
      d.id,
      session.id,
    );
  } catch {
    dbDupRejected = true;
  }
  ok("finalize.partialUniqueIndexEnforced", dbDupRejected);

  // ── 6. read paths ─────────────────────────────────────────────────────
  const current = await getCurrentSnapshot(session.id, EquityMetricKind.PARTICIPATION_GINI);
  ok("read.getCurrentSnapshot", current != null && current.metricKind === EquityMetricKind.PARTICIPATION_GINI);

  const history = await getHistory(session.id, EquityMetricKind.PARTICIPATION_GINI);
  ok("read.historyOrderedAsc", history.length >= 3 &&
     history.every((row, i) => i === 0 || row.windowEnd.getTime() >= history[i - 1].windowEnd.getTime()),
     `len=${history.length}`);
}

main()
  .catch((err) => {
    console.error("smoke-facilitation-metrics: failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log("cleaned up");
  });
