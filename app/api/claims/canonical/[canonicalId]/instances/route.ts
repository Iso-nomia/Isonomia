export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Canonical Claim Instances API
 * GET /api/claims/canonical/[canonicalId]/instances - Get all instances
 * POST /api/claims/canonical/[canonicalId]/instances - Link claim to canonical
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCanonicalClaimInstances,
  linkClaimToCanonical,
} from "@/lib/provenance/canonicalClaimService";
import { createClient } from "@/util/supabase/server";

const linkClaimSchema = z.object({
  claimId: z.string().min(1, "Claim ID is required"),
  deliberationId: z.string().min(1, "Deliberation ID is required"),
  instanceType: z.enum(["ORIGINAL", "EQUIVALENT", "IMPORTED", "FORKED", "DERIVED"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { canonicalId } = await params;

    const instances = await getCanonicalClaimInstances(canonicalId);

    return NextResponse.json({ instances, canonicalId });
  } catch (error) {
    console.error("Error fetching canonical claim instances:", error);
    return NextResponse.json(
      { error: "Failed to fetch instances" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { canonicalId } = await params;
    const body = await request.json();

    const parsed = linkClaimSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const instance = await linkClaimToCanonical(
      {
        canonicalClaimId: canonicalId,
        ...parsed.data,
      },
      user.id
    );

    return NextResponse.json({ instance }, { status: 201 });
  } catch (error) {
    console.error("Error linking claim to canonical:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
