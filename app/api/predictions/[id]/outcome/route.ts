// app/api/predictions/[id]/outcome/route.ts
// POST - Record an outcome/evidence for a prediction
// GET - Get all outcomes for a prediction

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { predictionService } from "@/lib/claims/prediction-service";
import type { EvidenceType } from "@/lib/types/claim-prediction";

export const dynamic = "force-dynamic";

// Schema for recording an outcome
const RecordOutcomeSchema = z.object({
  description: z.string().min(10, "Description must be at least 10 characters").max(5000),
  evidenceType: z.enum([
    "OBSERVATION",
    "MEASUREMENT",
    "ANNOUNCEMENT",
    "NEWS_REPORT",
    "STUDY",
    "OTHER",
  ]).optional(),
  evidenceUrl: z.string().url().optional(),
  observedAt: z.string().datetime().optional(),
});

/**
 * GET /api/predictions/[id]/outcome
 * Get all recorded outcomes/evidence for a prediction
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

    const outcomes = await predictionService.getOutcomes(predictionId);

    return NextResponse.json({
      ok: true,
      outcomes,
      total: outcomes.length,
    });
  } catch (error) {
    console.error("Error fetching outcomes:", error);
    return NextResponse.json(
      { error: "Failed to fetch outcomes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/predictions/[id]/outcome
 * Record a new outcome/evidence for a prediction
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
    const parsed = RecordOutcomeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { description, evidenceType, evidenceUrl, observedAt } = parsed.data;

    const outcome = await predictionService.recordOutcome({
      predictionId,
      description,
      evidenceType: evidenceType as EvidenceType | undefined,
      evidenceUrl,
      observedAt: observedAt ? new Date(observedAt) : undefined,
      recordedById: userId,
    });

    return NextResponse.json({ ok: true, outcome }, { status: 201 });
  } catch (error) {
    console.error("Error recording outcome:", error);
    const message = error instanceof Error ? error.message : "Failed to record outcome";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
