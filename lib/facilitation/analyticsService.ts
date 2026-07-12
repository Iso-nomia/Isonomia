/**
 * Facilitation — Deliberation analytics service (C4.1)
 *
 * Per-DELIBERATION rollup, complementing `reportService.ts` (which is
 * per-session). Aggregates across every session a deliberation has ever
 * had so partners and operators can answer questions like:
 *
 *   - How does intervention apply rate trend across consecutive sessions?
 *   - Which rules fire most? Which get dismissed most?
 *   - How much did equity metrics actually move from session start to end?
 *
 * Pure read-only. All numbers are reproducible from
 * `FacilitationEvent`, `FacilitationIntervention`, `FacilitationQuestion`,
 * and `EquityMetricSnapshot` rows alone — no derived state required
 * (matches the C4 exit criterion).
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { PrismaClient } from "@prisma/client";
import {
  EquityMetricKind,
  FacilitationCheckSeverity,
  FacilitationInterventionKind,
} from "@/lib/facilitation/types";

type Db = PrismaClient | typeof defaultPrisma;

export interface DeliberationAnalytics {
  deliberationId: string;
  generatedAt: Date;
  sessions: Array<{
    id: string;
    status: string;
    openedAt: Date;
    closedAt: Date | null;
    durationMs: number | null;
    eventCount: number;
  }>;
  interventions: {
    total: number;
    recommended: number;
    applied: number;
    dismissed: number;
    pending: number;
    applyRate: number;
    dismissRate: number;
    applyRateByKind: Record<
      FacilitationInterventionKind,
      { applied: number; total: number; rate: number }
    >;
    applyRateByRule: Record<
      string,
      { applied: number; dismissed: number; total: number; rate: number }
    >;
    dismissalTagDistribution: Record<string, number>;
  };
  metrics: {
    startVsFinalByKind: Record<
      EquityMetricKind,
      {
        firstValue: number | null;
        firstAt: Date | null;
        finalValue: number | null;
        finalAt: Date | null;
        delta: number | null;
      }
    >;
  };
  questions: {
    lockAttempts: number;
    locked: number;
    reopened: number;
    checkFailureHistogram: Record<FacilitationCheckSeverity, number>;
  };
}

export async function buildDeliberationAnalytics(
  deliberationId: string,
  opts: { prismaClient?: Db } = {},
): Promise<DeliberationAnalytics> {
  const db = opts.prismaClient ?? defaultPrisma;

  const [sessions, interventions, snapshots, questions, events] = await Promise.all([
    db.facilitationSession.findMany({
      where: { deliberationId },
      orderBy: { openedAt: "asc" },
      select: { id: true, status: true, openedAt: true, closedAt: true },
    }),
    db.facilitationIntervention.findMany({
      where: { session: { deliberationId } },
      select: {
        kind: true,
        ruleName: true,
        appliedAt: true,
        dismissedAt: true,
        dismissedReasonTag: true,
      },
    }),
    db.equityMetricSnapshot.findMany({
      where: { session: { deliberationId } },
      orderBy: [{ windowEnd: "asc" }],
      select: {
        metricKind: true,
        value: true,
        windowEnd: true,
        isFinal: true,
      },
    }),
    db.facilitationQuestion.findMany({
      where: { deliberationId },
      include: { checks: { select: { severity: true } } },
    }),
    db.facilitationEvent.groupBy({
      by: ["sessionId"],
      where: { session: { deliberationId } },
      _count: { _all: true },
    }),
  ]);

  // ─── Sessions ────────────────────────────────────────────────────────
  const eventCountBySession = new Map<string, number>(
    events.map((e) => [e.sessionId, e._count._all]),
  );
  const sessionRows = sessions.map((s) => ({
    id: s.id,
    status: String(s.status),
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    durationMs:
      s.closedAt && s.openedAt ? s.closedAt.getTime() - s.openedAt.getTime() : null,
    eventCount: eventCountBySession.get(s.id) ?? 0,
  }));

  // ─── Interventions: per-kind, per-rule, per-tag ─────────────────────
  const ivAgg = {
    total: interventions.length,
    recommended: interventions.length,
    applied: 0,
    dismissed: 0,
    pending: 0,
    applyRate: 0,
    dismissRate: 0,
    applyRateByKind: {} as Record<
      FacilitationInterventionKind,
      { applied: number; total: number; rate: number }
    >,
    applyRateByRule: {} as Record<
      string,
      { applied: number; dismissed: number; total: number; rate: number }
    >,
    dismissalTagDistribution: {} as Record<string, number>,
  };

  for (const iv of interventions) {
    const kind = iv.kind as FacilitationInterventionKind;
    const kindSlot = (ivAgg.applyRateByKind[kind] ??= {
      applied: 0,
      total: 0,
      rate: 0,
    });
    kindSlot.total += 1;

    const rule = iv.ruleName ?? "(unknown)";
    const ruleSlot = (ivAgg.applyRateByRule[rule] ??= {
      applied: 0,
      dismissed: 0,
      total: 0,
      rate: 0,
    });
    ruleSlot.total += 1;

    if (iv.appliedAt) {
      ivAgg.applied += 1;
      kindSlot.applied += 1;
      ruleSlot.applied += 1;
    } else if (iv.dismissedAt) {
      ivAgg.dismissed += 1;
      ruleSlot.dismissed += 1;
      const tag = iv.dismissedReasonTag ? String(iv.dismissedReasonTag) : "untagged";
      ivAgg.dismissalTagDistribution[tag] =
        (ivAgg.dismissalTagDistribution[tag] ?? 0) + 1;
    } else {
      ivAgg.pending += 1;
    }
  }

  // Backfill all known kinds so consumers can rely on the key set.
  for (const k of Object.values(FacilitationInterventionKind)) {
    ivAgg.applyRateByKind[k] ??= { applied: 0, total: 0, rate: 0 };
  }
  for (const slot of Object.values(ivAgg.applyRateByKind)) {
    slot.rate = slot.total === 0 ? 0 : slot.applied / slot.total;
  }
  for (const slot of Object.values(ivAgg.applyRateByRule)) {
    slot.rate = slot.total === 0 ? 0 : slot.applied / slot.total;
  }
  ivAgg.applyRate = ivAgg.total === 0 ? 0 : ivAgg.applied / ivAgg.total;
  ivAgg.dismissRate = ivAgg.total === 0 ? 0 : ivAgg.dismissed / ivAgg.total;

  // ─── Metrics: first vs final per kind across the deliberation ───────
  type SnapRow = (typeof snapshots)[number];
  const byKind = new Map<EquityMetricKind, SnapRow[]>();
  for (const s of snapshots) {
    const kind = s.metricKind as EquityMetricKind;
    const arr = byKind.get(kind) ?? [];
    arr.push(s);
    byKind.set(kind, arr);
  }
  const startVsFinalByKind = {} as DeliberationAnalytics["metrics"]["startVsFinalByKind"];
  for (const kind of Object.values(EquityMetricKind) as EquityMetricKind[]) {
    const series = byKind.get(kind) ?? [];
    const first = series[0] ?? null;
    const finalSnap = series.find((s) => s.isFinal) ?? series[series.length - 1] ?? null;
    const firstValue = first ? Number(first.value as unknown as string) : null;
    const finalValue = finalSnap ? Number(finalSnap.value as unknown as string) : null;
    startVsFinalByKind[kind] = {
      firstValue,
      firstAt: first ? first.windowEnd : null,
      finalValue,
      finalAt: finalSnap ? finalSnap.windowEnd : null,
      delta:
        firstValue == null || finalValue == null ? null : finalValue - firstValue,
    };
  }

  // ─── Questions: lock attempts, reopens, check failure histogram ─────
  const checkHist = {
    [FacilitationCheckSeverity.BLOCK]: 0,
    [FacilitationCheckSeverity.WARN]: 0,
    [FacilitationCheckSeverity.INFO]: 0,
  };
  let lockAttempts = 0;
  let locked = 0;
  for (const q of questions) {
    // Each version is a lock attempt (revisions imply prior lock attempts).
    lockAttempts += q.version;
    if (q.lockedAt) locked += 1;
    for (const c of q.checks) {
      const sev = String(c.severity).toUpperCase() as FacilitationCheckSeverity;
      if (sev in checkHist) checkHist[sev] += 1;
    }
  }
  // Reopens are recorded as QUESTION_REOPENED events.
  const reopened = await db.facilitationEvent.count({
    where: {
      eventType: "QUESTION_REOPENED" as never,
      session: { deliberationId },
    },
  });

  return {
    deliberationId,
    generatedAt: new Date(),
    sessions: sessionRows,
    interventions: ivAgg,
    metrics: { startVsFinalByKind },
    questions: {
      lockAttempts,
      locked,
      reopened,
      checkFailureHistogram: checkHist,
    },
  };
}
