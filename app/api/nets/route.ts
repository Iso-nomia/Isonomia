export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { z } from "zod";

// Validation schema
const CreateNetSchema = z.object({
  argumentId: z.string(),
  description: z.string().optional(),
  overallConfidence: z.number().min(0).max(1).default(1.0),
});

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();
    const validatedData = CreateNetSchema.parse(body);
    const { argumentId, description, overallConfidence } = validatedData;

    // Check if argument exists and user is the author
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { id: true, authorId: true },
    });

    if (!argument) {
      return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    }

    if (String(argument.authorId) !== String(userId)) {
      return NextResponse.json(
        { error: "Only the argument author can create nets" },
        { status: 403 }
      );
    }

    // Check if SchemeNet already exists for this argument
    const existingNet = await prisma.schemeNet.findUnique({
      where: { argumentId },
    });

    if (existingNet) {
      // Update existing net instead of blocking
      const updatedNet = await prisma.schemeNet.update({
        where: { id: existingNet.id },
        data: {
          description: description || existingNet.description,
          overallConfidence,
        },
      });

      console.log("[POST /api/nets] Updated existing SchemeNet:", updatedNet.id);

      return NextResponse.json({
        id: updatedNet.id,
        argumentId: updatedNet.argumentId,
        description: updatedNet.description,
        overallConfidence: updatedNet.overallConfidence,
        createdAt: updatedNet.createdAt,
        existingNet: true, // Flag to indicate this was an update
      });
    }

    // Create SchemeNet record
    const schemeNet = await prisma.schemeNet.create({
      data: {
        argumentId,
        description: description || null,
        overallConfidence,
      },
    });

    console.log("[POST /api/nets] Created SchemeNet:", schemeNet.id);

    return NextResponse.json({
      id: schemeNet.id,
      argumentId: schemeNet.argumentId,
      description: schemeNet.description,
      overallConfidence: schemeNet.overallConfidence,
      createdAt: schemeNet.createdAt,
    });
  } catch (error) {
    console.error("[POST /api/nets] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create net" }, { status: 500 });
  }
}

/**
 * DELETE /api/nets/[id]
 * Delete a SchemeNet and its steps
 * Authorization: Only net owner can delete
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const netId = searchParams.get("id");

    if (!netId) {
      return NextResponse.json({ error: "Net ID required" }, { status: 400 });
    }

    // Authentication
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if net exists and user is author
    const net = await prisma.schemeNet.findUnique({
      where: { id: netId },
      include: {
        argument: {
          select: { authorId: true },
        },
      },
    });

    if (!net) {
      return NextResponse.json({ error: "Net not found" }, { status: 404 });
    }

    if (String(net.argument.authorId) !== String(userId)) {
      return NextResponse.json(
        { error: "Only the net owner can delete" },
        { status: 403 }
      );
    }

    // Delete net (steps will cascade delete due to schema)
    await prisma.schemeNet.delete({
      where: { id: netId },
    });

    console.log("[DELETE /api/nets] Deleted net:", netId);

    return NextResponse.json({ success: true, deletedId: netId });
  } catch (error) {
    console.error("[DELETE /api/nets] Error:", error);
    return NextResponse.json({ error: "Failed to delete net" }, { status: 500 });
  }
}
