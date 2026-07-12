/**
 * Manifest generator: extract the structural ground truth from a
 * fixture's `SyntheticReadout`-shaped payload.
 *
 * The harness believes the graph, not the LLM. This module is the
 * single source of truth for "what does the structure actually say?"
 * and is shared across every Phase 1 scorecard run.
 *
 * Pure function. No I/O. No prose. Same input → same manifest.
 */

import type { Fixture, Manifest, IncarnationSetManifest, DependencyEdge } from "./types";

const EMPTY_INCARNATION_SET: IncarnationSetManifest = {
  incarnations: [],
  totalIncarnations: 0,
};

/**
 * Build the incarnation-set manifest field.
 *
 * For authored corpus fixtures the value is taken directly from
 * `fixture.manifestFields.incarnationSet` (no DB round-trip needed).
 * When absent, a zero-default is returned so downstream scoring is safe.
 */
function buildIncarnationSetManifest(fixture: Fixture): IncarnationSetManifest {
  return fixture.manifestFields?.incarnationSet ?? EMPTY_INCARNATION_SET;
}

/**
 * Extract dependency edges from the fixture's chain projections.
 *
 * OQ4 / Phase 2f: builds the ground-truth directed edge set for the
 * subgraph-matching fidelity dimension. Each chain projection may carry
 * multiple edges; we deduplicate by (from, to, type) key.
 */
function buildDependencyEdges(fixture: Fixture): DependencyEdge[] {
  const chains = fixture.readout.chains?.chains ?? [];
  const seen = new Set<string>();
  const edges: DependencyEdge[] = [];
  for (const chain of chains) {
    for (const edge of chain.edges ?? []) {
      const key = `${edge.from}\u2192${edge.to}:${edge.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ from: edge.from, to: edge.to, type: edge.type });
      }
    }
  }
  return edges;
}

/** Premises are "load-bearing" iff `topology.loadBearingPremises[]` includes them. */
export function generateManifest(fixture: Fixture): Manifest {
  const r = fixture.readout;

  const hubSet = (r.topology?.hubs?.set ?? []).map((h) => h.argumentId);
  const hubShape = r.topology?.hubs?.shape ?? "empty";

  const loadBearingPremises = (r.topology?.loadBearingPremises ?? []).map(
    (p) => p.claimId,
  );

  const openCqs = (r.frontier?.unansweredCqs ?? []).map(
    (q) => `${q.targetArgumentId}::${q.cqKey}`,
  );

  // Phase 2.1: subset of openCqs whose targetArgumentId is a hub.
  // These are the CQs a briefing MUST elevate as inline nudges.
  const hubSetLookup = new Set(hubSet);
  const loadBearingOpenCqs = (r.frontier?.unansweredCqs ?? [])
    .filter((q) => hubSetLookup.has(q.targetArgumentId))
    .map((q) => `${q.targetArgumentId}::${q.cqKey}`);

  const refusedConclusionIds = (
    r.refusalSurface?.cannotConcludeBecause ?? []
  )
    .map((e) => e.conclusionClaimId)
    .filter((id) => id && id.length > 0);

  const hierarchicalMode = !!r.topology?.sizeTier?.hierarchicalMode;

  return {
    fixtureId: fixture.id,
    contentHash: r.contentHash,
    hubSet,
    hubShape,
    loadBearingPremises,
    openCqs,
    loadBearingOpenCqs,
    refusedConclusionIds,
    hierarchicalMode,
    argumentCount: r.fingerprint?.argumentCount ?? 0,
    // Phase 1g: Ludics-layer manifest fields
    openExposurePoints: fixture.manifestFields?.openExposurePoints ?? 0,
    coverageRatio: fixture.manifestFields?.coverageRatio ?? 0,
    fossilCount: fixture.manifestFields?.fossilCount ?? 0,
    // Phase 2b: incarnation-set
    incarnationSet: buildIncarnationSetManifest(fixture),
    // OQ4 / Phase 2f: dependency-graph edges
    dependencyEdges: buildDependencyEdges(fixture),
  };
}
