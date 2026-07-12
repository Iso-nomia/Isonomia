export const dynamic = "force-dynamic";

// app/api/ludics/designs/[id]/semantic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * GET /api/ludics/designs/[id]/semantic
 * Returns a design with semantic annotations for each act
 * - claim text for claim-based acts
 * - argument scheme + premises + conclusion for argument-based acts
 * 
 * NOTE: This is a simplified version that matches acts to dialogue moves
 * via act metadata (extJson) since AifNode->LudicAct relation may not be populated
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const designId = params.id;

    // Fetch design with acts
    const design: any = await prisma.ludicDesign.findUnique({
      where: { id: designId },
      include: {
        acts: {
          include: {
            locus: {
              select: { path: true }
            }
          },
          orderBy: { orderInDesign: "asc" }
        }
      }
    });

    if (!design) {
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Extract move IDs from act metadata (stored in metaJson or extJson during compilation)
    const moveIds: string[] = [];
    for (const act of design.acts) {
      const meta = (act.metaJson || act.extJson) as any;
      if (meta?.moveId) {
        moveIds.push(meta.moveId);
      }
    }

    // Fetch dialogue moves
    const moves = await prisma.dialogueMove.findMany({
      where: { id: { in: moveIds } },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        kind: true,
      }
    });

    const moveMap = new Map(moves.map(m => [m.id, m]));

    // Fetch all target entities (claims and arguments)
    const claimIds = new Set<string>();
    const argumentIds = new Set<string>();

    for (const move of moves) {
      if (move.targetType === "claim" && move.targetId) {
        claimIds.add(move.targetId);
      } else if (move.targetType === "argument" && move.targetId) {
        argumentIds.add(move.targetId);
      }
    }

    // Fetch claims
    const claims = await prisma.claim.findMany({
      where: { id: { in: Array.from(claimIds) } },
      select: {
        id: true,
        text: true,
        moid: true,
      }
    });

    const claimMap = new Map(claims.map(c => [c.id, c]));

    // Fetch arguments with scheme details
    const argumentsData = await prisma.argument.findMany({
      where: { id: { in: Array.from(argumentIds) } },
      include: {
        scheme: {
          select: {
            id: true,
            key: true,
            name: true,
            purpose: true,
            materialRelation: true,
          }
        },
        premises: {
          include: {
            claim: {
              select: {
                id: true,
                text: true,
              }
            }
          }
        },
        conclusion: {
          select: {
            id: true,
            text: true,
          }
        }
      }
    });

    const argumentMap = new Map(argumentsData.map(a => [a.id, a]));

    // Build enriched acts with semantic annotations
    const enrichedActs = design.acts.map((act: any) => {
      const baseAct = {
        id: act.id,
        kind: act.kind,
        polarity: act.polarity,
        expression: act.expression,
        locusPath: act.locus?.path ?? "0",
        isAdditive: act.isAdditive,
        ramification: act.ramification,
      };

      // Get moveId from metadata
      const meta = (act.metaJson || act.extJson) as any;
      const moveId = meta?.moveId;
      
      if (!moveId) {
        return { ...baseAct, semantic: null };
      }

      const move = moveMap.get(moveId);
      if (!move || !move.targetId) {
        return { ...baseAct, semantic: null };
      }

      // Claim-based annotation
      if (move.targetType === "claim") {
        const claim = claimMap.get(move.targetId);
        if (claim) {
          return {
            ...baseAct,
            semantic: {
              type: "claim" as const,
              claimId: claim.id,
              text: claim.text,
              moid: claim.moid,
            }
          };
        }
      }

      // Argument-based annotation
      if (move.targetType === "argument") {
        const argument = argumentMap.get(move.targetId);
        if (argument) {
          return {
            ...baseAct,
            semantic: {
              type: "argument" as const,
              argumentId: argument.id,
              scheme: {
                key: argument.scheme?.key,
                name: argument.scheme?.name,
                purpose: argument.scheme?.purpose,
                materialRelation: argument.scheme?.materialRelation,
              },
              premises: argument.premises.map(p => ({
                claimId: p.claim?.id,
                text: p.claim?.text,
              })),
              conclusion: {
                claimId: argument.conclusion?.id,
                text: argument.conclusion?.text,
              }
            }
          };
        }
      }

      return { ...baseAct, semantic: null };
    });

    return NextResponse.json({
      ok: true,
      design: {
        id: design.id,
        deliberationId: design.deliberationId,
        participantId: design.participantId,
        scope: design.scope,
        scopeType: design.scopeType,
        semantics: design.semantics,
        version: design.version,
        acts: enrichedActs,
      }
    });

  } catch (error: any) {
    console.error("[ludics/designs/semantic] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
