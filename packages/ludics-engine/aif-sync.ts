/**
 * AIF/Dialogue Sync for Ludics Actions
 * 
 * Syncs Ludics actions (concessions, daimons, branch closes, force concessions)
 * back to the AIF/ASPIC/Dialogical move systems to maintain consistency.
 * 
 * AIF Integration:
 * - Creates DialogueMove records for protocol tracking
 * - Creates DM-nodes (Dialogue Move nodes) in the AIF graph
 * - Creates proper edges:
 *   - CONCEDE → I-node: `aif:commitsTo` edge (commitment to proposition)
 *   - ACCEPT_ARGUMENT → RA-node: `aif:answers` edge
 *   - CLOSE → parent DM-node: `aif:repliesTo` edge
 * 
 * @see lib/aif/ontology.ts for AIF ontology definitions
 * @see DIALOGUE_LUDICS_MAPPING_COMPLETE.md for mapping documentation
 */

import { prisma } from "@/lib/prismaclient";
import { AIF_DIALOGUE_ONTOLOGY } from "@/lib/aif/ontology";

export type LudicsActionType = 
  | "CONCESSION"
  | "FORCE_CONCESSION"
  | "BRANCH_CLOSE"
  | "DAIMON"
  | "ACK";

export interface SyncToAifOptions {
  deliberationId: string;
  actionType: LudicsActionType;
  actorId: string;           // "Proponent" | "Opponent" or userId
  locusPath: string;
  expression?: string;
  targetClaimId?: string;    // Optional: if conceding to a specific claim
  targetArgumentId?: string; // Optional: if conceding to a specific argument
  ludicActId?: string;       // The LudicAct id that triggered this
  ludicDesignId?: string;    // The LudicDesign id
  replyToMoveId?: string;    // Optional: the DialogueMove this is responding to
}

/**
 * Maps Ludics action types to DialogueMove kinds
 */
function mapActionToMoveKind(actionType: LudicsActionType): string {
  switch (actionType) {
    case "CONCESSION":
    case "FORCE_CONCESSION":
      return "CONCEDE";
    case "BRANCH_CLOSE":
      return "CLOSE";
    case "DAIMON":
      return "ACCEPT_ARGUMENT"; // Daimon = acceptance/termination
    case "ACK":
      return "ASSERT"; // ACK is an assertion of acknowledgment
    default:
      return "CONCEDE";
  }
}

/**
 * Maps Ludics action types to AIF DM-node types
 */
function mapActionToAifNodeType(actionType: LudicsActionType): string {
  switch (actionType) {
    case "CONCESSION":
    case "FORCE_CONCESSION":
      return AIF_DIALOGUE_ONTOLOGY.DM_CONCEDE;
    case "BRANCH_CLOSE":
      return AIF_DIALOGUE_ONTOLOGY.DM_CLOSE;
    case "DAIMON":
      return AIF_DIALOGUE_ONTOLOGY.DM_ACCEPT;
    case "ACK":
      return AIF_DIALOGUE_ONTOLOGY.DM_NODE; // Generic DM node for ACK
    default:
      return AIF_DIALOGUE_ONTOLOGY.DM_NODE;
  }
}

/**
 * Generate a unique signature for deduplication
 */
function generateSignature(opts: SyncToAifOptions): string {
  return [
    mapActionToMoveKind(opts.actionType),
    opts.actionType,
    opts.locusPath,
    opts.actorId,
    opts.ludicActId ?? Date.now(),
  ].join(":");
}

/**
 * Sync a Ludics action to the AIF/Dialogue systems
 * Creates:
 * 1. A DialogueMove record
 * 2. A DialogueVisualizationNode record
 * 3. Optionally an AifNode (DM-node type)
 */
export async function syncToAif(opts: SyncToAifOptions): Promise<{
  dialogueMoveId: string | null;
  aifNodeId: string | null;
  visualizationNodeId: string | null;
}> {
  const {
    deliberationId,
    actionType,
    actorId,
    locusPath,
    expression,
    targetClaimId,
    targetArgumentId,
    ludicActId,
    ludicDesignId,
  } = opts;

  const moveKind = mapActionToMoveKind(actionType);
  const signature = generateSignature(opts);

  // Check for existing move with same signature (idempotency)
  const existing = await prisma.dialogueMove.findFirst({
    where: { deliberationId, signature },
  });
  
  if (existing) {
    console.log(`[aif-sync] Move already exists for signature: ${signature}`);
    return {
      dialogueMoveId: existing.id,
      aifNodeId: null,
      visualizationNodeId: null,
    };
  }

  // Determine target type and id
  const targetType = targetArgumentId ? "argument" : targetClaimId ? "claim" : "locus";
  const targetId = targetArgumentId ?? targetClaimId ?? locusPath;

  // Find the locus record if it exists
  const locus = await prisma.ludicLocus.findFirst({
    where: { dialogueId: deliberationId, path: locusPath },
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create DialogueMove
      const dialogueMove = await tx.dialogueMove.create({
        data: {
          deliberationId,
          authorId: actorId,
          actorId,
          type: moveKind,
          kind: moveKind,
          targetType,
          targetId,
          signature,
          locusId: locus?.id ?? null,
          endsWithDaimon: actionType === "DAIMON" || actionType === "BRANCH_CLOSE",
          polarity: actorId === "Proponent" ? "P" : "O",
          payload: {
            ludicsAction: actionType,
            locusPath,
            expression,
            ludicActId,
            ludicDesignId,
            syncedAt: new Date().toISOString(),
          },
        },
      });

      // 2. Create DialogueVisualizationNode for visualization system
      const visualizationNode = await tx.dialogueVisualizationNode.create({
        data: {
          deliberationId,
          dialogueMoveId: dialogueMove.id,
          nodeKind: moveKind,
          metadata: {
            ludicsAction: actionType,
            locusPath,
            expression,
            actorId,
          },
        },
      });

      // 3. Create AIF Node (DM-node) for AIF graph representation
      let aifNode = null;
      const aifNodeType = mapActionToAifNodeType(actionType);
      
      try {
        aifNode = await tx.aifNode.create({
          data: {
            deliberationId,
            nodeKind: "DM", // Dialogue Move node
            nodeSubtype: aifNodeType, // Specific DM-node subtype from ontology
            label: `${moveKind} @ ${locusPath}`,
            text: expression ?? `${actionType} at locus ${locusPath}`,
            dialogueMoveId: dialogueMove.id,
            ludicActId: ludicActId ?? null,
            locusPath,
            locusRole: actionType === "DAIMON" ? "daimon" : "responder",
            dialogueMetadata: {
              locution: moveKind,
              aifType: aifNodeType,
              speaker: actorId,
              ludicsAction: actionType,
              timestamp: new Date().toISOString(),
              targetClaimId: targetClaimId ?? null,
              targetArgumentId: targetArgumentId ?? null,
            },
          },
        });

        // Update DialogueMove with AIF representation
        await tx.dialogueMove.update({
          where: { id: dialogueMove.id },
          data: { aifRepresentation: aifNode.id },
        });

        // 4. Create AIF edges based on action type
        // For CONCEDE moves, create commitsTo edge to the I-node (claim)
        if (
          (actionType === "CONCESSION" || actionType === "FORCE_CONCESSION") &&
          targetClaimId
        ) {
          await createCommitmentEdge(tx, aifNode.id, targetClaimId, deliberationId, dialogueMove.id);
        }
        
        // For DAIMON/ACCEPT_ARGUMENT, create answers edge to the RA-node (argument)
        if (actionType === "DAIMON" && targetArgumentId) {
          await createAnswersEdge(tx, aifNode.id, targetArgumentId, deliberationId, dialogueMove.id);
        }
      } catch (aifErr: any) {
        // AIF node creation is optional - log but don't fail
        console.warn("[aif-sync] Failed to create AIF node:", aifErr.message);
      }

      return {
        dialogueMoveId: dialogueMove.id,
        aifNodeId: aifNode?.id ?? null,
        visualizationNodeId: visualizationNode.id,
      };
    });

    console.log(`[aif-sync] Created DialogueMove ${result.dialogueMoveId} for ${actionType} @ ${locusPath}`);
    return result;
  } catch (err: any) {
    console.error("[aif-sync] Failed to sync:", err.message);
    // Return nulls but don't throw - sync failures shouldn't break ludics operations
    return {
      dialogueMoveId: null,
      aifNodeId: null,
      visualizationNodeId: null,
    };
  }
}

/**
 * Batch sync multiple Ludics actions
 */
export async function syncBatchToAif(
  actions: SyncToAifOptions[]
): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;

  for (const action of actions) {
    const result = await syncToAif(action);
    if (result.dialogueMoveId) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Create a commitment edge (aif:commitsTo) from a DM-node to an I-node.
 * Used when a CONCEDE move commits the speaker to a proposition.
 * 
 * Per AIF documentation: "Concessions create a commitsTo edge from the DM-node
 * to the I-node representing the proposition being conceded."
 */
async function createCommitmentEdge(
  tx: any,
  dmNodeId: string,
  targetClaimId: string,
  deliberationId: string,
  causedByMoveId?: string
): Promise<void> {
  try {
    // Find the I-node (Information node) for this claim
    // First try to find an existing AIF I-node linked to the claim
    let iNode = await tx.aifNode.findFirst({
      where: {
        deliberationId,
        nodeKind: "I",
        OR: [
          // Check dialogueMetadata.claimId
          {
            dialogueMetadata: {
              path: ["claimId"],
              equals: targetClaimId,
            },
          },
          // Also check if text matches the claim text
          {
            dialogueMetadata: {
              path: ["sourceClaimId"],
              equals: targetClaimId,
            },
          },
        ],
      },
    });

    // If no I-node exists, create one from the Claim
    if (!iNode) {
      const claim = await tx.claim.findUnique({
        where: { id: targetClaimId },
        select: { id: true, text: true },
      });

      if (claim) {
        iNode = await tx.aifNode.create({
          data: {
            deliberationId,
            nodeKind: "I",
            nodeSubtype: "proposition",
            label: claim.text?.substring(0, 50) || "Claim",
            text: claim.text,
            dialogueMetadata: {
              claimId: targetClaimId,
              sourceClaimId: targetClaimId,
              createdBy: "ludics-sync",
              createdAt: new Date().toISOString(),
            },
          },
        });
        console.log(`[aif-sync] Created I-node ${iNode.id} for claim ${targetClaimId}`);
      }
    }

    if (iNode) {
      // Create the commitsTo edge
      await tx.aifEdge.create({
        data: {
          deliberationId,
          sourceId: dmNodeId,
          targetId: iNode.id,
          edgeRole: AIF_DIALOGUE_ONTOLOGY.EDGE_COMMITS_TO, // "aif:commitsTo"
          causedByMoveId,
        },
      });
      console.log(`[aif-sync] Created commitsTo edge: ${dmNodeId} → ${iNode.id}`);
    } else {
      console.warn(`[aif-sync] Could not find/create I-node for claim ${targetClaimId}`);
    }
  } catch (err: any) {
    console.warn("[aif-sync] Failed to create commitment edge:", err.message);
  }
}

/**
 * Create an answers edge (aif:answers) from a DM-node to an RA-node.
 * Used when a DAIMON/ACCEPT_ARGUMENT move accepts an argument.
 */
async function createAnswersEdge(
  tx: any,
  dmNodeId: string,
  targetArgumentId: string,
  deliberationId: string,
  causedByMoveId?: string
): Promise<void> {
  try {
    // Find the RA-node (Reasoning Application node) for this argument
    let raNode = await tx.aifNode.findFirst({
      where: {
        deliberationId,
        nodeKind: "RA",
        OR: [
          {
            dialogueMetadata: {
              path: ["argumentId"],
              equals: targetArgumentId,
            },
          },
          {
            dialogueMetadata: {
              path: ["sourceArgumentId"],
              equals: targetArgumentId,
            },
          },
        ],
      },
    });

    // If no RA-node exists, create one from the Argument
    if (!raNode) {
      const argument = await tx.argument.findUnique({
        where: { id: targetArgumentId },
        select: { id: true, text: true, schemeId: true },
      });

      if (argument) {
        raNode = await tx.aifNode.create({
          data: {
            deliberationId,
            nodeKind: "RA",
            nodeSubtype: "inference",
            label: argument.text?.substring(0, 50) || "Argument",
            text: argument.text,
            schemeKey: argument.schemeId ?? null,
            dialogueMetadata: {
              argumentId: targetArgumentId,
              sourceArgumentId: targetArgumentId,
              createdBy: "ludics-sync",
              createdAt: new Date().toISOString(),
            },
          },
        });
        console.log(`[aif-sync] Created RA-node ${raNode.id} for argument ${targetArgumentId}`);
      }
    }

    if (raNode) {
      // Create the answers edge
      await tx.aifEdge.create({
        data: {
          deliberationId,
          sourceId: dmNodeId,
          targetId: raNode.id,
          edgeRole: AIF_DIALOGUE_ONTOLOGY.EDGE_ANSWERS, // "aif:answers"
          causedByMoveId,
        },
      });
      console.log(`[aif-sync] Created answers edge: ${dmNodeId} → ${raNode.id}`);
    } else {
      console.warn(`[aif-sync] Could not find/create RA-node for argument ${targetArgumentId}`);
    }
  } catch (err: any) {
    console.warn("[aif-sync] Failed to create answers edge:", err.message);
  }
}

/**
 * Create edges in AIF graph connecting the new node to related nodes
 * (Called after transaction for any additional edge creation)
 * 
 * @deprecated Use the edge creation within syncToAif transaction instead.
 * This function is kept for backward compatibility with existing code.
 */
export async function createAifEdgesForSync(
  aifNodeId: string,
  targetArgumentId?: string,
  targetClaimId?: string
): Promise<void> {
  if (!aifNodeId) return;

  try {
    // Get the node to find its deliberationId
    const node = await prisma.aifNode.findUnique({
      where: { id: aifNodeId },
      select: { deliberationId: true, dialogueMoveId: true },
    });
    if (!node) return;

    // Use prisma directly (not in transaction) for backward compatibility
    if (targetClaimId) {
      await createCommitmentEdgeStandalone(
        aifNodeId,
        targetClaimId,
        node.deliberationId,
        node.dialogueMoveId ?? undefined
      );
    }

    if (targetArgumentId) {
      await createAnswersEdgeStandalone(
        aifNodeId,
        targetArgumentId,
        node.deliberationId,
        node.dialogueMoveId ?? undefined
      );
    }
  } catch (err: any) {
    console.warn("[aif-sync] Failed to create edges:", err.message);
  }
}

/**
 * Standalone version of createCommitmentEdge (outside transaction)
 */
async function createCommitmentEdgeStandalone(
  dmNodeId: string,
  targetClaimId: string,
  deliberationId: string,
  causedByMoveId?: string
): Promise<void> {
  await createCommitmentEdge(prisma, dmNodeId, targetClaimId, deliberationId, causedByMoveId);
}

/**
 * Standalone version of createAnswersEdge (outside transaction)
 */
async function createAnswersEdgeStandalone(
  dmNodeId: string,
  targetArgumentId: string,
  deliberationId: string,
  causedByMoveId?: string
): Promise<void> {
  await createAnswersEdge(prisma, dmNodeId, targetArgumentId, deliberationId, causedByMoveId);
}
