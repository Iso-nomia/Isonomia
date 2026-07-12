/**
 * Tests for the AI-EPI eval harness (Phase 1).
 */

import { join } from "node:path";
import { loadCorpus } from "../../eval/ai-epi/loadCorpus";
import { generateManifest } from "../../eval/ai-epi/manifestGenerator";
import { scorePhase1 } from "../../eval/ai-epi/scorecard/phase1";
import type { BriefingClaim, Fixture } from "../../eval/ai-epi/types";

const CORPUS_PATH = join(
  __dirname,
  "..",
  "..",
  "eval",
  "ai-epi",
  "corpus",
  "v1",
  "manifest.json",
);

describe("eval/ai-epi: corpus loading", () => {
  it("loads all v1 fixtures without error", () => {
    const corpus = loadCorpus(CORPUS_PATH);
    expect(corpus.version).toBe("v1");
    expect(corpus.fixtures.length).toBeGreaterThanOrEqual(5);
    for (const fx of corpus.fixtures) {
      expect(fx.id).toBeTruthy();
      expect(fx.readout.contentHash).toBeTruthy();
      expect(fx.readout.fingerprint.argumentCount).toBeGreaterThan(0);
    }
  });
});

describe("eval/ai-epi: manifest generator", () => {
  it("extracts the manifest from a single-hub fixture", () => {
    const corpus = loadCorpus(CORPUS_PATH);
    const fx = corpus.fixtures.find((f) => f.id === "small-single-hub")!;
    const m = generateManifest(fx);
    expect(m.fixtureId).toBe("small-single-hub");
    expect(m.hubShape).toBe("single-dominant");
    expect(m.hubSet).toEqual(["a1"]);
    expect(m.openCqs).toEqual(["a1::CE1"]);
    expect(m.refusedConclusionIds).toEqual([]);
    expect(m.hierarchicalMode).toBe(false);
    expect(m.argumentCount).toBe(5);
  });

  it("extracts hub set with multiplicity for co-equal fixture", () => {
    const corpus = loadCorpus(CORPUS_PATH);
    const fx = corpus.fixtures.find((f) => f.id === "small-coequal-hubs")!;
    const m = generateManifest(fx);
    expect(m.hubShape).toBe("co-equal-cluster");
    expect(m.hubSet).toEqual(["a1", "a2", "a3"]);
  });

  it("extracts refused conclusion ids", () => {
    const corpus = loadCorpus(CORPUS_PATH);
    const fx = corpus.fixtures.find((f) => f.id === "medium-with-refusals")!;
    const m = generateManifest(fx);
    expect(m.refusedConclusionIds.sort()).toEqual(["c1", "c2"]);
    expect(m.openCqs.length).toBe(2);
  });

  it("flags hierarchicalMode for very-large fixture", () => {
    const corpus = loadCorpus(CORPUS_PATH);
    const fx = corpus.fixtures.find((f) => f.id === "large-hierarchical")!;
    const m = generateManifest(fx);
    expect(m.hierarchicalMode).toBe(true);
    expect(m.argumentCount).toBe(300);
  });
});

describe("eval/ai-epi: phase 1 scorecard", () => {
  function loadFx(id: string): Fixture {
    return loadCorpus(CORPUS_PATH).fixtures.find((f) => f.id === id)!;
  }

  describe("vacuous (empty briefing) baselines", () => {
    it("on a clean fixture: precision=1, recall=0 (no claims), no misstatements, passes adversarial (none)", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      const r = scorePhase1(fx, m, {});
      // empty claim → vacuous precision (no false positives)
      expect(r.hub.precision).toBe(1);
      // ground truth has 1 hub; recall is 0 with empty claim
      expect(r.hub.recall).toBe(0);
      expect(r.confidentMisstatements).toEqual([]);
      expect(r.adversarialGateResults).toEqual([]);
      expect(r.pass).toBe(true);
    });

    it("on hierarchical fixture: empty briefing produces a missing-disclosure misstatement and fails", () => {
      const fx = loadFx("large-hierarchical");
      const m = generateManifest(fx);
      const r = scorePhase1(fx, m, {});
      const kinds = r.confidentMisstatements.map((x) => x.kind);
      expect(kinds).toContain("missing-hierarchical-disclosure");
      expect(r.pass).toBe(false);
    });
  });

  describe("confident-misstatement detection", () => {
    it("detects hub-shape mismatch", () => {
      const fx = loadFx("small-coequal-hubs");
      const m = generateManifest(fx);
      const claim: BriefingClaim = { claimedHubShape: "single-dominant" };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).toContain(
        "hub-shape-mismatch",
      );
      expect(r.pass).toBe(false);
    });

    it("detects naming a single hub on a co-equal fixture", () => {
      const fx = loadFx("small-coequal-hubs");
      const m = generateManifest(fx);
      const claim: BriefingClaim = { claimedHubSet: ["a1"] };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).toContain(
        "named-single-hub-when-coequal",
      );
    });

    it("detects naming a single hub on a diffuse fixture", () => {
      const fx = loadFx("medium-diffuse");
      const m = generateManifest(fx);
      const claim: BriefingClaim = { claimedHubSet: ["a1"] };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).toContain(
        "named-single-hub-when-diffuse",
      );
    });

    it("detects asserting a refused conclusion", () => {
      const fx = loadFx("medium-with-refusals");
      const m = generateManifest(fx);
      const claim: BriefingClaim = { assertedConclusions: ["c1"] };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).toContain(
        "asserted-refused-conclusion",
      );
    });

    it("detects false-confidence on co-equal hubs (uncertainty not flagged)", () => {
      const fx = loadFx("small-coequal-hubs");
      const m = generateManifest(fx);
      // Hub claim on ambiguous (co-equal) topology without flagging
      // uncertainty: must trip false-confidence-on-ambiguous-topology.
      const claim: BriefingClaim = {
        claimedHubSet: ["a1", "a2", "a3"],
        claimedHubShape: "co-equal-cluster",
      };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).toContain(
        "false-confidence-on-ambiguous-topology",
      );
      expect(r.pass).toBe(false);
    });

    it("does not fire false-confidence when uncertainty is flagged", () => {
      const fx = loadFx("small-coequal-hubs");
      const m = generateManifest(fx);
      const claim: BriefingClaim = {
        claimedHubSet: ["a1", "a2", "a3"],
        claimedHubShape: "co-equal-cluster",
        expressedTopologyUncertainty: true,
      };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).not.toContain(
        "false-confidence-on-ambiguous-topology",
      );
    });

    it("does not fire false-confidence when no hub claim is made on ambiguous topology", () => {
      const fx = loadFx("small-coequal-hubs");
      const m = generateManifest(fx);
      // No hub claims at all → no false-confidence (briefing stayed silent).
      const claim: BriefingClaim = {};
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).not.toContain(
        "false-confidence-on-ambiguous-topology",
      );
    });

    it("does not fire false-confidence on unambiguous (single-dominant) topology", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      const claim: BriefingClaim = {
        claimedHubSet: ["a1"],
        claimedHubShape: "single-dominant",
      };
      const r = scorePhase1(fx, m, claim);
      expect(r.confidentMisstatements.map((x) => x.kind)).not.toContain(
        "false-confidence-on-ambiguous-topology",
      );
    });
  });

  describe("adversarial gate evaluation", () => {
    it("co-equal-hubs-not-collapsed gate passes when ≥2 hubs claimed", () => {
      const fx = loadFx("small-coequal-hubs");
      const m = generateManifest(fx);
      const claim: BriefingClaim = {
        claimedHubSet: ["a1", "a2", "a3"],
        claimedHubShape: "co-equal-cluster",
        // hubShape is ambiguous (co-equal) → must flag uncertainty when
        // making hub claims, otherwise false-confidence-on-ambiguous-topology fires.
        expressedTopologyUncertainty: true,
      };
      const r = scorePhase1(fx, m, claim);
      const gate = r.adversarialGateResults.find(
        (g) => g.gate === "co-equal-hubs-not-collapsed",
      );
      expect(gate?.passed).toBe(true);
      expect(r.confidentMisstatements).toEqual([]);
      expect(r.pass).toBe(true);
    });

    it("hierarchical-disclosure-surfaced gate passes when surfaced", () => {
      const fx = loadFx("large-hierarchical");
      const m = generateManifest(fx);
      const claim: BriefingClaim = { surfacedHierarchicalDisclosure: true };
      const r = scorePhase1(fx, m, claim);
      const gate = r.adversarialGateResults.find(
        (g) => g.gate === "hierarchical-disclosure-surfaced",
      );
      expect(gate?.passed).toBe(true);
      expect(r.confidentMisstatements).toEqual([]);
      expect(r.pass).toBe(true);
    });
  });

  describe("precision/recall vacuous handling", () => {
    it("recall=1 when ground truth is empty", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      // load-bearing premises are empty in this fixture
      const r = scorePhase1(fx, m, {
        claimedLoadBearingPremises: [],
      });
      expect(r.loadBearingPremise.recall).toBe(1);
      expect(r.loadBearingPremise.precision).toBe(1);
    });
  });

  describe("Phase 2.1 — CQ prompting (load-bearing CQ recall + priority inversion)", () => {
    it("manifest.loadBearingOpenCqs is a subset of openCqs restricted to hub args", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      // small-single-hub: hubSet=['a1'], openCqs=['a1::CE1'] → load-bearing CQ = a1::CE1
      expect(m.loadBearingOpenCqs).toEqual(["a1::CE1"]);
    });

    it("loadBearingOpenCq dimension: full recall when briefing surfaces every hub CQ", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      const r = scorePhase1(fx, m, {
        claimedHubSet: ["a1"],
        claimedHubShape: "single-dominant",
        surfacedCqPrompts: ["a1::CE1"],
      });
      expect(r.loadBearingOpenCq.recall).toBe(1);
      expect(r.loadBearingOpenCq.precision).toBe(1);
      expect(
        r.confidentMisstatements.find(
          (c) => c.kind === "cq-priority-inversion",
        ),
      ).toBeUndefined();
    });

    it("flags cq-priority-inversion when briefing surfaces a non-hub CQ while omitting a hub CQ", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      // Pretend the briefing surfaces a CQ on a NON-hub argument while
      // omitting the hub CQ (a1::CE1).
      const r = scorePhase1(fx, m, {
        claimedHubSet: ["a1"],
        claimedHubShape: "single-dominant",
        surfacedCqPrompts: ["a4::SomeOtherCq"],
      });
      const inv = r.confidentMisstatements.find(
        (c) => c.kind === "cq-priority-inversion",
      );
      expect(inv).toBeDefined();
      expect(r.pass).toBe(false);
    });

    it("does NOT flag priority inversion when surfacedCqPrompts is omitted (recall miss, not inversion)", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      const r = scorePhase1(fx, m, {
        claimedHubSet: ["a1"],
        claimedHubShape: "single-dominant",
        // No surfacedCqPrompts — pure omission.
      });
      expect(
        r.confidentMisstatements.find(
          (c) => c.kind === "cq-priority-inversion",
        ),
      ).toBeUndefined();
      // But recall is 0 because the hub CQ wasn't surfaced.
      expect(r.loadBearingOpenCq.recall).toBe(0);
    });

    it("does NOT flag priority inversion when briefing covers every hub CQ AND adds non-hub CQs", () => {
      const fx = loadFx("small-single-hub");
      const m = generateManifest(fx);
      const r = scorePhase1(fx, m, {
        claimedHubSet: ["a1"],
        claimedHubShape: "single-dominant",
        surfacedCqPrompts: ["a1::CE1", "a4::SomeOtherCq"],
      });
      expect(
        r.confidentMisstatements.find(
          (c) => c.kind === "cq-priority-inversion",
        ),
      ).toBeUndefined();
      // Precision drops (extra non-hub CQ counted as false positive
      // against the load-bearing set), recall stays at 1.
      expect(r.loadBearingOpenCq.recall).toBe(1);
      expect(r.loadBearingOpenCq.precision).toBeLessThan(1);
    });
  });
});

import { derivePrioritizedOpenCqs } from "../../lib/deliberation/cqPrioritizer";

describe("eval/ai-epi: cqPrioritizer (Phase 2.1)", () => {
  function loadFxLocal(id: string): Fixture {
    return loadCorpus(CORPUS_PATH).fixtures.find((f) => f.id === id)!;
  }

  it("orders hub-targeting CQs ahead of non-hub CQs", () => {
    const fx = loadFxLocal("small-single-hub");
    const prioritized = derivePrioritizedOpenCqs(fx.readout);
    if (prioritized.length === 0) return; // vacuous for fixtures without CQs
    // First entry must target a hub (the fixture has one open CQ on hub a1).
    expect(prioritized[0].targetsHub).toBe(true);
    expect(prioritized[0].rank).toBe(0);
    expect(prioritized[0].id).toBe(
      `${prioritized[0].targetArgumentId}::${prioritized[0].cqKey}`,
    );
  });

  it("is deterministic across runs (same input → same output)", () => {
    const fx = loadFxLocal("small-single-hub");
    const a = derivePrioritizedOpenCqs(fx.readout);
    const b = derivePrioritizedOpenCqs(fx.readout);
    expect(a).toEqual(b);
  });
});
