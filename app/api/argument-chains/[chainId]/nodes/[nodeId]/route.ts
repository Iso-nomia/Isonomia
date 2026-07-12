export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const updateNodeSchema = z.object({
  role: z
    .enum(["PREMISE", "EVIDENCE", "CONCLUSION", "OBJECTION", "REBUTTAL", "QUALIFIER"])
    .optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  nodeOrder: z.number().optional(),
  // Phase 4: Epistemic status fields
  epistemicStatus: z
    .enum(["ASSERTED", "HYPOTHETICAL", "COUNTERFACTUAL", "CONDITIONAL", "QUESTIONED", "DENIED", "SUSPENDED"])
    .optional(),
  scopeId: z.string().nullable().optional(),
  dialecticalRole: z
    .enum(["THESIS", "ANTITHESIS", "SYNTHESIS", "OBJECTION", "RESPONSE", "CONCESSION"])
    .nullable()
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { chainId: string; nodeId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId, nodeId } = params;
    const body = await req.json();
    const validatedData = updateNodeSchema.parse(body);

    // Fetch node with chain
    const node = await prisma.argumentChainNode.findUnique({
      where: { id: nodeId },
      include: {
        chain: true,
      },
    });

    if (!node) {
      return NextResponse.json(
        { ok: false, error: "Node not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (node.chainId !== chainId) {
      return NextResponse.json(
        { ok: false, error: "Node not in this chain" },
        { status: 400, ...NO_STORE }
      );
    }

    // Check permissions
    const isCreator = node.chain.createdBy === BigInt(user.userId);
    const canEdit = isCreator || node.chain.isEditable;

    if (!canEdit) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to update this node" },
        { status: 403, ...NO_STORE }
      );
    }

    // Update node
    const updatedNode = await prisma.argumentChainNode.update({
      where: { id: nodeId },
      data: validatedData,
      include: {
        argument: {
          select: {
            id: true,
            text: true,
            conclusion: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        },
        scope: {
          select: {
            id: true,
            scopeType: true,
            assumption: true,
            color: true,
          },
        },
      },
    });

    // Serialize BigInt
    const serializedNode = {
      ...updatedNode,
      addedBy: updatedNode.addedBy.toString(),
    };

    return NextResponse.json({ ok: true, node: serializedNode }, NO_STORE);
  } catch (error) {
    console.error(
      "[PATCH /api/argument-chains/[chainId]/nodes/[nodeId]] Error:",
      error
    );
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request data", details: error.errors },
        { status: 400, ...NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Failed to update node" },
      { status: 500, ...NO_STORE }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { chainId: string; nodeId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId, nodeId } = params;

    // Fetch node with chain
    const node = await prisma.argumentChainNode.findUnique({
      where: { id: nodeId },
      include: {
        chain: true,
      },
    });

    if (!node) {
      return NextResponse.json(
        { ok: false, error: "Node not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (node.chainId !== chainId) {
      return NextResponse.json(
        { ok: false, error: "Node not in this chain" },
        { status: 400, ...NO_STORE }
      );
    }

    // Check permissions
    const isCreator = node.chain.createdBy === BigInt(user.userId);
    const isNodeCreator = node.addedBy === BigInt(user.userId);
    const canEdit =
      isCreator || (node.chain.isEditable && isNodeCreator);

    if (!canEdit) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to remove this node" },
        { status: 403, ...NO_STORE }
      );
    }

    // Delete node (cascade deletes connected edges)
    await prisma.argumentChainNode.delete({
      where: { id: nodeId },
    });

    return NextResponse.json({ ok: true }, { status: 200, ...NO_STORE });
  } catch (error) {
    console.error(
      "[DELETE /api/argument-chains/[chainId]/nodes/[nodeId]] Error:",
      error
    );
    return NextResponse.json(
      { ok: false, error: "Failed to remove node from chain" },
      { status: 500, ...NO_STORE }
    );
  }
}
