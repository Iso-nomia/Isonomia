export const dynamic = "force-dynamic";

/**
 * Phase 3.3: Argument Import API
 * POST /api/arguments/:id/import - Import an argument to another deliberation
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/util/supabase/server";
import { importArgument } from "@/lib/crossDeliberation/argumentTransportService";

const ImportSchema = z.object({
  targetDeliberationId: z.string(),
  importType: z.enum(["FULL", "PREMISES_ONLY", "SKELETON", "REFERENCE"]),
  importReason: z.string().max(500).optional(),
  preserveAttribution: z.boolean().default(true),
  modifications: z
    .object({
      newConclusion: z.string().optional(),
      excludePremises: z.array(z.string()).optional(),
      addPremises: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const validatedData = ImportSchema.parse(body);

    const result = await importArgument(
      {
        sourceArgumentId: id,
        ...validatedData,
      },
      user.id
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Import argument error:", error);
    return NextResponse.json(
      { error: "Failed to import argument" },
      { status: 500 }
    );
  }
}
