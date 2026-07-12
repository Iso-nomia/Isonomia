export const dynamic = "force-dynamic";

/**
 * GET /api/arguments/[id]/chains
 * Returns all argument chains that contain this argument
 * 
 * Task 1.5: Add chain membership endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { id: argumentId } = params;

    // Find all chain nodes that reference this argument
    const chainNodes = await prisma.argumentChainNode.findMany({
      where: { argumentId },
      include: {
        chain: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            _count: {
              select: {
                nodes: true,
                edges: true,
              },
            },
          },
        },
      },
    });

    // Transform to response format
    const chains = chainNodes.map((node) => ({
      // Chain info
      chainId: node.chain.id,
      chainName: node.chain.name,
      chainDescription: node.chain.description,
      chainType: node.chain.chainType,
      
      // Position info
      nodeId: node.id,
      role: node.role,
      nodeOrder: node.nodeOrder,
      
      // Chain stats
      nodeCount: node.chain._count.nodes,
      edgeCount: node.chain._count.edges,
      
      // Creator
      creator: {
        id: String(node.chain.creator.id),
        name: node.chain.creator.name,
        image: node.chain.creator.image,
      },
      
      // Timestamps
      chainCreatedAt: node.chain.createdAt,
    }));

    return NextResponse.json({
      ok: true,
      argumentId,
      chains,
      count: chains.length,
    }, NO_STORE);

  } catch (error) {
    console.error("[GET /api/arguments/[id]/chains] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch chain membership" },
      { status: 500, ...NO_STORE }
    );
  }
}
