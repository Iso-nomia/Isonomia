export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Single alert actions API
 * PATCH — mark alert as read/actioned/dismissed (authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  markAlertRead,
  markAlertActioned,
  dismissAlert,
} from "@/lib/crossfield/alertService";

type RouteContext = { params: Promise<{ alertId: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { alertId } = await context.params;

    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await req.json();

    switch (action) {
      case "read":
        await markAlertRead(alertId);
        break;
      case "actioned":
        await markAlertActioned(alertId);
        break;
      case "dismiss":
        await dismissAlert(alertId);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action. Use: read, actioned, dismiss" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}
