export const dynamic = "force-dynamic";

// app/api/attacks/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { createDialogueMove } from "@/lib/ludics/createDialogueMove";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/serverutils";
import { computeAspicConflictMetadata } from "@/lib/aspic/conflictHelpers";
import { createClaimAttack } from "@/lib/argumentation/createClaimAttack";
import { suggestionForCQ } from "@/lib/argumentation/cqSuggestions";
import { recordAiDraftEngagement } from "@/lib/argument/aiAuthoring";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

/**
 * Unified Attack Creation API
 * 
 * Handles both ConflictApplications (complex, scheme-based attacks from SchemeSpecificCQsModal)
 * and ClaimEdges (lightweight, suggestion-based attacks from CriticalQuestionsV3).
 * 
 * Automatically:
 * - Computes ASPIC+ metadata
 * - Creates DialogueMove (ATTACK) for provenance
 * - Links to CQStatus via CQAttack table (optional)
 * - Consistent response format
 */

const CreateAttackSchema = z.object({
  deliberationId: z.string().min(6),
  
  // Attack target
  targetType: z.enum(["claim", "argument"]),
  targetId: z.string(),
  
  // Attack source
  attackerType: z.enum(["claim", "argument"]),
  attackerId: z.string(),
  
  // Attack classification
  attackType: z.enum(["REBUTS", "UNDERCUTS", "UNDERMINES"]),
  targetScope: z.enum(["conclusion", "inference", "premise"]).optional(),
  
  // CQ provenance (optional but recommended)
  cqKey: z.string().optional(),
  cqText: z.string().optional(),
  schemeKey: z.string().optional(),
  source: z.string().optional(), // 'scheme-specific-cqs-modal', 'critical-questions-v3', etc.
  
  // Advanced options
  useClaimEdge: z.boolean().optional(), // Force ClaimEdge creation (default: auto-detect)
  createCQAttackLink: z.boolean().optional(), // Create CQAttack linkage (default: true if cqKey provided)
});

type CreateAttackInput = z.infer<typeof CreateAttackSchema>;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });

  const parsed = CreateAttackSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });

  const input = parsed.data;

  // Decide: ConflictApplication or ClaimEdge?
  // Heuristic: Use ClaimEdge if both target and attacker are claims AND useClaimEdge not explicitly false
  const shouldUseClaimEdge = 
    (input.useClaimEdge === true) || 
    (input.useClaimEdge !== false && input.targetType === "claim" && input.attackerType === "claim");

  try {
    if (shouldUseClaimEdge) {
      // Path 1: ClaimEdge (lightweight, CriticalQuestionsV3 pattern)
      return await createClaimEdgeAttack(input, userId.toString());
    } else {
      // Path 2: ConflictApplication (complex, SchemeSpecificCQsModal pattern)
      return await createConflictApplicationAttack(input, userId.toString());
    }
  } catch (error) {
    console.error("[Unified Attack API] Error:", error);
    return NextResponse.json({ 
      error: "Failed to create attack", 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500, ...NO_STORE });
  }
}

/**
 * Create attack via ClaimEdge (lightweight)
 */
async function createClaimEdgeAttack(input: CreateAttackInput, userId: string) {
  if (input.targetType !== "claim" || input.attackerType !== "claim") {
    return NextResponse.json({ 
      error: "ClaimEdge requires both target and attacker to be claims" 
    }, { status: 400, ...NO_STORE });
  }

  // Get suggestion for proper attack typing
  const suggestion = input.schemeKey && input.cqKey 
    ? suggestionForCQ(input.schemeKey, input.cqKey)
    : input.attackType === "UNDERCUTS"
      ? ({ type: "undercut" as const })
      : ({ type: "rebut" as const, scope: (input.targetScope || "conclusion") as "premise" | "conclusion" });

  if (!suggestion) {
    return NextResponse.json({ 
      error: "No suggestion available for this attack type" 
    }, { status: 400, ...NO_STORE });
  }

  // Build metaJson for provenance
  const metaJson = {
    cqKey: input.cqKey,
    cqText: input.cqText,
    schemeKey: input.schemeKey,
    source: input.source || "unified-attack-api-claimedge",
  };

  // Create ClaimEdge
  const edge = await createClaimAttack({
    fromClaimId: input.attackerId,
    toClaimId: input.targetId,
    deliberationId: input.deliberationId,
    suggestion,
    metaJson,
  });

  // Optional: Create CQAttack linkage
  let cqAttackLink = null;
  if (input.cqKey && input.createCQAttackLink !== false) {
    cqAttackLink = await linkToCQStatus(
      input.cqKey,
      input.targetType,
      input.targetId,
      input.schemeKey || "unknown",
      { claimEdgeId: edge.id },
      userId
    );
  }

  // Fire refresh events
  if (global.dispatchEvent) {
    global.dispatchEvent(new CustomEvent("claims:changed"));
    global.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
  }

  return NextResponse.json({
    ok: true,
    attack: {
      id: edge.id,
      type: "ClaimEdge",
      attackType: edge.attackType,
      targetScope: edge.targetScope,
      metaJson: edge.metaJson,
      createdAt: edge.createdAt,
    },
    cqAttackLink: cqAttackLink ? { id: cqAttackLink.id } : null,
  }, NO_STORE);
}

/**
 * Create attack via ConflictApplication (complex)
 */
async function createConflictApplicationAttack(input: CreateAttackInput, userId: string) {
  // Resolve scheme if provided
  const scheme = input.schemeKey
    ? await prisma.conflictScheme.findUnique({ 
        where: { key: input.schemeKey }, 
        select: { id: true, legacyAttackType: true, legacyTargetScope: true } 
      })
    : null;

  // Build metaJson for provenance
  const metaJson = {
    cqKey: input.cqKey,
    cqText: input.cqText,
    schemeKey: input.schemeKey || scheme?.id,
    source: input.source || "unified-attack-api-ca",
  };

  // Compute ASPIC+ metadata
  const aspicMetadata = computeAspicConflictMetadata(
    null,
    {
      attackType: input.attackType as any,
      targetScope: (input.targetScope || scheme?.legacyTargetScope || "premise") as any,
      cqKey: input.cqKey,
      schemeKey: input.schemeKey,
    },
    input.attackerId,
    input.targetId
  );

  // Create ConflictApplication
  const conflictApplication = await prisma.conflictApplication.create({
    data: {
      deliberationId: input.deliberationId,
      ...(scheme?.id ? { schemeId: scheme.id } : {}),
      createdById: String(userId),
      
      // Set conflicting/conflicted based on type
      ...(input.attackerType === "claim" 
        ? { conflictingClaimId: input.attackerId } 
        : { conflictingArgumentId: input.attackerId }),
      ...(input.targetType === "claim" 
        ? { conflictedClaimId: input.targetId } 
        : { conflictedArgumentId: input.targetId }),
      
      // Attack classification
      legacyAttackType: input.attackType,
      legacyTargetScope: input.targetScope || scheme?.legacyTargetScope || null,
      
      // Metadata
      metaJson,
      aspicAttackType: aspicMetadata.aspicAttackType,
      aspicDefeatStatus: aspicMetadata.aspicDefeatStatus,
      aspicMetadata: aspicMetadata.aspicMetadata ?? undefined,
    },
    select: { id: true, createdAt: true },
  });

  // Create ATTACK DialogueMove for provenance
  let attackMove = null;
  try {
    const attackLabels = {
      'REBUTS': 'I challenge this conclusion',
      'UNDERCUTS': 'I challenge the reasoning',
      'UNDERMINES': 'I challenge this premise',
    };
    const expression = attackLabels[input.attackType] || 'I challenge this';
    
    const cqId = input.cqKey || `attack_${conflictApplication.id}`;
    
    const seamResult = await createDialogueMove({
      deliberationId: input.deliberationId,
      targetType: input.targetType as any,
      targetId: input.targetId,
      kind: "ATTACK",
      payload: {
        cqId,
        cqKey: input.cqKey,
        conflictApplicationId: conflictApplication.id,
        attackType: input.attackType,
        expression,
        locusPath: "0",
      },
      actorId: String(userId),
      signature: `ATTACK:${input.targetType}:${input.targetId}:${conflictApplication.id}`,
      locusPath: "0",
    });
    attackMove = seamResult.move;

    // Link DialogueMove back to ConflictApplication
    await prisma.conflictApplication.update({
      where: { id: conflictApplication.id },
      data: { createdByMoveId: attackMove.id },
    });
  } catch (err) {
    console.error("[Unified Attack API] Failed to create ATTACK DialogueMove:", err);
    // Continue - ConflictApplication is still valid
  }

  // Optional: Create CQAttack linkage
  let cqAttackLink = null;
  if (input.cqKey && input.createCQAttackLink !== false) {
    cqAttackLink = await linkToCQStatus(
      input.cqKey,
      input.targetType,
      input.targetId,
      input.schemeKey || "unknown",
      { conflictApplicationId: conflictApplication.id },
      userId
    );
  }

  // Fire refresh events
  if (global.dispatchEvent) {
    global.dispatchEvent(new CustomEvent("claims:changed"));
    global.dispatchEvent(new CustomEvent("arguments:changed"));
    global.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
  }

  // AI-EPI Pt. 4 §8 — record engagement against AI-authored arguments.
  // No-op for human targets and self-engagement (helper handles both).
  if (input.targetType === "argument") {
    void recordAiDraftEngagement({
      argumentId: input.targetId,
      actorAuthId: String(userId),
      kind: "attack",
    });
  }

  return NextResponse.json({
    ok: true,
    attack: {
      id: conflictApplication.id,
      type: "ConflictApplication",
      attackType: input.attackType,
      targetScope: input.targetScope,
      metaJson,
      aspicAttackType: aspicMetadata.aspicAttackType,
      createdAt: conflictApplication.createdAt,
    },
    attackMove: attackMove ? { id: attackMove.id } : null,
    cqAttackLink: cqAttackLink ? { id: cqAttackLink.id } : null,
  }, NO_STORE);
}

/**
 * Create CQAttack linkage record
 */
async function linkToCQStatus(
  cqKey: string,
  targetType: string,
  targetId: string,
  schemeKey: string,
  attack: { conflictApplicationId?: string; claimEdgeId?: string },
  userId: string
) {
  // Find or create CQStatus
  const cqStatus = await prisma.cQStatus.upsert({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: targetType as any,
        targetId,
        schemeKey,
        cqKey,
      },
    },
    update: {},
    create: {
      targetType: targetType as any,
      targetId,
      schemeKey,
      cqKey,
      satisfied: false,
      createdById: String(userId),
    },
    select: { id: true },
  });

  // Create CQAttack linkage
  const cqAttack = await prisma.cQAttack.create({
    data: {
      cqStatusId: cqStatus.id,
      conflictApplicationId: attack.conflictApplicationId || null,
      claimEdgeId: attack.claimEdgeId || null,
      createdById: String(userId),
    },
  });

  return cqAttack;
}
