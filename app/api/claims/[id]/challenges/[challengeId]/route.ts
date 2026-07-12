export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Individual Challenge (Attack) API
 * GET /api/claims/[id]/challenges/[challengeId] - Get challenge details
 * PATCH /api/claims/[id]/challenges/[challengeId] - Update challenge status
 * DELETE /api/claims/[id]/challenges/[challengeId] - Delete challenge
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAttack,
  updateAttackStatus,
  deleteAttack,
  getDefensesForAttack,
} from "@/lib/provenance/challengeService";
import { createClient } from "@/util/supabase/server";

const updateStatusSchema = z.object({
  status: z.enum([
    "OPEN",
    "UNDER_REVIEW",
    "DEFENDED",
    "PARTIALLY_DEFENDED",
    "CONCEDED",
    "WITHDRAWN",
    "STALEMATE",
  ]),
  resolutionNote: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId } = await params;

    const attack = await getAttack(challengeId);

    if (!attack) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Get defenses for this attack
    const defenses = await getDefensesForAttack(challengeId);

    return NextResponse.json({ attack, defenses });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    return NextResponse.json(
      { error: "Failed to fetch challenge" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId } = await params;
    const body = await request.json();

    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const attack = await updateAttackStatus(
      {
        attackId: challengeId,
        ...parsed.data,
      },
      user.id
    );

    return NextResponse.json({ attack });
  } catch (error) {
    console.error("Error updating challenge status:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { challengeId } = await params;

    await deleteAttack(challengeId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting challenge:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
