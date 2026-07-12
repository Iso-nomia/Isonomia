export const dynamic = "force-dynamic";

// app/api/sources/[id]/verify/route.ts
// Phase 3.1: Source Verification API

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { verifySourceById } from "@/lib/sources/verification";
import { prisma } from "@/lib/prismaclient";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const { id: sourceId } = await params;
    if (!sourceId) {
      return NextResponse.json(
        { error: "Source ID required" },
        { status: 400 }
      );
    }

    // Verify the source exists
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true, url: true, doi: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Perform verification
    const result = await verifySourceById(sourceId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 500 }
      );
    }

    // Fetch updated source
    const updatedSource = await prisma.source.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        verificationStatus: true,
        verifiedAt: true,
        lastCheckedAt: true,
        canonicalUrl: true,
        httpStatus: true,
      },
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      source: updatedSource,
    });
  } catch (error) {
    console.error("Source verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}

// GET: Check current verification status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    if (!sourceId) {
      return NextResponse.json(
        { error: "Source ID required" },
        { status: 400 }
      );
    }

    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        url: true,
        doi: true,
        verificationStatus: true,
        verifiedAt: true,
        lastCheckedAt: true,
        canonicalUrl: true,
        httpStatus: true,
        httpStatusHistory: true,
        contentHash: true,
        contentChangedAt: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    return NextResponse.json({ source });
  } catch (error) {
    console.error("Source verification status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch verification status" },
      { status: 500 }
    );
  }
}
