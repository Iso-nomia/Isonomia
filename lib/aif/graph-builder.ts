/**
 * AIF Graph Builder - Dialogue-Aware Graph Construction
 * 
 * Purpose: Build complete AIF graphs with optional dialogue move layer
 * Phase: 2.1 - Dialogue Visualization Roadmap
 * Date: November 3, 2025
 * 
 * CRITICAL ARCHITECTURE:
 * - Builds graphs from Argument/Claim/ConflictApplication (NOT AifNode/AifEdge)
 * - Follows proven pattern from generate-debate-sheets.ts
 * - Uses claim-to-argument resolution map for edge derivation
 * - Queries ConflictApplication for attack edges (ArgumentEdge table is empty/legacy)
 * 
 * See: DIALOGUE_VISUALIZATION_ROADMAP.md Phase 2.2
 */

import { prisma, Prisma } from "@/lib/prismaclient";
import type {
  AifGraphWithDialogue,
  AifNodeWithDialogue,
  DialogueAwareEdge,
  DialogueMoveWithAif,
  BuildGraphOptions,
} from "@/types/aif-dialogue";

/**
 * Build a dialogue-aware AIF graph for a deliberation
 * 
 * @param deliberationId - The deliberation to fetch the graph for
 * @param options - Options for filtering and customizing the graph
 * @returns Complete AIF graph with nodes, edges, and optional dialogue moves
 */
export async function buildDialogueAwareGraph(
  deliberationId: string,
  options: Partial<BuildGraphOptions> = {}
): Promise<AifGraphWithDialogue> {
  const {
    includeDialogue = false,
    includeMoves = "all",
    participantFilter,
    timeRange,
  } = options;

  const nodes: AifNodeWithDialogue[] = [];
  const edges: DialogueAwareEdge[] = [];

  // Step 1: Fetch all arguments (RA-nodes) with dialogue provenance
  const argumentsList = await prisma.argument.findMany({
    where: { deliberationId },
    include: {
      conclusion: { select: { id: true, text: true } },
      premises: {
        select: {
          claimId: true,
          claim: { select: { id: true, text: true } },
        },
      },
      createdByMove: includeDialogue
        ? { select: { id: true, kind: true, createdAt: true, actorId: true } }
        : false,
    },
  });

  // Step 2: Build nodes from arguments
  for (const arg of argumentsList) {
    // RA-node (Reasoning Application node)
    nodes.push({
      id: `RA:${arg.id}`,
      nodeKind: "RA",
      text: arg.text || `Argument using ${arg.schemeId || "scheme"}`,
      dialogueMoveId: arg.createdByMoveId || null,
      dialogueMove: arg.createdByMove || null,
      dialogueMetadata: arg.createdByMove
        ? {
            locution: arg.createdByMove.kind,
            speaker: arg.createdByMove.actorId,
            speakerName: arg.createdByMove.actorId, // Would need user lookup for display name
            timestamp: arg.createdByMove.createdAt.toISOString(),
            replyToMoveId: null,
          }
        : null,
      nodeSubtype: "standard",
      deliberationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // I-node for conclusion
    if (arg.conclusion) {
      const conclusionNodeId = `I:${arg.conclusion.id}`;
      if (!nodes.some((n) => n.id === conclusionNodeId)) {
        nodes.push({
          id: conclusionNodeId,
          nodeKind: "I",
          text: arg.conclusion.text,
          dialogueMoveId: null,
          dialogueMove: null,
          dialogueMetadata: null,
          nodeSubtype: "standard",
          deliberationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      // Edge: RA → I (conclusion)
      edges.push({
        id: `edge:${arg.id}:conclusion`,
        source: `RA:${arg.id}`,
        target: conclusionNodeId,
        edgeType: "inference",
        causedByDialogueMoveId: arg.createdByMoveId || null,
      });
    }

    // I-nodes for premises and edges: I → RA
    for (const premise of arg.premises) {
      const premiseINodeId = `I:${premise.claimId}`;

      // Add I-node if not already added
      if (!nodes.some((n) => n.id === premiseINodeId)) {
        nodes.push({
          id: premiseINodeId,
          nodeKind: "I",
          text: premise.claim.text,
          dialogueMoveId: null,
          dialogueMove: null,
          dialogueMetadata: null,
          nodeSubtype: "standard",
          deliberationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }

      // Edge: I → RA (premise)
      edges.push({
        id: `edge:${premise.claimId}:premise:${arg.id}`,
        source: premiseINodeId,
        target: `RA:${arg.id}`,
        edgeType: "inference",
        causedByDialogueMoveId: arg.createdByMoveId || null,
      });
    }
  }

  // Step 3: Derive attack edges from ConflictApplication (legacy) AND ArgumentEdge.
  // Phase-3 orchestrator writes attacks to ArgumentEdge.attackType (REBUTS / UNDERCUTS /
  // UNDERMINES) — those need to surface as CA-nodes too. We coalesce both sources
  // into a single uniform `conflicts` array below.
  const [conflictsRaw, attackEdges] = await Promise.all([
    prisma.conflictApplication.findMany({
      where: { deliberationId },
      include: includeDialogue
        ? {
            createdByMove: {
              select: { id: true, kind: true, createdAt: true, actorId: true },
            },
          }
        : {},
    }),
    prisma.argumentEdge.findMany({
      where: { deliberationId, attackType: { not: null } },
      select: {
        id: true,
        fromArgumentId: true,
        toArgumentId: true,
        attackType: true,
        targetClaimId: true,
        targetPremiseId: true,
        createdAt: true,
        createdById: true,
      },
    }),
  ]);

  // Synthesize CA-shaped records from ArgumentEdge so the rest of the pipeline
  // doesn't need to know which table they came from.
  const conflicts: any[] = [
    ...conflictsRaw,
    ...attackEdges.map((e) => ({
      id: `ae:${e.id}`,
      conflictingArgumentId: e.fromArgumentId,
      conflictedArgumentId: e.toArgumentId,
      conflictingClaimId: null,
      conflictedClaimId: e.targetClaimId ?? e.targetPremiseId ?? null,
      legacyAttackType: e.attackType, // "REBUTS" | "UNDERCUTS" | "UNDERMINES"
      createdByMoveId: null,
      createdByMove: null,
    })),
  ];

  // Build claim-to-argument resolution map (follows generate-debate-sheets.ts pattern)
  const claimToArgMap = new Map<string, string>();

  // Map conclusions
  for (const arg of argumentsList) {
    if (arg.conclusionClaimId) {
      claimToArgMap.set(arg.conclusionClaimId, arg.id);
    }
  }

  // Map premises
  const allPremises = await prisma.argumentPremise.findMany({
    where: {
      argument: { deliberationId },
    },
    select: { claimId: true, argumentId: true },
  });

  for (const prem of allPremises) {
    if (!claimToArgMap.has(prem.claimId)) {
      claimToArgMap.set(prem.claimId, prem.argumentId);
    }
  }

  // Step 3.5: Derive support edges from ArgumentPremise (premise I-node → conclusion I-node)
  // This mirrors the support edge derivation in CEG mini route
  for (const arg of argumentsList) {
    if (!arg.conclusionClaimId) continue;

    const conclusionINodeId = `I:${arg.conclusionClaimId}`;

    for (const premise of arg.premises) {
      const premiseINodeId = `I:${premise.claimId}`;

      // Skip self-loops
      if (premise.claimId === arg.conclusionClaimId) continue;

      // Add support edge: premise I-node → conclusion I-node
      // Include argumentId to ensure uniqueness when multiple args share same premise→conclusion
      edges.push({
        id: `edge:support:${arg.id}:${premise.claimId}:${arg.conclusionClaimId}`,
        source: premiseINodeId,
        target: conclusionINodeId,
        edgeType: "supports",
        causedByDialogueMoveId: arg.createdByMoveId || null,
      });
    }
  }

  // Resolve conflicts to CA-nodes and edges
  for (const conflict of conflicts) {
    // Resolve claims to arguments
    let fromArgId =
      conflict.conflictingArgumentId ||
      (conflict.conflictingClaimId
        ? claimToArgMap.get(conflict.conflictingClaimId)
        : null);
    let toArgId =
      conflict.conflictedArgumentId ||
      (conflict.conflictedClaimId
        ? claimToArgMap.get(conflict.conflictedClaimId)
        : null);

    if (!fromArgId || !toArgId) continue; // Skip unresolved conflicts

    const caNodeId = `CA:${conflict.id}`;

    // Create CA-node (Conflict Application node)
    nodes.push({
      id: caNodeId,
      nodeKind: "CA",
      text: `${conflict.legacyAttackType || "Attack"}`,
      dialogueMoveId: conflict.createdByMoveId || null,
      dialogueMove: (conflict as any).createdByMove || null,
      dialogueMetadata: (conflict as any).createdByMove
        ? {
            locution: (conflict as any).createdByMove.kind,
            speaker: (conflict as any).createdByMove.actorId,
            speakerName: (conflict as any).createdByMove.actorId,
            timestamp: (conflict as any).createdByMove.createdAt.toISOString(),
            replyToMoveId: null,
          }
        : null,
      nodeSubtype: "standard",
      deliberationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Edges: attacking arg → CA, CA → targeted arg
    edges.push({
      id: `edge:${fromArgId}:attacks:${caNodeId}`,
      source: `RA:${fromArgId}`,
      target: caNodeId,
      edgeType: "conflict",
      causedByDialogueMoveId: conflict.createdByMoveId || null,
    });

    edges.push({
      id: `edge:${caNodeId}:targets:${toArgId}`,
      source: caNodeId,
      target: `RA:${toArgId}`,
      edgeType: "conflict",
      causedByDialogueMoveId: conflict.createdByMoveId || null,
    });
  }

  // Step 4: Add dialogue visualization nodes (WHY, CONCEDE, RETRACT, etc.)
  if (includeDialogue) {
    const vizNodes = await prisma.dialogueVisualizationNode.findMany({
      where: { deliberationId },
      include: {
        dialogueMove: {
          select: { id: true, kind: true, createdAt: true, actorId: true, targetType: true, targetId: true },
        },
      },
    });

    for (const vizNode of vizNodes) {
      nodes.push({
        id: `DM:${vizNode.id}`,
        nodeKind: "DM",
        text: `${vizNode.nodeKind}`,
        dialogueMoveId: vizNode.dialogueMoveId,
        dialogueMove: vizNode.dialogueMove as any,
        dialogueMetadata: {
          locution: vizNode.nodeKind,
          speaker: vizNode.dialogueMove.actorId,
          speakerName: vizNode.dialogueMove.actorId,
          timestamp: vizNode.createdAt.toISOString(),
          replyToMoveId: null,
        },
        nodeSubtype: "dialogue_move",
        deliberationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Create edges for dialogue move interactions (e.g., WHY → RA)
      const metadata = vizNode.metadata as any;
      if (metadata?.targetId && vizNode.dialogueMove.targetType === "argument") {
        // Link WHY/CLOSE/etc to the argument they reference
        const targetArgId = metadata.targetId || vizNode.dialogueMove.targetId;
        edges.push({
          id: `edge:${vizNode.id}:triggers:${targetArgId}`,
          source: `DM:${vizNode.id}`,
          target: `RA:${targetArgId}`,
          edgeType: "triggers",
          causedByDialogueMoveId: vizNode.dialogueMoveId,
        });
      }
    }
  }

  // Step 5: Fetch dialogue moves metadata
  let dialogueMoves: DialogueMoveWithAif[] = [];
  if (includeDialogue) {
    const moveFilter: any = { deliberationId };

    if (includeMoves === "protocol") {
      moveFilter.kind = {
        in: ["WHY", "GROUNDS", "CONCEDE", "RETRACT", "CLOSE", "ACCEPT_ARGUMENT"],
      };
    } else if (includeMoves === "structural") {
      moveFilter.kind = { in: ["THEREFORE", "SUPPOSE", "DISCHARGE"] };
    }

    if (participantFilter) {
      moveFilter.actorId = participantFilter;
    }

    if (timeRange) {
      moveFilter.createdAt = {
        gte: new Date(timeRange.start),
        lte: new Date(timeRange.end),
      };
    }

    dialogueMoves = (await prisma.dialogueMove.findMany({
      where: moveFilter,
      include: {
        createdArguments: { select: { id: true, text: true } },
        createdConflicts: { select: { id: true, legacyAttackType: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as any;
  }

  // Step 6: Build commitment stores
  const commitmentStores: Record<string, string[]> = {};
  if (includeDialogue) {
    for (const move of dialogueMoves) {
      const actorId = move.actorId;
      if (!commitmentStores[actorId]) {
        commitmentStores[actorId] = [];
      }

      // Add claims from ASSERT, CONCEDE, THEREFORE moves
      if (["ASSERT", "CONCEDE", "THEREFORE"].includes(move.kind)) {
        if (move.targetType === "claim" && move.targetId) {
          if (!commitmentStores[actorId].includes(move.targetId)) {
            commitmentStores[actorId].push(move.targetId);
          }
        }
      }

      // Remove claims from RETRACT moves
      if (move.kind === "RETRACT" && move.targetType === "claim" && move.targetId) {
        const index = commitmentStores[actorId].indexOf(move.targetId);
        if (index > -1) {
          commitmentStores[actorId].splice(index, 1);
        }
      }
    }
  }

  return {
    nodes,
    edges,
    dialogueMoves,
    commitmentStores,
    metadata: {
      totalNodes: nodes.length,
      dmNodeCount: nodes.filter((n) => n.nodeSubtype === "dialogue_move").length,
      moveCount: dialogueMoves.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get dialogue move provenance for a specific node
 * 
 * @param nodeId - The AIF node ID (e.g., "RA:abc123", "I:xyz789")
 * @param deliberationId - The deliberation context
 * @param includeDialogue - Whether to include dialogue move details
 * @returns Provenance information
 */
export async function getNodeProvenance(
  nodeId: string, 
  deliberationId: string,
  includeDialogue: boolean = true
) {
  const [nodeType, id] = nodeId.split(":");

  if (nodeType === "RA") {
    // Argument node
    const argument = await prisma.argument.findUnique({
      where: { id },
      include: {
        createdByMove: {
          select: { id: true, kind: true, createdAt: true, actorId: true },
        },
        conclusion: { select: { id: true, text: true } },
        premises: {
          select: { claim: { select: { id: true, text: true } } },
        },
      },
    });

    if (!argument) {
      throw new Error(`Argument ${id} not found`);
    }

    // Find dialogue moves that reference this argument
    const referencingMoves = await prisma.dialogueMove.findMany({
      where: {
        deliberationId,
        OR: [
          { targetId: id, targetType: "argument" },
          { argumentId: id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      node: {
        id: nodeId,
        type: "argument",
        text: argument.text,
      },
      createdBy: argument.createdByMove
        ? {
            dialogueMoveId: argument.createdByMove.id,
            kind: argument.createdByMove.kind,
            participantId: argument.createdByMove.actorId,
            timestamp: argument.createdByMove.createdAt.toISOString(),
          }
        : null,
      referencedIn: referencingMoves.map((move) => ({
        dialogueMoveId: move.id,
        kind: move.kind,
        participantId: move.actorId,
        timestamp: move.createdAt.toISOString(),
      })),
    };
  } else if (nodeType === "I") {
    // Claim node
    const claim = await prisma.claim.findUnique({
      where: { id },
      include: {
        introducedByMove: includeDialogue
          ? { select: { id: true, kind: true, createdAt: true, actorId: true } }
          : false,
      },
    });

    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    return {
      node: {
        id: nodeId,
        type: "claim",
        text: claim.text,
      },
      createdBy: (claim as any).introducedByMove
        ? {
            dialogueMoveId: (claim as any).introducedByMove.id,
            kind: (claim as any).introducedByMove.kind,
            participantId: (claim as any).introducedByMove.actorId,
            timestamp: (claim as any).introducedByMove.createdAt.toISOString(),
          }
        : null,
      referencedIn: [],
    };
  }

  throw new Error(`Unsupported node type: ${nodeType}`);
}

/**
 * Get commitment stores for all participants in a deliberation
 * 
 * Phase 2 Optimizations:
 * - Redis caching with 60s TTL
 * - Pagination support
 * - Single SQL query with joins (3 queries → 1)
 * - Incremental cache updates
 * - Performance metrics
 * 
 * @param deliberationId - The deliberation ID
 * @param participantId - Optional: filter to specific participant
 * @param asOf - Optional: get commitments as of a specific timestamp
 * @param limit - Optional: max commitments per participant (default: 100)
 * @param offset - Optional: skip first N commitments (default: 0)
 * @returns Commitment stores structured for CommitmentStorePanel with cache metadata
 */
export async function getCommitmentStores(
  deliberationId: string,
  participantId?: string,
  asOf?: string,
  limit: number = 100,
  offset: number = 0
) {
  const startTime = Date.now();
  
  // Build cache key based on parameters
  const cacheKey = `commitment-stores:${deliberationId}:${participantId || 'all'}:${asOf || 'latest'}:${limit}:${offset}`;
  
  // Try to get from cache
  const { getOrSet } = await import('@/lib/redis');
  
  const result = await getOrSet(cacheKey, 60, async () => {
    // Cache miss - compute commitment stores
    const computeStart = Date.now();
    const data = await computeCommitmentStores(deliberationId, participantId, asOf, limit, offset);
    const computeDuration = Date.now() - computeStart;
    
    console.log(`[commitments] Cache MISS - computed in ${computeDuration}ms for ${deliberationId}`);
    
    return {
      data,
      cached: false,
      computeDuration,
      timestamp: new Date().toISOString()
    };
  });
  
  // If result came from cache, it won't have the cached flag set correctly
  const duration = Date.now() - startTime;
  const isCacheHit = duration < 5; // If it took less than 5ms, it was a cache hit
  
  if (isCacheHit && typeof result === 'object' && 'data' in result) {
    console.log(`[commitments] Cache HIT in ${duration}ms for ${deliberationId}`);
    return {
      ...result,
      cached: true
    };
  }
  
  return result;
}

/**
 * Internal function to compute commitment stores (separated for caching)
 * Phase 2: Optimized with single SQL query using joins
 */
async function computeCommitmentStores(
  deliberationId: string,
  participantId?: string,
  asOf?: string,
  limit: number = 100,
  offset: number = 0
) {
  // Phase 2 Optimization: Single query with joins instead of 3 separate queries
  // This reduces database round-trips from 3 to 1
  // Phase 4 Enhancement: Add CommitmentLudicMapping join for promotion status
  // Phase 4.3: Also fetch conclusion claims for arguments (ASSERT argument = commitment to conclusion)
  const movesWithData = await prisma.$queryRaw<Array<{
    move_id: string;
    move_kind: string;
    move_actor_id: string;
    move_target_type: string;
    move_target_id: string | null;
    move_created_at: Date;
    user_name: string | null;
    claim_text: string | null;
    argument_conclusion_id: string | null;
    argument_conclusion_text: string | null;
    mapping_id: string | null;
    promoted_at: Date | null;
    ludic_owner_id: string | null;
    ludic_polarity: string | null;
  }>>`
    SELECT 
      dm.id as move_id,
      dm.kind as move_kind,
      dm."actorId" as move_actor_id,
      dm."targetType" as move_target_type,
      dm."targetId" as move_target_id,
      dm."createdAt" as move_created_at,
      u.name as user_name,
      c.text as claim_text,
      arg."conclusionClaimId" as argument_conclusion_id,
      arg_claim.text as argument_conclusion_text,
      clm_pick.id as mapping_id,
      clm_pick."promotedAt" as promoted_at,
      clm_pick."ludicOwnerId" as ludic_owner_id,
      lce."basePolarity" as ludic_polarity
    FROM "DialogueMove" dm
    LEFT JOIN users u ON (
      CASE 
        WHEN dm."actorId" ~ '^[0-9]+$' THEN CAST(dm."actorId" AS BIGINT) = u.id
        ELSE FALSE
      END
    )
    LEFT JOIN "Claim" c ON dm."targetId" = c.id AND dm."targetType" = 'claim'
    LEFT JOIN "Argument" arg ON dm."targetId" = arg.id AND dm."targetType" = 'argument'
    LEFT JOIN "Claim" arg_claim ON arg."conclusionClaimId" = arg_claim.id
    -- Collapse possible 1:N CommitmentLudicMapping matches to at most one row per move,
    -- keeping the most recently promoted mapping. This prevents row multiplication.
    LEFT JOIN LATERAL (
      SELECT id, "promotedAt", "ludicOwnerId", "ludicCommitmentElementId"
      FROM "CommitmentLudicMapping" clm
      WHERE clm."deliberationId" = dm."deliberationId"
        AND clm."participantId" = dm."actorId"
        AND (
          (c.text IS NOT NULL AND c.text = clm.proposition)
          OR (arg_claim.text IS NOT NULL AND arg_claim.text = clm.proposition)
        )
      ORDER BY clm."promotedAt" DESC NULLS LAST
      LIMIT 1
    ) clm_pick ON TRUE
    LEFT JOIN "LudicCommitmentElement" lce 
      ON clm_pick."ludicCommitmentElementId" = lce.id
    WHERE dm."deliberationId" = ${deliberationId}
      ${participantId ? Prisma.sql`AND dm."actorId" = ${participantId}` : Prisma.empty}
      ${asOf ? Prisma.sql`AND dm."createdAt" <= ${new Date(asOf)}` : Prisma.empty}
    ORDER BY dm."createdAt" ASC
  `;

  // Build commitment stores per participant
  interface ParticipantCommitments {
    participantId: string;
    participantName: string;
    commitments: Array<{
      claimId: string;
      claimText: string;
      moveId: string;
      moveKind: "ASSERT" | "CONCEDE" | "RETRACT";
      timestamp: string;
      isActive: boolean;
      isPromoted?: boolean;
      promotedAt?: string;
      ludicOwnerId?: string;
      ludicPolarity?: string;
    }>;
  }

  const storesByParticipant = new Map<string, ParticipantCommitments>();
  const activeCommitments = new Map<string, Set<string>>(); // participantId -> Set<claimId>

  // Process moves from joined query
  for (const row of movesWithData) {
    const actorId = String(row.move_actor_id);
    
    // Determine actor name (from User table or demo actor)
    let actorName = row.user_name || "Unknown";
    if (!row.user_name && actorId.startsWith("actor-")) {
      actorName = actorId.substring(6).charAt(0).toUpperCase() + actorId.substring(7);
    }

    // Initialize participant store if needed
    if (!storesByParticipant.has(actorId)) {
      storesByParticipant.set(actorId, {
        participantId: actorId,
        participantName: actorName,
        commitments: [],
      });
      activeCommitments.set(actorId, new Set());
    }

    const store = storesByParticipant.get(actorId)!;
    const activeSet = activeCommitments.get(actorId)!;

    // Determine the claim ID and text based on target type
    let claimId: string | null = null;
    let claimText: string | null = null;
    
    if (row.move_target_type === "claim" && row.move_target_id) {
      claimId = row.move_target_id;
      claimText = row.claim_text || claimId;
    } else if (row.move_target_type === "argument" && row.argument_conclusion_id) {
      // ASSERT argument = commitment to its conclusion
      claimId = row.argument_conclusion_id;
      claimText = row.argument_conclusion_text || claimId;
    }

    // Process commitment-relevant moves
    if (
      ["ASSERT", "CONCEDE", "THEREFORE"].includes(row.move_kind) &&
      claimId &&
      claimText
    ) {
      // Add to active set
      activeSet.add(claimId);

      // Add commitment record
      store.commitments.push({
        claimId,
        claimText,
        moveId: row.move_id,
        moveKind: row.move_kind as "ASSERT" | "CONCEDE",
        timestamp: row.move_created_at.toISOString(),
        isActive: true, // Will be updated if retracted later
        isPromoted: !!row.mapping_id,
        promotedAt: row.promoted_at?.toISOString(),
        ludicOwnerId: row.ludic_owner_id || undefined,
        ludicPolarity: row.ludic_polarity || undefined,
      });
    }

    // Handle retractions
    if (row.move_kind === "RETRACT" && claimId && claimText) {
      // Remove from active set
      activeSet.delete(claimId);

      // Mark previous commitments to this claim as inactive
      for (const commitment of store.commitments) {
        if (commitment.claimId === claimId && commitment.isActive) {
          commitment.isActive = false;
        }
      }

      // Add retraction record
      store.commitments.push({
        claimId,
        claimText,
        moveId: row.move_id,
        moveKind: "RETRACT",
        timestamp: row.move_created_at.toISOString(),
        isActive: false,
      });
    }
  }

  // Update final isActive status based on active commitments
  for (const [actorId, store] of storesByParticipant) {
    const activeSet = activeCommitments.get(actorId)!;
    for (const commitment of store.commitments) {
      if (commitment.moveKind !== "RETRACT") {
        commitment.isActive = activeSet.has(commitment.claimId);
      }
    }
  }

  // Apply pagination per participant
  const result = Array.from(storesByParticipant.values()).map(store => ({
    ...store,
    commitments: store.commitments.slice(offset, offset + limit),
    totalCommitments: store.commitments.length,
    hasMore: offset + limit < store.commitments.length
  }));

  return result;
}

/**
 * Invalidate commitment stores cache for a deliberation
 * Call this when dialogue moves are created/updated/deleted
 * 
 * @param deliberationId - The deliberation ID
 */
export async function invalidateCommitmentStoresCache(deliberationId: string): Promise<void> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    if (!redis) return; // Redis not available, skip cache invalidation

    // Delete all cache keys for this deliberation (wildcard pattern)
    const pattern = `commitment-stores:${deliberationId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`[cache] Invalidated ${keys.length} commitment store cache entries for deliberation ${deliberationId}`);
    }
  } catch (error) {
    console.error('[cache] Failed to invalidate commitment stores cache:', error);
    // Don't throw - cache invalidation failure should not break the app
  }
}
