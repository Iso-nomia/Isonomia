// lib/schemes/protocol/closeDeliberation.ts
//
// Phase 4 / Spec 3 §3.4 follow-on — iterate the close-hook over every
// open SchemeInstance attached to a deliberation's claims (and,
// where applicable, cards). Used by the deliberation-close path
// (when one exists) and by the admin endpoint at
// /api/deliberations/[id]/close-scheme-instances.
//
// Semantics: "open SchemeInstances attached to this deliberation"
// = rows where (targetType='claim' AND claim.deliberationId = id)
//   OR (targetType='card' AND card.deliberationId = id),
// with `status='open'`.

import { prisma } from "@/lib/prismaclient";
import { closeSchemeInstance } from "./closeInstance";
import type { SoundnessMode } from "./soundnessMode";
import { SoundnessViolationError } from "./soundnessGate";

export type DeliberationCloseSummary = {
  deliberationId: string;
  mode: SoundnessMode | "per-instance";
  scanned: number;
  closed: number;
  warnings: number;
  blocked: { instanceId: string; reason: string }[];
};

export type CloseDeliberationOptions = {
  closedById: string;
  /** Override the global flag for this run. */
  modeOverride?: SoundnessMode;
  /** Stop on the first block, else continue and collect blockers. */
  stopOnBlock?: boolean;
};

async function collectOpenInstanceIds(deliberationId: string): Promise<string[]> {
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: { id: true },
  });
  const claimIds = claims.map((c) => c.id);

  // cards may or may not have a deliberationId column depending on the
  // substrate's lineage; query defensively.
  let cardIds: string[] = [];
  try {
    const cards = await (prisma as any).card.findMany({
      where: { deliberationId },
      select: { id: true },
    });
    cardIds = (cards ?? []).map((c: any) => c.id);
  } catch {
    cardIds = [];
  }

  if (claimIds.length === 0 && cardIds.length === 0) return [];

  const rows = await prisma.schemeInstance.findMany({
    where: {
      status: "open",
      OR: [
        claimIds.length ? { targetType: "claim", targetId: { in: claimIds } } : undefined,
        cardIds.length ? { targetType: "card", targetId: { in: cardIds } } : undefined,
      ].filter(Boolean) as any[],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function closeAllSchemeInstancesForDeliberation(
  deliberationId: string,
  opts: CloseDeliberationOptions
): Promise<DeliberationCloseSummary> {
  const ids = await collectOpenInstanceIds(deliberationId);
  const summary: DeliberationCloseSummary = {
    deliberationId,
    mode: opts.modeOverride ?? "per-instance",
    scanned: ids.length,
    closed: 0,
    warnings: 0,
    blocked: [],
  };

  for (const id of ids) {
    try {
      const r = await closeSchemeInstance(id, {
        closedById: opts.closedById,
        modeOverride: opts.modeOverride,
      });
      summary.closed += 1;
      if (r.warningId) summary.warnings += 1;
    } catch (e) {
      if (e instanceof SoundnessViolationError) {
        summary.blocked.push({ instanceId: id, reason: e.message });
        if (opts.stopOnBlock) break;
      } else {
        throw e;
      }
    }
  }

  return summary;
}
