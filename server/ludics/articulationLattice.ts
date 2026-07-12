/**
 * Articulation lattice service — Cluster B (Phase 1e).
 *
 * Exposes the six lattice operations over Art(B) = (Inc(B), ≤_⊆, ∨_⊥⊥):
 *   getArticulationLattice, findMinimalIncarnations,
 *   findEquivalentArticulations, findSubstitutePremises,
 *   compressArticulation, computeArticulationJoin
 *
 * T4 invariant: no participantId is returned in any response.
 */

import { prisma } from "@/lib/prismaclient";
import crypto from "crypto";

// ── Shared types ─────────────────────────────────────────────────────────────

export interface DesignSummary {
  designId: string;
  loci: string[];
  moveCount: number;
  biorthoClass: string;
  derivedBy: string | null;
}

export interface IncarnationNode extends DesignSummary {
  /** Rank in topological order of the inclusion lattice. 0 = bottom (fewest loci) within its cone. */
  rank: number;
  /**
   * Cone identifier. Inc(B) is an antichain (Phase 2e); the inclusion DAG
   * decomposes into disjoint cones, each rooted at a base incarnation
   * (derivedBy === null). All designs in the same cone share the same coneId.
   * See LUDICS_OQ_JSL_PROOF.md.
   */
  coneId: string;
}

export interface InclusionEdge {
  /** designId of the smaller (fewer-loci) end. */
  from: string;
  /** designId of the larger (more-loci) end. */
  to: string;
  /** Cone this edge lives in. Edges are always intra-cone (Phase 2f). */
  coneId: string;
}

export interface ConeSummary {
  coneId: string;
  /** designId of the cone's minimum incarnation (a base design, derivedBy === null). */
  bottomIncarnationDesignId: string;
}

export interface EquivalenceClass {
  biorthoClass: string;
  members: string[]; // designIds in this equivalence class
}

// ── Result types ─────────────────────────────────────────────────────────────

export interface GetArticulationLatticeResult {
  behaviourId: string;
  incarnations: IncarnationNode[];
  /**
   * Per-cone minima. Inc(B) is an antichain (Phase 2e), so there is no
   * single global bottom; each cone has its own minimum incarnation.
   * See LUDICS_OQ_JSL_PROOF.md and LUDICS_SESSION_1_DEV_SPEC.md §3.1.
   */
  cones: ConeSummary[];
  edges: InclusionEdge[];
  /** Populated when representatives === "raw"; null otherwise. */
  equivalenceClasses: EquivalenceClass[] | null;
}

export interface FindMinimalIncarnationsResult {
  /**
   * Antichain of minimum incarnations — one per cone of (Inc(B), ≤_⊆).
   * Post-2e: Inc(B) is an antichain, so every incarnation here is
   * cone-minimal; `incarnations.length === coneCount`.
   */
  incarnations: DesignSummary[];
  coneCount: number;
}

export interface FindEquivalentArticulationsResult {
  equivalents: DesignSummary[];
}

export interface FindSubstitutePremisesResult {
  substitutes: DesignSummary[];
  /** true when no incarnation avoids all dropped premises. */
  unreachable: boolean;
}

/**
 * Discriminated result of compress_articulation (meet D₁ ∧ D₂).
 *
 * Post-2e/2f, meets are partial: they only exist within a single cone. The
 * three kinds make the partiality explicit so callers never have to inspect
 * `meet === null` to know whether the failure was cross-cone or simply no
 * common lower bound.
 */
export type CompressArticulationResult =
  | {
      kind: "same-cone-meet";
      meet: DesignSummary;
      coneId: string;
    }
  | {
      kind: "same-cone-incomparable";
      coneId: string;
      /** designIds that were inspected; all share `coneId`. */
      inputDesignIds: string[];
    }
  | {
      kind: "cross-cone-rejected";
      /** Cones the inputs span (length ≥ 2). */
      coneIds: string[];
      inputDesignIds: string[];
    };

/**
 * Discriminated result of compute_articulation_join (D₁ ∨_⊥⊥ D₂).
 *
 * Phase 2e/2f facts encoded in the variants:
 *  - `same-cone-join`: literal chronicle-set union (Phase 2f Reading A);
 *    closureSteps === 0 because no biorthogonal closure is required when
 *    both inputs share a cone. `joinIsMinimal` is true only when all inputs
 *    are the same base design.
 *  - `same-cone-delocation-required`: inputs share a cone but their union
 *    contains a locus collision a literal union cannot resolve; the caller
 *    must delocate one input before retrying.
 *  - `cross-cone-rejected`: inputs span multiple cones; no common upper
 *    bound exists in B (LUDICS_OQ_JSL_PROOF.md §5.2). Returned as a value,
 *    not thrown, so HTTP callers can surface a 200 with a discriminator
 *    instead of a 4xx.
 */
export type ComputeArticulationJoinResult =
  | {
      kind: "same-cone-join";
      join: DesignSummary;
      coneId: string;
      /** Loci present in the join that were not in every individual input. */
      newLoci: string[];
      /** Always 0 for same-cone joins (literal union, no closure rounds). */
      closureSteps: 0;
      /** True iff the join coincides with a base incarnation. */
      joinIsMinimal: boolean;
    }
  | {
      kind: "same-cone-delocation-required";
      coneId: string;
      inputDesignIds: string[];
      /** Loci that collided under literal union and would need delocation. */
      collidingLoci: string[];
    }
  | {
      kind: "cross-cone-rejected";
      coneIds: string[];
      inputDesignIds: string[];
    };

// ── Internal helpers ─────────────────────────────────────────────────────────

type RawDesign = {
  id: string;
  behaviourId: string;
  deliberationId: string;
  loci: string[];
  premiseClaimIds: string[];
  biorthoClass: string;
  derivedBy: string | null;
  ludicMoves: { id: string }[];
};

function toDesignSummary(d: RawDesign): DesignSummary {
  return {
    designId: d.id,
    loci: d.loci,
    moveCount: d.ludicMoves.length,
    biorthoClass: d.biorthoClass,
    derivedBy: d.derivedBy,
  };
}

function hashBiorthoClass(loci: string[]): string {
  const sorted = [...loci].sort().join(",");
  return crypto.createHash("sha256").update(sorted).digest("hex").slice(0, 16);
}

/**
 * Find the incarnation of `design` within `baseDesigns` (designs with
 * derivedBy === null). The incarnation is the base design with the largest
 * loci set that is still a subset of design.loci (most specific minimal
 * ancestor). Returns null if no base design's loci are a subset.
 *
 * Phase 2e: used for cross-cone validation in computeArticulationJoin.
 */
function findIncarnation(design: RawDesign, baseDesigns: RawDesign[]): RawDesign | null {
  const candidates = baseDesigns.filter((b) =>
    b.loci.every((l) => design.loci.includes(l)),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.loci.length > best.loci.length ? c : best));
}

/**
 * Decompose a behaviour's incarnation DAG into disjoint cones (Phase 2e).
 * Inc(B) is an antichain; each base incarnation (derivedBy === null) is
 * the minimum of its own cone, and every derived design (join/meet/etc.)
 * belongs to the cone of its most specific base ancestor.
 *
 * Returns:
 *   - byDesignId: Map from designId to its coneId (string).
 *   - cones: Array of { coneId, bottomIncarnationDesignId } in deterministic order.
 *
 * Cone ids are assigned as `cone_<index>` over the base designs sorted by id
 * for stable output across calls. See LUDICS_SESSION_1_DEV_SPEC.md §3.1.
 */
export interface ConeDecomposition {
  byDesignId: Map<string, string>;
  cones: ConeSummary[];
}

/**
 * Known `derivedBy` values produced by Art(B) operations. Any other value
 * (including `null` and provenance sentinels like `"seed"` written by
 * showcase/test fixtures) is treated as a base incarnation. This keeps
 * `computeCones` robust to stale or hand-seeded data — only true algebraic
 * derivations are excluded from Inc(B).
 */
export const DERIVED_OPERATIONS: ReadonlySet<string> = new Set([
  "join",
  "meet",
  "compression",
  "extend",
]);

/** True iff `derivedBy` names a recognised algebraic derivation in Art(B). */
export function isDerivedDesign(d: { derivedBy: string | null }): boolean {
  return !!d.derivedBy && DERIVED_OPERATIONS.has(d.derivedBy);
}

export function computeCones(
  allDesigns: Array<{ id: string; loci: string[]; derivedBy: string | null }>,
  inclusions: ReadonlyArray<{ smallerId: string; largerId: string }> = [],
): ConeDecomposition {
  const bases = allDesigns
    .filter((d) => !isDerivedDesign(d))
    .sort((a, b) => a.id.localeCompare(b.id));

  // ── Antichain-violation tolerance (Phase 2g) ────────────────────────────────
  // Post-2e, Inc(B) is supposed to be an antichain — yet stale seed data and
  // hand-authored fixtures can produce two "base" designs (derivedBy ∉
  // DERIVED_OPERATIONS) where one's loci ⊂ the other's. The DesignInclusion
  // table records the relationship even when `derivedBy` doesn't. Treat any
  // two bases connected by an inclusion edge (in either direction) as
  // belonging to the same cone, with the inclusion-minimum (smallest loci)
  // as the cone's bottom. This preserves the disjoint-cone invariant that
  // the rest of the system (cross-cone validation in join/meet, the bind
  // workflow, the orientation glossary) assumes.
  const baseIds = new Set(bases.map((b) => b.id));
  // Union-find over base ids only.
  const parent = new Map<string, string>(bases.map((b) => [b.id, b.id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const next = parent.get(c)!;
      parent.set(c, r);
      c = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    // Choose the lexicographically smaller root for stability — independent
    // of cone-bottom selection below, which uses loci-size.
    if (ra < rb) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  for (const e of inclusions) {
    if (baseIds.has(e.smallerId) && baseIds.has(e.largerId)) {
      union(e.smallerId, e.largerId);
    }
  }

  // Bucket bases by union-find root, then pick the cone bottom as the base
  // with the fewest loci (inclusion-minimum); ties broken by stable id sort.
  const basesByRoot = new Map<string, typeof bases>();
  for (const b of bases) {
    const root = find(b.id);
    const bucket = basesByRoot.get(root) ?? [];
    bucket.push(b);
    basesByRoot.set(root, bucket);
  }
  const roots = [...basesByRoot.keys()].sort();
  const coneByRoot = new Map<string, string>();
  const cones: ConeSummary[] = roots.map((root, i) => {
    const coneId = `cone_${i}`;
    coneByRoot.set(root, coneId);
    const bucket = basesByRoot.get(root)!;
    // Inclusion-minimum (smallest loci); tie-break by id for stability.
    const bottom = bucket.reduce((min, cur) => {
      if (cur.loci.length < min.loci.length) return cur;
      if (cur.loci.length === min.loci.length && cur.id < min.id) return cur;
      return min;
    });
    return { coneId, bottomIncarnationDesignId: bottom.id };
  });

  const byDesignId = new Map<string, string>();
  for (const d of allDesigns) {
    if (!isDerivedDesign(d)) {
      byDesignId.set(d.id, coneByRoot.get(find(d.id))!);
      continue;
    }
    // Find the most specific base ancestor (largest loci-subset).
    let best: { id: string; size: number } | null = null;
    for (const b of bases) {
      if (b.loci.every((l) => d.loci.includes(l))) {
        if (!best || b.loci.length > best.size) {
          best = { id: b.id, size: b.loci.length };
        }
      }
    }
    // If no base ancestor (defensive — derived design that escaped its cone),
    // fall back to a synthetic cone id keyed off the design itself so the
    // output is still well-formed. Such designs would also trip cross-cone
    // validation in computeArticulationJoin.
    byDesignId.set(
      d.id,
      best ? coneByRoot.get(find(best.id))! : `cone_orphan_${d.id}`,
    );
  }

  return { byDesignId, cones };
}

const DESIGN_INCLUDE = { ludicMoves: { select: { id: true } } } as const;

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Return the full articulation lattice Art(B) for the given behaviour.
 *
 * @param behaviourId  Target behaviour.
 * @param representatives  "incarnations" (default) — canonical poset.
 *                         "raw" — adds equivalenceClasses grouped by biorthoClass.
 * @returns null if no Behaviour / Designs exist.
 */
export async function getArticulationLattice(
  behaviourId: string,
  representatives: "incarnations" | "raw" = "incarnations",
): Promise<GetArticulationLatticeResult | null> {
  const t0 = performance.now();
  const [designs, inclusions] = await Promise.all([
    prisma.design.findMany({
      where: { behaviourId },
      include: DESIGN_INCLUDE,
    }),
    prisma.designInclusion.findMany({
      where: { smaller: { behaviourId } },
      select: { smallerId: true, largerId: true },
    }),
  ]);

  if (designs.length === 0) return null;

  const { byDesignId: coneByDesignId, cones } = computeCones(
    designs.map((d) => ({ id: d.id, loci: d.loci, derivedBy: d.derivedBy })),
    inclusions,
  );

  const edges: InclusionEdge[] = inclusions.map((e) => ({
    from: e.smallerId,
    to: e.largerId,
    coneId: coneByDesignId.get(e.smallerId) ?? coneByDesignId.get(e.largerId) ?? "cone_unknown",
  }));

  // Compute in-degree (edges going small→large; in-degree = edges arriving at d as "larger")
  const inDegreeMap = new Map<string, number>(
    designs.map((d) => [d.id, 0] as [string, number]),
  );
  for (const e of inclusions) {
    inDegreeMap.set(e.largerId, (inDegreeMap.get(e.largerId) ?? 0) + 1);
  }

  // Build adjacency list (smaller → [larger])
  const adjList = new Map<string, string[]>();
  for (const d of designs) adjList.set(d.id, []);
  for (const e of inclusions) {
    adjList.get(e.smallerId)?.push(e.largerId);
  }

  // Kahn's BFS for topological ranking (rank 0 = bottom = minimal elements)
  const rankMap = new Map<string, number>();
  const inDegreeCopy = new Map(inDegreeMap);
  let queue: string[] = designs
    .filter((d) => (inDegreeCopy.get(d.id) ?? 0) === 0)
    .map((d) => d.id);
  let rank = 0;
  while (queue.length > 0) {
    const level = [...queue];
    queue = [];
    for (const id of level) {
      rankMap.set(id, rank);
      for (const next of adjList.get(id) ?? []) {
        const deg = (inDegreeCopy.get(next) ?? 1) - 1;
        inDegreeCopy.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }
    rank++;
  }

  const incarnations: IncarnationNode[] = designs.map((d) => ({
    ...(toDesignSummary(d as RawDesign)),
    rank: rankMap.get(d.id) ?? 0,
    coneId: coneByDesignId.get(d.id) ?? "cone_unknown",
  }));

  // Per-cone minima are surfaced via the `cones` field (Phase 2e: no global bottom).
  // Build equivalence classes when raw mode requested
  let equivalenceClasses: EquivalenceClass[] | null = null;
  if (representatives === "raw") {
    const classMap = new Map<string, string[]>();
    for (const d of designs) {
      const cls = classMap.get(d.biorthoClass) ?? [];
      cls.push(d.id);
      classMap.set(d.biorthoClass, cls);
    }
    equivalenceClasses = Array.from(classMap.entries()).map(
      ([biorthoClass, members]) => ({ biorthoClass, members }),
    );
  }

  const elapsed = performance.now() - t0;
  if (elapsed > 150) {
    console.warn("[perf] getArticulationLattice slow", { behaviourId, incarnationCount: designs.length, elapsedMs: Math.round(elapsed) });
  }

  return { behaviourId, incarnations, cones, edges, equivalenceClasses };
}

/**
 * Return the minimum incarnations of Inc(B) — the antichain of per-cone
 * minima. Post-2e: Inc(B) itself is an antichain (every base incarnation is
 * cone-minimal), so this returns one DesignSummary per cone. Designs with
 * `derivedBy !== null` (joins / meets / compressions) are excluded.
 */
export async function findMinimalIncarnations(
  behaviourId: string,
): Promise<FindMinimalIncarnationsResult> {
  const designs = await prisma.design.findMany({
    where: { behaviourId },
    include: DESIGN_INCLUDE,
  });

  const baseDesigns = designs.filter((d) => !isDerivedDesign(d));

  return {
    incarnations: baseDesigns.map((d) => toDesignSummary(d as RawDesign)),
    coneCount: baseDesigns.length,
  };
}

/**
 * Return the ~_⊥⊥ equivalence class of a design: other designs in the same
 * behaviour with the same biorthoClass.
 */
export async function findEquivalentArticulations(
  designId: string,
): Promise<FindEquivalentArticulationsResult> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: DESIGN_INCLUDE,
  });

  if (!design) return { equivalents: [] };

  const equivalents = await prisma.design.findMany({
    where: {
      biorthoClass: design.biorthoClass,
      behaviourId: design.behaviourId,
      id: { not: designId },
    },
    include: DESIGN_INCLUDE,
  });

  return {
    equivalents: equivalents.map((d) => toDesignSummary(d as RawDesign)),
  };
}

/**
 * Find incarnations of a behaviour that do not use any of the dropped
 * premise claim ids — "other ways to defend the same position without
 * a specific assumption."
 *
 * @param behaviourId  The behaviour whose incarnations to search.
 * @param drop         Premise claim ids to exclude.
 */
export async function findSubstitutePremises(
  behaviourId: string,
  drop: string[],
): Promise<FindSubstitutePremisesResult> {
  const designs = await prisma.design.findMany({
    where: { behaviourId },
    include: DESIGN_INCLUDE,
  });

  const dropSet = new Set(drop);
  const substitutes = designs.filter(
    (d) => !d.premiseClaimIds.some((p) => dropSet.has(p)),
  );

  return {
    substitutes: substitutes.map((d) => toDesignSummary(d as RawDesign)),
    unreachable: substitutes.length === 0,
  };
}

/**
 * Compute the meet D1 ∧ D2 (greatest lower bound) of a set of designs in
 * Art(B) by traversing the DesignInclusion DAG, restricted to a single cone.
 *
 * Post-2e/2f: meets are partial — cross-cone inputs are rejected explicitly
 * (kind: "cross-cone-rejected") rather than returning a null meet, so the
 * caller can distinguish "no shared lower bound" from "undefined operation".
 *
 * @param designIds  Two or more design ids belonging to the same behaviour.
 */
export async function compressArticulation(
  designIds: string[],
): Promise<CompressArticulationResult> {
  if (designIds.length === 0) {
    return { kind: "same-cone-incomparable", coneId: "cone_unknown", inputDesignIds: [] };
  }

  const designs = await prisma.design.findMany({
    where: { id: { in: designIds } },
    include: DESIGN_INCLUDE,
  });

  if (designs.length === 0) {
    return { kind: "same-cone-incomparable", coneId: "cone_unknown", inputDesignIds: designIds };
  }

  const behaviourId = designs[0].behaviourId;

  const [allDesigns, inclusions] = await Promise.all([
    prisma.design.findMany({
      where: { behaviourId },
      include: DESIGN_INCLUDE,
    }),
    prisma.designInclusion.findMany({
      where: { smaller: { behaviourId } },
      select: { smallerId: true, largerId: true },
    }),
  ]);

  // ── Cross-cone validation (Phase 2e) ────────────────────────────────────────
  const { byDesignId: coneByDesignId } = computeCones(
    allDesigns.map((d) => ({ id: d.id, loci: d.loci, derivedBy: d.derivedBy })),
    inclusions,
  );
  const inputCones = new Set<string>();
  for (const d of designs) {
    inputCones.add(coneByDesignId.get(d.id) ?? "cone_unknown");
  }
  if (inputCones.size > 1) {
    return {
      kind: "cross-cone-rejected",
      coneIds: [...inputCones].sort(),
      inputDesignIds: designs.map((d) => d.id),
    };
  }
  const coneId = [...inputCones][0] ?? "cone_unknown";

  // Reverse adjacency list: largerId → [smallerIds]  (to traverse toward bottom)
  const reverseAdj = new Map<string, string[]>();
  for (const d of allDesigns) reverseAdj.set(d.id, []);
  for (const e of inclusions) {
    const list = reverseAdj.get(e.largerId) ?? [];
    list.push(e.smallerId);
    reverseAdj.set(e.largerId, list);
  }

  // Forward adjacency list: smallerId → [largerIds] (to find maximal common)
  const forwardAdj = new Map<string, string[]>();
  for (const d of allDesigns) forwardAdj.set(d.id, []);
  for (const e of inclusions) {
    const list = forwardAdj.get(e.smallerId) ?? [];
    list.push(e.largerId);
    forwardAdj.set(e.smallerId, list);
  }

  // Ancestor set of D = all designs ≤ D (reachable by going toward bottom)
  function ancestors(id: string): Set<string> {
    const visited = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      for (const parent of reverseAdj.get(curr) ?? []) {
        queue.push(parent);
      }
    }
    return visited;
  }

  // Intersect ancestor sets of all input designs → common lower bounds
  const ancestorSets = designIds.map((id) => ancestors(id));
  let common = new Set(ancestorSets[0]);
  for (let i = 1; i < ancestorSets.length; i++) {
    common = new Set([...common].filter((id) => ancestorSets[i].has(id)));
  }

  if (common.size === 0) {
    return { kind: "same-cone-incomparable", coneId, inputDesignIds: designs.map((d) => d.id) };
  }

  // Maximal elements in common = elements with no successor also in common
  const maximal = [...common].filter((id) => {
    const succs = forwardAdj.get(id) ?? [];
    return !succs.some((s) => common.has(s));
  });

  if (maximal.length === 0) {
    return { kind: "same-cone-incomparable", coneId, inputDesignIds: designs.map((d) => d.id) };
  }

  // Tiebreaker: most loci (closest to inputs in lattice height)
  const meetId =
    maximal.length === 1
      ? maximal[0]
      : maximal.sort((a, b) => {
          const da = allDesigns.find((d) => d.id === a)!;
          const db = allDesigns.find((d) => d.id === b)!;
          return db.loci.length - da.loci.length;
        })[0];

  const meetDesign = allDesigns.find((d) => d.id === meetId);
  if (!meetDesign) {
    return { kind: "same-cone-incomparable", coneId, inputDesignIds: designs.map((d) => d.id) };
  }

  return { kind: "same-cone-meet", meet: toDesignSummary(meetDesign as RawDesign), coneId };
}

/**
 * Compute D1 ∨_⊥⊥ D2 — the smallest behaviour-closed design containing all
 * supplied designs.
 *
 * Phase 2f Reading A: within a single cone the join is the literal
 * chronicle-set union (`closureSteps === 0`); no biorthogonal closure
 * round is required. Cross-cone inputs are returned as
 * `cross-cone-rejected` (not thrown) because no common upper bound exists
 * in B (LUDICS_OQ_JSL_PROOF.md §5.2), so HTTP callers can surface a 200
 * with a discriminator instead of a 4xx.
 *
 * @param designIds  Two or more design ids from the same behaviour.
 */
export async function computeArticulationJoin(
  designIds: string[],
): Promise<ComputeArticulationJoinResult | null> {
  if (designIds.length === 0) return null;

  const designs = await prisma.design.findMany({
    where: { id: { in: designIds } },
    include: DESIGN_INCLUDE,
  });

  if (designs.length === 0) return null;

  const behaviourId = designs[0].behaviourId;
  const deliberationId = designs[0].deliberationId;

  const [allBehaviourDesigns, allBehaviourInclusions] = await Promise.all([
    prisma.design.findMany({
      where: { behaviourId },
      include: DESIGN_INCLUDE,
    }),
    prisma.designInclusion.findMany({
      where: { smaller: { behaviourId } },
      select: { smallerId: true, largerId: true },
    }),
  ]);

  // ── Phase 2e: cross-cone validation ────────────────────────────────────────
  const { byDesignId: coneByDesignId } = computeCones(
    allBehaviourDesigns.map((d) => ({ id: d.id, loci: d.loci, derivedBy: d.derivedBy })),
    allBehaviourInclusions,
  );
  const inputCones = new Set<string>();
  for (const d of designs) {
    inputCones.add(coneByDesignId.get(d.id) ?? "cone_unknown");
  }
  if (inputCones.size > 1) {
    return {
      kind: "cross-cone-rejected",
      coneIds: [...inputCones].sort(),
      inputDesignIds: designs.map((d) => d.id),
    };
  }
  const coneId = [...inputCones][0] ?? "cone_unknown";

  // joinIsMinimal: true only when all inputs are the same base design (trivial join)
  const uniqueInputIds = new Set(designs.map((d) => d.id));
  const allSameBaseDesign =
    uniqueInputIds.size === 1 && designs[0].derivedBy === null;

  // Union of all loci (sorted for deterministic comparison).
  // Phase 2f Reading A: literal chronicle-set union within a cone.
  const lociUnion = [...new Set(designs.flatMap((d) => d.loci))].sort();
  const sortedUnionKey = lociUnion.join(",");

  const existing = allBehaviourDesigns.find(
    (d) => [...d.loci].sort().join(",") === sortedUnionKey,
  );

  // newLoci = loci in the join not present in every input
  const lociIntersection = new Set(
    designs[0].loci.filter((l) => designs.every((d) => d.loci.includes(l))),
  );
  const newLoci = lociUnion.filter((l) => !lociIntersection.has(l));

  if (existing) {
    return {
      kind: "same-cone-join",
      join: toDesignSummary(existing as RawDesign),
      coneId,
      newLoci: [],
      closureSteps: 0,
      joinIsMinimal: allSameBaseDesign,
    };
  }

  // Create a new Design with the joined loci
  const biorthoClass = hashBiorthoClass(lociUnion);
  const newDesign = await prisma.design.create({
    data: {
      behaviourId,
      deliberationId,
      loci: lociUnion,
      premiseClaimIds: [],
      biorthoClass,
      derivedBy: "join",
    },
    include: DESIGN_INCLUDE,
  });

  return {
    kind: "same-cone-join",
    join: toDesignSummary(newDesign as RawDesign),
    coneId,
    newLoci,
    closureSteps: 0,
    joinIsMinimal: allSameBaseDesign,
  };
}
