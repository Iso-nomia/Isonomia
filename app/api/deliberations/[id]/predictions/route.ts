// app/api/deliberations/[id]/predictions/route.ts
// GET - Get all predictions for a deliberation with optional filtering

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { predictionService } from "@/lib/claims/prediction-service";
import type { ClaimPredictionStatus } from "@/lib/types/claim-prediction";

export const dynamic = "force-dynamic";

// Schema for query params
const QuerySchema = z.object({
  status: z.enum(["PENDING", "RESOLVED", "WITHDRAWN", "EXPIRED"]).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

/**
 * GET /api/deliberations/[id]/predictions
 * Get all predictions for a deliberation with pagination and filtering
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = decodeURIComponent(params.id || "");
    if (!deliberationId) {
      return NextResponse.json({ error: "Missing deliberation id" }, { status: 400 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const query = QuerySchema.safeParse({
      status: searchParams.get("status") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    });

    if (!query.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: query.error.flatten() },
        { status: 400 }
      );
    }

    const { status, limit, offset } = query.data;

    const result = await predictionService.getPredictionsForDeliberation(
      deliberationId,
      {
        status: status as ClaimPredictionStatus | undefined,
        limit,
        offset,
      }
    );

    return NextResponse.json({
      ok: true,
      predictions: result.predictions,
      total: result.total,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error("Error fetching deliberation predictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}
