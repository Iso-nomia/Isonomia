export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Claim Challenges (Attacks) API
 * GET /api/claims/[id]/challenges - Get all challenges/attacks against claim
 * POST /api/claims/[id]/challenges - Create new challenge/attack
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAttacksForClaim,
  createAttack,
  getChallengeReport,
} from "@/lib/provenance/challengeService";
import { createClient } from "@/util/supabase/server";

const createAttackSchema = z.object({
  attackingArgumentId: z.string().min(1, "Attacking argument ID is required"),
  attackType: z.enum(["REBUTS", "UNDERCUTS", "UNDERMINES"]),
  attackSubtype: z.string().optional(),
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
    const { searchParams } = new URL(request.url);
    
    // Check if full report is requested
    if (searchParams.get("report") === "true") {
      const report = await getChallengeReport(claimId);
      if (!report) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      return NextResponse.json({ report });
    }

    // Parse filters
    const status = searchParams.get("status")?.split(",");
    const attackType = searchParams.get("type")?.split(",");

    const challenges = await getAttacksForClaim(claimId, {
      status: status as any,
      attackType: attackType as any,
    });

    return NextResponse.json({ challenges, claimId });
  } catch (error) {
    console.error("Error fetching claim challenges:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenges" },
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

    const parsed = createAttackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const attack = await createAttack(
      {
        targetClaimId: claimId,
        ...parsed.data,
      },
      user.id
    );

    return NextResponse.json({ attack }, { status: 201 });
  } catch (error) {
    console.error("Error creating challenge:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
