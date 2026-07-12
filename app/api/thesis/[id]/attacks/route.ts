export const dynamic = "force-dynamic";

// app/api/thesis/[id]/attacks/route.ts
//
// Living Thesis — Phase 3.2: attack-register endpoint.
//
// GET /api/thesis/[id]/attacks?status=undefended|defended|conceded|all
//
// Returns a flat, time-sorted list of attacks against any embedded
// claim/argument in the thesis, classified by status. Powers the
// ThesisAttackRegister panel on the published view page.
//
// Status classification (V1):
//   • undefended: attack edge with no inbound counter-attack against
//     the attacker
//   • defended:   attack edge whose attacker itself has at least one
//     inbound rebut/undercut
//   • conceded:   reserved (always empty in V1; will track explicit
//     concede edges + DialogueMove "concede" locutions later)
//
// This is on-demand and joins fewer fields than the per-object
// inspector endpoint so it stays cheap to call alongside /live.

import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import {
  collectEmbeddedObjects,
  mergeStructuredRefs,
} from "@/lib/thesis/embedded-objects";
import { checkThesisReadable } from "@/lib/thesis/permissions";
import { instrumentReaderResponse } from "@/lib/thesis/observability";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

type RegisterStatus = "undefended" | "defended" | "conceded";

interface AttackEntry {
  id: string;
  status: RegisterStatus;
  target: {
    kind: "claim" | "argument";
    id: string;
    text: string | null;
    /**
     * D4 Week 1–2: when this target argument is a member of one or more
     * ArgumentChains embedded in the thesis, list the parent chains here so
     * the register UI can show "in chain X" rollup pills.
     */
    chains?: Array<{ chainId: string; chainName: string }>;
  };
  attacker: {
    kind: "claim" | "argument";
    id: string;
    text: string | null;
    authorId?: string | null;
  };
  attackType: string | null; // REBUTS | UNDERMINES | UNDERCUTS | rebut | undercut
  targetScope?: string | null;
  createdAt: string;
}

interface RegisterResponse {
  cursor: string;
  computedAt: string;
  counts: { undefended: number; defended: number; conceded: number; all: number };
  entries: AttackEntry[];
}

const VALID_STATUS = new Set(["undefended", "defended", "conceded", "all"]);

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const startedAt = Date.now();
  try {
    const authId = await getCurrentUserAuthId();

    // Phase 7.2: gate read access via shared helper.
    const gate = await checkThesisReadable(authId, params.id);
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message },
        { status: gate.status, ...NO_STORE },
      );
    }

    const status = (req.nextUrl.searchParams.get("status") ?? "all").toLowerCase();
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400, ...NO_STORE },
      );
    }

    // 1. Load thesis + structured prong refs.
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        content: true,
        thesisClaimId: true,
        prongs: {
          select: {
            mainClaimId: true,
            arguments: { select: { argumentId: true } },
          },
        },
      },
    });
    if (!thesis) {
      return NextResponse.json(
        { error: "Thesis not found" },
        { status: 404, ...NO_STORE },
      );
    }

    // 2. Discover embedded ids.
    const fromContent = collectEmbeddedObjects(
      (thesis.content ?? null) as JSONContent | null,
    );
    const inventory = mergeStructuredRefs(fromContent, {
      thesisClaimId: thesis.thesisClaimId,
      prongMainClaimIds: thesis.prongs.map((p) => p.mainClaimId),
      prongArgumentIds: thesis.prongs.flatMap((p) =>
        p.arguments.map((a) => a.argumentId),
      ),
    });

    const claimIds = inventory.claimIds;
    const argumentIds = inventory.argumentIds;

    // D4 Week 1–2: extend argument coverage with member arguments of any
    // embedded chain. Build a membership map (argumentId → chains) so we can
    // tag entries with their chain rollup later.
    const chainMembership = new Map<
      string,
      Array<{ chainId: string; chainName: string }>
    >();
    if (inventory.chainIds.length > 0) {
      const chains = await prisma.argumentChain.findMany({
        where: { id: { in: inventory.chainIds } },
        select: {
          id: true,
          name: true,
          nodes: { select: { argumentId: true } },
        },
      });
      for (const c of chains) {
        for (const n of c.nodes) {
          const list = chainMembership.get(n.argumentId) ?? [];
          list.push({ chainId: c.id, chainName: c.name });
          chainMembership.set(n.argumentId, list);
          if (!argumentIds.includes(n.argumentId)) {
            argumentIds.push(n.argumentId);
          }
        }
      }
    }

    if (claimIds.length === 0 && argumentIds.length === 0) {
      return NextResponse.json(
        emptyResponse(),
        NO_STORE,
      );
    }

    // 3. Load inbound attack edges/records + the embedded objects' text
    //    so we can render target previews without an extra round-trip.
    const [
      claimsForLabel,
      argumentsForLabel,
      claimEdges,
      argumentEdges,
      claimAttackRecords,
    ] = await Promise.all([
      claimIds.length
        ? prisma.claim.findMany({
            where: { id: { in: claimIds } },
            select: { id: true, text: true },
          })
        : Promise.resolve([]),
      argumentIds.length
        ? prisma.argument.findMany({
            where: { id: { in: argumentIds } },
            select: { id: true, text: true },
          })
        : Promise.resolve([]),
      claimIds.length
        ? prisma.claimEdge.findMany({
            where: {
              toClaimId: { in: claimIds },
              type: "rebuts" as any,
            },
            select: {
              id: true,
              toClaimId: true,
              fromClaimId: true,
              attackType: true,
              targetScope: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 500,
          })
        : Promise.resolve([]),
      argumentIds.length
        ? prisma.argumentEdge.findMany({
            where: {
              toArgumentId: { in: argumentIds },
              type: { in: ["rebut", "undercut"] as any },
            },
            select: {
              id: true,
              toArgumentId: true,
              fromArgumentId: true,
              type: true,
              attackSubtype: true,
              targetScope: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 500,
          })
        : Promise.resolve([]),
      claimIds.length
        ? prisma.claimAttack
            .findMany({
              where: { targetClaimId: { in: claimIds } },
              select: {
                id: true,
                targetClaimId: true,
                attackType: true,
                createdAt: true,
                attackingArgument: {
                  select: { id: true, text: true, authorId: true },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 500,
            })
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
    ]);

    const claimText = new Map(claimsForLabel.map((c) => [c.id, c.text]));
    const argumentText = new Map(
      argumentsForLabel.map((a) => [a.id, a.text]),
    );

    // 4. Resolve attacker labels + defended-status in two batched queries.
    const attackerClaimIds = Array.from(
      new Set(claimEdges.map((e) => e.fromClaimId)),
    );
    const attackerArgumentIds = Array.from(
      new Set(argumentEdges.map((e) => e.fromArgumentId)),
    );

    const [
      attackerClaims,
      attackerArguments,
      claimCounters,
      argumentCounters,
    ] = await Promise.all([
      attackerClaimIds.length
        ? prisma.claim.findMany({
            where: { id: { in: attackerClaimIds } },
            select: { id: true, text: true, createdById: true },
          })
        : Promise.resolve([]),
      attackerArgumentIds.length
        ? prisma.argument.findMany({
            where: { id: { in: attackerArgumentIds } },
            select: { id: true, text: true, authorId: true },
          })
        : Promise.resolve([]),
      // Counter-attacks against attacker claims = ClaimEdge rebuts targeting them
      attackerClaimIds.length
        ? prisma.claimEdge.findMany({
            where: {
              toClaimId: { in: attackerClaimIds },
              type: "rebuts" as any,
            },
            select: { toClaimId: true },
          })
        : Promise.resolve([]),
      // Counter-attacks against attacker arguments
      attackerArgumentIds.length
        ? prisma.argumentEdge.findMany({
            where: {
              toArgumentId: { in: attackerArgumentIds },
              type: { in: ["rebut", "undercut"] as any },
            },
            select: { toArgumentId: true },
          })
        : Promise.resolve([]),
    ]);

    const attackerClaimById = new Map(
      attackerClaims.map((c: any) => [c.id, c]),
    );
    const attackerArgumentById = new Map(
      attackerArguments.map((a: any) => [a.id, a]),
    );
    const counteredClaimIds = new Set(
      claimCounters.map((c: any) => c.toClaimId),
    );
    const counteredArgumentIds = new Set(
      argumentCounters.map((c: any) => c.toArgumentId),
    );

    // 5. Assemble entries.
    const entries: AttackEntry[] = [];

    for (const e of claimEdges) {
      const attacker = attackerClaimById.get(e.fromClaimId);
      const defended = counteredClaimIds.has(e.fromClaimId);
      entries.push({
        id: `cedge:${e.id}`,
        status: defended ? "defended" : "undefended",
        target: {
          kind: "claim",
          id: e.toClaimId,
          text: claimText.get(e.toClaimId) ?? null,
        },
        attacker: {
          kind: "claim",
          id: e.fromClaimId,
          text: attacker?.text ?? null,
          authorId: attacker?.createdById ?? null,
        },
        attackType: e.attackType ?? "REBUTS",
        targetScope: e.targetScope,
        createdAt: e.createdAt.toISOString(),
      });
    }

    for (const e of argumentEdges) {
      const attacker = attackerArgumentById.get(e.fromArgumentId);
      const defended = counteredArgumentIds.has(e.fromArgumentId);
      const chains = chainMembership.get(e.toArgumentId);
      entries.push({
        id: `aedge:${e.id}`,
        status: defended ? "defended" : "undefended",
        target: {
          kind: "argument",
          id: e.toArgumentId,
          text: argumentText.get(e.toArgumentId) ?? null,
          ...(chains && chains.length > 0 ? { chains } : {}),
        },
        attacker: {
          kind: "argument",
          id: e.fromArgumentId,
          text: attacker?.text ?? null,
          authorId: attacker?.authorId ?? null,
        },
        attackType: e.type,
        targetScope: e.targetScope ?? e.attackSubtype ?? null,
        createdAt: e.createdAt.toISOString(),
      });
    }

    for (const a of claimAttackRecords) {
      const attackerArg = a.attackingArgument;
      const defended = attackerArg
        ? counteredArgumentIds.has(attackerArg.id)
        : false;
      entries.push({
        id: `crec:${a.id}`,
        status: defended ? "defended" : "undefended",
        target: {
          kind: "claim",
          id: a.targetClaimId,
          text: claimText.get(a.targetClaimId) ?? null,
        },
        attacker: {
          kind: "argument",
          id: attackerArg?.id ?? "",
          text: attackerArg?.text ?? null,
          authorId: attackerArg?.authorId ?? null,
        },
        attackType: a.attackType,
        createdAt: a.createdAt.toISOString(),
      });
    }

    entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const counts = {
      undefended: entries.filter((e) => e.status === "undefended").length,
      defended: entries.filter((e) => e.status === "defended").length,
      conceded: 0,
      all: entries.length,
    };

    const filtered =
      status === "all"
        ? entries
        : entries.filter((e) => e.status === (status as RegisterStatus));

    const cursor = entries[0]?.createdAt ?? new Date(0).toISOString();

    const body: RegisterResponse = {
      cursor,
      computedAt: new Date().toISOString(),
      counts,
      entries: filtered,
    };

    // Phase 7.1: structured poll log.
    const { serialized } = instrumentReaderResponse({
      endpoint: "thesis.attacks",
      thesisId: params.id,
      authId,
      startedAt,
      body,
      cursor,
      freshAt: cursor,
      objectCount: entries.length,
      req,
      extra: { status },
    });

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[thesis/attacks] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, ...NO_STORE },
    );
  }
}

function emptyResponse(): RegisterResponse {
  return {
    cursor: new Date(0).toISOString(),
    computedAt: new Date().toISOString(),
    counts: { undefended: 0, defended: 0, conceded: 0, all: 0 },
    entries: [],
  };
}
