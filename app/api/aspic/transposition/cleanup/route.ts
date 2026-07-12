export const dynamic = "force-dynamic";

// app/api/aspic/transposition/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * POST /api/aspic/transposition/cleanup
 * 
 * Clean up duplicate transposed arguments from a deliberation.
 * This removes Arguments whose text contains "Transposed from argument" 
 * that are duplicates based on their premise/conclusion structure.
 * 
 * Request body:
 * {
 *   deliberationId: string,
 *   dryRun?: boolean // If true, only report what would be deleted
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { deliberationId, dryRun = true } = await req.json();

    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing deliberationId in request body" },
        { status: 400 }
      );
    }

    console.log(`[Transposition Cleanup] Processing deliberation: ${deliberationId} (dryRun: ${dryRun})`);

    // Step 1: Fetch all transposed arguments with premises and conclusion
    const transposedArgs = await prisma.argument.findMany({
      where: {
        deliberationId,
        text: { contains: "Transposed from argument" },
      },
      include: {
        conclusion: true,
        premises: {
          include: { claim: true },
        },
      },
    });

    console.log(`[Transposition Cleanup] Found ${transposedArgs.length} transposed arguments`);

    if (transposedArgs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No transposed arguments found",
        duplicatesFound: 0,
        deleted: 0,
      });
    }

    // Step 2: Group by signature (sorted premises + conclusion)
    const bySignature = new Map<string, typeof transposedArgs>();
    
    for (const arg of transposedArgs) {
      const premiseTexts = arg.premises
        .map((p: { claim: { text: string } | null }) => p.claim?.text || "")
        .filter(Boolean)
        .sort();
      const conclusionText = arg.conclusion?.text || "";
      const signature = `${premiseTexts.join("|||")}==>${conclusionText}`;
      
      if (!bySignature.has(signature)) {
        bySignature.set(signature, []);
      }
      bySignature.get(signature)!.push(arg);
    }

    // Step 3: Identify duplicates (keep oldest, delete newer ones)
    const toDelete: string[] = [];
    const keptCount = bySignature.size;

    for (const [signature, args] of bySignature) {
      if (args.length > 1) {
        // Sort by creation time (oldest first)
        args.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        // Keep first (oldest), mark rest for deletion
        for (let i = 1; i < args.length; i++) {
          toDelete.push(args[i].id);
        }
      }
    }

    console.log(`[Transposition Cleanup] Found ${toDelete.length} duplicates to remove (keeping ${keptCount} unique)`);

    // Step 4: Delete if not dry run
    let deletedCount = 0;
    if (!dryRun && toDelete.length > 0) {
      // Delete in order: schemeInstances, premises, then arguments
      await prisma.argumentSchemeInstance.deleteMany({
        where: { argumentId: { in: toDelete } },
      });
      
      await prisma.argumentPremise.deleteMany({
        where: { argumentId: { in: toDelete } },
      });
      
      const deleteResult = await prisma.argument.deleteMany({
        where: { id: { in: toDelete } },
      });
      
      deletedCount = deleteResult.count;
      console.log(`[Transposition Cleanup] Deleted ${deletedCount} duplicate arguments`);
    }

    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `Dry run: would delete ${toDelete.length} duplicate transposed arguments`
        : `Deleted ${deletedCount} duplicate transposed arguments`,
      totalTransposed: transposedArgs.length,
      uniqueSignatures: keptCount,
      duplicatesFound: toDelete.length,
      deleted: deletedCount,
      dryRun,
      // Include IDs of duplicates in dry run for inspection
      ...(dryRun && toDelete.length > 0 ? { duplicateIds: toDelete.slice(0, 20) } : {}),
    });
  } catch (error: any) {
    console.error("[Transposition Cleanup] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to cleanup transposed arguments",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/aspic/transposition/cleanup?deliberationId=xxx
 * 
 * Get statistics about transposed arguments without modifying anything
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");

    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing deliberationId query parameter" },
        { status: 400 }
      );
    }

    // Count transposed arguments
    const transposedCount = await prisma.argument.count({
      where: {
        deliberationId,
        text: { contains: "Transposed from argument" },
      },
    });

    // Count total arguments
    const totalCount = await prisma.argument.count({
      where: { deliberationId },
    });

    // Count strict rule arguments (via schemeInstance ruleType)
    const strictCount = await prisma.argumentSchemeInstance.count({
      where: {
        argument: { deliberationId },
        ruleType: "STRICT",
      },
    });

    return NextResponse.json({
      deliberationId,
      totalArguments: totalCount,
      transposedArguments: transposedCount,
      strictRuleArguments: strictCount,
      defeasibleArguments: totalCount - strictCount,
      transposedPercentage: totalCount > 0 
        ? Math.round((transposedCount / totalCount) * 100) 
        : 0,
    });
  } catch (error: any) {
    console.error("[Transposition Cleanup] Error:", error);
    return NextResponse.json(
      { error: "Failed to get transposition stats", message: error.message },
      { status: 500 }
    );
  }
}
