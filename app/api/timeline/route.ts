export const dynamic = "force-dynamic";

/**
 * Phase 3.4.3: Timeline API Endpoint
 * 
 * Returns timeline data for sources, deliberations, or stacks.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildSourceTimeline,
  buildDeliberationTimeline,
  buildStackTimeline,
  TimelineFilter,
  TimelineEventType,
} from "@/lib/timeline";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const id = searchParams.get("id");
  const sourceIdsParam = searchParams.get("sourceIds");

  // Parse optional filters
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const eventTypesParam = searchParams.get("eventTypes");
  const minImportanceParam = searchParams.get("minImportance");

  if (!type || !id) {
    return NextResponse.json(
      { error: "type and id query parameters are required" },
      { status: 400 }
    );
  }

  // Build filter object
  const filter: TimelineFilter = {};
  
  if (startDateParam) {
    const parsed = new Date(startDateParam);
    if (!isNaN(parsed.getTime())) {
      filter.startDate = parsed;
    }
  }
  
  if (endDateParam) {
    const parsed = new Date(endDateParam);
    if (!isNaN(parsed.getTime())) {
      filter.endDate = parsed;
    }
  }
  
  if (eventTypesParam) {
    filter.eventTypes = eventTypesParam.split(",") as TimelineEventType[];
  }
  
  if (minImportanceParam) {
    const parsed = parseInt(minImportanceParam, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      filter.minImportance = parsed;
    }
  }

  try {
    let timeline;

    switch (type) {
      case "deliberation":
        timeline = await buildDeliberationTimeline(id, filter);
        break;

      case "source":
        timeline = await buildSourceTimeline([id], filter);
        break;

      case "stack":
        // Can either use stack ID or explicit source IDs
        if (sourceIdsParam) {
          const sourceIds = sourceIdsParam.split(",").filter(Boolean);
          timeline = await buildSourceTimeline(sourceIds, filter);
        } else {
          timeline = await buildStackTimeline(id, filter);
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid type. Must be 'deliberation', 'source', or 'stack'" },
          { status: 400 }
        );
    }

    return NextResponse.json(timeline);
  } catch (error) {
    console.error("Timeline API error:", error);
    return NextResponse.json(
      { error: "Failed to build timeline" },
      { status: 500 }
    );
  }
}
