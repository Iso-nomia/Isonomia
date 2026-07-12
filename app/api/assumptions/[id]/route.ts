export const dynamic = "force-dynamic";

// app/api/assumptions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

/**
 * GET /api/assumptions/[id]
 * Retrieve a single assumption by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assumptionId = params.id;

    const assumption = await prisma.assumptionUse.findUnique({
      where: { id: assumptionId },
    });

    if (!assumption) {
      return NextResponse.json(
        { error: "Assumption not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(assumption, { status: 200 });
  } catch (error) {
    console.error("Error fetching assumption:", error);
    return NextResponse.json(
      { error: "Failed to fetch assumption" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/assumptions/[id]
 * Update an assumption's properties
 * 
 * Body:
 * - assumptionText: string (optional)
 * - role: string (optional)
 * - weight: number (optional, 0-1)
 * - confidence: number (optional, 0-1)
 * - metaJson: object (optional)
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

    const assumptionId = params.id;
    const body = await request.json();
    const { assumptionText, role, weight, confidence, metaJson } = body;

    // Fetch existing assumption
    const existing = await prisma.assumptionUse.findUnique({
      where: { id: assumptionId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Assumption not found" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (assumptionText !== undefined) updateData.assumptionText = assumptionText;
    if (role !== undefined) updateData.role = role;
    if (weight !== undefined) updateData.weight = weight;
    if (confidence !== undefined) updateData.confidence = confidence;
    if (metaJson !== undefined) updateData.metaJson = metaJson;

    // Update the assumption
    const updated = await prisma.assumptionUse.update({
      where: { id: assumptionId },
      data: updateData,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Error updating assumption:", error);
    return NextResponse.json(
      { error: "Failed to update assumption" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assumptions/[id]
 * Delete an assumption
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assumptionId = params.id;

    // Check if assumption exists
    const existing = await prisma.assumptionUse.findUnique({
      where: { id: assumptionId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Assumption not found" },
        { status: 404 }
      );
    }

    // Delete the assumption
    await prisma.assumptionUse.delete({
      where: { id: assumptionId },
    });

    return NextResponse.json(
      { message: "Assumption deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting assumption:", error);
    return NextResponse.json(
      { error: "Failed to delete assumption" },
      { status: 500 }
    );
  }
}
