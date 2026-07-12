export const dynamic = "force-dynamic";

// app/api/non-canonical/reject/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function POST(req: NextRequest) {
  try {
    // ─── 1. Authentication ─────────────────────────────────────
    const currentUserId = await getCurrentUserId();

    // ─── 2. Parse Request Body ────────────────────────────────
    const body = await req.json();
    const { ncmId, reason } = body;

    if (!ncmId) {
      return NextResponse.json(
        { error: "ncmId is required" },
        { status: 400 }
      );
    }

    // ─── 3. Fetch the Non-Canonical Move ──────────────────────
    const ncmResult = await prisma.$queryRaw<
      Array<{
        id: string;
        authorId: string;
        status: string;
        contributorId: string;
      }>
    >`
      SELECT id, "authorId", status, "contributorId"
      FROM "non_canonical_moves"
      WHERE id = ${ncmId}
      LIMIT 1
    `;

    if (!ncmResult || ncmResult.length === 0) {
      return NextResponse.json(
        { error: "Non-canonical move not found" },
        { status: 404 }
      );
    }

    const ncm = ncmResult[0];

    // ─── 4. Authorization Check ────────────────────────────────
    if (ncm.authorId !== currentUserId?.toString()) {
      return NextResponse.json(
        { error: "Only the original author can reject this response" },
        { status: 403 }
      );
    }

    // ─── 5. Check Status ───────────────────────────────────────
    if (ncm.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot reject move with status: ${ncm.status}` },
        { status: 400 }
      );
    }

    // ─── 6. Reject the Move ────────────────────────────────────
    const now = new Date();
    const rejectionData = reason ? { reason, rejectedBy: currentUserId?.toString(), rejectedAt: now } : null;
    
    await prisma.$executeRaw`
      UPDATE "non_canonical_moves"
      SET status = 'REJECTED'::"NCMStatus",
          "rejectionReason" = ${reason || null},
          "updatedAt" = ${now}
      WHERE id = ${ncmId}
    `;

    // ─── 7. Emit Events & Notifications ───────────────────────
    // TODO: Emit bus event "non-canonical:rejected"
    // TODO: Send notification to contributor explaining rejection

    console.log(`[non-canonical/reject] Rejected ${ncmId} by author ${currentUserId}`);

    // ─── 8. Return Success ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      ncmId,
      status: "REJECTED",
      message: "Response has been rejected"
    });

  } catch (error: any) {
    console.error("[non-canonical/reject] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
