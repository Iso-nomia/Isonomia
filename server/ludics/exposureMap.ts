/**
 * ExposureMap service — `get_exposure_map` Cluster A read.
 *
 * Returns the stratified, topology-annotated opposition space E(D_P) for a
 * deliberation, partitioned into walked / witnessable / latent strata.
 *
 * Topology layer (when includeTopology: true):
 *   - hubSet: locus ids whose subtree contains ≥ 2 children (convergence points)
 *   - loadBearingRanking: ludicMoveIds ordered by descendant count descending
 *   - totalNodes: total LudicMoves in the map
 *
 * Cascade layer (when includeCascade: true):
 *   Each ExposureNode in E_o ∪ E_ℓ carries a `cascade` field listing
 *   the ludicMoveIds of latent moves that would be lifted (made witnessable)
 *   by walking this node — i.e., its direct children in the locus tree.
 */

import { prisma } from "@/lib/prismaclient";

// ─── types ────────────────────────────────────────────────────────────────────

export interface ExposureNode {
  id: string;
  locus: string;
  moveType: string;
  depth: number;
  cascade?: string[]; // present when includeCascade: true
}

export interface ExposureMapTopology {
  /** LudicMove ids at loci where ≥ 2 child loci converge. */
  hubSet: string[];
  /** LudicMove ids ordered by subtree size descending (cascade exposure). */
  loadBearingRanking: string[];
  totalNodes: number;
}

export interface ExposureMapResult {
  strata: {
    walked: ExposureNode[];
    witnessable: ExposureNode[];
    latent: ExposureNode[];
  };
  topology: ExposureMapTopology | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function locusDepth(locus: string): number {
  return (locus.match(/\./g) ?? []).length;
}

function locusParent(locus: string): string | null {
  const lastDot = locus.lastIndexOf(".");
  return lastDot === -1 ? null : locus.slice(0, lastDot);
}

/**
 * Build parent→children adjacency map from a list of loci.
 * Key = locus string, value = array of child loci.
 */
function buildChildrenMap(loci: string[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const loc of loci) {
    const parent = locusParent(loc);
    if (parent !== null) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent)!.push(loc);
    }
    if (!children.has(loc)) children.set(loc, []);
  }
  return children;
}

/**
 * Compute subtree size for each locus (number of descendants, including self).
 * Used for load-bearing ranking.
 */
function buildSubtreeSizes(
  loci: string[],
  childrenMap: Map<string, string[]>,
): Map<string, number> {
  const sizes = new Map<string, number>();

  function subtreeSize(loc: string): number {
    if (sizes.has(loc)) return sizes.get(loc)!;
    const kids = childrenMap.get(loc) ?? [];
    const size = 1 + kids.reduce((sum, child) => sum + subtreeSize(child), 0);
    sizes.set(loc, size);
    return size;
  }

  for (const loc of loci) subtreeSize(loc);
  return sizes;
}

// ─── service ──────────────────────────────────────────────────────────────────

export interface ExposureMapOptions {
  claimId?: string;
  stratifyDepth?: number;
  includeCascade?: boolean;
  includeTopology?: boolean;
}

export async function computeExposureMap(
  deliberationId: string,
  opts: ExposureMapOptions = {},
): Promise<ExposureMapResult> {
  const t0 = performance.now();
  const {
    stratifyDepth = 1,
    includeCascade = false,
    includeTopology = true,
  } = opts;

  // Fetch all LudicMoves for the deliberation
  const allMoves = await prisma.ludicMove.findMany({
    where: { deliberationId },
    select: { id: true, locus: true, moveType: true, stratumLabel: true },
    orderBy: { locus: "asc" },
  });

  if (allMoves.length === 0) {
    return {
      strata: { walked: [], witnessable: [], latent: [] },
      topology: includeTopology
        ? { hubSet: [], loadBearingRanking: [], totalNodes: 0 }
        : null,
    };
  }

  // Find which moves are actively witnessed
  const witnessedIds = await prisma.witnessRecord
    .findMany({
      where: {
        ludicMoveId: { in: allMoves.map((m) => m.id) },
        fossilizedAt: null,
      },
      select: { ludicMoveId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.ludicMoveId)));

  // Build locus maps
  const locusToMove = new Map(allMoves.map((m) => [m.locus, m]));
  const allLoci = allMoves.map((m) => m.locus);
  const childrenMap = buildChildrenMap(allLoci);

  // Re-compute stratum using stored stratumLabel + dynamic stratifyDepth extension.
  // Strategy: walked = has active witness; witnessable = within stratifyDepth
  // tree-edges of a walked locus (or stored stratumLabel is "witnessable" with
  // default depth 1); latent = everything else.
  const walkedLoci = new Set<string>(
    allMoves.filter((m) => witnessedIds.has(m.id)).map((m) => m.locus),
  );

  // BFS from walked loci up to stratifyDepth edges
  const witnessableLoci = new Set<string>();
  for (const wl of walkedLoci) {
    const queue: Array<{ locus: string; dist: number }> = [{ locus: wl, dist: 0 }];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const { locus, dist } = queue.shift()!;
      if (visited.has(locus)) continue;
      visited.add(locus);
      if (dist > 0 && !walkedLoci.has(locus)) {
        witnessableLoci.add(locus);
      }
      if (dist < stratifyDepth) {
        // Expand to parent
        const parent = locusParent(locus);
        if (parent && locusToMove.has(parent) && !visited.has(parent)) {
          queue.push({ locus: parent, dist: dist + 1 });
        }
        // Expand to children
        for (const child of childrenMap.get(locus) ?? []) {
          if (!visited.has(child)) {
            queue.push({ locus: child, dist: dist + 1 });
          }
        }
      }
    }
  }

  // Classify nodes into strata
  const walked: ExposureNode[] = [];
  const witnessable: ExposureNode[] = [];
  const latent: ExposureNode[] = [];

  // Pre-build cascade map for efficient lookup (only if needed)
  let cascadeMap: Map<string, string[]> | null = null;
  if (includeCascade) {
    cascadeMap = new Map();
    for (const m of allMoves) {
      const childLoci = childrenMap.get(m.locus) ?? [];
      cascadeMap.set(
        m.id,
        childLoci
          .filter((cl) => !walkedLoci.has(cl))
          .map((cl) => locusToMove.get(cl)!.id),
      );
    }
  }

  for (const m of allMoves) {
    const depth = locusDepth(m.locus);
    const base: ExposureNode = { id: m.id, locus: m.locus, moveType: m.moveType, depth };

    if (includeCascade && !walkedLoci.has(m.locus)) {
      base.cascade = cascadeMap!.get(m.id) ?? [];
    }

    if (walkedLoci.has(m.locus)) {
      walked.push(base);
    } else if (witnessableLoci.has(m.locus) || m.stratumLabel === "witnessable") {
      witnessable.push(base);
    } else {
      latent.push(base);
    }
  }

  // Topology
  let topology: ExposureMapTopology | null = null;
  if (includeTopology) {
    const subtreeSizes = buildSubtreeSizes(allLoci, childrenMap);

    // Hub = loci with ≥ 2 children
    const hubSet: string[] = [];
    for (const m of allMoves) {
      const childLoci = childrenMap.get(m.locus) ?? [];
      if (childLoci.length >= 2) hubSet.push(m.id);
    }

    // Load-bearing ranking = moves ordered by subtree size descending
    const loadBearingRanking = [...allMoves]
      .sort((a, b) => (subtreeSizes.get(b.locus) ?? 1) - (subtreeSizes.get(a.locus) ?? 1))
      .map((m) => m.id);

    topology = { hubSet, loadBearingRanking, totalNodes: allMoves.length };
  }

  const elapsed = performance.now() - t0;
  if (elapsed > 300) {
    console.warn("[perf] computeExposureMap slow", { deliberationId, elapsedMs: Math.round(elapsed) });
  }

  return { strata: { walked, witnessable, latent }, topology };
}
