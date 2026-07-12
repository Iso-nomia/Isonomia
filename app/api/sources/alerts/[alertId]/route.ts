export const dynamic = "force-dynamic";

// app/api/sources/alerts/[alertId]/route.ts
// Phase 3.1: Individual Alert Actions API
// Mark alerts as seen or dismissed

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { markAlertSeen, dismissAlert } from "@/lib/sources/alerts";

interface RouteContext {
  params: Promise<{ alertId: string }>;
}

/**
 * PATCH /api/sources/alerts/[alertId]
 * Mark alert as seen
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { alertId } = await context.params;
    await markAlertSeen(alertId, String(userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sources/alerts] Error marking seen:", error);
    return NextResponse.json(
      { error: "Failed to mark alert as seen" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sources/alerts/[alertId]
 * Dismiss alert
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { alertId } = await context.params;
    await dismissAlert(alertId, String(userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sources/alerts] Error dismissing:", error);
    return NextResponse.json(
      { error: "Failed to dismiss alert" },
      { status: 500 }
    );
  }
}
