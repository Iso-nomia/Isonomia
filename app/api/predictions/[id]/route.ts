// app/api/predictions/[id]/route.ts
// GET - Get a single prediction with its outcomes
// PATCH - Update a pending prediction
// DELETE - Withdraw/delete a prediction

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { predictionService } from "@/lib/claims/prediction-service";

export const dynamic = "force-dynamic";

// Schema for updating a prediction
const UpdatePredictionSchema = z.object({
  predictionText: z.string().min(10).optional(),
  targetDate: z.string().datetime().nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * GET /api/predictions/[id]
 * Get a single prediction with all its details and outcomes
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const predictionId = decodeURIComponent(params.id || "");
    if (!predictionId) {
      return NextResponse.json({ error: "Missing prediction id" }, { status: 400 });
    }

    const prediction = await predictionService.getPrediction(predictionId);

    if (!prediction) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, prediction });
  } catch (error) {
    console.error("Error fetching prediction:", error);
    return NextResponse.json(
      { error: "Failed to fetch prediction" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/predictions/[id]
 * Update a pending prediction (only creator can update)
 */
export async function PATCH(
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

    // Verify ownership
    const existing = await predictionService.getPrediction(predictionId);
    if (!existing) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
    }

    if (existing.createdById !== userId) {
      return NextResponse.json(
        { error: "Only the creator can update this prediction" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = UpdatePredictionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { predictionText, targetDate, confidence } = parsed.data;

    const prediction = await predictionService.updatePrediction({
      predictionId,
      predictionText,
      targetDate: targetDate === null ? null : targetDate ? new Date(targetDate) : undefined,
      confidence,
    });

    return NextResponse.json({ ok: true, prediction });
  } catch (error) {
    console.error("Error updating prediction:", error);
    const message = error instanceof Error ? error.message : "Failed to update prediction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/predictions/[id]
 * Withdraw or delete a prediction (only creator can delete pending predictions)
 */
export async function DELETE(
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

    // Check query param for soft delete (withdraw) vs hard delete
    const searchParams = req.nextUrl.searchParams;
    const softDelete = searchParams.get("soft") === "true";

    if (softDelete) {
      // Withdraw the prediction
      const prediction = await predictionService.withdrawPrediction(predictionId, userId);
      return NextResponse.json({ ok: true, prediction });
    } else {
      // Hard delete
      await predictionService.deletePrediction(predictionId, userId);
      return NextResponse.json({ ok: true, deleted: true });
    }
  } catch (error) {
    console.error("Error deleting prediction:", error);
    const message = error instanceof Error ? error.message : "Failed to delete prediction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
