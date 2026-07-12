export const dynamic = "force-dynamic";

/**
 * Reference Manager Libraries API
 *
 * Get available libraries/collections for a connection.
 *
 * @route GET /api/reference-managers/[connectionId]/libraries
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { createZoteroClientFromConnection } from "@/lib/sources/referenceManagers/zotero";

interface RouteContext {
  params: Promise<{ connectionId: string }>;
}

/**
 * GET - Get available libraries and collections
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

    // Get connection with ownership check
    const connection = await prisma.referenceManagerConnection.findFirst({
      where: {
        id: connectionId,
        userId: BigInt(userId),
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    if (connection.provider === "zotero") {
      const client = createZoteroClientFromConnection(connection);

      const [libraries, collections] = await Promise.all([
        client.getLibraries(),
        client.getCollections(),
      ]);

      return NextResponse.json({
        success: true,
        libraries,
        collections: collections.map((c) => ({
          key: c.key,
          name: c.data.name,
          parentKey: c.data.parentCollection || null,
        })),
      });
    }

    return NextResponse.json(
      { error: `Provider ${connection.provider} not yet supported` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Get libraries error:", error);
    return NextResponse.json(
      { error: "Failed to get libraries" },
      { status: 500 }
    );
  }
}
