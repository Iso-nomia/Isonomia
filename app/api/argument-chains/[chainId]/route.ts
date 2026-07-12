export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { CHAIN_PAGE_INCLUDE } from "@/lib/chains/chainInclude";
import { serializeChain } from "@/lib/chains/serializeChain";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    // Resolve the viewer optionally: public chains are readable by anyone,
    // so we do not short-circuit to 401 before loading the chain.
    const user = await getUserFromCookies();

    const { chainId } = params;

    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
      include: CHAIN_PAGE_INCLUDE,
    });

    if (!chain) {
      return NextResponse.json(
        { ok: false, error: "Chain not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Check permissions. Public chains are readable by anyone (including
    // anonymous visitors). Private chains: anonymous → 404 (don't leak
    // existence); authed non-creator → 403.
    const isCreator =
      !!user?.userId && chain.createdBy === BigInt(user.userId);
    const canView = isCreator || chain.isPublic;

    if (!canView) {
      if (!user?.userId) {
        return NextResponse.json(
          { ok: false, error: "Chain not found" },
          { status: 404, ...NO_STORE }
        );
      }
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, ...NO_STORE }
      );
    }

    // Serialize BigInt fields for JSON
    const serializedChain = serializeChain(chain);

    return NextResponse.json({ ok: true, chain: serializedChain }, NO_STORE);
  } catch (error) {
    console.error("[GET /api/argument-chains/[chainId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch argument chain" },
      { status: 500, ...NO_STORE }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { chainId: string } }
) {
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

    // Fetch existing chain
    const existingChain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
    });

    if (!existingChain) {
      return NextResponse.json(
        { ok: false, error: "Chain not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Check if user is creator
    if (existingChain.createdBy !== BigInt(user.userId)) {
      return NextResponse.json(
        { ok: false, error: "Only the creator can edit this chain" },
        { status: 403, ...NO_STORE }
      );
    }

    // Update chain (only allow updating specific fields)
    const updatedChain = await prisma.argumentChain.update({
      where: { id: chainId },
      data: {
        name: body.name,
        description: body.description,
        purpose: body.purpose,
        chainType: body.chainType,
        isPublic: body.isPublic,
        isEditable: body.isEditable,
        rootNodeId: body.rootNodeId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Serialize BigInt for JSON
    const serializedChain = {
      ...updatedChain,
      createdBy: updatedChain.createdBy.toString(),
      creator: {
        ...updatedChain.creator,
        id: updatedChain.creator.id.toString(),
      },
    };

    return NextResponse.json({ ok: true, chain: serializedChain }, NO_STORE);
  } catch (error) {
    console.error("[PATCH /api/argument-chains/[chainId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update argument chain" },
      { status: 500, ...NO_STORE }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { chainId: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { chainId } = params;

    const existingChain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
    });

    if (!existingChain) {
      return NextResponse.json(
        { ok: false, error: "Chain not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Check if user is creator
    if (existingChain.createdBy !== BigInt(user.userId)) {
      return NextResponse.json(
        { ok: false, error: "Only the creator can delete this chain" },
        { status: 403, ...NO_STORE }
      );
    }

    // Delete chain (cascade deletes nodes and edges)
    await prisma.argumentChain.delete({
      where: { id: chainId },
    });

    return NextResponse.json({ ok: true }, { status: 200, ...NO_STORE });
  } catch (error) {
    console.error("[DELETE /api/argument-chains/[chainId]] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete argument chain" },
      { status: 500, ...NO_STORE }
    );
  }
}
