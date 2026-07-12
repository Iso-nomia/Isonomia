export const dynamic = "force-dynamic";

/**
 * Phase 3.3: Cross-Room Search API
 * GET /api/cross-room-search - Search claims across all deliberations
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/util/supabase/server";
import { searchClaimsAcrossRooms } from "@/lib/crossDeliberation/crossRoomSearchService";
import { getCurrentUserId } from "@/lib/serverutils";
import { normalizeUserId } from "@/lib/deliberations/visibility";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const excludeDeliberationId = searchParams.get("exclude") || undefined;
    const fields = searchParams.get("fields")?.split(",") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter required" },
        { status: 400 }
      );
    }

    // Membership is keyed on the internal User.id, not the Supabase auth id.
    const viewerId = normalizeUserId(await getCurrentUserId().catch(() => null));

    const results = await searchClaimsAcrossRooms(
      {
        query,
        excludeDeliberationId,
        fields,
        limit: Math.min(limit, 50),
      },
      viewerId,
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Cross-room search error:", error);
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    );
  }
}
