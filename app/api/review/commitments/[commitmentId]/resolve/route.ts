export const dynamic = "force-dynamic";

/**
 * Resolve a commitment
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import { resolveCommitment, reopenCommitment } from "@/lib/review/commitmentService";

const ResolveSchema = z.object({
  resolutionNote: z.string().min(5),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ commitmentId: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commitmentId } = await params;
    const body = await req.json();
    const { resolutionNote } = ResolveSchema.parse(body);

    const commitment = await resolveCommitment(
      commitmentId,
      resolutionNote,
      user.id
    );

    return NextResponse.json(commitment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error resolving commitment:", error);
    return NextResponse.json(
      { error: "Failed to resolve commitment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ commitmentId: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commitmentId } = await params;

    const commitment = await reopenCommitment(
      commitmentId,
      user.id
    );

    return NextResponse.json(commitment);
  } catch (error) {
    console.error("Error reopening commitment:", error);
    return NextResponse.json(
      { error: "Failed to reopen commitment" },
      { status: 500 }
    );
  }
}
