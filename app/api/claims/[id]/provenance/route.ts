export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Claim Provenance API
 * GET /api/claims/[id]/provenance - Get claim provenance
 */

import { NextRequest, NextResponse } from "next/server";
import { getClaimProvenanceWithAuthors } from "@/lib/provenance/provenanceService";
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

    const provenance = await getClaimProvenanceWithAuthors(claimId);

    if (!provenance) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ provenance });
  } catch (error) {
    console.error("Error fetching claim provenance:", error);
    return NextResponse.json(
      { error: "Failed to fetch provenance" },
      { status: 500 }
    );
  }
}
