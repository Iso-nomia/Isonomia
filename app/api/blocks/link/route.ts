export const dynamic = "force-dynamic";

/**
 * POST /api/blocks/link
 * 
 * Create a new link block
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { enqueueBlockProcessing } from "@/lib/blocks/processingQueue";
import { canEditStack } from "@/lib/stacks/permissions";
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

  // Check stack permissions if provided
  if (stackId) {
    const canEdit = await canEditStack(stackId, userId);
    if (!canEdit) {
      return NextResponse.json({ error: "Cannot add to this stack" }, { status: 403 });
    }
  }

  try {
    // Create the block with pending status
    const block = await prisma.libraryPost.create({
      data: {
        uploader_id: userId,
        blockType: "link",
        linkUrl: url,
        title: parsedUrl.hostname, // Placeholder until processed
        processingStatus: "pending",
        page_count: 0, // Required field, not applicable to links
        file_url: null, // Not applicable to link blocks
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

    // Queue background processing
    enqueueBlockProcessing(block.id, "link");

    return NextResponse.json({
      success: true,
      block: {
        id: block.id,
        blockType: "link",
        linkUrl: url,
        title: parsedUrl.hostname,
        processingStatus: "pending",
      },
    });
  } catch (error: any) {
    console.error("Error creating link block:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create link block" },
      { status: 500 }
    );
  }
}
