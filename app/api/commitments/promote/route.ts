export const dynamic = "force-dynamic";

/**
 * POST /api/commitments/promote
 * 
 * Promotes a dialogue commitment to the Ludics commitment system.
 * Creates a LudicCommitmentElement and a CommitmentLudicMapping linking the two.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { applyToCS } from "@/packages/ludics-engine/commitments";
import { emitBus } from "@/lib/server/bus";
import { bindParticipantToDesign, BindError } from "@/server/ludics/bindParticipantToDesign";
import { canonicalizeClaimText } from "@/lib/ids/mintMoid";
import type { PromoteCommitmentRequest, PromoteCommitmentResponse } from "@/lib/aif/commitment-ludics-types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authentication check
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body: PromoteCommitmentRequest & { ludicMoveId?: string; dialogueMoveId?: string; schemeKey?: string } = await request.json();
    const {
      deliberationId,
      participantId,
      proposition,
      targetOwnerId,
      targetLocusPath,
      basePolarity,
      ludicMoveId,
      dialogueMoveId,
      schemeKey,
    } = body;

    if (!deliberationId || !participantId || !proposition || !targetOwnerId || !basePolarity) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (basePolarity !== "pos" && basePolarity !== "neg") {
      return NextResponse.json(
        { ok: false, error: "basePolarity must be 'pos' or 'neg'" },
        { status: 400 }
      );
    }

    // 3. Verify deliberation exists and user has access
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, roomId: true },
    });

    if (!deliberation) {
      return NextResponse.json(
        { ok: false, error: "Deliberation not found" },
        { status: 404 }
      );
    }

    // Check room membership if deliberation has a room
    if (deliberation.roomId) {
      // @ts-ignore - roomMember exists but types not yet refreshed
      const roomMember = await prisma.roomMember.findFirst({
        where: {
          roomId: deliberation.roomId,
          userId: userId,
        },
      });

      if (!roomMember) {
        return NextResponse.json(
          { ok: false, error: "Access denied to this deliberation" },
          { status: 403 }
        );
      }
    }

    // 4. Verify commitment exists in dialogue system (or create it)
    let commitment = await prisma.commitment.findFirst({
      where: {
        deliberationId,
        participantId,
        proposition,
        isRetracted: false,
      },
    });

    // If commitment doesn't exist, create it (enables direct ludics → dialogue flow)
    if (!commitment) {
      console.log(`[promote] Creating new Commitment record for participant ${participantId}`);
      commitment = await prisma.commitment.create({
        data: {
          deliberationId,
          participantId,
          proposition,
          isRetracted: false,
        },
      });
    }

    // Generate a stable dialogueCommitmentId (use actual Commitment.id if available)
    const dialogueCommitmentId = commitment.id;

    // 5. Check if already promoted
    // @ts-ignore - commitmentLudicMapping exists but types not yet refreshed
    const existingMapping = await prisma.commitmentLudicMapping.findFirst({
      where: {
        dialogueCommitmentId,
      },
      include: {
        ludicCommitmentElement: true,
      },
    });

    if (existingMapping) {
      // Already promoted - return existing mapping
      console.log(`[promote] Commitment already promoted: ${dialogueCommitmentId}`);
      
      return NextResponse.json({
        ok: true,
        mapping: existingMapping,
      } as PromoteCommitmentResponse);
    }

    // 6. Create ludic commitment element using applyToCS
    const locusPath = targetLocusPath || "0"; // Default to root locus
    
    const { added } = await applyToCS(deliberationId, targetOwnerId, {
      add: [
        {
          label: proposition,
          basePolarity,
          baseLocusPath: locusPath,
          entitled: true, // New commitments are entitled by default
        },
      ],
    });

    if (!added || added.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Failed to create ludic commitment" },
        { status: 500 }
      );
    }

    const ludicCommitmentElementId = added[0];

    // 7. Get the created ludic element details
    const ludicElement = await prisma.ludicCommitmentElement.findUnique({
      where: { id: ludicCommitmentElementId },
    });

    if (!ludicElement) {
      return NextResponse.json(
        { ok: false, error: "Ludic element not found after creation" },
        { status: 500 }
      );
    }

    // 8. Create mapping record
    // @ts-ignore - commitmentLudicMapping exists but types not yet refreshed
    const mapping = await prisma.commitmentLudicMapping.create({
      data: {
        dialogueCommitmentId,
        deliberationId,
        participantId,
        proposition,
        ludicCommitmentElementId,
        ludicOwnerId: targetOwnerId,
        ludicLocusId: ludicElement.baseLocusId,
        promotedBy: String(userId),
        promotionContext: {
          sourcePanel: "API",
          timestamp: new Date().toISOString(),
        },
      },
      include: {
        ludicCommitmentElement: true,
      },
    });

    // 9. Fire write seam if a ludicMoveId was provided (routes through I1–I4 invariant checks)
    if (ludicMoveId && dialogueMoveId) {
      try {
        await bindParticipantToDesign({
          dialogueMoveId,
          ludicMoveId,
          participantId,
          canonicalText: canonicalizeClaimText(proposition),
          schemeKey,
        });
      } catch (err) {
        if (err instanceof BindError) {
          // Degrade gracefully — promotion succeeded; log the witness failure
          console.warn(`[promote] bind_participant_to_design skipped: ${err.code} — ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    // 10. Emit refresh events
    emitBus("dialogue:cs:refresh", { 
      deliberationId, 
      participantId 
    });

    // 10. Return success response
    const responseTime = Date.now() - startTime;
    console.log(`[promote] Successfully promoted commitment in ${responseTime}ms`);
    console.log(`  Dialogue: ${dialogueCommitmentId}`);
    console.log(`  Ludics: ${ludicCommitmentElementId}`);
    console.log(`  Owner: ${targetOwnerId}, Polarity: ${basePolarity}`);

    return NextResponse.json(
      {
        ok: true,
        mapping,
      } as PromoteCommitmentResponse,
      {
        headers: {
          "X-Response-Time": `${responseTime}ms`,
        },
      }
    );

  } catch (error) {
    console.error("[promote] Error promoting commitment:", error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : "Internal server error" 
      },
      { status: 500 }
    );
  }
}
