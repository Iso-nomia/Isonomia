/**
 * Scorer for the Phase 2.2 premise-extraction harness.
 *
 * Matching policy (precision/recall):
 *   - Normalize: lowercase, collapse whitespace, strip trailing
 *     punctuation, drop articles (the/a/an) at the start.
 *   - An extracted atom MATCHES an expected atom iff one of these
 *     normalized strings (expected.text + expected.aliases) is a
 *     superstring/substring of the extracted text OR Jaccard
 *     similarity on word-tokens ≥ 0.65.
 *   - Each expected atom can be claimed by at most one extracted
 *     atom (greedy left-to-right). Each extracted atom credits at
 *     most one expected atom.
 *
 * Warnings (non-fatal):
 *   - "provenance-span-out-of-range" — atom's span isn't within
 *     [0, claimText.length).
 *   - "provenance-text-mismatch" — claimText[span] doesn't contain
 *     the atom text after normalization. Often legitimate (atoms
 *     can be paraphrased) but worth surfacing.
 *   - "empty-atom" — atom text is empty after normalization.
 */

import type { PremiseAtom, PremiseExtraction } from "@/lib/deliberation/premiseExtractor";
import type {
  PremiseExtractionFixture,
  PremiseExtractionReport,
  ExpectedAtom,
} from "./types";

const JACCARD_MATCH_THRESHOLD = 0.65;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s]+/g, " ")
    .replace(/[\s.,;:!?'"`]+$/u, "")
    .replace(/^(the|a|an)\s+/u, "")
    .trim();
}

function tokenize(s: string): string[] {
  return s
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length > 0);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function atomMatchesExpected(
  extractedText: string,
  expected: ExpectedAtom,
): boolean {
  const ext = normalize(extractedText);
  if (!ext) return false;
  const candidates = [expected.text, ...(expected.aliases ?? [])].map(normalize);
  const extTokens = tokenize(ext);
  for (const cand of candidates) {
    if (!cand) continue;
    if (ext === cand) return true;
    if (ext.includes(cand) || cand.includes(ext)) return true;
    const candTokens = tokenize(cand);
    if (jaccard(extTokens, candTokens) >= JACCARD_MATCH_THRESHOLD) return true;
  }
  return false;
}

export function scorePremiseExtraction(
  fixture: PremiseExtractionFixture,
  extraction: PremiseExtraction,
): PremiseExtractionReport {
  const claimLen = fixture.claimText.length;
  const matches: PremiseExtractionReport["matches"] = [];
  const claimedExpected = new Set<number>();
  const claimedExtracted = new Set<number>();
  const warnings: string[] = [];

  // Validate provenance spans + emptiness up front.
  extraction.premises.forEach((atom, i) => {
    if (!normalize(atom.text)) {
      warnings.push(`atom[${i}]: empty-atom`);
      return;
    }
    const [s, e] = atom.provenanceSpan;
    if (s === 0 && e === 0) return; // sentinel: no span available
    if (s < 0 || e > claimLen || s > e) {
      warnings.push(`atom[${i}]: provenance-span-out-of-range [${s},${e})`);
      return;
    }
    const slice = fixture.claimText.slice(s, e);
    if (!normalize(slice).includes(normalize(atom.text)) && !normalize(atom.text).includes(normalize(slice))) {
      warnings.push(`atom[${i}]: provenance-text-mismatch`);
    }
  });

  // Greedy matching: for each expected atom in order, find the first
  // unclaimed extracted atom that matches. This is biased toward
  // preserving extraction order, which is what we want.
  fixture.expectedAtoms.forEach((expected, expectedIndex) => {
    for (let ei = 0; ei < extraction.premises.length; ei++) {
      if (claimedExtracted.has(ei)) continue;
      const atom = extraction.premises[ei];
      if (atomMatchesExpected(atom.text, expected)) {
        matches.push({
          expectedIndex,
          extractedIndex: ei,
          matchedText: atom.text,
        });
        claimedExpected.add(expectedIndex);
        claimedExtracted.add(ei);
        return;
      }
    }
  });

  const truePositives = matches.length;
  const falsePositives = extraction.premises.length - truePositives;
  const falseNegatives = fixture.expectedAtoms.length - truePositives;

  const precision =
    extraction.premises.length === 0
      ? fixture.expectedAtoms.length === 0
        ? 1
        : 0
      : truePositives / extraction.premises.length;
  const recall =
    fixture.expectedAtoms.length === 0
      ? 1
      : truePositives / fixture.expectedAtoms.length;
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const unmatchedExpected = fixture.expectedAtoms
    .map((a, i) => ({ index: i, text: a.text }))
    .filter((e) => !claimedExpected.has(e.index));
  const unmatchedExtracted = extraction.premises
    .map((a, i) => ({ index: i, text: a.text }))
    .filter((e) => !claimedExtracted.has(e.index));

  return {
    fixtureId: fixture.id,
    claimText: fixture.claimText,
    extraction,
    precision,
    recall,
    f1,
    truePositives,
    falsePositives,
    falseNegatives,
    matches,
    unmatchedExpected,
    unmatchedExtracted,
    warnings,
  };
}

/** Aggregate micro-averaged P/R/F1 across reports. */
export function aggregateReports(
  reports: PremiseExtractionReport[],
): { precision: number; recall: number; f1: number; fixtureCount: number } {
  const tp = reports.reduce((s, r) => s + r.truePositives, 0);
  const fp = reports.reduce((s, r) => s + r.falsePositives, 0);
  const fn = reports.reduce((s, r) => s + r.falseNegatives, 0);
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, fixtureCount: reports.length };
}

// Re-export for callers (e.g. type-only consumers of the atom shape).
export type { PremiseAtom };
