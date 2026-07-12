export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Defense Outcome API
 * PATCH /api/claims/[id]/challenges/[challengeId]/defenses/[defenseId] - Update defense outcome
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateDefenseOutcome } from "@/lib/provenance/challengeService";
import { createClient } from "@/util/supabase/server";

const updateOutcomeSchema = z.object({
  outcome: z.enum(["SUCCESSFUL", "PARTIAL", "UNSUCCESSFUL", "PENDING"]),
  outcomeNote: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string; defenseId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { defenseId } = await params;
    const body = await request.json();

    const parsed = updateOutcomeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const defense = await updateDefenseOutcome(
      {
        defenseId,
        ...parsed.data,
      },
      user.id
    );

    return NextResponse.json({ defense });
  } catch (error) {
    console.error("Error updating defense outcome:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
