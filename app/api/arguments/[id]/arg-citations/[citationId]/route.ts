/**
 * GET/DELETE/PATCH /api/arguments/:argumentId/arg-citations/:citationId
 * Manage individual argument-to-argument citations (Phase 3.2)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  getCitation,
  deleteCitation,
  updateCitationAnnotation,
} from "@/lib/citations/argumentCitationService";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const UpdateCitationSchema = z.object({
  annotation: z.string().max(1000).nullable().optional(),
});

/**
 * GET - Get a specific citation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; citationId: string } }
) {
  try {
    const citation = await getCitation(params.citationId);

    if (!citation) {
      return NextResponse.json(
        { ok: false, error: "Citation not found" },
        { status: 404, ...NO_STORE }
      );
    }

    return NextResponse.json({ ok: true, data: citation }, NO_STORE);
  } catch (error: any) {
    console.error("[GET /api/arguments/[id]/arg-citations/[citationId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get citation" },
      { status: 500, ...NO_STORE }
    );
  }
}

/**
 * DELETE - Delete a citation
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; citationId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    await deleteCitation(params.citationId, String(userId));

    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (error: any) {
    console.error("[DELETE /api/arguments/[id]/arg-citations/[citationId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to delete citation" },
      { status: 500, ...NO_STORE }
    );
  }
}

/**
 * PATCH - Update a citation (annotation only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; citationId: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const body = await req.json();
    const validatedData = UpdateCitationSchema.parse(body);

    const updated = await updateCitationAnnotation(
      params.citationId,
      validatedData.annotation ?? null,
      String(userId)
    );

    return NextResponse.json({ ok: true, data: updated }, NO_STORE);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: error.errors },
        { status: 400, ...NO_STORE }
      );
    }
    console.error("[PATCH /api/arguments/[id]/arg-citations/[citationId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update citation" },
      { status: 500, ...NO_STORE }
    );
  }
}
