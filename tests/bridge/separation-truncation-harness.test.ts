// tests/bridge/separation-truncation-harness.test.ts
//
// Q-041 / Direction 2 step 1 — the TRUNCATION HARNESS (the missing corroboration
// surface). See:
//   RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/04-separating-context-predicate-decision-2026-06-04.md
//   RESEARCH_PROGRAMME/01_OPEN_QUESTIONS_REGISTRY.md  Q-041 (O1: linear-leastness)
//   RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T007-minimal-separating-locus.md  (§Cross-check / Repair 1)
//
// WHAT THIS IS (read before "fixing" a failure here).
// ----------------------------------------------------
// This is a CHARACTERIZATION / regression harness, NOT a theorem corroboration.
// It pins the *current* kernel's behaviour on TRUNCATED tests `E↾ℓ` — the exact
// behaviour that REFUTES the leastness half of the minimal-separating-context
// claim (T007 Repair 1). The existing separation harness never truncates a test;
// this fills that gap.
//
// The route chosen for minimality recovery is **R2** (redefine "separating
// context" abstractly as a complete daimon-closed counter-design; session 04).
// The verdicts frozen below are the GROUND TRUTH the abstract R2 normalization
// must reproduce on raw truncations — and the precise behaviour a future (parked)
// R1 kernel change would deliberately alter. So:
//
//   • If R2/R1 work later changes these verdicts ON PURPOSE, update this file and
//     note it — that change IS the signal that the predicate moved.
//   • If these verdicts change UNEXPECTEDLY, the kernel regressed: investigate.
//
// THE OBSTRUCTION (O1), stated operationally.
// -------------------------------------------
// `stepCore`'s canonical orthogonality conflates "the test ran out of acts" with
// "the test refuses here." Truncating an opponent `E` at a strict prefix `ℓ` of
// its first-divergence anchor `ξ(E)` produces an early-stopped chronicle. Against
// the ungated kernel:
//   • `ℓ` at ODD chronicle depth  → it becomes `D`'s turn, `D` plays a *justified*
//     positive whose dual was truncated away → DIVERGENT (so `ℓ` SEPARATES, and
//     `ℓ ⊏ ξ(E)` — a `⊑`-SMALLER separating context, breaking leastness).
//   • `ℓ` at EVEN chronicle depth → it becomes the test's turn, the test has no
//     further act → STUCK (so `ℓ` does NOT separate).
// `D` never wins early (no CONVERGENT before `ξ(E)`), because a raw truncation
// never plays the daimon a proper test would.

import { describe, it, expect } from "@jest/globals";

import {
  attackersOf,
  enumerateStrategies,
  type AF,
  type ArgId,
  type Attack,
  type Strategy,
} from "@/lib/bridge";

import {
  stepCore,
  type CoreAct,
  type StepCoreInput,
} from "packages/ludics-engine/stepCore";

import { isPrefixLocus, locusSegments } from "packages/ludics-engine/separation";

// ---------------------------------------------------------------------------
// Design builders (direct, matching the cross-check witness encoding)
// ---------------------------------------------------------------------------

const P = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "P", locusId });
const O = (locusId: string, id: string): CoreAct => ({ id, kind: "PROPER", polarity: "O", locusId });

const chainPaths = (depth: number): string[] => {
  // locusAt(0..depth) along the realized chronicle: "0", "0.1", "0.1.2", …
  const out: string[] = [];
  for (let t = 0; t <= depth; t++) {
    out.push(t === 0 ? "0" : "0." + Array.from({ length: t }, (_, k) => k + 1).join("."));
  }
  return out;
};

const idMaps = (paths: string[]) => ({
  pathById: new Map(paths.map((p) => [p, p] as const)),
  idByPath: new Map(paths.map((p) => [p, p] as const)),
});

interface RunObservation {
  status: string;
  reason?: string;
  divergenceLocus?: string;
  matched: string[];
}

function run(pos: CoreAct[], neg: CoreAct[], paths: string[]): RunObservation {
  const { pathById, idByPath } = idMaps(paths);
  const input: StepCoreInput = {
    posActs: pos,
    negActs: neg,
    pathById,
    idByPath,
    posParticipantId: "Proponent",
    negParticipantId: "Opponent",
  };
  const r = stepCore(input);
  return {
    status: r.status,
    reason: r.reason,
    divergenceLocus: r.divergenceLocus,
    matched: r.pairs.map((p) => p.locusPath),
  };
}

/** Truncate a design to acts at loci `⊑ ℓ` (the `E↾ℓ` of T007 / the broken object). */
const truncateAt = (acts: CoreAct[], ell: string): CoreAct[] =>
  acts.filter((a) => a.locusId !== undefined && a.locusId !== null && isPrefixLocus(a.locusId, ell));

const depthOf = (locus: string): number => locusSegments(locus).length - 1;

// A faithful linear chronicle of `len` rounds (loci at depths 0..len-1):
//   D (pos): even depth → P ; odd depth → O
//   E (neg): even depth → O ; odd depth → P   (the dual)
function faithfulChronicle(len: number): { D: CoreAct[]; Efull: CoreAct[]; paths: string[] } {
  const paths = chainPaths(len - 1);
  const D: CoreAct[] = [];
  const Efull: CoreAct[] = [];
  for (let t = 0; t < len; t++) {
    const L = paths[t];
    if (t % 2 === 0) {
      D.push(P(L, `p${t}`));
      Efull.push(O(L, `o${t}`));
    } else {
      D.push(O(L, `o${t}`));
      Efull.push(P(L, `r${t}`));
    }
  }
  return { D, Efull, paths };
}

// ---------------------------------------------------------------------------
// 1. Explicit frozen fixtures — the cross-check witnesses
// ---------------------------------------------------------------------------

describe("truncation harness — frozen O1 witnesses (current kernel ground truth)", () => {
  it("length-5 chronicle: ξ(E) = 0.1.2.3.4, odd-depth prefixes separate (leastness fails)", () => {
    const { D, Efull, paths } = faithfulChronicle(5);
    // E* = drop the deepest O-dual (at 0.1.2.3.4) → DIVERGENT at that locus.
    const Edrop = Efull.filter((a) => a.locusId !== "0.1.2.3.4");

    const xi = run(D, Edrop, paths);
    expect(xi.status).toBe("DIVERGENT");
    expect(xi.divergenceLocus).toBe("0.1.2.3.4");

    // Truncate E* at every strict prefix ℓ ⊏ ξ(E) and freeze the verdict table.
    const table = ["0", "0.1", "0.1.2", "0.1.2.3"].map((ell) => {
      const r = run(D, truncateAt(Edrop, ell), paths);
      return { ell, depth: depthOf(ell), status: r.status, at: r.divergenceLocus };
    });

    expect(table).toEqual([
      { ell: "0", depth: 0, status: "STUCK", at: undefined },
      { ell: "0.1", depth: 1, status: "DIVERGENT", at: "0.1.2" },
      { ell: "0.1.2", depth: 2, status: "STUCK", at: undefined },
      { ell: "0.1.2.3", depth: 3, status: "DIVERGENT", at: "0.1.2.3.4" },
    ]);

    // The leastness violation, made explicit: ℓ = "0.1" separates and "0.1" ⊏ ξ(E).
    const sep = table.filter((row) => row.status === "DIVERGENT").map((row) => row.ell);
    expect(sep).toContain("0.1");
    for (const ell of sep) expect(isPrefixLocus(ell, "0.1.2.3.4")).toBe(true);
    // …and the shallowest separating context is strictly smaller than ξ(E).
    expect(depthOf(sep[0])).toBeLessThan(depthOf("0.1.2.3.4"));
  });

  it("length-3 chronicle: ξ(E) = 0.1.2, the odd-depth prefix 0.1 separates earlier", () => {
    const { D, Efull, paths } = faithfulChronicle(3);
    const Edrop = Efull.filter((a) => a.locusId !== "0.1.2");

    const xi = run(D, Edrop, paths);
    expect(xi.status).toBe("DIVERGENT");
    expect(xi.divergenceLocus).toBe("0.1.2");

    const table = ["0", "0.1"].map((ell) => {
      const r = run(D, truncateAt(Edrop, ell), paths);
      return { ell, status: r.status, at: r.divergenceLocus };
    });
    expect(table).toEqual([
      { ell: "0", status: "STUCK", at: undefined },
      { ell: "0.1", status: "DIVERGENT", at: "0.1.2" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Generalized scan over allAFs(n) — O1 is systemic, not a single witness
// ---------------------------------------------------------------------------
//
// Reuses the Direction-1 enumeration. For every realized play we build the
// faithful design pair, take the deepest dropped-dual opponent (the one whose
// ξ(E) sits at the deepest D-positive locus), and truncate it at each strict
// prefix of ξ(E). We assert the two ROBUST O1 properties (not the full parity
// table, which the explicit fixtures already freeze):
//   (i)  leastness fails wherever ξ(E) has depth ≥ 2 — some strict prefix ℓ ⊏ ξ(E)
//        separates (⟨D ∣ E↾ℓ⟩ DIVERGENT);
//   (ii) D never wins early — no truncation strictly before ξ(E) is CONVERGENT.

const lineKey = (line: readonly ArgId[]): string => line.join(">");
type PlayEnd = "CON-stuck" | "PRO-stuck" | "ongoing";

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

function realizedPlay(
  af: AF,
  claim: ArgId,
  pro: Strategy,
  con: Strategy
): { line: ArgId[]; ended: PlayEnd } {
  const line: ArgId[] = [claim];
  const used = new Set<ArgId>([claim]);
  let current = claim;
  let turn: "CON" | "PRO" = "CON";
  const guard = 4 * af.args.length + 10;
  for (let step = 0; step < guard; step++) {
    if (turn === "CON") {
      const opts = attackersOf(af, current);
      if (opts.length === 0) return { line, ended: "CON-stuck" };
      const pick = con.get(lineKey(line));
      if (pick === undefined) return { line, ended: "ongoing" };
      line.push(pick);
      current = pick;
      turn = "PRO";
    } else {
      const opts = attackersOf(af, current).filter((o) => !used.has(o));
      if (opts.length === 0) return { line, ended: "PRO-stuck" };
      const pick = pro.get(lineKey(line));
      if (pick === undefined) return { line, ended: "ongoing" };
      used.add(pick);
      line.push(pick);
      current = pick;
      turn = "CON";
    }
  }
  return { line, ended: "ongoing" };
}

function locusAt(depth: number): string {
  if (depth === 0) return "0";
  return "0." + Array.from({ length: depth }, (_, k) => k + 1).join(".");
}

function buildPlayDesigns(line: ArgId[]): { pos: CoreAct[]; neg: CoreAct[]; paths: string[] } {
  const pos: CoreAct[] = [];
  const neg: CoreAct[] = [];
  const loci: string[] = [];
  for (let t = 0; t < line.length; t++) {
    const L = locusAt(t);
    loci.push(L);
    if (t % 2 === 0) {
      pos.push(P(L, `p${t}`));
      neg.push(O(L, `o${t}`));
    } else {
      pos.push(O(L, `o${t}`));
      neg.push(P(L, `r${t}`));
    }
  }
  return { pos, neg, paths: Array.from(new Set(loci)) };
}

const CAP = 8_000;

describe("truncation harness — O1 is systemic over allAFs(n) (current kernel)", () => {
  for (const n of [1, 2, 3]) {
    it(`leastness fails and D never wins early on every realized line for ${n} argument(s)`, () => {
      let chronicles = 0;
      let leastnessFailures = 0;

      for (const af of allAFs(n)) {
        for (const claim of af.args) {
          let pros: Strategy[];
          let cons: Strategy[];
          try {
            pros = enumerateStrategies(af, claim, "PRO", CAP);
            cons = enumerateStrategies(af, claim, "CON", CAP);
          } catch {
            continue;
          }
          for (const σ of pros) {
            for (const τ of cons) {
              const { line } = realizedPlay(af, claim, σ, τ);
              const { pos, neg, paths } = buildPlayDesigns(line);

              // Deepest dropped-dual opponent: drop the deepest neg O-act.
              const oIdx = [...neg.keys()].filter(
                (i) => neg[i].kind === "PROPER" && neg[i].polarity === "O"
              );
              if (oIdx.length === 0) continue;
              const deepest = oIdx[oIdx.length - 1];
              const Edrop = neg.filter((_, k) => k !== deepest);
              const xiRun = run(pos, Edrop, paths);
              if (xiRun.status !== "DIVERGENT" || xiRun.divergenceLocus === undefined) continue;
              const xi = xiRun.divergenceLocus;
              chronicles++;

              // Strict prefixes ℓ ⊏ ξ(E) along the chronicle.
              const strictPrefixes = paths.filter(
                (p) => isPrefixLocus(p, xi) && p !== xi
              );

              let someSeparates = false;
              for (const ell of strictPrefixes) {
                const r = run(pos, truncateAt(Edrop, ell), paths);
                // (ii) D never wins early against a truncated test.
                expect(r.status).not.toBe("CONVERGENT");
                if (r.status === "DIVERGENT") {
                  someSeparates = true;
                  // a separating truncation diverges at a locus ⊑ ξ(E)
                  expect(isPrefixLocus(r.divergenceLocus!, xi)).toBe(true);
                }
              }

              // (i) leastness fails whenever there is room (ξ at depth ≥ 2).
              if (depthOf(xi) >= 2) {
                expect(someSeparates).toBe(true);
                leastnessFailures++;
              }
            }
          }
        }
      }

      expect(chronicles).toBeGreaterThan(0);
      if (n >= 2) expect(leastnessFailures).toBeGreaterThan(0);
    });
  }
});
