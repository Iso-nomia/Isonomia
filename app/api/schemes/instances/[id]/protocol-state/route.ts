// app/api/schemes/instances/[id]/protocol-state/route.ts
//
// Phase 4 phase 3c — read endpoint for `LatentObligationsPanel`.
// Returns the instance's protocol state joined with the CQ
// definitions, so the panel can render rows for `not-offered`
// obligations with full burden / evidence / premiseType hint copy.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  ensureObligationRowsForInstance,
  loadProtocolState,
} from "@/lib/schemes/protocol/protocolState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const instance = await prisma.schemeInstance.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      schemeId: true,
      targetType: true,
      targetId: true,
      status: true,
      createdAt: true,
      closedAt: true,
      scheme: {
        select: {
          key: true,
          title: true,
          cqs: {
            where: { instanceId: null },
            select: {
              id: true,
              cqKey: true,
              text: true,
              attackType: true,
              targetScope: true,
              burdenOfProof: true,
              requiresEvidence: true,
              premiseType: true,
            },
          },
        },
      },
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "instance not found" }, { status: 404 });
  }

  // Lazy-backfill rows for instances created before Phase 4 (no-op if
  // already populated).
  await ensureObligationRowsForInstance(instance.id);
  const state = await loadProtocolState(instance.id);

  // Join obligations to CQ definitions for the panel rows.
  const defByKey = new Map(
    (instance.scheme.cqs ?? []).map((c) => [c.cqKey, c])
  );
  const rows = state.obligations.map((o) => {
    const def = defByKey.get(o.cqKey);
    return {
      cqKey: o.cqKey,
      cqId: def?.id ?? null,
      status: o.status,
      burdenOfProof: o.burdenOfProof,
      requiresEvidence: o.requiresEvidence,
      premiseType: o.premiseType,
      subLocusId: o.subLocusId,
      closingMoveId: o.closingMoveId,
      evidenceRefs: o.evidenceRefs,
      // definition fields
      text: def?.text ?? null,
      attackType: def?.attackType ?? null,
      targetScope: def?.targetScope ?? null,
    };
  });

  return NextResponse.json({
    instance: {
      id: instance.id,
      schemeId: instance.schemeId,
      schemeKey: instance.scheme.key,
      schemeTitle: instance.scheme.title,
      targetType: instance.targetType,
      targetId: instance.targetId,
      status: instance.status,
      createdAt: instance.createdAt,
      closedAt: instance.closedAt,
    },
    obligations: rows,
  });
}
