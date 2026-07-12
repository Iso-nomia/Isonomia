export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const updateEdgeSchema = z.object({
  edgeType: z
    .enum([
      "SUPPORTS",
      "ENABLES",
      "PRESUPPOSES",
      "REFUTES",
      "QUALIFIES",
      "EXEMPLIFIES",
      "GENERALIZES",
    ])
    .optional(),
  strength: z.number().min(0).max(1).optional(),
  description: z.string().optional(),
  slotMapping: z.record(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { chainId: string; edgeId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId, edgeId } = params;
    const body = await req.json();
    const validatedData = updateEdgeSchema.parse(body);

    // Fetch edge with chain
    const edge = await prisma.argumentChainEdge.findUnique({
      where: { id: edgeId },
      include: {
        chain: true,
      },
    });

    if (!edge) {
      return NextResponse.json(
        { ok: false, error: "Edge not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (edge.chainId !== chainId) {
      return NextResponse.json(
        { ok: false, error: "Edge not in this chain" },
        { status: 400, ...NO_STORE }
      );
    }

    // Check permissions
    const isCreator = edge.chain.createdBy === BigInt(user.userId);
    const canEdit = isCreator || edge.chain.isEditable;

    if (!canEdit) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to update this edge" },
        { status: 403, ...NO_STORE }
      );
    }

    // Update edge
    const updatedEdge = await prisma.argumentChainEdge.update({
      where: { id: edgeId },
      data: validatedData,
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

    return NextResponse.json({ ok: true, edge: updatedEdge }, NO_STORE);
  } catch (error) {
    console.error(
      "[PATCH /api/argument-chains/[chainId]/edges/[edgeId]] Error:",
      error
    );
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request data", details: error.errors },
        { status: 400, ...NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Failed to update edge" },
      { status: 500, ...NO_STORE }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { chainId: string; edgeId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId, edgeId } = params;

    // Fetch edge with chain
    const edge = await prisma.argumentChainEdge.findUnique({
      where: { id: edgeId },
      include: {
        chain: true,
      },
    });

    if (!edge) {
      return NextResponse.json(
        { ok: false, error: "Edge not found" },
        { status: 404, ...NO_STORE }
      );
    }

    if (edge.chainId !== chainId) {
      return NextResponse.json(
        { ok: false, error: "Edge not in this chain" },
        { status: 400, ...NO_STORE }
      );
    }

    // Check permissions
    const isCreator = edge.chain.createdBy === BigInt(user.userId);
    const canEdit = isCreator || edge.chain.isEditable;

    if (!canEdit) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to delete this edge" },
        { status: 403, ...NO_STORE }
      );
    }

    // Delete edge
    await prisma.argumentChainEdge.delete({
      where: { id: edgeId },
    });

    return NextResponse.json({ ok: true }, { status: 200, ...NO_STORE });
  } catch (error) {
    console.error(
      "[DELETE /api/argument-chains/[chainId]/edges/[edgeId]] Error:",
      error
    );
    return NextResponse.json(
      { ok: false, error: "Failed to delete edge" },
      { status: 500, ...NO_STORE }
    );
  }
}
