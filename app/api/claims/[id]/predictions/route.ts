// app/api/claims/[id]/predictions/route.ts
// GET - List predictions for a claim
// POST - Create a new prediction for a claim

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { predictionService } from "@/lib/claims/prediction-service";
import type { ClaimPredictionStatus } from "@/lib/types/claim-prediction";

export const dynamic = "force-dynamic";

// Schema for creating a prediction
const CreatePredictionSchema = z.object({
  predictionText: z.string().min(10, "Prediction text must be at least 10 characters"),
  targetDate: z.string().datetime().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// Schema for query params
const QuerySchema = z.object({
  status: z.enum(["PENDING", "RESOLVED", "WITHDRAWN", "EXPIRED"]).optional(),
});

/**
 * GET /api/claims/[id]/predictions
 * Get all predictions for a claim
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const claimId = decodeURIComponent(params.id || "");
    if (!claimId) {
      return NextResponse.json({ error: "Missing claim id" }, { status: 400 });
    }

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    
    const query = QuerySchema.safeParse({
      status: statusParam || undefined,
    });

    const status = query.success ? query.data.status as ClaimPredictionStatus | undefined : undefined;

    const predictions = await predictionService.getPredictionsForClaim(claimId, status);

    return NextResponse.json({
      ok: true,
      predictions,
      total: predictions.length,
    });
  } catch (error) {
    console.error("Error fetching predictions:", error);
    return NextResponse.json(
      { error: "Failed to fetch predictions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/claims/[id]/predictions
 * Create a new prediction for a claim
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

    const claimId = decodeURIComponent(params.id || "");
    if (!claimId) {
      return NextResponse.json({ error: "Missing claim id" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = CreatePredictionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { predictionText, targetDate, confidence } = parsed.data;

    // Get deliberationId from the claim
    const { prisma } = await import("@/lib/prismaclient");
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      select: { deliberationId: true },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    if (!claim.deliberationId) {
      return NextResponse.json(
        { error: "Claim is not part of a deliberation" },
        { status: 400 }
      );
    }

    const prediction = await predictionService.createPrediction({
      claimId,
      deliberationId: claim.deliberationId,
      predictionText,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      confidence,
      createdById: userId,
    });

    return NextResponse.json({ ok: true, prediction }, { status: 201 });
  } catch (error) {
    console.error("Error creating prediction:", error);
    return NextResponse.json(
      { error: "Failed to create prediction" },
      { status: 500 }
    );
  }
}
