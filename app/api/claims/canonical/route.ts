export const dynamic = "force-dynamic";

/**
 * Phase 3.1: Canonical Claims API
 * GET /api/claims/canonical - List/search canonical claims
 * POST /api/claims/canonical - Create canonical claim
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  searchCanonicalClaims,
  createCanonicalClaim,
  getCanonicalClaimStats,
} from "@/lib/provenance/canonicalClaimService";
import { createClient } from "@/util/supabase/server";

const createCanonicalSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  title: z.string().min(1, "Title is required"),
  summary: z.string().optional(),
  representativeText: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Check if stats are requested
    if (searchParams.get("stats") === "true") {
      const stats = await getCanonicalClaimStats();
      return NextResponse.json({ stats });
    }

    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status")?.split(",");

    const canonicals = await searchCanonicalClaims(query, {
      limit,
      status: status as any,
    });

    return NextResponse.json({ canonicals });
  } catch (error) {
    console.error("Error fetching canonical claims:", error);
    return NextResponse.json(
      { error: "Failed to fetch canonical claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const parsed = createCanonicalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const canonical = await createCanonicalClaim(parsed.data);

    return NextResponse.json({ canonical }, { status: 201 });
  } catch (error) {
    console.error("Error creating canonical claim:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
