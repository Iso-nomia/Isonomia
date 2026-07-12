// lib/ncm/executeAsCanonical.ts
import { prisma } from "@/lib/prismaclient";

/**
 * Execute a non-canonical move as a canonical dialogue move
 * Maps NCM moveTypes to dialogue move kinds and creates the move
 */
export async function executeNCMAsCanonical(
  ncm: {
    id: string;
    deliberationId: string;
    targetType: string;
    targetId: string;
    targetMoveId: string | null;
    moveType: string;
    content: any;
    contributorId: string;
  },
  approverId: string
): Promise<string | null> {
  try {
    // Map NCM moveType to dialogue kind
    const moveTypeMap: Record<string, { kind: string; payloadOverride?: any }> = {
      GROUNDS_RESPONSE: {
        kind: "GROUNDS",
        payloadOverride: (content: any) => ({
          expression: content.expression,
          brief: content.brief,
          note: content.note,
          cqId: content.cqId || content.schemeKey || "community_defense",
          schemeKey: content.schemeKey,
          locusPath: content.locusPath || "0",
        }),
      },
      CLARIFICATION_ANSWER: {
        kind: "GROUNDS",
        payloadOverride: (content: any) => ({
          expression: content.expression,
          brief: content.brief,
          cqId: "clarification",
          schemeKey: "clarification",
          locusPath: "0",
        }),
      },
      CHALLENGE_RESPONSE: {
        kind: "GROUNDS",
        payloadOverride: (content: any) => ({
          expression: content.expression,
          brief: content.brief,
          cqId: content.cqId || "challenge",
          schemeKey: content.schemeKey,
          locusPath: content.locusPath || "0",
        }),
      },
      EVIDENCE_ADDITION: {
        kind: "GROUNDS",
        payloadOverride: (content: any) => ({
          expression: content.expression,
          brief: content.brief,
          note: content.note,
          cqId: "evidence",
          schemeKey: "evidence",
          locusPath: "0",
        }),
      },
      PREMISE_DEFENSE: {
        kind: "GROUNDS",
        payloadOverride: (content: any) => ({
          expression: content.expression,
          brief: content.brief,
          cqId: content.cqId || "premise_defense",
          schemeKey: content.schemeKey,
          locusPath: content.locusPath || "0",
        }),
      },
      EXCEPTION_REBUTTAL: {
        kind: "GROUNDS",
        payloadOverride: (content: any) => ({
          expression: content.expression,
          brief: content.brief,
          cqId: "exception_rebuttal",
          schemeKey: content.schemeKey,
          locusPath: "0",
        }),
      },
    };

    const mapping = moveTypeMap[ncm.moveType];
    if (!mapping) {
      console.error(`[executeNCMAsCanonical] Unknown moveType: ${ncm.moveType}`);
      return null;
    }

    // Build payload from NCM content
    const payload =
      typeof mapping.payloadOverride === "function"
        ? mapping.payloadOverride(ncm.content)
        : {
            expression: ncm.content.expression,
            brief: ncm.content.brief,
            note: ncm.content.note,
            ...ncm.content,
          };

    // Create the dialogue move using raw SQL to match existing pattern
    const moveId = crypto.randomUUID();
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO "dialogue_moves" (
        id, "deliberationId", "targetType", "targetId", kind, 
        "actorId", payload, phase, "createdAt", "updatedAt"
      ) VALUES (
        ${moveId},
        ${ncm.deliberationId},
        ${ncm.targetType}::"TargetType",
        ${ncm.targetId},
        ${mapping.kind}::"MoveKind",
        ${ncm.contributorId},
        ${JSON.stringify(payload)}::jsonb,
        'neutral'::"DialoguePhase",
        ${now},
        ${now}
      )
    `;

    // Update CQ status if this is a GROUNDS response
    if (mapping.kind === "GROUNDS" && payload.cqId) {
      try {
        await prisma.cQStatus.updateMany({
          where: {
            targetType: ncm.targetType as any,
            targetId: ncm.targetId,
            cqKey: payload.cqId,
          },
          data: {
            status: "answered",
            satisfied: true,
          },
        });
      } catch (err) {
        console.warn("[executeNCMAsCanonical] Failed to update CQ status:", err);
      }
    }

    console.log(`[executeNCMAsCanonical] Created dialogue move ${moveId} from NCM ${ncm.id}`);
    return moveId;
  } catch (error) {
    console.error("[executeNCMAsCanonical] Error:", error);
    return null;
  }
}

// For Node.js crypto
import crypto from "crypto";
