// lib/schemes/protocol/protocolState.ts
//
// Phase 4 / Spec 3 §3.2 — per-instance CQ-locus obligation state.
//
// This module is the single read/write surface for `CqObligationRecord`
// rows. Soundness gate (§3.3) reads it; sub-locus event handlers
// (dialogue moves, counter-posts) write it.
//
// Invariants enforced here:
//   - exactly one record per (instanceId, cqKey)
//   - `not-offered` is the only legal initial status
//   - transitions are validated by `isLegalTransition` below
//   - protocol clauses (burden / evidence / premiseType) are
//     materialised from the parent `CriticalQuestion` row at create
//     time so the gate doesn't need a second hop.

import { prisma } from "@/lib/prismaclient";

export type CqObligationStatus =
  | "not-offered"
  | "offered-open"
  | "offered-engaged"
  | "discharged"
  | "failed"
  | "waived";

export type BurdenOfProof = "PROPONENT" | "OPPONENT" | "CHALLENGER";

export type PremiseTypeValue = "ORDINARY" | "ASSUMPTION" | "EXCEPTION";

export type CqObligationRecord = {
  cqKey: string;
  status: CqObligationStatus;
  burdenOfProof: BurdenOfProof;
  requiresEvidence: boolean;
  premiseType: PremiseTypeValue | null;
  subLocusId: string | null;
  closingMoveId: string | null;
  evidenceRefs: string[];
};

export type SchemeInstanceProtocolState = {
  instanceId: string;
  schemeId: string;
  obligations: CqObligationRecord[];
};

/**
 * Allowed transitions per Spec 3 §3.2. The gate trusts these:
 *   not-offered    -> offered-open | waived
 *   offered-open   -> offered-engaged | discharged | failed | waived
 *   offered-engaged -> discharged | failed
 *   discharged / failed / waived are terminal
 */
const LEGAL_TRANSITIONS: Record<CqObligationStatus, ReadonlySet<CqObligationStatus>> = {
  "not-offered": new Set(["offered-open", "waived"]),
  "offered-open": new Set(["offered-engaged", "discharged", "failed", "waived"]),
  "offered-engaged": new Set(["discharged", "failed"]),
  discharged: new Set(),
  failed: new Set(),
  waived: new Set(),
};

export function isLegalTransition(
  from: CqObligationStatus,
  to: CqObligationStatus
): boolean {
  return LEGAL_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Idempotent: creates `not-offered` rows for every CQ on the instance's
 * scheme that doesn't yet have a record. Called by the backfill script
 * and as a safety net at gate-check time.
 *
 * Returns the number of rows created.
 */
export async function ensureObligationRowsForInstance(
  instanceId: string
): Promise<number> {
  const instance = await prisma.schemeInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      schemeId: true,
      scheme: {
        select: {
          cqs: {
            where: { instanceId: null }, // catalogue-level CQ definitions
            select: {
              cqKey: true,
              burdenOfProof: true,
              requiresEvidence: true,
              premiseType: true,
            },
          },
        },
      },
      obligations: { select: { cqKey: true } },
    },
  });

  if (!instance) return 0;
  const existing = new Set(instance.obligations.map((o) => o.cqKey));
  const missing = (instance.scheme.cqs ?? []).filter(
    (cq): cq is typeof cq & { cqKey: string } =>
      Boolean(cq.cqKey) && !existing.has(cq.cqKey as string)
  );
  if (missing.length === 0) return 0;

  await prisma.cqObligationRecord.createMany({
    data: missing.map((cq) => ({
      instanceId,
      cqKey: cq.cqKey,
      status: "not-offered",
      burdenOfProof: cq.burdenOfProof,
      requiresEvidence: cq.requiresEvidence,
      premiseType: cq.premiseType,
    })),
    skipDuplicates: true,
  });
  return missing.length;
}

export async function loadProtocolState(
  instanceId: string
): Promise<SchemeInstanceProtocolState> {
  const instance = await prisma.schemeInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      schemeId: true,
      obligations: true,
    },
  });
  if (!instance) {
    throw new Error(`SchemeInstance ${instanceId} not found`);
  }
  return {
    instanceId: instance.id,
    schemeId: instance.schemeId,
    obligations: instance.obligations.map((o) => ({
      cqKey: o.cqKey,
      status: o.status as CqObligationStatus,
      burdenOfProof: o.burdenOfProof as BurdenOfProof,
      requiresEvidence: o.requiresEvidence,
      premiseType: (o.premiseType as PremiseTypeValue) ?? null,
      subLocusId: o.subLocusId,
      closingMoveId: o.closingMoveId,
      evidenceRefs: o.evidenceRefs,
    })),
  };
}

export type ObligationTransition = {
  to: CqObligationStatus;
  moveId?: string | null;
  subLocusId?: string | null;
  evidenceRefs?: string[];
};

/**
 * Records a transition for (instanceId, cqKey). If no row exists yet,
 * one is created with `not-offered` and then transitioned. Rejects
 * illegal transitions with a thrown Error (caller decides whether to
 * swallow — sub-locus handlers should NOT crash on a race).
 *
 * Returns the post-transition record, or null if the (instanceId, cqKey)
 * pair is unknown to the scheme (defensive: callers may pass cqKeys
 * derived from move payloads that don't match the scheme's bundle).
 */
export async function recordObligationTransition(
  instanceId: string,
  cqKey: string,
  transition: ObligationTransition
): Promise<CqObligationRecord | null> {
  await ensureObligationRowsForInstance(instanceId);

  const existing = await prisma.cqObligationRecord.findUnique({
    where: { instanceId_cqKey: { instanceId, cqKey } },
  });
  if (!existing) {
    // cqKey is not part of this scheme's bundle; soft no-op.
    return null;
  }

  const from = existing.status as CqObligationStatus;
  if (!isLegalTransition(from, transition.to)) {
    throw new Error(
      `illegal obligation transition: instance=${instanceId} cq=${cqKey} ${from} -> ${transition.to}`
    );
  }

  const updated = await prisma.cqObligationRecord.update({
    where: { instanceId_cqKey: { instanceId, cqKey } },
    data: {
      status: transition.to,
      subLocusId: transition.subLocusId ?? existing.subLocusId,
      closingMoveId:
        transition.to === "discharged" ||
        transition.to === "failed" ||
        transition.to === "waived"
          ? transition.moveId ?? existing.closingMoveId
          : existing.closingMoveId,
      evidenceRefs:
        transition.evidenceRefs && transition.evidenceRefs.length > 0
          ? transition.evidenceRefs
          : existing.evidenceRefs,
    },
  });

  return {
    cqKey: updated.cqKey,
    status: updated.status as CqObligationStatus,
    burdenOfProof: updated.burdenOfProof as BurdenOfProof,
    requiresEvidence: updated.requiresEvidence,
    premiseType: (updated.premiseType as PremiseTypeValue) ?? null,
    subLocusId: updated.subLocusId,
    closingMoveId: updated.closingMoveId,
    evidenceRefs: updated.evidenceRefs,
  };
}
