export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Claim Timeline API
 * GET /api/claims/[id]/timeline - Get claim timeline events
 */

import { NextRequest, NextResponse } from "next/server";
import { getClaimTimeline } from "@/lib/provenance/provenanceService";
import { createClient } from "@/util/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: claimId } = await params;

    const events = await getClaimTimeline(claimId);

    return NextResponse.json({
      claimId,
      events,
      totalEvents: events.length,
    });
  } catch (error) {
    console.error("Error fetching claim timeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
