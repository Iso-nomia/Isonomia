/**
 * GET/POST /api/arguments/:argumentId/arg-citations
 * Manage argument-to-argument citations (Phase 3.2)
 *
 * Note: This is different from /api/arguments/[id]/citations which handles
 * source/reference citations. This handles citations between arguments.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  getArgumentCitations,
  createCitation,
} from "@/lib/citations/argumentCitationService";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const CreateCitationSchema = z.object({
  citedArgumentId: z.string().min(1, "citedArgumentId is required"),
  citationType: z.enum([
    "SUPPORT",
    "EXTENSION",
    "APPLICATION",
    "CONTRAST",
    "REBUTTAL",
    "REFINEMENT",
    "METHODOLOGY",
    "CRITIQUE",
  ]),
  annotation: z.string().max(1000).optional(),
  citedInContext: z
    .object({
      premiseArgumentId: z.string(),
      premiseClaimId: z.string(),
    })
    .optional(),
});

/**
 * GET - List all argument citations for an argument
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    const citations = await getArgumentCitations(argumentId);

    if (!citations) {
      return NextResponse.json(
        { ok: false, error: "Argument not found" },
        { status: 404, ...NO_STORE }
      );
    }

    return NextResponse.json({ ok: true, data: citations }, NO_STORE);
  } catch (error: any) {
    console.error("[GET /api/arguments/[id]/arg-citations] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get citations" },
      { status: 500, ...NO_STORE }
    );
  }
}

/**
 * POST - Create a new citation from this argument to another
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
    const validatedData = CreateCitationSchema.parse(body);

    const citation = await createCitation(
      {
        citingArgumentId: params.id,
        citedArgumentId: validatedData.citedArgumentId,
        citationType: validatedData.citationType,
        annotation: validatedData.annotation,
        citedInContext: validatedData.citedInContext,
      },
      String(userId)
    );

    return NextResponse.json(
      { ok: true, data: citation },
      { status: 201, ...NO_STORE }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: error.errors },
        { status: 400, ...NO_STORE }
      );
    }
    console.error("[POST /api/arguments/[id]/arg-citations] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to create citation" },
      { status: 500, ...NO_STORE }
    );
  }
}
