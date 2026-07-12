export const dynamic = "force-dynamic";

/**
 * Reference Manager Connection Management API
 *
 * Manage individual connection settings, trigger sync, delete.
 *
 * @route GET/PATCH/DELETE /api/reference-managers/[connectionId]
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";

interface RouteContext {
  params: Promise<{ connectionId: string }>;
}

/**
 * GET - Get connection details
 */
export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = await context.params;

    const connection = await prisma.referenceManagerConnection.findFirst({
      where: {
        id: connectionId,
        userId: BigInt(userId),
      },
      include: {
        defaultStack: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        items: {
          select: {
            id: true,
            sourceId: true,
            externalId: true,
            syncStatus: true,
            hasConflict: true,
            lastSyncedAt: true,
          },
          take: 100,
          orderBy: { lastSyncedAt: "desc" },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      connection: {
        ...connection,
        itemCount: connection._count.items,
      },
    });
  } catch (error) {
    console.error("Get connection error:", error);
    return NextResponse.json(
      { error: "Failed to get connection" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update connection settings
 */
export async function PATCH(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = await context.params;

    // Verify ownership
    const existing = await prisma.referenceManagerConnection.findFirst({
      where: {
        id: connectionId,
        userId: BigInt(userId),
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const allowedFields = [
      "syncDirection",
      "autoSync",
      "syncIntervalMins",
      "collectionId",
      "defaultStackId",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const connection = await prisma.referenceManagerConnection.update({
      where: { id: connectionId },
      data: updates,
      select: {
        id: true,
        provider: true,
        syncDirection: true,
        autoSync: true,
        syncIntervalMins: true,
        collectionId: true,
        defaultStackId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      connection,
    });
  } catch (error) {
    console.error("Update connection error:", error);
    return NextResponse.json(
      { error: "Failed to update connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove connection and all synced items
 */
export async function DELETE(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { connectionId } = await context.params;

    // Verify ownership
    const existing = await prisma.referenceManagerConnection.findFirst({
      where: {
        id: connectionId,
        userId: BigInt(userId),
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Delete connection (cascades to ReferenceManagerItem)
    await prisma.referenceManagerConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({
      success: true,
      message: "Connection deleted",
    });
  } catch (error) {
    console.error("Delete connection error:", error);
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
