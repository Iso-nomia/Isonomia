export const dynamic = "force-dynamic";

/**
 * POST /api/blocks/text
 * 
 * Create a new text/note block
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";
import { stripMarkdown } from "@/lib/blocks/linkExtractor";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user || !user.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const userId = BigInt(user.userId);

  // Parse request body
  let body: { content?: string; title?: string; stackId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { content, title, stackId, note } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Check stack permissions if provided
  if (stackId) {
    const canEdit = await canEditStack(stackId, userId);
    if (!canEdit) {
      return NextResponse.json({ error: "Cannot add to this stack" }, { status: 403 });
    }
  }

  try {
    // Extract plain text for search
    const plainText = stripMarkdown(content);
    
    // Generate title from content if not provided
    const blockTitle = title?.trim() || plainText.slice(0, 100) + (plainText.length > 100 ? "..." : "");

    // Create the block (no async processing needed for text)
    const block = await prisma.libraryPost.create({
      data: {
        uploader_id: userId,
        blockType: "text",
        textContent: content,
        textPlain: plainText.slice(0, 10000), // Limit for search
        title: blockTitle,
        processingStatus: "completed", // No processing needed
        processedAt: new Date(),
        page_count: 0, // Required field, not applicable to text
        file_url: null, // Not applicable to text blocks
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

    return NextResponse.json({
      success: true,
      block: {
        id: block.id,
        blockType: "text",
        title: blockTitle,
        textContent: content,
        processingStatus: "completed",
      },
    });
  } catch (error: any) {
    console.error("Error creating text block:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create text block" },
      { status: 500 }
    );
  }
}
