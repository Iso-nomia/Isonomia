/**
 * Types for the AI-EPI eval harness.
 *
 * Three core artifacts:
 *
 *   - `Fixture`: a synthetic deliberation, stored as a partial
 *     `SyntheticReadout`-shaped object. Minimal but sufficient for
 *     manifest extraction.
 *
 *   - `Manifest`: the structural ground truth extracted mechanically
 *     from a fixture. The single source of truth for "what does the
 *     graph actually say?".
 *
 *   - `Phase1ScorecardReport`: the result of grading an LLM briefing
 *     against a manifest. Per-dimension precision/recall plus a
 *     `confidentMisstatements` list (any entry → release-blocking).
 */

import type { SyntheticReadout } from "@/lib/deliberation/syntheticReadout";

// ────────────────────────────────────────────────────────────
// Fixture
// ────────────────────────────────────────────────────────────

/**
 * Synthetic-tier fixture: an authored partial `SyntheticReadout`. The
 * manifest generator only reads `frontier`, `topology`, `refusalSurface`,
 * `fingerprint`, `chains`, `topArguments`, and `mostContested`, so a
 * fixture only needs to specify those fields.
 */
export type FixtureReadout = Pick<
  SyntheticReadout,
  | "deliberationId"
  | "contentHash"
  | "fingerprint"
  | "frontier"
  | "topology"
  | "refusalSurface"
  | "chains"
  | "topArguments"
  | "mostContested"
>;

export interface Fixture {
  /** Stable id for this fixture; appears in scorecard reports. */
  id: string;
  /** Short description; for human review of the corpus. */
  description: string;
  /**
   * Adversarial gates this fixture is designed to probe. Empty for
   * "main scorecard" fixtures; non-empty for adversarial-set fixtures.
   */
  adversarialGates: AdversarialGate[];
  /** Authored partial readout. */
  readout: FixtureReadout;
  /**
   * Phase 1g: Ludics-layer manifest fields. Authored for synthetic fixtures;
   * computed from the DB for DB-snapshot fixtures.
   * Required for coverage-exposure and fossil-count scorecard dimensions.
   */
  manifestFields?: {
    /** Count of unwitnessed moves in the witnessable + latent strata. */
    openExposurePoints: number;
    /** walkedLoci / locusCount. */
    coverageRatio: number;
    /** Count of retracted WitnessRecord rows for this deliberation. */
    fossilCount: number;
    /** Phase 2b: authored incarnation-set for this fixture's root locus. */
    incarnationSet?: IncarnationSetManifest;
  };
}

// ────────────────────────────────────────────────────────────
// Phase 2b: Incarnation-set manifest types
// ────────────────────────────────────────────────────────────

/**
 * A single Design incarnation summary inside an IncarnationSetManifest.
 */
export interface DesignSummary {
  designId: string;
  /** Locus addresses this design spans. */
  loci: string[];
  moveCount: number;
  /** 0 = minimal (bottom); higher = larger incarnation. */
  rank: number;
}

/**
 * The set of incarnations for a Behaviour B.
 *
 * Post-OQ-JSL (Phase 2e Outcome B): `Inc(B)` is an **antichain** under
 * ⊆. There is no global bottom `|B|`. Instead, `(B, ≤_⊆)` decomposes
 * into disjoint cones, and each cone has its own minimal incarnation
 * (the bottom *of that cone*). See LUDICS_OQ_JSL_PROOF.md and
 * LUDICS_ORDER_RELATION_DEFINITION.md for the Daimon Lock Lemma and the
 * Cross-Cone Incompatibility result.
 *
 * `incarnations` is the full antichain (one element per cone). The empty
 * antichain (`[]`) is the legal representation of a behaviour with no
 * Designs.
 */
export interface IncarnationSetManifest {
  /**
   * The antichain `Inc(B)`. One `DesignSummary` per cone; each is the
   * minimal incarnation of its cone. Empty when the behaviour has no
   * Designs.
   */
  incarnations: DesignSummary[];
  /**
   * `=== incarnations.length === |Inc(B)|`. Kept as an explicit field
   * so consumers can assert on it without re-computing.
   */
  totalIncarnations: number;
  /**
   * Optional per-cone structure when callers need explicit cone
   * identity (e.g. MCP tools that name cones across requests). When
   * present, `cones[i].bottomIncarnation` is the same value as
   * `incarnations[i]`.
   */
  cones?: Array<{ coneId: string; bottomIncarnation: DesignSummary }>;
}

export type AdversarialGate =
  | "co-equal-hubs-not-collapsed"
  | "diffuse-topology-not-named-as-hub"
  | "refusal-not-overridden"
  | "hierarchical-disclosure-surfaced";

// ────────────────────────────────────────────────────────────
// Manifest (ground truth extracted from a fixture)
// ────────────────────────────────────────────────────────────

export interface Manifest {
  fixtureId: string;
  /** Cache key from the fixture; lets the harness detect drift. */
  contentHash: string;
  /** Hub set with multiplicity. Empty when topology has no hubs. */
  hubSet: string[];
  /** Reported topology shape. Used for hallucinated-structure checks. */
  hubShape: SyntheticReadout["topology"]["hubs"]["shape"];
  /** Load-bearing premise claim ids (top tier). */
  loadBearingPremises: string[];
  /** Open critical questions, keyed `argId::cqKey`. */
  openCqs: string[];
  /**
   * Subset of `openCqs` whose `targetArgumentId` is in `hubSet` —
   * i.e. CQs targeting graph hubs. These are the CQs a briefing
   * MUST elevate as inline nudges (Phase 2.1). Always a subset of
   * `openCqs`; empty when the graph has no hubs.
   */
  loadBearingOpenCqs: string[];
  /** Conclusion claim ids the refusal surface forbids closing on. */
  refusedConclusionIds: string[];
  /** True when the briefing must surface a hierarchical-mode disclosure. */
  hierarchicalMode: boolean;
  /** Argument count (for context in scorecard reports). */
  argumentCount: number;
  /**
   * Phase 1g: Count of unwitnessed moves in the witnessable + latent strata.
   * Ground truth for coverage-exposure scoring. 0 when manifestFields absent.
   */
  openExposurePoints: number;
  /**
   * Phase 1g: walkedLoci / locusCount. Informational; not used in scoring
   * directly but surfaced in scorecard reports for human review.
   */
  coverageRatio: number;
  /**
   * Phase 1g: Count of retracted WitnessRecord rows.
   * Informational; reported alongside coverage metrics.
   */
  fossilCount: number;
  /**
   * Phase 2b: Incarnation-set for the root-locus behaviour.
   * Zero-default when fixture has no authored incarnationSet.
   */
  incarnationSet: IncarnationSetManifest;
  /**
   * OQ4 / Phase 2f: Directed dependency edges extracted from all
   * chain projections in the fixture's `SyntheticReadout.chains`.
   * Each edge is a `(from, to, type)` triple. Empty array for fixtures
   * that have no chain data.
   */
  dependencyEdges: DependencyEdge[];
}

// ────────────────────────────────────────────────────────────
// Briefing claim (the structured form of an LLM's briefing output)
// ────────────────────────────────────────────────────────────

/**
 * The LLM's structured claim about a deliberation. Used as the input
 * to the scorecard. In practice this is parsed out of the LLM's
 * response text by a thin extractor, but the harness operates on the
 * structured form so scoring is deterministic and re-runnable.
 *
 * All fields are *optional* (an LLM may omit anything); the scorecard
 * treats omissions as "did not claim" rather than "claimed false".
 */
export interface BriefingClaim {
  /** Argument ids the briefing identifies as load-bearing hubs. */
  claimedHubSet?: string[];
  /**
   * The briefing's claim about hub *shape*. If this disagrees with the
   * manifest's `hubShape`, that is a confident misstatement.
   */
  claimedHubShape?: SyntheticReadout["topology"]["hubs"]["shape"];
  /** Premise claim ids the briefing identifies as load-bearing. */
  claimedLoadBearingPremises?: string[];
  /** Open CQs the briefing names, keyed `argId::cqKey`. */
  claimedOpenCqs?: string[];
  /**
   * Subset of open CQs the briefing *promotes as inline nudges*
   * (Phase 2.1) — "engage these first." Distinct from `claimedOpenCqs`
   * which is the exhaustive enumeration. A faithful briefing surfaces
   * every load-bearing CQ here; surfacing non-hub CQs while omitting
   * any hub CQ is a `cq-priority-inversion` confident misstatement.
   * Format `argId::cqKey`, matching `claimedOpenCqs`.
   */
  surfacedCqPrompts?: string[];
  /** Conclusion claim ids the briefing asserts as established. */
  assertedConclusions?: string[];
  /**
   * True iff the briefing surfaces a hierarchical-mode disclosure.
   * Only material when `Manifest.hierarchicalMode === true`.
   */
  surfacedHierarchicalDisclosure?: boolean;
  /**
   * True iff the briefing explicitly flagged the topology as ambiguous
   * (e.g. "three roughly co-equal hubs" / "many small hubs, no single
   * dominant one"). On ambiguous topologies (hubShape ∈ {co-equal-cluster,
   * diffuse}), the briefing MUST set this true OR omit hub claims entirely;
   * making a hub claim without flagging ambiguity is a false-confidence
   * misstatement. See Phase 1 "Calibration" in the roadmap.
   */
  expressedTopologyUncertainty?: boolean;
  /**
   * Phase 2b (post-OQ-JSL): how many distinct incarnations (`Inc(B)`
   * members) the LLM identifies. Graded against
   * `manifest.incarnationSet.incarnations.length`. When LLM
   * undercounts (`claimedIncarnationCount < |Inc(B)|`) on a
   * multi-cone behaviour, the scorecard raises a
   * `miscount-across-cones` confident misstatement.
   */
  claimedIncarnationCount?: number;
  /**
   * Phase 2b (post-OQ-JSL): per-cone vector of how many loci the LLM
   * identifies as the minimum-commitment position *in that cone*.
   * Element `i` is the claim for `incarnationSet.incarnations[i]`.
   * Per-cone undercount (`claimed[i] < incarnations[i].loci.length`)
   * raises an `incarnation-undercount` misstatement scoped to that
   * cone. Length need not equal `|Inc(B)|`; missing entries are
   * treated as "did not claim" (recall miss, not confident
   * misstatement).
   */
  claimedMinimalPremiseLociCountPerCone?: number[];
  /**
   * OQ4 / Phase 2f: The dependency edges the LLM asserts exist in the
   * deliberation graph. Parsed from the LLM response by the extractor;
   * scored against `Manifest.dependencyEdges` by the scorecard.
   * Omission = did not claim = recall miss; wrong direction = confident
   * misstatement (`chain-direction-reversal`).
   */
  claimedDependencyEdges?: DependencyEdge[];
}

// ────────────────────────────────────────────────────────────
// Scorecard report
// ────────────────────────────────────────────────────────────

export interface PrecisionRecall {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number; // 0..1; 1 when no positives at all (vacuous)
  recall: number; // 0..1; 1 when ground-truth set is empty (vacuous)
  f1: number;
}

export type ConfidentMisstatementKind =
  | "hub-shape-mismatch"
  | "asserted-refused-conclusion"
  | "missing-hierarchical-disclosure"
  | "named-single-hub-when-coequal"
  | "named-single-hub-when-diffuse"
  | "false-confidence-on-ambiguous-topology"
  | "cq-priority-inversion"
  /** Phase 1g: briefing named zero open CQs when openExposurePoints > 0. */
  | "coverage-exposure-zero"
  /**
   * Phase 2b (post-OQ-JSL): for some cone `i`, the LLM identified
   * fewer loci than `incarnationSet.incarnations[i].loci.length`.
   * Scoped per cone — a multi-cone behaviour can produce multiple
   * `incarnation-undercount` misstatements (one per offending cone).
   */
  | "incarnation-undercount"
  /**
   * Phase 2b (post-OQ-JSL): the LLM under-counted `|Inc(B)|`
   * (`claimedIncarnationCount < incarnations.length`) on a behaviour
   * with ≥ 2 cones. Indicates the LLM collapsed distinct, mutually
   * incomparable incarnations into a single position — the
   * cross-cone-conflation failure mode the OQ-JSL proof flagged as
   * structurally invalid.
   */
  | "miscount-across-cones"
  /**
   * OQ4 / Phase 2f: briefing claimed an edge A→B but the ground-truth
   * graph has the reversed edge B→A (same type). A direction reversal is
   * a confident structural error — the LLM asserted a specific causal
   * direction that is structurally backwards in the deliberation.
   */
  | "chain-direction-reversal";

export interface ConfidentMisstatement {
  kind: ConfidentMisstatementKind;
  /** Human-readable detail for review. */
  detail: string;
}

// ────────────────────────────────────────────────────────────
// OQ4 / Phase 2f: Dependency-graph types
// ────────────────────────────────────────────────────────────

/**
 * A single directed dependency edge in the deliberation graph.
 * Mirrors `ChainEdgeProjection` from `lib/deliberation/chainExposure`
 * but is a standalone, import-free type usable in authored fixtures.
 */
export interface DependencyEdge {
  /** Source argumentId. */
  from: string;
  /** Target argumentId. */
  to: string;
  /** Semantic type of the dependency. */
  type: "PRESUPPOSES" | "ENABLES" | "ATTACKS";
}

/**
 * Subgraph-fidelity score (OQ4 / Phase 2f).
 *
 * Measures whether the LLM correctly described the *dependency structure*
 * of the deliberation graph, not just which nodes are present.
 * This is the GraphEval-comparable dimension: edge-level P/R/F1 over
 * the (from, to, type) triples extracted from all chain projections.
 *
 * Graph-edit-distance interpretation:
 *   - falsePositives = edges the LLM hallucinated
 *   - falseNegatives = real edges the LLM missed
 *   - `reversals` = edges cited in the wrong direction (also counted in
 *     falsePositives, and surfaced as `chain-direction-reversal` misstatements)
 */
export interface ChainDependencyScore {
  /** Ground-truth edge count from all chain projections. */
  truthEdgeCount: number;
  /** Claimed edge count from BriefingClaim.claimedDependencyEdges. */
  claimedEdgeCount: number;
  /**
   * P/R/F1 over edge keys `"${from}→${to}:${type}"`.
   * Vacuously 1.0 when truthEdgeCount === 0.
   */
  edgePrecisionRecall: PrecisionRecall;
  /**
   * P/R/F1 over argument node IDs mentioned in edge endpoints.
   * Captures whether the LLM named the right argument participants
   * regardless of exact edge direction.
   */
  nodePrecisionRecall: PrecisionRecall;
  /**
   * Direction reversals: cases where the LLM claimed (A→B, T) but the
   * ground truth has (B→A, T) and NOT (A→B, T). Each reversal also
   * appears as a `chain-direction-reversal` in confidentMisstatements.
   */
  reversals: Array<{ claimed: DependencyEdge; truthReversed: DependencyEdge }>;
}

// ────────────────────────────────────────────────────────────
// Phase 2b: Articulation-recall score
// ────────────────────────────────────────────────────────────

/**
 * Articulation-recall dimension (Phase 2b, post-OQ-JSL).
 *
 * Measures whether the LLM correctly identified each cone's
 * minimum-commitment position. Per-cone scoring is required because
 * `Inc(B)` is an antichain — cones are mutually incomparable, so a
 * single scalar recall would conflate distinct structural facts.
 */
export interface ArticulationRecallScore {
  /**
   * One entry per cone in `incarnationSet.incarnations`, in the same
   * index order. Vacuous (`recall = 1`) when the cone has zero loci.
   */
  perCone: Array<{
    /** Index into `incarnationSet.incarnations`. */
    coneIndex: number;
    /** `incarnations[coneIndex].loci.length`. */
    coneLociCount: number;
    /** `claim.claimedMinimalPremiseLociCountPerCone?.[coneIndex] ?? 0`. */
    claimedLociCount: number;
    /**
     * `coneLociCount === 0 ? 1 : min(claimed, coneLociCount) / coneLociCount`.
     */
    recall: number;
    /** `claimedLociCount < coneLociCount`. */
    undercount: boolean;
  }>;
  /**
   * Arithmetic mean of `perCone[*].recall`. `1` (vacuous) when
   * `perCone.length === 0`.
   */
  meanRecall: number;
  /**
   * Recall on the cone count itself:
   * `incarnations.length === 0 ? 1 : min(claimedIncarnationCount, incarnations.length) / incarnations.length`.
   * Captures whether the LLM noticed the right *number* of distinct
   * incarnations, separately from per-cone loci accuracy.
   */
  incarnationCountRecall: number;
  /**
   * `incarnations.length >= 2 && claimedIncarnationCount < incarnations.length`.
   * Mirrors the `miscount-across-cones` confident-misstatement gate.
   */
  miscountAcrossCones: boolean;
}

// ────────────────────────────────────────────────────────────
// Phase 1g: Coverage-exposure score
// ────────────────────────────────────────────────────────────

/**
 * Coverage-exposure dimension (Phase 1g).
 * Measures how many of the unaddressed structural objections the
 * briefing named. A recall of 0.0 when openExposurePoints > 0
 * is a confidentMisstatement (`coverage-exposure-zero`).
 */
export interface CoverageExposureScore {
  /** Ground-truth unwitnessed exposure points (from manifest). */
  openExposurePoints: number;
  /** Number of open CQs named by the briefing (claimedOpenCqs.length). */
  claimedCount: number;
  /**
   * min(claimedCount, openExposurePoints) / openExposurePoints.
   * 1.0 when openExposurePoints === 0 (vacuously fully covered).
   */
  recall: number;
}

export interface Phase1ScorecardReport {
  fixtureId: string;
  contentHash: string;
  argumentCount: number;
  hub: PrecisionRecall;
  loadBearingPremise: PrecisionRecall;
  openCq: PrecisionRecall;
  /**
   * Phase 2.1: precision/recall of `claim.surfacedCqPrompts` against
   * the subset of open CQs targeting hub arguments
   * (`manifest.loadBearingOpenCqs`). Recall is the headline metric —
   * a briefing that omits a hub CQ from its inline nudges is failing
   * the Phase 2.1 fidelity contract even if the CQ appears in the
   * exhaustive `claimedOpenCqs` list.
   */
  loadBearingOpenCq: PrecisionRecall;
  /**
   * Phase 1g: Coverage-exposure recall score.
   * `claimedCount / openExposurePoints`.
   */
  coverageExposure: CoverageExposureScore;
  /**
   * Phase 2b: Articulation-recall score.
   * `claimedMinimalLociCount / bottomLociCount`.
   */
  articulationRecall: ArticulationRecallScore;
  /**
   * OQ4 / Phase 2f: Subgraph-matching fidelity score.
   * Edge-level P/R/F1 comparing claimed dependency edges against the
   * ground-truth chain dependency graph. This is the GraphEval-comparable
   * dimension; dynamic-manifest variant (C17 / OQ-fidelity).
   * Vacuously perfect when neither the manifest nor the claim has edges.
   */
  chainDependency: ChainDependencyScore;
  /**
   * Confident misstatements. ANY non-empty entry is a release-blocking
   * failure regardless of overall precision/recall.
   */
  confidentMisstatements: ConfidentMisstatement[];
  /** Adversarial gates passed/failed (empty when fixture isn't adversarial). */
  adversarialGateResults: Array<{
    gate: AdversarialGate;
    passed: boolean;
    detail: string;
  }>;
  /** Overall pass: no confident misstatements AND no adversarial-gate failures. */
  pass: boolean;
}

// ────────────────────────────────────────────────────────────
// Corpus index
// ────────────────────────────────────────────────────────────

export interface CorpusIndex {
  /** Corpus version. Bump when fixture shapes change incompatibly. */
  version: string;
  /** Fixture file paths relative to `corpus/<version>/`. */
  fixtures: Array<{
    id: string;
    path: string;
    description: string;
    /**
     * Optional. When present, `loadCorpus` validates that the fixture
     * file's `readout.contentHash` matches this value and throws on
     * mismatch (drift detection). Captured fixtures populate it; v1
     * synthetic fixtures may omit it.
     */
    contentHash?: string;
  }>;
}
