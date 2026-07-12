/**
 * Phase 1g invariant tests — scorecard + manifest extensions.
 *
 * Covers:
 *   - manifestGenerator: new fields (openExposurePoints, coverageRatio, fossilCount) from manifestFields
 *   - manifestGenerator: defaults to 0 when manifestFields absent
 *   - scorePhase1: coverageExposure score computation
 *   - scorePhase1: coverage-exposure-zero confidentMisstatement (threshold > 5)
 *   - v2 fixture corpus: all 7 fixtures have valid manifestFields
 *   - v2 fixture corpus: mock client passes scorecard including new coverage-exposure dimension
 */

import { join } from "node:path";
import { generateManifest } from "../../eval/ai-epi/manifestGenerator";
import { scorePhase1 } from "../../eval/ai-epi/scorecard/phase1";
import { loadCorpus } from "../../eval/ai-epi/loadCorpus";
import { MockBriefingClient } from "../../eval/ai-epi/llm/mockClient";
import type { Fixture } from "../../eval/ai-epi/types";

const V2_CORPUS_PATH = join(
  __dirname,
  "..",
  "..",
  "eval",
  "ai-epi",
  "corpus",
  "v2",
  "manifest.json",
);

// ── Shared fixture factories ──────────────────────────────────────────────────

function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: "test-fixture",
    description: "test",
    adversarialGates: [],
    readout: {
      deliberationId: "delib-test",
      contentHash: "sha256:abc123",
      fingerprint: {
        deliberationId: "delib-test",
        contentHash: "sha256:abc123",
        argumentCount: 5,
        claimCount: 6,
        edgeCount: { support: 4, attack: 1, ca: 0 },
        schemeDistribution: {},
        authorCount: { human: 5, ai: 0, hybrid: 0 },
        participantCount: 2,
        standingDistribution: {},
        depthDistribution: {},
        medianChallengerCount: 0,
        meanChallengerCount: 0,
        challengerCoverage: 0,
        medianChallengerCountAmongChallenged: 0,
        cqCoverage: { answered: 1, partial: 0, unanswered: 1, total: 2 },
        evidenceCoverage: { withProvenance: 0, withoutProvenance: 0 },
        chainCount: 0,
        extraction: {
          aiSeededCount: 0,
          aiSeededRatio: 0,
          humanEngagementRateOnAiSeeds: null,
          articulationOnly: false,
        },
      } as Fixture["readout"]["fingerprint"],
      frontier: {
        loadBearingnessRanking: ["arg-1", "arg-2"],
        loadBearingnessScores: {},
        unansweredCqs: [
          { targetArgumentId: "arg-1", cqKey: "CQ1", prompt: "Is this warranted?" },
        ],
      } as Fixture["readout"]["frontier"],
      topology: {
        hubs: {
          set: [{ argumentId: "arg-1", score: 90 }],
          shape: "single-dominant",
          topScore: 90,
          coequalThreshold: 18,
        },
        loadBearingPremises: [],
        sizeTier: { label: "small", hierarchicalMode: false },
        argumentCount: 5,
      } as unknown as Fixture["readout"]["topology"],
      refusalSurface: { cannotConcludeBecause: [] },
      chains: [],
      topArguments: [],
      mostContested: null,
    },
    ...overrides,
  };
}

// ── manifestGenerator: new manifest fields ────────────────────────────────────

describe("manifestGenerator — Phase 1g manifest fields", () => {
  it("reads openExposurePoints from manifestFields", () => {
    const fixture = makeFixture({ manifestFields: { openExposurePoints: 7, coverageRatio: 0.3, fossilCount: 2 } });
    const manifest = generateManifest(fixture);
    expect(manifest.openExposurePoints).toBe(7);
  });

  it("reads coverageRatio from manifestFields", () => {
    const fixture = makeFixture({ manifestFields: { openExposurePoints: 4, coverageRatio: 0.75, fossilCount: 0 } });
    const manifest = generateManifest(fixture);
    expect(manifest.coverageRatio).toBe(0.75);
  });

  it("reads fossilCount from manifestFields", () => {
    const fixture = makeFixture({ manifestFields: { openExposurePoints: 0, coverageRatio: 0, fossilCount: 5 } });
    const manifest = generateManifest(fixture);
    expect(manifest.fossilCount).toBe(5);
  });

  it("defaults all three fields to 0 when manifestFields is absent", () => {
    const fixture = makeFixture(); // no manifestFields
    const manifest = generateManifest(fixture);
    expect(manifest.openExposurePoints).toBe(0);
    expect(manifest.coverageRatio).toBe(0);
    expect(manifest.fossilCount).toBe(0);
  });

  it("defaults to 0 when manifestFields is present but individual fields are missing", () => {
    // Partial override — TypeScript wouldn't allow this normally but
    // runtime fallback should handle it.
    const fixture = makeFixture({ manifestFields: {} as never });
    const manifest = generateManifest(fixture);
    expect(manifest.openExposurePoints).toBe(0);
    expect(manifest.coverageRatio).toBe(0);
    expect(manifest.fossilCount).toBe(0);
  });
});

// ── scorePhase1: coverageExposure dimension ───────────────────────────────────

describe("scorePhase1 — coverageExposure score (Phase 1g)", () => {
  function score(
    openExposurePoints: number,
    claimedOpenCqs: string[] | undefined,
  ) {
    const fixture = makeFixture({
      manifestFields: { openExposurePoints, coverageRatio: 0, fossilCount: 0 },
    });
    const manifest = generateManifest(fixture);
    return scorePhase1(fixture, manifest, {
      claimedOpenCqs,
      claimedHubSet: ["arg-1"],
      claimedHubShape: "single-dominant",
    });
  }

  it("recall is 1.0 when openExposurePoints is 0 (vacuous)", () => {
    const report = score(0, undefined);
    expect(report.coverageExposure.recall).toBe(1);
    expect(report.coverageExposure.openExposurePoints).toBe(0);
    expect(report.coverageExposure.claimedCount).toBe(0);
  });

  it("recall is 0.0 when openExposurePoints > 0 and claimedOpenCqs is empty", () => {
    const report = score(5, undefined);
    expect(report.coverageExposure.recall).toBe(0);
    expect(report.coverageExposure.claimedCount).toBe(0);
  });

  it("recall is clamped to 1.0 when claimedCount > openExposurePoints", () => {
    // 10 claimed but only 3 openExposurePoints → recall = 3/3 = 1
    const report = score(3, ["a::CQ1", "b::CQ2", "c::CQ3", "d::CQ4", "e::CQ5", "f::CQ6", "g::CQ7", "h::CQ8", "i::CQ9", "j::CQ10"]);
    expect(report.coverageExposure.recall).toBe(1);
    expect(report.coverageExposure.claimedCount).toBe(10);
  });

  it("partial recall when claimedCount < openExposurePoints", () => {
    // 4 claimed, 10 openExposurePoints → recall = 4/10 = 0.4
    const report = score(10, ["a::CQ1", "b::CQ2", "c::CQ3", "d::CQ4"]);
    expect(report.coverageExposure.recall).toBeCloseTo(0.4);
  });

  it("coverageExposure is included in the report", () => {
    const report = score(5, ["a::CQ1"]);
    expect(report).toHaveProperty("coverageExposure");
    expect(report.coverageExposure).toMatchObject({
      openExposurePoints: 5,
      claimedCount: 1,
    });
  });
});

// ── scorePhase1: coverage-exposure-zero confidentMisstatement ─────────────────

describe("scorePhase1 — coverage-exposure-zero confidentMisstatement (Phase 1g)", () => {
  function score(
    openExposurePoints: number,
    claimedOpenCqs: string[] | undefined,
  ) {
    const fixture = makeFixture({
      manifestFields: { openExposurePoints, coverageRatio: 0, fossilCount: 0 },
    });
    const manifest = generateManifest(fixture);
    return scorePhase1(fixture, manifest, {
      claimedOpenCqs,
      claimedHubSet: ["arg-1"],
      claimedHubShape: "single-dominant",
    });
  }

  it("does NOT fire when openExposurePoints === 0", () => {
    const report = score(0, undefined);
    const kinds = report.confidentMisstatements.map((m) => m.kind);
    expect(kinds).not.toContain("coverage-exposure-zero");
  });

  it("does NOT fire when openExposurePoints === 5 (threshold is >5, not >=5)", () => {
    const report = score(5, undefined);
    const kinds = report.confidentMisstatements.map((m) => m.kind);
    expect(kinds).not.toContain("coverage-exposure-zero");
  });

  it("fires when openExposurePoints === 6 and claimedOpenCqs is undefined", () => {
    const report = score(6, undefined);
    const kinds = report.confidentMisstatements.map((m) => m.kind);
    expect(kinds).toContain("coverage-exposure-zero");
  });

  it("fires when openExposurePoints === 10 and claimedOpenCqs is empty array", () => {
    const report = score(10, []);
    const kinds = report.confidentMisstatements.map((m) => m.kind);
    expect(kinds).toContain("coverage-exposure-zero");
  });

  it("does NOT fire when openExposurePoints > 5 but claimedOpenCqs has entries", () => {
    const report = score(20, ["arg-1::CQ1"]);
    const kinds = report.confidentMisstatements.map((m) => m.kind);
    expect(kinds).not.toContain("coverage-exposure-zero");
  });

  it("coverage-exposure-zero triggers pass=false", () => {
    const report = score(10, undefined);
    expect(report.pass).toBe(false);
    expect(report.confidentMisstatements.some((m) => m.kind === "coverage-exposure-zero")).toBe(true);
  });
});

// ── v2 fixture corpus: manifestFields validation ──────────────────────────────

describe("v2 corpus fixture validation (Phase 1g)", () => {
  const corpus = loadCorpus(V2_CORPUS_PATH);

  it("loads 7 v2 fixtures", () => {
    expect(corpus.fixtures).toHaveLength(7);
  });

  for (const fixture of corpus.fixtures) {
    describe(`fixture: ${fixture.id}`, () => {
      it("has manifestFields", () => {
        expect(fixture.manifestFields).toBeDefined();
      });

      it("manifestFields.openExposurePoints is a non-negative number", () => {
        expect(typeof fixture.manifestFields?.openExposurePoints).toBe("number");
        expect(fixture.manifestFields!.openExposurePoints).toBeGreaterThanOrEqual(0);
      });

      it("manifestFields.coverageRatio is 0..1", () => {
        const r = fixture.manifestFields!.coverageRatio;
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      });

      it("manifestFields.fossilCount is a non-negative number", () => {
        expect(fixture.manifestFields!.fossilCount).toBeGreaterThanOrEqual(0);
      });

      it("generateManifest includes openExposurePoints in manifest", () => {
        const manifest = generateManifest(fixture);
        expect(manifest.openExposurePoints).toBe(fixture.manifestFields!.openExposurePoints);
      });
    });
  }
});

// ── v2 corpus: mock client passes scorecard including coverage-exposure ────────

describe("v2 corpus: mock client passes Phase 1g scorecard", () => {
  const corpus = loadCorpus(V2_CORPUS_PATH);
  const client = new MockBriefingClient();

  for (const fixture of corpus.fixtures) {
    it(`${fixture.id} — mock client passes scorecard (including coverageExposure)`, async () => {
      const manifest = generateManifest(fixture);
      const claim = await client.produceBriefingClaim(fixture);
      const report = scorePhase1(fixture, manifest, claim);

      // coverage-exposure-zero must not fire on the mock client
      const kinds = report.confidentMisstatements.map((m) => m.kind);
      expect(kinds).not.toContain("coverage-exposure-zero");

      // coverageExposure must be present and structurally correct
      expect(report.coverageExposure).toBeDefined();
      expect(report.coverageExposure.openExposurePoints).toBe(manifest.openExposurePoints);
      expect(report.coverageExposure.recall).toBeGreaterThanOrEqual(0);
      expect(report.coverageExposure.recall).toBeLessThanOrEqual(1);

      // Overall pass
      if (!report.pass) {
        const lines = [`Fixture ${fixture.id} failed Phase 1g scorecard:`];
        for (const m of report.confidentMisstatements) {
          lines.push(`  [${m.kind}]: ${m.detail}`);
        }
        for (const g of report.adversarialGateResults) {
          if (!g.passed) lines.push(`  gate ${g.gate} FAILED: ${g.detail}`);
        }
        throw new Error(lines.join("\n"));
      }
      expect(report.pass).toBe(true);
    });
  }
});
