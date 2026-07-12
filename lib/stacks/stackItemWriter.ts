/**
 * StackItem Writer Utilities
 * 
 * Phase 1.1 of Stacks Improvement Roadmap
 * 
 * This module provides dual-write functionality during the migration period.
 * Once migration is verified complete, the legacy writes can be removed.
 */

import { prisma } from "@/lib/prismaclient";
import { StackItemKind } from "@prisma/client";

// ============================================================
// Types
// ============================================================

export interface AddBlockToStackParams {
  stackId: string;
  blockId: string;
  addedById: bigint;
  position?: number;  // If not provided, append to end
  note?: string;
}

export interface AddStackEmbedParams {
  parentStackId: string;
  embedStackId: string;
  addedById: bigint;
  position?: number;
  note?: string;
}

export interface StackItemResult {
  id: string;
  stackId: string;
  blockId: string | null;
  embedStackId: string | null;
  kind: StackItemKind;
  position: number;
  addedById: bigint;
  note: string | null;
  createdAt: Date;
}

// ============================================================
// Core Operations
// ============================================================

/**
 * Add a block (LibraryPost) to a stack
 * Performs dual-write: creates StackItem + updates legacy fields
 */
export async function addBlockToStack(params: AddBlockToStackParams): Promise<StackItemResult> {
  const { stackId, blockId, addedById, note } = params;

  // Calculate position if not provided (append to end)
  let position = params.position;
  if (position === undefined) {
    const maxPos = await prisma.stackItem.aggregate({
      where: { stackId },
      _max: { position: true },
    });
    position = (maxPos._max.position ?? 0) + 1000;
  }

  // Check if already connected
  const existing = await prisma.stackItem.findUnique({
    where: { stackId_blockId: { stackId, blockId } },
  });
  if (existing) {
    throw new Error("Block already connected to this stack");
  }

  // Create StackItem (primary)
  const item = await prisma.stackItem.create({
    data: {
      stackId,
      blockId,
      kind: "block",
      position,
      addedById,
      note,
    },
  });

  // DUAL-WRITE: Update legacy fields for backward compatibility
  // TODO: Remove after migration is complete
  await prisma.$transaction([
    // Update LibraryPost.stack_id (set to this stack if not already set)
    prisma.libraryPost.update({
      where: { id: blockId },
      data: { stack_id: stackId },
    }),
    // Append to Stack.order array (if not already present)
    prisma.$executeRaw`
      UPDATE stacks 
      SET "order" = array_append("order", ${blockId}::text)
      WHERE id = ${stackId}
      AND NOT (${blockId}::text = ANY("order"))
    `,
  ]);

  return item;
}

/**
 * Add an embedded stack to a parent stack
 */
export async function addStackEmbed(params: AddStackEmbedParams): Promise<StackItemResult> {
  const { parentStackId, embedStackId, addedById, note } = params;

  // Prevent self-embedding
  if (parentStackId === embedStackId) {
    throw new Error("Cannot embed a stack within itself");
  }

  // Calculate position if not provided
  let position = params.position;
  if (position === undefined) {
    const maxPos = await prisma.stackItem.aggregate({
      where: { stackId: parentStackId },
      _max: { position: true },
    });
    position = (maxPos._max.position ?? 0) + 1000;
  }

  // Check if already embedded
  const existing = await prisma.stackItem.findUnique({
    where: { stackId_embedStackId: { stackId: parentStackId, embedStackId } },
  });
  if (existing) {
    throw new Error("Stack already embedded in this stack");
  }

  // Create StackItem
  const item = await prisma.stackItem.create({
    data: {
      stackId: parentStackId,
      embedStackId,
      kind: "stack_embed",
      position,
      addedById,
      note,
    },
  });

  return item;
}

/**
 * Remove a block from a stack
 */
export async function removeBlockFromStack(stackId: string, blockId: string): Promise<void> {
  // Delete StackItem (primary)
  await prisma.stackItem.delete({
    where: { stackId_blockId: { stackId, blockId } },
  });

  // DUAL-WRITE: Update legacy fields
  // Check if block is in other stacks
  const otherConnections = await prisma.stackItem.findFirst({
    where: { blockId, stackId: { not: stackId } },
    select: { stackId: true },
  });

  await prisma.$transaction([
    // Update stack_id to another stack or null
    prisma.libraryPost.update({
      where: { id: blockId },
      data: { stack_id: otherConnections?.stackId ?? null },
    }),
    // Remove from order array
    prisma.$executeRaw`
      UPDATE stacks 
      SET "order" = array_remove("order", ${blockId}::text)
      WHERE id = ${stackId}
    `,
  ]);
}

/**
 * Remove an embedded stack from a parent stack
 */
export async function removeStackEmbed(parentStackId: string, embedStackId: string): Promise<void> {
  await prisma.stackItem.delete({
    where: { stackId_embedStackId: { stackId: parentStackId, embedStackId } },
  });
}

/**
 * Reorder a stack item to a new position
 */
export async function reorderStackItem(
  stackId: string,
  itemId: string,
  newPosition: number
): Promise<void> {
  // Update StackItem position
  await prisma.stackItem.update({
    where: { id: itemId },
    data: { position: newPosition },
  });

  // DUAL-WRITE: Rebuild order array from StackItem positions
  const items = await prisma.stackItem.findMany({
    where: { stackId, kind: "block" },
    orderBy: { position: "asc" },
    select: { blockId: true },
  });

  await prisma.stack.update({
    where: { id: stackId },
    data: { order: items.map((i) => i.blockId!).filter(Boolean) },
  });
}

/**
 * Reorder a block within a stack based on neighbor positions
 */
export async function reorderBlockInStack(
  stackId: string,
  blockId: string,
  afterBlockId?: string | null,
  beforeBlockId?: string | null
): Promise<number> {
  // Calculate new position based on neighbors
  let newPosition: number;

  if (!afterBlockId && !beforeBlockId) {
    // Move to start
    const first = await prisma.stackItem.findFirst({
      where: { stackId },
      orderBy: { position: "asc" },
      select: { position: true },
    });
    newPosition = (first?.position ?? 1000) / 2;
  } else if (afterBlockId && !beforeBlockId) {
    // Move to end (after afterBlockId)
    const after = await prisma.stackItem.findUnique({
      where: { stackId_blockId: { stackId, blockId: afterBlockId } },
      select: { position: true },
    });
    newPosition = (after?.position ?? 0) + 1000;
  } else if (afterBlockId && beforeBlockId) {
    // Move between two items
    const [after, before] = await Promise.all([
      prisma.stackItem.findUnique({
        where: { stackId_blockId: { stackId, blockId: afterBlockId } },
        select: { position: true },
      }),
      prisma.stackItem.findUnique({
        where: { stackId_blockId: { stackId, blockId: beforeBlockId } },
        select: { position: true },
      }),
    ]);
    newPosition = ((after?.position ?? 0) + (before?.position ?? 2000)) / 2;
  } else {
    // beforeBlockId only: move to start
    const before = await prisma.stackItem.findUnique({
      where: { stackId_blockId: { stackId, blockId: beforeBlockId! } },
      select: { position: true },
    });
    newPosition = (before?.position ?? 1000) / 2;
  }

  // Update StackItem position
  await prisma.stackItem.update({
    where: { stackId_blockId: { stackId, blockId } },
    data: { position: newPosition },
  });

  // DUAL-WRITE: Rebuild order array
  const items = await prisma.stackItem.findMany({
    where: { stackId, kind: "block" },
    orderBy: { position: "asc" },
    select: { blockId: true },
  });

  await prisma.stack.update({
    where: { id: stackId },
    data: { order: items.map((i) => i.blockId!).filter(Boolean) },
  });

  return newPosition;
}

// ============================================================
// Query Helpers
// ============================================================

/**
 * Get all stacks that a block is connected to
 */
export async function getBlockContexts(blockId: string, viewerId?: bigint) {
  const connections = await prisma.stackItem.findMany({
    where: { blockId },
    include: {
      stack: {
        select: {
          id: true,
          name: true,
          slug: true,
          is_public: true,
          owner_id: true,
          owner: {
            select: { id: true, name: true, username: true, image: true },
          },
          _count: { select: { items: true } },
        },
      },
      addedBy: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter to only stacks the user can view
  const visibleConnections = connections.filter((c) => {
    if (c.stack.is_public) return true;
    if (!viewerId) return false;
    return c.stack.owner_id === viewerId;
    // TODO: Also check collaborator access
  });

  return visibleConnections.map((c) => ({
    stackId: c.stack.id,
    stackName: c.stack.name,
    stackSlug: c.stack.slug,
    owner: c.stack.owner,
    itemCount: c.stack._count.items,
    addedBy: c.addedBy,
    addedAt: c.createdAt,
    note: c.note,
  }));
}

/**
 * Get ordered items for a stack (blocks and embedded stacks)
 */
export async function getStackItems(stackId: string) {
  return prisma.stackItem.findMany({
    where: { stackId },
    orderBy: { position: "asc" },
    include: {
      block: {
        include: {
          annotations: true,
          uploader: {
            select: { id: true, name: true, username: true, image: true },
          },
        },
      },
      embedStack: {
        select: {
          id: true,
          name: true,
          slug: true,
          is_public: true,
          owner: {
            select: { id: true, name: true, username: true, image: true },
          },
          _count: { select: { items: true } },
        },
      },
      addedBy: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
  });
}

/**
 * Check if a block is connected to a specific stack
 */
export async function isBlockInStack(stackId: string, blockId: string): Promise<boolean> {
  const item = await prisma.stackItem.findUnique({
    where: { stackId_blockId: { stackId, blockId } },
    select: { id: true },
  });
  return item !== null;
}

/**
 * Get the count of stacks a block is connected to
 */
export async function getBlockConnectionCount(blockId: string): Promise<number> {
  return prisma.stackItem.count({
    where: { blockId },
  });
}
