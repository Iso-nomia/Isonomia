export const dynamic = "force-dynamic";

// app/api/aspic/transposition/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { applyTranspositionClosure } from "@/lib/aspic/transposition";
import { aifToASPIC } from "@/lib/aif/translation/aifToAspic";
import type { AIFGraph } from "@/lib/aif/types";

/**
 * POST /api/aspic/transposition/generate
 * 
 * Automatically generate transposed (contrapositive) rules for all strict rules
 * in a deliberation's ASPIC+ theory.
 * 
 * Request body:
 * {
 *   deliberationId: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   generated: number,
 *   strictRulesCount: number,
 *   message: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { deliberationId } = await req.json();

    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing deliberationId in request body" },
        { status: 400 }
      );
    }

    console.log(`[Transposition Generate] Processing deliberation: ${deliberationId}`);

    // Step 1: Fetch arguments and build AIF graph (same logic as /api/aspic/evaluate)
    const argumentsList = await prisma.argument.findMany({
      where: { deliberationId },
      include: {
        conclusion: true,
        premises: {
          include: {
            claim: true,
          },
        },
        scheme: true,
      },
    });

    // Step 1b: Fetch ArgumentSchemeInstance records for ASPIC+ ruleType
    const schemeInstances = await prisma.argumentSchemeInstance.findMany({
      where: {
        argument: {
          deliberationId,
        },
      },
      include: {
        scheme: true,
      },
    });

    // Build map: argumentId -> schemeInstance
    const schemeInstanceMap = new Map<string, any>();
    for (const instance of schemeInstances) {
      if (instance.isPrimary || !schemeInstanceMap.has(instance.argumentId)) {
        schemeInstanceMap.set(instance.argumentId, instance);
      }
    }

    // Step 1c: Fetch explicit ClaimContrary records
    // Pass these rows directly to aifToASPIC, which expects an array of
    // { claimId, contraryId, isSymmetric, claim:{text}, contrary:{text} }.
    const explicitContrariesList = await prisma.claimContrary.findMany({
      where: {
        deliberationId,
        status: "ACTIVE",
      },
      include: {
        claim: { select: { id: true, text: true } },
        contrary: { select: { id: true, text: true } },
      },
    });

    // Step 2: Build minimal AIF graph for translation
    const aifGraph: AIFGraph = {
      nodes: [],
      edges: [],
    };

    const nodeIds = new Set<string>();

    // Add I-nodes and RA-nodes from arguments
    for (const arg of argumentsList) {
      // RA-node for the argument
      const raNodeId = `RA:${arg.id}`;
      if (!nodeIds.has(raNodeId)) {
        const schemeInstance = schemeInstanceMap.get(arg.id);

        aifGraph.nodes.push({
          id: raNodeId,
          nodeType: "RA",
          content: arg.text || "Argument",
          debateId: deliberationId,
          inferenceType: "modus_ponens",
          schemeId: arg.schemeId || undefined,
          metadata: {
            schemeInstance: schemeInstance
              ? {
                  ruleType: schemeInstance.ruleType,
                  ruleName: schemeInstance.ruleName,
                  confidence: schemeInstance.confidence,
                  isPrimary: schemeInstance.isPrimary,
                }
              : null,
          },
        });
        nodeIds.add(raNodeId);
      }

      // I-node for conclusion
      if (arg.conclusion) {
        const conclusionNodeId = `I:${arg.conclusion.id}`;
        if (!nodeIds.has(conclusionNodeId)) {
          aifGraph.nodes.push({
            id: conclusionNodeId,
            nodeType: "I",
            content: arg.conclusion.text,
            claimText: arg.conclusion.text,
            debateId: deliberationId,
          });
          nodeIds.add(conclusionNodeId);
        }

        // Edge: RA -> conclusion
        aifGraph.edges.push({
          id: `${raNodeId}->${conclusionNodeId}`,
          sourceId: raNodeId,
          targetId: conclusionNodeId,
          edgeType: "conclusion",
          debateId: deliberationId,
        });
      }

      // I-nodes for premises and edges
      for (const premise of arg.premises) {
        if (premise.claim) {
          const premiseNodeId = `I:${premise.claim.id}`;
          if (!nodeIds.has(premiseNodeId)) {
            aifGraph.nodes.push({
              id: premiseNodeId,
              nodeType: "I",
              content: premise.claim.text,
              claimText: premise.claim.text,
              debateId: deliberationId,
              metadata: {
                role: premise.isAxiom ? "axiom" : "premise",
              },
            });
            nodeIds.add(premiseNodeId);
          }

          // Edge: premise -> RA
          aifGraph.edges.push({
            id: `${premiseNodeId}->${raNodeId}`,
            sourceId: premiseNodeId,
            targetId: raNodeId,
            edgeType: "premise",
            debateId: deliberationId,
          });
        }
      }
    }

    // Step 2b: Add assumptions (for K_a)
    const assumptionsList = await prisma.assumptionUse.findMany({
      where: {
        deliberationId,
        status: "ACCEPTED",
      },
    });

    for (const assumption of assumptionsList) {
      let assumptionNodeId: string | null = null;
      let assumptionText: string | null = null;

      if (assumption.assumptionClaimId) {
        assumptionNodeId = `I:${assumption.assumptionClaimId}`;
        
        if (!nodeIds.has(assumptionNodeId)) {
          const claim = await prisma.claim.findUnique({
            where: { id: assumption.assumptionClaimId },
          });
          
          if (claim) {
            assumptionText = claim.text;
            aifGraph.nodes.push({
              id: assumptionNodeId,
              nodeType: "I",
              content: assumptionText,
              claimText: assumptionText,
              debateId: deliberationId,
              metadata: {
                role: "assumption",
                assumptionId: assumption.id,
                weight: assumption.weight,
                confidence: assumption.confidence,
              },
            });
            nodeIds.add(assumptionNodeId);
          }
        }
      } else if (assumption.assumptionText) {
        assumptionNodeId = `I:assumption_${assumption.id}`;
        assumptionText = assumption.assumptionText;
        
        if (!nodeIds.has(assumptionNodeId)) {
          aifGraph.nodes.push({
            id: assumptionNodeId,
            nodeType: "I",
            content: assumptionText,
            claimText: assumptionText,
            debateId: deliberationId,
            metadata: {
              role: "assumption",
              assumptionId: assumption.id,
              weight: assumption.weight,
              confidence: assumption.confidence,
            },
          });
          nodeIds.add(assumptionNodeId);
        }
      }

      // Create presumption edge if used in argument
      if (assumptionNodeId && assumption.argumentId) {
        const argumentNodeId = `RA:${assumption.argumentId}`;
        aifGraph.edges.push({
          id: `${assumptionNodeId}->${argumentNodeId}`,
          sourceId: assumptionNodeId,
          targetId: argumentNodeId,
          edgeType: "presumption",
          debateId: deliberationId,
        });
      }
    }

    // Step 3: Translate to ASPIC+
    const theory = aifToASPIC(aifGraph, explicitContrariesList);

    console.log(`[Transposition Generate] Found ${theory.strictRules.length} strict rules`);

    if (theory.strictRules.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        strictRulesCount: 0,
        message: "No strict rules found - nothing to transpose",
      });
    }

    // Step 4: Apply transposition closure to get all rules (original + transposed)
    // IMPORTANT: Only apply to rules that are NOT already transpositions
    // We identify transpositions by checking if the original argument's text contains "Transposed from"
    const nonTransposedRules = theory.strictRules.filter(rule => {
      // Extract original argument ID from rule ID (format: "RA:argumentId")
      const argId = rule.id.replace(/^RA:/, "");
      const arg = argumentsList.find(a => a.id === argId);
      
      // Skip rules from arguments that were created by transposition
      if (arg?.text?.includes("Transposed from argument")) {
        console.log(`[Transposition Generate] Skipping already-transposed rule: ${rule.id}`);
        return false;
      }
      return true;
    });

    console.log(`[Transposition Generate] Filtered to ${nonTransposedRules.length} non-transposed strict rules (from ${theory.strictRules.length} total)`);

    if (nonTransposedRules.length === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        strictRulesCount: theory.strictRules.length,
        message: "No base (non-transposed) strict rules found - nothing to transpose",
      });
    }

    const originalCount = nonTransposedRules.length;
    const augmentedRules = applyTranspositionClosure(nonTransposedRules);
    const generatedCount = augmentedRules.length - originalCount;

    console.log(`[Transposition Generate] Generated ${generatedCount} transposed rules`);

    if (generatedCount === 0) {
      return NextResponse.json({
        success: true,
        generated: 0,
        strictRulesCount: originalCount,
        message: "All strict rules already closed under transposition",
      });
    }

    // Step 5: Extract only the newly generated transposed rules
    // IMPORTANT: Filter out rules that are already transpositions to avoid nested transpositions
    const transposedRules = augmentedRules.filter(
      (rule) => rule.id.includes("_transpose_") && !rule.id.match(/_transpose_.*_transpose_/)
    );

    console.log(`[Transposition Generate] Persisting ${transposedRules.length} transposed rules to database...`);

    // Step 6: Fetch all claims to match against
    const allClaims = await prisma.claim.findMany({
      where: { deliberationId },
    });

    // Helper to find or create a claim by text
    const findOrCreateClaim = async (text: string, authorId: string) => {
      let claim = allClaims.find(c => c.text === text);
      if (!claim) {
        claim = await prisma.claim.create({
          data: {
            text,    
            deliberationId,
            createdById: authorId,
            moid: `transposed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
        });
        allClaims.push(claim); // Add to cache
        console.log(`[Transposition Generate] Created claim: "${text}"`);
      }
      return claim;
    };

    // Step 7: Create transposed arguments in database
    let persistedCount = 0;
    let skippedDuplicates = 0;

    // Build a set of existing transposed argument signatures to detect duplicates
    const existingSignatures = new Set<string>();
    for (const arg of argumentsList) {
      if (arg.text?.includes("Transposed from argument")) {
        // Build signature from premises + conclusion
        const premiseTexts = arg.premises
          .map(p => p.claim?.text)
          .filter(Boolean)
          .sort()
          .join("|||");
        const conclusionText = arg.conclusion?.text || "";
        const signature = `${premiseTexts}==>${conclusionText}`;
        existingSignatures.add(signature);
      }
    }
    console.log(`[Transposition Generate] Found ${existingSignatures.size} existing transposed argument signatures`);

    for (const transposedRule of transposedRules) {
      // Extract original argument ID from transposed rule ID
      // Format: "RA:argumentId_transpose_0", "RA:argumentId_transpose_1", etc.
      // First remove the transpose suffix, then remove the "RA:" prefix
      let originalArgId = transposedRule.id.replace(/_transpose_\d+$/, "");
      originalArgId = originalArgId.replace(/^RA:/, ""); // Strip RA: prefix
      
      const originalArg = argumentsList.find((a) => a.id === originalArgId);

      if (!originalArg) {
        console.warn(
          `[Transposition Generate] Could not find original argument for ${originalArgId} (from rule ${transposedRule.id})`
        );
        continue;
      }

      // Skip if this argument is itself a transposition (avoid nested transpositions)
      if (originalArg.text?.includes("Transposed from argument")) {
        console.log(
          `[Transposition Generate] Skipping nested transposition for ${originalArgId}`
        );
        continue;
      }

      // Check for duplicate by signature BEFORE creating
      const sortedAntecedents = [...transposedRule.antecedents].sort().join("|||");
      const newSignature = `${sortedAntecedents}==>${transposedRule.consequent}`;
      if (existingSignatures.has(newSignature)) {
        console.log(`[Transposition Generate] Skipping duplicate: ${newSignature.substring(0, 80)}...`);
        skippedDuplicates++;
        continue;
      }

      try {
        // Create claims for transposed antecedents (premises)
        const premiseIds: string[] = [];
        for (const antecedent of transposedRule.antecedents) {
          const claim = await findOrCreateClaim(antecedent, originalArg.authorId);
          premiseIds.push(claim.id);
        }

        // Create claim for transposed consequent (conclusion)
        const conclusionClaim = await findOrCreateClaim(
          transposedRule.consequent,
          originalArg.authorId
        );

        // Create the transposed argument
        const transposedArg = await prisma.argument.create({
          data: {
            deliberationId,
            authorId: originalArg.authorId,
            conclusionClaimId: conclusionClaim.id,
            text: `Transposed from argument ${originalArg.id}: ${transposedRule.antecedents.join(", ")} → ${transposedRule.consequent}`,
          },
        });

        // Create premise relations
        for (let i = 0; i < premiseIds.length; i++) {
          await prisma.argumentPremise.create({
            data: {
              argumentId: transposedArg.id,
              claimId: premiseIds[i],
            },
          });
        }

        // Copy scheme metadata from original argument (if exists)
        const originalScheme = schemeInstanceMap.get(originalArg.id);
        if (originalScheme) {
          await prisma.argumentSchemeInstance.create({
            data: {
              argumentId: transposedArg.id,
              schemeId: originalScheme.schemeId,
              ruleType: "STRICT", // Always STRICT for transposed rules
              ruleName: originalScheme.ruleName 
                ? `${originalScheme.ruleName} (transposed)`
                : `Transposition of ${originalScheme.scheme?.name || "rule"}`,
              confidence: originalScheme.confidence || 1.0,
              isPrimary: true,
            },
          });
        }

        // Add to existing signatures to prevent within-batch duplicates
        existingSignatures.add(newSignature);

        persistedCount++;
        console.log(`[Transposition Generate] Created transposed argument: ${transposedArg.id}`);
      } catch (error: any) {
        console.error(`[Transposition Generate] Error creating transposed argument for ${originalArgId}:`, error.message);
        // Continue with other transpositions
      }
    }

    console.log(`[Transposition Generate] Successfully persisted ${persistedCount}/${transposedRules.length} transposed arguments (skipped ${skippedDuplicates} duplicates)`);

    return NextResponse.json({
      success: true,
      generated: persistedCount,
      skippedDuplicates,
      strictRulesCount: originalCount,
      totalExistingTransposed: existingSignatures.size - persistedCount, // existing before this run
      message: `Successfully generated ${persistedCount} transposed argument(s) from ${originalCount} strict rule(s)${skippedDuplicates > 0 ? ` (skipped ${skippedDuplicates} duplicates)` : ""}`,
    });
  } catch (error: any) {
    console.error("[Transposition Generate] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate transposed rules",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
