/**
 * Types for the Phase 2.2 premise-extraction harness.
 */

import type { PremiseExtraction } from "@/lib/deliberation/premiseExtractor";

/**
 * One labeled extraction fixture. `expectedAtoms` is the ground
 * truth — the set of premise atoms a faithful extractor should
 * produce. Matching is normalized-text-based (see `scorer.ts`), not
 * string-exact, so authors can write the atoms in their natural form
 * and let small whitespace / punctuation drift slide.
 *
 * `aliases` lets a fixture author list acceptable surface variants
 * for a single atom (e.g. "X causes Y" vs "X → Y"). Any alias match
 * counts as a hit.
 */
export interface PremiseExtractionFixture {
  id: string;
  claimText: string;
  expectedAtoms: ExpectedAtom[];
  notes?: string;
  /** Optional argument-scheme expected (whole-claim level). */
  expectedScheme?: string;
}

export interface ExpectedAtom {
  text: string;
  aliases?: string[];
}

export interface PremiseExtractionCorpusIndex {
  version: string;
  fixtures: { id: string; path: string; description?: string }[];
}

export interface LoadedPremiseExtractionCorpus {
  version: string;
  fixtures: PremiseExtractionFixture[];
}

/**
 * Per-fixture precision/recall report. `matches` records which
 * extracted atom (by index) was credited to which expected atom (by
 * index), so a regression diff can show drift in *which* atoms moved.
 */
export interface PremiseExtractionReport {
  fixtureId: string;
  claimText: string;
  extraction: PremiseExtraction;
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  matches: { expectedIndex: number; extractedIndex: number; matchedText: string }[];
  unmatchedExpected: { index: number; text: string }[];
  unmatchedExtracted: { index: number; text: string }[];
  /** Soft validation flags — non-fatal but worth surfacing. */
  warnings: string[];
}
