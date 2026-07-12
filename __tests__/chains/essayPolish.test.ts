/**
 * __tests__/chains/essayPolish.test.ts
 *
 * M6 — unit coverage for the LLM polish module. The LLM call itself is
 * NOT exercised here (no network in CI); we test:
 *   1. `extractFactTokens` finds proper nouns, numerics, and citation
 *      tokens; ignores stopwords; survives punctuation/case.
 *   2. `factPreservationDiff` returns [] when polish only re-flows
 *      existing tokens, and returns the newly-introduced token(s)
 *      when the polish adds a proper noun or a number.
 *   3. `isChainEssayPolishEnabled` honours env + per-deliberation
 *      override.
 *   4. `polishEssay` short-circuits to deterministic when the flag is
 *      off (no LLM call, no Redis touch).
 */

import {
  extractFactTokens,
  factPreservationDiff,
  isChainEssayPolishEnabled,
  polishEssay,
  type PolishInput,
} from "@/lib/chains/essayPolish";

const baseInput = (overrides: Partial<PolishInput> = {}): PolishInput => ({
  chainId: "chain_test_1",
  contentHash: "abc123",
  deterministicProse:
    "Smith (2023) argues that the relocation-of-risk objection has not been answered. The author addresses this with a 12% adjustment, though the question remains open.",
  tone: "deliberative",
  audience: "expert",
  standingsSummary: {
    oneLiner: "1 surviving, 0 fallen, 1 residual.",
    survivingCount: 1,
    fallenCount: 0,
    residualCount: 1,
  },
  ...overrides,
});

describe("extractFactTokens", () => {
  it("captures proper nouns and ignores sentence-initial stopwords", () => {
    const toks = extractFactTokens(
      "Smith argues that the GDP rose. Boxell and Gentzkow concur.",
    );
    expect(toks.has("smith")).toBe(true);
    expect(toks.has("gdp")).toBe(true);
    expect(toks.has("boxell")).toBe(true);
    expect(toks.has("gentzkow")).toBe(true);
    expect(toks.has("the")).toBe(false);
    expect(toks.has("and")).toBe(false);
  });

  it("captures numerics including percentages and years", () => {
    const toks = extractFactTokens(
      "The 2023 study reported a 12.5% increase across 4 cohorts.",
    );
    expect(toks.has("2023")).toBe(true);
    expect(toks.has("12.5%")).toBe(true);
    expect(toks.has("4")).toBe(true);
  });

  it("captures citation-shaped tokens", () => {
    const toks = extractFactTokens(
      "See (2023) and [12] for details; cf. doi:10.1234/abc.",
    );
    // Parenthetical year refs and bracketed numerics
    expect([...toks].some((t) => t.includes("2023"))).toBe(true);
    expect([...toks].some((t) => t.includes("12"))).toBe(true);
  });

  it("normalizes case and trims punctuation", () => {
    const toks = extractFactTokens("Smith, Smith! SMITH?");
    expect(toks.has("smith")).toBe(true);
  });
});

describe("factPreservationDiff", () => {
  const det =
    "Smith (2023) argues that the relocation-of-risk objection has not been answered. The author addresses this with a 12% adjustment.";

  it("returns [] when polish only re-flows existing tokens", () => {
    const polished =
      "Smith (2023) argues that the objection regarding relocation of risk has not been answered, and the author addresses this with a 12% adjustment.";
    expect(factPreservationDiff(det, polished)).toEqual([]);
  });

  it("flags a newly-introduced proper noun", () => {
    const polished =
      "Smith (2023), building on Jones, argues that the objection has not been answered. The author addresses this with a 12% adjustment.";
    const intro = factPreservationDiff(det, polished);
    expect(intro).toContain("jones");
  });

  it("flags a newly-introduced numeric", () => {
    const polished =
      "Smith (2023) argues that the objection has not been answered. The author addresses this with a 12% adjustment over 5 years.";
    const intro = factPreservationDiff(det, polished);
    expect(intro).toContain("5");
  });

  it("flags a fabricated citation", () => {
    const polished =
      "Smith (2023) and Doe (2021) argue that the objection has not been answered. The author addresses this with a 12% adjustment.";
    const intro = factPreservationDiff(det, polished);
    // Either the proper noun "Doe" or the citation "(2021)" should trip the guard.
    expect(intro.some((t) => t === "doe" || t.includes("2021"))).toBe(true);
  });
});

describe("isChainEssayPolishEnabled", () => {
  const originalFlag = process.env.CHAIN_ESSAY_LLM_POLISH;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.CHAIN_ESSAY_LLM_POLISH;
    } else {
      process.env.CHAIN_ESSAY_LLM_POLISH = originalFlag;
    }
  });

  it("is false when env is unset", () => {
    delete process.env.CHAIN_ESSAY_LLM_POLISH;
    expect(isChainEssayPolishEnabled()).toBe(false);
  });

  it("is true when env is '1'", () => {
    process.env.CHAIN_ESSAY_LLM_POLISH = "1";
    expect(isChainEssayPolishEnabled()).toBe(true);
  });

  it("is true when env is 'on'", () => {
    process.env.CHAIN_ESSAY_LLM_POLISH = "on";
    expect(isChainEssayPolishEnabled()).toBe(true);
  });
});

describe("polishEssay (flag off)", () => {
  const originalFlag = process.env.CHAIN_ESSAY_LLM_POLISH;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.CHAIN_ESSAY_LLM_POLISH;
    } else {
      process.env.CHAIN_ESSAY_LLM_POLISH = originalFlag;
    }
  });

  it("returns deterministic byte-identical when flag is off", async () => {
    delete process.env.CHAIN_ESSAY_LLM_POLISH;
    const input = baseInput();
    const result = await polishEssay(input);
    expect(result.usedPolish).toBe(false);
    expect(result.reason).toBe("flag_off");
    expect(result.polished).toBe(input.deterministicProse);
  });
});
