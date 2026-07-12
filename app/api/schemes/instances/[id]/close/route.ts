// app/api/schemes/instances/[id]/close/route.ts
//
// Phase 4 / Spec 3 §3.4 — direct close surface for a single
// SchemeInstance. Exposed for tests, admin tooling, and the
// deliberation-close iteration (which calls `closeSchemeInstance`
// in lib/ directly, not over HTTP).
//
// Auth: minimal — caller must supply `closedById` in the body. A
// real auth integration lives in middleware.ts; this matches the
// pattern of the sibling POST /api/schemes/instances route.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closeSchemeInstance } from "@/lib/schemes/protocol/closeInstance";
import { SoundnessViolationError } from "@/lib/schemes/protocol/soundnessGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  closedById: z.string().min(1),
  modeOverride: z.enum(["off", "warn", "block"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const result = await closeSchemeInstance(params.id, {
      closedById: body.closedById,
      modeOverride: body.modeOverride,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    if (e instanceof SoundnessViolationError) {
      return NextResponse.json(
        {
          error: "soundness-violation",
          message: e.message,
          reasons: e.reasons,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: (e as Error)?.message ?? "close failed" },
      { status: 500 }
    );
  }
}
