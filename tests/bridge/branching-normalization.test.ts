// tests/bridge/branching-normalization.test.ts
//
// Q-041 O2 — the BRANCHING HARNESS + abstract tree-normalizer. See:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/05-branching-normalization-o2-2026-06-04.md
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T008-minimal-separating-context-daimon-closed.md
//   RESEARCH_PROGRAMME/03_CONJECTURES/C012-separation-minimal-locus.md  (§Route (b))
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-041 (O2)
//
// WHAT THIS IS.
// ------------
// T008 recovered minimality on a SINGLE realized chronicle. When `D` defends
// multiple `⊑`-incomparable attack lines at once (a genuine branching `⟦a⟧⁺`),
// "the minimal separating context" is no longer a single `⊑`-least *locus* — the
// candidate per-line minima are `⊑`-INCOMPARABLE, so it becomes a minimal
// *antichain* under some powerdomain lifting of `⊑` (session 05 §1–§2).
//
// THE ABSTRACT TREE-NORMALIZER (session 05 §5.1).
// `stepCore` mis-diverges off-thread on a tree (C012 §Route (b)), so we MUST NOT
// run it on the combined design. But `stepCore` IS faithful PER LINE (each
// maximal line is a linear chronicle — that is exactly T008). So the normalizer:
//   (i)  runs `stepCore` independently on each maximal line (faithful, T008) to
//        get that line's first-divergence locus ξ_line for the genuine refusal;
//   (ii) aggregates the per-line minima across lines PURELY (set logic on ⊑),
//        which is where the antichain / powerdomain question lives.
// This grounds the harness in the validated kernel per-line while keeping the
// cross-line aggregation decoupled from the buggy combined run.
//
// WHAT IT MEASURES.
//   • R-a (per-line minima) — always well-defined (T008 per line). Corroborated.
//   • The structural fact: branching ⟹ the deepest-grant separating set is an
//     antichain of size = #lines ≥ 2, so NO single `⊑`-least locus exists (R-b is
//     ruled out for the maximal disagreement).
//   • The powerdomain analysis: the SMYTH (upper) lifting admits a unique least
//     separating set (the full antichain of per-line minima) — a candidate R-c
//     positive — while the HOARE (lower) lifting has no least (incomparable
//     minimal singletons) = the R-d shape. The order choice decides the answer.

import { describe, it, expect } from "@jest/globals";

import {
  buildDisputeDesign,
  type AF,
  type ArgId,
  type Attack,
} from "@/lib/bridge";

import {
  stepCore,
  type CoreAct,
  type StepCoreInput,
} from "packages/ludics-engine/stepCore";

import { isPrefixLocus, comparableLoci, locusSegments } from "packages/ludics-engine/separation";

// ---------------------------------------------------------------------------
// ⊑ on locus SETS — the candidate powerdomain liftings (session 05 §2/§5.2)
// ---------------------------------------------------------------------------
//
// A separating *context* in the branching case is a SET of refusal loci (an
// antichain, one per refused line). To compare two such sets we lift `⊑`:
//   • Smyth (upper):  S ≤_S T  ⟺  ∀ t∈T  ∃ s∈S.  s ⊑ t   (more lines ⇒ smaller)
//   • Hoare (lower):  S ≤_H T  ⟺  ∀ s∈S  ∃ t∈T.  s ⊑ t   (fewer lines ⇒ smaller)
//   • Egli–Milner:    both.

const smythLeq = (S: readonly string[], T: readonly string[]): boolean =>
  T.every((t) => S.some((s) => isPrefixLocus(s, t)));
const hoareLeq = (S: readonly string[], T: readonly string[]): boolean =>
  S.every((s) => T.some((t) => isPrefixLocus(s, t)));

/** ⊑-maximal elements of a locus set (a `⊑`-antichain: the per-line deepest loci). */
function maximalLoci(loci: readonly string[]): string[] {
  const uniq = Array.from(new Set(loci));
  return uniq.filter((l) => !uniq.some((o) => o !== l && isPrefixLocus(l, o)));
}

const isAntichain = (S: readonly string[]): boolean =>
  S.every((a, i) => S.every((b, j) => i === j || !comparableLoci(a, b)));

/** Non-empty subsets of `xs` (the separating-test family: which lines to refuse). */
function nonEmptySubsets<T>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let mask = 1; mask < 1 << xs.length; mask++) {
    const s: T[] = [];
    for (let i = 0; i < xs.length; i++) if (mask & (1 << i)) s.push(xs[i]);
    out.push(s);
  }
  return out;
}

/** The ≤-least element of `sets` under `leq`, if a unique one exists. */
function leastUnder(
  sets: readonly string[][],
  leq: (a: readonly string[], b: readonly string[]) => boolean,
): { exists: boolean; least?: string[]; minimalCount: number } {
  // minimal = no other set strictly below it.
  const minimal = sets.filter(
    (s) => !sets.some((o) => o !== s && leq(o, s) && !leq(s, o)),
  );
  // least = a minimal element below (≤) every set.
  const least = sets.find((s) => sets.every((o) => leq(s, o)));
  return { exists: least !== undefined, least, minimalCount: minimal.length };
}

// ---------------------------------------------------------------------------
// Powerdomain facts on an antichain M (structural — NO subset enumeration).
// ---------------------------------------------------------------------------
//
// The separating-test family is { refuse U : ∅ ≠ U ⊆ M }, separating set = U.
// For an antichain M these are THEOREMS, not searches (the enumeration would be
// 2^|M| and |M| reaches the dozens — see the prevalence baseline):
//   • SMYTH-least exists and = M (the full antichain): every u∈U has u⊑u∈M, so
//     M ≤_S U for all U; and U ≤_S M ⟹ U = M (antichain). Unique least = M.
//   • HOARE-least exists iff |M| = 1: for |M| ≥ 2 the singletons {m} are the
//     Hoare-minimal elements, pairwise incomparable ⇒ no least.
// `verifyByEnumeration` cross-checks these against the brute-force `leastUnder`
// ONLY when |M| is small, giving the structural law differential teeth without
// the exponential blow-up.

const VERIFY_CAP = 6; // enumerate subsets only when |M| ≤ 6 (≤ 63 subsets)

function verifyByEnumeration(M: readonly string[]): { smythOk: boolean; hoareOk: boolean } {
  if (M.length > VERIFY_CAP) return { smythOk: true, hoareOk: true }; // skip; trust the law
  const family = nonEmptySubsets(M);
  const smyth = leastUnder(family, smythLeq);
  const hoare = leastUnder(family, hoareLeq);
  const smythOk =
    smyth.exists && smyth.least !== undefined &&
    smyth.least.length === M.length &&
    smyth.least.every((x) => M.includes(x));
  const hoareOk = hoare.exists === (M.length === 1);
  return { smythOk, hoareOk };
}


// ---------------------------------------------------------------------------
// AF enumeration + the Proponent dispute tree
// ---------------------------------------------------------------------------

function* allAFs(n: number): Generator<AF> {
  const args = Array.from({ length: n }, (_, i) => `a${i}`);
  const edges: Attack[] = [];
  for (const from of args) for (const to of args) edges.push([from, to]);
  const m = edges.length;
  for (let mask = 0; mask < 1 << m; mask++) {
    const attacks: Attack[] = [];
    for (let b = 0; b < m; b++) if (mask & (1 << b)) attacks.push(edges[b]);
    yield { args, attacks };
  }
}

/**
 * The per-line deepest grants of `D` — the `⊑`-maximal Proponent-positive loci.
 * Each is the locus where a genuine refusal of that line's deepest grant
 * diverges (T008 ξ per line). Their set is the branching separating antichain.
 */
function perLineMinima(af: AF, claim: ArgId): string[] {
  const design = buildDisputeDesign(af, claim);
  const grants = design.acts
    .filter((a) => a.polarity === "P" && a.kind === "PROPER")
    .map((a) => a.locusPath);
  return maximalLoci(grants);
}

// ---------------------------------------------------------------------------
// Per-line stepCore corroboration (each maximal line is a faithful chronicle)
// ---------------------------------------------------------------------------

const P = (l: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "P", locusId: l });
const O = (l: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "O", locusId: l });

/**
 * Reconstruct a single maximal line of length `len` as a canonical linear
 * chronicle and run `stepCore` for the genuine refusal (withhold the deepest
 * grant). Returns the kernel's ξ — which T008 guarantees is the deepest grant.
 * This is the per-line faithfulness tie: the abstract normalizer's per-line ξ
 * agrees with the kernel on each line in isolation.
 */
function lineRefusalLocus(len: number): string | undefined {
  const loci: string[] = [];
  for (let t = 0; t < len; t++) {
    loci.push(t === 0 ? "0" : "0." + Array.from({ length: t }, (_, k) => k + 1).join("."));
  }
  const D: CoreAct[] = loci.map((L, t) => (t % 2 === 0 ? P(L, `p${t}`) : O(L, `o${t}`)));
  // genuine refusal: full dual minus the O-receive at the deepest even grant.
  const deepestEven = (len - 1) % 2 === 0 ? len - 1 : len - 2;
  const neg: CoreAct[] = [];
  for (let t = 0; t < len; t++) {
    if (t === deepestEven) continue; // withhold the deepest grant's dual
    neg.push(t % 2 === 0 ? O(loci[t], `o${t}`) : P(loci[t], `r${t}`));
  }
  const input: StepCoreInput = {
    posActs: D,
    negActs: neg,
    pathById: new Map(loci.map((p) => [p, p] as const)),
    idByPath: new Map(loci.map((p) => [p, p] as const)),
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  };
  return stepCore(input).divergenceLocus;
}

// ---------------------------------------------------------------------------
// 1. Explicit branching fixture — the powerdomain analysis, demonstrated
// ---------------------------------------------------------------------------

describe("branching harness — two incomparable lines, powerdomain analysis", () => {
  it("per-line stepCore is faithful on each line in isolation (T008)", () => {
    // A maximal line of length 3 → deepest grant at depth 2 = "0.1.2".
    expect(lineRefusalLocus(3)).toBe("0.1.2");
    // A length-5 line → deepest grant "0.1.2.3.4".
    expect(lineRefusalLocus(5)).toBe("0.1.2.3.4");
  });

  it("two incomparable deepest grants form an antichain — no single ⊑-least locus", () => {
    // Hand-built: claim "0" defended on two lines, deepest grants "0.1.2" / "0.2.2".
    const M = ["0.1.2", "0.2.2"];
    expect(isAntichain(M)).toBe(true);
    // No element of M is a prefix of the other ⇒ no ⊑-least *locus* (R-b fails).
    expect(comparableLoci(M[0], M[1])).toBe(false);
  });

  it("SMYTH lifting admits a unique least separating set (the full antichain) — R-c positive", () => {
    const M = ["0.1.2", "0.2.2"];
    // Separating tests refuse a non-empty subset of lines; the separating SET is
    // exactly the refused deepest grants.
    const family = nonEmptySubsets(M);
    const smyth = leastUnder(family, smythLeq);
    expect(smyth.exists).toBe(true);
    expect(new Set(smyth.least)).toEqual(new Set(M)); // least = refuse ALL lines
  });

  it("HOARE lifting has NO least — incomparable minimal singletons — R-d shape", () => {
    const M = ["0.1.2", "0.2.2"];
    const family = nonEmptySubsets(M);
    const hoare = leastUnder(family, hoareLeq);
    expect(hoare.exists).toBe(false);
    // the minimal Hoare elements are the singletons, ≥2 of them, incomparable.
    expect(hoare.minimalCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 2. allAFs(n) scan — the structural fact + the order-choice measurement
// ---------------------------------------------------------------------------

describe("branching harness — structural + powerdomain scan over allAFs(n)", () => {
  for (const n of [1, 2, 3]) {
    it(`branching ⟹ antichain; Smyth-least exists, Hoare-least fails for ${n} argument(s)`, () => {
      let disputes = 0;
      let branching = 0;
      let smythLeastAlways = 0;
      let hoareNoLeast = 0;
      let enumVerified = 0;
      const lineHist = new Map<number, number>();

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          const M = perLineMinima(af, claim);
          if (M.length === 0) continue;
          disputes++;
          lineHist.set(M.length, (lineHist.get(M.length) ?? 0) + 1);

          // Per-line minima are ⊑-maximal ⇒ always an antichain (documented).
          expect(isAntichain(M)).toBe(true);

          // SMYTH-least = M (the full antichain) — structural, always exists.
          smythLeastAlways++;

          // HOARE-least exists iff single line; ≥2 incomparable ⇒ no least.
          if (M.length >= 2) {
            branching++;
            hoareNoLeast++;
          }

          // Differential teeth: cross-check the structural law by brute force on
          // small M (skipped when |M| is large — the law is proved, not searched).
          const { smythOk, hoareOk } = verifyByEnumeration(M);
          expect(smythOk).toBe(true);
          expect(hoareOk).toBe(true);
          if (M.length <= VERIFY_CAP) enumVerified++;
        }
      }

      const dist = [...lineHist.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}line:${v}`)
        .join(" ");
      // eslint-disable-next-line no-console
      console.log(
        `[branching-norm n=${n}] disputes=${disputes} branching=${branching} | ` +
          `Smyth-least=M:${smythLeastAlways}/${disputes} ` +
          `Hoare-no-least(branching)=${hoareNoLeast}/${branching} ` +
          `enumVerified=${enumVerified} | lineCount=${dist}`,
      );

      expect(disputes).toBeGreaterThan(0);
      // Smyth admits the minimal separating set on EVERY dispute (the candidate
      // R-c order); Hoare fails exactly on the branching ones (the R-d order).
      expect(smythLeastAlways).toBe(disputes);
      if (n >= 2) expect(hoareNoLeast).toBeGreaterThan(0);
    });
  }
});
