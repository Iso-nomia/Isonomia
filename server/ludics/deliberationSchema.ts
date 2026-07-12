/**
 * DeliberationSchema service — `get_deliberation_schema` Cluster F read.
 *
 * Returns the structural schema of a deliberation's Ludics layer: locus count,
 * optional design tree, and a witnessing-coverage summary.
 * This is the orientation-level read for the Ludics layer.
 */

import { prisma } from "@/lib/prismaclient";

// ─── types ────────────────────────────────────────────────────────────────────

export interface LocusNode {
  ludicMoveId: string;
  locus: string;
  moveType: string;
  stratumLabel: string;
  depth: number;
  children: LocusNode[];
}

export interface WitnessingSummary {
  walkedLoci: number;
  witnessableLoci: number;
  latentLoci: number;
  /** Ratio of walked loci to total loci (0–1). */
  coverageRatio: number;
}

export interface GetDeliberationSchemaResult {
  deliberationId: string;
  locusCount: number;
  /** Locus tree (present when includeDesignTree: true). */
  designTree: LocusNode[] | null;
  witnessingSummary: WitnessingSummary;
  /** Count of unwitnessed loci in witnessable + latent strata. */
  openExposurePoints: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Count the dots in a locus string → depth of node in tree. */
function locusDepth(locus: string): number {
  return (locus.match(/\./g) ?? []).length;
}

/**
 * Return the parent locus by removing the last ".N" suffix.
 * Returns null for a root-level locus (depth 0).
 */
function locusParent(locus: string): string | null {
  const lastDot = locus.lastIndexOf(".");
  return lastDot === -1 ? null : locus.slice(0, lastDot);
}

/** Build a nested locus tree from a flat list of LudicMove records. */
function buildLocusTree(
  moves: Array<{
    id: string;
    locus: string;
    moveType: string;
    stratumLabel: string;
  }>,
  witnessedIds: ReadonlySet<string>,
): LocusNode[] {
  // Sort by locus so parents always come before children
  const sorted = [...moves].sort((a, b) => a.locus.localeCompare(b.locus));

  const nodeMap = new Map<string, LocusNode>();
  const roots: LocusNode[] = [];

  for (const m of sorted) {
    // Override the stored `stratumLabel` column with the authoritative
    // value derived from WitnessRecord, matching the rule used by
    // `witnessingSummary.walkedLoci`. Without this, the per-node label
    // and the aggregate counts can disagree when seed data writes
    // `stratumLabel = "walked"` without inserting a WitnessRecord row.
    // See server/ludics/stratum.ts for the same contract at the
    // point-lookup layer.
    const authoritativeLabel = witnessedIds.has(m.id)
      ? "walked"
      : m.stratumLabel === "walked"
        ? "latent" // stale "walked" with no witness → latent
        : m.stratumLabel;

    const node: LocusNode = {
      ludicMoveId: m.id,
      locus: m.locus,
      moveType: m.moveType,
      stratumLabel: authoritativeLabel,
      depth: locusDepth(m.locus),
      children: [],
    };
    nodeMap.set(m.locus, node);

    const parent = locusParent(m.locus);
    if (parent && nodeMap.has(parent)) {
      nodeMap.get(parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── service ──────────────────────────────────────────────────────────────────

export async function getDeliberationSchema(
  deliberationId: string,
  includeDesignTree = true,
): Promise<GetDeliberationSchemaResult | null> {
  const allMoves = await prisma.ludicMove.findMany({
    where: { deliberationId },
    select: { id: true, locus: true, moveType: true, stratumLabel: true },
    orderBy: { locus: "asc" },
  });

  if (allMoves.length === 0) {
    // Deliberation exists but has no Ludics layer yet — return zero counts.
    return {
      deliberationId,
      locusCount: 0,
      designTree: includeDesignTree ? [] : null,
      witnessingSummary: {
        walkedLoci: 0,
        witnessableLoci: 0,
        latentLoci: 0,
        coverageRatio: 0,
      },
      openExposurePoints: 0,
    };
  }

  // Count active (non-fossilized) witnesses per locus to classify as "walked"
  const witnessedIds = await prisma.witnessRecord
    .findMany({
      where: {
        ludicMoveId: { in: allMoves.map((m) => m.id) },
        fossilizedAt: null,
      },
      select: { ludicMoveId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.ludicMoveId)));

  // A move is "walked" when it has an active WitnessRecord,
  // regardless of its stored stratumLabel (the record is authoritative).
  let walkedLoci = 0;
  let witnessableLoci = 0;
  let latentLoci = 0;

  for (const m of allMoves) {
    if (witnessedIds.has(m.id)) {
      walkedLoci++;
    } else if (m.stratumLabel === "witnessable") {
      witnessableLoci++;
    } else {
      latentLoci++;
    }
  }

  const locusCount = allMoves.length;
  const coverageRatio = locusCount > 0 ? walkedLoci / locusCount : 0;
  const openExposurePoints = witnessableLoci + latentLoci;

  const designTree = includeDesignTree
    ? buildLocusTree(allMoves, witnessedIds)
    : null;

  return {
    deliberationId,
    locusCount,
    designTree,
    witnessingSummary: {
      walkedLoci,
      witnessableLoci,
      latentLoci,
      coverageRatio,
    },
    openExposurePoints,
  };
}
