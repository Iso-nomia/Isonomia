// tests/claimExtract.test.ts
//
// verify-mode-B v1a — pure core of the on-device claim/citation extractor
// (extensions/chrome/src/content/claim-extract.ts). The DOM shell + Prompt-API
// refinement are build-verified; this pins the pure heuristics that decide what
// leaves the browser (Q-057: only claim-spans, never page body).

import {
  splitSentences,
  isClaimLike,
  pairClaimsWithCitations,
  type TextUnit,
} from "../extensions/chrome/src/content/claim-extract";

describe("splitSentences", () => {
  test("splits on sentence boundaries", () => {
    expect(splitSentences("The sky is blue. Water is wet. Is it?")).toEqual([
      "The sky is blue.",
      "Water is wet.",
      "Is it?",
    ]);
  });

  test("does not split common abbreviations", () => {
    const out = splitSentences("Dr. Smith found an effect. It held up.");
    expect(out).toEqual(["Dr. Smith found an effect.", "It held up."]);
  });

  test("collapses whitespace and handles empty", () => {
    expect(splitSentences("   ")).toEqual([]);
    expect(splitSentences("One   two\n three.")).toEqual(["One two three."]);
  });
});

describe("isClaimLike", () => {
  test("accepts declarative factual sentences (number or verb signal)", () => {
    expect(isClaimLike("Caffeine intake above 100 mg per day predicted conduct problems.")).toBe(true);
    expect(isClaimLike("The study found a significant reduction in sleep quality.")).toBe(true);
  });

  test("rejects questions, fragments, and boilerplate", () => {
    expect(isClaimLike("Is caffeine bad for teens?")).toBe(false); // question
    expect(isClaimLike("Read more here")).toBe(false); // too short + boilerplate
    expect(isClaimLike("Subscribe to our newsletter today for updates")).toBe(false); // boilerplate
    expect(isClaimLike("CLICK HERE NOW")).toBe(false); // no lowercase / boilerplate
  });

  test("rejects over-long and over-short spans", () => {
    expect(isClaimLike("Water wet")).toBe(false); // < 5 words
    expect(isClaimLike(("word ".repeat(70)).trim())).toBe(false); // > 60 words
  });
});

describe("pairClaimsWithCitations", () => {
  const units: TextUnit[] = [
    { sentence: "A large study found caffeine reduced sleep quality in teens.", urls: ["https://doi.org/10.1/x"] },
    { sentence: "Is this true?", urls: ["https://example.com/q"] }, // question → dropped
    { sentence: "The rate rose by 30 percent over two years.", urls: ["https://a.com/1", "https://a.com/1", "https://b.com/2"] },
    { sentence: "A claim with no citation at all here.", urls: [] }, // no url → dropped
  ];

  test("emits one pair per (claim-like sentence, distinct url); drops non-claims and uncited", () => {
    const pairs = pairClaimsWithCitations(units);
    expect(pairs).toEqual([
      { claim: "A large study found caffeine reduced sleep quality in teens.", citedUrl: "https://doi.org/10.1/x" },
      { claim: "The rate rose by 30 percent over two years.", citedUrl: "https://a.com/1" },
      { claim: "The rate rose by 30 percent over two years.", citedUrl: "https://b.com/2" },
    ]);
  });

  test("respects the maxPairs cap", () => {
    const many: TextUnit[] = Array.from({ length: 10 }, (_, i) => ({
      sentence: `Finding number ${i} showed a measurable effect on outcomes.`,
      urls: [`https://s.com/${i}`],
    }));
    expect(pairClaimsWithCitations(many, { maxPairs: 3 })).toHaveLength(3);
  });
});
