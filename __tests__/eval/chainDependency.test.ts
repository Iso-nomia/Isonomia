/**
 * OQ4 / Phase 2f: Chain-dependency subgraph-matching fidelity scorecard tests.
 *
 * Covers:
 *   - Perfect recall: LLM claims exactly the ground-truth edge set → F1 = 1.
 *   - Partial recall: LLM claims a proper subset → recall < 1, no misstatements.
 *   - Hallucinated edges: LLM adds edges that don't exist → precision < 1.
 *   - Direction reversal: LLM claims A→B but truth has B→A → confident
 *     misstatement `chain-direction-reversal`, report.pass = false.
 *   - Empty edges on both sides: vacuously perfect (no misstatements).
 *   - Node P/R: correctly derives node-level precision/recall from edges.
 *   - manifestGenerator extracts edges from chain projections correctly.
 *
 * All tests operate on synthetic mini-fixtures (no DB, no FS reads).
 */

import { generateManifest } from "../../eval/ai-epi/manifestGenerator";
import { scorePhase1 } from "../../eval/ai-epi/scorecard/phase1";
import type {
  Fixture,
  BriefingClaim,
  DependencyEdge,
} from "../../eval/ai-epi/types";

// ────────────────────────────────────────────────────────────
// Fixture builder helpers
// ────────────────────────────────────────────────────────────

/** Build a minimal FixtureReadout with the given chain edges. */
function makeFixtureWithEdges(
  edges: Array<{ from: string; to: string; type: "PRESUPPOSES" | "ENABLES" | "ATTACKS" }>,
): Fixture {
  return {
    id: "test-chain-dep",
    description: "Synthetic fixture for chain-dependency tests",
    adversarialGates: [],
    readout: {
      deliberationId: "del-test",
      contentHash: "hash-test",
      fingerprint: { argumentCount: 3, premiseCount: 2, cqCount: 0 },
      frontier: { unansweredCqs: [], openMoves: 0 },
      topology: {
        hubs: { shape: "single-dominant", set: [] },
        loadBearingPremises: [],
        sizeTier: { tier: "small", hierarchicalMode: false },
      },
      refusalSurface: { cannotConcludeBecause: [] },
      chains: {
        deliberationId: "del-test",
        chains: [
          {
            id: "chain-1",
            name: "Chain 1",
            topClaimId: "claim-top",
            topConclusionText: "Top conclusion",
            arguments: edges.map((e) => e.from).concat(edges.map((e) => e.to)),
            edges,
            chainStanding: "untested-default",
            chainFitness: {
              schemeTypicalCount: 0,
              schemeAtypicalCount: 0,
              openCqCount: 0,
              attackCount: 0,
              score: 0,
            },
            weakestLink: { argumentId: "arg-a", reason: "untested" },
          },
        ],
        uncoveredClaims: [],
      },
      topArguments: [],
      mostContested: [],
    },
  };
}

/** Minimal BriefingClaim with only dependency edges (all other fields omitted). */
function claimWithEdges(edges: DependencyEdge[]): BriefingClaim {
  return {
    claimedHubShape: "single-dominant",
    claimedDependencyEdges: edges,
  };
}

// Shared ground-truth edges used across tests
const TRUTH_EDGES: DependencyEdge[] = [
  { from: "arg-a", to: "arg-b", type: "PRESUPPOSES" },
  { from: "arg-b", to: "arg-c", type: "ENABLES" },
  { from: "arg-x", to: "arg-b", type: "ATTACKS" },
];

// ────────────────────────────────────────────────────────────
// manifestGenerator: edge extraction
// ────────────────────────────────────────────────────────────

describe("manifestGenerator: dependencyEdges extraction", () => {
  it("extracts edges from chain projections", () => {
    const fixture = makeFixtureWithEdges(TRUTH_EDGES);
    const manifest = generateManifest(fixture);
    expect(manifest.dependencyEdges).toHaveLength(TRUTH_EDGES.length);
    for (const e of TRUTH_EDGES) {
      expect(manifest.dependencyEdges).toContainEqual(e);
    }
  });

  it("deduplicates edges that appear in multiple chains", () => {
    const fixture = makeFixtureWithEdges(TRUTH_EDGES);
    // Manually add a second chain with the same edge
    fixture.readout.chains!.chains.push({
      id: "chain-2",
      name: "Chain 2",
      topClaimId: null,
      topConclusionText: null,
      arguments: ["arg-a", "arg-b"],
      edges: [{ from: "arg-a", to: "arg-b", type: "PRESUPPOSES" }],
      chainStanding: "untested-default",
      chainFitness: {
        schemeTypicalCount: 0,
        schemeAtypicalCount: 0,
        openCqCount: 0,
        attackCount: 0,
        score: 0,
      },
      weakestLink: { argumentId: "arg-a", reason: "untested" },
    });
    const manifest = generateManifest(fixture);
    // Still 3 unique edges (not 4)
    expect(manifest.dependencyEdges).toHaveLength(3);
  });

  it("returns empty array when fixture has no chains", () => {
    const fixture = makeFixtureWithEdges([]);
    fixture.readout.chains!.chains = [];
    const manifest = generateManifest(fixture);
    expect(manifest.dependencyEdges).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────
// scoreChainDependency via scorePhase1
// ────────────────────────────────────────────────────────────

describe("scorePhase1: chainDependency dimension", () => {
  const fixture = makeFixtureWithEdges(TRUTH_EDGES);

  describe("perfect recall", () => {
    it("F1 = 1 when LLM claims exactly the ground-truth edges", () => {
      const manifest = generateManifest(fixture);
      const claim = claimWithEdges([...TRUTH_EDGES]);
      const report = scorePhase1(fixture, manifest, claim);
      expect(report.chainDependency.edgePrecisionRecall.f1).toBe(1);
      expect(report.chainDependency.edgePrecisionRecall.precision).toBe(1);
      expect(report.chainDependency.edgePrecisionRecall.recall).toBe(1);
      expect(report.chainDependency.reversals).toEqual([]);
      expect(report.confidentMisstatements.some(
        (m) => m.kind === "chain-direction-reversal",
      )).toBe(false);
    });
  });

  describe("partial recall (no hallucinations)", () => {
    it("recall < 1, precision = 1, no misstatements when LLM misses edges", () => {
      const manifest = generateManifest(fixture);
      // Only claim the first edge
      const claim = claimWithEdges([TRUTH_EDGES[0]]);
      const report = scorePhase1(fixture, manifest, claim);
      const d = report.chainDependency.edgePrecisionRecall;
      expect(d.precision).toBe(1);
      expect(d.recall).toBeCloseTo(1 / 3);
      expect(d.f1).toBeGreaterThan(0);
      expect(d.f1).toBeLessThan(1);
      expect(report.chainDependency.reversals).toEqual([]);
      // Recall miss is not a confident misstatement
      expect(report.confidentMisstatements.some(
        (m) => m.kind === "chain-direction-reversal",
      )).toBe(false);
    });
  });

  describe("hallucinated edges (no reversals)", () => {
    it("precision < 1, recall < 1 when LLM adds a fabricated edge", () => {
      const manifest = generateManifest(fixture);
      const claim = claimWithEdges([
        ...TRUTH_EDGES,
        { from: "arg-z", to: "arg-w", type: "ENABLES" }, // hallucinated
      ]);
      const report = scorePhase1(fixture, manifest, claim);
      const d = report.chainDependency.edgePrecisionRecall;
      expect(d.precision).toBeCloseTo(3 / 4);
      expect(d.recall).toBe(1);
      // Hallucination is a precision miss, not a direction reversal
      expect(report.chainDependency.reversals).toEqual([]);
    });
  });

  describe("direction reversal (confident misstatement)", () => {
    it("fires chain-direction-reversal misstatement and sets pass=false", () => {
      const manifest = generateManifest(fixture);
      // Claim the reversed direction: arg-b → arg-a instead of arg-a → arg-b
      const claim = claimWithEdges([
        { from: "arg-b", to: "arg-a", type: "PRESUPPOSES" }, // reversed
        TRUTH_EDGES[1], // correct
      ]);
      const report = scorePhase1(fixture, manifest, claim);
      const reversalMisstatements = report.confidentMisstatements.filter(
        (m) => m.kind === "chain-direction-reversal",
      );
      expect(reversalMisstatements).toHaveLength(1);
      expect(reversalMisstatements[0].detail).toContain("arg-b→arg-a");
      expect(reversalMisstatements[0].detail).toContain("arg-a→arg-b");
      expect(report.pass).toBe(false);
      expect(report.chainDependency.reversals).toHaveLength(1);
      expect(report.chainDependency.reversals[0].claimed).toEqual({
        from: "arg-b",
        to: "arg-a",
        type: "PRESUPPOSES",
      });
      expect(report.chainDependency.reversals[0].truthReversed).toEqual({
        from: "arg-a",
        to: "arg-b",
        type: "PRESUPPOSES",
      });
    });

    it("does NOT fire for a claimed edge whose reverse doesn't exist in truth", () => {
      const manifest = generateManifest(fixture);
      // Hallucinate an edge where neither direction is in truth
      const claim = claimWithEdges([
        { from: "arg-z", to: "arg-w", type: "ENABLES" },
      ]);
      const report = scorePhase1(fixture, manifest, claim);
      expect(report.confidentMisstatements.filter(
        (m) => m.kind === "chain-direction-reversal",
      )).toHaveLength(0);
      expect(report.chainDependency.reversals).toEqual([]);
    });
  });

  describe("empty edge sets", () => {
    it("vacuously perfect when both manifest and claim have no edges", () => {
      const emptyFixture = makeFixtureWithEdges([]);
      emptyFixture.readout.chains!.chains = [];
      const manifest = generateManifest(emptyFixture);
      const claim = claimWithEdges([]);
      const report = scorePhase1(emptyFixture, manifest, claim);
      expect(report.chainDependency.edgePrecisionRecall.f1).toBe(1);
      expect(report.chainDependency.edgePrecisionRecall.precision).toBe(1);
      expect(report.chainDependency.edgePrecisionRecall.recall).toBe(1);
      expect(report.chainDependency.reversals).toEqual([]);
    });

    it("recall = 0, precision = 1 when claim omits all edges", () => {
      const manifest = generateManifest(fixture);
      const claim: BriefingClaim = { claimedHubShape: "single-dominant" };
      const report = scorePhase1(fixture, manifest, claim);
      const d = report.chainDependency.edgePrecisionRecall;
      // No claimed edges → precision vacuously 1; recall = 0/3 = 0
      expect(d.precision).toBe(1);
      expect(d.recall).toBe(0);
      expect(d.f1).toBe(0);
    });
  });

  describe("node-level precision/recall", () => {
    it("correctly identifies node participants regardless of edge direction", () => {
      const manifest = generateManifest(fixture);
      // Claim only edges involving arg-a and arg-b (not arg-c or arg-x)
      const claim = claimWithEdges([
        { from: "arg-a", to: "arg-b", type: "PRESUPPOSES" },
      ]);
      const report = scorePhase1(fixture, manifest, claim);
      // Ground truth nodes: {arg-a, arg-b, arg-c, arg-x} = 4
      // Claimed nodes: {arg-a, arg-b} = 2
      const n = report.chainDependency.nodePrecisionRecall;
      expect(n.precision).toBe(1); // both claimed nodes are real
      expect(n.recall).toBe(0.5); // only 2 of 4 truth nodes named
    });
  });

  describe("scorecard report structure", () => {
    it("chainDependency.truthEdgeCount and claimedEdgeCount are correct", () => {
      const manifest = generateManifest(fixture);
      const claim = claimWithEdges([TRUTH_EDGES[0], TRUTH_EDGES[1]]);
      const report = scorePhase1(fixture, manifest, claim);
      expect(report.chainDependency.truthEdgeCount).toBe(3);
      expect(report.chainDependency.claimedEdgeCount).toBe(2);
    });
  });
});
