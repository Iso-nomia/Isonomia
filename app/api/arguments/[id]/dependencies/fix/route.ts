export const dynamic = "force-dynamic";

// app/api/arguments/[id]/dependencies/fix/route.ts
// One-time migration endpoint to fix dependencies that were saved with instance IDs instead of scheme IDs
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export async function POST(
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
      select: { 
        authorId: true,
        argumentSchemes: {
          include: {
            scheme: true
          }
        },
        schemeNet: true
      },
    });

    if (!argument) {
      return NextResponse.json({ error: "Argument not found" }, { status: 404 });
    }

    if (argument.authorId !== String(userId)) {
      return NextResponse.json(
        { error: "Forbidden: Only argument author can fix dependencies" },
        { status: 403 }
      );
    }

    // Check if SchemeNet exists with dependencies
    if (!argument.schemeNet?.description) {
      return NextResponse.json(
        { message: "No dependencies to fix", fixed: 0 },
        { status: 200 }
      );
    }

    let dependencies: Array<{
      from: string;
      to: string;
      type: string;
      explanation?: string;
    }> = [];

    try {
      const parsed = JSON.parse(argument.schemeNet.description);
      dependencies = parsed.dependencies || [];
    } catch {
      return NextResponse.json(
        { message: "No valid dependencies found", fixed: 0 },
        { status: 200 }
      );
    }

    if (dependencies.length === 0) {
      return NextResponse.json(
        { message: "No dependencies to fix", fixed: 0 },
        { status: 200 }
      );
    }

    // Create a mapping from instance ID to scheme ID
    const instanceToSchemeMap = new Map<string, string>();
    argument.argumentSchemes.forEach((instance) => {
      instanceToSchemeMap.set(instance.id, instance.schemeId);
    });

    // Fix dependencies
    let fixedCount = 0;
    const fixedDependencies = dependencies.map((dep) => {
      let needsFix = false;
      let newFrom = dep.from;
      let newTo = dep.to;

      // Check if 'from' is an instance ID that needs conversion
      if (instanceToSchemeMap.has(dep.from)) {
        newFrom = instanceToSchemeMap.get(dep.from)!;
        needsFix = true;
      }

      // Check if 'to' is an instance ID that needs conversion
      if (instanceToSchemeMap.has(dep.to)) {
        newTo = instanceToSchemeMap.get(dep.to)!;
        needsFix = true;
      }

      if (needsFix) {
        fixedCount++;
        console.log(`[Fix Dependencies] Converted: ${dep.from} → ${newFrom}, ${dep.to} → ${newTo}`);
      }

      return {
        ...dep,
        from: newFrom,
        to: newTo,
      };
    });

    if (fixedCount === 0) {
      return NextResponse.json(
        { message: "Dependencies already use correct IDs", fixed: 0 },
        { status: 200 }
      );
    }

    // Update SchemeNet with fixed dependencies
    await prisma.schemeNet.update({
      where: { id: argument.schemeNet.id },
      data: {
        description: JSON.stringify({ dependencies: fixedDependencies }),
        updatedAt: new Date(),
      },
    });

    console.log(`[Fix Dependencies] Fixed ${fixedCount} dependencies for argument ${argumentId}`);

    return NextResponse.json(
      {
        message: `Successfully fixed ${fixedCount} dependencies`,
        fixed: fixedCount,
        dependencies: fixedDependencies,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/arguments/[id]/dependencies/fix] Error:", error);
    return NextResponse.json(
      { error: "Failed to fix dependencies" },
      { status: 500 }
    );
  }
}
