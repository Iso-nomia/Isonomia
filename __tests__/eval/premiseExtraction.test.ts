/**
 * Tests for the Phase 2.2 premise-extraction harness:
 *   - mockPremiseExtractor (rule-based, deterministic)
 *   - scorePremiseExtraction (matching + warnings)
 *   - aggregateReports (micro-average)
 */

import { join } from "node:path";
import { mockPremiseExtractor } from "../../lib/deliberation/premiseExtractor";
import { loadPremiseExtractionCorpus } from "../../eval/ai-epi/premise-extraction/loadCorpus";
import {
  aggregateReports,
  scorePremiseExtraction,
} from "../../eval/ai-epi/premise-extraction/scorer";
import type {
  PremiseExtractionFixture,
} from "../../eval/ai-epi/premise-extraction/types";

const CORPUS_PATH = join(
  __dirname,
  "..",
  "..",
  "eval",
  "ai-epi",
  "premise-extraction",
  "corpus",
  "v1",
  "manifest.json",
);

describe("mockPremiseExtractor", () => {
  it("returns the whole claim as one atom when no split markers exist", async () => {
    const r = await mockPremiseExtractor.extract("Carbon pricing reduces emissions.");
    expect(r.premises).toHaveLength(1);
    expect(r.premises[0].text).toBe("Carbon pricing reduces emissions");
    expect(r.premises[0].provenanceSpan[0]).toBe(0);
  });

  it("splits on ' and '", async () => {
    const r = await mockPremiseExtractor.extract(
      "The proposal is fiscally sound and politically popular.",
    );
    expect(r.premises).toHaveLength(2);
    expect(r.premises[0].text).toBe("The proposal is fiscally sound");
    expect(r.premises[1].text).toBe("politically popular");
  });

  it("splits on ' because '", async () => {
    const r = await mockPremiseExtractor.extract(
      "The bill should pass because it closes a tax loophole.",
    );
    expect(r.premises).toHaveLength(2);
    expect(r.premises[0].text).toBe("The bill should pass");
    expect(r.premises[1].text).toBe("it closes a tax loophole");
  });

  it("splits on semicolons", async () => {
    const r = await mockPremiseExtractor.extract(
      "The project is on schedule; the budget is intact; the team is morale-positive.",
    );
    expect(r.premises).toHaveLength(3);
  });

  it("provenance spans round-trip back to the original claim text", async () => {
    const text = "The proposal is fiscally sound and politically popular.";
    const r = await mockPremiseExtractor.extract(text);
    for (const atom of r.premises) {
      const [s, e] = atom.provenanceSpan;
      const slice = text.slice(s, e);
      // Atom text strips trailing punctuation; provenance preserves
      // the source range. After stripping the slice's trailing
      // punctuation they should agree.
      const sliceTrimmed = slice.replace(/[\s.,;:!?]+$/u, "");
      expect(sliceTrimmed).toBe(atom.text);
    }
  });

  it("handles empty input gracefully", async () => {
    const r = await mockPremiseExtractor.extract("");
    expect(r.premises).toHaveLength(0);
  });
});

describe("scorePremiseExtraction", () => {
  function loadFx(id: string): PremiseExtractionFixture {
    return loadPremiseExtractionCorpus(CORPUS_PATH).fixtures.find(
      (f) => f.id === id,
    )!;
  }

  it("credits full P/R/F1 = 1 when extraction matches expected exactly", async () => {
    const fx = loadFx("single-atom");
    const ext = await mockPremiseExtractor.extract(fx.claimText);
    const r = scorePremiseExtraction(fx, ext);
    expect(r.precision).toBe(1);
    expect(r.recall).toBe(1);
    expect(r.f1).toBe(1);
  });

  it("honors aliases when matching variants", async () => {
    const fx = loadFx("and-conjunction");
    const ext = await mockPremiseExtractor.extract(fx.claimText);
    const r = scorePremiseExtraction(fx, ext);
    expect(r.recall).toBe(1);
  });

  it("recall is 0 when extractor misses an expected atom", () => {
    const fx = loadFx("list-with-semicolons");
    const r = scorePremiseExtraction(fx, {
      premises: [
        { text: "The project is on schedule", provenanceSpan: [0, 0] },
      ],
    });
    expect(r.truePositives).toBe(1);
    expect(r.falseNegatives).toBe(2);
    expect(r.recall).toBeCloseTo(1 / 3, 5);
  });

  it("precision penalizes extra spurious atoms", () => {
    const fx = loadFx("single-atom");
    const r = scorePremiseExtraction(fx, {
      premises: [
        { text: "Carbon pricing reduces emissions", provenanceSpan: [0, 0] },
        { text: "Unicorns exist", provenanceSpan: [0, 0] },
      ],
    });
    expect(r.truePositives).toBe(1);
    expect(r.falsePositives).toBe(1);
    expect(r.precision).toBeCloseTo(0.5, 5);
    expect(r.recall).toBe(1);
  });

  it("warns when provenanceSpan is out of range", () => {
    const fx = loadFx("single-atom");
    const r = scorePremiseExtraction(fx, {
      premises: [
        {
          text: "Carbon pricing reduces emissions",
          provenanceSpan: [0, 9999],
        },
      ],
    });
    expect(r.warnings.some((w) => w.includes("provenance-span-out-of-range"))).toBe(true);
  });

  it("does not warn for [0,0] sentinel spans", () => {
    const fx = loadFx("single-atom");
    const r = scorePremiseExtraction(fx, {
      premises: [
        { text: "Carbon pricing reduces emissions", provenanceSpan: [0, 0] },
      ],
    });
    expect(r.warnings.filter((w) => w.includes("provenance"))).toHaveLength(0);
  });
});

describe("aggregateReports (micro-average)", () => {
  it("returns vacuous 1/1/1 when no reports", () => {
    const r = aggregateReports([]);
    expect(r.precision).toBe(1);
    expect(r.recall).toBe(1);
    expect(r.f1).toBe(1);
  });

  it("end-to-end: mock extractor + v1 corpus produces recall ≥ 0.85", async () => {
    const corpus = loadPremiseExtractionCorpus(CORPUS_PATH);
    const reports = [];
    for (const fx of corpus.fixtures) {
      const ext = await mockPremiseExtractor.extract(fx.claimText);
      reports.push(scorePremiseExtraction(fx, ext));
    }
    const agg = aggregateReports(reports);
    expect(agg.recall).toBeGreaterThanOrEqual(0.85);
  });
});
