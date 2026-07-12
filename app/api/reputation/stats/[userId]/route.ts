export const dynamic = "force-dynamic";

/**
 * Scholar stats endpoint
 * Phase 4.2: Argumentation-Based Reputation
 */

import { NextRequest, NextResponse } from "next/server";
import { getScholarStats, recalculateScholarStats } from "@/lib/reputation/statsService";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";

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
      // Get user id from auth_id
      const dbUser = await prisma.user.findUnique({
        where: { auth_id: user.id },
        select: { id: true },
      });
      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      targetUserId = dbUser.id.toString();
    }

    const stats = await getScholarStats(targetUserId);

    if (!stats) {
      return NextResponse.json(
        { error: "Stats not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // Force recalculation
    const stats = await recalculateScholarStats(targetUserId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error recalculating stats:", error);
    return NextResponse.json(
      { error: "Failed to recalculate stats" },
      { status: 500 }
    );
  }
}
