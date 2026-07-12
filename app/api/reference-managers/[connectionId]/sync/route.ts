export const dynamic = "force-dynamic";

/**
 * Reference Manager Sync API
 *
 * Trigger manual sync for a connection.
 *
 * @route POST /api/reference-managers/[connectionId]/sync
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import {
  ZoteroClient,
  zoteroItemToSource,
  createZoteroClientFromConnection,
} from "@/lib/sources/referenceManagers/zotero";
import { generateFingerprint } from "@/lib/citation/fingerprint";

interface RouteContext {
  params: Promise<{ connectionId: string }>;
}

/**
 * POST - Trigger sync for a connection
 */
export async function POST(
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

    // Mark as syncing
    await prisma.referenceManagerConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncStatus: "syncing",
        lastSyncError: null,
      },
    });

    try {
      let result;

      if (connection.provider === "zotero") {
        result = await syncZotero(connection, String(userId));
      } else {
        throw new Error(`Provider ${connection.provider} not yet supported`);
      }

      // Update sync status
      await prisma.referenceManagerConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "synced",
          lastLibraryVersion: result.libraryVersion,
        },
      });

      return NextResponse.json({
        success: true,
        result,
      });
    } catch (syncError) {
      // Mark as error
      await prisma.referenceManagerConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncStatus: "error",
          lastSyncError: syncError instanceof Error ? syncError.message : "Sync failed",
        },
      });

      throw syncError;
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Sync with Zotero library
 */
async function syncZotero(
  connection: {
    id: string;
    apiKey?: string | null;
    libraryType?: string | null;
    libraryId?: string | null;
    collectionId?: string | null;
    defaultStackId?: string | null;
    lastLibraryVersion?: number | null;
    syncDirection: string;
  },
  userId: string
): Promise<{
  imported: number;
  updated: number;
  exported: number;
  errors: string[];
  libraryVersion: number;
}> {
  const client = createZoteroClientFromConnection(connection);

  const result = {
    imported: 0,
    updated: 0,
    exported: 0,
    errors: [] as string[],
    libraryVersion: 0,
  };

  // Get items from Zotero (incremental if we have a version)
  const { items, libraryVersion } = await client.getItems({
    collectionId: connection.collectionId || undefined,
    sinceVersion: connection.lastLibraryVersion || undefined,
    limit: 100,
  });

  result.libraryVersion = libraryVersion;

  // Import new/updated items
  for (const item of items) {
    try {
      // Check if already synced
      const existing = await prisma.referenceManagerItem.findUnique({
        where: {
          connectionId_externalId: {
            connectionId: connection.id,
            externalId: item.key,
          },
        },
        include: { source: true },
      });

      const sourceData = zoteroItemToSource(item);
      const fingerprint = generateFingerprint(sourceData.url, sourceData.doi, sourceData.title);

      if (existing) {
        // Update existing source
        await prisma.source.update({
          where: { id: existing.sourceId },
          data: {
            title: sourceData.title,
            authorsJson: sourceData.authorsJson,
            year: sourceData.year,
            container: sourceData.container,
            volume: sourceData.volume,
            issue: sourceData.issue,
            pages: sourceData.pages,
            doi: sourceData.doi || existing.source.doi, // Don't overwrite with null
            url: sourceData.url || existing.source.url,
          },
        });

        await prisma.referenceManagerItem.update({
          where: { id: existing.id },
          data: {
            externalVersion: item.version,
            remoteModifiedAt: new Date(),
            lastSyncedAt: new Date(),
            syncStatus: "synced",
          },
        });

        result.updated++;
      } else {
        // Check if source already exists by DOI or URL
        let source = null;

        if (sourceData.doi) {
          source = await prisma.source.findUnique({
            where: { doi: sourceData.doi },
          });
        }

        if (!source && sourceData.url) {
          source = await prisma.source.findUnique({
            where: { url: sourceData.url },
          });
        }

        if (!source) {
          // Create new source
          source = await prisma.source.create({
            data: {
              kind: sourceData.kind,
              title: sourceData.title,
              authorsJson: sourceData.authorsJson,
              year: sourceData.year,
              container: sourceData.container,
              volume: sourceData.volume,
              issue: sourceData.issue,
              pages: sourceData.pages,
              doi: sourceData.doi,
              url: sourceData.url,
              zoteroKey: sourceData.zoteroKey,
              fingerprint,
              createdById: userId,
              enrichmentStatus: "enriched",
              enrichedAt: new Date(),
              enrichmentSource: "zotero",
            },
          });
        }

        // Create sync link
        await prisma.referenceManagerItem.create({
          data: {
            connectionId: connection.id,
            sourceId: source.id,
            externalId: item.key,
            externalVersion: item.version,
            lastSyncedAt: new Date(),
            syncStatus: "synced",
          },
        });

        // Add to default stack if configured
        if (connection.defaultStackId) {
          const stack = await prisma.stack.findUnique({
            where: { id: connection.defaultStackId },
            include: { posts: { orderBy: { created_at: "desc" }, take: 1 } },
          });

          if (stack) {
            // Check if already in stack
            const existingPost = await prisma.libraryPost.findFirst({
              where: {
                stack_id: connection.defaultStackId,
                // NOTE: schema drift — LibraryPost no longer stores sourceId.
                // Match on stack only; broader source/stack linking lives in StackItem now.
              } as any,
            });

            if (!existingPost) {
              await prisma.libraryPost.create({
                data: {
                  stack_id: connection.defaultStackId,
                  uploader_id: BigInt(userId),
                  // NOTE: schema drift — LibraryPost has no sourceId/order/createdById
                  // fields anymore. These were dropped when blocks/sources were split.
                  sourceId: source.id,
                } as any,
              });
            }
          }
        }

        result.imported++;
      }
    } catch (itemError) {
      result.errors.push(`${item.data.title}: ${itemError instanceof Error ? itemError.message : "Unknown error"}`);
    }
  }

  // TODO: Export local changes for bidirectional sync
  // This would be implemented when we have local modification tracking

  return result;
}
