export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Challenge Defenses API
 * GET /api/claims/[id]/challenges/[challengeId]/defenses - Get defenses for challenge
 * POST /api/claims/[id]/challenges/[challengeId]/defenses - Create defense
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getDefensesForAttack,
  createDefense,
} from "@/lib/provenance/challengeService";
import { createClient } from "@/util/supabase/server";

const createDefenseSchema = z.object({
  defendingArgumentId: z.string().min(1, "Defending argument ID is required"),
  defenseType: z.enum([
    "DIRECT_REBUTTAL",
    "DISTINCTION",
    "CONCESSION_LIMIT",
    "EVIDENCE",
    "AUTHORITY",
  ]),
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

    const defenses = await getDefensesForAttack(challengeId);

    return NextResponse.json({ defenses, challengeId });
  } catch (error) {
    console.error("Error fetching defenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch defenses" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: claimId, challengeId } = await params;
    const body = await request.json();

    const parsed = createDefenseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const defense = await createDefense(
      {
        claimId,
        attackId: challengeId,
        ...parsed.data,
      },
      user.id
    );

    return NextResponse.json({ defense }, { status: 201 });
  } catch (error) {
    console.error("Error creating defense:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
