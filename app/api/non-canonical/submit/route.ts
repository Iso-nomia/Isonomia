export const dynamic = "force-dynamic";

// app/api/non-canonical/submit/route.ts
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
      targetMoveId,
      moveType,
      content
    } = body;

    // ─── 3. Validation ────────────────────────────────────────
    if (!deliberationId || !targetType || !targetId || !moveType || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!content.expression || content.expression.trim().length === 0) {
      return NextResponse.json(
        { error: "Content expression cannot be empty" },
        { status: 400 }
      );
    }

    // Validate moveType
    const validMoveTypes = [
      "GROUNDS_RESPONSE",
      "CLARIFICATION_ANSWER",
      "CHALLENGE_RESPONSE",
      "EVIDENCE_ADDITION",
      "PREMISE_DEFENSE",
      "EXCEPTION_REBUTTAL"
    ];
    if (!validMoveTypes.includes(moveType)) {
      return NextResponse.json(
        { error: "Invalid move type" },
        { status: 400 }
      );
    }

    // ─── 4. Get Author ID ──────────────────────────────────────
    let authorId: string;

    if (targetType === "argument") {
      const argument = await prisma.argument.findUnique({
        where: { id: targetId },
        select: { authorId: true }
      });

      if (!argument) {
        return NextResponse.json(
          { error: "Target argument not found" },
          { status: 404 }
        );
      }

      authorId = argument.authorId;
    } else if (targetType === "claim") {
      const claim = await prisma.claim.findUnique({
        where: { id: targetId },
        select: { createdById: true }
      });

      if (!claim) {
        return NextResponse.json(
          { error: "Target claim not found" },
          { status: 404 }
        );
      }

      authorId = claim.createdById;
    } else if (targetType === "clarification_request") {
      // Note: ClarificationRequest model exists but Prisma client hasn't regenerated yet
      // Temporary workaround: use raw query or handle separately
      const clarificationRequest = await prisma.$queryRaw<Array<{ askerId: string }>>`
        SELECT "askerId" FROM "clarification_requests" WHERE id = ${targetId}
      `;

      if (!clarificationRequest || clarificationRequest.length === 0) {
        return NextResponse.json(
          { error: "Target clarification request not found" },
          { status: 404 }
        );
      }

      // For clarifications, the "author" is the asker who will approve
      authorId = clarificationRequest[0].askerId;
    } else {
      return NextResponse.json(
        { error: "Invalid target type" },
        { status: 400 }
      );
    }

    // ─── 5. Security Check: Can't submit non-canonical for own content ─
    // Testing mode only in development
    const isTestingMode =
      process.env.NODE_ENV === "development" &&
      process.env.DIALOGUE_TESTING_MODE === "true";
    
    if (!isTestingMode && currentUserId?.toString() === authorId) {
      return NextResponse.json(
        { error: "You cannot submit non-canonical responses for your own content. Please edit your content directly or post canonical moves." },
        { status: 403 }
      );
    }

    // ─── 6. Check for Duplicate Pending Response ──────────────
    // Use raw query since Prisma types may not be fully generated yet
    const existingPending = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "non_canonical_moves"
      WHERE "targetId" = ${targetId}
        AND "targetType" = ${targetType}
        AND "contributorId" = ${currentUserId?.toString() || ""}
        AND "moveType" = CAST(${moveType} AS "MoveType")
        AND status = 'PENDING'
      LIMIT 1
    `;

    if (existingPending && existingPending.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending response for this. Please wait for approval or withdraw your previous response." },
        { status: 409 }
      );
    }

    // ─── 7. Create Non-Canonical Move ─────────────────────────
    const ncmId = crypto.randomUUID();
    const now = new Date();
    
    await prisma.$executeRaw`
      INSERT INTO "non_canonical_moves" (
        id, "deliberationId", "targetType", "targetId", "targetMoveId",
        "contributorId", "authorId", "moveType", content, status, "createdAt", "updatedAt"
      ) VALUES (
        ${ncmId}, ${deliberationId}, ${targetType}, ${targetId}, ${targetMoveId || null},
        ${currentUserId?.toString()}, ${authorId}, CAST(${moveType} AS "MoveType"), 
        ${JSON.stringify(content)}::jsonb, 'PENDING'::"NCMStatus", ${now}, ${now}
      )
    `;

    // ─── 8. Create Review Issue for Author ────────────────────
    // Auto-create an issue for the author to review this NCM
    const issueId = crypto.randomUUID();
    const issueLabel = `Community Defense: ${moveType.replace(/_/g, " ")}`;
    const issueDescription = `Review community-submitted ${moveType.toLowerCase().replace(/_/g, " ")} for your content.`;
    
    // Use Prisma ORM instead of raw SQL to avoid table name mismatches
    await prisma.issue.create({
      data: {
        id: issueId,
        deliberationId,
        label: issueLabel,
        description: issueDescription,
        kind: "community_defense",
        state: "pending",
        createdById: BigInt(currentUserId?.toString() || "0"),
        assigneeId: BigInt(authorId),
        ncmId,
        ncmStatus: "PENDING",
      }
    });

    // Link the issue to the target
    await prisma.issueLink.create({
      data: {
        issueId,
        targetType: targetType as any,
        targetId,
        role: "related",
        argumentId: targetType === "argument" ? targetId : null,
      },
    });

    console.log(`[non-canonical] Created review issue: ${issueId} for author ${authorId}`);

    // ─── 9. Send Notification to Author ───────────────────────
    // TODO: Emit bus event "non-canonical:submitted"
    // TODO: Create notification for author

    console.log(`[non-canonical] Created: ${ncmId} by ${currentUserId} for ${targetType}:${targetId}`);

    // ─── 10. Return Success ────────────────────────────────────
    return NextResponse.json({
      success: true,
      ncmId,
      issueId,
      status: "PENDING",
      message: "Your response has been submitted and is awaiting approval."
    });

  } catch (error: any) {
    console.error("[non-canonical/submit] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
