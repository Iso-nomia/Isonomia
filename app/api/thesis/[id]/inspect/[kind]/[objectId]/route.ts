export const dynamic = "force-dynamic";

// app/api/thesis/[id]/inspect/[kind]/[objectId]/route.ts
//
// Living Thesis — Phase 2.3: per-object inspection detail.
//
// GET /api/thesis/[id]/inspect/[kind]/[objectId]
//   kind ∈ "claim" | "argument" | "proposition" | "citation"
//
// Returns the joined detail blob the inspector drawer renders. Designed
// to be cheap to fetch on demand (only when the drawer opens), not for
// repeated polling — the live endpoint at /api/thesis/[id]/live continues
// to drive badges and aggregate counts.
//
// Auth: any authed user in Phase 2; tightened in Phase 7.2 against
// `packages/sheaf-acl` deliberation membership.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { checkThesisReadable } from "@/lib/thesis/permissions";
import { instrumentReaderResponse } from "@/lib/thesis/observability";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

type Kind = "claim" | "argument" | "proposition" | "citation" | "chain";

const KINDS: ReadonlySet<Kind> = new Set([
  "claim",
  "argument",
  "proposition",
  "citation",
  "chain",
]);

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status, ...NO_STORE });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; kind: string; objectId: string } },
) {
  const startedAt = Date.now();
  try {
    const authId = await getCurrentUserAuthId();

    const kind = params.kind as Kind;
    if (!KINDS.has(kind)) return bad(400, `Unknown kind: ${params.kind}`);

    // Phase 7.2: gate read access (thesis must exist + caller permitted).
    const gate = await checkThesisReadable(authId, params.id);
    if (!gate.ok) return bad(gate.status, gate.message);

    let body: unknown;
    switch (kind) {
      case "claim":
        body = await loadClaim(params.objectId);
        break;
      case "argument":
        body = await loadArgument(params.objectId);
        break;
      case "proposition":
        body = await loadProposition(params.objectId);
        break;
      case "citation":
        body = await loadCitation(params.objectId);
        break;
      case "chain":
        body = await loadChain(params.objectId);
        break;
    }

    const { serialized } = instrumentReaderResponse({
      endpoint: "thesis.inspect",
      thesisId: params.id,
      authId,
      startedAt,
      body,
      req,
      extra: { kind, objectId: params.objectId },
    });

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[thesis/inspect] error:", err);
    return bad(500, "Internal error");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loaders. Each returns a discriminated blob; the drawer renders by kind.
// ─────────────────────────────────────────────────────────────────────────────

async function loadClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      text: true,
      moid: true,
      createdAt: true,
      createdById: true,
      deliberationId: true,
      ClaimLabel: { select: { label: true, computedAt: true } },
      sourceProposition: {
        select: { id: true, text: true, status: true, createdAt: true },
      },
      asConclusion: {
        select: {
          id: true,
          text: true,
          schemeId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      asPremiseOf: {
        select: {
          argument: {
            select: { id: true, text: true, schemeId: true, createdAt: true },
          },
        },
        take: 50,
      },
      citations: {
        select: {
          id: true,
          uri: true,
          excerptHash: true,
          locatorStart: true,
          locatorEnd: true,
          note: true,
        },
      },
    },
  });
  if (!claim) return { kind: "claim", id: claimId, missing: true };

  // Inbound attack/support edges (against this claim).
  const inboundEdges = await prisma.claimEdge.findMany({
    where: { toClaimId: claimId },
    select: {
      id: true,
      type: true,
      attackType: true,
      targetScope: true,
      createdAt: true,
      from: { select: { id: true, text: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // ClaimAttack records (Phase 3.1 explicit attacks).
  const claimAttacks = await prisma.claimAttack.findMany({
    where: { targetClaimId: claimId },
    select: {
      id: true,
      attackType: true,
      createdAt: true,
      attackingArgument: {
        select: { id: true, text: true, authorId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  }).catch(() => [] as any[]);

  return {
    kind: "claim" as const,
    id: claim.id,
    overview: {
      text: claim.text,
      moid: claim.moid,
      createdAt: claim.createdAt,
      createdById: claim.createdById,
      deliberationId: claim.deliberationId,
      label: claim.ClaimLabel?.label ?? null,
      labelComputedAt: claim.ClaimLabel?.computedAt ?? null,
    },
    attacks: {
      edges: inboundEdges.map((e) => ({
        id: e.id,
        type: e.type, // "supports" | "rebuts"
        attackType: e.attackType, // SUPPORTS | REBUTS | UNDERCUTS | UNDERMINES | null
        targetScope: e.targetScope,
        createdAt: e.createdAt,
        attacker: e.from,
      })),
      records: claimAttacks.map((a) => ({
        id: a.id,
        attackType: a.attackType,
        createdAt: a.createdAt,
        attacker: a.attackingArgument,
      })),
    },
    provenance: {
      sourceProposition: claim.sourceProposition,
      asConclusionOf: claim.asConclusion,
      asPremiseIn: claim.asPremiseOf.map((p) => p.argument),
    },
    evidence: {
      citations: claim.citations,
    },
  };
}

async function loadArgument(argumentId: string) {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      text: true,
      schemeId: true,
      confidence: true,
      createdAt: true,
      authorId: true,
      deliberationId: true,
      conclusion: { select: { id: true, text: true } },
      premises: {
        select: {
          isImplicit: true,
          claim: { select: { id: true, text: true } },
        },
      },
      implicitWarrant: true,
    },
  });
  if (!argument) return { kind: "argument", id: argumentId, missing: true };

  const incoming = await prisma.argumentEdge.findMany({
    where: { toArgumentId: argumentId },
    select: {
      id: true,
      type: true,
      attackSubtype: true,
      targetScope: true,
      cqKey: true,
      createdAt: true,
      fromArgumentId: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Hydrate attacker arguments with their text + check if each attacker
  // itself has an inbound counter-attack (cheap "defended?" approximation,
  // matching the live endpoint's heuristic).
  const attackerIds = Array.from(new Set(incoming.map((e) => e.fromArgumentId)));
  const [attackers, counterEdges] = await Promise.all([
    attackerIds.length
      ? prisma.argument.findMany({
          where: { id: { in: attackerIds } },
          select: { id: true, text: true, schemeId: true, authorId: true },
        })
      : Promise.resolve([]),
    attackerIds.length
      ? prisma.argumentEdge.findMany({
          where: {
            toArgumentId: { in: attackerIds },
            type: { in: ["rebut", "undercut"] as any },
          },
          select: { toArgumentId: true },
        })
      : Promise.resolve([]),
  ]);
  const counterByTarget = new Set(counterEdges.map((c: any) => c.toArgumentId));
  const attackerById = new Map(attackers.map((a: any) => [a.id, a]));

  const cqs = await prisma.cQStatus.findMany({
    where: { targetType: "ARGUMENT" as any, targetId: argumentId },
    select: {
      id: true,
      schemeKey: true,
      cqKey: true,
      statusEnum: true,
      satisfied: true,
      groundsText: true,
      updatedAt: true,
    },
    orderBy: [{ schemeKey: "asc" }, { cqKey: "asc" }],
  });

  const evidence = await prisma.evidenceLink.findMany({
    where: { targetKind: "argument", targetId: argumentId },
    select: {
      id: true,
      uri: true,
      note: true,
      createdAt: true,
      evidence: {
        select: {
          id: true,
          // EvidenceNode select kept narrow; expand later if needed.
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return {
    kind: "argument" as const,
    id: argument.id,
    overview: {
      text: argument.text,
      schemeId: argument.schemeId,
      confidence: argument.confidence,
      createdAt: argument.createdAt,
      authorId: argument.authorId,
      deliberationId: argument.deliberationId,
      conclusion: argument.conclusion,
      implicitWarrant: argument.implicitWarrant,
    },
    attacks: {
      edges: incoming.map((e) => ({
        id: e.id,
        type: e.type, // EdgeType: support|rebut|undercut|concede|CA
        attackSubtype: e.attackSubtype,
        targetScope: e.targetScope,
        cqKey: e.cqKey,
        createdAt: e.createdAt,
        attacker: attackerById.get(e.fromArgumentId) ?? {
          id: e.fromArgumentId,
        },
        defended: counterByTarget.has(e.fromArgumentId),
      })),
    },
    provenance: {
      premises: argument.premises.map((p) => ({
        isImplicit: p.isImplicit,
        claim: p.claim,
      })),
      conclusion: argument.conclusion,
    },
    evidence: { links: evidence },
    cqs: cqs.map((c) => ({
      id: c.id,
      schemeKey: c.schemeKey,
      cqKey: c.cqKey,
      status: c.statusEnum,
      satisfied: c.satisfied || c.statusEnum !== ("OPEN" as any),
      groundsText: c.groundsText,
      updatedAt: c.updatedAt,
    })),
  };
}

async function loadProposition(propositionId: string) {
  const prop = await prisma.proposition.findUnique({
    where: { id: propositionId },
    select: {
      id: true,
      text: true,
      status: true,
      mediaUrl: true,
      mediaType: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
      deliberationId: true,
      promotedClaimId: true,
      promotedAt: true,
      promotedClaim: {
        select: {
          id: true,
          text: true,
          ClaimLabel: { select: { label: true } },
        },
      },
      voteUpCount: true,
      voteDownCount: true,
      endorseCount: true,
      replyCount: true,
    },
  });
  if (!prop) return { kind: "proposition", id: propositionId, missing: true };

  return {
    kind: "proposition" as const,
    id: prop.id,
    overview: {
      text: prop.text,
      status: prop.status,
      mediaUrl: prop.mediaUrl,
      mediaType: prop.mediaType,
      createdAt: prop.createdAt,
      updatedAt: prop.updatedAt,
      authorId: prop.authorId,
      deliberationId: prop.deliberationId,
    },
    workshop: {
      voteUp: prop.voteUpCount,
      voteDown: prop.voteDownCount,
      endorsements: prop.endorseCount,
      replies: prop.replyCount,
    },
    provenance: {
      promotedClaim: prop.promotedClaim,
      promotedAt: prop.promotedAt,
    },
  };
}

async function loadCitation(citationId: string) {
  // Citations are currently embedded as TipTap node attrs (no dedicated
  // back-end model that the drawer reads). Try ClaimCitation first as the
  // closest stored form; fall back to a minimal echo so the drawer at least
  // shows the id while we evolve this in Phase 6 (cross-thesis backlinks).
  const claimCitation = await prisma.claimCitation.findUnique({
    where: { id: citationId },
    select: {
      id: true,
      uri: true,
      excerptHash: true,
      locatorStart: true,
      locatorEnd: true,
      note: true,
      claim: { select: { id: true, text: true } },
    },
  }).catch(() => null);

  if (claimCitation) {
    return {
      kind: "citation" as const,
      id: claimCitation.id,
      overview: {
        uri: claimCitation.uri,
        locator:
          claimCitation.locatorStart != null || claimCitation.locatorEnd != null
            ? `${claimCitation.locatorStart ?? ""}–${claimCitation.locatorEnd ?? ""}`
            : null,
        note: claimCitation.note,
      },
      provenance: { claim: claimCitation.claim },
    };
  }

  return {
    kind: "citation" as const,
    id: citationId,
    overview: { note: "No stored backing record; using inline TipTap attrs." },
  };
}

// ---------------------------------------------------------------------------
// D4 Week 1–2: ArgumentChain inspector loader.
//
// Returns the joined chain detail the drawer renders for the "chain" kind:
//   - overview: name/description/purpose/chainType, node + edge counts.
//   - nodes: argument id, role, conclusion text, position.
//   - edges: source/target node ids + edge type + description.
//   - provenance: deliberation, creator, theses that embed this chain.
// ---------------------------------------------------------------------------
async function loadChain(chainId: string) {
  const chain = await prisma.argumentChain.findUnique({
    where: { id: chainId },
    select: {
      id: true,
      name: true,
      description: true,
      purpose: true,
      chainType: true,
      createdAt: true,
      updatedAt: true,
      deliberation: { select: { id: true, title: true } },
      creator: { select: { id: true, name: true, image: true } },
      _count: { select: { nodes: true, edges: true } },
      nodes: {
        orderBy: { nodeOrder: "asc" },
        select: {
          id: true,
          argumentId: true,
          role: true,
          nodeOrder: true,
          positionX: true,
          positionY: true,
          epistemicStatus: true,
          dialecticalRole: true,
          argument: {
            select: {
              id: true,
              text: true,
              conclusion: { select: { id: true, text: true } },
            },
          },
        },
      },
      edges: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sourceNodeId: true,
          targetNodeId: true,
          edgeType: true,
          strength: true,
          description: true,
        },
      },
      thesisReferences: {
        select: {
          thesisId: true,
          role: true,
          caption: true,
          thesis: { select: { id: true, title: true, slug: true, status: true } },
        },
        take: 25,
      },
    },
  });

  if (!chain) return { kind: "chain" as const, id: chainId, missing: true };

  return {
    kind: "chain" as const,
    id: chain.id,
    overview: {
      name: chain.name,
      description: chain.description,
      purpose: chain.purpose,
      chainType: chain.chainType,
      nodeCount: chain._count?.nodes ?? chain.nodes.length,
      edgeCount: chain._count?.edges ?? chain.edges.length,
      createdAt: chain.createdAt.toISOString(),
      updatedAt: chain.updatedAt.toISOString(),
    },
    nodes: chain.nodes.map((n) => ({
      id: n.id,
      argumentId: n.argumentId,
      role: n.role,
      order: n.nodeOrder,
      positionX: n.positionX,
      positionY: n.positionY,
      epistemicStatus: n.epistemicStatus,
      dialecticalRole: n.dialecticalRole,
      text:
        n.argument?.text?.trim() ||
        n.argument?.conclusion?.text?.trim() ||
        "",
      conclusion: n.argument?.conclusion ?? null,
    })),
    edges: chain.edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      targetNodeId: e.targetNodeId,
      edgeType: e.edgeType,
      strength: e.strength,
      description: e.description,
    })),
    provenance: {
      deliberation: chain.deliberation,
      creator: chain.creator
        ? {
            id: chain.creator.id?.toString?.() ?? String(chain.creator.id),
            name: chain.creator.name,
            image: chain.creator.image,
          }
        : null,
      theses: chain.thesisReferences.map((r) => ({
        thesisId: r.thesisId,
        role: r.role,
        caption: r.caption,
        title: r.thesis?.title ?? null,
        slug: r.thesis?.slug ?? null,
        status: r.thesis?.status ?? null,
      })),
    },
  };
}
