export const dynamic = "force-dynamic";

/**
 * GET /api/deliberations/[id]/chains
 * Returns all argument chains for a deliberation
 * 
 * Task 1.7/1.8: Support for Chains tab in deliberation view
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "Missing deliberation ID" },
        { status: 400 }
      );
    }

    // Fetch all chains for this deliberation with nodes, edges, and creator
    const chains = await prisma.argumentChain.findMany({
      where: {
        deliberationId,
      },
      include: {
        nodes: {
          include: {
            argument: {
              select: {
                id: true,
                text: true,
                createdAt: true,
                // Include conclusion for proper display text
                conclusion: {
                  select: {
                    id: true,
                    text: true,
                  },
                },
              },
            },
          },
          orderBy: {
            nodeOrder: "asc",
          },
        },
        edges: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform BigInt fields to strings for JSON serialization
    const serializedChains = chains.map((chain) => ({
      ...chain,
      createdBy: String(chain.createdBy),
      creator: chain.creator
        ? {
            ...chain.creator,
            id: String(chain.creator.id),
          }
        : null,
      nodes: chain.nodes.map((node) => ({
        ...node,
        addedBy: String(node.addedBy),
        argument: node.argument
          ? {
              ...node.argument,
              createdAt: node.argument.createdAt.toISOString(),
            }
          : null,
      })),
    }));

    return NextResponse.json({
      ok: true,
      chains: serializedChains,
      count: chains.length,
    });
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/chains] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch chains",
      },
      { status: 500 }
    );
  }
}
