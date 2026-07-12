export const dynamic = "force-dynamic";

// app/api/arguments/[id]/cqs-with-provenance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

type CQWithProvenance = {
  cqKey: string;
  text: string;
  attackType: string;
  targetScope: string;
  status: string;
  inherited: boolean;
  sourceSchemeId?: string;
  sourceSchemeName?: string;
  sourceSchemeKey?: string;
  inheritancePath?: Array<{ id: string; name: string; key: string }>;
};

/**
 * GET /api/arguments/[id]/cqs-with-provenance
 * Returns CQs with inheritance provenance information
 * 
 * Response includes:
 * - ownCQs: CQs directly from the argument's scheme
 * - inheritedCQs: CQs inherited from parent schemes
 * - totalCount: Total CQs (own + inherited)
 * - inheritancePaths: Full chain for multi-level inheritance
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;

    // Get argument with scheme information
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      include: {
        argumentSchemes: {
          include: {
            scheme: {
              select: {
                id: true,
                key: true,
                name: true,
                cqs: {
                  select: {
                    cqKey: true,
                    text: true,
                    attackType: true,
                    targetScope: true,
                  },
                },
                parentSchemeId: true,
              },
            },
          },
        },
      },
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404 }
      );
    }

    // Get the primary scheme (or first scheme if no primary)
    const schemeInstance = argument.argumentSchemes.find((s: any) => s.isPrimary) || argument.argumentSchemes[0];
    
    if (!schemeInstance) {
      return NextResponse.json({
        argumentId,
        ownCQs: [],
        inheritedCQs: [],
        totalCount: 0,
        ownCount: 0,
        inheritedCount: 0,
      });
    }

    const scheme = schemeInstance.scheme as any;
    const ownCQs: CQWithProvenance[] = (scheme.cqs || []).map((cq: any) => ({
      cqKey: cq.cqKey,
      text: cq.text,
      attackType: cq.attackType || cq.attackKind || "UNDERCUTS",
      targetScope: cq.targetScope || "inference",
      status: "open",
      inherited: false,
    }));

    const inheritedCQs: CQWithProvenance[] = [];
    const inheritancePath: Array<{ id: string; name: string; key: string }> = [];

    // Traverse parent chain to collect inherited CQs (Phase 3 step 13:
    // inheritance is now unconditional whenever a parent edge exists).
    if (scheme.parentSchemeId) {
      let currentParentId = scheme.parentSchemeId;
      const visited = new Set<string>([scheme.id]);

      while (currentParentId && !visited.has(currentParentId)) {
        visited.add(currentParentId);

        const parentScheme = await prisma.argumentScheme.findUnique({
          where: { id: currentParentId },
          select: {
            id: true,
            key: true,
            name: true,
            cqs: {
              select: {
                cqKey: true,
                text: true,
                attackType: true,
                targetScope: true,
              },
            },
            parentSchemeId: true,
          },
        });

        if (!parentScheme) break;

        inheritancePath.push({
          id: parentScheme.id,
          name: parentScheme.name || parentScheme.key,
          key: parentScheme.key,
        });

        // Add parent's CQs as inherited
        const parentCQs = (parentScheme.cqs || []).map((cq: any) => ({
          cqKey: cq.cqKey,
          text: cq.text,
          attackType: cq.attackType || cq.attackKind || "UNDERCUTS",
          targetScope: cq.targetScope || "inference",
          status: "open",
          inherited: true,
          sourceSchemeId: parentScheme.id,
          sourceSchemeName: parentScheme.name || parentScheme.key,
          sourceSchemeKey: parentScheme.key,
        }));

        inheritedCQs.push(...parentCQs);

        // Continue up the chain if parent has its own parent
        if (parentScheme.parentSchemeId) {
          currentParentId = parentScheme.parentSchemeId;
        } else {
          break;
        }
      }
    }

    const allCQs = [...ownCQs, ...inheritedCQs];

    return NextResponse.json({
      argumentId,
      schemeName: scheme.name,
      schemeKey: scheme.key,
      ownCQs,
      inheritedCQs,
      allCQs,
      totalCount: allCQs.length,
      ownCount: ownCQs.length,
      inheritedCount: inheritedCQs.length,
      inheritancePath,
    });
  } catch (error) {
    console.error(`[GET /api/arguments/${params.id}/cqs-with-provenance] Error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch CQs with provenance" },
      { status: 500 }
    );
  }
}
