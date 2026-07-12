export const dynamic = "force-dynamic";

// app/api/sources/[id]/provenance/route.ts
// Phase 3.3: Evidence Provenance Chain API
// Returns the provenance chain showing how evidence flows through the platform

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getProvenanceChain } from "@/lib/provenance/recorder";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params;

  try {
    const session = await getServerSession(authOptions);

    // Get the provenance chain
    const { events, summary } = await getProvenanceChain(sourceId, 100);

    // Get source basic info
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        title: true,
        kind: true,
        authorsJson: true,
        year: true,
        doi: true,
        url: true,
        createdById: true,
        createdAt: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Enrich events with context names where possible
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        let fromName: string | null = null;
        let toName: string | null = null;

        // Get from context name
        if (event.fromType === "stack" && event.fromId) {
          const stack = await prisma.stack.findUnique({
            where: { id: event.fromId },
            select: { name: true },
          });
          fromName = stack?.name || null;
        } else if (event.fromType === "deliberation" && event.fromId) {
          const delib = await prisma.deliberation.findUnique({
            where: { id: event.fromId },
            select: { title: true },
          });
          fromName = delib?.title || null;
        }

        // Get to context name
        if (event.toType === "stack" && event.toId) {
          const stack = await prisma.stack.findUnique({
            where: { id: event.toId },
            select: { name: true },
          });
          toName = stack?.name || null;
        } else if (event.toType === "deliberation" && event.toId) {
          const delib = await prisma.deliberation.findUnique({
            where: { id: event.toId },
            select: { title: true },
          });
          toName = delib?.title || null;
        } else if (event.toType === "argument" && event.toId) {
          const arg = await prisma.argument.findUnique({
            where: { id: event.toId },
            select: { text: true },
          });
          toName = arg?.text?.substring(0, 50) || null;
        }

        // Get actor info
        let actorName: string | null = null;
        if (event.actorId) {
          // Try to find user by auth_id
          const user = await prisma.user.findFirst({
            where: { auth_id: event.actorId },
            select: { username: true, name: true },
          });
          actorName = user?.name || user?.username || null;
        }

        return {
          ...event,
          fromName,
          toName,
          actorName,
        };
      })
    );

    // Build a timeline representation
    const timeline = buildProvenanceTimeline(enrichedEvents);

    return NextResponse.json({
      source: {
        id: source.id,
        title: source.title,
        kind: source.kind,
        authors: source.authorsJson,
        year: source.year,
        doi: source.doi,
        url: source.url,
        createdAt: source.createdAt,
      },
      events: enrichedEvents,
      summary: {
        ...summary,
        eventTypeLabels: {
          imported: "Imported to platform",
          cited: "Cited in argument",
          lifted_to_stack: "Lifted to stack",
          imported_from_stack: "Imported from stack",
          forked: "Stack forked",
          shared: "Shared",
          exported: "Exported",
        },
      },
      timeline,
    });
  } catch (error) {
    console.error(`[Provenance] Error fetching provenance for ${sourceId}:`, error);
    return NextResponse.json(
      { error: "Failed to fetch provenance chain" },
      { status: 500 }
    );
  }
}

interface EnrichedEvent {
  id: string;
  eventType: string;
  actorId: string;
  actorName: string | null;
  fromType: string | null;
  fromId: string | null;
  fromName: string | null;
  toType: string | null;
  toId: string | null;
  toName: string | null;
  metadata: unknown;
  createdAt: Date;
}

interface TimelineNode {
  id: string;
  type: "event" | "context";
  eventType?: string;
  label: string;
  timestamp: Date;
  actorName?: string | null;
  contextType?: string;
  contextId?: string;
  contextName?: string | null;
}

function buildProvenanceTimeline(events: EnrichedEvent[]): TimelineNode[] {
  const timeline: TimelineNode[] = [];
  const seenContexts = new Set<string>();

  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const event of sortedEvents) {
    // Add event node
    let label = getEventLabel(event.eventType);
    if (event.actorName) {
      label += ` by ${event.actorName}`;
    }

    timeline.push({
      id: event.id,
      type: "event",
      eventType: event.eventType,
      label,
      timestamp: event.createdAt,
      actorName: event.actorName,
    });

    // Add context node if new
    if (event.toType && event.toId) {
      const contextKey = `${event.toType}:${event.toId}`;
      if (!seenContexts.has(contextKey)) {
        seenContexts.add(contextKey);
        timeline.push({
          id: `context-${event.toId}`,
          type: "context",
          label: event.toName || `${event.toType} ${event.toId.substring(0, 8)}`,
          timestamp: event.createdAt,
          contextType: event.toType,
          contextId: event.toId,
          contextName: event.toName,
        });
      }
    }
  }

  return timeline;
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    imported: "Imported",
    cited: "Cited",
    lifted_to_stack: "Lifted to stack",
    imported_from_stack: "Imported from stack",
    forked: "Forked",
    shared: "Shared",
    exported: "Exported",
  };
  return labels[eventType] || eventType;
}
