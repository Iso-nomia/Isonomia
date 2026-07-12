export const dynamic = "force-dynamic";

/**
 * DELETE /api/stacks/[id]/disconnect/[blockId]
 * 
 * Disconnect a block (LibraryPost) from a stack
 * 
 * Phase 1.1 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";
import { removeBlockFromStack, isBlockInStack } from "@/lib/stacks/stackItemWriter";
import { revalidatePath } from "next/cache";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const user = await getUserFromCookies();
  if (!user || !user.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const userId = BigInt(user.userId);
  const { id: stackId, blockId } = await params;

  // Check if user can edit the stack
  const canEdit = await canEditStack(stackId, userId);
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check if the block is actually connected to this stack
  const isConnected = await isBlockInStack(stackId, blockId);
  if (!isConnected) {
    return NextResponse.json(
      { error: "Block is not connected to this stack" },
      { status: 404 }
    );
  }

  try {
    await removeBlockFromStack(stackId, blockId);

    // Revalidate stack page
    revalidatePath(`/stacks/${stackId}`);

    return NextResponse.json({
      success: true,
      message: "Block disconnected from stack",
    });
  } catch (error: any) {
    console.error("Error disconnecting block from stack:", error);
    return NextResponse.json(
      { error: error.message || "Failed to disconnect block from stack" },
      { status: 500 }
    );
  }
}
