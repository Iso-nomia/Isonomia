export const dynamic = "force-dynamic";

// app/api/clarification/request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function POST(req: NextRequest) {
  try {
    // ─── 1. Authentication ─────────────────────────────────────
    const currentUserId = await getCurrentUserId();

    // ─── 2. Parse Request Body ────────────────────────────────
    const body = await req.json();
    const {
      deliberationId,
      targetType,
      targetId,
      question
    } = body;

    // ─── 3. Validation ────────────────────────────────────────
    if (!deliberationId || !targetType || !targetId || !question) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (question.trim().length === 0) {
      return NextResponse.json(
        { error: "Question cannot be empty" },
        { status: 400 }
      );
    }

    if (question.length > 2000) {
      return NextResponse.json(
        { error: "Question must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // Validate targetType
    if (!["argument", "claim"].includes(targetType)) {
      return NextResponse.json(
        { error: "Invalid target type. Must be 'argument' or 'claim'" },
        { status: 400 }
      );
    }

    // ─── 4. Verify Target Exists ──────────────────────────────
    if (targetType === "argument") {
      const argument = await prisma.argument.findUnique({
        where: { id: targetId },
        select: { id: true }
      });
      
      if (!argument) {
        return NextResponse.json(
          { error: "Target argument not found" },
          { status: 404 }
        );
      }
    } else if (targetType === "claim") {
      const claim = await prisma.claim.findUnique({
        where: { id: targetId },
        select: { id: true }
      });
      
      if (!claim) {
        return NextResponse.json(
          { error: "Target claim not found" },
          { status: 404 }
        );
      }
    }

    // ─── 5. Check for Duplicate ───────────────────────────────
    const existingOpen = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "clarification_requests"
      WHERE "targetId" = ${targetId}
        AND "targetType" = ${targetType}
        AND "askerId" = ${currentUserId?.toString() || ""}
        AND status IN ('OPEN', 'ANSWERED')
      LIMIT 1
    `;

    if (existingOpen && existingOpen.length > 0) {
      return NextResponse.json(
        { error: "You already have an open clarification request for this item" },
        { status: 409 }
      );
    }

    // ─── 6. Create Clarification Request ──────────────────────
    const crId = crypto.randomUUID();
    const now = new Date();
    
    await prisma.$executeRaw`
      INSERT INTO "clarification_requests" (
        id, "deliberationId", "targetType", "targetId", "askerId",
        question, status, "createdAt", "updatedAt"
      ) VALUES (
        ${crId}, ${deliberationId}, ${targetType}, ${targetId},
        ${currentUserId?.toString()}, ${question}, 'OPEN'::"ClarificationStatus",
        ${now}, ${now}
      )
    `;

    // ─── 7. Emit Events & Notifications ───────────────────────
    // TODO: Emit bus event "clarification:requested"
    // TODO: Notify argument/claim author

    console.log(`[clarification/request] Created ${crId} by ${currentUserId} for ${targetType}:${targetId}`);

    // ─── 8. Return Success ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      clarificationId: crId,
      status: "OPEN",
      message: "Clarification request submitted successfully"
    });

  } catch (error: any) {
    console.error("[clarification/request] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
