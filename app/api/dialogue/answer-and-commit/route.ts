export const dynamic = "force-dynamic";

// app/api/dialogue/answer-and-commit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { createDialogueMove } from "@/lib/ludics/createDialogueMove";
import { applyToCS } from "@/packages/ludics-engine/commitments";
import { getCurrentUserId } from "@/lib/serverutils";
import { Prisma } from "@prisma/client";
import { onDialogueMoveForObligations } from "@/lib/schemes/protocol/dialogueHooks";
import { emitBus } from "@/lib/server/bus";

/**
 * Create an AIF Argument node from a GROUNDS response.
 * This makes GROUNDS a first-class argument that can be attacked/defended.
 * 
 * Enhanced to include:
 * - ArgumentPremise: Links target claim as a premise of the GROUNDS argument
 * - ArgumentSupport: Formally records that this argument supports the target claim
 */
async function createArgumentFromGrounds(payload: {
  deliberationId: string;
  targetClaimId: string;
  authorId: string;
  groundsText: string;
  cqId: string;
  schemeKey?: string;
}): Promise<string | null> {
  try {
    // Look up scheme ID if schemeKey is provided
    let schemeId: string | null = null;
    if (payload.schemeKey) {
      const schemeRow = await prisma.argumentScheme.findFirst({
        where: { key: payload.schemeKey },
        select: { id: true }
      });
      schemeId = schemeRow?.id ?? null;
    }

    // Create argument node
    const arg = await prisma.argument.create({
      data: {
        deliberationId: payload.deliberationId,
        authorId: payload.authorId,
        text: payload.groundsText,
        conclusionClaimId: payload.targetClaimId,
        schemeId,
        mediaType: "text",
      }
    });

    // Create ArgumentPremise: The target claim is referenced as a premise
    // This allows the GROUNDS argument to be attacked on its premise
    try {
      await prisma.argumentPremise.create({
        data: {
          argumentId: arg.id,
          claimId: payload.targetClaimId,
          isImplicit: false,
          isAxiom: false,
          groupKey: null,
        }
      });
      console.log("[answer-and-commit] Created ArgumentPremise linking target claim as premise");
    } catch (premiseError) {
      console.error("[answer-and-commit] Failed to create ArgumentPremise:", premiseError);
      // Non-fatal - argument still exists
    }

    // Create ArgumentSupport: Formally record that this argument supports the target claim
    // This is used in evidential reasoning and ASPIC+ evaluation
    try {
      await prisma.argumentSupport.upsert({
        where: {
          arg_support_unique: {
            claimId: payload.targetClaimId,
            argumentId: arg.id,
            mode: "product",
          }
        },
        create: {
          deliberationId: payload.deliberationId,
          claimId: payload.targetClaimId,
          argumentId: arg.id,
          mode: "product",
          strength: 0.7, // Default confidence for GROUNDS arguments
          composed: false,
          rationale: `GROUNDS response to ${payload.cqId}`,
          base: 0.7,
        },
        update: {
          strength: 0.7,
          rationale: `GROUNDS response to ${payload.cqId}`,
        }
      });
      console.log("[answer-and-commit] Created/updated ArgumentSupport");
    } catch (supportError) {
      console.error("[answer-and-commit] Failed to create ArgumentSupport:", supportError);
      // Non-fatal - argument still exists
    }

    console.log("[answer-and-commit] Created argument from GROUNDS:", {
      argId: arg.id,
      cqId: payload.cqId,
      schemeKey: payload.schemeKey,
      hasPremise: true,
      hasSupport: true,
    });

    return arg.id;
  } catch (e) {
    console.error("[answer-and-commit] Failed to create argument from GROUNDS:", e);
    return null;
  }
}

const Body = z.object({
  deliberationId: z.string().min(5),
  targetType: z.enum(["argument", "claim", "card"]),
  targetId: z.string().min(5),
  cqKey: z.string().min(1).default("default"),
  locusPath: z.string().min(1).default("0"),
  expression: z.string().min(1), // canonical label or rule
  original: z.string().optional().nullable(), // optional NL text
  commitOwner: z.enum(["Proponent", "Opponent"]),
  commitPolarity: z.enum(["pos", "neg"]).default("pos"),
  // Phase 3d (dialogue-UI polish): optional evidence references that
  // get forwarded into the dialogue-move payload so the obligation
  // hook persists them on the CqObligationRecord.
  evidenceRefs: z.array(z.string().min(1)).optional(),
});

const makeSignature = (
  targetType: string,
  targetId: string,
  cqKey: string,
  locusPath: string,
  expression: string
) =>
  [
    "GROUNDS",
    targetType,
    targetId,
    cqKey,
    locusPath,
    String(expression).slice(0, 64),
  ].join(":");

export async function POST(req: NextRequest) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      deliberationId,
      targetType,
      targetId,
      cqKey,
      locusPath,
      expression,
      original,
      commitOwner,
      commitPolarity,
      evidenceRefs,
    } = parsed.data;

    // Phase 3d (dialogue-UI polish) — when the targeted CQ is flagged
    // `requiresEvidence`, GROUNDS via answer-and-commit must carry at
    // least one evidence ref. We resolve the CriticalQuestion by
    // (schemeKey, cqKey); answer-and-commit does not currently know
    // the schemeKey so we fall back to cqKey alone (the field is
    // unique within a scheme, not globally — see schema). If
    // ambiguous, we skip the guard rather than block legitimate
    // submissions.
    try {
      // Look up CQ by id first (cqKey from the modal is often a CQ.id
      // when the WHY came from the legal-moves API).
      const cqById = await prisma.criticalQuestion.findUnique({
        where: { id: cqKey },
        select: { requiresEvidence: true },
      }).catch(() => null);
      const requiresEvidence = !!cqById?.requiresEvidence;
      if (requiresEvidence) {
        const refs = (evidenceRefs ?? []).filter(
          (x) => typeof x === "string" && x.trim().length > 0
        );
        if (refs.length === 0) {
          return NextResponse.json(
            {
              ok: false,
              error: "EVIDENCE_REQUIRED",
              hint: "This critical question requires at least one evidence reference (evidenceRefs: string[]).",
              cqId: cqKey,
            },
            { status: 400 }
          );
        }
      }
    } catch (err) {
      console.warn("[answer-and-commit] requiresEvidence lookup failed (non-fatal):", err);
    }

    // Validate target exists and matches deliberation
    try {
      if (targetType === "argument") {
        const target = await prisma.argument.findFirst({
          where: { id: targetId, deliberationId },
          select: { id: true },
        });
        if (!target) {
          return NextResponse.json(
            { ok: false, error: "Argument not found or does not match deliberation" },
            { status: 404 }
          );
        }
      } else if (targetType === "claim") {
        const target = await prisma.claim.findFirst({
          where: { id: targetId, deliberationId },
          select: { id: true },
        });
        if (!target) {
          return NextResponse.json(
            { ok: false, error: "Claim not found or does not match deliberation" },
            { status: 404 }
          );
        }
      }
    } catch (err) {
      console.error("[answer-and-commit] Target validation error:", err);
      return NextResponse.json(
        { ok: false, error: "Failed to validate target" },
        { status: 500 }
      );
    }

    const userId = await getCurrentUserId().catch(() => null);
    const actorId = String(userId ?? "unknown");

    // 1) Create Argument from GROUNDS if target is a claim
    let createdArgumentId: string | null = null;
    if (targetType === "claim" && expression.trim().length > 5) {
      try {
        createdArgumentId = await createArgumentFromGrounds({
          deliberationId,
          targetClaimId: targetId,
          authorId: actorId,
          groundsText: expression,
          cqId: cqKey,
          schemeKey: undefined, // answer-and-commit doesn't have scheme context
        });
      } catch (err) {
        console.error("[answer-and-commit] Failed to create Argument from GROUNDS:", err);
        // Non-fatal - continue with move creation
      }
    }

    // 2) Answer the WHY with GROUNDS move
    const payload: Record<string, any> = {
      expression,
      cqId: cqKey,
      locusPath,
      original: original ?? expression,
      createdArgumentId, // Store reference to created Argument
    };
    if (evidenceRefs && evidenceRefs.length > 0) {
      payload.evidenceRefs = evidenceRefs.filter(
        (x) => typeof x === "string" && x.trim().length > 0
      );
    }
    const signature = makeSignature(
      targetType,
      targetId,
      cqKey,
      locusPath,
      expression
    );

    // Extract argumentId for GROUNDS moves
    const argumentIdForGrounds = (createdArgumentId && targetType === "claim") 
      ? createdArgumentId 
      : undefined;

    let move: any;
    try {
      const seamResult = await createDialogueMove({
        deliberationId,
        targetType,
        targetId,
        kind: "GROUNDS",
        payload,
        actorId,
        signature,
        argumentId: argumentIdForGrounds,
        locusPath: typeof (payload as any)?.locusPath === "string"
          ? (payload as any).locusPath
          : null,
      });
      move = seamResult.move;
      if (seamResult.deduplicated) {
        console.log(
          "[answer-and-commit] Duplicate GROUNDS move detected, returning existing",
        );
      } else {
        console.log("[answer-and-commit] Created GROUNDS move:", {
          moveId: move.id,
          argumentId: argumentIdForGrounds,
          targetType,
          targetId,
        });
      }
    } catch (e: any) {
      console.error("[answer-and-commit] Failed to create GROUNDS move:", e);
      throw e;
    }

    // 3) Link Argument back to GROUNDS move (bidirectional provenance)
    if (move && createdArgumentId) {
      try {
        await prisma.argument.update({
          where: { id: createdArgumentId },
          data: { createdByMoveId: move.id },
        });
        console.log("[answer-and-commit] Linked Argument to GROUNDS move:", {
          argumentId: createdArgumentId,
          moveId: move.id,
        });
      } catch (err) {
        console.error("[answer-and-commit] Failed to link Argument back to move:", err);
        // Non-fatal
      }
    }

    // 4) Commit the same assertion to the chosen owner's CS
    try {
      await applyToCS(deliberationId, commitOwner, {
        add: [
          {
            label: expression,
            basePolarity: commitPolarity,
            baseLocusPath: locusPath,
            entitled: true,
          },
        ],
      });
    } catch (err) {
      console.error(
        "[answer-and-commit] Failed to apply to commitment store:",
        err
      );
      return NextResponse.json(
        { ok: false, error: "Failed to update commitment store" },
        { status: 500 }
      );
    }

    // 5) Emit bus events to trigger UI refresh
    try {
      emitBus("dialogue:moves:refresh", { deliberationId, moveId: move.id, kind: "GROUNDS" });
      emitBus("dialogue:cs:refresh", { deliberationId, participantId: commitOwner });
    } catch (err) {
      console.error("[answer-and-commit] Failed to emit bus events:", err);
      // Non-fatal, continue
    }

    // Phase 3d (dialogue-UI polish) — record CQ-obligation transition
    // for the GROUNDS move (matches the equivalent hook call in
    // /api/dialogue/move). Non-fatal: the hook swallows its own errors.
    if (move?.id) {
      void onDialogueMoveForObligations({
        kind: "GROUNDS",
        payload: payload as any,
        moveId: move.id,
      });
    }

    return NextResponse.json({ ok: true, move, commitOwner, expression });
  } catch (err) {
    console.error("[answer-and-commit] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
