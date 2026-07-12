export const dynamic = "force-dynamic";

// app/api/sources/[id]/archive/route.ts
// Phase 3.1: Source Archiving API - Wayback Machine Integration

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  archiveSourceById,
  checkWaybackArchive,
} from "@/lib/sources/archiving";
import { prisma } from "@/lib/prismaclient";

// POST: Request archive for a source
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
      select: { id: true, url: true, doi: true, archiveUrl: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // If already archived, return existing
    if (source.archiveUrl) {
      return NextResponse.json({
        success: true,
        status: "exists",
        archiveUrl: source.archiveUrl,
        message: "Source is already archived",
      });
    }

    // Perform archiving
    const result = await archiveSourceById(sourceId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.error || "Archiving failed",
        },
        { status: 500 }
      );
    }

    // Fetch updated source
    const updatedSource = await prisma.source.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        archiveStatus: true,
        archiveUrl: true,
        archivedAt: true,
        archiveError: true,
      },
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      archiveUrl: result.archiveUrl,
      source: updatedSource,
    });
  } catch (error) {
    console.error("Source archiving error:", error);
    return NextResponse.json(
      { error: "Archiving failed" },
      { status: 500 }
    );
  }
}

// GET: Check current archive status
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
        archiveStatus: true,
        archiveUrl: true,
        archiveRequestedAt: true,
        archivedAt: true,
        archiveError: true,
        localArchivePath: true,
        localArchiveSize: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // If no archive URL, check Wayback Machine for existing snapshot
    let waybackCheck = null;
    if (!source.archiveUrl && (source.url || source.doi)) {
      const urlToCheck = source.doi
        ? `https://doi.org/${source.doi}`
        : source.url;
      if (urlToCheck) {
        waybackCheck = await checkWaybackArchive(urlToCheck);
      }
    }

    return NextResponse.json({
      source,
      existingWaybackSnapshot: waybackCheck?.success
        ? {
            url: waybackCheck.archiveUrl,
            timestamp: waybackCheck.timestamp,
          }
        : null,
    });
  } catch (error) {
    console.error("Source archive status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch archive status" },
      { status: 500 }
    );
  }
}
