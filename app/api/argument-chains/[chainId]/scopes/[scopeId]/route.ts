export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";

// GET: Get a specific scope with its nodes
export async function GET(
  request: NextRequest,
  { params }: { params: { chainId: string; scopeId: string } }
) {
  const { chainId, scopeId } = params;

  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = await prisma.argumentScope.findFirst({
      where: {
        id: scopeId,
        chainId,
      },
      include: {
        nodes: {
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
          },
        },
        parentScope: {
          select: {
            id: true,
            scopeType: true,
            assumption: true,
            color: true,
          },
        },
        childScopes: {
          select: {
            id: true,
            scopeType: true,
            assumption: true,
            color: true,
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

    if (!scope) {
      return NextResponse.json({ error: "Scope not found" }, { status: 404 });
    }

    // Transform BigInt
    const transformedScope = {
      ...scope,
      createdBy: scope.createdBy.toString(),
      nodeCount: scope.nodes.length,
    };

    return NextResponse.json(transformedScope);
  } catch (error) {
    console.error("Error fetching scope:", error);
    return NextResponse.json(
      { error: "Failed to fetch scope" },
      { status: 500 }
    );
  }
}

// Schema for updating a scope
const updateScopeSchema = z.object({
  assumption: z.string().min(1).optional(),
  color: z.string().optional(),
  parentScopeId: z.string().nullable().optional(),
});

// PATCH: Update a scope
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chainId: string; scopeId: string } }
) {
  const { chainId, scopeId } = params;

  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify scope exists
    const existingScope = await prisma.argumentScope.findFirst({
      where: {
        id: scopeId,
        chainId,
      },
    });

    if (!existingScope) {
      return NextResponse.json({ error: "Scope not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateScopeSchema.parse(body);

    // If setting parentScopeId, verify it exists and prevent circular references
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

      // Prevent setting self as parent
      if (validatedData.parentScopeId === scopeId) {
        return NextResponse.json(
          { error: "Cannot set scope as its own parent" },
          { status: 400 }
        );
      }

      // Check for circular reference (parent's parent chain)
      let currentParent = parentScope;
      const visited = new Set([scopeId]);

      while (currentParent.parentScopeId) {
        if (visited.has(currentParent.parentScopeId)) {
          return NextResponse.json(
            { error: "Circular parent reference detected" },
            { status: 400 }
          );
        }
        visited.add(currentParent.parentScopeId);

        const nextParent = await prisma.argumentScope.findUnique({
          where: { id: currentParent.parentScopeId },
        });
        if (!nextParent) break;
        currentParent = nextParent;
      }
    }

    const updatedScope = await prisma.argumentScope.update({
      where: { id: scopeId },
      data: {
        ...(validatedData.assumption && { assumption: validatedData.assumption }),
        ...(validatedData.color && { color: validatedData.color }),
        ...(validatedData.parentScopeId !== undefined && {
          parentScopeId: validatedData.parentScopeId,
        }),
      },
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
    });

    // Transform BigInt
    const transformedScope = {
      ...updatedScope,
      createdBy: updatedScope.createdBy.toString(),
      nodeCount: updatedScope.nodes.length,
    };

    return NextResponse.json(transformedScope);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating scope:", error);
    return NextResponse.json(
      { error: "Failed to update scope" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a scope
export async function DELETE(
  request: NextRequest,
  { params }: { params: { chainId: string; scopeId: string } }
) {
  const { chainId, scopeId } = params;

  try {
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify scope exists
    const existingScope = await prisma.argumentScope.findFirst({
      where: {
        id: scopeId,
        chainId,
      },
      include: {
        nodes: true,
        childScopes: true,
      },
    });

    if (!existingScope) {
      return NextResponse.json({ error: "Scope not found" }, { status: 404 });
    }

    // Option 1: Prevent deletion if scope has nodes
    // if (existingScope.nodes.length > 0) {
    //   return NextResponse.json(
    //     { error: "Cannot delete scope with nodes. Remove nodes from scope first." },
    //     { status: 400 }
    //   );
    // }

    // Option 2: Clear scopeId from nodes and reset epistemic status
    // (We'll use this approach for better UX)
    if (existingScope.nodes.length > 0) {
      await prisma.argumentChainNode.updateMany({
        where: { scopeId },
        data: {
          scopeId: null,
          epistemicStatus: "ASSERTED",
        },
      });
    }

    // Handle child scopes - set their parentScopeId to this scope's parent
    if (existingScope.childScopes.length > 0) {
      await prisma.argumentScope.updateMany({
        where: { parentScopeId: scopeId },
        data: { parentScopeId: existingScope.parentScopeId },
      });
    }

    // Delete the scope
    await prisma.argumentScope.delete({
      where: { id: scopeId },
    });

    return NextResponse.json({ success: true, deletedId: scopeId });
  } catch (error) {
    console.error("Error deleting scope:", error);
    return NextResponse.json(
      { error: "Failed to delete scope" },
      { status: 500 }
    );
  }
}
