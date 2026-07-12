export const dynamic = "force-dynamic";

/**
 * GET /api/blocks/[id]/contexts
 * 
 * Get all stacks that a block is connected to
 * 
 * Phase 1.1 of Stacks Improvement Roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { getBlockContexts, getBlockConnectionCount } from "@/lib/stacks/stackItemWriter";
import { prisma } from "@/lib/prismaclient";
import { jsonSafeStr } from "@/lib/bigintjson";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  const viewerId = user?.userId ? BigInt(user.userId) : null;
  const { id: blockId } = await params;

  // Check if the block exists
  const block = await prisma.libraryPost.findUnique({
    where: { id: blockId },
    select: { id: true, title: true },
  });

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  try {
    const contexts = await getBlockContexts(blockId, viewerId ?? undefined);
    const totalCount = await getBlockConnectionCount(blockId);

    return NextResponse.json(jsonSafeStr({
      blockId,
      contexts,
      visibleCount: contexts.length,
      totalCount,
    }));
  } catch (error: any) {
    console.error("Error fetching block contexts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch block contexts" },
      { status: 500 }
    );
  }
}
