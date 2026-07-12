/**
 * Phase 2b invariant tests — `incarnationSet` manifest field (post-OQ-JSL Outcome B).
 *
 * `Inc(B)` is an antichain under ⊆ (Daimon Lock Lemma); each element is the
 * minimum-commitment incarnation of its cone. There is no singular bottom |B|.
 * See LUDICS_OQ_JSL_PROOF.md and LUDICS_ORDER_RELATION_DEFINITION.md.
 *
 * 22 tests covering:
 *   - IncarnationSetManifest shape (empty, single-cone, multi-cone ≥2)
 *   - manifestGenerator wires authored `incarnations[]` from fixture
 *   - scorecard articulationRecall: per-cone meanRecall, incarnationCountRecall, vacuous defaults
 *   - detectConfidentMisstatements: per-cone `incarnation-undercount` + `miscount-across-cones`
 *   - MockBriefingClient emits `claimedIncarnationCount` + `claimedMinimalPremiseLociCountPerCone`
 *   - Per-fixture cardinality assertions (small-coequal=2, large-real=8, large-real[0]=12)
 *   - Mock scorecard pass=true for all v2 fixtures
 */

import { join } from "node:path";
import { loadCorpus } from "../../eval/ai-epi/loadCorpus";
import { generateManifest } from "../../eval/ai-epi/manifestGenerator";
import { scorePhase1 } from "../../eval/ai-epi/scorecard/phase1";
import { MockBriefingClient } from "../../eval/ai-epi/llm/mockClient";
import type {
  Fixture,
  BriefingClaim,
  IncarnationSetManifest,
  DesignSummary,
} from "../../eval/ai-epi/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const V2_CORPUS_PATH = join(__dirname, "../../eval/ai-epi/corpus/v2/manifest.json");

function makeMinimalFixture(incarnationSet?: IncarnationSetManifest): Fixture {
  return {
    id: "test-fixture",
    description: "Minimal test fixture",
    adversarialGates: [],
    readout: {
      deliberationId: "test-delib",
      contentHash: "sha256:test",
      fingerprint: {
        deliberationId: "test-delib",
        contentHash: "sha256:test",
        argumentCount: 5,
        claimCount: 5,
        edgeCount: { support: 0, attack: 0, ca: 0 },
        schemeDistribution: {},
        authorCount: { human: 5, ai: 0, hybrid: 0 },
        participantCount: 1,
        standingDistribution: {},
        depthDistribution: { thin: 5, moderate: 0, dense: 0 },
        medianChallengerCount: 0,
        meanChallengerCount: 0,
        challengerCoverage: 0,
        medianChallengerCountAmongChallenged: 0,
        cqCoverage: { answered: 0, unanswered: 0, ratio: 0 },
      },
      topology: {
        hubs: { set: [], shape: "empty" },
        loadBearingPremises: [],
        sizeTier: { tier: "small", hierarchicalMode: false },
      },
      refusalSurface: { cannotConcludeBecause: [] },
      frontier: { unansweredCqs: [] },
      chains: [],
      topArguments: [],
      mostContested: null,
    },
    manifestFields: {
      openExposurePoints: 0,
      coverageRatio: 0,
      fossilCount: 0,
      ...(incarnationSet ? { incarnationSet } : {}),
    },
  };
}

const INC_A: DesignSummary = {
  designId: "design-cone-a",
  loci: ["⊢A.0", "⊢A.1", "⊢A.2"],
  moveCount: 3,
  rank: 0,
};

const INC_B: DesignSummary = {
  designId: "design-cone-b",
  loci: ["⊢A.3", "⊢A.4"],
  moveCount: 2,
  rank: 0,
};

const EMPTY_SET: IncarnationSetManifest = {
  incarnations: [],
  totalIncarnations: 0,
};

const SINGLE_CONE_SET: IncarnationSetManifest = {
  incarnations: [INC_A],
  totalIncarnations: 1,
};

const MULTI_CONE_SET: IncarnationSetManifest = {
  incarnations: [INC_A, INC_B],
  totalIncarnations: 2,
};

// ─── §2.2 Type shape tests ────────────────────────────────────────────────────

describe("IncarnationSetManifest shape (antichain)", () => {
  it("T1: empty antichain has incarnations=[] and totalIncarnations=0", () => {
    expect(EMPTY_SET.incarnations).toHaveLength(0);
    expect(EMPTY_SET.totalIncarnations).toBe(0);
  });

  it("T2: single-cone set has incarnations.length=1 and totalIncarnations=1", () => {
    expect(SINGLE_CONE_SET.incarnations).toHaveLength(1);
    expect(SINGLE_CONE_SET.totalIncarnations).toBe(1);
    expect(SINGLE_CONE_SET.incarnations[0].rank).toBe(0);
  });

  it("T3: multi-cone set has incarnations.length=2 with both rank=0 (antichain)", () => {
    expect(MULTI_CONE_SET.incarnations).toHaveLength(2);
    expect(MULTI_CONE_SET.totalIncarnations).toBe(2);
    for (const inc of MULTI_CONE_SET.incarnations) {
      expect(inc.rank).toBe(0);
    }
  });
});

// ─── §2.3 manifestGenerator wires authored incarnations ─────────────────────

describe("manifestGenerator: incarnationSet field", () => {
  it("T4: manifest.incarnationSet defaults to empty antichain when manifestFields absent", () => {
    const fx: Fixture = { ...makeMinimalFixture(), manifestFields: undefined };
    const m = generateManifest(fx);
    expect(m.incarnationSet.incarnations).toHaveLength(0);
    expect(m.incarnationSet.totalIncarnations).toBe(0);
  });

  it("T5: manifest.incarnationSet carries authored single-cone antichain", () => {
    const m = generateManifest(makeMinimalFixture(SINGLE_CONE_SET));
    expect(m.incarnationSet.incarnations).toHaveLength(1);
    expect(m.incarnationSet.incarnations[0].designId).toBe("design-cone-a");
    expect(m.incarnationSet.incarnations[0].loci).toHaveLength(3);
  });

  it("T6: manifest.incarnationSet preserves multi-cone antichain from fixture", () => {
    const m = generateManifest(makeMinimalFixture(MULTI_CONE_SET));
    expect(m.incarnationSet.incarnations).toHaveLength(2);
    expect(m.incarnationSet.totalIncarnations).toBe(2);
  });
});

// ─── §2.4 Scorecard: articulationRecall (per-cone) ────────────────────────────

describe("scorecard: articulationRecall computation (per-cone)", () => {
  function score(
    incarnationSet: IncarnationSetManifest,
    claim: Partial<BriefingClaim> = {},
  ) {
    const fx = makeMinimalFixture(incarnationSet);
    const manifest = generateManifest(fx);
    return scorePhase1(fx, manifest, claim as BriefingClaim).articulationRecall;
  }

  it("T7: meanRecall=1 when LLM claims exact per-cone loci counts", () => {
    const r = score(MULTI_CONE_SET, {
      claimedIncarnationCount: 2,
      claimedMinimalPremiseLociCountPerCone: [3, 2],
    });
    expect(r.meanRecall).toBe(1);
    expect(r.perCone).toHaveLength(2);
    expect(r.perCone.every((c) => c.recall === 1 && !c.undercount)).toBe(true);
    expect(r.incarnationCountRecall).toBe(1);
    expect(r.miscountAcrossCones).toBe(false);
  });

  it("T8: meanRecall < 1 when LLM under-counts in one cone", () => {
    const r = score(MULTI_CONE_SET, {
      claimedIncarnationCount: 2,
      claimedMinimalPremiseLociCountPerCone: [1, 2],
    });
    expect(r.meanRecall).toBeLessThan(1);
    expect(r.perCone[0].undercount).toBe(true);
    expect(r.perCone[0].recall).toBeCloseTo(1 / 3);
    expect(r.perCone[1].undercount).toBe(false);
  });

  it("T9: meanRecall=1 (vacuous) when antichain is empty", () => {
    const r = score(EMPTY_SET, { claimedIncarnationCount: 0 });
    expect(r.meanRecall).toBe(1);
    expect(r.incarnationCountRecall).toBe(1);
    expect(r.perCone).toHaveLength(0);
  });

  it("T10: meanRecall=1 (vacuous) when per-cone claim is absent", () => {
    const r = score(EMPTY_SET);
    expect(r.meanRecall).toBe(1);
    expect(r.miscountAcrossCones).toBe(false);
  });

  it("T11: incarnationCountRecall < 1 when LLM under-counts |Inc(B)|", () => {
    const r = score(MULTI_CONE_SET, {
      claimedIncarnationCount: 1,
      claimedMinimalPremiseLociCountPerCone: [3],
    });
    expect(r.incarnationCountRecall).toBeCloseTo(1 / 2);
    expect(r.miscountAcrossCones).toBe(true);
  });
});

// ─── §2.4 detectConfidentMisstatements: per-cone + miscount-across-cones ─────

describe("detectConfidentMisstatements: incarnation-undercount + miscount-across-cones", () => {
  function detect(
    incarnationSet: IncarnationSetManifest,
    claim: Partial<BriefingClaim> = {},
  ) {
    const fx = makeMinimalFixture(incarnationSet);
    const manifest = generateManifest(fx);
    return scorePhase1(fx, manifest, claim as BriefingClaim).confidentMisstatements;
  }

  it("T12: fires incarnation-undercount for each cone where claimed < cone.loci.length", () => {
    const ms = detect(MULTI_CONE_SET, {
      claimedIncarnationCount: 2,
      claimedMinimalPremiseLociCountPerCone: [1, 0],
    });
    const undercounts = ms.filter((m) => m.kind === "incarnation-undercount");
    expect(undercounts).toHaveLength(2);
    expect(undercounts[0].detail).toContain("cone 0");
    expect(undercounts[1].detail).toContain("cone 1");
  });

  it("T13: does NOT fire incarnation-undercount when every claim matches its cone", () => {
    const ms = detect(MULTI_CONE_SET, {
      claimedIncarnationCount: 2,
      claimedMinimalPremiseLociCountPerCone: [3, 2],
    });
    expect(ms.map((m) => m.kind)).not.toContain("incarnation-undercount");
  });

  it("T14: does NOT fire when antichain is empty (safe default)", () => {
    const ms = detect(EMPTY_SET, {
      claimedIncarnationCount: 0,
      claimedMinimalPremiseLociCountPerCone: [],
    });
    expect(ms.map((m) => m.kind)).not.toContain("incarnation-undercount");
    expect(ms.map((m) => m.kind)).not.toContain("miscount-across-cones");
  });

  it("T15: does NOT fire when per-cone claim array is absent", () => {
    const ms = detect(MULTI_CONE_SET, { claimedIncarnationCount: 2 });
    expect(ms.map((m) => m.kind)).not.toContain("incarnation-undercount");
  });

  it("T16: fires miscount-across-cones when |Inc(B)|≥2 and claimedIncarnationCount < |Inc(B)|", () => {
    const ms = detect(MULTI_CONE_SET, {
      claimedIncarnationCount: 1,
      claimedMinimalPremiseLociCountPerCone: [3],
    });
    const kinds = ms.map((m) => m.kind);
    expect(kinds).toContain("miscount-across-cones");
    const m = ms.find((x) => x.kind === "miscount-across-cones");
    expect(m?.detail).toContain("claimed 1");
    expect(m?.detail).toContain("Inc(B) has 2");
  });

  it("T16b: does NOT fire miscount-across-cones for single-cone antichain regardless of claimedIncarnationCount", () => {
    const ms = detect(SINGLE_CONE_SET, {
      claimedIncarnationCount: 0,
      claimedMinimalPremiseLociCountPerCone: [3],
    });
    expect(ms.map((m) => m.kind)).not.toContain("miscount-across-cones");
  });
});

// ─── §2.5 MockBriefingClient: per-cone emission ──────────────────────────────

describe("MockBriefingClient: per-cone claims", () => {
  const client = new MockBriefingClient();

  it("T17: emits claimedIncarnationCount and per-cone array of correct length & values", async () => {
    const fx = makeMinimalFixture(MULTI_CONE_SET);
    const claim = await client.produceBriefingClaim(fx);
    expect(claim.claimedIncarnationCount).toBe(2);
    expect(claim.claimedMinimalPremiseLociCountPerCone).toEqual([3, 2]);
  });

  it("T18: omits both fields when antichain is empty", async () => {
    const fx = makeMinimalFixture(EMPTY_SET);
    const claim = await client.produceBriefingClaim(fx);
    expect(claim.claimedIncarnationCount).toBeUndefined();
    expect(claim.claimedMinimalPremiseLociCountPerCone).toBeUndefined();
  });
});

// ─── §2.6 Per-fixture cardinalities + happy path ─────────────────────────────

describe("Per-fixture happy path: articulationRecall.meanRecall === 1", () => {
  let corpus: ReturnType<typeof loadCorpus>;
  const client = new MockBriefingClient();

  beforeAll(() => {
    corpus = loadCorpus(V2_CORPUS_PATH);
  });

  const fixtureIds = [
    "large-real-db",
    "small-coequal-hubs-db",
    "small-diffuse-hubs-db",
    "small-refusal-rich-db",
    "small-single-hub-db",
  ] as const;

  for (const id of fixtureIds) {
    it(`T-fixture-${id}: articulationRecall.meanRecall === 1 (mock perfect recall)`, async () => {
      const fixture = corpus.fixtures.find((f) => f.id === id);
      expect(fixture).toBeDefined();
      const manifest = generateManifest(fixture!);
      const claim = await client.produceBriefingClaim(fixture!);
      const report = scorePhase1(fixture!, manifest, claim);

      expect(report.articulationRecall.meanRecall).toBe(1);
      expect(report.articulationRecall.miscountAcrossCones).toBe(false);
      const kinds = report.confidentMisstatements.map((m) => m.kind);
      expect(kinds).not.toContain("incarnation-undercount");
      expect(kinds).not.toContain("miscount-across-cones");
    });
  }

  it("T19: small-coequal-hubs-db has incarnationSet.incarnations.length === 2", () => {
    const fixture = corpus.fixtures.find((f) => f.id === "small-coequal-hubs-db");
    const manifest = generateManifest(fixture!);
    expect(manifest.incarnationSet.incarnations).toHaveLength(2);
  });

  it("T20: large-real-db has incarnationSet.totalIncarnations === 8", () => {
    const fixture = corpus.fixtures.find((f) => f.id === "large-real-db");
    const manifest = generateManifest(fixture!);
    expect(manifest.incarnationSet.totalIncarnations).toBe(8);
    expect(manifest.incarnationSet.incarnations).toHaveLength(8);
  });

  it("T21: large-real-db has incarnations[0].loci.length === 12", () => {
    const fixture = corpus.fixtures.find((f) => f.id === "large-real-db");
    const manifest = generateManifest(fixture!);
    expect(manifest.incarnationSet.incarnations[0].loci).toHaveLength(12);
  });

  it("T22: mock scorecard pass=true for all v2 fixtures (no regressions from Phase 2b)", async () => {
    for (const fixture of corpus.fixtures) {
      const manifest = generateManifest(fixture);
      const claim = await client.produceBriefingClaim(fixture);
      const report = scorePhase1(fixture, manifest, claim);
      expect(report.pass).toBe(true);
      expect(report.confidentMisstatements).toHaveLength(0);
    }
  });
});
