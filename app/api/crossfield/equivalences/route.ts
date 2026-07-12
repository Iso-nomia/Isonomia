export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Concept equivalence API
 * POST — propose a new cross-field concept equivalence (authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import { proposeEquivalence } from "@/lib/crossfield/conceptService";

const ProposeEquivalenceSchema = z.object({
  sourceConceptId: z.string(),
  targetConceptId: z.string(),
  equivalenceType: z.enum([
    "IDENTICAL",
    "SIMILAR",
    "OVERLAPPING",
    "RELATED",
    "TRANSLATES_TO",
    "CONTRASTING",
  ]),
  justification: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up DB user ID (BigInt) from Supabase auth_id
    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const input = ProposeEquivalenceSchema.parse(body);

    await proposeEquivalence(dbUser.id.toString(), input);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error proposing equivalence:", error);
    return NextResponse.json(
      { error: "Failed to propose equivalence" },
      { status: 500 }
    );
  }
}
