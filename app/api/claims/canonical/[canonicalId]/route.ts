export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Individual Canonical Claim API
 * GET /api/claims/canonical/[canonicalId] - Get canonical claim with instances
 * PATCH /api/claims/canonical/[canonicalId] - Update canonical claim
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCanonicalClaimWithInstances,
  updateCanonicalClaim,
  recalculateGlobalStatus,
} from "@/lib/provenance/canonicalClaimService";
import { createClient } from "@/util/supabase/server";

const updateCanonicalSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  representativeText: z.string().optional(),
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

    const canonical = await getCanonicalClaimWithInstances(canonicalId);

    if (!canonical) {
      return NextResponse.json({ error: "Canonical claim not found" }, { status: 404 });
    }

    return NextResponse.json({ canonical });
  } catch (error) {
    console.error("Error fetching canonical claim:", error);
    return NextResponse.json(
      { error: "Failed to fetch canonical claim" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    // Check if recalculating status
    if (body.recalculateStatus === true) {
      const status = await recalculateGlobalStatus(canonicalId);
      return NextResponse.json({ canonicalId, globalStatus: status });
    }

    const parsed = updateCanonicalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const canonical = await updateCanonicalClaim(canonicalId, parsed.data);

    return NextResponse.json({ canonical });
  } catch (error) {
    console.error("Error updating canonical claim:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
