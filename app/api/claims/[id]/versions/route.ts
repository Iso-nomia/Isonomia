export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Claim Versions API
 * GET /api/claims/[id]/versions - Get all versions
 * POST /api/claims/[id]/versions - Create new version
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getClaimVersions,
  createClaimVersion,
  initializeClaimVersionHistory,
} from "@/lib/provenance/provenanceService";
import { createClient } from "@/util/supabase/server";

const createVersionSchema = z.object({
  text: z.string().min(1, "Text is required"),
  claimType: z.string().optional(),
  changeType: z.enum([
    "CREATED",
    "REFINED",
    "STRENGTHENED",
    "WEAKENED",
    "CORRECTED",
    "MERGED",
    "SPLIT",
    "IMPORTED",
  ]),
  changeReason: z.string().optional(),
});

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

    const versions = await getClaimVersions(claimId);

    return NextResponse.json({ versions, claimId });
  } catch (error) {
    console.error("Error fetching claim versions:", error);
    return NextResponse.json(
      { error: "Failed to fetch versions" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const body = await request.json();

    // Check if this is an initialization request
    if (body.initialize === true) {
      try {
        const version = await initializeClaimVersionHistory(claimId, user.id);
        return NextResponse.json({ version, claimId, initialized: true });
      } catch (error) {
        if (error instanceof Error && error.message.includes("already has")) {
          return NextResponse.json(
            { error: error.message },
            { status: 400 }
          );
        }
        throw error;
      }
    }

    // Regular version creation
    const parsed = createVersionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const version = await createClaimVersion(
      {
        claimId,
        ...parsed.data,
      },
      user.id
    );

    return NextResponse.json({ version, claimId }, { status: 201 });
  } catch (error) {
    console.error("Error creating claim version:", error);
    return NextResponse.json(
      { error: "Failed to create version" },
      { status: 500 }
    );
  }
}
