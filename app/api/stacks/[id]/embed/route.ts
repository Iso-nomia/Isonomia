export const dynamic = "force-dynamic";

/**
 * POST /api/stacks/[id]/embed
 * 
 * Phase 1.4 of Stacks Improvement Roadmap
 * 
 * Embed another stack as an item within this stack.
 * 
 * Body:
 *   - embedStackId: string - The Stack ID to embed
 *   - note?: string - Optional note about why this was embedded
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { canEditStack } from "@/lib/stacks/permissions";
import { wouldCreateCycle, isStackEmbedded } from "@/lib/stacks/embedValidation";
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
  const { id: parentStackId } = await params;

  // Parse request body
  let body: { embedStackId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { embedStackId, note } = body;

  if (!embedStackId) {
    return NextResponse.json({ error: "embedStackId is required" }, { status: 400 });
  }

  // Check if user can edit the parent stack
  const canEdit = await canEditStack(parentStackId, userId);
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify the stack to embed exists
  const embedStack = await prisma.stack.findUnique({
    where: { id: embedStackId },
    select: { 
      id: true, 
      name: true, 
      slug: true,
      description: true,
      is_public: true, 
      owner_id: true,
      owner: {
        select: { id: true, name: true, username: true },
      },
      _count: { select: { items: true } },
    },
  });

  if (!embedStack) {
    return NextResponse.json({ error: "Stack to embed not found" }, { status: 404 });
  }

  // Check visibility - can only embed stacks user can view
  // Use the new permissions system that accounts for visibility modes
  const { canViewStack } = await import("@/lib/stacks/permissions");
  const canViewEmbed = await canViewStack(embedStackId, userId);

  if (!canViewEmbed) {
    return NextResponse.json(
      { error: "You don't have permission to embed this stack" },
      { status: 403 }
    );
  }

  // Check for cycles
  if (await wouldCreateCycle(parentStackId, embedStackId)) {
    return NextResponse.json(
      { error: "Cannot embed: would create circular reference" },
      { status: 400 }
    );
  }

  // Check if already embedded
  if (await isStackEmbedded(parentStackId, embedStackId)) {
    return NextResponse.json(
      { error: "Stack is already embedded" },
      { status: 409 }
    );
  }

  // Get max position for this stack
  const maxPositionItem = await prisma.stackItem.findFirst({
    where: { stackId: parentStackId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const newPosition = (maxPositionItem?.position ?? 0) + 1;

  // Create StackItem with kind=stack_embed
  const item = await prisma.stackItem.create({
    data: {
      stackId: parentStackId,
      embedStackId,
      kind: "stack_embed",
      position: newPosition,
      addedById: userId,
      note: note || null,
    },
    include: {
      embedStack: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          owner: { select: { id: true, name: true, username: true } },
          _count: { select: { items: true } },
        },
      },
      addedBy: {
        select: { id: true, name: true, username: true },
      },
    },
  });

  // Revalidate stack page
  revalidatePath(`/stacks/${parentStackId}`);

  // Convert BigInt IDs to strings for JSON serialization
  return NextResponse.json({
    success: true,
    item: {
      id: item.id,
      stackId: item.stackId,
      embedStackId: item.embedStackId,
      kind: item.kind,
      position: item.position,
      note: item.note,
      embedStack: item.embedStack ? {
        ...item.embedStack,
        owner: item.embedStack.owner ? {
          ...item.embedStack.owner,
          id: String(item.embedStack.owner.id),
        } : null,
      } : null,
      addedBy: item.addedBy ? {
        ...item.addedBy,
        id: String(item.addedBy.id),
      } : null,
    },
  });
}
