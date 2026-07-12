export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

/**
 * GET /api/deliberations/[id]/settings
 * Retrieve deliberation settings (dsMode, proofMode, nliThreshold, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: {
        id: true,
        dsMode: true,
        proofMode: true,
        title: true,
        rule: true,
        k: true,
        nliThreshold: true,
        visibility: true,
        createdById: true,
      },
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(deliberation, { status: 200 });
  } catch (error) {
    console.error("Error fetching deliberation settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/deliberations/[id]/settings
 * Update deliberation settings (dsMode, proofMode, nliThreshold, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deliberationId = params.id;
    const body = await request.json();

    // Validate allowed fields
    const allowedFields = ["dsMode", "proofMode", "title", "rule", "k", "nliThreshold", "visibility"];
    const updates: any = {};

    for (const field of allowedFields) {
      if (field in body) {
        // Validate nliThreshold range
        if (field === "nliThreshold") {
          const value = body[field];
          if (typeof value !== "number" || value < 0 || value > 1) {
            return NextResponse.json(
              { error: "nliThreshold must be a number between 0 and 1" },
              { status: 400 }
            );
          }
        }
        // Validate visibility enum
        if (field === "visibility") {
          const value = body[field];
          if (!(["public", "unlisted", "private"] as const).includes(value)) {
            return NextResponse.json(
              { error: "visibility must be one of: public, unlisted, private" },
              { status: 400 }
            );
          }
        }
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Check if user has permission to update (creator or admin)
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { createdById: true },
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // TODO: Add proper role-based permission check
    // For now, allow creator to update
    if (deliberation.createdById !== user.userId.toString()) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Update settings
    const updated = await prisma.deliberation.update({
      where: { id: deliberationId },
      data: updates,
      select: {
        id: true,
        dsMode: true,
        proofMode: true,
        title: true,
        rule: true,
        k: true,
        nliThreshold: true,
        visibility: true,
        createdById: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating deliberation settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
