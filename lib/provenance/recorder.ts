// lib/provenance/recorder.ts
// Phase 3.3: Evidence Provenance Recording
// Track how sources flow through the platform

import { prisma } from "@/lib/prismaclient";
import { Prisma, ProvenanceEventType } from "@prisma/client";

interface RecordProvenanceOptions {
  sourceId: string;
  eventType: ProvenanceEventType;
  actorId: string;
  fromType?: string;
  fromId?: string;
  toType?: string;
  toId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Record a provenance event for a source
 * This tracks how evidence flows through the platform
 */
export async function recordProvenanceEvent(
  options: RecordProvenanceOptions
): Promise<void> {
  const {
    sourceId,
    eventType,
    actorId,
    fromType,
    fromId,
    toType,
    toId,
    metadata,
  } = options;

  try {
    await prisma.evidenceProvenanceEvent.create({
      data: {
        sourceId,
        eventType,
        actorId,
        fromType,
        fromId,
        toType,
        toId,
        metadata: (metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    console.log(`[Provenance] Recorded ${eventType} for source ${sourceId}`);
  } catch (error) {
    console.error(`[Provenance] Error recording ${eventType} for source ${sourceId}:`, error);
    // Don't throw - provenance is supplementary, not critical path
  }
}

/**
 * Record when a source is first imported to the platform
 */
export async function recordSourceImport(
  sourceId: string,
  actorId: string,
  importSource: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "imported",
    actorId,
    fromType: "external",
    fromId: importSource,
    metadata: { importSource, ...metadata },
  });
}

/**
 * Record when a source is cited in an argument or claim
 */
export async function recordCitation(
  sourceId: string,
  actorId: string,
  targetType: string,
  targetId: string,
  citationId?: string
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "cited",
    actorId,
    toType: targetType,
    toId: targetId,
    metadata: citationId ? { citationId } : undefined,
  });
}

/**
 * Record when a citation is lifted to a stack
 */
export async function recordLiftToStack(
  sourceId: string,
  actorId: string,
  citationId: string,
  stackId: string
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "lifted_to_stack",
    actorId,
    fromType: "citation",
    fromId: citationId,
    toType: "stack",
    toId: stackId,
  });
}

/**
 * Record when a source is imported from another user's stack
 */
export async function recordStackImport(
  sourceId: string,
  actorId: string,
  fromStackId: string,
  toStackId: string
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "imported_from_stack",
    actorId,
    fromType: "stack",
    fromId: fromStackId,
    toType: "stack",
    toId: toStackId,
  });
}

/**
 * Record when a stack containing this source is forked
 */
export async function recordStackFork(
  sourceId: string,
  actorId: string,
  originalStackId: string,
  forkedStackId: string
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "forked",
    actorId,
    fromType: "stack",
    fromId: originalStackId,
    toType: "stack",
    toId: forkedStackId,
  });
}

/**
 * Record when a source is shared via direct link
 */
export async function recordShare(
  sourceId: string,
  actorId: string,
  contextType: string,
  contextId: string,
  recipientId?: string
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "shared",
    actorId,
    fromType: contextType,
    fromId: contextId,
    metadata: recipientId ? { recipientId } : undefined,
  });
}

/**
 * Record when a source is exported to a reference manager
 */
export async function recordExport(
  sourceId: string,
  actorId: string,
  exportFormat: string,
  exportDestination?: string
): Promise<void> {
  await recordProvenanceEvent({
    sourceId,
    eventType: "exported",
    actorId,
    metadata: {
      format: exportFormat,
      destination: exportDestination,
    },
  });
}

/**
 * Get the provenance chain for a source
 */
export async function getProvenanceChain(
  sourceId: string,
  limit = 50
): Promise<{
  events: Array<{
    id: string;
    eventType: ProvenanceEventType;
    actorId: string;
    fromType: string | null;
    fromId: string | null;
    toType: string | null;
    toId: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
  summary: {
    totalEvents: number;
    firstImport: Date | null;
    latestActivity: Date | null;
    uniqueActors: number;
    eventTypeCounts: Record<ProvenanceEventType, number>;
  };
}> {
  const events = await prisma.evidenceProvenanceEvent.findMany({
    where: { sourceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Calculate summary stats
  const eventTypeCounts: Record<string, number> = {};
  const actorIds = new Set<string>();
  let firstImport: Date | null = null;
  let latestActivity: Date | null = null;

  for (const event of events) {
    // Count event types
    eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
    
    // Track unique actors
    actorIds.add(event.actorId);
    
    // Find first import
    if (event.eventType === "imported" && (!firstImport || event.createdAt < firstImport)) {
      firstImport = event.createdAt;
    }
    
    // Find latest activity
    if (!latestActivity || event.createdAt > latestActivity) {
      latestActivity = event.createdAt;
    }
  }

  return {
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actorId: e.actorId,
      fromType: e.fromType,
      fromId: e.fromId,
      toType: e.toType,
      toId: e.toId,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
    summary: {
      totalEvents: events.length,
      firstImport,
      latestActivity,
      uniqueActors: actorIds.size,
      eventTypeCounts: eventTypeCounts as Record<ProvenanceEventType, number>,
    },
  };
}
