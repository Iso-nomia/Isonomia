export const dynamic = "force-dynamic";

/**
 * Scheme Instance Management API
 * PATCH /api/arguments/[id]/schemes/[instanceId] - Update scheme instance
 * DELETE /api/arguments/[id]/schemes/[instanceId] - Remove scheme instance
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import {
  updateSchemeInstance,
  removeSchemeFromArgument,
} from "@/lib/db/argument-net-queries";
import { prisma } from "@/lib/prismaclient";
import { isDeliberationParticipant } from "@/lib/cqs/permissions";
import { z } from "zod";

const UpdateSchemeSchema = z.object({
  role: z.enum(["primary", "supporting", "presupposed", "implicit"]).optional(),
  explicitness: z.enum(["explicit", "presupposed", "implied"]).optional(),
  order: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
  textEvidence: z.string().optional(),
  justification: z.string().optional(),
});

/**
 * PATCH - Update scheme instance properties
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; instanceId: string } }
) {
  try {
    const userId = await getCurrentUserId().catch(() => null);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: argumentId, instanceId } = params;

    // Verify scheme instance exists and get argument info
    const instance = await prisma.argumentSchemeInstance.findUnique({
      where: { id: instanceId },
      include: {
        argument: {
          select: {
            id: true,
            authorId: true,
            deliberationId: true,
          },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Scheme instance not found" },
        { status: 404 }
      );
    }

    // Verify instance belongs to this argument
    if (instance.argumentId !== argumentId) {
      return NextResponse.json(
        { error: "Instance does not belong to this argument" },
        { status: 400 }
      );
    }

    // Authorization check
    if (instance.argument.authorId !== userId.toString()) {
      // Check deliberation membership
      const membership = await isDeliberationParticipant(
        userId.toString(),
        instance.argument.deliberationId
      );

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Not authorized to modify this argument" },
          { status: 403 }
        );
      }
    }

    // Parse update data
    const body = await req.json();
    const parsed = UpdateSchemeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validation: If changing to primary role, check for existing primary
    if (parsed.data.role === "primary" && instance.role !== "primary") {
      const existingPrimary = await prisma.argumentSchemeInstance.findFirst({
        where: {
          argumentId,
          role: "primary",
          id: { not: instanceId },
        },
      });

      if (existingPrimary) {
        return NextResponse.json(
          {
            error: "Argument already has a primary scheme",
            suggestion:
              "Change the existing primary scheme's role before promoting this one",
            existingPrimaryId: existingPrimary.id,
          },
          { status: 409 }
        );
      }
    }

    // Update instance
    const updated = await updateSchemeInstance(instanceId, parsed.data);

    return NextResponse.json(
      {
        ok: true,
        instance: updated,
        message: "Scheme instance updated successfully",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("Error updating scheme instance:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove scheme instance from argument
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; instanceId: string } }
) {
  try {
    const userId = await getCurrentUserId().catch(() => null);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: argumentId, instanceId } = params;

    // Verify scheme instance exists and get argument info
    const instance = await prisma.argumentSchemeInstance.findUnique({
      where: { id: instanceId },
      include: {
        argument: {
          select: {
            id: true,
            authorId: true,
            deliberationId: true,
          },
        },
        scheme: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Scheme instance not found" },
        { status: 404 }
      );
    }

    // Verify instance belongs to this argument
    if (instance.argumentId !== argumentId) {
      return NextResponse.json(
        { error: "Instance does not belong to this argument" },
        { status: 400 }
      );
    }

    // Authorization check
    if (instance.argument.authorId !== userId.toString()) {
      // Check deliberation membership
      const membership = await isDeliberationParticipant(
        userId.toString(),
        instance.argument.deliberationId
      );

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Not authorized to modify this argument" },
          { status: 403 }
        );
      }
    }

    // Warning: Don't allow removal of last scheme if it's primary
    if (instance.role === "primary" || instance.isPrimary) {
      const schemeCount = await prisma.argumentSchemeInstance.count({
        where: { argumentId },
      });

      if (schemeCount === 1) {
        return NextResponse.json(
          {
            error: "Cannot remove the only scheme from an argument",
            suggestion: "Add another scheme before removing this one",
          },
          { status: 409 }
        );
      }
    }

    // Remove instance
    await removeSchemeFromArgument(instanceId);

    return NextResponse.json(
      {
        ok: true,
        message: `${instance.scheme.name || "Scheme"} removed from argument`,
        removedInstanceId: instanceId,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("Error removing scheme instance:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
