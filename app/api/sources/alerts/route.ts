export const dynamic = "force-dynamic";

// app/api/sources/alerts/route.ts
// Phase 3.1: Source Alerts API
// Get pending alerts for the current user

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { getUserPendingAlerts, getPendingAlertCount } from "@/lib/sources/alerts";

/**
 * GET /api/sources/alerts
 * Get pending source alerts for the current user
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("countOnly") === "true";

    if (countOnly) {
      const count = await getPendingAlertCount(userId.toString());
      return NextResponse.json({ count });
    }

    const alerts = await getUserPendingAlerts(userId.toString());
    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("[sources/alerts] Error:", error);
    return NextResponse.json(
      { error: "Failed to get alerts" },
      { status: 500 }
    );
  }
}
