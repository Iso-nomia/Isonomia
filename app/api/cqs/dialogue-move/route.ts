export const dynamic = "force-dynamic";

/**
 * API endpoint for creating DialogueMoves from Critical Questions with ASPIC+ integration
 * 
 * Phase 1c: CQ → DialogueMove Integration
 * 
 * This endpoint creates DialogueMoves when CQs are asked or answered,
 * enriching them with ASPIC+ attack metadata for formal argumentation semantics.
 * 
 * Flow:
 * 1. Receive CQ action (ask/answer)
 * 2. Fetch CQ and argument metadata
 * 3. Compute ASPIC+ attack using cqToAspicAttack()
 * 4. Create DialogueMove with attack metadata in payload
 * 5. Create ConflictApplication record linked to DialogueMove
 * 6. Return move ID and attack metadata
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { createDialogueMove } from "@/lib/ludics/createDialogueMove";
import { cqToAspicAttack } from "@/lib/aspic/cqMapping";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import type { ArgumentationTheory, Argument } from "@/lib/aspic/types";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

// ============================================================================
// TYPES
// ============================================================================

interface CreateCQDialogueMoveRequest {
  action: "ask" | "answer";
  cqId: string;                    // CQStatus ID
  deliberationId: string;
  authorId: string;
  
  // For "ask" action
  targetArgumentId?: string;
  
  // For "answer" action
  answerText?: string;
  answerClaimId?: string;          // Existing claim used as answer
  createCounterClaim?: boolean;    // Whether to create a new counter-claim
}

interface CQDialogueMoveResponse {
  success: boolean;
  moveId?: string;
  conflictId?: string;
  aspicAttack?: {
    type: string;
    targetScope: string;
    succeeded: boolean;
  };
  reason?: string;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<NextResponse<CQDialogueMoveResponse>> {
  try {
    const body = await req.json().catch(() => ({})) as CreateCQDialogueMoveRequest;
    const { action, cqId, deliberationId, authorId, targetArgumentId, answerText, answerClaimId } = body;

    // Validate required fields
    if (!action || !cqId || !deliberationId || !authorId) {
      return NextResponse.json(
        { success: false, reason: "Missing required fields: action, cqId, deliberationId, authorId" },
        { status: 400, ...NO_STORE }
      );
    }

    // Fetch CQ metadata
    const cqStatus = await prisma.cQStatus.findUnique({
      where: { id: cqId },
    });

    if (!cqStatus) {
      return NextResponse.json(
        { success: false, reason: `CQ not found: ${cqId}` },
        { status: 404, ...NO_STORE }
      );
    }

    // Fetch ArgumentScheme to get aspicMapping
    const scheme = await prisma.argumentScheme.findFirst({
      where: { id: cqStatus.schemeKey },
    });

    if (!scheme) {
      return NextResponse.json(
        { success: false, reason: `ArgumentScheme not found: ${cqStatus.schemeKey}` },
        { status: 404, ...NO_STORE }
      );
    }

    // Route to appropriate handler
    if (action === "ask") {
      return handleAskCQ(cqStatus, scheme, deliberationId, authorId, targetArgumentId);
    } else if (action === "answer") {
      return handleAnswerCQ(cqStatus, scheme, deliberationId, authorId, answerText, answerClaimId);
    } else {
      return NextResponse.json(
        { success: false, reason: `Unknown action: ${action}` },
        { status: 400, ...NO_STORE }
      );
    }
  } catch (error) {
    console.error("[cqs/dialogue-move] Error:", error);
    return NextResponse.json(
      { success: false, reason: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, ...NO_STORE }
      );
  }
}

// ============================================================================
// ASK CQ HANDLER
// ============================================================================

async function handleAskCQ(
  cqStatus: any,
  scheme: any,
  deliberationId: string,
  authorId: string,
  targetArgumentId?: string
): Promise<NextResponse<CQDialogueMoveResponse>> {
  const argId = targetArgumentId || cqStatus.argumentId;

  if (!argId) {
    return NextResponse.json(
      { success: false, reason: "No target argument specified" },
      { status: 400, ...NO_STORE }
    );
  }

  // Fetch full argument structure for ASPIC+ translation
  const argument = await prisma.argument.findUnique({
    where: { id: argId },
    include: {
      scheme: true,
      conclusion: true,
      premises: { include: { claim: true } },
    },
  });

  if (!argument) {
    return NextResponse.json(
      { success: false, reason: `Argument not found: ${argId}` },
      { status: 404, ...NO_STORE }
    );
  }

  // Construct ASPIC+ argument representation
  const targetArgument: Argument = constructAspicArgument(argument);

  // Extract CQ metadata for ASPIC+ mapping
  const cqMetadata = {
    cqKey: cqStatus.cqKey,
    text: cqStatus.cqText || "Critical question",
    attackType: (cqStatus.attackType || "UNDERMINES") as "UNDERMINES" | "UNDERCUTS" | "REBUTS",
    targetScope: (cqStatus.targetScope || "premise") as "premise" | "inference" | "conclusion",
    aspicMapping: typeof scheme.aspicMapping === "object" ? scheme.aspicMapping : undefined,
  };

  // Create minimal theory context (real implementation would fetch from deliberation)
  const theory: ArgumentationTheory = {
    system: {
      language: new Set<string>(),
      contraries: new Map(),
      strictRules: [],
      defeasibleRules: [],
      ruleNames: new Map(),
    },
    knowledgeBase: {
      axioms: new Set<string>(),
      premises: new Set<string>(),
      assumptions: new Set<string>(),
      premisePreferences: [],
      rulePreferences: [],
    },
  };

  // Compute ASPIC+ attack
  const attackResult = cqToAspicAttack(cqMetadata, targetArgument, theory);

  // Create WHY DialogueMove with ASPIC+ metadata via the H1 seam.
  const whySeam = await createDialogueMove({
    deliberationId,
    authorId,
    actorId: authorId,
    type: "WHY",
    illocution: "Question",
    kind: "WHY",
    targetType: "argument",
    targetId: argId,
    signature: `WHY:argument:${argId}:cq_${cqStatus.cqKey}:${Date.now()}`,
    payload: {
      cqId: cqStatus.id,
      cqKey: cqStatus.cqKey,
      cqText: cqMetadata.text,
      locusPath: "0",
      aspicAttack: attackResult.attack ? {
        type: attackResult.attack.type,
        attackerId: attackResult.attack.attacker.id,
        defenderId: attackResult.attack.attacked.id,
        succeeded: attackResult.attack !== null,
      } : null,
      aspicMetadata: {
        attackType: cqMetadata.attackType,
        targetScope: cqMetadata.targetScope,
        reason: attackResult.reason,
      },
    },
    endsWithDaimon: false,
    locusPath: "0",
  });
  const move = whySeam.move;

  // Update CQStatus to "open"
  await prisma.cQStatus.update({
    where: { id: cqStatus.id },
    data: { status: "open" },
  });

  return NextResponse.json(
    {
      success: true,
      moveId: move.id,
      aspicAttack: attackResult.attack ? {
        type: attackResult.attack.type,
        targetScope: cqMetadata.targetScope,
        succeeded: attackResult.attack !== null,
      } : undefined,
    },
    NO_STORE
  );
}

// ============================================================================
// ANSWER CQ HANDLER
// ============================================================================

async function handleAnswerCQ(
  cqStatus: any,
  scheme: any,
  deliberationId: string,
  authorId: string,
  answerText?: string,
  answerClaimId?: string
): Promise<NextResponse<CQDialogueMoveResponse>> {
  const argId = cqStatus.argumentId;

  if (!argId) {
    return NextResponse.json(
      { success: false, reason: "No target argument in CQ" },
      { status: 400, ...NO_STORE }
    );
  }

  // Fetch target argument
  const argument = await prisma.argument.findUnique({
    where: { id: argId },
    include: {
      scheme: true,
      conclusion: true,
      premises: { include: { claim: true } },
    },
  });

  if (!argument) {
    return NextResponse.json(
      { success: false, reason: `Argument not found: ${argId}` },
      { status: 404, ...NO_STORE }
    );
  }

  // Get or create counter-claim
  let conflictingClaimId = answerClaimId;
  
  if (!conflictingClaimId && answerText) {
    // Create new claim as answer
    const moid = mintClaimMoid(answerText);
    const claim = await prisma.claim.create({
      data: {
        deliberationId,
        createdById: authorId,
        text: answerText,
        moid,
      },
    });
    conflictingClaimId = claim.id;
  }

  if (!conflictingClaimId) {
    return NextResponse.json(
      { success: false, reason: "No answer claim provided or created" },
      { status: 400, ...NO_STORE }
    );
  }

  // Construct ASPIC+ argument
  const targetArgument: Argument = constructAspicArgument(argument);

  // Extract CQ metadata
  const cqMetadata = {
    cqKey: cqStatus.cqKey,
    text: cqStatus.cqText || "Critical question",
    attackType: (cqStatus.attackType || "UNDERMINES") as "UNDERMINES" | "UNDERCUTS" | "REBUTS",
    targetScope: (cqStatus.targetScope || "premise") as "premise" | "inference" | "conclusion",
    aspicMapping: typeof scheme.aspicMapping === "object" ? scheme.aspicMapping : undefined,
  };

  // Create minimal theory
  const theory: ArgumentationTheory = {
    system: {
      language: new Set<string>(),
      contraries: new Map(),
      strictRules: [],
      defeasibleRules: [],
      ruleNames: new Map(),
    },
    knowledgeBase: {
      axioms: new Set<string>(),
      premises: new Set<string>(),
      assumptions: new Set<string>(),
      premisePreferences: [],
      rulePreferences: [],
    },
  };

  // Compute ASPIC+ attack
  const attackResult = cqToAspicAttack(cqMetadata, targetArgument, theory);

  // Create ATTACK DialogueMove via the H1 seam.
  const attackSeam = await createDialogueMove({
    deliberationId,
    authorId,
    actorId: authorId,
    type: "ATTACK",
    illocution: "Argue",
    kind: "ATTACK",
    targetType: "argument",
    targetId: argId,
    signature: `ATTACK:argument:${argId}:cq_${cqStatus.cqKey}:${Date.now()}`,
    payload: {
      cqId: cqStatus.id,
      cqKey: cqStatus.cqKey,
      cqText: cqMetadata.text,
      conflictingClaimId,
      locusPath: "0",
      aspicAttack: attackResult.attack ? {
        type: attackResult.attack.type,
        attackerId: attackResult.attack.attacker.id,
        defenderId: attackResult.attack.attacked.id,
        succeeded: attackResult.attack !== null,
      } : null,
      aspicMetadata: {
        attackType: cqMetadata.attackType,
        targetScope: cqMetadata.targetScope,
        reason: attackResult.reason,
      },
    },
    endsWithDaimon: false,
    locusPath: "0",
  });
  const move = attackSeam.move;

  // Create ConflictApplication record linked to DialogueMove
  const conclusionId = argument.conclusion?.id;
  
  // Determine if attack succeeded as defeat (simplified - real implementation would check preferences)
  const aspicDefeatStatus = attackResult.attack !== null;
  
  const conflict = await (prisma as any).conflictApplication.create({
    data: {
      deliberationId,
      createdById: authorId,
      createdByMoveId: move.id,
      conflictingClaimId,
      conflictedArgumentId: cqMetadata.attackType === "UNDERCUTS" ? argId : undefined,
      conflictedClaimId: cqMetadata.attackType === "REBUTS" && conclusionId ? conclusionId : undefined,
      legacyAttackType: cqMetadata.attackType,
      legacyTargetScope: cqMetadata.targetScope,
      
      // ASPIC+ Integration - Phase 1d
      aspicAttackType: attackResult.attack ? attackResult.attack.type.toLowerCase() : null,
      aspicDefeatStatus,
      aspicMetadata: attackResult.attack ? {
        attackerId: attackResult.attack.attacker.id,
        defenderId: attackResult.attack.attacked.id,
        attackType: attackResult.attack.type,
        targetScope: cqMetadata.targetScope,
        cqKey: cqStatus.cqKey,
        cqText: cqMetadata.text,
        aspicMapping: cqMetadata.aspicMapping,
        computationReason: attackResult.reason,
        defeatStatus: aspicDefeatStatus,
        timestamp: new Date().toISOString(),
      } : null,
      
      metaJson: {
        schemeKey: scheme.key,
        cqKey: cqStatus.cqKey,
        cqText: cqMetadata.text,
        aspicAttack: attackResult.attack ? {
          type: attackResult.attack.type,
          attackerId: attackResult.attack.attacker.id,
          defenderId: attackResult.attack.attacked.id,
        } : null,
        source: "cqs-dialogue-move-api",
      },
    },
  });

  // Update CQStatus to "answered"
  await prisma.cQStatus.update({
    where: { id: cqStatus.id },
    data: { 
      status: "answered",
      satisfied: true,
    },
  });

  return NextResponse.json(
    {
      success: true,
      moveId: move.id,
      conflictId: conflict.id,
      aspicAttack: attackResult.attack ? {
        type: attackResult.attack.type,
        targetScope: cqMetadata.targetScope,
        succeeded: attackResult.attack !== null,
      } : undefined,
    },
    NO_STORE
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert database Argument to ASPIC+ Argument structure
 */
function constructAspicArgument(arg: any): Argument {
  const premises = arg.premises?.map((p: any) => p.claim?.text || "") || [];
  const conclusion = arg.conclusion?.text || "";
  
  return {
    id: arg.id,
    premises: new Set(premises),
    conclusion,
    subArguments: [],
    defeasibleRules: new Set<string>(),
    structure: {
      type: "inference",
      rule: {
        id: arg.scheme?.id || "default-rule",
        antecedents: premises,
        consequent: conclusion,
        type: "defeasible",
      },
      subArguments: premises.map((p: string) => ({
        type: "premise" as const,
        formula: p,
        source: "premise" as const,
      })),
      conclusion,
    },
  };
}

/**
 * GET endpoint for documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cqs/dialogue-move",
    description: "Create DialogueMoves from Critical Questions with ASPIC+ integration",
    methods: {
      POST: {
        description: "Create a DialogueMove when a CQ is asked or answered",
        body: {
          action: "'ask' | 'answer'",
          cqId: "string (CQStatus ID)",
          deliberationId: "string",
          authorId: "string",
          targetArgumentId: "string (optional, for 'ask')",
          answerText: "string (optional, for 'answer')",
          answerClaimId: "string (optional, for 'answer')",
        },
        responses: {
          success: "{ success: true, moveId: string, conflictId?: string, aspicAttack?: {...} }",
          error: "{ success: false, reason: string }",
        },
      },
    },
    integration: {
      phase: "1c",
      description: "Bridges CQ system to DialogueMove system with ASPIC+ semantics",
      features: [
        "WHY moves created when CQs are asked",
        "ATTACK moves created when CQs are answered",
        "ASPIC+ attack metadata stored in payload",
        "ConflictApplication records linked to DialogueMoves",
        "Full provenance chain: CQ → DialogueMove → ASPIC+ → ConflictApplication",
      ],
    },
  });
}
