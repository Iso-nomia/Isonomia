/**
 * Facilitation — Reporting service (C2)
 *
 * Builds the post-close session report. Aggregates across:
 *   - locked questions (with version + check summaries)
 *   - applied / dismissed interventions (apply rate by rule kind, dismissal tag dist)
 *   - metric series (final isFinal=true snapshots per kind)
 *   - hash-chain attestation (verifyFacilitationChain)
 *
 * Cross-link to Scope A pathway report is exposed as `scopeAReportUrl` (TODO C3 join).
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { PrismaClient } from "@prisma/client";
import {
  EquityMetricKind,
  FacilitationInterventionKind,
} from "@/lib/facilitation/types";
import { verifyFacilitationChain } from "@/lib/facilitation/eventService";

type Db = PrismaClient | typeof defaultPrisma;

export interface FacilitationReport {
  sessionId: string;
  deliberationId: string;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  durationMs: number | null;

  questions: Array<{
    id: string;
    version: number;
    text: string;
    framingType: string;
    lockedAt: Date | null;
    authoredById: string;
    lockedById: string | null;
    checkSummary: { block: number; warn: number; info: number };
  }>;

  interventions: {
    total: number;
    applied: number;
    dismissed: number;
    pending: number;
    applyRateByKind: Record<string, { applied: number; total: number }>;
    dismissalTagDistribution: Record<string, number>;
  };

  metrics: Array<{
    metricKind: EquityMetricKind;
    finalValue: number | null;
    finalSnapshotId: string | null;
    finalAt: Date | null;
    seriesCount: number;
  }>;

  hashChain: {
    valid: boolean;
    failedIndex?: number;
    eventCount: number;
  };

  scopeAReportUrl: string | null;
}

export async function buildReport(
  sessionId: string,
  opts: { prismaClient?: Db } = {},
): Promise<FacilitationReport> {
  const db = opts.prismaClient ?? defaultPrisma;

  const session = await db.facilitationSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      deliberationId: true,
      status: true,
      openedAt: true,
      closedAt: true,
    },
  });
  if (!session) {
    throw new Error("session not found");
  }

  const [questions, interventions, snapshots, eventCount, verification] =
    await Promise.all([
      db.facilitationQuestion.findMany({
        where: { deliberationId: session.deliberationId, lockedAt: { not: null } },
        orderBy: { lockedAt: "asc" },
        include: {
          checks: { select: { severity: true } },
        },
      }),
      db.facilitationIntervention.findMany({
        where: { sessionId },
        select: {
          kind: true,
          appliedAt: true,
          dismissedAt: true,
          dismissedReasonTag: true,
        },
      }),
      db.equityMetricSnapshot.findMany({
        where: { sessionId },
        orderBy: [{ windowEnd: "asc" }],
        select: {
          id: true,
          metricKind: true,
          value: true,
          windowEnd: true,
          isFinal: true,
        },
      }),
      db.facilitationEvent.count({ where: { sessionId } }),
      verifyFacilitationChain(sessionId),
    ]);

  const questionRows = questions.map((q) => {
    const summary = { block: 0, warn: 0, info: 0 };
    for (const c of q.checks) {
      const sev = String(c.severity).toLowerCase();
      if (sev === "block") summary.block += 1;
      else if (sev === "warn") summary.warn += 1;
      else if (sev === "info") summary.info += 1;
    }
    return {
      id: q.id,
      version: q.version,
      text: q.text,
      framingType: String(q.framingType),
      lockedAt: q.lockedAt,
      authoredById: q.authoredById,
      lockedById: q.lockedById,
      checkSummary: summary,
    };
  });

  const ivAgg = {
    total: interventions.length,
    applied: 0,
    dismissed: 0,
    pending: 0,
    applyRateByKind: {} as Record<string, { applied: number; total: number }>,
    dismissalTagDistribution: {} as Record<string, number>,
  };
  for (const iv of interventions) {
    const kind = String(iv.kind);
    const slot = (ivAgg.applyRateByKind[kind] ??= { applied: 0, total: 0 });
    slot.total += 1;
    if (iv.appliedAt) {
      ivAgg.applied += 1;
      slot.applied += 1;
    } else if (iv.dismissedAt) {
      ivAgg.dismissed += 1;
      const tag = iv.dismissedReasonTag ? String(iv.dismissedReasonTag) : "untagged";
      ivAgg.dismissalTagDistribution[tag] =
        (ivAgg.dismissalTagDistribution[tag] ?? 0) + 1;
    } else {
      ivAgg.pending += 1;
    }
  }
  for (const k of Object.values(FacilitationInterventionKind)) {
    if (!ivAgg.applyRateByKind[k]) ivAgg.applyRateByKind[k] = { applied: 0, total: 0 };
  }

  const byKind = new Map<EquityMetricKind, typeof snapshots>();  for (const s of snapshots) {
    const kind = s.metricKind as EquityMetricKind;
    const arr = byKind.get(kind) ?? [];
    arr.push(s);
    byKind.set(kind, arr);
  }
  const metricRows = (Object.values(EquityMetricKind) as EquityMetricKind[]).map(
    (kind) => {
      const series = byKind.get(kind) ?? [];
      const finalSnap =
        series.find((s) => s.isFinal) ?? series[series.length - 1] ?? null;
      return {
        metricKind: kind,
        finalValue: finalSnap ? Number(finalSnap.value as unknown as string) : null,
        finalSnapshotId: finalSnap ? finalSnap.id : null,
        finalAt: finalSnap ? finalSnap.windowEnd : null,
        seriesCount: series.length,
      };
    },
  );

  // C4.5 — Cross-link to the most recent Scope A pathway for this
  // deliberation (if any). Additive only: the field is `null` when no
  // pathway has ever been opened. We surface the API endpoint URL because
  // there is no dedicated pathway report page yet — partners can hit the
  // pathway GET to retrieve the canonical state.
  const latestPathway = await db.institutionalPathway.findFirst({
    where: { deliberationId: session.deliberationId },
    orderBy: [{ openedAt: "desc" }],
    select: { id: true },
  });
  const scopeAReportUrl = latestPathway
    ? `/api/pathways/${latestPathway.id}`
    : null;

  return {
    sessionId: session.id,
    deliberationId: session.deliberationId,
    status: String(session.status),
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    durationMs:
      session.closedAt && session.openedAt
        ? session.closedAt.getTime() - session.openedAt.getTime()
        : null,

    questions: questionRows,
    interventions: ivAgg,
    metrics: metricRows,

    hashChain: {
      valid: verification.valid,
      ...(verification.valid ? {} : { failedIndex: verification.failedIndex }),
      eventCount,
    },

    scopeAReportUrl,
  };
}
