export const dynamic = "force-dynamic";

// app/api/argument-chains/from-prong/route.ts
//
// D4 Week 4: materialize a ThesisProng into a new ArgumentChain.
//
// POST /api/argument-chains/from-prong
// body: {
//   prongId: string;
//   name?: string;             // override (defaults to prong title)
//   description?: string;
//   purpose?: string;
//   chainType?: ArgumentChainType; // default GRAPH
//   isPublic?: boolean;
//   inferEnables?: boolean;    // emit ENABLES edges from arguments with
//                              //   non-empty scheme premises (default true)
// }
//
// Strategy:
//   1. Load prong with arguments (in prong order), include each Argument's
//      argumentSchemes for enabler detection.
//   2. Map ArgumentRole → ChainNodeRole:
//        PREMISE          → PREMISE
//        INFERENCE        → CONCLUSION
//        COUNTER_RESPONSE → OBJECTION
//   3. Create chain in caller's deliberation (prong.thesis.deliberationId).
//   4. Create ArgumentChainNodes preserving prong order as nodeOrder.
//   5. Edges:
//        - For consecutive prong arguments A_i → A_{i+1}, emit SUPPORTS.
//        - For arguments with scheme.premises (i.e. an enabler exists), also
//          emit an ENABLES edge to the next argument (when inferEnables).
//        - COUNTER_RESPONSE arguments are mapped as OBJECTION nodes; an
//          attack edge (UNDERCUTS) is added from them to the conclusion node.
//   6. Persist a ThesisChainReference (prong-scoped, role=MAIN) so the new
//      chain is back-linked to the prong for round-tripping.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { ArgumentChainEdgeType } from "@prisma/client";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const FromProngSchema = z.object({
  prongId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  purpose: z.string().optional(),
  chainType: z
    .enum(["SERIAL", "CONVERGENT", "DIVERGENT", "TREE", "GRAPH"])
    .optional(),
  isPublic: z.boolean().optional(),
  isEditable: z.boolean().optional(),
  inferEnables: z.boolean().optional(),
});

type ArgumentRole = "PREMISE" | "INFERENCE" | "COUNTER_RESPONSE";
type ChainNodeRole =
  | "PREMISE"
  | "EVIDENCE"
  | "CONCLUSION"
  | "OBJECTION"
  | "REBUTTAL"
  | "QUALIFIER"
  | "COMMENT";

function mapNodeRole(r: ArgumentRole): ChainNodeRole {
  switch (r) {
    case "INFERENCE":
      return "CONCLUSION";
    case "COUNTER_RESPONSE":
      return "OBJECTION";
    case "PREMISE":
    default:
      return "PREMISE";
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromCookies();
    if (!user || !user.userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, ...NO_STORE },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = FromProngSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request data", details: parsed.error.flatten() },
        { status: 400, ...NO_STORE },
      );
    }
    const {
      prongId,
      name,
      description,
      purpose,
      chainType = "GRAPH",
      isPublic = false,
      isEditable = false,
      inferEnables = true,
    } = parsed.data;

    const prong = await prisma.thesisProng.findUnique({
      where: { id: prongId },
      include: {
        thesis: {
          select: { id: true, authorId: true, deliberationId: true },
        },
        arguments: {
          include: {
            argument: {
              select: {
                id: true,
                conclusionClaimId: true,
                argumentSchemes: {
                  select: {
                    justification: true,
                    role: true,
                    scheme: { select: { premises: true } },
                  },
                  orderBy: [{ role: "asc" }, { order: "asc" }],
                  take: 5,
                },
              },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!prong) {
      return NextResponse.json(
        { ok: false, error: "Prong not found" },
        { status: 404, ...NO_STORE },
      );
    }
    if (prong.thesis.authorId !== String(user.userId)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403, ...NO_STORE },
      );
    }
    if (!prong.thesis.deliberationId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Cannot create a chain: this thesis is not bound to a deliberation.",
        },
        { status: 400, ...NO_STORE },
      );
    }
    if (prong.arguments.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Prong has no arguments to convert." },
        { status: 400, ...NO_STORE },
      );
    }

    const chainName = (name ?? prong.title).slice(0, 255);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the chain.
      const chain = await tx.argumentChain.create({
        data: {
          deliberationId: prong.thesis.deliberationId!,
          name: chainName,
          description:
            description ??
            `Materialized from thesis prong "${prong.title}".`,
          purpose: purpose ?? null,
          chainType,
          isPublic,
          isEditable,
          createdBy: BigInt(user.userId!),
        },
      });

      // 2. Create nodes (preserve prong order as nodeOrder). Skip duplicate
      //    arguments (chain has unique [chainId, argumentId]).
      const seen = new Set<string>();
      const nodeRows: { id: string; argumentId: string; role: ChainNodeRole; nodeOrder: number }[] = [];
      let nodeOrderIdx = 0;
      for (const pa of prong.arguments) {
        if (seen.has(pa.argumentId)) continue;
        seen.add(pa.argumentId);
        const role = mapNodeRole(pa.role as ArgumentRole);
        const created = await tx.argumentChainNode.create({
          data: {
            chainId: chain.id,
            argumentId: pa.argumentId,
            role,
            nodeOrder: nodeOrderIdx,
            addedBy: BigInt(user.userId!),
          },
          select: { id: true, argumentId: true, role: true, nodeOrder: true },
        });
        nodeRows.push({
          id: created.id,
          argumentId: created.argumentId,
          role: role,
          nodeOrder: created.nodeOrder,
        });
        nodeOrderIdx++;
      }

      // 3. Build edges.
      // 3a. Sequential SUPPORTS chain over PREMISE/CONCLUSION nodes (skip
      //     OBJECTION nodes — they get attack edges instead).
      const mainline = nodeRows.filter((n) => n.role !== "OBJECTION" && n.role !== "REBUTTAL");
      const objections = nodeRows.filter((n) => n.role === "OBJECTION" || n.role === "REBUTTAL");
      const conclusionNode =
        mainline.find((n) => n.role === "CONCLUSION") ??
        mainline[mainline.length - 1] ??
        null;

      const edgeData: { chainId: string; sourceNodeId: string; targetNodeId: string; edgeType: ArgumentChainEdgeType }[] = [];
      for (let i = 0; i < mainline.length - 1; i++) {
        edgeData.push({
          chainId: chain.id,
          sourceNodeId: mainline[i].id,
          targetNodeId: mainline[i + 1].id,
          edgeType: "SUPPORTS",
        });
      }

      // 3b. ENABLES edges from any argument whose scheme has non-empty
      //     premises to the next mainline node (heuristic enabler detection).
      if (inferEnables) {
        const enablerByArg = new Map<string, boolean>();
        for (const pa of prong.arguments) {
          const hasEnabler = pa.argument.argumentSchemes.some(
            (s) =>
              Array.isArray(s.scheme?.premises) &&
              s.scheme.premises.length > 0,
          );
          if (hasEnabler) enablerByArg.set(pa.argumentId, true);
        }
        for (let i = 0; i < mainline.length - 1; i++) {
          if (enablerByArg.get(mainline[i].argumentId)) {
            edgeData.push({
              chainId: chain.id,
              sourceNodeId: mainline[i].id,
              targetNodeId: mainline[i + 1].id,
              edgeType: "ENABLES",
            });
          }
        }
      }

      // 3c. UNDERCUTS edge from each OBJECTION → conclusion (or last mainline).
      if (conclusionNode) {
        for (const obj of objections) {
          edgeData.push({
            chainId: chain.id,
            sourceNodeId: obj.id,
            targetNodeId: conclusionNode.id,
            edgeType: "UNDERCUTS",
          });
        }
      }

      if (edgeData.length > 0) {
        await tx.argumentChainEdge.createMany({
          data: edgeData,
          skipDuplicates: true,
        });
      }

      // 4. Set rootNodeId to first PREMISE (if any).
      const rootCandidate = mainline.find((n) => n.role === "PREMISE") ?? mainline[0] ?? null;
      if (rootCandidate) {
        await tx.argumentChain.update({
          where: { id: chain.id },
          data: { rootNodeId: rootCandidate.id },
        });
      }

      // 5. Record back-reference so the round-trip is closed.
      await tx.thesisChainReference.upsert({
        where: { thesisId_chainId: { thesisId: prong.thesis.id, chainId: chain.id } },
        create: {
          thesisId: prong.thesis.id,
          chainId: chain.id,
          prongId: prong.id,
          role: "MAIN",
          caption: `Materialized from prong: ${prong.title}`,
        },
        update: { prongId: prong.id },
      });

      return {
        chainId: chain.id,
        chainName: chain.name,
        nodeCount: nodeRows.length,
        edgeCount: edgeData.length,
      };
    });

    return NextResponse.json(
      { ok: true, ...result },
      { status: 201, ...NO_STORE },
    );
  } catch (err: any) {
    console.error("[POST /api/argument-chains/from-prong] failed", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "from-prong conversion failed" },
      { status: 500, ...NO_STORE },
    );
  }
}
