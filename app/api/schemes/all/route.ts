export const dynamic = "force-dynamic";

// app/api/schemes/all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/schemes/all
 * Returns all argument schemes in a simplified format
 * Used by the Dichotomic Tree Wizard and other navigation components
 */
export async function GET(_: NextRequest) {
  try {
    const schemes = await prisma.argumentScheme.findMany({
      // Q-018 Phase 0: exclude dialogue-meta entries from the catalogue listing.
      where: { kind: "argument-scheme" } as any,
      orderBy: { name: "asc" },
    });

    // Transform cq field to cqs for compatibility
    const transformedSchemes = schemes.map(scheme => ({
      id: scheme.id,
      key: scheme.key,
      name: scheme.name,
      summary: scheme.summary,
      description: scheme.description,
      purpose: scheme.purpose,
      source: scheme.source,
      materialRelation: scheme.materialRelation,
      reasoningType: scheme.reasoningType,
      premises: scheme.premises,
      conclusion: scheme.conclusion,
      cqs: Array.isArray(scheme.cq) ? scheme.cq : [],
      criticalQuestions: Array.isArray(scheme.cq) ? scheme.cq : [],
      // Phase 0.3 fields (if they exist)
      tags: (scheme as any).tags || [],
      examples: (scheme as any).examples || [],
      difficulty: (scheme as any).difficulty || "intermediate",
      // Phase 0.5 fields (if they exist)
      identificationConditions: (scheme as any).identificationConditions || [],
      whenToUse: (scheme as any).whenToUse || "",
    }));

    return NextResponse.json(transformedSchemes, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[GET /api/schemes/all] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schemes" },
      { status: 500 }
    );
  }
}
