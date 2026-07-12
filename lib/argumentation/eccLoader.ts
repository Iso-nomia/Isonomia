// lib/argumentation/eccLoader.ts
// Sprint E1 — server-only loader that materializes the per-claim ECC
// `Arrow` (and the side-data needed to evaluate it) directly from Prisma.
// Used by the `app/api/v3/deliberations/[id]/ecc/*` routes that back the
// MCP tools, so the MCP surface can answer per-claim algebraic questions
// (culprits, confidence, structural meta, isLogical) without re-deriving
// the whole deliberation through the legacy evidential pipeline.
//
// Citations: Ambler 1996 §§2-4 (the algebra) +
//   `Development and Ideation Documents/ARCHITECTURE/ECC_REFINEMENT_AND_MCP_INTEGRATION_PLAN.md` §A1, §E1.
// Binding contracts (ECC plan §4):
//   • Row 1 (`isLogical` is strict): we forward Prisma-stored
//     `AssumptionUse.status` verbatim — only `ACCEPTED` lifts a derivation.
//   • Row 3 (AI-flagged warrants): we read `Argument.authorKind` and treat
//     `AI`/`HYBRID` derivations without an explicit ratification record as
//     non-logical regardless of assumption closure.
//   • Row 5 (closed monoid registry): the `mode` parameter is a closed
//     enum here; routes MUST refuse anything outside it.

import { prisma } from "@/lib/prismaclient";
import {
  type Arrow,
  type AssumptionId,
  type AssumptionStatus,
  type AuthorKind,
  type DerivationId,
  type DerivationProvenance,
  type ConfidenceMonoid,
  arrowMeta,
  confidence,
  culpritSets as algebraCulpritSets,
  isEntire,
  isLogical,
  isSelected,
  isSimple,
  withMinScores,
  withProductScores,
  withLogoddsScores,
  zero,
  type CulpritSet,
} from "./ecc";

export type Mode = "min" | "product" | "logodds";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export interface LoadedClaimArrow {
  claimId: string;
  arrow: Arrow<"I", string>;
  /** Per-derivation scalar score (used as `base(d)` in the confidence monoids). */
  scoresByDeriv: Map<DerivationId, number>;
  /** AssumptionUse.status keyed by id — drives the strict `logical` predicate. */
  assumptionStatus: Map<AssumptionId, AssumptionStatus>;
  /** Per-derivation provenance (authorKind + ratification). */
  derivationProvenance: Map<DerivationId, DerivationProvenance>;
  /** Hydrated derivation rows — for the audit/citation view. */
  derivations: Array<{
    derivationId: DerivationId;
    argumentId: string;
    argumentText: string | null;
    base: number;
    authorKind: AuthorKind;
    assumptionIds: string[];
  }>;
}

/**
 * Load the typed ECC `Arrow` for one claim in one deliberation.
 *
 * Returns `null` when the claim has no `ArgumentSupport` rows in this
 * deliberation (honest-empty rather than a synthesized empty arrow — the
 * MCP layer surfaces this as "no derivations on file" instead of
 * "score = 0").
 *
 * @invariant The returned arrow has `arrow.from === "I"` and
 *   `arrow.to === claimId`. Each `ArgumentSupport` row becomes exactly
 *   one derivation. The derivation's assumption set is the union of its
 *   `DerivationAssumption` rows; if none, we fall back to argument-level
 *   `AssumptionUse` rows (parity with the legacy evidential pipeline).
 */
export async function loadClaimArrow(
  deliberationId: string,
  claimId: string,
): Promise<LoadedClaimArrow | null> {
  const supports = await prisma.argumentSupport.findMany({
    where: { deliberationId, claimId },
    select: { id: true, argumentId: true, base: true },
  });
  if (supports.length === 0) return null;

  const argIds = Array.from(new Set(supports.map((s) => s.argumentId)));
  const derivIds = supports.map((s) => s.id);

  const [derivAssumps, uses, args] = await Promise.all([
    prisma.derivationAssumption.findMany({
      where: { derivationId: { in: derivIds } },
      select: { derivationId: true, assumptionId: true, weight: true },
    }),
    prisma.assumptionUse.findMany({
      where: { argumentId: { in: argIds } },
      select: { id: true, status: true, argumentId: true, weight: true },
    }),
    prisma.argument.findMany({
      where: { id: { in: argIds } },
      select: { id: true, text: true, authorKind: true },
    }),
  ]);

  const argById = new Map(args.map((a) => [a.id, a]));
  const usesByArg = new Map<string, typeof uses>();
  for (const u of uses) {
    if (!u.argumentId) continue;
    const list = usesByArg.get(u.argumentId) ?? [];
    list.push(u);
    usesByArg.set(u.argumentId, list);
  }
  const daByDeriv = new Map<DerivationId, typeof derivAssumps>();
  for (const da of derivAssumps) {
    const list = daByDeriv.get(da.derivationId) ?? [];
    list.push(da);
    daByDeriv.set(da.derivationId, list);
  }

  const arrow: Arrow<"I", string> = zero("I", claimId);
  const scoresByDeriv = new Map<DerivationId, number>();
  const derivationProvenance = new Map<DerivationId, DerivationProvenance>();
  const derivationRows: LoadedClaimArrow["derivations"] = [];

  for (const s of supports) {
    arrow.derivs.add(s.id);
    const explicit = (daByDeriv.get(s.id) ?? []).map((da) => da.assumptionId);
    let assumIds: string[];
    if (explicit.length > 0) {
      assumIds = Array.from(new Set(explicit));
    } else {
      assumIds = (usesByArg.get(s.argumentId) ?? []).map((u) => u.id);
    }
    arrow.assumptions.set(s.id, new Set<AssumptionId>(assumIds));

    const base = clamp01(s.base ?? 0.5);
    scoresByDeriv.set(s.id, base);

    const arg = argById.get(s.argumentId);
    const authorKind: AuthorKind = (arg?.authorKind as AuthorKind) ?? "HUMAN";
    // ECC plan §4 row 3: AI/HYBRID-authored derivations are non-logical
    // until a human ratifies. We don't have a ratification table yet, so
    // `humanRatified` defaults to `false` for AI/HYBRID. A future sprint
    // wires the explicit ratification record.
    derivationProvenance.set(s.id, {
      authorKind,
      humanRatified: authorKind === "HUMAN",
    });

    derivationRows.push({
      derivationId: s.id,
      argumentId: s.argumentId,
      argumentText: arg?.text ?? null,
      base,
      authorKind,
      assumptionIds: assumIds,
    });
  }

  const assumptionStatus = new Map<AssumptionId, AssumptionStatus>();
  for (const u of uses) {
    assumptionStatus.set(u.id, (u.status as AssumptionStatus) ?? "PROPOSED");
  }

  return {
    claimId,
    arrow,
    scoresByDeriv,
    assumptionStatus,
    derivationProvenance,
    derivations: derivationRows,
  };
}

/**
 * Confidence value for a loaded arrow under the requested closed-enum mode.
 * Returns `null` when the arrow is empty (caller should surface honest-empty).
 */
export function evaluateConfidence(loaded: LoadedClaimArrow, mode: Mode): number | null {
  if (!isEntire(loaded.arrow)) return null;
  const m: ConfidenceMonoid<number> =
    mode === "min"
      ? withMinScores(loaded.scoresByDeriv)
      : mode === "logodds"
        ? withLogoddsScores(loaded.scoresByDeriv)
        : withProductScores(loaded.scoresByDeriv);
  return confidence(loaded.arrow, m);
}

/** Structural + logical meta (Ambler Def. 8 + Def. 17) for the loaded arrow. */
export function evaluateArrowMeta(loaded: LoadedClaimArrow): {
  simple: boolean;
  entire: boolean;
  selected: boolean;
  logical: boolean;
} {
  const meta = arrowMeta(loaded.arrow);
  const logical = isLogical(loaded.arrow, {
    assumptionStatus: (id) => loaded.assumptionStatus.get(id) ?? "PROPOSED",
    derivationProvenance: (id) => loaded.derivationProvenance.get(id),
  });
  return { ...meta, logical };
}

/** Re-export the algebra `culpritSets` so routes don't import from two places. */
export function culpritSetsFor(loaded: LoadedClaimArrow): CulpritSet[] {
  return algebraCulpritSets(loaded.arrow);
}

/**
 * Hydrate a `CulpritSet` with human-readable `AssumptionUse` text so MCP
 * clients can present the retraction candidates without an extra round-trip.
 */
export async function hydrateCulpritSets(
  loaded: LoadedClaimArrow,
  sets: CulpritSet[],
): Promise<Array<{
  assumptions: Array<{
    id: AssumptionId;
    text: string | null;
    claimId: string | null;
    status: AssumptionStatus;
  }>;
  badConclusionsExplained: number;
  retractionCost: number;
}>> {
  const allIds = new Set<string>();
  for (const s of sets) for (const a of s.assumptions) allIds.add(a);
  if (allIds.size === 0) return sets.map((s) => ({ ...s, assumptions: [] }));

  const rows = await prisma.assumptionUse.findMany({
    where: { id: { in: Array.from(allIds) } },
    select: { id: true, status: true, assumptionText: true, assumptionClaimId: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return sets.map((s) => ({
    assumptions: Array.from(s.assumptions).map((id) => {
      const r = byId.get(id);
      return {
        id,
        text: r?.assumptionText ?? null,
        claimId: r?.assumptionClaimId ?? null,
        status: ((r?.status as AssumptionStatus) ?? "PROPOSED"),
      };
    }),
    badConclusionsExplained: s.badConclusionsExplained,
    retractionCost: s.retractionCost,
  }));
}
