/**
 * BehaviourAtLocus service — `get_behaviour_at_locus` Cluster F read.
 *
 * Returns the behaviour B_ℓ at a given locus ℓ in a deliberation:
 * all incarnations (Designs) that span that locus, annotated with stratum
 * (walked/witnessable/latent), a WitnessRecord-coverage fitness proxy,
 * and per-cone membership (post-2e: Inc(B) is an antichain, so the
 * incarnation set decomposes into disjoint cones rather than a single
 * lattice with a unique bottom). See LUDICS_OQ_JSL_PROOF.md and
 * LUDICS_SESSION_1_DEV_SPEC.md §3.1.
 */

import { prisma } from "@/lib/prismaclient";
import { computeCones } from "./articulationLattice";

// ─── types ────────────────────────────────────────────────────────────────────

export type IncarnationStratum = "walked" | "witnessable" | "latent";

export interface Incarnation {
  designId: string;
  /** Loci this design spans. */
  loci: string[];
  moveCount: number;
  stratum: IncarnationStratum;
  /** WitnessRecord coverage ratio for this design's LudicMoves (0–1). */
  fitness: number;
  /**
   * Cone identifier (Phase 2e). All incarnations in the same cone share an
   * inclusion DAG rooted at a base design (derivedBy === null).
   */
  coneId: string;
  /** True iff this incarnation is the minimum of its cone (a base design). */
  isConeBottom: boolean;
  /**
   * Optional ArgumentChain id this design is materialised from (Phase 2d).
   * Null when the design predates argumentId plumbing or is freestanding.
   */
  argumentId: string | null;
}

export interface ConeSummary {
  coneId: string;
  bottomIncarnationDesignId: string;
}

export interface GetBehaviourAtLocusResult {
  behaviourId: string;
  locus: string;
  incarnationCount: number;
  incarnations: Incarnation[];
  /**
   * Per-cone minima at this locus. Inc(B) is an antichain (Phase 2e), so
   * there is no single global bottom; one ConeSummary per connected
   * component of the inclusion DAG restricted to designs spanning ℓ.
   */
  cones: ConeSummary[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Compute a "witnessed coverage" fitness ratio: walkedMoves / totalMoves. */
function designFitness(
  designId: string,
  ludicMoves: Array<{ id: string; designId: string | null }>,
  witnessedIds: Set<string>,
): number {
  const designMoves = ludicMoves.filter((m) => m.designId === designId);
  if (designMoves.length === 0) return 0;
  const walked = designMoves.filter((m) => witnessedIds.has(m.id)).length;
  return walked / designMoves.length;
}

/** Derive stratum for a design from its LudicMoves and witnessed set. */
function designStratum(
  designId: string,
  ludicMoves: Array<{ id: string; designId: string | null; stratumLabel: string }>,
  witnessedIds: Set<string>,
): IncarnationStratum {
  const designMoves = ludicMoves.filter((m) => m.designId === designId);
  if (designMoves.some((m) => witnessedIds.has(m.id))) return "walked";
  if (designMoves.some((m) => m.stratumLabel === "witnessable")) return "witnessable";
  return "latent";
}

// ─── service ──────────────────────────────────────────────────────────────────

export async function getBehaviourAtLocus(
  deliberationId: string,
  locus: string,
): Promise<GetBehaviourAtLocusResult | null> {
  // Find the Behaviour whose rootLocus matches the requested locus
  const behaviour = await prisma.behaviour.findUnique({
    where: { deliberationId_rootLocus: { deliberationId, rootLocus: locus } },
    select: { id: true },
  });

  if (!behaviour) return null;

  // Fetch all Designs for this Behaviour
  const designs = await prisma.design.findMany({
    where: { behaviourId: behaviour.id },
    select: { id: true, loci: true, derivedBy: true },
  });

  if (designs.length === 0) {
    return {
      behaviourId: behaviour.id,
      locus,
      incarnationCount: 0,
      incarnations: [],
      cones: [],
    };
  }

  const designIds = designs.map((d) => d.id);

  // Fetch DesignInclusions so computeCones can detect antichain violations
  // (two "base" designs linked by inclusion → same cone). See computeCones doc.
  const inclusions = await prisma.designInclusion.findMany({
    where: { smaller: { behaviourId: behaviour.id } },
    select: { smallerId: true, largerId: true },
  });

  // Fetch LudicMoves linked to these Designs
  const ludicMoves = await prisma.ludicMove.findMany({
    where: { designId: { in: designIds } },
    select: { id: true, designId: true, stratumLabel: true, argumentId: true },
  });

  // Fetch active witnesses for those LudicMoves
  const witnessedIds = await prisma.witnessRecord
    .findMany({
      where: {
        ludicMoveId: { in: ludicMoves.map((m) => m.id) },
        fossilizedAt: null,
      },
      select: { ludicMoveId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.ludicMoveId)));

  const { byDesignId: coneByDesignId, cones } = computeCones(designs, inclusions);
  // A design is a cone bottom iff it is the `bottomIncarnationDesignId` of
  // its cone — post-Phase-2g, not every non-derived design qualifies (two
  // base designs linked by inclusion now share a cone, with only the
  // inclusion-minimum acting as the bottom).
  const coneBottomIds = new Set(cones.map((c) => c.bottomIncarnationDesignId));

  // Phase 2d: argumentId lives on LudicMove. Surface the first non-null
  // argumentId among a design's moves as the design's argumentId proxy.
  const argumentIdByDesignId = new Map<string, string | null>();
  for (const m of ludicMoves) {
    if (!m.designId) continue;
    if (argumentIdByDesignId.has(m.designId)) continue;
    if (m.argumentId != null) argumentIdByDesignId.set(m.designId, m.argumentId);
  }

  const incarnations: Incarnation[] = designs.map((d) => {
    const coneId = coneByDesignId.get(d.id) ?? "cone_unknown";
    return {
      designId: d.id,
      loci: d.loci,
      moveCount: ludicMoves.filter((m) => m.designId === d.id).length,
      stratum: designStratum(d.id, ludicMoves, witnessedIds),
      fitness: designFitness(d.id, ludicMoves, witnessedIds),
      coneId,
      isConeBottom: coneBottomIds.has(d.id),
      argumentId: argumentIdByDesignId.get(d.id) ?? null,
    };
  });

  return {
    behaviourId: behaviour.id,
    locus,
    incarnationCount: incarnations.length,
    incarnations,
    cones,
  };
}
