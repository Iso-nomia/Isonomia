export const dynamic = "force-dynamic";

/**
 * API endpoint for creating recursive attacks (attacking edges/relationships)
 * 
 * POST /api/argument-chains/[chainId]/attack-edge
 * 
 * Creates a new node that attacks an edge (relationship) rather than a node.
 * This implements recursive dialectics where users can challenge the inference
 * rule connecting two arguments.
 * 
 * Example: "I object to your SUPPORTS relationship because the premise
 * doesn't actually entail the conclusion."
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";

const AttackEdgeSchema = z.object({
  edgeId: z.string().min(1, "Edge ID required"),
  argumentId: z.string().min(1, "Argument ID required"),
  role: z.enum(["PREMISE", "EVIDENCE", "CONCLUSION", "OBJECTION", "REBUTTAL", "QUALIFIER"]).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

type AttackEdgeRequest = z.infer<typeof AttackEdgeSchema>;

export async function POST(
  req: NextRequest,
  { params }: { params: { chainId: string } }
) {
  const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;
  
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId } = params;
    const body = await req.json();
    const validated = AttackEdgeSchema.safeParse(body);
    
    if (!validated.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", details: validated.error.errors },
        { status: 400, ...NO_STORE }
      );
    }

    const { edgeId, argumentId, role, positionX, positionY } = validated.data;

    // Check chain exists
    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
      include: {
        nodes: true,
      },
    });

    if (!chain) {
      return NextResponse.json(
        { ok: false, error: "Chain not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Check permissions
    const isCreator = chain.createdBy === BigInt(user.userId);
    const canEdit = isCreator || chain.isEditable;

    if (!canEdit) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to edit this chain" },
        { status: 403, ...NO_STORE }
      );
    }

    // Verify edge exists in this chain
    const targetEdge = await prisma.argumentChainEdge.findUnique({
      where: { id: edgeId },
    });

    if (!targetEdge || targetEdge.chainId !== chainId) {
      return NextResponse.json(
        { ok: false, error: "Edge not found in this chain" },
        { status: 404, ...NO_STORE }
      );
    }

    // Verify argument exists and is in same deliberation
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
    });

    if (!argument) {
      return NextResponse.json(
        { ok: false, error: "Argument not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (argument.deliberationId !== chain.deliberationId) {
      return NextResponse.json(
        { ok: false, error: "Argument must be from the same deliberation" },
        { status: 400, ...NO_STORE }
      );
    }

    // Calculate next node order
    const maxOrder =
      chain.nodes.length > 0
        ? Math.max(...chain.nodes.map((n) => n.nodeOrder))
        : 0;

    // Create the attacking node with targetType = EDGE
    const attackingNode = await prisma.argumentChainNode.create({
      data: {
        chainId,
        argumentId,
        nodeOrder: maxOrder + 1,
        role: role || "OBJECTION",
        targetType: "EDGE", // This makes it an edge attack
        targetEdgeId: edgeId, // Reference to the attacked edge
        positionX: positionX ?? null,
        positionY: positionY ?? null,
        addedBy: BigInt(user.userId),
      },
      include: {
        argument: {
          include: {
            claim: true,
            conclusion: true,
            premises: {
              include: {
                claim: true,
              },
            },
            argumentSchemes: {
              include: {
                scheme: true,
              },
            },
          },
        },
        contributor: true,
        targetEdge: {
          include: {
            sourceNode: {
              include: {
                argument: {
                  include: {
                    claim: true,
                    conclusion: true,
                  },
                },
              },
            },
            targetNode: {
              include: {
                argument: {
                  include: {
                    claim: true,
                    conclusion: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Update chain timestamp
    await prisma.argumentChain.update({
      where: { id: chainId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(
      { ok: true, node: JSON.parse(JSON.stringify(attackingNode, (_, v) => typeof v === "bigint" ? v.toString() : v)) },
      { status: 201, ...NO_STORE }
    );
  } catch (error) {
    console.error("Failed to create edge attack:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create edge attack" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * GET /api/argument-chains/[chainId]/attack-edge?edgeId=xxx
 * 
 * Retrieve all nodes that attack a specific edge
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chainId } = params;
    const { searchParams } = new URL(req.url);
    const edgeId = searchParams.get("edgeId");

    if (!edgeId) {
      return NextResponse.json({ error: "edgeId required" }, { status: 400 });
    }

    // Verify edge exists in this chain
    const edge = await prisma.argumentChainEdge.findUnique({
      where: { id: edgeId },
      include: {
        attackingNodes: {
          include: {
            argument: {
              include: {
                claim: true,
                conclusion: true,
                premises: {
                  include: {
                    claim: true,
                  },
                },
              },
            },
            contributor: true,
          },
        },
      },
    });

    if (!edge || edge.chainId !== chainId) {
      return NextResponse.json(
        { error: "Edge not found in this chain" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      edgeId: edge.id,
      attacks: JSON.parse(JSON.stringify(edge.attackingNodes, (_, v) => typeof v === "bigint" ? v.toString() : v)),
      count: edge.attackingNodes.length,
    });
  } catch (error) {
    console.error("Failed to fetch edge attacks:", error);
    return NextResponse.json(
      { error: "Failed to fetch edge attacks" },
      { status: 500 }
    );
  }
}
