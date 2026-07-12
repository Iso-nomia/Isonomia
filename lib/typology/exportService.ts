/**
 * Typology — Canonical export service (B2)
 *
 * Stable, versioned JSON snapshot of all typology rows + the full
 * MetaConsensusEvent chain for a deliberation. Designed to outlive the
 * DB, support offline hash-chain verification, and feed downstream
 * institutional report consumers.
 *
 * Contract guarantees mirror Scope C:
 *   • `schemaVersion` is semver. Removing/renaming a top-level field is a
 *     breaking change (bump major + notify named subscribers).
 *   • Field order is irrelevant — consumers MUST parse by name.
 *   • All time fields are ISO-8601 strings (UTC).
 *   • `events` is ordered by `createdAt ASC` and includes
 *     `hashChainPrev` + `hashChainSelf` so the chain is offline-verifiable.
 */

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { PrismaClient } from "@prisma/client";
import { verifyMetaConsensusChain } from "./typologyEventService";

export const TYPOLOGY_EXPORT_SCHEMA_VERSION = "1.0.0";

type Db = PrismaClient | typeof defaultPrisma;

export interface CanonicalTypologyExport {
  schemaVersion: string;
  generator: "mesh-typology";
  generatedAt: string;
  deliberationId: string;
  axes: Array<{
    id: string;
    key: string;
    displayName: string;
    description: string | null;
    colorToken: string | null;
    interventionHint: string | null;
    version: number;
    isActive: boolean;
  }>;
  tags: Array<{
    id: string;
    deliberationId: string;
    sessionId: string | null;
    targetType: string;
    targetId: string;
    axisId: string;
    axisKey: string;
    axisVersion: number;
    confidence: string;
    evidenceText: string;
    evidenceJson: unknown;
    authoredById: string;
    authoredRole: string;
    seedSource: string;
    seedReferenceJson: unknown;
    promotedFromCandidateId: string | null;
    confirmedAt: string | null;
    confirmedById: string | null;
    retractedAt: string | null;
    retractedById: string | null;
    retractedReasonText: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  candidates: Array<{
    id: string;
    sessionId: string;
    targetType: string | null;
    targetId: string | null;
    suggestedAxisId: string;
    suggestedAxisKey: string;
    suggestedAxisVersion: number;
    seedSource: string;
    seedReferenceJson: unknown;
    rationaleText: string;
    priority: number;
    ruleName: string;
    ruleVersion: number;
    promotedToTagId: string | null;
    promotedAt: string | null;
    promotedById: string | null;
    dismissedAt: string | null;
    dismissedById: string | null;
    dismissedReasonText: string | null;
    createdAt: string;
  }>;
  summaries: Array<{
    id: string;
    deliberationId: string;
    sessionId: string | null;
    version: number;
    status: string;
    parentSummaryId: string | null;
    authoredById: string;
    publishedAt: string | null;
    publishedById: string | null;
    retractedAt: string | null;
    retractedById: string | null;
    retractedReasonText: string | null;
    bodyJson: unknown;
    narrativeText: string | null;
    snapshotJson: unknown;
    snapshotHash: string | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    sessionId: string | null;
    eventType: string;
    actorId: string;
    actorRole: string;
    payloadJson: unknown;
    tagId: string | null;
    summaryId: string | null;
    candidateId: string | null;
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
}

export async function buildCanonicalExport(
  deliberationId: string,
  opts: { prismaClient?: Db } = {},
): Promise<CanonicalTypologyExport> {
  const db = opts.prismaClient ?? defaultPrisma;

  const delib = await db.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true },
  });
  if (!delib) throw new Error("deliberation not found");

  const [axes, tags, candidates, summaries, events] = await Promise.all([
    db.disagreementAxis.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
    db.disagreementTag.findMany({
      where: { deliberationId },
      include: { axis: true },
      orderBy: { createdAt: "asc" },
    }),
    db.typologyCandidate.findMany({
      where: { deliberationId },
      include: { suggestedAxis: true },
      orderBy: { createdAt: "asc" },
    }),
    db.metaConsensusSummary.findMany({
      where: { deliberationId },
      orderBy: { createdAt: "asc" },
    }),
    db.metaConsensusEvent.findMany({
      where: { deliberationId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Verify each chain scope independently (deliberation-level + each session).
  const scopes = new Set<string | null>();
  scopes.add(null);
  for (const e of events) scopes.add(e.sessionId);

  let allValid = true;
  let firstFailedIndex: number | undefined;
  for (const sid of scopes) {
    const v = await verifyMetaConsensusChain(deliberationId, sid);
    if (!v.valid) {
      allValid = false;
      if (firstFailedIndex === undefined) firstFailedIndex = v.failedIndex;
    }
  }

  return {
    schemaVersion: TYPOLOGY_EXPORT_SCHEMA_VERSION,
    generator: "mesh-typology",
    generatedAt: new Date().toISOString(),
    deliberationId,
    axes: axes.map((a) => ({
      id: a.id,
      key: String(a.key),
      displayName: a.displayName,
      description: a.description,
      colorToken: a.colorToken,
      interventionHint: a.interventionHint,
      version: a.version,
      isActive: a.isActive,
    })),
    tags: tags.map((t) => ({
      id: t.id,
      deliberationId: t.deliberationId,
      sessionId: t.sessionId,
      targetType: String(t.targetType),
      targetId: t.targetId,
      axisId: t.axisId,
      axisKey: String(t.axis.key),
      axisVersion: t.axisVersion,
      confidence: t.confidence.toString(),
      evidenceText: t.evidenceText,
      evidenceJson: t.evidenceJson,
      authoredById: t.authoredById,
      authoredRole: String(t.authoredRole),
      seedSource: String(t.seedSource),
      seedReferenceJson: t.seedReferenceJson,
      promotedFromCandidateId: t.promotedFromCandidateId,
      confirmedAt: t.confirmedAt?.toISOString() ?? null,
      confirmedById: t.confirmedById,
      retractedAt: t.retractedAt?.toISOString() ?? null,
      retractedById: t.retractedById,
      retractedReasonText: t.retractedReasonText,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    candidates: candidates.map((c) => ({
      id: c.id,
      sessionId: c.sessionId,
      targetType: c.targetType ? String(c.targetType) : null,
      targetId: c.targetId,
      suggestedAxisId: c.suggestedAxisId,
      suggestedAxisKey: String(c.suggestedAxis.key),
      suggestedAxisVersion: c.suggestedAxisVersion,
      seedSource: String(c.seedSource),
      seedReferenceJson: c.seedReferenceJson,
      rationaleText: c.rationaleText,
      priority: c.priority,
      ruleName: c.ruleName,
      ruleVersion: c.ruleVersion,
      promotedToTagId: c.promotedToTagId,
      promotedAt: c.promotedAt?.toISOString() ?? null,
      promotedById: c.promotedById,
      dismissedAt: c.dismissedAt?.toISOString() ?? null,
      dismissedById: c.dismissedById,
      dismissedReasonText: c.dismissedReasonText,
      createdAt: c.createdAt.toISOString(),
    })),
    summaries: summaries.map((s) => ({
      id: s.id,
      deliberationId: s.deliberationId,
      sessionId: s.sessionId,
      version: s.version,
      status: String(s.status),
      parentSummaryId: s.parentSummaryId,
      authoredById: s.authoredById,
      publishedAt: s.publishedAt?.toISOString() ?? null,
      publishedById: s.publishedById,
      retractedAt: s.retractedAt?.toISOString() ?? null,
      retractedById: s.retractedById,
      retractedReasonText: s.retractedReasonText,
      bodyJson: s.bodyJson,
      narrativeText: s.narrativeText,
      snapshotJson: s.snapshotJson,
      snapshotHash: s.snapshotHash,
      createdAt: s.createdAt.toISOString(),
    })),
    events: events.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      eventType: String(e.eventType),
      actorId: e.actorId,
      actorRole: e.actorRole,
      payloadJson: e.payloadJson,
      tagId: e.tagId,
      summaryId: e.summaryId,
      candidateId: e.candidateId,
      hashChainPrev: e.hashChainPrev,
      hashChainSelf: e.hashChainSelf,
      createdAt: e.createdAt.toISOString(),
    })),
    hashChain: {
      valid: allValid,
      ...(allValid ? {} : { failedIndex: firstFailedIndex ?? -1 }),
      eventCount: events.length,
      firstHash: events[0]?.hashChainSelf ?? null,
      lastHash: events.at(-1)?.hashChainSelf ?? null,
    },
  };
}
