/**
 * Facilitation — Canonical export service (C4.2)
 *
 * Produces a stable, versioned JSON snapshot of a single facilitation
 * session intended for:
 *
 *   - Long-term archival (audit trails outliving the database).
 *   - Hand-off to partners who want to verify the hash chain locally.
 *   - Downstream consumers (Scope B, research pipelines).
 *
 * Contract guarantees:
 *
 *   • `schemaVersion` is semver. Breaking changes bump major.
 *   • Field order is irrelevant — consumers MUST parse by name.
 *   • All time fields are ISO-8601 strings (UTC).
 *   • The `events` array is ordered by `createdAt ASC` and includes the
 *     full hash chain (`hashChainPrev` + `hashChainSelf`) so the chain
 *     can be re-verified offline.
 *   • Removing or renaming a top-level field is a breaking change.
 *   • Adding a new optional field is non-breaking.
 *
 * The companion HTML view lives at
 * `app/deliberations/[id]/facilitation/report/page.tsx` (C3.7).
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { PrismaClient } from "@prisma/client";
import { verifyFacilitationChain } from "@/lib/facilitation/eventService";
import { buildReport, type FacilitationReport } from "@/lib/facilitation/reportService";

export const FACILITATION_EXPORT_SCHEMA_VERSION = "1.0.0";

type Db = PrismaClient | typeof defaultPrisma;

export interface CanonicalFacilitationExport {
  schemaVersion: string;
  generator: "mesh-facilitation";
  generatedAt: string;
  session: {
    id: string;
    deliberationId: string;
    status: string;
    isPublic: boolean;
    openedAt: string;
    closedAt: string | null;
    openedById: string;
    summary: string | null;
  };
  questions: Array<{
    id: string;
    parentQuestionId: string | null;
    version: number;
    text: string;
    framingType: string;
    authoredById: string;
    lockedById: string | null;
    lockedAt: string | null;
    createdAt: string;
    checks: Array<{
      id: string;
      runId: string;
      kind: string;
      severity: string;
      messageText: string;
      evidenceJson: unknown;
      acknowledgedById: string | null;
      acknowledgedAt: string | null;
      createdAt: string;
    }>;
  }>;
  interventions: Array<{
    id: string;
    kind: string;
    ruleName: string;
    ruleVersion: number;
    targetType: string;
    targetId: string;
    priority: number;
    rationaleJson: unknown;
    triggeredByMetric: string | null;
    triggeredByMetricSnapshotId: string | null;
    recommendedAt: string;
    appliedAt: string | null;
    appliedById: string | null;
    dismissedAt: string | null;
    dismissedById: string | null;
    dismissedReasonTag: string | null;
    dismissedReasonText: string | null;
    createdAt: string;
  }>;
  metricSnapshots: Array<{
    id: string;
    metricKind: string;
    value: number;
    windowStart: string;
    windowEnd: string;
    breakdownJson: unknown;
    isFinal: boolean;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorId: string;
    actorRole: string;
    payloadJson: unknown;
    interventionId: string | null;
    metricSnapshotId: string | null;
    hashChainPrev: string | null;
    hashChainSelf: string;
    createdAt: string;
  }>;
  hashChain: {
    valid: boolean;
    failedIndex?: number;
    eventCount: number;
    firstHash: string | null;
    lastHash: string | null;
  };
  rollup: FacilitationReport;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function buildCanonicalExport(
  sessionId: string,
  opts: { prismaClient?: Db } = {},
): Promise<CanonicalFacilitationExport> {
  const db = opts.prismaClient ?? defaultPrisma;

  const session = await db.facilitationSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    throw new Error("session not found");
  }

  const [questions, interventions, snapshots, events, verification, rollup] =
    await Promise.all([
      db.facilitationQuestion.findMany({
        where: { deliberationId: session.deliberationId },
        orderBy: [{ createdAt: "asc" }],
        include: { checks: { orderBy: { createdAt: "asc" } } },
      }),
      db.facilitationIntervention.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
      }),
      db.equityMetricSnapshot.findMany({
        where: { sessionId },
        orderBy: { windowEnd: "asc" },
      }),
      db.facilitationEvent.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
      }),
      verifyFacilitationChain(sessionId),
      buildReport(sessionId, { prismaClient: db }),
    ]);

  return {
    schemaVersion: FACILITATION_EXPORT_SCHEMA_VERSION,
    generator: "mesh-facilitation",
    generatedAt: new Date().toISOString(),
    session: {
      id: session.id,
      deliberationId: session.deliberationId,
      status: String(session.status),
      isPublic: session.isPublic,
      openedAt: session.openedAt.toISOString(),
      closedAt: iso(session.closedAt),
      openedById: session.openedById,
      summary: session.summary ?? null,
    },
    questions: questions.map((q) => ({
      id: q.id,
      parentQuestionId: q.parentQuestionId,
      version: q.version,
      text: q.text,
      framingType: String(q.framingType),
      authoredById: q.authoredById,
      lockedById: q.lockedById,
      lockedAt: iso(q.lockedAt),
      createdAt: q.createdAt.toISOString(),
      checks: q.checks.map((c) => ({
        id: c.id,
        runId: c.runId,
        kind: String(c.kind),
        severity: String(c.severity),
        messageText: c.messageText,
        evidenceJson: c.evidenceJson,
        acknowledgedById: c.acknowledgedById,
        acknowledgedAt: iso(c.acknowledgedAt),
        createdAt: c.createdAt.toISOString(),
      })),
    })),
    interventions: interventions.map((iv) => ({
      id: iv.id,
      kind: String(iv.kind),
      ruleName: iv.ruleName,
      ruleVersion: iv.ruleVersion,
      targetType: String(iv.targetType),
      targetId: iv.targetId,
      priority: iv.priority,
      rationaleJson: iv.rationaleJson,
      triggeredByMetric: iv.triggeredByMetric ? String(iv.triggeredByMetric) : null,
      triggeredByMetricSnapshotId: iv.triggeredByMetricSnapshotId,
      recommendedAt: iv.recommendedAt.toISOString(),
      appliedAt: iso(iv.appliedAt),
      appliedById: iv.appliedById,
      dismissedAt: iso(iv.dismissedAt),
      dismissedById: iv.dismissedById,
      dismissedReasonTag: iv.dismissedReasonTag ? String(iv.dismissedReasonTag) : null,
      dismissedReasonText: iv.dismissedReasonText ?? null,
      createdAt: iv.createdAt.toISOString(),
    })),
    metricSnapshots: snapshots.map((s) => ({
      id: s.id,
      metricKind: String(s.metricKind),
      value: Number(s.value as unknown as string),
      windowStart: s.windowStart.toISOString(),
      windowEnd: s.windowEnd.toISOString(),
      breakdownJson: s.breakdownJson,
      isFinal: s.isFinal,
      createdAt: s.createdAt.toISOString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      eventType: String(e.eventType),
      actorId: e.actorId,
      actorRole: e.actorRole,
      payloadJson: e.payloadJson,
      interventionId: e.interventionId,
      metricSnapshotId: e.metricSnapshotId,
      hashChainPrev: e.hashChainPrev,
      hashChainSelf: e.hashChainSelf,
      createdAt: e.createdAt.toISOString(),
    })),
    hashChain: {
      valid: verification.valid,
      ...(verification.valid ? {} : { failedIndex: verification.failedIndex }),
      eventCount: events.length,
      firstHash: events[0]?.hashChainSelf ?? null,
      lastHash: events.at(-1)?.hashChainSelf ?? null,
    },
    rollup,
  };
}
