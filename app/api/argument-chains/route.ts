export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies, getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

// Validation schema
const createChainSchema = z.object({
  deliberationId: z.string(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  purpose: z.string().optional(),
  chainType: z.enum(["SERIAL", "CONVERGENT", "DIVERGENT", "TREE", "GRAPH"]),
  isPublic: z.boolean().default(false),
  isEditable: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE }
      );
    }

    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");

    if (!deliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400, ...NO_STORE }
      );
    }

    // Fetch chains for this deliberation
    const chains = await prisma.argumentChain.findMany({
      where: {
        deliberationId: deliberationId,
      },
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
      orderBy: {
        updatedAt: "desc",
      },
    });

    // Serialize BigInt fields
    const serializedChains = chains.map((chain: any) => ({
      ...chain,
      createdBy: chain.createdBy.toString(),
      creator: {
        ...chain.creator,
        id: chain.creator.id.toString(),
      },
      createdAt: chain.createdAt.toISOString(),
      updatedAt: chain.updatedAt.toISOString(),
    }));

    return NextResponse.json(
      { ok: true, chains: serializedChains },
      { status: 200, ...NO_STORE }
    );
  } catch (error) {
    console.error("[GET /api/argument-chains] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch argument chains" },
      { status: 500, ...NO_STORE }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const validatedData = createChainSchema.parse(body);

    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: validatedData.deliberationId },
      select: { id: true, title: true },
    });

    if (!deliberation) {
      return NextResponse.json(
        { ok: false, error: "Deliberation not found" },
        { status: 404, ...NO_STORE }
      );
    }

    // Create ArgumentChain
    const chain = await prisma.argumentChain.create({
      data: {
        deliberationId: validatedData.deliberationId,
        name: validatedData.name,
        description: validatedData.description,
        purpose: validatedData.purpose,
        chainType: validatedData.chainType,
        isPublic: validatedData.isPublic,
        isEditable: validatedData.isEditable,
        createdBy: BigInt(userIdStr),
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        deliberation: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Convert BigInt to string for JSON serialization
    const serializedChain = {
      ...chain,
      createdBy: chain.createdBy.toString(),
      creator: {
        ...chain.creator,
        id: chain.creator.id.toString(),
      },
    };

    return NextResponse.json(
      { ok: true, chain: serializedChain },
      { status: 201, ...NO_STORE }
    );
  } catch (error) {
    console.error("[POST /api/argument-chains] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request data", details: error.errors },
        { status: 400, ...NO_STORE }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Failed to create argument chain" },
      { status: 500, ...NO_STORE }
    );
  }
}
