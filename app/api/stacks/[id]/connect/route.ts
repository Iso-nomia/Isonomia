export const dynamic = "force-dynamic";

/**
 * POST /api/stacks/[id]/connect
 * 
 * Connect a block (LibraryPost) to a stack
 * 
 * Phase 1.1 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";
import { addBlockToStack, isBlockInStack } from "@/lib/stacks/stackItemWriter";
import { prisma } from "@/lib/prismaclient";
import { revalidatePath } from "next/cache";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  if (!user || !user.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const userId = BigInt(user.userId);
  const { id: stackId } = await params;

  // Parse request body
  let body: { blockId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { blockId, note } = body;

  if (!blockId) {
    return NextResponse.json({ error: "blockId is required" }, { status: 400 });
  }

  // Check if user can edit the stack
  const canEdit = await canEditStack(stackId, userId);
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if the block exists
  const block = await prisma.libraryPost.findUnique({
    where: { id: blockId },
    select: { id: true, title: true },
  });

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  // Check if already connected
  const alreadyConnected = await isBlockInStack(stackId, blockId);
  if (alreadyConnected) {
    return NextResponse.json(
      { error: "Block is already connected to this stack" },
      { status: 409 }
    );
  }

  try {
    const item = await addBlockToStack({
      stackId,
      blockId,
      addedById: userId,
      note: note || undefined,
    });

    // Revalidate stack page
    revalidatePath(`/stacks/${stackId}`);

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        stackId: item.stackId,
        blockId: item.blockId,
        position: item.position,
        note: item.note,
        createdAt: item.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Error connecting block to stack:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect block to stack" },
      { status: 500 }
    );
  }
}
