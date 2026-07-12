export const dynamic = "force-dynamic";

// app/api/thesis/[id]/live/route.ts
//
// Living Thesis — Phase 1.1: batched live-stats endpoint.
//
// GET /api/thesis/[id]/live
//
// Walks the thesis content + structured prongs to find all embedded
// deliberation objects (claims, arguments, propositions), then returns a
// single map of current stats for each one. The view page polls this via
// SWR (~30s, see Phase 1.2 hook) so embedded TipTap nodes can render live
// labels, attack counts, evidence counts, and last-changed timestamps.
//
// The shape is deliberately stable so that a future SSE/WebSocket transport
// (deferred — see docs/LIVING_THESIS_DEFERRED.md D3) can stream `{ cursor,
// objects }` deltas against the same schema.
//
// NOTE: Phase 1 keeps the auth model permissive (any authed user). Phase 7.2
// will tighten this against `packages/sheaf-acl` deliberation membership.

import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prismaclient";
import type { ClaimAttackType, EdgeType } from "@prisma/client";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import {
  collectEmbeddedObjects,
  mergeStructuredRefs,
} from "@/lib/thesis/embedded-objects";
import { checkThesisReadable } from "@/lib/thesis/permissions";
import { instrumentReaderResponse } from "@/lib/thesis/observability";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

type GroundLabel = "IN" | "OUT" | "UNDEC";

interface LiveObjectStats {
  kind: "claim" | "argument" | "proposition" | "chain";
  label?: GroundLabel;
  attackCount: number;
  undefendedAttackCount: number;
  defendedAttackCount: number;
  /** Reserved for explicit concession state; always 0 in Phase 1. */
  concededAttackCount: number;
  supportCount: number;
  evidenceCount: number;
  cqSatisfied?: number;
  cqTotal?: number;
  lastChangedAt: string;
  status?: string;
  /** Chain-only: number of nodes in the chain. */
  nodeCount?: number;
  /** Chain-only: number of edges in the chain. */
  edgeCount?: number;
}

interface LiveResponse {
  cursor: string;
  computedAt: string;
  objects: Record<string, LiveObjectStats>;
}

const CLAIM_ATTACK_TYPES: ClaimAttackType[] = [
  "REBUTS",
  "UNDERMINES",
  "UNDERCUTS",
];
// EdgeType enum values are singular (`rebut`, `undercut`); there is no
// `undermines` variant on ArgumentEdge — undermining attacks live on
// ClaimEdge against premise claims.
const ARG_ATTACK_TYPES: EdgeType[] = ["rebut", "undercut"];

function maxIso(...values: Array<Date | string | null | undefined>): string {
  let max = 0;
  for (const v of values) {
    if (!v) continue;
    const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  }
  return new Date(max || Date.now()).toISOString();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const startedAt = Date.now();
  try {
    const authId = await getCurrentUserAuthId();

    // Phase 7.2: gate on author / published / deliberation participant.
    const gate = await checkThesisReadable(authId, params.id);
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message },
        { status: gate.status, ...NO_STORE },
      );
    }

    // 1. Load thesis + structured prong refs (permission gate already
    //    confirmed existence, but we still need the content + prong shape).
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

    // 2. Discover embedded ids from content + structured prongs.
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

    const objects: Record<string, LiveObjectStats> = {};

    // 3. Batch-load claims with labels.
    if (inventory.claimIds.length > 0) {
      const [claims, claimAttackEdges, claimSupportEdges, claimEvidence] =
        await Promise.all([
          prisma.claim.findMany({
            where: { id: { in: inventory.claimIds } },
            select: {
              id: true,
              createdAt: true,
              ClaimLabel: { select: { label: true, computedAt: true } },
            },
          }),
          prisma.claimEdge.findMany({
            where: {
              toClaimId: { in: inventory.claimIds },
              attackType: { in: CLAIM_ATTACK_TYPES },
            },
            select: {
              toClaimId: true,
              fromClaimId: true,
              createdAt: true,
            },
          }),
          prisma.claimEdge.findMany({
            where: {
              toClaimId: { in: inventory.claimIds },
              type: "supports",
            },
            select: { toClaimId: true, createdAt: true },
          }),
          prisma.evidenceLink.findMany({
            where: {
              targetKind: "claim",
              targetId: { in: inventory.claimIds },
            },
            select: { targetId: true, createdAt: true },
          }),
        ]);

      // Pre-compute which fromClaimIds are themselves attacked
      // (used to approximate "defended" attackers in V1).
      const attackerIds = Array.from(
        new Set(claimAttackEdges.map((e) => e.fromClaimId)),
      );
      const counterAttacked = new Set<string>();
      if (attackerIds.length > 0) {
        const counter = await prisma.claimEdge.findMany({
          where: {
            toClaimId: { in: attackerIds },
            attackType: { in: CLAIM_ATTACK_TYPES },
          },
          select: { toClaimId: true },
        });
        for (const e of counter) counterAttacked.add(e.toClaimId);
      }

      const claimById = new Map(claims.map((c) => [c.id, c]));
      const attacksByClaim = new Map<
        string,
        { count: number; defended: number; latest?: Date }
      >();
      for (const e of claimAttackEdges) {
        const bucket = attacksByClaim.get(e.toClaimId) ?? {
          count: 0,
          defended: 0,
        };
        bucket.count += 1;
        if (counterAttacked.has(e.fromClaimId)) bucket.defended += 1;
        if (!bucket.latest || e.createdAt > bucket.latest) {
          bucket.latest = e.createdAt;
        }
        attacksByClaim.set(e.toClaimId, bucket);
      }

      const supportByClaim = new Map<string, { count: number; latest?: Date }>();
      for (const e of claimSupportEdges) {
        const bucket = supportByClaim.get(e.toClaimId) ?? { count: 0 };
        bucket.count += 1;
        if (!bucket.latest || e.createdAt > bucket.latest) {
          bucket.latest = e.createdAt;
        }
        supportByClaim.set(e.toClaimId, bucket);
      }

      const evidenceByClaim = new Map<
        string,
        { count: number; latest?: Date }
      >();
      for (const link of claimEvidence) {
        if (!link.targetId) continue;
        const bucket = evidenceByClaim.get(link.targetId) ?? { count: 0 };
        bucket.count += 1;
        if (!bucket.latest || link.createdAt > bucket.latest) {
          bucket.latest = link.createdAt;
        }
        evidenceByClaim.set(link.targetId, bucket);
      }

      for (const id of inventory.claimIds) {
        const claim = claimById.get(id);
        const atk = attacksByClaim.get(id) ?? { count: 0, defended: 0 };
        const sup = supportByClaim.get(id) ?? { count: 0 };
        const ev = evidenceByClaim.get(id) ?? { count: 0 };

        objects[id] = {
          kind: "claim",
          label: (claim?.ClaimLabel?.label as GroundLabel | undefined) ?? undefined,
          attackCount: atk.count,
          undefendedAttackCount: atk.count - atk.defended,
          defendedAttackCount: atk.defended,
          concededAttackCount: 0,
          supportCount: sup.count,
          evidenceCount: ev.count,
          lastChangedAt: maxIso(
            claim?.createdAt,
            claim?.ClaimLabel?.computedAt,
            atk.latest,
            sup.latest,
            ev.latest,
          ),
        };
      }
    }

    // 4. Batch-load arguments with conclusion labels, attacks, CQs, evidence.
    if (inventory.argumentIds.length > 0) {
      const [args, argAttackEdges, cqStatuses, argEvidence] = await Promise.all([
        prisma.argument.findMany({
          where: { id: { in: inventory.argumentIds } },
          select: {
            id: true,
            createdAt: true,
            lastUpdatedAt: true,
            conclusionClaimId: true,
            conclusion: {
              select: {
                ClaimLabel: { select: { label: true, computedAt: true } },
              },
            },
          },
        }),
        prisma.argumentEdge.findMany({
          where: {
            toArgumentId: { in: inventory.argumentIds },
            type: { in: ARG_ATTACK_TYPES },
          },
          select: {
            toArgumentId: true,
            fromArgumentId: true,
            createdAt: true,
          },
        }),
        prisma.cQStatus.findMany({
          where: {
            targetType: "argument",
            targetId: { in: inventory.argumentIds },
          },
          select: {
            targetId: true,
            statusEnum: true,
            updatedAt: true,
          },
        }),
        prisma.evidenceLink.findMany({
          where: {
            targetKind: "argument",
            targetId: { in: inventory.argumentIds },
          },
          select: { targetId: true, createdAt: true },
        }),
      ]);

      // Counter-attack approximation: arguments that themselves attack the
      // attacker get credited as "defended" for V1.
      const attackerIds = Array.from(
        new Set(argAttackEdges.map((e) => e.fromArgumentId)),
      );
      const counterAttacked = new Set<string>();
      if (attackerIds.length > 0) {
        const counter = await prisma.argumentEdge.findMany({
          where: {
            toArgumentId: { in: attackerIds },
            type: { in: ARG_ATTACK_TYPES },
          },
          select: { toArgumentId: true },
        });
        for (const e of counter) counterAttacked.add(e.toArgumentId);
      }

      const argById = new Map(args.map((a) => [a.id, a]));
      const attacksByArg = new Map<
        string,
        { count: number; defended: number; latest?: Date }
      >();
      for (const e of argAttackEdges) {
        const bucket = attacksByArg.get(e.toArgumentId) ?? {
          count: 0,
          defended: 0,
        };
        bucket.count += 1;
        if (counterAttacked.has(e.fromArgumentId)) bucket.defended += 1;
        if (!bucket.latest || e.createdAt > bucket.latest) {
          bucket.latest = e.createdAt;
        }
        attacksByArg.set(e.toArgumentId, bucket);
      }

      const cqByArg = new Map<
        string,
        { total: number; satisfied: number; latest?: Date }
      >();
      for (const s of cqStatuses) {
        const bucket = cqByArg.get(s.targetId) ?? { total: 0, satisfied: 0 };
        bucket.total += 1;
        // Treat ANSWERED / RESOLVED / SATISFIED-style enum values as satisfied.
        // Conservative: anything other than OPEN counts as addressed.
        if (s.statusEnum && s.statusEnum !== "OPEN") bucket.satisfied += 1;
        if (!bucket.latest || s.updatedAt > bucket.latest) {
          bucket.latest = s.updatedAt;
        }
        cqByArg.set(s.targetId, bucket);
      }

      const evidenceByArg = new Map<
        string,
        { count: number; latest?: Date }
      >();
      for (const link of argEvidence) {
        if (!link.targetId) continue;
        const bucket = evidenceByArg.get(link.targetId) ?? { count: 0 };
        bucket.count += 1;
        if (!bucket.latest || link.createdAt > bucket.latest) {
          bucket.latest = link.createdAt;
        }
        evidenceByArg.set(link.targetId, bucket);
      }

      for (const id of inventory.argumentIds) {
        const arg = argById.get(id);
        const atk = attacksByArg.get(id) ?? { count: 0, defended: 0 };
        const cq = cqByArg.get(id);
        const ev = evidenceByArg.get(id) ?? { count: 0 };

        objects[id] = {
          kind: "argument",
          label:
            (arg?.conclusion?.ClaimLabel?.label as GroundLabel | undefined) ??
            undefined,
          attackCount: atk.count,
          undefendedAttackCount: atk.count - atk.defended,
          defendedAttackCount: atk.defended,
          concededAttackCount: 0,
          supportCount: 0,
          evidenceCount: ev.count,
          cqSatisfied: cq?.satisfied,
          cqTotal: cq?.total,
          lastChangedAt: maxIso(
            arg?.lastUpdatedAt,
            arg?.createdAt,
            arg?.conclusion?.ClaimLabel?.computedAt,
            atk.latest,
            cq?.latest,
            ev.latest,
          ),
        };
      }
    }

    // 5. Batch-load propositions (no attack semantics in V1; status only).
    if (inventory.propositionIds.length > 0) {
      const props = await prisma.proposition.findMany({
        where: { id: { in: inventory.propositionIds } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const propById = new Map(props.map((p) => [p.id, p]));

      for (const id of inventory.propositionIds) {
        const p = propById.get(id);
        objects[id] = {
          kind: "proposition",
          attackCount: 0,
          undefendedAttackCount: 0,
          defendedAttackCount: 0,
          concededAttackCount: 0,
          supportCount: 0,
          evidenceCount: 0,
          status: p?.status,
          lastChangedAt: maxIso(p?.updatedAt, p?.createdAt),
        };
      }
    }

    // 7. D4 Week 1–2: chains. Aggregate member-argument stats from `objects`
    //    when available (avoids re-querying), and back-fill any missing
    //    member arguments with a lightweight pass.
    if (inventory.chainIds.length > 0) {
      const chains = await prisma.argumentChain.findMany({
        where: { id: { in: inventory.chainIds } },
        select: {
          id: true,
          updatedAt: true,
          createdAt: true,
          _count: { select: { nodes: true, edges: true } },
          nodes: {
            select: {
              argumentId: true,
            },
          },
        },
      });

      // Find any member argumentIds not yet covered by section 4.
      const knownArgIds = new Set(inventory.argumentIds);
      const extraArgIds = new Set<string>();
      for (const c of chains) {
        for (const n of c.nodes) {
          if (!knownArgIds.has(n.argumentId) && !objects[n.argumentId]) {
            extraArgIds.add(n.argumentId);
          }
        }
      }

      // Lightweight stats fetch for extra args (attacks + last-updated only;
      // chain rollup does not need CQ/evidence detail).
      const extraStats = new Map<
        string,
        { attackCount: number; undefended: number; lastChangedAt: string }
      >();
      if (extraArgIds.size > 0) {
        const extraArgIdList = Array.from(extraArgIds);
        const [extraArgs, extraEdges] = await Promise.all([
          prisma.argument.findMany({
            where: { id: { in: extraArgIdList } },
            select: { id: true, lastUpdatedAt: true, createdAt: true },
          }),
          prisma.argumentEdge.findMany({
            where: {
              toArgumentId: { in: extraArgIdList },
              type: { in: ARG_ATTACK_TYPES },
            },
            select: {
              toArgumentId: true,
              fromArgumentId: true,
              createdAt: true,
            },
          }),
        ]);

        const extraAttackerIds = Array.from(
          new Set(extraEdges.map((e) => e.fromArgumentId)),
        );
        const extraCounter = new Set<string>();
        if (extraAttackerIds.length > 0) {
          const counter = await prisma.argumentEdge.findMany({
            where: {
              toArgumentId: { in: extraAttackerIds },
              type: { in: ARG_ATTACK_TYPES },
            },
            select: { toArgumentId: true },
          });
          for (const e of counter) extraCounter.add(e.toArgumentId);
        }

        const argMeta = new Map(extraArgs.map((a) => [a.id, a]));
        const buckets = new Map<
          string,
          { count: number; defended: number; latest?: Date }
        >();
        for (const e of extraEdges) {
          const b = buckets.get(e.toArgumentId) ?? { count: 0, defended: 0 };
          b.count += 1;
          if (extraCounter.has(e.fromArgumentId)) b.defended += 1;
          if (!b.latest || e.createdAt > b.latest) b.latest = e.createdAt;
          buckets.set(e.toArgumentId, b);
        }
        for (const id of extraArgIdList) {
          const meta = argMeta.get(id);
          const b = buckets.get(id) ?? { count: 0, defended: 0 };
          extraStats.set(id, {
            attackCount: b.count,
            undefended: b.count - b.defended,
            lastChangedAt: maxIso(
              meta?.lastUpdatedAt,
              meta?.createdAt,
              b.latest,
            ),
          });
        }
      }

      for (const c of chains) {
        let attackCount = 0;
        let undefendedAttackCount = 0;
        let defendedAttackCount = 0;
        let supportCount = 0;
        let evidenceCount = 0;
        let cqSatisfied = 0;
        let cqTotal = 0;
        let latest = c.updatedAt.getTime();

        for (const n of c.nodes) {
          const stats = objects[n.argumentId];
          if (stats) {
            attackCount += stats.attackCount;
            undefendedAttackCount += stats.undefendedAttackCount;
            defendedAttackCount += stats.defendedAttackCount;
            supportCount += stats.supportCount;
            evidenceCount += stats.evidenceCount;
            if (typeof stats.cqSatisfied === "number") cqSatisfied += stats.cqSatisfied;
            if (typeof stats.cqTotal === "number") cqTotal += stats.cqTotal;
            const t = new Date(stats.lastChangedAt).getTime();
            if (Number.isFinite(t) && t > latest) latest = t;
          } else {
            const ex = extraStats.get(n.argumentId);
            if (ex) {
              attackCount += ex.attackCount;
              undefendedAttackCount += ex.undefended;
              defendedAttackCount += ex.attackCount - ex.undefended;
              const t = new Date(ex.lastChangedAt).getTime();
              if (Number.isFinite(t) && t > latest) latest = t;
            }
          }
        }

        objects[c.id] = {
          kind: "chain",
          attackCount,
          undefendedAttackCount,
          defendedAttackCount,
          concededAttackCount: 0,
          supportCount,
          evidenceCount,
          cqSatisfied: cqTotal > 0 ? cqSatisfied : undefined,
          cqTotal: cqTotal > 0 ? cqTotal : undefined,
          nodeCount: c._count?.nodes ?? c.nodes.length,
          edgeCount: c._count?.edges ?? 0,
          lastChangedAt: new Date(latest || Date.now()).toISOString(),
        };
      }
    }

    // 6. Build cursor (max lastChangedAt across the payload).
    const computedAt = new Date().toISOString();
    let cursorMs = 0;
    for (const v of Object.values(objects)) {
      const t = new Date(v.lastChangedAt).getTime();
      if (Number.isFinite(t) && t > cursorMs) cursorMs = t;
    }
    const cursor = new Date(cursorMs || Date.now()).toISOString();

    const body: LiveResponse = { cursor, computedAt, objects };

    // Phase 7.1: emit a single structured log line per poll.
    const { serialized } = instrumentReaderResponse({
      endpoint: "thesis.live",
      thesisId: params.id,
      authId,
      startedAt,
      body,
      cursor,
      freshAt: cursor,
      objectCount: Object.keys(objects).length,
      req,
    });

    return new NextResponse(serialized, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[thesis/:id/live GET] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to load live stats" },
      { status: 500, ...NO_STORE },
    );
  }
}
