export const dynamic = "force-dynamic";

/**
 * DDS Chronicles API - Main Entry Point
 * GET/POST /api/ludics/dds/chronicles
 * 
 * Fetches and computes chronicles for a design.
 * 
 * Note: The LudicChronicle model stores individual acts in order.
 * A chronicle is reconstructed by grouping acts by designId and ordering by `order`.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { extractChronicles } from "@/packages/ludics-core/dds";
import type { Dispute } from "@/packages/ludics-core/dds/types";

// API response type for chronicle (matches frontend expectations)
type ApiChronicle = {
  id: string;
  designId: string;
  sequence: Array<{
    focus: string;
    polarity: string;
    ramification: number[];
    actId?: string;
    order?: number;
  }>;
  length: number;
  isMaximal: boolean;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");
    const deliberationId = url.searchParams.get("deliberationId");

    if (!designId && !deliberationId) {
      return NextResponse.json(
        { ok: false, error: "designId or deliberationId query param required" },
        { status: 400 }
      );
    }

    // Build where clause for design filtering
    let designFilter: any = {};
    if (deliberationId) {
      // Get all designs for this deliberation
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId },
        select: { id: true },
      });
      designFilter = { designId: { in: designs.map(d => d.id) } };
    } else {
      designFilter = { designId };
    }

    // Fetch existing chronicle entries from database (ordered by `order` field)
    const chronicleEntries = await prisma.ludicChronicle.findMany({
      where: designFilter,
      orderBy: { order: "asc" },
      include: { 
        act: {
          include: { locus: true }
        }
      },
    });

    // Group entries into a single chronicle sequence
    if (chronicleEntries.length > 0) {
      const sequence = chronicleEntries.map((entry) => ({
        focus: entry.act?.locus?.path || "0",
        polarity: entry.act?.polarity || "P",
        ramification: [],
        actId: entry.actId,
        order: entry.order,
      }));

      const chronicle: ApiChronicle = {
        id: `chronicle-${designId || deliberationId}`,
        designId: chronicleEntries[0]?.designId || "",
        sequence,
        length: sequence.length,
        isMaximal: true, // Assume maximal since we have all entries
      };

      return NextResponse.json({
        ok: true,
        chronicles: [chronicle],
        count: 1,
      });
    }

    // No chronicles found
    return NextResponse.json({
      ok: true,
      chronicles: [],
      count: 0,
    });
  } catch (error: any) {
    console.error("[DDS Chronicles GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { designId, deliberationId, forceRecompute } = await req.json();

    if (!designId && !deliberationId) {
      return NextResponse.json(
        { ok: false, error: "designId or deliberationId is required" },
        { status: 400 }
      );
    }

    // Get all design IDs to process
    let designIds: string[] = [];
    if (deliberationId) {
      const designs = await prisma.ludicDesign.findMany({
        where: { deliberationId },
        select: { id: true },
      });
      designIds = designs.map(d => d.id);
    } else if (designId) {
      designIds = [designId];
    }

    if (designIds.length === 0) {
      return NextResponse.json({
        ok: true,
        chronicles: [],
        count: 0,
        message: "No designs found",
      });
    }

    // Check for cached chronicles if not forcing recompute
    if (!forceRecompute) {
      const existingEntries = await prisma.ludicChronicle.findMany({
        where: { designId: { in: designIds } },
        orderBy: { order: "asc" },
        include: { 
          act: {
            include: { locus: true }
          }
        },
      });

      if (existingEntries.length > 0) {
        // Group by designId
        const byDesign = new Map<string, typeof existingEntries>();
        for (const entry of existingEntries) {
          const arr = byDesign.get(entry.designId) || [];
          arr.push(entry);
          byDesign.set(entry.designId, arr);
        }

        const chronicles = Array.from(byDesign.entries()).map(([dId, entries]) => {
          const sequence = entries.map((entry) => ({
            focus: entry.act?.locus?.path || "0",
            polarity: entry.act?.polarity || "P",
            ramification: [],
            actId: entry.actId,
            order: entry.order,
          }));
          return {
            id: `chronicle-${dId}`,
            designId: dId,
            sequence,
            length: sequence.length,
            isMaximal: true,
          };
        });

        return NextResponse.json({
          ok: true,
          chronicles,
          count: chronicles.length,
          cached: true,
        });
      }
    }

    // Delete existing chronicle entries if forcing recompute
    if (forceRecompute) {
      await prisma.ludicChronicle.deleteMany({
        where: { designId: { in: designIds } },
      });
    }

    // Process each design and collect chronicles
    const allChronicles: ApiChronicle[] = [];

    for (const dId of designIds) {
      // Fetch design with acts
      const design = await prisma.ludicDesign.findUnique({
        where: { id: dId },
        include: { 
          acts: {
            include: { locus: true },
            orderBy: { orderInDesign: "asc" }
          }
        },
      });

      if (!design) continue;

      // Fetch disputes involving this design
      const disputes = await prisma.ludicDispute.findMany({
        where: {
          OR: [{ posDesignId: dId }, { negDesignId: dId }],
        },
      });

      for (const dispute of disputes) {
        const disputeData: Dispute = {
          id: dispute.id,
          dialogueId: dispute.deliberationId,
          posDesignId: dispute.posDesignId,
          negDesignId: dispute.negDesignId,
          pairs: (dispute.actionPairs as any) || [],
          status: dispute.status as any,
          length: dispute.length,
        };

        // Extract chronicles using the core library
        const player = design.participantId === "Proponent" ? "P" : "O";
        const chronicles = extractChronicles(disputeData, player as "P" | "O");

        // Save chronicle entries (each act in the sequence)
        for (const chronicle of chronicles) {
          for (let i = 0; i < chronicle.actions.length; i++) {
            const step = chronicle.actions[i];
            if (step.actId) {
              await prisma.ludicChronicle.create({
                data: {
                  designId: dId,
                  order: i,
                  actId: step.actId,
                },
              });
            }
          }

          // Convert to API format
          allChronicles.push({
            id: chronicle.id,
            designId: chronicle.designId,
            sequence: chronicle.actions.map((a, i) => ({
              focus: a.focus,
              polarity: a.polarity,
              ramification: a.ramification,
              actId: a.actId,
              order: i,
            })),
            length: chronicle.actions.length,
            isMaximal: chronicle.isPositive,
          });
        }
      }

      // If no disputes, create chronicle from design acts directly
      if (disputes.length === 0 && design.acts && design.acts.length > 0) {
        const acts = design.acts;
        const sequence = acts.map((act: any, i: number) => ({
          focus: act.locus?.path || "0",
          polarity: act.polarity || "P",
          ramification: [],
          actId: act.id,
          order: i,
        }));

        // Save each act as a chronicle entry
        for (let i = 0; i < acts.length; i++) {
          await prisma.ludicChronicle.create({
            data: {
              designId: dId,
              order: i,
              actId: acts[i].id,
            },
          });
        }

        allChronicles.push({
          id: `chronicle-${dId}`,
          designId: dId,
          sequence,
          length: sequence.length,
          isMaximal: true,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      chronicles: allChronicles,
      count: allChronicles.length,
      cached: false,
    });
  } catch (error: any) {
    console.error("[DDS Chronicles POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
