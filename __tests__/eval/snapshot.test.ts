/**
 * Smoke tests for the AI-EPI snapshot pipeline.
 *
 * These tests do NOT touch the database — they only exercise:
 *   - The corpus-v2 manifest is well-formed and loads without error.
 *   - The hash-drift validation in `loadCorpus` actually fires.
 *   - The spec module is importable and well-typed.
 *   - The seed builder + capture script TypeScript compiles.
 *
 * The actual seed → readout → JSON pipeline is exercised by running
 * `tsx eval/ai-epi/snapshot/captureFixture.ts` against a dev DB.
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadCorpus } from "../../eval/ai-epi/loadCorpus";
import { ALL_SPECS } from "../../eval/ai-epi/snapshot/specs";

const CORPUS_V2_MANIFEST = join(
  __dirname,
  "..",
  "..",
  "eval",
  "ai-epi",
  "corpus",
  "v2",
  "manifest.json",
);

/**
 * Per-spec expected topology *shape* (intentionally narrow: covers the
 * design intent of each spec, not every readout field). If any of these
 * assertions fail, the spec's structure has drifted from its purpose
 * and either the spec or the readout pipeline has regressed.
 */
const EXPECTED_SHAPE_BY_SLUG: Record<
  string,
  {
    hubShape: "single-dominant" | "co-equal-cluster" | "diffuse" | "empty";
    hubSetSize: number;
    hubAmbiguity: "none" | "low" | "medium" | "high";
    minLoadBearingPremises: number;
    requiredRefusalKinds: string[];
  }
> = {
  "small-single-hub-db": {
    hubShape: "single-dominant",
    hubSetSize: 1,
    hubAmbiguity: "none",
    minLoadBearingPremises: 1,
    requiredRefusalKinds: [],
  },
  "small-coequal-hubs-db": {
    hubShape: "co-equal-cluster",
    hubSetSize: 3,
    hubAmbiguity: "medium",
    minLoadBearingPremises: 0,
    requiredRefusalKinds: [],
  },
  "small-diffuse-hubs-db": {
    hubShape: "diffuse",
    hubSetSize: 6,
    hubAmbiguity: "high",
    minLoadBearingPremises: 0,
    requiredRefusalKinds: [],
  },
  "small-refusal-rich-db": {
    hubShape: "empty",
    hubSetSize: 0,
    hubAmbiguity: "none",
    minLoadBearingPremises: 0,
    requiredRefusalKinds: ["unanswered-undercut", "unanswered-undermine"],
  },
};

describe("eval/ai-epi/snapshot: corpus v2", () => {
  it("loads cleanly even when empty", () => {
    const corpus = loadCorpus(CORPUS_V2_MANIFEST);
    expect(corpus.version).toBe("v2");
    expect(Array.isArray(corpus.fixtures)).toBe(true);
  });

  it("every captured fixture matches its spec's expected topology shape", () => {
    const corpus = loadCorpus(CORPUS_V2_MANIFEST);
    for (const fixture of corpus.fixtures) {
      const expected = EXPECTED_SHAPE_BY_SLUG[fixture.id];
      if (!expected) continue; // new fixture without an expectation yet
      const r = fixture.readout as unknown as {
        topology: {
          hubs: { shape: string; set: unknown[] };
          loadBearingPremises: unknown[];
          ambiguity: { hubAmbiguity: string };
        };
        refusalSurface: { cannotConcludeBecause: Array<{ blockedBy: string }> };
      };
      expect(r.topology.hubs.shape).toBe(expected.hubShape);
      expect(r.topology.hubs.set.length).toBe(expected.hubSetSize);
      expect(r.topology.ambiguity.hubAmbiguity).toBe(expected.hubAmbiguity);
      expect(r.topology.loadBearingPremises.length).toBeGreaterThanOrEqual(
        expected.minLoadBearingPremises,
      );
      const refusalKinds = r.refusalSurface.cannotConcludeBecause.map(
        (e) => e.blockedBy,
      );
      for (const kind of expected.requiredRefusalKinds) {
        expect(refusalKinds).toContain(kind);
      }
    }
  });

  it("large-real-db fixture (if captured) is in the `large` size tier", () => {
    const corpus = loadCorpus(CORPUS_V2_MANIFEST);
    const fixture = corpus.fixtures.find((f) => f.id === "large-real-db");
    if (!fixture) return; // not yet captured in this environment
    const r = fixture.readout as unknown as {
      topology: {
        sizeTier: {
          argumentCount: number;
          tier: string;
          hierarchicalMode: boolean;
        };
      };
    };
    expect(r.topology.sizeTier.tier).toBe("large");
    expect(r.topology.sizeTier.hierarchicalMode).toBe(false);
    expect(r.topology.sizeTier.argumentCount).toBeGreaterThan(80);
    expect(r.topology.sizeTier.argumentCount).toBeLessThanOrEqual(250);
  });
});

describe("eval/ai-epi/snapshot: specs", () => {
  it("exports at least one spec", () => {
    expect(ALL_SPECS.length).toBeGreaterThan(0);
  });

  it("every spec has unique slug, claims, arguments", () => {
    const slugs = new Set<string>();
    for (const spec of ALL_SPECS) {
      expect(slugs.has(spec.slug)).toBe(false);
      slugs.add(spec.slug);
      if (spec.kind === "from-existing") continue;
      expect(spec.claims.length).toBeGreaterThan(0);
      expect(spec.arguments.length).toBeGreaterThan(0);
    }
  });

  it("every spec's edges and CQ targets reference declared arguments", () => {
    for (const spec of ALL_SPECS) {
      if (spec.kind === "from-existing") continue;
      const argIds = new Set(spec.arguments.map((a) => a.id));
      for (const e of spec.edges) {
        expect(argIds.has(e.from)).toBe(true);
        expect(argIds.has(e.to)).toBe(true);
      }
      for (const cq of spec.cqStatuses) {
        expect(argIds.has(cq.targetArgumentId)).toBe(true);
      }
    }
  });

  it("every spec's argument premises and conclusions reference declared claims", () => {
    for (const spec of ALL_SPECS) {
      if (spec.kind === "from-existing") continue;
      const claimIds = new Set(spec.claims.map((c) => c.id));
      for (const arg of spec.arguments) {
        if (arg.conclusionClaimId) {
          expect(claimIds.has(arg.conclusionClaimId)).toBe(true);
        }
        for (const p of arg.premiseClaimIds) {
          expect(claimIds.has(p)).toBe(true);
        }
      }
    }
  });
});

describe("eval/ai-epi: hash-drift validation in loadCorpus", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ai-epi-test-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFixture(hash: string): string {
    const path = join(tmpDir, "fix.json");
    const fixture = {
      id: "fix",
      description: "test",
      adversarialGates: [],
      readout: {
        deliberationId: "fix",
        contentHash: hash,
        fingerprint: { argumentCount: 1 },
        frontier: {
          unansweredCqs: [],
          unansweredUndercuts: [],
          unansweredUndermines: [],
          terminalLeaves: [],
          loadBearingnessRanking: [],
          loadBearingnessScores: {},
          contestednessRanking: [],
        },
        topology: {
          hubs: { set: [], topScore: 0, coequalThreshold: 1, shape: "empty" },
          loadBearingPremises: [],
          ambiguity: { hubAmbiguity: "none", premiseConcentration: "none", cautions: [] },
          sizeTier: { argumentCount: 1, tier: "small", hierarchicalMode: false, disclosure: null },
        },
        refusalSurface: { cannotConcludeBecause: [] },
        chains: { deliberationId: "fix", chains: [], uncoveredClaims: [] },
        topArguments: [],
        mostContested: [],
      },
    };
    writeFileSync(path, JSON.stringify(fixture));
    return path;
  }

  it("loads when manifest hash matches fixture", () => {
    writeFixture("hash-A");
    const manifestPath = join(tmpDir, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "test",
        fixtures: [{ id: "fix", path: "fix.json", description: "", contentHash: "hash-A" }],
      }),
    );
    const corpus = loadCorpus(manifestPath);
    expect(corpus.fixtures.length).toBe(1);
  });

  it("throws when manifest hash diverges from fixture", () => {
    writeFixture("hash-B");
    const manifestPath = join(tmpDir, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "test",
        fixtures: [{ id: "fix", path: "fix.json", description: "", contentHash: "hash-A" }],
      }),
    );
    expect(() => loadCorpus(manifestPath)).toThrow(/Corpus drift/);
  });

  it("loads without validation when manifest omits contentHash", () => {
    writeFixture("hash-Z");
    const manifestPath = join(tmpDir, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "test",
        fixtures: [{ id: "fix", path: "fix.json", description: "" }],
      }),
    );
    const corpus = loadCorpus(manifestPath);
    expect(corpus.fixtures.length).toBe(1);
  });
});
