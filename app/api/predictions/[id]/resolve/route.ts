// app/api/predictions/[id]/resolve/route.ts
// POST - Resolve a prediction with an outcome determination

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { predictionService } from "@/lib/claims/prediction-service";
import type { PredictionResolution } from "@/lib/types/claim-prediction";

export const dynamic = "force-dynamic";

// Schema for resolving a prediction
const ResolvePredictionSchema = z.object({
  resolution: z.enum(["CONFIRMED", "DISCONFIRMED", "PARTIALLY_TRUE", "INDETERMINATE"]),
  resolutionNote: z.string().max(2000).optional(),
});

/**
 * POST /api/predictions/[id]/resolve
 * Resolve a prediction by marking its outcome
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserAuthId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const predictionId = decodeURIComponent(params.id || "");
    if (!predictionId) {
      return NextResponse.json({ error: "Missing prediction id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = ResolvePredictionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { resolution, resolutionNote } = parsed.data;

    const prediction = await predictionService.resolvePrediction({
      predictionId,
      resolution: resolution as PredictionResolution,
      resolutionNote,
      resolvedById: userId,
    });

    return NextResponse.json({ ok: true, prediction });
  } catch (error) {
    console.error("Error resolving prediction:", error);
    const message = error instanceof Error ? error.message : "Failed to resolve prediction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
