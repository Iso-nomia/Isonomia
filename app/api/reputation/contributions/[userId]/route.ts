export const dynamic = "force-dynamic";

/**
 * User contributions endpoint
 * Phase 4.2: Argumentation-Based Reputation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getUserContributions,
  getContributionSummary,
} from "@/lib/reputation/contributionService";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import { ContributionType } from "@/lib/reputation/types";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const { userId } = await context.params;

    // Handle "me" shorthand
    let targetUserId = userId;
    if (userId === "me") {
      const supabase = getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const dbUser = await prisma.user.findUnique({
        where: { auth_id: user.id },
        select: { id: true },
      });
      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      targetUserId = dbUser.id.toString();
    }

    const { searchParams } = new URL(req.url);
    const summary = searchParams.get("summary") === "true";
    const type = searchParams.get("type") as ContributionType | null;
    const limit = parseInt(searchParams.get("limit") || "50");

    if (summary) {
      const summaryData = await getContributionSummary(targetUserId);
      return NextResponse.json(summaryData);
    }

    const contributions = await getUserContributions(targetUserId, {
      type: type || undefined,
      limit,
    });

    return NextResponse.json(contributions);
  } catch (error) {
    console.error("Error fetching contributions:", error);
    return NextResponse.json(
      { error: "Failed to fetch contributions" },
      { status: 500 }
    );
  }
}
