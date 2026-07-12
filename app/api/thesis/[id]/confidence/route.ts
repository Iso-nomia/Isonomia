export const dynamic = "force-dynamic";

// app/api/thesis/[id]/confidence/route.ts
//
// Living Thesis — Phase 4.2: confidence audit endpoint.
//
// GET /api/thesis/[id]/confidence
//
// Computes an auditable per-prong and overall confidence score for a thesis.
// The response echoes the formula and every contributing input verbatim so
// the ConfidenceBadge can show the user *why* the number is what it is, and
// deep-link to each contributing object via openInspector().

import { NextRequest, NextResponse } from "next/server";
import type { EdgeType, ClaimAttackType } from "@prisma/client";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import {
  scoreProng,
  scoreThesis,
  type ProngEvidence,
  type ConfidenceResult,
} from "@/lib/thesis/confidence";
import { checkThesisReadable } from "@/lib/thesis/permissions";
import { instrumentReaderResponse } from "@/lib/thesis/observability";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const CLAIM_ATTACK_TYPES: ClaimAttackType[] = ["REBUTS", "UNDERMINES", "UNDERCUTS"];
const ARG_ATTACK_TYPES: EdgeType[] = ["rebut", "undercut"];

interface ProngScore extends ConfidenceResult {
  id: string;
  title: string | null;
  mainClaimId: string | null;
}

interface ConfidenceResponse {
  computedAt: string;
  overall: ConfidenceResult;
  prongs: ProngScore[];
}

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

    // 1. Load thesis + prong structure.
    const thesis = await prisma.thesis.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        thesisClaimId: true,
        prongs: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            mainClaimId: true,
            arguments: {
              select: { argumentId: true },
            },
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

    // 2. Gather all prong argument ids + claim ids in one set, then batch-load
    //    everything needed for scoring in parallel.
    const allArgIds = Array.from(
      new Set(
        thesis.prongs.flatMap((p) => p.arguments.map((a) => a.argumentId)),
      ),
    );
    const allClaimIds = Array.from(
      new Set(
        [
          thesis.thesisClaimId,
          ...thesis.prongs.map((p) => p.mainClaimId),
        ].filter((x): x is string => Boolean(x)),
      ),
    );

    const [
      argRows,
      argInboundAttacks,
      cqRows,
      argEvidence,
      claimLabels,
      thesisClaimAttackEdges,
    ] = await Promise.all([
      allArgIds.length
        ? prisma.argument.findMany({
            where: { id: { in: allArgIds } },
            select: {
              id: true,
              conclusion: {
                select: {
                  ClaimLabel: { select: { label: true } },
                },
              },
            },
          })
        : Promise.resolve([] as any[]),
      allArgIds.length
        ? prisma.argumentEdge.findMany({
            where: {
              toArgumentId: { in: allArgIds },
              type: { in: ARG_ATTACK_TYPES },
            },
            select: {
              toArgumentId: true,
              fromArgumentId: true,
            },
          })
        : Promise.resolve([] as any[]),
      allArgIds.length
        ? prisma.cQStatus.findMany({
            where: {
              targetType: "argument",
              targetId: { in: allArgIds },
            },
            select: { targetId: true, statusEnum: true },
          })
        : Promise.resolve([] as any[]),
      allArgIds.length
        ? prisma.evidenceLink.findMany({
            where: {
              targetKind: "argument",
              targetId: { in: allArgIds },
            },
            select: { targetId: true },
          })
        : Promise.resolve([] as any[]),
      allClaimIds.length
        ? prisma.claim.findMany({
            where: { id: { in: allClaimIds } },
            select: {
              id: true,
              ClaimLabel: { select: { label: true } },
            },
          })
        : Promise.resolve([] as any[]),
      thesis.thesisClaimId
        ? prisma.claimEdge.findMany({
            where: {
              toClaimId: thesis.thesisClaimId,
              attackType: { in: CLAIM_ATTACK_TYPES },
            },
            select: { fromClaimId: true },
          })
        : Promise.resolve([] as any[]),
    ]);

    // 3. Compute counter-attack set so we can mark "defended" attacks.
    const argAttackerIds = Array.from(
      new Set(argInboundAttacks.map((e: any) => e.fromArgumentId)),
    );
    const counterAttackedArgs = new Set<string>();
    if (argAttackerIds.length > 0) {
      const counters = await prisma.argumentEdge.findMany({
        where: {
          toArgumentId: { in: argAttackerIds },
          type: { in: ARG_ATTACK_TYPES },
        },
        select: { toArgumentId: true },
      });
      for (const c of counters as any[]) counterAttackedArgs.add(c.toArgumentId);
    }

    const claimAttackerIds = Array.from(
      new Set(thesisClaimAttackEdges.map((e: any) => e.fromClaimId)),
    );
    const counterAttackedClaims = new Set<string>();
    if (claimAttackerIds.length > 0) {
      const counters = await prisma.claimEdge.findMany({
        where: {
          toClaimId: { in: claimAttackerIds },
          attackType: { in: CLAIM_ATTACK_TYPES },
        },
        select: { toClaimId: true },
      });
      for (const c of counters as any[]) counterAttackedClaims.add(c.toClaimId);
    }

    // 4. Index per-argument facts.
    const argLabelIn = new Set<string>();
    for (const a of argRows as any[]) {
      const label = a.conclusion?.ClaimLabel?.label as string | undefined;
      if (label === "IN") argLabelIn.add(a.id);
    }

    const cqByArg = new Map<string, { total: number; satisfied: number }>();
    for (const r of cqRows as any[]) {
      const b = cqByArg.get(r.targetId) ?? { total: 0, satisfied: 0 };
      b.total += 1;
      if (r.statusEnum && r.statusEnum !== "OPEN") b.satisfied += 1;
      cqByArg.set(r.targetId, b);
    }

    const evidenceArgs = new Set<string>();
    for (const e of argEvidence as any[]) {
      if (e.targetId) evidenceArgs.add(e.targetId);
    }

    const attacksByArg = new Map<string, { total: number; defended: number }>();
    for (const e of argInboundAttacks as any[]) {
      const b = attacksByArg.get(e.toArgumentId) ?? { total: 0, defended: 0 };
      b.total += 1;
      if (counterAttackedArgs.has(e.fromArgumentId)) b.defended += 1;
      attacksByArg.set(e.toArgumentId, b);
    }

    const claimLabelById = new Map<string, "IN" | "OUT" | "UNDEC" | null>();
    for (const c of claimLabels as any[]) {
      claimLabelById.set(c.id, (c.ClaimLabel?.label as any) ?? null);
    }

    // 5. Score each prong.
    const prongResults: ProngScore[] = thesis.prongs.map((p) => {
      const argIds = p.arguments.map((a) => a.argumentId);
      let cqTotal = 0;
      let cqSatisfied = 0;
      let attacksTotal = 0;
      let attacksDefended = 0;
      const argumentsWithEvidence: string[] = [];
      const argumentsLabeledIn: string[] = [];
      for (const id of argIds) {
        if (argLabelIn.has(id)) argumentsLabeledIn.push(id);
        if (evidenceArgs.has(id)) argumentsWithEvidence.push(id);
        const cq = cqByArg.get(id);
        if (cq) {
          cqTotal += cq.total;
          cqSatisfied += cq.satisfied;
        }
        const atk = attacksByArg.get(id);
        if (atk) {
          attacksTotal += atk.total;
          attacksDefended += atk.defended;
        }
      }
      const ev: ProngEvidence = {
        argumentIds: argIds,
        argumentsLabeledIn,
        cqTotal,
        cqSatisfied,
        attacksTotal,
        attacksDefended,
        argumentsWithEvidence,
      };
      const result = scoreProng(ev);
      return {
        id: p.id,
        title: p.title,
        mainClaimId: p.mainClaimId,
        ...result,
      };
    });

    // 6. Score the thesis as a whole.
    const thesisAttacksTotal = thesisClaimAttackEdges.length;
    const thesisAttacksUndefended = thesisClaimAttackEdges.filter(
      (e: any) => !counterAttackedClaims.has(e.fromClaimId),
    ).length;
    const thesisClaimLabel = thesis.thesisClaimId
      ? claimLabelById.get(thesis.thesisClaimId) ?? null
      : null;

    const overall = scoreThesis({
      prongScores: prongResults.map((p) => p.score),
      thesisClaimLabel,
      thesisAttacksTotal,
      thesisAttacksUndefended,
    });

    const response: ConfidenceResponse = {
      computedAt: new Date().toISOString(),
      overall,
      prongs: prongResults,
    };

    const { serialized } = instrumentReaderResponse({
      endpoint: "thesis.confidence",
      thesisId: params.id,
      authId,
      startedAt,
      body: response,
      cursor: response.computedAt,
      freshAt: response.computedAt,
      objectCount: prongResults.length,
      req,
    });

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[thesis/confidence] error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, ...NO_STORE },
    );
  }
}
