export const dynamic = "force-dynamic";

// app/api/arguments/[id]/dialogue-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeDialogueState } from "@/lib/dialogue/computeDialogueState";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    if (!argumentId || typeof argumentId !== "string") {
      return NextResponse.json(
        { error: "Invalid argument ID" },
        { status: 400 }
      );
    }

    const dialogueState = await computeDialogueState(argumentId);

    return NextResponse.json(dialogueState, { status: 200 });
  } catch (error) {
    console.error("Error computing dialogue status:", error);
    return NextResponse.json(
      { error: "Failed to compute dialogue status" },
      { status: 500 }
    );
  }
}
