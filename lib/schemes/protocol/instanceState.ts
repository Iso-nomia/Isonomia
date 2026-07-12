// lib/schemes/protocol/instanceState.ts
//
// Roadmap E2 (SCHEMES_MCP_ALIGNMENT §3) — the consumer-facing projection of a
// `SchemeInstance`'s CQ-obligation state. This is the single read surface shared
// by:
//   • GET /api/scheme-instances/[id]/state          (E2 endpoint)
//   • get_argument's `schemeInstance` block          (A.2, mirrors this shape)
//   • propose_structured_argument's return shape      (B.1, when E2 lands)
//
// It reuses the Spec 3 close-gate evaluator verbatim for `closeHookEligible`
// (`checkSoundnessOnClose`) — never re-deriving the close rule — and reads
// `premiseType` / `attackKind` straight from the shipped `CriticalQuestion`
// columns. No writes; backfills latent obligation rows first so pre-Phase-4
// instances project a full bundle.

import { prisma as defaultPrisma } from "@/lib/prismaclient";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ensureObligationRowsForInstance,
  type CqObligationRecord,
  type CqObligationStatus,
  type BurdenOfProof,
  type PremiseTypeValue,
  type SchemeInstanceProtocolState,
} from "./protocolState";
import { checkSoundnessOnClose } from "./soundnessGate";

type Tx = PrismaClient | Prisma.TransactionClient;

const CLOSING_STATUSES: ReadonlySet<CqObligationStatus> = new Set([
  "discharged",
  "failed",
  "waived",
]);

export type OpenObligation = {
  cqId: string | null;
  cqKey: string;
  text: string | null;
  attackKind: string | null;
  premiseType: PremiseTypeValue | null;
  burdenOfProof: BurdenOfProof;
  requiresEvidence: boolean;
  /**
   * Derived (no column): a CQ is "scheme-required" iff it must be actively
   * adjudicated for the instance to close. Carneades `ASSUMPTION` premises
   * auto-waive at gate-check time (soundnessGate.autoWaiveAssumptions), so they
   * are NOT required; `ORDINARY` / `EXCEPTION` / unset are.
   */
  isSchemeRequired: boolean;
  /**
   * Derived (no column): true iff the CQ definition is anchored on a different
   * scheme than the instance's own scheme (i.e. pulled in from a parent). At the
   * current baseline obligation rows are materialised only from the instance's
   * own `scheme.cqs`, so this is `false` for every present row — forward-looking
   * insurance for when parent-CQ inheritance is materialised into the bundle.
   */
  inheritedFromParentScheme: boolean;
  status: CqObligationStatus;
};

export type DischargedObligation = {
  cqId: string | null;
  cqKey: string;
  status: CqObligationStatus;
  dischargedByMoveId: string | null;
  dischargedAt: string | null;
};

export type SchemeInstanceStateProjection =
  | { error: "instance-not-found"; instanceId: string }
  | {
      id: string;
      schemeId: string;
      schemeKey: string | null;
      status: string; // "open" | "closed" | "failed"
      openObligations: OpenObligation[];
      dischargedObligations: DischargedObligation[];
      closeHookEligible: boolean;
      lastTransitionAt: string | null;
    };

type ObligationRow = {
  cqKey: string;
  status: string;
  burdenOfProof: string;
  requiresEvidence: boolean;
  premiseType: string | null;
  subLocusId: string | null;
  closingMoveId: string | null;
  evidenceRefs: string[];
  updatedAt: Date;
};

type CqDef = {
  id: string;
  cqKey: string | null;
  text: string;
  attackKind: string;
  premiseType: string | null;
  schemeId: string | null;
};

/**
 * Project a `SchemeInstance`'s obligation state for read consumers. Idempotently
 * backfills missing obligation rows first (so pre-Phase-4 instances are complete),
 * then renders the open/discharged split + the live close-gate verdict.
 */
export async function projectSchemeInstanceState(
  instanceId: string,
  tx: Tx = defaultPrisma,
): Promise<SchemeInstanceStateProjection> {
  // Backfill is a no-op once populated; uses the default client (writes).
  await ensureObligationRowsForInstance(instanceId);

  const instance = (await tx.schemeInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      schemeId: true,
      status: true,
      closedAt: true,
      scheme: {
        select: {
          key: true,
          cqs: {
            where: { instanceId: null },
            select: {
              id: true,
              cqKey: true,
              text: true,
              attackKind: true,
              premiseType: true,
              schemeId: true,
            },
          },
        },
      },
      obligations: {
        select: {
          cqKey: true,
          status: true,
          burdenOfProof: true,
          requiresEvidence: true,
          premiseType: true,
          subLocusId: true,
          closingMoveId: true,
          evidenceRefs: true,
          updatedAt: true,
        },
      },
    },
  })) as
    | {
        id: string;
        schemeId: string;
        status: string;
        closedAt: Date | null;
        scheme: { key: string | null; cqs: CqDef[] };
        obligations: ObligationRow[];
      }
    | null;

  if (!instance) return { error: "instance-not-found", instanceId };

  const defByKey = new Map<string, CqDef>();
  for (const c of instance.scheme.cqs) {
    if (c.cqKey) defByKey.set(c.cqKey, c);
  }

  // Reconstruct the protocol-state shape the close-gate evaluator expects.
  const state: SchemeInstanceProtocolState = {
    instanceId: instance.id,
    schemeId: instance.schemeId,
    obligations: instance.obligations.map(
      (o): CqObligationRecord => ({
        cqKey: o.cqKey,
        status: o.status as CqObligationStatus,
        burdenOfProof: o.burdenOfProof as BurdenOfProof,
        requiresEvidence: o.requiresEvidence,
        premiseType: (o.premiseType as PremiseTypeValue) ?? null,
        subLocusId: o.subLocusId,
        closingMoveId: o.closingMoveId,
        evidenceRefs: o.evidenceRefs,
      }),
    ),
  };

  const verdict = checkSoundnessOnClose(state);

  const openObligations: OpenObligation[] = [];
  const dischargedObligations: DischargedObligation[] = [];

  for (const o of instance.obligations) {
    const def = defByKey.get(o.cqKey) ?? null;
    const premiseType = (o.premiseType as PremiseTypeValue) ?? null;
    const status = o.status as CqObligationStatus;

    if (status === "discharged") {
      dischargedObligations.push({
        cqId: def?.id ?? null,
        cqKey: o.cqKey,
        status,
        dischargedByMoveId: o.closingMoveId,
        dischargedAt: o.updatedAt.toISOString(),
      });
      continue;
    }

    if (!CLOSING_STATUSES.has(status)) {
      openObligations.push({
        cqId: def?.id ?? null,
        cqKey: o.cqKey,
        text: def?.text ?? null,
        attackKind: def?.attackKind ?? null,
        premiseType,
        burdenOfProof: o.burdenOfProof as BurdenOfProof,
        requiresEvidence: o.requiresEvidence,
        isSchemeRequired: premiseType !== "ASSUMPTION",
        inheritedFromParentScheme:
          def?.schemeId != null && def.schemeId !== instance.schemeId,
        status,
      });
    }
    // status === "failed" | "waived" → terminal but not "discharged"; excluded
    // from both lists (they are resolved, not open, and not a positive discharge).
  }

  // No dedicated lastTransitionAt column; derive as the most recent obligation
  // update (or the instance close time), whichever is later.
  let lastTransition: Date | null = instance.closedAt;
  for (const o of instance.obligations) {
    if (!lastTransition || o.updatedAt > lastTransition) lastTransition = o.updatedAt;
  }

  return {
    id: instance.id,
    schemeId: instance.schemeId,
    schemeKey: instance.scheme.key,
    status: instance.status,
    openObligations,
    dischargedObligations,
    closeHookEligible: verdict.ok,
    lastTransitionAt: lastTransition ? lastTransition.toISOString() : null,
  };
}
