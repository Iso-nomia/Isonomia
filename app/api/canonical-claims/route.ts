export const dynamic = "force-dynamic";

/**
 * Phase 3.3: Canonical Claims Registry API
 * GET /api/canonical-claims - Search canonical claims
 * POST /api/canonical-claims - Register a claim in the canonical registry
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/util/supabase/server";
import {
  searchCanonicalClaims,
  findOrCreateCanonicalClaim,
} from "@/lib/crossDeliberation/canonicalRegistryService";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || undefined;
    const field = searchParams.get("field") || undefined;
    const globalStatus = searchParams.get("status") || undefined;
    const minInstances = parseInt(searchParams.get("minInstances") || "1", 10);

    const results = await searchCanonicalClaims({
      query,
      field,
      globalStatus,
      minInstances,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Search canonical claims error:", error);
    return NextResponse.json(
      { error: "Failed to search claims" },
      { status: 500 }
    );
  }
}

const RegisterSchema = z.object({
  claimId: z.string(),
  field: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { claimId, field } = RegisterSchema.parse(body);

    const canonical = await findOrCreateCanonicalClaim(
      claimId,
      user.id,
      field
    );

    return NextResponse.json(canonical, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Register canonical claim error:", error);
    return NextResponse.json(
      { error: "Failed to register claim" },
      { status: 500 }
    );
  }
}
