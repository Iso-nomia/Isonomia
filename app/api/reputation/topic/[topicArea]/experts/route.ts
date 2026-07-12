export const dynamic = "force-dynamic";

/**
 * Topic experts endpoint
 * Phase 4.2: Argumentation-Based Reputation
 */

import { NextRequest, NextResponse } from "next/server";
import { getTopicExperts, getTopicExpertiseSummary } from "@/lib/reputation/expertiseService";

type RouteContext = { params: Promise<{ topicArea: string }> };

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { topicArea: rawTopicArea } = await context.params;
    // URL decode the topic area since it may contain special characters
    const topicArea = decodeURIComponent(rawTopicArea);

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const includeSummary = searchParams.get("summary") === "true";

    const experts = await getTopicExperts(topicArea, limit);

    if (includeSummary) {
      const summary = await getTopicExpertiseSummary(topicArea);
      return NextResponse.json({ experts, summary });
    }

    return NextResponse.json(experts);
  } catch (error) {
    console.error("Error fetching experts:", error);
    return NextResponse.json(
      { error: "Failed to fetch experts" },
      { status: 500 }
    );
  }
}
