export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Concepts API
 * GET  — search concepts or list by field
 * POST — create a new concept (authenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/auth";
import { prisma } from "@/lib/prismaclient";
import {
  createConcept,
  searchConcepts,
  getConceptsByField,
} from "@/lib/crossfield/conceptService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const fieldId = searchParams.get("fieldId");

    if (query) {
      const results = await searchConcepts(query, fieldId || undefined);
      return NextResponse.json(results);
    }

    if (fieldId) {
      const concepts = await getConceptsByField(fieldId);
      return NextResponse.json(concepts);
    }

    return NextResponse.json(
      { error: "Query or fieldId required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching concepts:", error);
    return NextResponse.json(
      { error: "Failed to fetch concepts" },
      { status: 500 }
    );
  }
}

const CreateConceptSchema = z.object({
  name: z.string().min(2).max(300),
  definition: z.string().min(10),
  fieldId: z.string(),
  aliases: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  keySourceId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Look up DB user ID (BigInt) from Supabase auth_id
    const dbUser = await prisma.user.findUnique({
      where: { auth_id: user.id },
      select: { id: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const input = CreateConceptSchema.parse(body);

    const concept = await createConcept(dbUser.id.toString(), input);

    return NextResponse.json(concept, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating concept:", error);
    return NextResponse.json(
      { error: "Failed to create concept" },
      { status: 500 }
    );
  }
}
