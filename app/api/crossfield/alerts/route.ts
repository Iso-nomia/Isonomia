export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Cross-field alerts API
 * GET — list alerts or get unread count (authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import {
  getUserAlerts,
  getUnreadAlertCount,
} from "@/lib/crossfield/alertService";
import { CrossFieldAlertStatus, CrossFieldAlertType } from "@/lib/crossfield/types";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up DB user ID (BigInt) from Supabase auth_id
    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as CrossFieldAlertStatus | null;
    const countOnly = searchParams.get("countOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (countOnly) {
      const count = await getUnreadAlertCount(dbUser.id);
      return NextResponse.json({ count });
    }

    const result = await getUserAlerts(dbUser.id, {
      status: status || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
