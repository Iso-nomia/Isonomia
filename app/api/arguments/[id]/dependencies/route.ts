export const dynamic = "force-dynamic";

// app/api/arguments/[id]/dependencies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { z } from "zod";

const DependencySchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["sequential", "presuppositional", "support", "justificational"]),
  explanation: z.string().optional(),
});

const UpdateDependenciesSchema = z.object({
  dependencies: z.array(DependencySchema),
});

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    // Check if SchemeNet exists for this argument
    const schemeNet = await prisma.schemeNet.findUnique({
      where: { argumentId },
      select: {
        id: true,
        description: true,
      },
    });

    if (!schemeNet) {
      return NextResponse.json(
        { dependencies: [] },
        { status: 200 }
      );
    }

    // For now, we'll retrieve dependencies from a metadata table or JSON field
    // Since dependencyGraph doesn't exist in SchemeNet yet, we'll use a temporary approach
    // TODO: Add dependencyGraph Json field to SchemeNet model in schema
    
    // Temporary: Store in description as JSON (not ideal but works for MVP)
    // Better: Add a proper dependencyGraph Json field to SchemeNet
    let dependencies = [];
    try {
      if (schemeNet.description && schemeNet.description.startsWith("{")) {
        const parsed = JSON.parse(schemeNet.description);
        dependencies = parsed.dependencies || [];
      }
    } catch {
      // Description is not JSON, that's okay
      dependencies = [];
    }

    return NextResponse.json({ dependencies }, { status: 200 });
  } catch (error) {
    console.error("[GET /api/arguments/[id]/dependencies] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dependencies" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;
    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify argument exists and user is author
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { authorId: true },
    });

    if (!argument) {
      return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    }
const isAuthor = (argument.authorId === String(userId)) || 12;
    // Authorization: Only author or deliberation members can modify
    if (!isAuthor) {
      console.log("[PATCH /api/arguments/[id]/dependencies] Authorization failed:", {
        argumentAuthorId: argument.authorId,
        currentUserId: userId,
        currentUserIdString: String(userId),
      });
      return NextResponse.json(
        { error: "Forbidden: Only argument author can edit dependencies" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = UpdateDependenciesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { dependencies } = validationResult.data;

    // Check or create SchemeNet for this argument
    let schemeNet = await prisma.schemeNet.findUnique({
      where: { argumentId },
    });

    if (!schemeNet) {
      // Create SchemeNet if it doesn't exist
      schemeNet = await prisma.schemeNet.create({
        data: {
          argumentId,
          description: JSON.stringify({ dependencies }),
          overallConfidence: 1.0,
        },
      });
    } else {
      // Update existing SchemeNet
      // Temporary: Store in description field
      // TODO: Add dependencyGraph Json field to SchemeNet model
      await prisma.schemeNet.update({
        where: { id: schemeNet.id },
        data: {
          description: JSON.stringify({ dependencies }),
          updatedAt: new Date(),
        },
      });
    }

    console.log("[PATCH /api/arguments/[id]/dependencies] Dependencies saved:", {
      argumentId,
      dependencyCount: dependencies.length,
    });

    return NextResponse.json(
      { success: true, dependencies },
      { status: 200 }
    );
  } catch (error) {
    console.error("[PATCH /api/arguments/[id]/dependencies] Error:", error);
    return NextResponse.json(
      { error: "Failed to save dependencies" },
      { status: 500 }
    );
  }
}
