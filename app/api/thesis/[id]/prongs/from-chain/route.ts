export const dynamic = "force-dynamic";

// app/api/thesis/[id]/prongs/from-chain/route.ts
//
// D4 Week 4: materialize an ArgumentChain into a new ThesisProng.
//
// POST /api/thesis/[id]/prongs/from-chain
// body: {
//   chainId: string;
//   title?: string;            // override (defaults to chain.name)
//   role?: ProngRole;          // defaults to SUPPORT
//   mainClaimId?: string;      // optional explicit main claim
//   includeObjections?: boolean; // include OBJECTION/REBUTTAL nodes (default true)
//   includeComments?: boolean;   // include COMMENT nodes (default false)
// }
//
// Strategy:
//   1. Load chain with nodes (each → Argument) and edges.
//   2. Topologically sort nodes:
//        - Edges of type PRESUPPOSES point B→A meaning "B presupposes A"; A
//          must come first.
//        - Edges of type ENABLES point A→B meaning "A enables B"; A first.
//        - Edges of type SUPPORTS A→B (premise → conclusion); A first.
//        - Falls back to existing nodeOrder for unconstrained pairs.
//   3. Map ChainNodeRole → ArgumentRole:
//        PREMISE | EVIDENCE | QUALIFIER | COMMENT → PREMISE
//        CONCLUSION                                → INFERENCE
//        OBJECTION | REBUTTAL                      → COUNTER_RESPONSE
//   4. Pick mainClaim: explicit body.mainClaimId; else the conclusion claim
//      of the first CONCLUSION node; else of the last node in topo order.
//   5. Carry the first ArgumentSchemeInstance.justification per argument
//      into ThesisProngArgument.note.
//   6. Create the prong + arguments in a transaction. Records a
//      ThesisChainReference (prong-scoped) so future edits round-trip.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const FromChainSchema = z.object({
  chainId: z.string().min(1),
  title: z.string().min(1).optional(),
  role: z.enum(["SUPPORT", "REBUT", "PREEMPT"]).optional(),
  mainClaimId: z.string().optional(),
  includeObjections: z.boolean().optional(),
  includeComments: z.boolean().optional(),
});

type ChainNodeRole =
  | "PREMISE"
  | "EVIDENCE"
  | "CONCLUSION"
  | "OBJECTION"
  | "REBUTTAL"
  | "QUALIFIER"
  | "COMMENT";

type ArgumentRole = "PREMISE" | "INFERENCE" | "COUNTER_RESPONSE";

function mapRole(r: ChainNodeRole | null | undefined): ArgumentRole {
  switch (r) {
    case "CONCLUSION":
      return "INFERENCE";
    case "OBJECTION":
    case "REBUTTAL":
      return "COUNTER_RESPONSE";
    case "PREMISE":
    case "EVIDENCE":
    case "QUALIFIER":
    case "COMMENT":
    default:
      return "PREMISE";
  }
}

interface SortableNode {
  id: string;
  argumentId: string;
  role: ChainNodeRole | null;
  nodeOrder: number;
}

interface SortableEdge {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
}

/**
 * Topologically order nodes. For each ordering edge A→B (A must come first),
 * we add adj[A].push(B) and inDegree[B]++. Falls back to nodeOrder where the
 * topological constraint is silent. Cycles degrade gracefully — remaining
 * nodes are appended in nodeOrder.
 */
function topoOrder(nodes: SortableNode[], edges: SortableEdge[]): SortableNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) {
    adj.set(n.id, []);
    inDeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!byId.has(e.sourceNodeId) || !byId.has(e.targetNodeId)) continue;
    let from = e.sourceNodeId;
    let to = e.targetNodeId;
    if (e.edgeType === "PRESUPPOSES") {
      // "to PRESUPPOSES from" → from first
      [from, to] = [e.targetNodeId, e.sourceNodeId];
    } else if (
      e.edgeType === "SUPPORTS" ||
      e.edgeType === "ENABLES" ||
      e.edgeType === "EXEMPLIFIES" ||
      e.edgeType === "QUALIFIES"
    ) {
      // A → B, A precedes B (already correct)
    } else {
      // Attack edges (REBUTS/UNDERCUTS/UNDERMINES/REFUTES) don't constrain
      // ordering of premises; skip.
      continue;
    }
    adj.get(from)!.push(to);
    inDeg.set(to, (inDeg.get(to) ?? 0) + 1);
  }

  // Kahn's algorithm with nodeOrder as tiebreaker.
  const ready = nodes
    .filter((n) => (inDeg.get(n.id) ?? 0) === 0)
    .sort((a, b) => a.nodeOrder - b.nodeOrder);
  const out: SortableNode[] = [];
  const seen = new Set<string>();

  while (ready.length) {
    // pull min nodeOrder among ready
    ready.sort((a, b) => a.nodeOrder - b.nodeOrder);
    const next = ready.shift()!;
    if (seen.has(next.id)) continue;
    seen.add(next.id);
    out.push(next);
    for (const child of adj.get(next.id) ?? []) {
      const d = (inDeg.get(child) ?? 0) - 1;
      inDeg.set(child, d);
      if (d === 0) ready.push(byId.get(child)!);
    }
  }

  // Append any remaining (cycles) in nodeOrder.
  if (out.length < nodes.length) {
    const remaining = nodes
      .filter((n) => !seen.has(n.id))
      .sort((a, b) => a.nodeOrder - b.nodeOrder);
    out.push(...remaining);
  }

  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authorId = await getCurrentUserId();
    if (!authorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, ...NO_STORE });
    }

    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: { authorId: true, deliberationId: true },
    });
    if (!thesis) {
      return NextResponse.json({ error: "Thesis not found" }, { status: 404, ...NO_STORE });
    }
    if (thesis.authorId !== String(authorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, ...NO_STORE });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = FromChainSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, ...NO_STORE });
    }
    const {
      chainId,
      title,
      role,
      mainClaimId,
      includeObjections = true,
      includeComments = false,
    } = parsed.data;

    const chain = await prisma.argumentChain.findUnique({
      where: { id: chainId },
      include: {
        nodes: {
          select: {
            id: true,
            argumentId: true,
            role: true,
            nodeOrder: true,
            argument: {
              select: {
                id: true,
                conclusionClaimId: true,
                argumentSchemes: {
                  select: { justification: true, role: true },
                  orderBy: [{ role: "asc" }, { order: "asc" }],
                  take: 5,
                },
              },
            },
          },
          orderBy: { nodeOrder: "asc" },
        },
        edges: {
          select: { sourceNodeId: true, targetNodeId: true, edgeType: true },
        },
      },
    });
    if (!chain) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404, ...NO_STORE });
    }
    if (
      thesis.deliberationId &&
      chain.deliberationId !== thesis.deliberationId
    ) {
      return NextResponse.json(
        { error: "Chain belongs to a different deliberation" },
        { status: 400, ...NO_STORE },
      );
    }

    // Filter chain nodes by include flags.
    const filteredNodes = chain.nodes.filter((n) => {
      const r = n.role as ChainNodeRole | null;
      if (r === "COMMENT" && !includeComments) return false;
      if ((r === "OBJECTION" || r === "REBUTTAL") && !includeObjections)
        return false;
      return true;
    });

    if (filteredNodes.length === 0) {
      return NextResponse.json(
        { error: "Chain has no convertible nodes after applying filters" },
        { status: 400, ...NO_STORE },
      );
    }

    // Topo order respects only nodes still in scope.
    const sortable: SortableNode[] = filteredNodes.map((n) => ({
      id: n.id,
      argumentId: n.argumentId,
      role: n.role as ChainNodeRole | null,
      nodeOrder: n.nodeOrder,
    }));
    const sortableIds = new Set(sortable.map((n) => n.id));
    const filteredEdges: SortableEdge[] = chain.edges.filter(
      (e) => sortableIds.has(e.sourceNodeId) && sortableIds.has(e.targetNodeId),
    );
    const ordered = topoOrder(sortable, filteredEdges);

    // Resolve mainClaimId.
    let resolvedMainClaimId: string | null = mainClaimId ?? null;
    if (!resolvedMainClaimId) {
      const conclusionNode =
        ordered.find((n) => n.role === "CONCLUSION") ?? ordered[ordered.length - 1];
      const argRow = chain.nodes.find((n) => n.id === conclusionNode?.id);
      resolvedMainClaimId = argRow?.argument?.conclusionClaimId ?? null;
    }
    if (!resolvedMainClaimId) {
      return NextResponse.json(
        {
          error:
            "Could not resolve a main claim for the new prong (no conclusion claim found). Pass body.mainClaimId explicitly.",
        },
        { status: 400, ...NO_STORE },
      );
    }

    // De-duplicate arguments (chain may legally repeat an Argument across nodes;
    // ThesisProngArgument has unique([prongId, argumentId])).
    const seenArgs = new Set<string>();
    const orderedArgs = ordered.filter((n) => {
      if (seenArgs.has(n.argumentId)) return false;
      seenArgs.add(n.argumentId);
      return true;
    });

    // Pull justifications keyed by argumentId.
    const justificationByArg = new Map<string, string | null>();
    for (const n of chain.nodes) {
      const j = n.argument.argumentSchemes.find((s) => !!s.justification)
        ?.justification ?? null;
      if (j) justificationByArg.set(n.argumentId, j);
    }

    // Compute next prong order.
    const lastProng = await prisma.thesisProng.findFirst({
      where: { thesisId: params.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastProng?.order ?? 0) + 1;

    const prongTitle = (title ?? chain.name).slice(0, 240);

    const result = await prisma.$transaction(async (tx) => {
      const prong = await tx.thesisProng.create({
        data: {
          thesisId: params.id,
          title: prongTitle,
          mainClaimId: resolvedMainClaimId!,
          order: nextOrder,
          role: role ?? "SUPPORT",
        },
      });

      // Insert arguments in topo order. Use createMany for speed.
      await tx.thesisProngArgument.createMany({
        data: orderedArgs.map((n, idx) => ({
          prongId: prong.id,
          argumentId: n.argumentId,
          order: idx + 1,
          role: mapRole(n.role),
          note: justificationByArg.get(n.argumentId) ?? null,
        })),
        skipDuplicates: true,
      });

      // Record the structured chain reference (idempotent on [thesisId,chainId]).
      await tx.thesisChainReference.upsert({
        where: { thesisId_chainId: { thesisId: params.id, chainId } },
        create: {
          thesisId: params.id,
          chainId,
          prongId: prong.id,
          role: "MAIN",
          caption: `Materialized into prong: ${prongTitle}`,
        },
        update: {
          prongId: prong.id,
        },
      });

      return prong;
    });

    return NextResponse.json(
      {
        ok: true,
        prongId: result.id,
        argumentCount: orderedArgs.length,
        skippedNodeCount: chain.nodes.length - orderedArgs.length,
        chainId,
      },
      NO_STORE,
    );
  } catch (err: any) {
    console.error("[thesis/:id/prongs/from-chain] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "from-chain conversion failed" },
      { status: 500, ...NO_STORE },
    );
  }
}
