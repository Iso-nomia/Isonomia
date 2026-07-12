export const dynamic = "force-dynamic";

/**
 * Reference Manager Connections API
 *
 * Manage connections to external reference managers (Zotero, Mendeley).
 *
 * @route GET/POST /api/reference-managers
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { ZoteroClient } from "@/lib/sources/referenceManagers/zotero";

/**
 * GET - List user's reference manager connections
 */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const connections = await prisma.referenceManagerConnection.findMany({
      where: { userId: BigInt(userId) },
      select: {
        id: true,
        provider: true,
        externalUserId: true,
        externalUsername: true,
        syncDirection: true,
        autoSync: true,
        syncIntervalMins: true,
        libraryType: true,
        libraryId: true,
        collectionId: true,
        defaultStackId: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        createdAt: true,
        updatedAt: true,
        defaultStack: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      connections,
    });
  } catch (error) {
    console.error("Get connections error:", error);
    return NextResponse.json(
      { error: "Failed to get connections" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new reference manager connection
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { provider, apiKey, libraryType, libraryId, syncDirection, autoSync, defaultStackId } = body;

    if (!provider || !["zotero", "mendeley"].includes(provider)) {
      return NextResponse.json(
        { error: "Valid provider required (zotero or mendeley)" },
        { status: 400 }
      );
    }

    // Check if connection already exists
    const existing = await prisma.referenceManagerConnection.findUnique({
      where: {
        userId_provider: {
          userId: BigInt(userId),
          provider,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Connection already exists for this provider" },
        { status: 409 }
      );
    }

    // Verify credentials based on provider
    let externalUserId: string | null = null;
    let externalUsername: string | null = null;
    let verifiedLibraryId = libraryId;

    if (provider === "zotero") {
      if (!apiKey) {
        return NextResponse.json(
          { error: "Zotero API key required" },
          { status: 400 }
        );
      }

      try {
        // Verify the API key
        const client = new ZoteroClient({
          apiKey,
          libraryType: libraryType || "user",
          libraryId: libraryId || "0",
        });

        const keyInfo = await client.verifyKey();
        externalUserId = keyInfo.userId;
        externalUsername = keyInfo.username;

        // If no library ID provided, use the user's ID
        if (!verifiedLibraryId && libraryType === "user") {
          verifiedLibraryId = keyInfo.userId;
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid Zotero API key" },
          { status: 400 }
        );
      }
    }

    // Create the connection
    const connection = await prisma.referenceManagerConnection.create({
      data: {
        userId: BigInt(userId),
        provider,
        apiKey: provider === "zotero" ? apiKey : null,
        libraryType: libraryType || "user",
        libraryId: verifiedLibraryId,
        externalUserId,
        externalUsername,
        syncDirection: syncDirection || "bidirectional",
        autoSync: autoSync ?? false,
        defaultStackId,
      },
      select: {
        id: true,
        provider: true,
        externalUserId: true,
        externalUsername: true,
        syncDirection: true,
        autoSync: true,
        libraryType: true,
        libraryId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      connection,
    });
  } catch (error) {
    console.error("Create connection error:", error);
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}
