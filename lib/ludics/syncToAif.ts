import { prisma } from "@/lib/prismaclient";

/**
 * Sync LudicAct rows to AifNode rows for a deliberation.
 * 
 * DESIGN PRINCIPLES (Based on Ludics Theory - Faggian & Hyland 2002):
 * =====================================================================
 * 
 * 1. ONE-TO-ONE CORRESPONDENCE:
 *    - Each LudicAct maps to exactly ONE AifNode (enforced by @unique constraint on ludicActId)
 *    - No duplicates should exist; this function ensures idempotency
 * 
 * 2. LUDICS → AIF NODE TYPE MAPPING:
 *    - Positive polarity acts (P) → Information nodes (I-nodes) or RA-nodes
 *      In Ludics: positive actions are "commitments" - assertions/claims
 *    - Negative polarity acts (O) → Can generate CA-nodes when representing attacks
 *      In Ludics: negative actions are "entitlements" - challenges/questions
 *    - DAIMON acts → DM-nodes (dialogue move nodes)
 *      In Ludics: daimon = acknowledgment/termination of interaction
 * 
 * 3. CORRESPONDENCE TO ASPIC+:
 *    - Positive LudicActs with claims → I-nodes (Information)
 *    - Positive LudicActs with arguments → RA-nodes (Rule Application)
 *    - Negative LudicActs with attack metadata → CA-nodes (Conflict Application)
 * 
 * 4. EDGE SEMANTICS (Justification/Visibility):
 *    - "justifiedBy" edges mirror the Ludics VISIBILITY condition:
 *      "Move must be justified by something in player's view"
 *    - This preserves the chronicle structure from Ludics in AIF
 * 
 * Phase 1e: Enhanced with ASPIC+ CA-node generation for attacks
 */
export async function syncLudicsToAif(deliberationId: string): Promise<{
  nodesCreated: number;
  nodesUpdated: number;
  edgesCreated: number;
  caNodesCreated: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    nodesCreated: 0,
    nodesUpdated: 0,
    edgesCreated: 0,
    caNodesCreated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // 1. Fetch all LudicActs for this deliberation with designs
  const acts = await prisma.ludicAct.findMany({
    where: { design: { deliberationId } },
    include: {
      design: true,
      locus: true,
      aifNode: true, // Include existing AifNode relation
    },
    orderBy: { orderInDesign: "asc" },
  });

  if (acts.length === 0) {
    return result;
  }

  // 2. Build a complete map of existing AifNodes by ludicActId
  // This includes nodes we find in the relation AND any orphaned nodes
  const existingNodesByActId = new Map<string, any>();
  
  // First, add nodes from the relation
  for (const act of acts) {
    if (act.aifNode) {
      existingNodesByActId.set(act.id, act.aifNode);
    }
  }
  
  // Also query for any AifNodes that might exist but aren't in our current fetch
  // This handles edge cases where the relation might be stale
  const actIds = acts.map((a) => a.id);
  const additionalNodes = await (prisma as any).aifNode.findMany({
    where: {
      ludicActId: { in: actIds },
    },
  });
  
  for (const node of additionalNodes) {
    if (node.ludicActId && !existingNodesByActId.has(node.ludicActId)) {
      existingNodesByActId.set(node.ludicActId, node);
    }
  }

  // 3. Fetch existing edges to avoid duplicates
  const existingEdges = await (prisma as any).aifEdge.findMany({
    where: { deliberationId },
    select: { sourceId: true, targetId: true, edgeRole: true },
  });
  const existingEdgeKeys = new Set<string>(
    existingEdges.map((e: any) => `${e.sourceId}:${e.targetId}:${e.edgeRole}`)
  );

  // 4. Fetch existing CA-nodes to avoid duplicate attack representations
  const existingCANodes = await (prisma as any).aifNode.findMany({
    where: {
      deliberationId,
      nodeKind: "CA",
      nodeSubtype: "aspic_conflict",
    },
  });
  const existingCANodeKeys = new Set<string>(
    existingCANodes.map((n: any) => {
      const meta = n.dialogueMetadata as any;
      return `${meta?.attackerId}:${meta?.defenderId}:${meta?.cqKey ?? ""}`;
    })
  );

  // 5. Process each act - use transaction for atomicity
  const actsToCreate: any[] = [];
  const actsToUpdate: any[] = [];
  const edgesToCreate: any[] = [];
  const caNodesToCreaete: any[] = [];

  for (const act of acts) {
    const locusPath = act.locus?.path ?? "0";
    const locusRole = determineLocusRole(act);
    const existingNode = existingNodesByActId.get(act.id);

    if (!existingNode) {
      // Need to create new AifNode
      const nodeKind = mapActToNodeKind(act);
      
      actsToCreate.push({
        act,
        data: {
          deliberationId,
          nodeKind,
          ludicActId: act.id,
          locusPath,
          locusRole,
          text: act.expression ?? "",
          nodeSubtype: "ludics_act",
          dialogueMetadata: {
            ...((act.metaJson as any) ?? {}),
            ludicPolarity: act.polarity,
            ludicKind: act.kind,
            isAdditive: act.isAdditive,
            designId: act.designId,
          },
        },
      });
    } else {
      // Check if update is needed
      const needsUpdate = 
        existingNode.locusPath !== locusPath ||
        existingNode.locusRole !== locusRole ||
        existingNode.text !== (act.expression ?? existingNode.text);
      
      if (needsUpdate) {
        actsToUpdate.push({
          id: existingNode.id,
          data: {
            locusPath,
            locusRole,
            text: act.expression ?? existingNode.text,
            nodeSubtype: "ludics_act",
          },
        });
      } else {
        result.skipped++;
      }
    }
  }

  // 6. Execute creates in transaction
  try {
    await prisma.$transaction(async (tx) => {
      // Create new AifNodes
      for (const { act, data } of actsToCreate) {
        try {
          const aifNode = await (tx as any).aifNode.create({ data });
          existingNodesByActId.set(act.id, aifNode);
          result.nodesCreated++;

          // Queue edge creation for justification
          const justifiedByLocus = (act.metaJson as any)?.justifiedByLocus;
          if (justifiedByLocus) {
            const parentAct = acts.find(
              (a) => a.locus?.path === justifiedByLocus && a.design.id === act.design.id
            );
            if (parentAct) {
              edgesToCreate.push({
                aifNodeId: aifNode.id,
                parentActId: parentAct.id,
                moveId: (act.metaJson as any)?.moveId ?? null,
              });
            }
          }

          // Queue CA-node creation if ASPIC+ attack metadata present
          const aspicMeta = (act.metaJson as any)?.aspic;
          if (aspicMeta && aspicMeta.attackType) {
            const caKey = `${aspicMeta.attackerId}:${aspicMeta.defenderId}:${aspicMeta.cqKey ?? ""}`;
            if (!existingCANodeKeys.has(caKey)) {
              caNodesToCreaete.push({
                act,
                aifNode,
                aspicMeta,
                caKey,
              });
            }
          }
        } catch (err: any) {
          // Handle unique constraint violation gracefully
          if (err.code === "P2002") {
            result.skipped++;
            console.warn(`[syncToAif] Skipped duplicate AifNode for act ${act.id}`);
          } else {
            result.errors.push(`Failed to create AifNode for act ${act.id}: ${err.message}`);
          }
        }
      }

      // Update existing AifNodes
      for (const { id, data } of actsToUpdate) {
        try {
          await (tx as any).aifNode.update({ where: { id }, data });
          result.nodesUpdated++;
        } catch (err: any) {
          result.errors.push(`Failed to update AifNode ${id}: ${err.message}`);
        }
      }

      // Create edges (with duplicate check)
      for (const { aifNodeId, parentActId, moveId } of edgesToCreate) {
        const parentNode = existingNodesByActId.get(parentActId);
        if (parentNode) {
          const edgeKey = `${aifNodeId}:${parentNode.id}:justifiedBy`;
          if (!existingEdgeKeys.has(edgeKey)) {
            try {
              await (tx as any).aifEdge.create({
                data: {
                  deliberationId,
                  sourceId: aifNodeId,
                  targetId: parentNode.id,
                  edgeRole: "justifiedBy",
                  causedByMoveId: moveId,
                },
              });
              existingEdgeKeys.add(edgeKey);
              result.edgesCreated++;
            } catch (err: any) {
              if (err.code !== "P2002") {
                result.errors.push(`Failed to create edge: ${err.message}`);
              }
            }
          }
        }
      }

      // Create CA-nodes for ASPIC+ attacks
      for (const { act, aifNode, aspicMeta, caKey } of caNodesToCreaete) {
        const caResult = await createCANodeForAspicAttack(
          tx,
          deliberationId,
          act,
          aifNode,
          aspicMeta,
          acts,
          existingNodesByActId,
          existingEdgeKeys
        );
        
        if (caResult.caNodeCreated) {
          existingCANodeKeys.add(caKey);
          result.caNodesCreated++;
          result.edgesCreated += caResult.edgesCreated;
        }
        if (caResult.error) {
          result.errors.push(caResult.error);
        }
      }
    });
  } catch (err: any) {
    result.errors.push(`Transaction failed: ${err.message}`);
  }

  return result;
}

/**
 * Determine locus role from act properties
 * 
 * Maps Ludics polarity to AIF role semantics:
 * - DAIMON: The "acknowledgment" or termination point (Girard's "giving up" rule)
 * - Positive (P): The "opener/proponent" who makes commitments/assertions
 * - Negative (O): The "responder/opponent" who provides entitlements/challenges
 */
function determineLocusRole(act: any): string {
  if (act.kind === "DAIMON") return "daimon";
  if (act.polarity === "P") return "opener";
  if (act.polarity === "O") return "responder";
  return "neutral";
}

/**
 * Map LudicAct to AifNodeKind
 * 
 * Correspondence (Ludics → AIF → ASPIC+):
 * - Positive acts with claims → I-nodes → Premises/Conclusions
 * - Positive acts with arguments → RA-nodes → Rule Application (inference)
 * - DAIMON → DM-nodes → Dialogue termination
 * - Negative acts with attacks → Triggers CA-node creation → Conflicts
 */
function mapActToNodeKind(act: any): string {
  if (act.kind === "DAIMON") return "DM"; // Dialogue Move (end of sequence)
  
  // Use metaJson to determine if this is tied to an argument/claim
  const meta = act.metaJson as any;
  if (meta?.targetType === "argument") return "RA"; // Inference (RA = Rule Application)
  if (meta?.targetType === "claim") return "I"; // Information
  
  // Default based on polarity (Ludics semantics)
  // Positive actions are typically assertions → I-nodes
  // Negative actions alone don't create nodes; they may trigger CA creation
  if (act.polarity === "P") return "I";
  
  // Default: treat as locution in dialogue
  return "DM";
}

/**
 * Create CA-node for ASPIC+ attack (within transaction)
 * 
 * Creates a Conflict Application node representing the ASPIC+ attack/defeat,
 * and links attacker → CA → defender with appropriate AifEdges.
 * 
 * Ludics Correspondence:
 * - In Ludics, when two designs D and E are orthogonal (D⊥E), their interaction
 *   converges (normalization succeeds). When not orthogonal, there's a conflict.
 * - CA-nodes represent these conflicts in AIF terminology
 * - Attack types (UNDERMINES, REBUTS, UNDERCUTS) map to different conflict semantics
 * 
 * @param tx - Prisma transaction
 * @param deliberationId - Deliberation context
 * @param attackerAct - LudicAct containing the attack
 * @param attackerNode - AifNode for the attacker (just created)
 * @param aspicMeta - ASPIC+ metadata from metaJson.aspic
 * @param allActs - All LudicActs for finding defender
 * @param nodesByActId - Map of actId → AifNode (updated during sync)
 * @param existingEdgeKeys - Set of existing edge keys to avoid duplicates
 * @returns Result with counts
 */
async function createCANodeForAspicAttack(
  tx: any,
  deliberationId: string,
  attackerAct: any,
  attackerNode: any,
  aspicMeta: any,
  allActs: any[],
  nodesByActId: Map<string, any>,
  existingEdgeKeys: Set<string>
): Promise<{ caNodeCreated: boolean; edgesCreated: number; error?: string }> {
  let edgesCreated = 0;

  try {
    // Find defender act by targetId (argument or claim being attacked)
    const defenderId = aspicMeta.defenderId || (attackerAct.metaJson as any)?.targetId;
    if (!defenderId) {
      return { caNodeCreated: false, edgesCreated: 0, error: `CA-node skipped for act ${attackerAct.id}: no defenderId` };
    }

    // Find the defender's LudicAct by targetId
    const defenderAct = allActs.find(
      (a) => (a.metaJson as any)?.targetId === defenderId
    );

    if (!defenderAct) {
      return { caNodeCreated: false, edgesCreated: 0, error: `CA-node skipped: defender act not found for ${defenderId}` };
    }

    const defenderNode = nodesByActId.get(defenderAct.id);
    if (!defenderNode) {
      return { caNodeCreated: false, edgesCreated: 0, error: `CA-node skipped: defender AifNode not found for act ${defenderAct.id}` };
    }

    // Create CA-node representing the ASPIC+ attack
    const caNode = await tx.aifNode.create({
      data: {
        deliberationId,
        nodeKind: "CA", // Conflict Application
        locusPath: attackerAct.locus?.path ?? "0",
        locusRole: "conflict",
        text: `${aspicMeta.attackType} attack`, // e.g., "undermining attack"
        nodeSubtype: "aspic_conflict",
        dialogueMetadata: {
          aspicAttackType: aspicMeta.attackType,
          aspicDefeatStatus: aspicMeta.succeeded,
          attackerId: aspicMeta.attackerId,
          defenderId: aspicMeta.defenderId,
          cqKey: aspicMeta.cqKey,
          cqText: aspicMeta.cqText,
          reason: aspicMeta.reason,
          targetScope: aspicMeta.targetScope,
          // Ludics metadata for traceability
          ludicsAttackerActId: attackerAct.id,
          ludicsDefenderActId: defenderAct.id,
        },
      },
    });

    // Create edges: attacker → CA → defender
    // Edge 1: Attacker supports the CA-node (source of attack)
    const edge1Key = `${attackerNode.id}:${caNode.id}:attacks_via`;
    if (!existingEdgeKeys.has(edge1Key)) {
      await tx.aifEdge.create({
        data: {
          deliberationId,
          sourceId: attackerNode.id,
          targetId: caNode.id,
          edgeRole: "attacks_via",
          causedByMoveId: (attackerAct.metaJson as any)?.moveId ?? null,
        },
      });
      existingEdgeKeys.add(edge1Key);
      edgesCreated++;
    }

    // Edge 2: CA-node targets the defender (attack application)
    const edge2Key = `${caNode.id}:${defenderNode.id}:conflicts_with`;
    if (!existingEdgeKeys.has(edge2Key)) {
      await tx.aifEdge.create({
        data: {
          deliberationId,
          sourceId: caNode.id,
          targetId: defenderNode.id,
          edgeRole: "conflicts_with",
          causedByMoveId: (attackerAct.metaJson as any)?.moveId ?? null,
        },
      });
      existingEdgeKeys.add(edge2Key);
      edgesCreated++;
    }

    return { caNodeCreated: true, edgesCreated };
  } catch (err: any) {
    return { caNodeCreated: false, edgesCreated: 0, error: `CA-node creation failed: ${err.message}` };
  }
}

/**
 * Validate the correspondence between LudicActs and AifNodes for a deliberation.
 * 
 * This function checks that:
 * 1. Every LudicAct has exactly one corresponding AifNode
 * 2. No orphaned AifNodes exist (AifNodes without corresponding LudicActs)
 * 3. Node types are correctly mapped
 * 
 * Based on Ludics theory: the correspondence should be bijective (one-to-one)
 * just as Designs ↔ Innocent Strategies (Faggian & Hyland, Proposition 4.28)
 */
export async function validateLudicsAifCorrespondence(deliberationId: string): Promise<{
  valid: boolean;
  actsWithoutNodes: string[];
  nodesWithoutActs: string[];
  duplicateNodes: string[];
  details: string;
}> {
  // Fetch all LudicActs
  const acts = await prisma.ludicAct.findMany({
    where: { design: { deliberationId } },
    select: { id: true },
  });
  const actIds = new Set<string>(acts.map((a) => a.id));

  // Fetch all AifNodes linked to LudicActs
  const nodes = await (prisma as any).aifNode.findMany({
    where: {
      deliberationId,
      ludicActId: { not: null },
    },
    select: { id: true, ludicActId: true },
  }) as Array<{ id: string; ludicActId: string }>;

  const nodeActIds = new Set<string>();
  const duplicateNodes: string[] = [];
  const nodesWithoutActs: string[] = [];

  for (const node of nodes) {
    if (nodeActIds.has(node.ludicActId)) {
      duplicateNodes.push(node.id);
    } else {
      nodeActIds.add(node.ludicActId);
    }

    if (!actIds.has(node.ludicActId)) {
      nodesWithoutActs.push(node.id);
    }
  }

  const actsWithoutNodes = Array.from(actIds).filter((id) => !nodeActIds.has(id));

  const valid = 
    actsWithoutNodes.length === 0 && 
    nodesWithoutActs.length === 0 && 
    duplicateNodes.length === 0;

  return {
    valid,
    actsWithoutNodes,
    nodesWithoutActs,
    duplicateNodes,
    details: valid
      ? `Correspondence valid: ${acts.length} acts ↔ ${nodes.length} nodes (1:1)`
      : `Correspondence invalid: ${actsWithoutNodes.length} acts without nodes, ${nodesWithoutActs.length} orphaned nodes, ${duplicateNodes.length} duplicates`,
  };
}

/**
 * Clean up orphaned AifNodes that don't have corresponding LudicActs.
 * 
 * This should only be run after validation confirms orphans exist.
 * Preserves referential integrity by first checking for dependencies.
 */
export async function cleanupOrphanedAifNodes(deliberationId: string): Promise<{
  deletedCount: number;
  errors: string[];
}> {
  const validation = await validateLudicsAifCorrespondence(deliberationId);
  
  if (validation.nodesWithoutActs.length === 0) {
    return { deletedCount: 0, errors: [] };
  }

  const errors: string[] = [];
  let deletedCount = 0;

  for (const nodeId of validation.nodesWithoutActs) {
    try {
      // Check for edges before deleting
      const edgeCount = await (prisma as any).aifEdge.count({
        where: {
          OR: [{ sourceId: nodeId }, { targetId: nodeId }],
        },
      });

      if (edgeCount > 0) {
        // Delete edges first
        await (prisma as any).aifEdge.deleteMany({
          where: {
            OR: [{ sourceId: nodeId }, { targetId: nodeId }],
          },
        });
      }

      await (prisma as any).aifNode.delete({ where: { id: nodeId } });
      deletedCount++;
    } catch (err: any) {
      errors.push(`Failed to delete node ${nodeId}: ${err.message}`);
    }
  }

  return { deletedCount, errors };
}
