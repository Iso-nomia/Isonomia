export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies, getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const createEdgeSchema = z.object({
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  // Must mirror prisma `enum ArgumentChainEdgeType` (10 members incl. ASPIC+
  // attack types REBUTS / UNDERCUTS / UNDERMINES). Earlier 7-member subset
  // dropped the attack types and prevented chain-architect agents from
  // recording per-edge attack semantics.
  edgeType: z.enum([
    "SUPPORTS",
    "ENABLES",
    "PRESUPPOSES",
    "REFUTES",
    "QUALIFIES",
    "EXEMPLIFIES",
    "GENERALIZES",
    "REBUTS",
    "UNDERCUTS",
    "UNDERMINES",
  ]),
  strength: z.number().min(0).max(1).default(1.0),
  description: z.string().optional(),
  slotMapping: z.record(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const cookieUser = await getUserFromCookies();
    const userIdStr =
      cookieUser?.userId ?? (await getCurrentUserId())?.toString() ?? null;
    if (!userIdStr) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId } = params;
    const body = await req.json();
    const validatedData = createEdgeSchema.parse(body);

    // Fetch chain
    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
    });

    if (!chain) {
      return NextResponse.json(
        { ok: false, error: "Chain not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Check permissions
    const isCreator = chain.createdBy === BigInt(userIdStr);
    const canEdit = isCreator || chain.isEditable;

    if (!canEdit) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to edit this chain" },
        { status: 403, ...NO_STORE }
      );
    }

    // Verify both nodes exist and belong to this chain
    const [sourceNode, targetNode] = await Promise.all([
      prisma.argumentChainNode.findUnique({
        where: { id: validatedData.sourceNodeId },
      }),
      prisma.argumentChainNode.findUnique({
        where: { id: validatedData.targetNodeId },
      }),
    ]);

    if (!sourceNode || !targetNode) {
      return NextResponse.json(
        { ok: false, error: "Node not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (sourceNode.chainId !== chainId || targetNode.chainId !== chainId) {
      return NextResponse.json(
        { ok: false, error: "Both nodes must belong to this chain" },
        { status: 400, ...NO_STORE }
      );
    }

    // Prevent self-loops
    if (validatedData.sourceNodeId === validatedData.targetNodeId) {
      return NextResponse.json(
        { ok: false, error: "Cannot create edge from node to itself" },
        { status: 400, ...NO_STORE }
      );
    }

    // Check if edge already exists
    const existingEdge = await prisma.argumentChainEdge.findUnique({
      where: {
        chainId_sourceNodeId_targetNodeId: {
          chainId,
          sourceNodeId: validatedData.sourceNodeId,
          targetNodeId: validatedData.targetNodeId,
        },
      },
    });

    if (existingEdge) {
      return NextResponse.json(
        { ok: false, error: "Edge already exists between these nodes" },
        { status: 400, ...NO_STORE }
      );
    }

    // Create edge
    const edge = await prisma.argumentChainEdge.create({
      data: {
        chainId,
        sourceNodeId: validatedData.sourceNodeId,
        targetNodeId: validatedData.targetNodeId,
        edgeType: validatedData.edgeType,
        strength: validatedData.strength,
        description: validatedData.description,
        slotMapping: validatedData.slotMapping,
      },
      include: {
        sourceNode: {
          include: {
            argument: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
        targetNode: {
          include: {
            argument: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
      },
    });

    // Serialize BigInt fields
    const serializedEdge = {
      ...edge,
      sourceNode: {
        ...edge.sourceNode,
        addedBy: edge.sourceNode.addedBy.toString(),
      },
      targetNode: {
        ...edge.targetNode,
        addedBy: edge.targetNode.addedBy.toString(),
      },
    };

    return NextResponse.json({ ok: true, edge: serializedEdge }, { status: 201, ...NO_STORE });
  } catch (error) {
    console.error("[POST /api/argument-chains/[chainId]/edges] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request data", details: error.errors },
        { status: 400, ...NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Failed to create edge" },
      { status: 500, ...NO_STORE }
    );
  }
}
