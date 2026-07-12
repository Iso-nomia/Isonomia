export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listAxes } from "@/lib/typology/axisRegistry";

/**
 * GET /api/typology/axes
 *
 * Public read of the axis registry. No auth required.
 */
export async function GET() {
  const axes = await listAxes({ activeOnly: false });
  return NextResponse.json({
    axes: axes.map((a) => ({
      id: a.id,
      key: a.key,
      displayName: a.displayName,
      description: a.description,
      colorToken: a.colorToken,
      interventionHint: a.interventionHint,
      version: a.version,
      isActive: a.isActive,
    })),
  });
}
