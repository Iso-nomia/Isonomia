export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { buildDialogueAwareGraph } from "@/lib/aif/graph-builder";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/aif/graph-with-dialogue
 * 
 * Returns a complete AIF graph with dialogue layer for a deliberation.
 * Includes nodes, edges, dialogue moves, and commitment stores.
 * 
 * Query params:
 * - deliberationId (required): ID of the deliberation
 * - includeDialogue (optional): Whether to include DM-nodes (default: false)
 * - includeMoves (optional): "all" | "protocol" | "structural" (default: "all")
 * - participantFilter (optional): Filter to specific participant's contributions
 * - timeRange (optional): JSON object {start: ISO8601, end: ISO8601}
 */
export async function GET(req: NextRequest) {
  try {
    // Get current user ID for authorization
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const deliberationId = searchParams.get("deliberationId");
    
    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing required parameter: deliberationId" },
        { status: 400 }
      );
    }

    // Parse optional parameters
    const includeDialogue = searchParams.get("includeDialogue") === "true";
    const includeMoves = searchParams.get("includeMoves") || "all";
    const participantFilter = searchParams.get("participantFilter") || undefined;
    const timeRangeStr = searchParams.get("timeRange");

    // Validate includeMoves parameter
    if (!["all", "protocol", "structural"].includes(includeMoves)) {
      return NextResponse.json(
        { error: "includeMoves must be 'all', 'protocol', or 'structural'" },
        { status: 400 }
      );
    }

    // Parse timeRange if provided
    let timeRange: { start: string; end: string } | undefined;
    if (timeRangeStr) {
      try {
        timeRange = JSON.parse(timeRangeStr);
        if (!timeRange?.start || !timeRange?.end) {
          throw new Error("timeRange must have 'start' and 'end' properties");
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid timeRange format. Expected JSON: {start: ISO8601, end: ISO8601}" },
          { status: 400 }
        );
      }
    }

    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: {
        id: true,
      },
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // Build the graph with dialogue layer
    const graph = await buildDialogueAwareGraph(deliberationId, {
      includeDialogue,
      includeMoves: includeMoves as "all" | "protocol" | "structural",
      participantFilter,
      timeRange,
    });

    return NextResponse.json(graph, { 
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60", // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error("Error building dialogue-aware graph:", error);
    return NextResponse.json(
      { 
        error: "Failed to build graph",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
