// app/api/deliberations/[id]/close-scheme-instances/route.ts
//
// Phase 4 phase 3c follow-on — admin endpoint that iterates the
// close-hook across every open SchemeInstance attached to a
// deliberation. Until a substrate-level deliberation-close lifecycle
// exists, this is the production handle for batch close.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { closeAllSchemeInstancesForDeliberation } from "@/lib/schemes/protocol/closeDeliberation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  closedById: z.string().min(1),
  modeOverride: z.enum(["off", "warn", "block"]).optional(),
  stopOnBlock: z.boolean().optional(),
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
    const summary = await closeAllSchemeInstancesForDeliberation(params.id, {
      closedById: body.closedById,
      modeOverride: body.modeOverride,
      stopOnBlock: body.stopOnBlock,
    });
    const httpStatus = summary.blocked.length > 0 ? 207 : 200;
    return NextResponse.json(summary, { status: httpStatus });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message ?? "close failed" },
      { status: 500 }
    );
  }
}
