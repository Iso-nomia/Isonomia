export const dynamic = "force-dynamic";

/**
 * POST /api/stacks/[id]/reorder
 * 
 * Reorder a block within a stack
 * 
 * Phase 1.1 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";
import { reorderBlockInStack, isBlockInStack } from "@/lib/stacks/stackItemWriter";
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
  let body: {
    blockId?: string;
    afterBlockId?: string | null;
    beforeBlockId?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { blockId, afterBlockId, beforeBlockId } = body;

  if (!blockId) {
    return NextResponse.json({ error: "blockId is required" }, { status: 400 });
  }

  // Check if user can edit the stack
  const canEdit = await canEditStack(stackId, userId);
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if the block is in this stack
  const isConnected = await isBlockInStack(stackId, blockId);
  if (!isConnected) {
    return NextResponse.json(
      { error: "Block is not connected to this stack" },
      { status: 404 }
    );
  }

  // Validate neighbor blocks if provided
  if (afterBlockId) {
    const afterExists = await isBlockInStack(stackId, afterBlockId);
    if (!afterExists) {
      return NextResponse.json(
        { error: "afterBlockId is not in this stack" },
        { status: 400 }
      );
    }
  }

  if (beforeBlockId) {
    const beforeExists = await isBlockInStack(stackId, beforeBlockId);
    if (!beforeExists) {
      return NextResponse.json(
        { error: "beforeBlockId is not in this stack" },
        { status: 400 }
      );
    }
  }

  try {
    const newPosition = await reorderBlockInStack(
      stackId,
      blockId,
      afterBlockId,
      beforeBlockId
    );

    // Revalidate stack page
    revalidatePath(`/stacks/${stackId}`);

    return NextResponse.json({
      success: true,
      newPosition,
    });
  } catch (error: any) {
    console.error("Error reordering block in stack:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reorder block" },
      { status: 500 }
    );
  }
}
