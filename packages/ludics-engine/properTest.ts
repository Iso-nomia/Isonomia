// packages/ludics-engine/properTest.ts
//
// Direction 2 (separation / locus of disagreement) — the VERIFIED minimal-
// disagreement extractor pipeline. See:
//   RESEARCH_PROGRAMME/DEV_SPEC-minimal-disagreement-extractor-2026-06-04.md
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T008-minimal-separating-context-daimon-closed.md
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T006-first-divergence-locus-e0.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-040 / Q-041
//
// WHY THIS MODULE EXISTS
// ----------------------
// T008 proved that, against a COMPLETE DAIMON-CLOSED counter-design (a *proper
// test*) on a single realized dispute chronicle, the kernel's `divergenceLocus`
// `ξ(E)` is the `⊑`-MINIMAL separating context — and that `stepCore` is faithful
// on proper tests, unfaithful exactly on raw truncations. That theorem reduces
// "can we soundly say *the minimal place you disagree*?" to one engineering
// obligation: only ever feed `stepCore` frontier-complete (proper) tests, and
// only claim minimality when the dispute is a single chronicle.
//
// This module is that gate. It builds proper tests by construction, GUARDS that
// no partial design ever reaches `stepCore`, detects the single-chronicle
// (linear) path, and surfaces `ξ(E)` with a `basis` tag that the product layer
// must respect so the surface never overclaims "minimal" off the faithful region.
//
// PURITY: every function here is pure (zero I/O, no prisma, no clock), mirroring
// `stepCore` / `separation.ts`, so it is unit-testable without a database and
// reusable by the Direction-5 Agda model.

import { stepCore, type CoreAct, type StepCoreInput } from "./stepCore";
import { comparableLoci, locusSegments, maximalLoci, commonStem } from "./separation";

// ---------------------------------------------------------------------------
// Chronicle + act builders
// ---------------------------------------------------------------------------

export interface Chronicle {
  /**
   * Loci `d_0 ⊏ d_1 ⊏ … ⊏ d_{len-1}` along the realized dispute line, a
   * segment-wise `⊑`-chain. By the T008 scope convention the Proponent `D`
   * plays a POSITIVE act at EVEN depth and receives at ODD depth; the dual
   * test plays its POSITIVE (proper attack or daimon) at ODD depth.
   */
  loci: string[];
}

const P = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "P", locusId });
const O = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "O", locusId });
/** The daimon `†` — the positive act by which a complete design concedes / closes. */
const DAGGER = (locusId: string, id: string): CoreAct => ({ id, kind: "DAIMON", polarity: "daimon", locusId });

/** Depth of a locus on the chronicle (`"0"` → 0, `"0.1"` → 1, …). */
export function depthOfLocus(locus: string): number {
  return locusSegments(locus).length - 1;
}

/**
 * The dual act the test plays at chronicle depth `t`: an O-receive at even
 * depth, a proper P-attack at odd depth (the test's own positive turn).
 */
function dualActAt(loci: string[], t: number): CoreAct {
  const L = loci[t];
  return t % 2 === 0 ? O(L, `o${t}`) : P(L, `r${t}`);
}

/**
 * Build the Proponent design `D` for a chronicle: a positive `P` at even depth,
 * an `O`-receive at odd depth. This is the `D` side the extractor and the
 * harnesses run proper tests against.
 */
export function buildChronicleProponent(chron: Chronicle): CoreAct[] {
  return chron.loci.map((L, t) => (t % 2 === 0 ? P(L, `p${t}`) : O(L, `o${t}`)));
}

// ---------------------------------------------------------------------------
// 3.1 Proper-test builder — `buildProperTest`
// ---------------------------------------------------------------------------

export interface ProperTest {
  /** The acts of the complete daimon-closed counter-design (the test). */
  acts: CoreAct[];
  /** The locus at the frontier where the test refuses (Refuse) or concedes (Concede). */
  frontier: string;
}

/**
 * Emit a COMPLETE DAIMON-CLOSED counter-design of `D` on the chronicle's dual
 * base — the `Concede_j` / `Refuse` construction of T008 Definition 2.
 *
 *   • `refusalDepth` EVEN (= `2m`, a `D`-positive locus) → **Refuse(ξ)**: carry
 *     the full dual but WITHHOLD the `O`-receive at that locus. This is the
 *     genuine non-conceding disagreement; `⟨D ∣ Refuse⟩` diverges at the locus.
 *   • `refusalDepth` ODD (= `j`, the test's own turn) → **Concede_j**: carry the
 *     dual's proper actions through depth `j-1`, then play the daimon `†` on the
 *     test's own turn at depth `j`. `⟨D ∣ Concede_j⟩` reaches `†` and converges.
 *
 * In both cases the test CARRIES an act at every one of its positive turns up to
 * the frontier, so it is frontier-complete by construction (see
 * {@link isFrontierComplete}) — never a raw truncation.
 */
export function buildProperTest(chron: Chronicle, refusalDepth: number): ProperTest {
  const { loci } = chron;
  if (refusalDepth < 0 || refusalDepth >= loci.length) {
    throw new RangeError(`refusalDepth ${refusalDepth} out of range [0, ${loci.length})`);
  }
  const acts: CoreAct[] = [];
  if (refusalDepth % 2 === 0) {
    // Refuse: complete dual minus the O-receive at the genuine anchor.
    for (let t = 0; t < loci.length; t++) {
      if (t === refusalDepth) continue; // withhold the dual at the disagreement
      acts.push(dualActAt(loci, t));
    }
  } else {
    // Concede_j: proper actions at depths 0..j-1, then daimon on the test's turn.
    for (let t = 0; t < refusalDepth; t++) acts.push(dualActAt(loci, t));
    acts.push(DAGGER(loci[refusalDepth], `dagger${refusalDepth}`));
  }
  return { acts, frontier: loci[refusalDepth] };
}

// ---------------------------------------------------------------------------
// 3.2 Frontier-completeness guard — `isFrontierComplete` / `assertFrontierComplete`
// ---------------------------------------------------------------------------

/**
 * Decide whether a candidate test `T` is FRONTIER-COMPLETE for `chron` — the
 * operational encoding of T008's faithful-region boundary.
 *
 * Walking the test's own positive turns (ODD depths of the chronicle) in order:
 *   • a proper `P`-attack at the turn → continue;
 *   • a daimon `†` at the turn → the test has CONCEDED here, complete (nothing
 *     further is required);
 *   • SILENCE at a reachable positive turn → the test is a RAW TRUNCATION; it
 *     stops where a complete design would have carried an act. NOT complete.
 *
 * A Refuse test (withholding only an even-depth `O`-receive) carries every odd
 * turn and so is complete; a `Concede_j` is complete up to its `†`. The guard is
 * the defence-in-depth check that fails loudly if any caller hands `stepCore` a
 * partial design — the prime invariant of the spec.
 */
export function isFrontierComplete(T: CoreAct[], chron: Chronicle): boolean {
  const { loci } = chron;
  const actByLocus = new Map<string | null | undefined, CoreAct>();
  for (const a of T) actByLocus.set(a.locusId, a);

  for (let t = 1; t < loci.length; t += 2) {
    // Odd depth = the test's own positive turn.
    const act = actByLocus.get(loci[t]);
    if (!act) return false; // silent at a reachable positive turn → truncation
    if (act.kind === "DAIMON") return true; // conceded here → complete
    // a proper P-act → keep checking deeper turns
  }
  return true; // carried every positive turn (a complete Refuse-style proper test)
}

/** Throwing form of {@link isFrontierComplete}; the mandatory pre-`stepCore` guard. */
export function assertFrontierComplete(T: CoreAct[], chron: Chronicle): void {
  if (!isFrontierComplete(T, chron)) {
    throw new Error(
      "assertFrontierComplete: test is not frontier-complete (raw truncation) — " +
        "refusing to feed a partial design to stepCore (T008 faithful-region violation)",
    );
  }
}

// ---------------------------------------------------------------------------
// 3.3 Linearity detector — `isSingleChronicle`
// ---------------------------------------------------------------------------

/**
 * Is the contested region a SINGLE realized chronicle — i.e. do the loci in play
 * form one `⊑`-chain (all pairwise comparable)? This is the O2 gate: when it is
 * `false` (two `⊑`-incomparable defended lines simultaneously in play) the
 * extractor MUST NOT claim minimality.
 */
export function isSingleChronicle(lociInPlay: readonly string[]): boolean {
  for (let i = 0; i < lociInPlay.length; i++) {
    for (let j = i + 1; j < lociInPlay.length; j++) {
      if (!comparableLoci(lociInPlay[i], lociInPlay[j])) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 3.4 The extractor — `extractMinimalDisagreementLocus`
// ---------------------------------------------------------------------------

/**
 * Provenance of a surfaced disagreement locus — the ONLY signal the product
 * layer may use to decide whether the word "minimal" is honest.
 *
 *   • `minimal-T008`          — single chronicle, proper test, DIVERGENT: the
 *                               locus is the `⊑`-minimal separating context,
 *                               *proven* minimal (T008, established).
 *   • `smyth-minimal-T009`    — BRANCHING dispute: a *set* (`loci`) — the
 *                               Smyth-minimal separating *antichain* `M(D, E)` of
 *                               per-line first-divergence loci, *proven* minimal
 *                               under the Smyth (upper powerdomain) order (T009,
 *                               established; cross-checked 2026-06-05). It is a
 *                               minimal SET, never a single `⊑`-least locus —
 *                               branching has no ⊑-least locus. Computed by running
 *                               `stepCore` PER LINE (faithful, T008) and
 *                               aggregating; never a combined-tree run (the kernel
 *                               mis-diverges off-thread — T009 O-faithful). The
 *                               surface says "minimal set of unshared commitments,
 *                               one per open line".
 *   • `first-divergence-T006` — single chronicle, DIVERGENT, but not provably a
 *                               proper test: a determinate first-divergence locus,
 *                               not claimed minimal.
 *   • `heuristic-fallback`    — no verified extraction; defer to the heuristic.
 */
export type DisagreementBasis =
  | "minimal-T008"
  | "smyth-minimal-T009"
  | "first-divergence-T006"
  | "heuristic-fallback";

export interface MinimalDisagreement {
  /**
   * The separating locus `ξ(E)` (kernel path, e.g. `"0.1.2"`). For the branching
   * (`smyth-minimal-T009`) basis this is the **shared stem** — the locus
   * below which the lines agree and above which they branch; the per-line
   * divergence points are in {@link loci}.
   */
  locus: string;
  /**
   * The Smyth-least separating *set* — the `⊑`-antichain of per-line
   * first-divergence loci (T009, established). Present only on the `smyth-minimal-T009`
   * basis; a singleton or absent on the single-chronicle bases. Additive.
   */
  loci?: string[];
  /** Provenance the surface must respect (see {@link DisagreementBasis}). */
  basis: DisagreementBasis;
  /** The argument-graph object `ξ` maps back to, when a resolver is supplied. */
  target?: { kind: "edge" | "premise" | "cq"; id: string };
}

function idMapsOf(loci: readonly string[]): Pick<StepCoreInput, "pathById" | "idByPath"> {
  return {
    pathById: new Map(loci.map((p) => [p, p] as const)),
    idByPath: new Map(loci.map((p) => [p, p] as const)),
  };
}

/**
 * The composition: build `D`'s proper Refuse test for the disagreement, ASSERT
 * frontier-completeness, run `stepCore`, read `divergenceLocus` (= `ξ(E)`, the
 * `⊑`-minimal separating context by T008), and tag the provenance.
 *
 * The `basis` is the load-bearing honesty signal — "minimal" may be claimed ONLY
 * when the dispute is a single chronicle AND the test is provably frontier-complete
 * AND the run diverges. Off that region the result degrades to first-divergence
 * (T006) or, on any failure, to `heuristic-fallback`. It NEVER throws into the
 * caller (fail-closed).
 *
 * `resolveTarget` optionally maps the locus back through `⟦·⟧` to the argument-
 * graph edge/premise/CQ it corresponds to; omit it to leave `target` undefined.
 */
export function extractMinimalDisagreementLocus(
  chron: Chronicle,
  D: CoreAct[],
  refusal: { anchorDepth: number },
  lociInPlay: readonly string[],
  resolveTarget?: (locus: string) => MinimalDisagreement["target"],
): MinimalDisagreement {
  try {
    const single = isSingleChronicle(lociInPlay);
    const { acts: test, frontier } = buildProperTest(chron, refusal.anchorDepth);
    const complete = isFrontierComplete(test, chron);

    // Defence in depth: a future refactor that hands a partial design here is
    // caught by a failing test, not by a silent wrong answer on the surface.
    if (process.env.NODE_ENV !== "production") {
      assertFrontierComplete(test, chron);
    }

    const r = stepCore({
      posActs: D,
      negActs: test,
      ...idMapsOf(chron.loci),
      posParticipantId: "Proponent",
      negParticipantId: "Opponent",
    });

    const locus = r.divergenceLocus;
    if (r.status === "DIVERGENT" && locus) {
      const basis: DisagreementBasis =
        single && complete ? "minimal-T008" : "first-divergence-T006";
      const target = resolveTarget?.(locus);
      return target ? { locus, basis, target } : { locus, basis };
    }

    // No separation (the proper test conceded / converged): nothing minimal to
    // claim — fall back to the heuristic at the frontier we probed.
    return { locus: frontier, basis: "heuristic-fallback" };
  } catch {
    // Fail closed: degrade to the heuristic, never throw into the route.
    const frontier = chron.loci[Math.min(Math.max(refusal.anchorDepth, 0), chron.loci.length - 1)] ?? "0";
    return { locus: frontier, basis: "heuristic-fallback" };
  }
}

// ---------------------------------------------------------------------------
// 3.5 Branching path — the Smyth-least separating antichain (C013)
// ---------------------------------------------------------------------------

/**
 * The Smyth-least separating context of a BRANCHING dispute — the `⊑`-antichain
 * of per-line first-divergence loci `M(D, E)` (the `⊑`-maximal Proponent-positive
 * loci of `D`). This is the set-valued generalization of `ξ(E)` to multiple
 * `⊑`-incomparable open lines:
 * [C013](../../RESEARCH_PROGRAMME/03_CONJECTURES/C013-branching-smyth-minimal-separating-context.md).
 *
 * Honesty boundary: each element is a genuine first-divergence locus (T006/T008
 * *per line*, established — each maximal line is a linear chronicle the kernel is
 * faithful on, run PER LINE). That this *set* is the Smyth-**minimal** separating
 * context is now **proven** (T009, established, cross-checked 2026-06-05): the
 * Smyth-least separating set is exactly this `⊑`-antichain `M(D, E)`. So the
 * `basis` is `smyth-minimal-T009`. It is a minimal *antichain* (a SET) — branching
 * has no single `⊑`-least locus — so the surface says "minimal set of unshared
 * commitments, one per open line", never "the minimal point". NO combined-tree
 * `stepCore` run is ever made (the kernel mis-diverges off-thread on trees —
 * C012 §Route (b) / T009 O-faithful); the antichain is the per-line deepest grants
 * (`maximalLoci`), which T009 O-perline proves equal to the per-line `stepCore` ξ.
 *
 * @param positiveGrantLoci the loci of `D`'s proper Proponent-positive acts.
 */
export function smythMinimalSeparatingContext(
  positiveGrantLoci: readonly string[],
  resolveTargets?: (locus: string) => MinimalDisagreement["target"],
): MinimalDisagreement {
  const M = maximalLoci(positiveGrantLoci).sort();
  if (M.length === 0) {
    return { locus: "0", loci: [], basis: "heuristic-fallback" };
  }
  const stem = commonStem(M);
  const target = M.length === 1 ? resolveTargets?.(M[0]) : undefined;
  const base: MinimalDisagreement = {
    locus: stem,
    loci: M,
    basis: "smyth-minimal-T009",
  };
  return target ? { ...base, target } : base;
}

