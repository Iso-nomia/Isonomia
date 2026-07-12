export const dynamic = "force-dynamic";

/**
 * Reviewer profile endpoint
 * Phase 4.2: Argumentation-Based Reputation
 */

import { NextRequest, NextResponse } from "next/server";
import { getReviewerProfile } from "@/lib/reputation/reviewerProfileService";
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
      const dbUser = await prisma.user.findUnique({
        where: { auth_id: user.id },
        select: { id: true },
      });
      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      targetUserId = dbUser.id.toString();
    }

    const profile = await getReviewerProfile(targetUserId);

    if (!profile) {
      return NextResponse.json(
        { error: "Reviewer profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching reviewer profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviewer profile" },
      { status: 500 }
    );
  }
}
