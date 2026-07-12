export const dynamic = "force-dynamic";

/**
 * Respond to reviewer invitation
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import { respondToInvitation } from "@/lib/review/assignmentService";

const ResponseSchema = z.object({
  accept: z.boolean(),
  declineReason: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { assignmentId } = await params;
    const body = await req.json();
    const { accept, declineReason } = ResponseSchema.parse(body);

    const assignment = await respondToInvitation(
      assignmentId,
      user.id,
      accept,
      declineReason
    );

    return NextResponse.json(assignment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error responding to invitation:", error);
    return NextResponse.json(
      { error: "Failed to respond to invitation" },
      { status: 500 }
    );
  }
}
