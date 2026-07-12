export const dynamic = "force-dynamic";

// app/api/ludics/designs/semantic/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

/**
 * POST /api/ludics/designs/semantic/batch
 * Returns semantic enrichment for multiple designs in a single request.
 * Body: { designIds: string[] }
 * 
 * This endpoint optimizes the N+1 query problem when displaying multiple
 * designs in LudicsForest by fetching all semantic data in one go.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { designIds } = body;

    if (!designIds || !Array.isArray(designIds) || designIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "designIds array is required" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    const MAX_BATCH_SIZE = 50;
    const limitedIds = designIds.slice(0, MAX_BATCH_SIZE);

    // Fetch all designs with acts in one query
    const designs: any[] = await prisma.ludicDesign.findMany({
      where: { id: { in: limitedIds } },
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

    if (designs.length === 0) {
      return NextResponse.json({
        ok: true,
        designs: {},
        count: 0
      });
    }

    // Extract all move IDs from all acts across all designs
    const allMoveIds: string[] = [];
    for (const design of designs) {
      for (const act of design.acts) {
        const meta = (act.metaJson || act.extJson) as any;
        if (meta?.moveId) {
          allMoveIds.push(meta.moveId);
        }
      }
    }

    // Fetch all dialogue moves in one query
    const moves = await prisma.dialogueMove.findMany({
      where: { id: { in: allMoveIds } },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        kind: true,
      }
    });

    const moveMap = new Map(moves.map(m => [m.id, m]));

    // Collect all target entity IDs
    const claimIds = new Set<string>();
    const argumentIds = new Set<string>();

    for (const move of moves) {
      if (move.targetType === "claim" && move.targetId) {
        claimIds.add(move.targetId);
      } else if (move.targetType === "argument" && move.targetId) {
        argumentIds.add(move.targetId);
      }
    }

    // Fetch all claims in one query
    const claims = await prisma.claim.findMany({
      where: { id: { in: Array.from(claimIds) } },
      select: {
        id: true,
        text: true,
        moid: true,
      }
    });

    const claimMap = new Map(claims.map(c => [c.id, c]));

    // Fetch all arguments with scheme details in one query
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

    // Build enriched data for each design
    const enrichedDesigns: Record<string, any> = {};

    for (const design of designs) {
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

      enrichedDesigns[design.id] = {
        id: design.id,
        deliberationId: design.deliberationId,
        participantId: design.participantId,
        scope: design.scope,
        scopeType: design.scopeType,
        semantics: design.semantics,
        version: design.version,
        acts: enrichedActs,
      };
    }

    return NextResponse.json({
      ok: true,
      designs: enrichedDesigns,
      count: Object.keys(enrichedDesigns).length
    });

  } catch (error: any) {
    console.error("[ludics/designs/semantic/batch] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
