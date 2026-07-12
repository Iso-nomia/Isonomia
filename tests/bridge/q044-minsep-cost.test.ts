// tests/bridge/q044-minsep-cost.test.ts
//
// Q-044 audit 3 corroboration — the `MINSEP` (minimal-separating-context) cost.
//
// See:
//   RESEARCH_PROGRAMME/audits/q044-minsep-cost-2026-07-05.md   (the bound)
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/22-q044-complexity-primitives-scoping-2026-07-05.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-044
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T009-branching-smyth-minimal-separating-context.md
//
// The audit's step-3 finding: the SHIPPED branching extractor
// `smythMinimalSeparatingContext` is INTERACTION-FREE — it reads the Smyth-minimal
// separating antichain structurally off D's maximal positive-grant loci
// (`maximalLoci`), in O(g²·d) pure order-primitive work, replacing the L per-line
// stepCore runs the first-pass O(L·n²) bound assumed (licensed by T009 O-perline).
//
// The separation reducers and the extractor are PURE, so the cost/correctness is
// testable DB-free. This test asserts:
//   (CORRECT)   maximalLoci / minimalAnchor match brute-force references;
//   (ANTICHAIN) the extractor's `loci` is a genuine ⊑-antichain = maximalLoci(input);
//   (STEM)      `locus` is a ⊑-prefix of every element of `loci`;
//   (PURE)      the extractor is a function of locus strings alone (no design /
//               kernel input) — corroborating §4's "no stepCore".

import { describe, it, expect } from "@jest/globals";

import {
  isPrefixLocus,
  comparableLoci,
  maximalLoci,
  minimalAnchor,
} from "packages/ludics-engine/separation";
import { smythMinimalSeparatingContext } from "packages/ludics-engine/properTest";

// ---------------------------------------------------------------------------
// Deterministic PRNG + random locus-tree sampling
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample a random set of dot-paths rooted at "0" (a random dispute-tree frontier). */
function randomLoci(rng: () => number, count: number, maxDepth: number): string[] {
  const out = new Set<string>();
  for (let i = 0; i < count; i++) {
    const depth = 1 + Math.floor(rng() * maxDepth);
    const segs = ["0"];
    for (let d = 0; d < depth; d++) segs.push(String(1 + Math.floor(rng() * 3)));
    out.add(segs.join("."));
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Brute-force references
// ---------------------------------------------------------------------------

/** ⊑-maximal loci: drop every locus that is a STRICT prefix of another. */
function refMaximal(loci: string[]): string[] {
  const uniq = [...new Set(loci)];
  return uniq.filter((l) => !uniq.some((o) => o !== l && isPrefixLocus(l, o)));
}

/** The ⊑-least element (prefix of all), if one exists. */
function refLeast(loci: string[]): string | undefined {
  const uniq = [...new Set(loci)];
  return uniq.find((a) => uniq.every((b) => isPrefixLocus(a, b)));
}

function isAntichain(loci: readonly string[]): boolean {
  for (let i = 0; i < loci.length; i++)
    for (let j = i + 1; j < loci.length; j++)
      if (comparableLoci(loci[i], loci[j])) return false;
  return true;
}

// ---------------------------------------------------------------------------
// The corroboration
// ---------------------------------------------------------------------------

describe("Q-044 — MINSEP cost: interaction-free structural antichain (randomised)", () => {
  it("maximalLoci / minimalAnchor match brute force; extractor loci = ⊑-antichain", () => {
    const rng = mulberry32(0x3c7a);
    let trials = 0;
    let maxOut = 0;

    for (let rep = 0; rep < 400; rep++) {
      const count = 1 + Math.floor(rng() * 8);
      const maxDepth = 1 + Math.floor(rng() * 4);
      const loci = randomLoci(rng, count, maxDepth);

      // (CORRECT) maximalLoci
      const M = maximalLoci(loci);
      expect(new Set(M)).toEqual(new Set(refMaximal(loci)));

      // (CORRECT) minimalAnchor
      const anchor = minimalAnchor(loci);
      const least = refLeast(loci);
      expect(anchor.exists).toBe(least !== undefined);
      if (least !== undefined) expect(anchor.min).toBe(least);

      // (ANTICHAIN) the shipped extractor's loci = maximalLoci(input), ⊑-incomparable
      const sep = smythMinimalSeparatingContext(loci);
      expect(sep.basis).toBe("smyth-minimal-T009");
      expect(new Set(sep.loci)).toEqual(new Set(M));
      expect(isAntichain(sep.loci ?? [])).toBe(true);

      // (STEM) locus is a ⊑-prefix of every antichain element
      for (const l of sep.loci ?? []) expect(isPrefixLocus(sep.locus, l)).toBe(true);

      // (COST) antichain size ≤ input size (g)
      expect((sep.loci ?? []).length).toBeLessThanOrEqual(new Set(loci).size);

      maxOut = Math.max(maxOut, (sep.loci ?? []).length);
      trials++;
    }

    expect(trials).toBe(400);
    // eslint-disable-next-line no-console
    console.log(`[Q-044 MINSEP cost] trials=${trials} maxAntichainSize=${maxOut}`);
  });

  it("the branching extractor is a pure function of locus strings — no design/kernel input", () => {
    // A single chain has a unique ⊑-max ⇒ singleton antichain; two divergent
    // lines ⇒ a 2-element antichain with their common stem. Both computed with
    // NO design and NO stepCore call — the §4 "interaction-free" claim.
    const chain = smythMinimalSeparatingContext(["0", "0.1", "0.1.2"]);
    expect(chain.loci).toEqual(["0.1.2"]);
    expect(chain.locus).toBe("0.1.2");

    const branch = smythMinimalSeparatingContext(["0.1.2", "0.2.1"]);
    expect(new Set(branch.loci)).toEqual(new Set(["0.1.2", "0.2.1"]));
    expect(isAntichain(branch.loci ?? [])).toBe(true);
    expect(branch.locus).toBe("0"); // common stem
    expect(branch.basis).toBe("smyth-minimal-T009");
  });
});
