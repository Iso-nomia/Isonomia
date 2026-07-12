// tests/transportAggregator.test.ts
// Sprint C tests for the pure transport aggregator.
//
// Citations: ECC plan §C, §0.5.7 (Isonomia, not Ambler), §4 row 2 (one-hop).

import {
  computeTransportPayload,
  computeTransportHash,
  reduceImportedScores,
  reduceImportedByOrigin,
  combineLocalAndImported,
  type TransportSource,
} from "@/lib/argumentation/transportAggregator";
import { corroborateProbs } from "@/lib/argumentation/logodds";

describe("transportAggregator — payload", () => {
  test("empty source produces empty payload", () => {
    const out = computeTransportPayload({ fromRoomId: "r1", claimMap: {}, supports: [] });
    expect(out.byClaim).toEqual({});
  });

  test("claims without an image in the functor are dropped (partial functor)", () => {
    const out = computeTransportPayload({
      fromRoomId: "r1",
      claimMap: { c1: "C1" },
      supports: [
        { claimId: "c1", score: 0.7 },
        { claimId: "c-orphan", score: 0.9 },
      ],
    });
    expect(Object.keys(out.byClaim)).toEqual(["C1"]);
    expect(out.byClaim["C1"].sources).toEqual([
      { fromRoomId: "r1", fromClaimId: "c1", originId: "c1", score: 0.7 },
    ]);
  });

  test("multiple source claims map to the same target (collected, not joined)", () => {
    const out = computeTransportPayload({
      fromRoomId: "r1",
      claimMap: { a: "T", b: "T" },
      supports: [
        { claimId: "a", score: 0.4 },
        { claimId: "b", score: 0.6 },
      ],
    });
    expect(out.byClaim["T"].sources.map((s) => s.score).sort()).toEqual([0.4, 0.6]);
  });
});

describe("transportAggregator — hash", () => {
  const base: TransportSource = {
    fromRoomId: "r1",
    claimMap: { a: "A", b: "B" },
    supports: [
      { claimId: "a", score: 0.5 },
      { claimId: "b", score: 0.7 },
    ],
  };

  test("stable across input ordering", () => {
    const reordered: TransportSource = {
      ...base,
      supports: [...base.supports].reverse(),
      claimMap: { b: "B", a: "A" },
    };
    expect(computeTransportHash(base)).toBe(computeTransportHash(reordered));
  });

  test("changes when a score changes", () => {
    const mutated = { ...base, supports: [{ claimId: "a", score: 0.500001 }, base.supports[1]] };
    expect(computeTransportHash(base)).not.toBe(computeTransportHash(mutated));
  });

  test("changes when the claim map changes", () => {
    const mutated = { ...base, claimMap: { a: "A", b: "B2" } };
    expect(computeTransportHash(base)).not.toBe(computeTransportHash(mutated));
  });
});

describe("transportAggregator — reduce", () => {
  test("empty → 0 in every mode", () => {
    expect(reduceImportedScores([], "min")).toBe(0);
    expect(reduceImportedScores([], "product")).toBe(0);
    // Phase 5b: logodds keeps the `0` sentinel even though 0.5 is its identity,
    // so the `imported === 0` short-circuit in combine still fires.
    expect(reduceImportedScores([], "logodds")).toBe(0);
  });

  test("min mode reduces with max (the join in the min-monoid)", () => {
    expect(reduceImportedScores([0.2, 0.8, 0.5], "min")).toBe(0.8);
  });

  test("product mode is noisy-OR", () => {
    // 1 - (1-0.5)(1-0.5) = 0.75
    expect(reduceImportedScores([0.5, 0.5], "product")).toBeCloseTo(0.75, 6);
  });

  test("logodds mode corroborates (weight-of-evidence sum)", () => {
    // 0.6 ⊕ 0.6 ≈ 0.6923 (non-idempotent, vs noisy-OR's 0.84)
    expect(reduceImportedScores([0.6, 0.6], "logodds")).toBeCloseTo(
      corroborateProbs([0.6, 0.6]),
      6,
    );
    expect(reduceImportedScores([0.6, 0.6], "logodds")).toBeGreaterThan(0.6);
    expect(reduceImportedScores([0.6, 0.6], "logodds")).toBeLessThan(0.84);
  });
});

describe("transportAggregator — combine", () => {
  test("identity: combine(local, 0) === local", () => {
    expect(combineLocalAndImported(0.42, 0, "min")).toBe(0.42);
    expect(combineLocalAndImported(0.42, 0, "product")).toBe(0.42);
    expect(combineLocalAndImported(0.42, 0, "logodds")).toBe(0.42);
  });

  test("monotone in imported (Ambler p.171, §0.5.6)", () => {
    const a = combineLocalAndImported(0.3, 0.1, "product");
    const b = combineLocalAndImported(0.3, 0.4, "product");
    expect(b).toBeGreaterThanOrEqual(a);
  });

  test("min mode combines with max", () => {
    expect(combineLocalAndImported(0.4, 0.7, "min")).toBe(0.7);
    expect(combineLocalAndImported(0.9, 0.1, "min")).toBe(0.9);
  });

  test("product mode combines with noisy-OR", () => {
    // 1 - (1-0.4)(1-0.5) = 0.7
    expect(combineLocalAndImported(0.4, 0.5, "product")).toBeCloseTo(0.7, 6);
  });

  test("logodds mode combines via log-odds corroboration", () => {
    expect(combineLocalAndImported(0.6, 0.6, "logodds")).toBeCloseTo(
      corroborateProbs([0.6, 0.6]),
      6,
    );
  });

  test("logodds is the signed-evidence exception: below-neutral imports lower the total", () => {
    // Corroborating with imported support < 0.5 drops the total below local —
    // the deliberate log-odds departure from the monotone min/product bands.
    expect(combineLocalAndImported(0.6, 0.3, "logodds")).toBeLessThan(0.6);
  });
});

// ── L2 — band soundness needs origin dedupe (C014 discharge 2 → T010) ────────
// RESEARCH_PROGRAMME/03_CONJECTURES/C014-plexus-transport-pseudofunctor.md §C014.b,
// Q-042, and the promoted theorem
// RESEARCH_PROGRAMME/02_THEOREMS_AND_PROOFS/T010-plexus-coherence-pseudofunctor.md.
//
// A0 §1.3 finding, made executable: the production scalar reducer
// `reduceImportedScores(number[], mode)` carries NO source identity, so when the
// SAME ultimate origin reaches a target claim by two transport paths (the exact
// multi-hop double-count the one-hop contract guards against), product/logodds
// corroborate it TWICE. `min` is the only mode that is accidentally safe
// (max is idempotent). This block:
//   (1) freezes the double-count as a regression witness (P1), then
//   (2) exercises the T010 L2 fix `reduceImportedByOrigin` — dedupe by ultimate
//       origin BEFORE reducing — proving it idempotent-by-origin (P2),
//       path-independent (P3), makes multi-hop agree with iterated one-hop
//       (P4, the C014.b equality), and is a conservative extension on distinct
//       origins (P5) with an order-independent `max` within-origin collapse (P6).
//
// PROMOTED (2026-07-05): now that T010 is established, `reduceImportedByOrigin`
// is exported from the production `transportAggregator` (imported above), and
// `ImportedContribution` carries the `originId` path-provenance field. This is
// the Layer-A / origin-key half of provenance-research T1
// (RESEARCH_PROGRAMME/provenance-research/provenance-gap-T1-lineage-disjointness-scoping-2026-07-05.md);
// the content-identity half (Layer B) is a separate, still-open investigation.

describe("L2 — band soundness needs origin dedupe (T010 L2)", () => {
  test("P1 regression: the positional reducer double-counts a twice-arriving origin (product/logodds)", () => {
    // Origin O has support 0.6, reaches the target via two paths ⇒ [0.6, 0.6].
    const once = reduceImportedScores([0.6], "product");
    const twice = reduceImportedScores([0.6, 0.6], "product");
    expect(twice).toBeGreaterThan(once); // product double-counts (0.84 > 0.6)

    const onceL = reduceImportedScores([0.6], "logodds");
    const twiceL = reduceImportedScores([0.6, 0.6], "logodds");
    expect(twiceL).toBeGreaterThan(onceL); // logodds double-counts (0.69 > 0.6)
  });

  test("P1b: min mode is accidentally safe (max is idempotent) — not a general fix", () => {
    expect(reduceImportedScores([0.6, 0.6], "min")).toBe(reduceImportedScores([0.6], "min"));
  });

  test("P2 origin-dedupe is idempotent by origin in every mode", () => {
    for (const mode of ["min", "product", "logodds"] as const) {
      const single = reduceImportedByOrigin([{ originId: "O", score: 0.6 }], mode);
      const doubled = reduceImportedByOrigin(
        [{ originId: "O", score: 0.6 }, { originId: "O", score: 0.6 }],
        mode,
      );
      expect(doubled).toBeCloseTo(single, 12); // same origin twice ⇒ counted once
    }
  });

  test("P3 path-independence: any multiset of paths reaching the same origin SET gives the same band", () => {
    // Origin set {A:0.7, B:0.6} reached by three different path multisets.
    const pathsX = [
      { originId: "A", score: 0.7 },
      { originId: "B", score: 0.6 },
    ];
    const pathsY = [
      { originId: "A", score: 0.7 },
      { originId: "A", score: 0.7 }, // A reached twice
      { originId: "B", score: 0.6 },
    ];
    const pathsZ = [
      { originId: "B", score: 0.6 },
      { originId: "B", score: 0.6 },
      { originId: "A", score: 0.7 },
      { originId: "A", score: 0.7 },
    ];
    for (const mode of ["min", "product", "logodds"] as const) {
      const x = reduceImportedByOrigin(pathsX, mode);
      const y = reduceImportedByOrigin(pathsY, mode);
      const z = reduceImportedByOrigin(pathsZ, mode);
      expect(y).toBeCloseTo(x, 12);
      expect(z).toBeCloseTo(x, 12);
    }
  });

  test("P4 C014.b: multi-hop band = iterated one-hop band under origin dedupe", () => {
    // Scenario: target claim ψ gets local support 0.5. Origin A (score 0.7)
    // reaches ψ directly (A→ψ) AND via B (A→B→ψ). Iterated ONE-HOP, attributing
    // to ultimate origin, A contributes once. The positional reducer would add
    // A twice; the origin-keyed reducer matches the one-hop truth.
    const local = 0.5;
    for (const mode of ["min", "product", "logodds"] as const) {
      // one-hop truth: A counted once
      const oneHopImported = reduceImportedByOrigin([{ originId: "A", score: 0.7 }], mode);
      const oneHopTotal = combineLocalAndImported(local, oneHopImported, mode);

      // multi-hop: A arrives by two paths, deduped by origin
      const multiHopImported = reduceImportedByOrigin(
        [
          { originId: "A", score: 0.7 }, // A→ψ direct
          { originId: "A", score: 0.7 }, // A→B→ψ (same ultimate origin)
        ],
        mode,
      );
      const multiHopTotal = combineLocalAndImported(local, multiHopImported, mode);

      expect(multiHopTotal).toBeCloseTo(oneHopTotal, 12); // C014.b equality

      // and the POSITIONAL reducer would have broken this for product/logodds:
      if (mode !== "min") {
        const naiveImported = reduceImportedScores([0.7, 0.7], mode);
        const naiveTotal = combineLocalAndImported(local, naiveImported, mode);
        expect(naiveTotal).toBeGreaterThan(oneHopTotal); // the double-count bug
      }
    }
  });

  test("P5 conservative extension: all-distinct origins ⇒ equals the positional reducer", () => {
    // The dedupe must be INVISIBLE on genuinely independent evidence — this is what
    // makes shipping it under the one-hop cap behaviour-neutral (each one-hop
    // contribution's originId is its own fromClaimId, hence all distinct).
    const contribs = [
      { originId: "A", score: 0.7 },
      { originId: "B", score: 0.6 },
      { originId: "C", score: 0.4 },
    ];
    const scores = contribs.map((c) => c.score);
    for (const mode of ["min", "product", "logodds"] as const) {
      expect(reduceImportedByOrigin(contribs, mode)).toBeCloseTo(
        reduceImportedScores(scores, mode),
        12,
      );
    }
  });

  test("P6 within-origin collapse is max, and order-independent (vs the prototype's last-write)", () => {
    // If the same origin ever arrives with DIFFERENT scores (a future per-edge
    // transport weight), collapse must be deterministic. `max` is order-independent;
    // the old last-write-wins prototype was not. Here A arrives as 0.5 and 0.8.
    const asc = [
      { originId: "A", score: 0.5 },
      { originId: "A", score: 0.8 },
    ];
    const desc = [...asc].reverse();
    for (const mode of ["min", "product", "logodds"] as const) {
      const collapsed = reduceImportedByOrigin(asc, mode);
      // one origin, collapsed to max(0.5, 0.8)=0.8 ⇒ single-score reduce
      expect(collapsed).toBeCloseTo(reduceImportedScores([0.8], mode), 12);
      // and order does not matter
      expect(reduceImportedByOrigin(desc, mode)).toBeCloseTo(collapsed, 12);
    }
  });

  test("P0 empty ⇒ 0 sentinel, matching reduceImportedScores", () => {
    for (const mode of ["min", "product", "logodds"] as const) {
      expect(reduceImportedByOrigin([], mode)).toBe(0);
    }
  });
});

describe("transportAggregator — payload carries originId (T010 L2 path-provenance)", () => {
  test("one-hop: originId equals fromClaimId (immediate = ultimate origin)", () => {
    const out = computeTransportPayload({
      fromRoomId: "r1",
      claimMap: { a: "T", b: "T" },
      supports: [
        { claimId: "a", score: 0.4 },
        { claimId: "b", score: 0.6 },
      ],
    });
    for (const src of out.byClaim["T"].sources) {
      expect(src.originId).toBe(src.fromClaimId);
    }
  });
});

// ── M2 — route aggregation is behaviour-neutral under one-hop ────────────────
// The `ecc/aggregate` route swapped its per-room-then-across-room reduction
// (`reduceImportedScores(rooms.map(r => reduceImportedScores(r.scores)))`) for a
// flat origin-keyed reduction (`reduceImportedByOrigin(allAtoms)`). Under the
// one-hop cap every atom's originId is its own fromClaimId, hence all distinct, so
// the two MUST agree — this is the algebra-level certificate the route has no unit
// harness to assert directly.
describe("M2 — flat origin-keyed reduction equals the old nested reduction (one-hop)", () => {
  // Two source rooms landing on the same target; distinct origins (one-hop).
  const rooms = [
    { scores: [0.7, 0.4] }, // room r1: two source claims
    { scores: [0.55] }, //     room r2: one source claim
  ];
  const flatAtoms = [
    { originId: "r1:a", score: 0.7 },
    { originId: "r1:b", score: 0.4 },
    { originId: "r2:c", score: 0.55 },
  ];

  test("agrees across every mode", () => {
    for (const mode of ["min", "product", "logodds"] as const) {
      const oldNested = reduceImportedScores(
        rooms.map((r) => reduceImportedScores(r.scores, mode)),
        mode,
      );
      const newFlat = reduceImportedByOrigin(flatAtoms, mode);
      expect(newFlat).toBeCloseTo(oldNested, 12);
    }
  });
});

