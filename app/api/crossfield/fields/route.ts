export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Academic fields API
 * GET  — list top-level fields, search, or get hierarchy
 * POST — create a new field (authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import {
  getTopLevelFields,
  getFieldHierarchy,
  createField,
  searchFields,
} from "@/lib/crossfield/fieldService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const hierarchy = searchParams.get("hierarchy") === "true";

    if (hierarchy) {
      const tree = await getFieldHierarchy();
      return NextResponse.json(tree);
    }

    if (query) {
      const results = await searchFields(query);
      return NextResponse.json(results);
    }

    const fields = await getTopLevelFields();
    return NextResponse.json(fields);
  } catch (error) {
    console.error("Error fetching fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch fields" },
      { status: 500 }
    );
  }
}

const CreateFieldSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  parentFieldId: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  keyTerms: z.array(z.string()).optional(),
  epistemicStyle: z
    .enum([
      "EMPIRICAL",
      "INTERPRETIVE",
      "FORMAL",
      "NORMATIVE",
      "HISTORICAL",
      "MIXED",
    ])
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const input = CreateFieldSchema.parse(body);

    const field = await createField(input);

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating field:", error);
    return NextResponse.json(
      { error: "Failed to create field" },
      { status: 500 }
    );
  }
}
