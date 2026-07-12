/**
 * M5 — chain-fitness attacker weighting.
 *
 * The chain aggregator in `lib/deliberation/chainExposure.ts` weights
 * each inbound attack edge by the attacker argument's standing, so a
 * chain whose attackers are themselves refuted no longer reads as
 * catastrophically fragile. This file pins the weighting contract:
 *
 *   - tested-undermined attacker → 0.1 (effectively absorbed)
 *   - tested-attacked attacker   → 0.5 (partial pressure)
 *   - everything else            → 1.0 (full pressure)
 *
 * And demonstrates, on a Hinge-1-shaped synthetic input, that the
 * weighted aggregate is materially less negative than the flat count
 * that the previous implementation produced.
 */

import { attackerCredibility } from "@/lib/deliberation/chainExposure";
import { computeFitnessBreakdown } from "@/lib/citations/argumentAttestation";
import { selectWeakestLink } from "@/lib/deliberation/chainExposure";
import { selectWorstStanding } from "@/lib/deliberation/chainExposure";
import type { StandingState } from "@/lib/citations/argumentAttestation";
describe("chain attacker weighting", () => {
  describe("attackerCredibility contract", () => {
    it("downweights refuted attackers to ≈0", () => {
      expect(attackerCredibility("tested-undermined")).toBeLessThanOrEqual(0.1);
    });

    it("partially downweights contested attackers", () => {
      const c = attackerCredibility("tested-attacked");
      expect(c).toBeGreaterThan(0.1);
      expect(c).toBeLessThan(1.0);
    });

    it("gives full weight to unanswered attackers", () => {
      expect(attackerCredibility("tested-survived")).toBe(1.0);
      expect(attackerCredibility("untested-supported")).toBe(1.0);
      expect(attackerCredibility("untested-default")).toBe(1.0);
    });
  });

  describe("Hinge-1-shaped aggregate is less negative than flat count", () => {
    // Synthetic stand-in for the Hinge-1 fixture: 5 inbound attack
    // edges on the chain, of which 3 originate from `tested-undermined`
    // attackers (Iyengar response refuting Druckman's critique etc.),
    // 1 from a `tested-attacked` attacker, and 1 from an unanswered
    // `untested-default` attacker. The flat aggregator counted 5
    // attacks; the weighted aggregator should count materially fewer.
    const standings = [
      "tested-undermined",
      "tested-undermined",
      "tested-undermined",
      "tested-attacked",
      "untested-default",
    ] as const;

    const flatTotal = standings.length;
    const weightedTotal = standings
      .map((s) => attackerCredibility(s))
      .reduce((a, b) => a + b, 0);

    it("weighted attack-edge sum is materially less than flat count", () => {
      expect(weightedTotal).toBeLessThan(flatTotal);
      // Target: at least a 40% reduction. With the 0.1/0.5/1.0 schedule
      // and the standings above, weighted = 0.1*3 + 0.5 + 1.0 = 1.8
      // (vs flat 5.0), a 64% reduction — well within the bar.
      expect(weightedTotal / flatTotal).toBeLessThan(0.6);
    });

    it("aggregate fitness is less negative when attackers are refuted", () => {
      // Shared non-attack components held constant; only the attack
      // count changes between the flat and weighted aggregates.
      const base = {
        cqAnswered: 4,
        supportEdges: 6,
        attackCAs: 0,
        evidenceWithProvenance: 2,
      };
      const flat = computeFitnessBreakdown({
        ...base,
        attackEdges: flatTotal,
      });
      const weighted = computeFitnessBreakdown({
        ...base,
        attackEdges: weightedTotal,
      });
      expect(weighted.total).toBeGreaterThan(flat.total);
    });
  });
});

describe("selectWeakestLink", () => {
  it("returns null when every link sits at the untested-default floor", () => {
    // 3-link chain, all fitness 0, all CQs unanswered but different scheme
    // sizes (5, 5, 3 → fractions 1.0, 1.0, 1.0). Identical fitness AND
    // identical CQ fraction → no honest weakest link.
    const result = selectWeakestLink([
      { argumentId: "link-1", fitnessTotal: 0, cqRequired: 5, cqAnswered: 0 },
      { argumentId: "link-2", fitnessTotal: 0, cqRequired: 5, cqAnswered: 0 },
      { argumentId: "link-3", fitnessTotal: 0, cqRequired: 3, cqAnswered: 0 },
    ]);
    expect(result).toBeNull();
  });

  it("does not penalise a richer-CQ scheme purely for catalogue size", () => {
    // Both at the floor, both zero answered: a 5-CQ link and a 3-CQ link are
    // equally exposed (fraction 1.0 each), so size alone must not break the tie.
    const result = selectWeakestLink([
      { argumentId: "five-cq", fitnessTotal: 0, cqRequired: 5, cqAnswered: 0 },
      { argumentId: "three-cq", fitnessTotal: 0, cqRequired: 3, cqAnswered: 0 },
    ]);
    expect(result).toBeNull();
  });

  it("breaks ties on the largest *fraction* of unanswered CQs", () => {
    // Equal fitness. link-a: 1/5 unanswered = 0.2; link-b: 2/3 unanswered ≈ 0.67.
    // link-b is the more exposed link despite having fewer total CQs.
    const result = selectWeakestLink([
      { argumentId: "link-a", fitnessTotal: 0, cqRequired: 5, cqAnswered: 4 },
      { argumentId: "link-b", fitnessTotal: 0, cqRequired: 3, cqAnswered: 1 },
    ]);
    expect(result?.argumentId).toBe("link-b");
  });

  it("uses fitness as the primary key", () => {
    const result = selectWeakestLink([
      { argumentId: "strong", fitnessTotal: 2, cqRequired: 5, cqAnswered: 0 },
      { argumentId: "weak", fitnessTotal: -1, cqRequired: 3, cqAnswered: 2 },
    ]);
    expect(result?.argumentId).toBe("weak");
  });

  it("names a single link as its own weakest link", () => {
    const result = selectWeakestLink([
      { argumentId: "solo", fitnessTotal: 0, cqRequired: 4, cqAnswered: 0 },
    ]);
    expect(result?.argumentId).toBe("solo");
  });

  it("returns null for an empty chain", () => {
    expect(selectWeakestLink([])).toBeNull();
  });
});

describe("selectWorstStanding (PART 4 §6 — edge-shape-agnostic chain standing)", () => {
  // Rank order (worst → best): untested-default < untested-supported <
  // tested-attacked < tested-undermined < tested-survived. "Worst" = lowest rank.
  it("returns the minimum standing across members", () => {
    expect(
      selectWorstStanding([
        "tested-survived",
        "tested-undermined",
        "tested-attacked",
      ]),
    ).toBe("tested-attacked");
  });

  it("is invariant under member order (different topologies, same members)", () => {
    // A CONVERGENT fan-in and a SERIAL spine over the SAME three arguments
    // visit them in different node orders; the chain standing must not differ.
    const members: StandingState[] = [
      "untested-supported",
      "tested-attacked",
      "tested-survived",
    ];
    const serialOrder = [...members];
    const convergentOrder = [members[2], members[0], members[1]];
    const treeOrder = [members[1], members[2], members[0]];
    const expected = "untested-supported"; // rank 1 — the lowest present
    expect(selectWorstStanding(serialOrder)).toBe(expected);
    expect(selectWorstStanding(convergentOrder)).toBe(expected);
    expect(selectWorstStanding(treeOrder)).toBe(expected);
  });

  it("ignores edge count — only the member set matters", () => {
    // A densely-wired GRAPH and a sparse SERIAL chain with identical member
    // standings yield identical chain standing (the function never sees edges).
    const sparse: StandingState[] = ["tested-survived", "tested-undermined"];
    const dense: StandingState[] = ["tested-undermined", "tested-survived"];
    expect(selectWorstStanding(sparse)).toBe(selectWorstStanding(dense));
  });

  it("reduces a uniform chain to that single standing", () => {
    expect(
      selectWorstStanding([
        "untested-default",
        "untested-default",
        "untested-default",
      ]),
    ).toBe("untested-default");
  });

  it("treats a single-member chain as its own standing", () => {
    expect(selectWorstStanding(["tested-survived"])).toBe("tested-survived");
  });

  it("defaults an empty member set to untested-default", () => {
    expect(selectWorstStanding([])).toBe("untested-default");
  });

  it("surfaces the worst even when it is the deepest rank (tested-undermined)", () => {
    expect(
      selectWorstStanding([
        "tested-survived",
        "tested-survived",
        "tested-undermined",
      ]),
    ).toBe("tested-undermined");
  });
});

