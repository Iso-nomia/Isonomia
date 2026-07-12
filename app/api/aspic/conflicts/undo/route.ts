export const dynamic = "force-dynamic";

/**
 * Undo conflict resolution
 * POST: Restore resolved preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { undoResolution } from "@/lib/aspic/conflicts/resolution";
import { getUserFromCookies } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const UndoRequest = z.object({
  paIds: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, ...NO_STORE }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, ...NO_STORE }
    );
  }

  const parsed = UndoRequest.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400, ...NO_STORE }
    );
  }

  const { paIds } = parsed.data;

  try {
    const result = await undoResolution(paIds);

    return NextResponse.json(
      {
        success: true,
        restored: result.restored,
        message: `Successfully restored ${result.restored} preference${result.restored > 1 ? "s" : ""}`,
      },
      NO_STORE
    );
  } catch (error) {
    console.error("Undo resolution error:", error);
    return NextResponse.json(
      { 
        error: "Failed to undo resolution",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, ...NO_STORE }
    );
  }
}
