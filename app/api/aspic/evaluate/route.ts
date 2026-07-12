export const dynamic = "force-dynamic";

// app/api/aspic/evaluate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeAspicSemantics, aifToASPIC } from "@/lib/aif/translation/aifToAspic";
import type { ArgumentationTheory } from "@/lib/aif/translation/aifToAspic";
import { toDefeatGraphFromEdgeList } from "@/lib/argumentation/labelling";
import { computeAcceptability } from "@/lib/argumentation/acceptability";
import { prisma } from "@/lib/prismaclient";
import type { AIFGraph, AnyNode, Edge } from "@/lib/aif/types";
import { getOrSet } from "@/lib/redis";

// Debug logging - set to true to see verbose CA-node creation logs
const DEBUG_ASPIC = process.env.DEBUG_ASPIC === "true";

// Cache TTL for ASPIC evaluations (in seconds)
const ASPIC_CACHE_TTL = 60; // 1 minute

/**
 * POST /api/aspic/evaluate
 * 
 * Evaluate an ASPIC+ argumentation theory to compute:
 * - All constructed arguments
 * - Attack relations (undermining, rebutting, undercutting)
 * - Defeat relations (attacks + preferences)
 * - Grounded extension
 * - Justification status for each argument
 * 
 * Request body:
 * {
 *   language: string[],
 *   contraries: { [key: string]: string[] },
 *   strictRules: Array<{ id, antecedents[], consequent, type: 'strict' }>,
 *   defeasibleRules: Array<{ id, antecedents[], consequent, type: 'defeasible' }>,
 *   axioms: string[],
 *   premises: string[],
 *   assumptions: string[],
 *   preferences: Array<{ preferred: string, dispreferred: string }>
 * }
 * 
 * Response:
 * {
 *   arguments: Argument[],
 *   attacks: Attack[],
 *   defeats: Defeat[],
 *   groundedExtension: string[],
 *   justificationStatus: { [argId: string]: 'in' | 'out' | 'undec' }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.language || !Array.isArray(body.language)) {
      return NextResponse.json(
        { error: "Missing or invalid 'language' field (must be array)" },
        { status: 400 }
      );
    }

    if (!body.strictRules || !Array.isArray(body.strictRules)) {
      return NextResponse.json(
        { error: "Missing or invalid 'strictRules' field (must be array)" },
        { status: 400 }
      );
    }

    if (!body.defeasibleRules || !Array.isArray(body.defeasibleRules)) {
      return NextResponse.json(
        { error: "Missing or invalid 'defeasibleRules' field (must be array)" },
        { status: 400 }
      );
    }

    // Construct ArgumentationTheory from request body
    const theory: ArgumentationTheory = {
      language: new Set(body.language),
      contraries: new Map(
        Object.entries(body.contraries || {}).map(([key, values]) => [
          key,
          new Set(values as string[]),
        ])
      ),
      strictRules: body.strictRules.map((r: any) => ({
        id: r.id,
        antecedents: r.antecedents,
        consequent: r.consequent,
        type: "strict" as const,
      })),
      defeasibleRules: body.defeasibleRules.map((r: any) => ({
        id: r.id,
        antecedents: r.antecedents,
        consequent: r.consequent,
        type: "defeasible" as const,
      })),
      axioms: new Set(body.axioms || []),
      premises: new Set(body.premises || []),
      assumptions: new Set(body.assumptions || []),
      preferences: body.preferences || [],
    };

    // Compute ASPIC+ semantics
    const semantics = computeAspicSemantics(theory);

    // Reading-C item 1 (T015): surface stable/preferred acceptability, opt-in and
    // additive — `groundedExtension` / `justificationStatus` are unchanged.
    const includeAcceptability =
      req.nextUrl.searchParams.get("include") === "acceptability" ||
      body.includeAcceptability === true;
    const acceptability = includeAcceptability
      ? computeAcceptability(
          toDefeatGraphFromEdgeList(
            semantics.arguments.map((a) => a.id),
            semantics.defeats.map((d): [string, string] => [
              d.defeater.id,
              d.defeated.id,
            ])
          )
        )
      : undefined;

    // Serialize response (convert Sets/Maps to arrays/objects)
    const response = {
      arguments: semantics.arguments.map((arg) => ({
        id: arg.id,
        premises: Array.from(arg.premises),
        conclusion: arg.conclusion,
        defeasibleRules: Array.from(arg.defeasibleRules),
        topRule: arg.topRule,
        structure: arg.structure,
      })),
      attacks: semantics.attacks.map((atk) => ({
        attackerId: atk.attacker.id,
        attackedId: atk.attacked.id,
        type: atk.type,
        target: atk.target,
        metadata: atk.metadata,
      })),
      defeats: semantics.defeats.map((def) => ({
        defeaterId: def.defeater.id,
        defeatedId: def.defeated.id,
        attackType: def.attack.type,
        preferenceApplied: def.preferenceApplied,
      })),
      groundedExtension: Array.from(semantics.groundedExtension),
      justificationStatus: Object.fromEntries(semantics.justificationStatus),
      ...(acceptability ? { acceptability } : {}),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error evaluating ASPIC+ theory:", error);
    return NextResponse.json(
      {
        error: "Failed to evaluate ASPIC+ theory",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/aspic/evaluate?deliberationId=xxx
 * 
 * Get ASPIC+ theory and semantics for a deliberation by translating from AIF graph
 * 
 * Query Parameters:
 * - deliberationId (required): ID of the deliberation to evaluate
 * - ordering: 'last-link' | 'weakest-link' (default: 'last-link')
 * - maxDepth: Maximum argument construction depth (default: 5, max: 10)
 * - maxArguments: Maximum arguments to construct (default: 1000, max: 5000)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deliberationId = searchParams.get("deliberationId");
    const ordering = searchParams.get("ordering") || "last-link"; // ASPIC+ Phase 4.2
    
    // Parse construction limits from query params
    const maxDepthParam = searchParams.get("maxDepth");
    const maxArgumentsParam = searchParams.get("maxArguments");
    
    // Validate and clamp construction limits
    const maxDepth = Math.min(
      Math.max(1, parseInt(maxDepthParam || "5", 10) || 5),
      10 // Hard cap at 10 to prevent runaway computation
    );
    const maxArguments = Math.min(
      Math.max(10, parseInt(maxArgumentsParam || "1000", 10) || 1000),
      5000 // Hard cap at 5000
    );

    if (!deliberationId) {
      return NextResponse.json(
        { error: "Missing required query parameter: deliberationId" },
        { status: 400 }
      );
    }

    // Validate ordering parameter
    if (ordering !== "last-link" && ordering !== "weakest-link") {
      return NextResponse.json(
        { error: "Invalid ordering parameter. Must be 'last-link' or 'weakest-link'" },
        { status: 400 }
      );
    }
    
    console.log(`[ASPIC API] Evaluating with maxDepth=${maxDepth}, maxArguments=${maxArguments}`);

    // Check for bypass cache flag
    const bypassCache = searchParams.get("bypassCache") === "true";
    const cacheKey = `aspic:eval:${deliberationId}:${maxDepth}:${maxArguments}:${ordering}`;

    // Try to return cached result if available (unless bypassing)
    if (!bypassCache) {
      try {
        const cached = await getOrSet<null>(cacheKey, 0, async () => null);
        // getOrSet doesn't have a "get only" mode, so we check if we have a real cached value
        // by checking a separate cache key
        const cachedResult = await getCachedAspicResult(cacheKey);
        if (cachedResult) {
          console.log(`[ASPIC API] Returning cached result for ${deliberationId}`);
          return NextResponse.json(cachedResult, {
            status: 200,
            headers: {
              "Cache-Control": "private, max-age=60",
              "X-Cache": "HIT",
            },
          });
        }
      } catch (e) {
        // Cache miss or error, continue with computation
        if (DEBUG_ASPIC) console.log(`[ASPIC API] Cache miss for ${deliberationId}`);
      }
    }

    // Step 1: Fetch all Arguments and their relations for this deliberation
    const argumentsList = await prisma.argument.findMany({
      where: { deliberationId },
      include: {
        conclusion: { select: { id: true, text: true } },
        premises: {
          include: {
            claim: { select: { id: true, text: true } },
          },
        },
        scheme: true,
      },
    });

    // Step 1b: Fetch ConflictApplications (attacks) for this deliberation
    const conflictsList = await prisma.conflictApplication.findMany({
      // Attack-ratification enforcement (DEV_SPEC §4): only EFFECTIVE conflicts
      // enter the defeat computation. Inert until creation-status gating (PR2).
      where: { deliberationId, ratificationStatus: "EFFECTIVE" },
      include: {
        scheme: true,
        createdByMove: true,
      },
    });

    if (DEBUG_ASPIC) console.log(`[ASPIC API] Fetched ${conflictsList.length} ConflictApplications for deliberation ${deliberationId}`);

    // Step 1c-2: Fetch ClaimEdges (from CriticalQuestionsV3) for ASPIC+ integration
    const claimEdgesList = await prisma.claimEdge.findMany({
      where: {
        deliberationId,
        attackType: { in: ["REBUTS", "UNDERCUTS", "UNDERMINES"] }, // Only attack edges
      },
      include: {
        from: true,
        to: true,
      },
    });

    if (DEBUG_ASPIC) console.log(`[ASPIC API] Fetched ${claimEdgesList.length} ClaimEdges (attack edges) for deliberation ${deliberationId}`);

    // Step 1c: Fetch AssumptionUse records (ACCEPTED assumptions for K_a)
    const assumptionsList = await prisma.assumptionUse.findMany({
      where: {
        deliberationId,
        status: "ACCEPTED", // Only accepted assumptions enter knowledge base
      },
    });

    if (DEBUG_ASPIC) console.log(`[ASPIC API] Fetched ${assumptionsList.length} ACCEPTED AssumptionUse records for deliberation ${deliberationId}`);

    // Step 1d: Fetch explicit ClaimContrary records (Phase D-1)
    const explicitContraries = await prisma.claimContrary.findMany({
      where: {
        deliberationId,
        status: "ACTIVE",
      },
      include: {
        claim: { select: { id: true, text: true } },
        contrary: { select: { id: true, text: true } },
      },
    });

    if (DEBUG_ASPIC) console.log(`[ASPIC API] Fetched ${explicitContraries.length} explicit ClaimContrary records for deliberation ${deliberationId}`);

    // Step 1e: Fetch ArgumentSchemeInstance records for ASPIC+ ruleType (Phase 1b.2)
    // @ts-ignore - ArgumentSchemeInstance model exists, TypeScript server needs refresh
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
    
    // Build map: argumentId -> schemeInstance (use primary instance)
    const schemeInstanceMap = new Map<string, any>();
    for (const instance of schemeInstances) {
      if (instance.isPrimary || !schemeInstanceMap.has(instance.argumentId)) {
        schemeInstanceMap.set(instance.argumentId, instance);
      }
    }

    if (DEBUG_ASPIC) console.log(`[ASPIC API] Fetched ${schemeInstances.length} ArgumentSchemeInstance records for deliberation ${deliberationId}`);

    // Step 1f: Pre-fetch all claims that might be needed for CA-nodes (batch optimization)
    // Collect all claim IDs that we might need to look up
    const neededClaimIds = new Set<string>();
    for (const conflict of conflictsList) {
      if (conflict.conflictingClaimId) neededClaimIds.add(conflict.conflictingClaimId);
      if (conflict.conflictedClaimId) neededClaimIds.add(conflict.conflictedClaimId);
    }
    for (const assumption of assumptionsList) {
      if (assumption.assumptionClaimId) neededClaimIds.add(assumption.assumptionClaimId);
    }
    
    // Batch fetch all needed claims in one query
    const claimsBatch = neededClaimIds.size > 0 
      ? await prisma.claim.findMany({
          where: { id: { in: Array.from(neededClaimIds) } },
        })
      : [];
    
    // Build a lookup map for O(1) access
    const claimsMap = new Map(claimsBatch.map(c => [c.id, c]));
    if (DEBUG_ASPIC) console.log(`[ASPIC API] Pre-fetched ${claimsBatch.length} claims for batch lookup`);

    // Step 2: Build AIFGraph from fetched data
    const nodes: AnyNode[] = [];
    const edges: Edge[] = [];
    const nodeIds = new Set<string>();

    // Add I-nodes (claims) and RA-nodes (arguments)
    for (const arg of argumentsList) {
      // RA-node for the argument
      const raNodeId = `RA:${arg.id}`;
      if (!nodeIds.has(raNodeId)) {
        // ASPIC+ Phase 1b.2: Attach scheme instance for ruleType
        const schemeInstance = schemeInstanceMap.get(arg.id);
        
        nodes.push({
          id: raNodeId,
          nodeType: "RA",
          content: arg.text || "Argument",
          debateId: deliberationId,
          inferenceType: "modus_ponens",
          schemeId: arg.schemeId || undefined,
          // ASPIC+ Phase 1b.2: Add scheme instance metadata
          metadata: {
            schemeInstance: schemeInstance ? {
              ruleType: schemeInstance.ruleType,
              ruleName: schemeInstance.ruleName,
              confidence: schemeInstance.confidence,
              isPrimary: schemeInstance.isPrimary,
            } : null,
          },
        });
        nodeIds.add(raNodeId);
      }

      // I-node for conclusion
      if (arg.conclusion) {
        const conclusionNodeId = `I:${arg.conclusion.id}`;
        if (!nodeIds.has(conclusionNodeId)) {
          nodes.push({
            id: conclusionNodeId,
            nodeType: "I",
            content: arg.conclusion.text,
            claimText: arg.conclusion.text,
            debateId: deliberationId,
          });
          nodeIds.add(conclusionNodeId);
        }

        // Edge: RA → I (conclusion)
        edges.push({
          id: `${raNodeId}->${conclusionNodeId}`,
          sourceId: raNodeId,
          targetId: conclusionNodeId,
          edgeType: "conclusion",
          debateId: deliberationId,
        });
      }

      // I-nodes for premises
      for (const premise of arg.premises) {
        const premiseNodeId = `I:${premise.claim.id}`;
        if (!nodeIds.has(premiseNodeId)) {
          // Phase B: Tag I-nodes with role (axiom vs premise) for KB stratification
          const premiseRole = premise.isAxiom ? 'axiom' : 'premise';
          
          nodes.push({
            id: premiseNodeId,
            nodeType: "I",
            content: premise.claim.text,
            claimText: premise.claim.text,
            debateId: deliberationId,
            // Phase B: Add metadata for ASPIC+ KB classification
            metadata: {
              role: premiseRole, // 'axiom' (K_n) or 'premise' (K_p)
              isAxiom: premise.isAxiom,
            },
          });
          nodeIds.add(premiseNodeId);
        }

        // Edge: I → RA (premise)
        edges.push({
          id: `${premiseNodeId}->${raNodeId}`,
          sourceId: premiseNodeId,
          targetId: raNodeId,
          edgeType: "premise",
          debateId: deliberationId,
        });
      }
    }

    // Step 3: Add CA-nodes (ConflictApplications as attack nodes)
    for (const conflict of conflictsList) {
      const caNodeId = `CA:${conflict.id}`;
      
      // Determine attack type for visualization
      const attackType = conflict.aspicAttackType || conflict.legacyAttackType || 'unknown';
      
      // Extract metaJson for CQ provenance
      const metaJson = conflict.metaJson as Record<string, any> || {};
      
      // Create CA-node
      if (!nodeIds.has(caNodeId)) {
        nodes.push({
          id: caNodeId,
          nodeType: "CA",
          content: `${attackType} attack`,
          debateId: deliberationId,
          conflictType: attackType.toLowerCase() as "rebut" | "undercut" | "undermine",
          metadata: {
            cqKey: metaJson.cqKey,
            cqText: metaJson.cqText,
            schemeKey: conflict.scheme?.key || metaJson.schemeKey,
            source: metaJson.source,
            createdByMoveId: conflict.createdByMoveId,
            aspicAttackType: conflict.aspicAttackType,
            aspicDefeatStatus: conflict.aspicDefeatStatus,
            aspicMetadata: conflict.aspicMetadata,
            legacyAttackType: conflict.legacyAttackType,
            legacyTargetScope: conflict.legacyTargetScope,
          },
        });
        nodeIds.add(caNodeId);
      }

      // Edge 1: Attacker → CA-node (conflicting edge)
      if (conflict.conflictingArgumentId) {
        const attackerNodeId = `RA:${conflict.conflictingArgumentId}`;
        edges.push({
          id: `${attackerNodeId}->${caNodeId}`,
          sourceId: attackerNodeId,
          targetId: caNodeId,
          edgeType: "conflicting",
          debateId: deliberationId,
        });
      } else if (conflict.conflictingClaimId) {
        // Attacker is a claim (create I-node if needed)
        const attackerClaimNodeId = `I:${conflict.conflictingClaimId}`;
        if (!nodeIds.has(attackerClaimNodeId)) {
          // Use batch-fetched claim from claimsMap (optimization)
          const attackerClaim = claimsMap.get(conflict.conflictingClaimId);
          if (attackerClaim) {
            nodes.push({
              id: attackerClaimNodeId,
              nodeType: "I",
              content: attackerClaim.text,
              claimText: attackerClaim.text,
              debateId: deliberationId,
            });
            nodeIds.add(attackerClaimNodeId);
          }
        }
        edges.push({
          id: `${attackerClaimNodeId}->${caNodeId}`,
          sourceId: attackerClaimNodeId,
          targetId: caNodeId,
          edgeType: "conflicting",
          debateId: deliberationId,
        });
      }

      // Edge 2: CA-node → Target (conflicted edge)
      if (conflict.conflictedArgumentId) {
        const targetNodeId = `RA:${conflict.conflictedArgumentId}`;
        edges.push({
          id: `${caNodeId}->${targetNodeId}`,
          sourceId: caNodeId,
          targetId: targetNodeId,
          edgeType: "conflicted",
          debateId: deliberationId,
        });
      } else if (conflict.conflictedClaimId) {
        // Target is a claim (create I-node if needed)
        const targetClaimNodeId = `I:${conflict.conflictedClaimId}`;
        if (!nodeIds.has(targetClaimNodeId)) {
          // Use batch-fetched claim from claimsMap (optimization)
          const targetClaim = claimsMap.get(conflict.conflictedClaimId);
          if (targetClaim) {
            nodes.push({
              id: targetClaimNodeId,
              nodeType: "I",
              content: targetClaim.text,
              claimText: targetClaim.text,
              debateId: deliberationId,
            });
            nodeIds.add(targetClaimNodeId);
          }
        }
        edges.push({
          id: `${caNodeId}->${targetClaimNodeId}`,
          sourceId: caNodeId,
          targetId: targetClaimNodeId,
          edgeType: "conflicted",
          debateId: deliberationId,
        });
      }

      if (DEBUG_ASPIC) console.log(`[ASPIC API] Created CA-node ${caNodeId}: ${attackType} (${conflict.conflictingArgumentId || conflict.conflictingClaimId} → ${conflict.conflictedArgumentId || conflict.conflictedClaimId})`);
    }

    // Step 3b: Add CA-nodes for ClaimEdges (from CriticalQuestionsV3)
    for (const edge of claimEdgesList) {
      const caNodeId = `CA:ClaimEdge:${edge.id}`;
      
      // Determine attack type for visualization
      const attackType = edge.attackType || 'rebuts';
      
      // Extract metaJson for CQ provenance
      const metaJson = edge.metaJson as Record<string, any> || {};
      
      // Create CA-node
      if (!nodeIds.has(caNodeId)) {
        nodes.push({
          id: caNodeId,
          nodeType: "CA",
          content: `${attackType} attack`,
          debateId: deliberationId,
          conflictType: attackType.toLowerCase() as "rebut" | "undercut" | "undermine",
          metadata: {
            cqKey: metaJson.cqKey,
            schemeKey: metaJson.schemeKey,
            source: metaJson.source || 'claim-edge',
            attackType: edge.attackType,
            targetScope: edge.targetScope,
            claimEdgeId: edge.id,
          },
        });
        nodeIds.add(caNodeId);
      }

      // Edge 1: Attacker claim → CA-node (conflicting edge)
      const attackerNodeId = `I:${edge.fromClaimId}`;
      if (!nodeIds.has(attackerNodeId)) {
        nodes.push({
          id: attackerNodeId,
          nodeType: "I",
          content: edge.from.text,
          claimText: edge.from.text,
          debateId: deliberationId,
        });
        nodeIds.add(attackerNodeId);
      }
      edges.push({
        id: `${attackerNodeId}->${caNodeId}`,
        sourceId: attackerNodeId,
        targetId: caNodeId,
        edgeType: "conflicting",
        debateId: deliberationId,
      });

      // Edge 2: CA-node → Target claim (conflicted edge)
      const targetNodeId = `I:${edge.toClaimId}`;
      if (!nodeIds.has(targetNodeId)) {
        nodes.push({
          id: targetNodeId,
          nodeType: "I",
          content: edge.to.text,
          claimText: edge.to.text,
          debateId: deliberationId,
        });
        nodeIds.add(targetNodeId);
      }
      edges.push({
        id: `${caNodeId}->${targetNodeId}`,
        sourceId: caNodeId,
        targetId: targetNodeId,
        edgeType: "conflicted",
        debateId: deliberationId,
      });

      if (DEBUG_ASPIC) console.log(`[ASPIC API] Created CA-node ${caNodeId}: ${attackType} (ClaimEdge ${edge.fromClaimId} → ${edge.toClaimId})`);
    }

    // Step 4: Add I-nodes for assumptions (K_a)
    for (const assumption of assumptionsList) {
      // Determine the assumption text
      let assumptionText: string | undefined;
      let assumptionNodeId: string | undefined;

      if (assumption.assumptionClaimId) {
        // Assumption tied to existing claim
        assumptionNodeId = `I:${assumption.assumptionClaimId}`;
        
        // Fetch claim if not already in nodes
        if (!nodeIds.has(assumptionNodeId)) {
          // Use batch-fetched claim from claimsMap (optimization)
          const claim = claimsMap.get(assumption.assumptionClaimId);
          
          if (claim) {
            assumptionText = claim.text;
            nodes.push({
              id: assumptionNodeId,
              nodeType: "I",
              content: assumptionText,
              claimText: assumptionText,
              debateId: deliberationId,
              metadata: {
                role: "assumption", // Tag as assumption for K_a
                assumptionId: assumption.id,
                weight: assumption.weight,
                confidence: assumption.confidence,
              },
            });
            nodeIds.add(assumptionNodeId);
          }
        }
      } else if (assumption.assumptionText) {
        // Freeform assumption (not tied to existing claim)
        assumptionNodeId = `I:assumption_${assumption.id}`;
        assumptionText = assumption.assumptionText;
        
        if (!nodeIds.has(assumptionNodeId)) {
          nodes.push({
            id: assumptionNodeId,
            nodeType: "I",
            content: assumptionText,
            claimText: assumptionText,
            debateId: deliberationId,
            metadata: {
              role: "assumption", // Tag as assumption for K_a
              assumptionId: assumption.id,
              weight: assumption.weight,
              confidence: assumption.confidence,
            },
          });
          nodeIds.add(assumptionNodeId);
        }
      }

      // Only create edge and log if we successfully created the assumption node
      if (assumptionNodeId && assumptionText) {
        // Create presumption edge from assumption to argument (if used in argument)
        if (assumption.argumentId) {
          const argumentNodeId = `RA:${assumption.argumentId}`;
          edges.push({
            id: `${assumptionNodeId}->${argumentNodeId}`,
            sourceId: assumptionNodeId,
            targetId: argumentNodeId,
            edgeType: "presumption", // Special edge type for assumptions
            debateId: deliberationId,
          });
        }

        if (DEBUG_ASPIC) console.log(`[ASPIC API] Created assumption I-node ${assumptionNodeId}: "${assumptionText}" (weight: ${assumption.weight}, confidence: ${assumption.confidence})`);
      }
    }

    // Build AIFGraph object
    const aifGraph: AIFGraph = {
      nodes,
      edges,
      metadata: {
        debateId: deliberationId,
      },
    };

    // Step 4: Translate AIF → ASPIC+ theory (with explicit contraries)
    const theory = aifToASPIC(aifGraph, explicitContraries as any);

    // ASPIC+ Phase 4.2: Populate preferences from AIF PA-nodes
    const { populateKBPreferencesFromAIF } = await import("@/lib/aspic/translation/aifToASPIC");
    const { premisePreferences, rulePreferences } = await populateKBPreferencesFromAIF(deliberationId);
    
    // Add preferences to theory
    theory.preferences = [
      ...premisePreferences.map(p => ({ preferred: p.preferred, dispreferred: p.dispreferred })),
      ...rulePreferences.map(p => ({ preferred: p.preferred, dispreferred: p.dispreferred })),
    ];

    // Step 4.5: Validate rationality postulates (Phase B)
    const { validateAxiomConsistency, validateWellFormedness } = await import(
      "@/lib/aspic/validation"
    );
    const { validateTranspositionClosure } = await import(
      "@/lib/aspic/transposition"
    );
    const axiomCheck = validateAxiomConsistency(theory);
    const wellFormednessCheck = validateWellFormedness(theory);
    const transpositionCheck = validateTranspositionClosure(theory.strictRules);

    if (!axiomCheck.valid || !wellFormednessCheck.valid || !transpositionCheck.isClosed) {
      console.warn("[ASPIC API] Rationality violations detected:", {
        axioms: axiomCheck,
        wellFormedness: wellFormednessCheck,
        transposition: transpositionCheck.isClosed ? "closed" : `${transpositionCheck.missingRules.length} missing transpositions`,
      });
    }

    // Step 5: Compute ASPIC+ semantics with configurable limits
    const semantics = computeAspicSemantics(theory, {
      maxDepth,
      maxArguments,
      dedupeStrictRules: true, // Always dedupe to prevent explosion
    });

    // Step 5.5: Limit response size to prevent serialization errors
    const MAX_RESPONSE_ARGUMENTS = 500;
    const MAX_RESPONSE_ATTACKS = 1000;
    const MAX_RESPONSE_DEFEATS = 1000;
    
    const truncatedArguments = semantics.arguments.slice(0, MAX_RESPONSE_ARGUMENTS);
    const truncatedAttacks = semantics.attacks.slice(0, MAX_RESPONSE_ATTACKS);
    const truncatedDefeats = semantics.defeats.slice(0, MAX_RESPONSE_DEFEATS);
    
    const wasTruncated = 
      semantics.arguments.length > MAX_RESPONSE_ARGUMENTS ||
      semantics.attacks.length > MAX_RESPONSE_ATTACKS ||
      semantics.defeats.length > MAX_RESPONSE_DEFEATS;
    
    if (wasTruncated) {
      console.warn("[ASPIC API] Response truncated:", {
        originalArguments: semantics.arguments.length,
        returnedArguments: truncatedArguments.length,
        originalAttacks: semantics.attacks.length,
        returnedAttacks: truncatedAttacks.length,
        originalDefeats: semantics.defeats.length,
        returnedDefeats: truncatedDefeats.length,
      });
    }

    // Step 6: Format response for UI
    const includeAcceptability =
      req.nextUrl.searchParams.get("include") === "acceptability";
    const acceptability = includeAcceptability
      ? computeAcceptability(
          toDefeatGraphFromEdgeList(
            semantics.arguments.map((a) => a.id),
            semantics.defeats.map((d): [string, string] => [
              d.defeater.id,
              d.defeated.id,
            ])
          )
        )
      : undefined;
    const response = {
      theory: {
        system: {
          language: Array.from(theory.language),
          contraries: Object.fromEntries(
            Array.from(theory.contraries.entries()).map(([key, valueSet]) => [
              key,
              Array.from(valueSet),
            ])
          ),
          strictRules: theory.strictRules,
          defeasibleRules: theory.defeasibleRules,
          ruleNames: {},
        },
        knowledgeBase: {
          axioms: Array.from(theory.axioms),
          premises: Array.from(theory.premises),
          assumptions: Array.from(theory.assumptions),
          // Phase 2.3: report the actual split, not the combined pool mislabeled
          // as premisePreferences with an empty rulePreferences.
          premisePreferences,
          rulePreferences,
        },
      },
      semantics: {
        arguments: truncatedArguments.map((arg) => {
          const mapped = {
            id: arg.id,
            premises: Array.from(arg.premises),
            conclusion: arg.conclusion,
            defeasibleRules: Array.from(arg.defeasibleRules),
            topRule: arg.topRule,
            structure: arg.structure,
          };
          
          return mapped;
        }),
        attacks: truncatedAttacks.map((atk) => ({
          attackerId: atk.attacker.id,
          attackedId: atk.attacked.id,
          type: atk.type,
          target: atk.target,
          metadata: atk.metadata,
        })),
        defeats: truncatedDefeats.map((def) => ({
          defeaterId: def.defeater.id,
          defeatedId: def.defeated.id,
          attackType: def.attack.type,
          preferenceApplied: def.preferenceApplied,
        })),
        groundedExtension: Array.from(semantics.groundedExtension),
        justificationStatus: Object.fromEntries(semantics.justificationStatus),
        ...(acceptability ? { acceptability } : {}),
      },
      rationality: {
        wellFormed: axiomCheck.valid && wellFormednessCheck.valid,
        violations: [
          ...(axiomCheck.errors || []),
          ...(wellFormednessCheck.errors || []),
        ],
        postulates: {
          axiomConsistency: axiomCheck.valid,
          wellFormedness: wellFormednessCheck.valid,
          subArgumentClosure: true, // Phase C: Implement with strict rules
          transpositionClosure: transpositionCheck.isClosed,
        },
      },
      // Include truncation info so UI can show warnings
      truncation: wasTruncated ? {
        truncated: true,
        original: {
          arguments: semantics.arguments.length,
          attacks: semantics.attacks.length,
          defeats: semantics.defeats.length,
        },
        returned: {
          arguments: truncatedArguments.length,
          attacks: truncatedAttacks.length,
          defeats: truncatedDefeats.length,
        },
        limits: {
          maxResponseArguments: MAX_RESPONSE_ARGUMENTS,
          maxResponseAttacks: MAX_RESPONSE_ATTACKS,
          maxResponseDefeats: MAX_RESPONSE_DEFEATS,
        },
      } : undefined,
      // Include construction params so UI knows what was used
      constructionParams: {
        maxDepth,
        maxArguments,
        dedupeStrictRules: true,
      },
    };

    // Cache the result for future requests
    try {
      await setCachedAspicResult(cacheKey, response, ASPIC_CACHE_TTL);
      if (DEBUG_ASPIC) console.log(`[ASPIC API] Cached result for ${deliberationId}`);
    } catch (e) {
      // Cache write failure is not fatal
      if (DEBUG_ASPIC) console.warn(`[ASPIC API] Failed to cache result:`, e);
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60", // Cache for 1 minute
        "X-Cache": "MISS",
      },
    });
  } catch (error: any) {
    console.error("Error fetching ASPIC+ theory:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch ASPIC+ theory",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// CACHING HELPERS
// ============================================================================

// In-memory cache for development/fallback when Redis is unavailable
const memoryCache = new Map<string, { data: any; expiry: number }>();

/**
 * Get cached ASPIC evaluation result
 */
async function getCachedAspicResult(key: string): Promise<any | null> {
  // Try memory cache first
  const memCached = memoryCache.get(key);
  if (memCached && memCached.expiry > Date.now()) {
    return memCached.data;
  }
  
  // Try Redis if available
  try {
    const { default: redis } = await import("@/lib/redis");
    if (redis) {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (e) {
    // Redis not available, fall through
  }
  
  return null;
}

/**
 * Set cached ASPIC evaluation result
 */
async function setCachedAspicResult(key: string, data: any, ttlSeconds: number): Promise<void> {
  // Always set in memory cache
  memoryCache.set(key, {
    data,
    expiry: Date.now() + (ttlSeconds * 1000),
  });
  
  // Clean up old entries periodically (keep last 50)
  if (memoryCache.size > 50) {
    const entries = Array.from(memoryCache.entries());
    const sortedByExpiry = entries.sort((a, b) => a[1].expiry - b[1].expiry);
    for (let i = 0; i < entries.length - 50; i++) {
      memoryCache.delete(sortedByExpiry[i][0]);
    }
  }
  
  // Try Redis if available
  try {
    const { default: redis } = await import("@/lib/redis");
    if (redis) {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    }
  } catch (e) {
    // Redis not available, memory cache is sufficient
  }
}

/**
 * Invalidate cached ASPIC result for a deliberation
 * Call this when arguments/conflicts change
 */
async function invalidateAspicCache(deliberationId: string): Promise<void> {
  // Clear from memory cache (all keys for this deliberation)
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`aspic:eval:${deliberationId}:`)) {
      memoryCache.delete(key);
    }
  }
  
  // Clear from Redis if available
  try {
    const { default: redis } = await import("@/lib/redis");
    if (redis) {
      const keys = await redis.keys(`aspic:eval:${deliberationId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (e) {
    // Redis not available
  }
}
