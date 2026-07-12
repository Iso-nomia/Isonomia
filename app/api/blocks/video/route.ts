export const dynamic = "force-dynamic";

/**
 * POST /api/blocks/video
 * 
 * Create a new video block
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";
import { parseVideoUrl } from "@/lib/blocks/linkExtractor";
import { enqueueBlockProcessing } from "@/lib/blocks/processingQueue";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user || !user.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const userId = BigInt(user.userId);

  // Parse request body
  let body: { url?: string; stackId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, stackId, note } = body;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Parse video info
  const videoInfo = parseVideoUrl(url);

  // Check stack permissions if provided
  if (stackId) {
    const canEdit = await canEditStack(stackId, userId);
    if (!canEdit) {
      return NextResponse.json({ error: "Cannot add to this stack" }, { status: 403 });
    }
  }

  try {
    // Create the block
    const block = await prisma.libraryPost.create({
      data: {
        uploader_id: userId,
        blockType: "video",
        videoUrl: url,
        videoProvider: videoInfo.provider,
        videoEmbedId: videoInfo.embedId,
        videoThumb: videoInfo.thumbnail,
        title: `${videoInfo.provider} video`, // Placeholder
        processingStatus: "pending",
        page_count: 0, // Required field, not applicable to video
        file_url: null, // Not applicable to video blocks
      },
    });

    // Connect to stack if provided
    if (stackId) {
      const maxPos = await prisma.stackItem.aggregate({
        where: { stackId },
        _max: { position: true },
      });

      await prisma.stackItem.create({
        data: {
          stackId,
          blockId: block.id,
          kind: "block",
          position: (maxPos._max.position ?? 0) + 1000,
          addedById: userId,
          note: note || undefined,
        },
      });

      // Also update legacy fields for backward compatibility
      await prisma.libraryPost.update({
        where: { id: block.id },
        data: { stack_id: stackId },
      });

      revalidatePath(`/stacks/${stackId}`);
    }

    // Queue background processing to fetch title
    enqueueBlockProcessing(block.id, "video");

    return NextResponse.json({
      success: true,
      block: {
        id: block.id,
        blockType: "video",
        videoUrl: url,
        videoProvider: videoInfo.provider,
        videoEmbedId: videoInfo.embedId,
        videoThumb: videoInfo.thumbnail,
        processingStatus: "pending",
      },
    });
  } catch (error: any) {
    console.error("Error creating video block:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create video block" },
      { status: 500 }
    );
  }
}
