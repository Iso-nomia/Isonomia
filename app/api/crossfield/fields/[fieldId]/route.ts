export const dynamic = "force-dynamic";

/**
 * Phase 5.1: Single field API
 * GET — get field with all relationships
 */

import { NextRequest, NextResponse } from "next/server";
import { getFieldWithRelations } from "@/lib/crossfield/fieldService";

type RouteContext = { params: Promise<{ fieldId: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { fieldId } = await context.params;
    const field = await getFieldWithRelations(fieldId);

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error("Error fetching field:", error);
    return NextResponse.json(
      { error: "Failed to fetch field" },
      { status: 500 }
    );
  }
}
