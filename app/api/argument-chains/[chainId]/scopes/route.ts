export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

// GET: List all scopes for a chain
export async function GET(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  const { chainId } = params;

  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify chain exists and user has access
    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
      select: { id: true, deliberationId: true, isPublic: true, createdBy: true },
    });

    if (!chain) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404 });
    }

    // Get all scopes for this chain with node counts
    const scopes = await prisma.argumentScope.findMany({
      where: { chainId },
      include: {
        nodes: {
          select: {
            id: true,
            argumentId: true,
          },
        },
        parentScope: {
          select: {
            id: true,
            scopeType: true,
            assumption: true,
          },
        },
        childScopes: {
          select: {
            id: true,
            scopeType: true,
            assumption: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Transform BigInt for JSON serialization
    const transformedScopes = scopes.map((scope) => ({
      id: scope.id,
      chainId: scope.chainId,
      scopeType: scope.scopeType,
      assumption: scope.assumption,
      description: scope.description,
      color: scope.color,
      depth: scope.depth,
      parentScopeId: scope.parentScopeId,
      createdBy: scope.createdBy?.toString() || null,
      createdAt: scope.createdAt,
      parentScope: scope.parentScope,
      childScopes: scope.childScopes,
      creator: scope.creator ? {
        id: scope.creator.id.toString(),
        name: scope.creator.name,
        image: scope.creator.image,
      } : null,
      nodeCount: scope.nodes.length,
      nodes: scope.nodes.map((n) => ({
        id: n.id,
        argumentId: n.argumentId,
      })),
    }));

    return NextResponse.json(transformedScopes);
  } catch (error) {
    console.error("Error fetching scopes:", error);
    return NextResponse.json(
      { error: "Failed to fetch scopes" },
      { status: 500 }
    );
  }
}

// Schema for creating a new scope
const createScopeSchema = z.object({
  scopeType: z.enum([
    "HYPOTHETICAL",
    "COUNTERFACTUAL",
    "CONDITIONAL",
    "OPPONENT",
    "MODAL",
  ]),
  assumption: z.string().min(1, "Assumption is required"),
  color: z.string().optional(),
  parentScopeId: z.string().optional(),
});

// POST: Create a new scope
export async function POST(
  request: NextRequest,
  { params }: { params: { chainId: string } }
) {
  const { chainId } = params;

  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify chain exists
    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
      select: { id: true, deliberationId: true },
    });

    if (!chain) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404 });
    }

    if (!user.userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createScopeSchema.parse(body);

    // If parentScopeId provided, verify it exists and belongs to this chain
    if (validatedData.parentScopeId) {
      const parentScope = await prisma.argumentScope.findFirst({
        where: {
          id: validatedData.parentScopeId,
          chainId,
        },
      });

      if (!parentScope) {
        return NextResponse.json(
          { error: "Parent scope not found" },
          { status: 404 }
        );
      }
    }

    // Default colors based on scope type
    const defaultColors: Record<string, string> = {
      HYPOTHETICAL: "#3b82f6", // blue
      COUNTERFACTUAL: "#f59e0b", // amber
      CONDITIONAL: "#10b981", // emerald
      OPPONENT: "#ef4444", // red
      MODAL: "#8b5cf6", // violet
    };

    const scope = await prisma.argumentScope.create({
      data: {
        chainId,
        scopeType: validatedData.scopeType,
        assumption: validatedData.assumption,
        color: validatedData.color || defaultColors[validatedData.scopeType],
        parentScopeId: validatedData.parentScopeId || null,
        createdBy: BigInt(user.userId),
      },
      include: {
        parentScope: {
          select: {
            id: true,
            scopeType: true,
            assumption: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Transform BigInt
    const transformedScope = {
      id: scope.id,
      chainId: scope.chainId,
      scopeType: scope.scopeType,
      assumption: scope.assumption,
      description: scope.description,
      color: scope.color,
      depth: scope.depth,
      parentScopeId: scope.parentScopeId,
      createdBy: scope.createdBy?.toString() || null,
      createdAt: scope.createdAt,
      parentScope: scope.parentScope,
      creator: scope.creator ? {
        id: scope.creator.id.toString(),
        name: scope.creator.name,
        image: scope.creator.image,
      } : null,
      nodeCount: 0,
      nodes: [],
    };

    return NextResponse.json(transformedScope, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating scope:", error);
    return NextResponse.json(
      { error: "Failed to create scope" },
      { status: 500 }
    );
  }
}
