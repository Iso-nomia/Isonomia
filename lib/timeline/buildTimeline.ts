/**
 * Phase 3.4.3: Timeline Builder
 * 
 * Functions to build timeline data from sources, deliberations, etc.
 */

import { prisma } from "@/lib/prismaclient";
import { TimelineEvent, TimelineFilter, TimelineData, TimelineEventType } from "./types";

/**
 * Build a timeline for a set of sources
 * Shows publication dates, citations, and retractions
 */
export async function buildSourceTimeline(
  sourceIds: string[],
  filter?: TimelineFilter
): Promise<TimelineData> {
  const events: TimelineEvent[] = [];

  // Get sources with publication dates
  const sources = await prisma.source.findMany({
    where: { id: { in: sourceIds } },
    select: {
      id: true,
      title: true,
      year: true,
      retractionStatus: true,
      retractionDate: true,
      correctionStatus: true,
      correctionDate: true,
    },
  });

  for (const source of sources) {
    // Publication event (use year since publicationDate isn't available)
    if (source.year) {
      const pubDate = new Date(source.year, 0, 1); // Jan 1 of publication year
      events.push({
        id: `pub-${source.id}`,
        type: "source_published",
        date: pubDate,
        title: source.title || "Untitled source",
        entityType: "source",
        entityId: source.id,
        icon: "📄",
        importance: 3,
      });
    }

    // Retraction event
    if (source.retractionStatus === "retracted" && source.retractionDate) {
      events.push({
        id: `retract-${source.id}`,
        type: "retraction",
        date: source.retractionDate,
        title: `Retracted: ${source.title || "Untitled"}`,
        entityType: "source",
        entityId: source.id,
        icon: "⚠️",
        color: "#ef4444",
        importance: 5,
      });
    }

    // Correction event (any correction status except 'none')
    if (source.correctionStatus !== "none" && source.correctionDate) {
      events.push({
        id: `correct-${source.id}`,
        type: "correction",
        date: source.correctionDate,
        title: `Corrected: ${source.title || "Untitled"}`,
        entityType: "source",
        entityId: source.id,
        icon: "📝",
        color: "#f97316",
        importance: 4,
      });
    }
  }

  // Get citation events - traverse via target to get deliberation
  const citations = await prisma.citation.findMany({
    where: { sourceId: { in: sourceIds } },
    select: {
      id: true,
      sourceId: true,
      createdAt: true,
      targetType: true,
      targetId: true,
      source: { select: { title: true } },
    },
  });

  // Get deliberation titles for citations that target arguments
  const argumentIds = citations
    .filter((c) => c.targetType === "argument")
    .map((c) => c.targetId);

  const argumentsWithDelib = argumentIds.length > 0
    ? await prisma.argument.findMany({
        where: { id: { in: argumentIds } },
        select: {
          id: true,
          deliberation: { select: { id: true, title: true } },
        },
      })
    : [];

  const argDelibMap = new Map(
    argumentsWithDelib.map((a) => [a.id, a.deliberation])
  );

  for (const citation of citations) {
    const delib = citation.targetType === "argument"
      ? argDelibMap.get(citation.targetId)
      : null;

    events.push({
      id: `cite-${citation.id}`,
      type: "source_cited",
      date: citation.createdAt,
      title: `Cited in: ${delib?.title || "Discussion"}`,
      description: citation.source.title || undefined,
      entityType: "citation",
      entityId: citation.id,
      icon: "🔗",
      importance: 2,
    });
  }

  return applyFiltersAndBuildData(events, filter);
}

/**
 * Build a timeline for a deliberation
 * Shows when it started, arguments added, and sources cited
 */
export async function buildDeliberationTimeline(
  deliberationId: string,
  filter?: TimelineFilter
): Promise<TimelineData> {
  const events: TimelineEvent[] = [];

  // Get deliberation
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  if (deliberation) {
    events.push({
      id: `delib-start-${deliberation.id}`,
      type: "deliberation_started",
      date: deliberation.createdAt,
      title: "Deliberation started",
      description: deliberation.title || undefined,
      entityType: "deliberation",
      entityId: deliberation.id,
      icon: "💬",
      importance: 4,
    });
  }

  // Get arguments
  const arguments_ = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      id: true,
      text: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const arg of arguments_) {
    events.push({
      id: `arg-${arg.id}`,
      type: "argument_created",
      date: arg.createdAt,
      title: arg.text?.slice(0, 100) || "New argument",
      entityType: "argument",
      entityId: arg.id,
      icon: "⚔️",
      importance: 3,
    });
  }

  // Get citations within this deliberation (via arguments)
  const argIds = arguments_.map((a) => a.id);
  
  const citations = argIds.length > 0
    ? await prisma.citation.findMany({
        where: {
          targetType: "argument",
          targetId: { in: argIds },
        },
        include: {
          source: {
            select: {
              id: true,
              title: true,
              year: true,
            },
          },
        },
      })
    : [];

  for (const citation of citations) {
    // Citation added event
    events.push({
      id: `cite-${citation.id}`,
      type: "source_cited",
      date: citation.createdAt,
      title: `Source cited: ${(citation.source.title || "Unknown").slice(0, 60)}`,
      entityType: "citation",
      entityId: citation.id,
      icon: "📎",
      importance: 2,
    });
  }

  // Get claims created in this deliberation
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: {
      id: true,
      text: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  for (const claim of claims) {
    events.push({
      id: `claim-${claim.id}`,
      type: "claim_made",
      date: claim.createdAt,
      title: claim.text?.slice(0, 100) || "New claim",
      entityType: "claim",
      entityId: claim.id,
      icon: "💡",
      importance: 3,
    });
  }

  return applyFiltersAndBuildData(events, filter);
}

/**
 * Build a timeline for a stack (based on its sources)
 * Sources are linked to LibraryPosts via the libraryPostId field on Source
 */
export async function buildStackTimeline(
  stackId: string,
  filter?: TimelineFilter
): Promise<TimelineData> {
  // Get LibraryPost IDs in this stack
  const stackItems = await prisma.stackItem.findMany({
    where: { stackId },
    select: { blockId: true },
  });

  if (stackItems.length === 0) {
    return {
      events: [],
      dateRange: { earliest: new Date(), latest: new Date() },
      summary: { totalEvents: 0, byType: {}, byYear: {} },
    };
  }

  const blockIds = stackItems
    .map((item) => item.blockId)
    .filter((id): id is string => id !== null);

  // Get sources that are linked to these LibraryPosts
  const sources = await prisma.source.findMany({
    where: { libraryPostId: { in: blockIds } },
    select: { id: true },
  });

  if (sources.length === 0) {
    return {
      events: [],
      dateRange: { earliest: new Date(), latest: new Date() },
      summary: { totalEvents: 0, byType: {}, byYear: {} },
    };
  }

  const sourceIds = sources.map((s) => s.id);
  return buildSourceTimeline(sourceIds, filter);
}

/**
 * Apply filters and build summary data
 */
function applyFiltersAndBuildData(
  events: TimelineEvent[],
  filter?: TimelineFilter
): TimelineData {
  let filteredEvents = events;

  if (filter?.startDate) {
    filteredEvents = filteredEvents.filter((e) => e.date >= filter.startDate!);
  }
  if (filter?.endDate) {
    filteredEvents = filteredEvents.filter((e) => e.date <= filter.endDate!);
  }
  if (filter?.eventTypes?.length) {
    filteredEvents = filteredEvents.filter((e) =>
      filter.eventTypes!.includes(e.type)
    );
  }
  if (filter?.minImportance) {
    filteredEvents = filteredEvents.filter(
      (e) => (e.importance || 1) >= filter.minImportance!
    );
  }

  // Sort by date
  filteredEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Build summary
  const byType: Record<string, number> = {};
  const byYear: Record<number, number> = {};

  for (const event of filteredEvents) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    const year = event.date.getFullYear();
    byYear[year] = (byYear[year] || 0) + 1;
  }

  return {
    events: filteredEvents,
    dateRange: {
      earliest: filteredEvents[0]?.date || new Date(),
      latest: filteredEvents[filteredEvents.length - 1]?.date || new Date(),
    },
    summary: {
      totalEvents: filteredEvents.length,
      byType,
      byYear,
    },
  };
}
