export const dynamic = "force-dynamic";

/**
 * Phase 3.3: Claim Cross-Room Status API
 * GET /api/claims/:claimId/cross-room-status
 * Returns information about this claim's presence in the canonical registry
 * and other deliberations.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/util/supabase/server";
import { getClaimCrossRoomStatus } from "@/lib/crossDeliberation/crossRoomSearchService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: claimId } = await params;

    const status = await getClaimCrossRoomStatus(claimId);

    return NextResponse.json(status);
  } catch (error) {
    console.error("Cross-room status error:", error);
    return NextResponse.json(
      { error: "Failed to get cross-room status" },
      { status: 500 }
    );
  }
}
