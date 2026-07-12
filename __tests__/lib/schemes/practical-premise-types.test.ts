import {
  PRACTICAL_PREMISE_TYPES,
  premiseTypeFor,
} from "@/lib/schemes/practical-premise-types";
import { autoWaiveAssumptions } from "@/lib/schemes/protocol/soundnessGate";
import type { CqObligationRecord } from "@/lib/schemes/protocol/protocolState";

describe("practical_reasoning premiseType mapping", () => {
  test("the six PR CQs are mapped", () => {
    const pr = PRACTICAL_PREMISE_TYPES.practical_reasoning;
    expect(Object.keys(pr).sort()).toEqual(
      [
        "PR.ALTERNATIVES",
        "PR.FEASIBILITY",
        "PR.GOAL_ACCEPTED",
        "PR.MEANS_EFFECTIVE",
        "PR.PERMISSIBILITY",
        "PR.SIDE_EFFECTS",
      ].sort()
    );
  });

  test("only the means-end warrant is ORDINARY (blocks close); the rest are ASSUMPTION", () => {
    const pr = PRACTICAL_PREMISE_TYPES.practical_reasoning;
    expect(pr["PR.MEANS_EFFECTIVE"]).toBe("ORDINARY");
    expect(pr["PR.GOAL_ACCEPTED"]).toBe("ASSUMPTION");
    expect(pr["PR.ALTERNATIVES"]).toBe("ASSUMPTION");
    expect(pr["PR.SIDE_EFFECTS"]).toBe("ASSUMPTION");
    expect(pr["PR.FEASIBILITY"]).toBe("ASSUMPTION");
    expect(pr["PR.PERMISSIBILITY"]).toBe("ASSUMPTION");
  });

  test("premiseTypeFor returns undefined for unmapped CQs (ORDINARY default preserved)", () => {
    expect(premiseTypeFor("practical_reasoning", "PR.SIDE_EFFECTS")).toBe("ASSUMPTION");
    expect(premiseTypeFor("practical_reasoning", "nonexistent")).toBeUndefined();
    expect(premiseTypeFor("expert_opinion", "domain_fit")).toBeUndefined();
  });
});

describe("open-by-default outcome via autoWaiveAssumptions", () => {
  // Build the PR obligation set with every CQ `not-offered` (nothing raised),
  // typed per the mapping, and confirm that after auto-waive only the ORDINARY
  // means-end warrant remains un-waived (i.e. PR is "fast and frugal": goal +
  // means presumption; the four ASSUMPTION CQs do not block close).
  const ob = (cqKey: string): CqObligationRecord => ({
    cqKey,
    status: "not-offered",
    burdenOfProof: "PROPONENT",
    requiresEvidence: false,
    premiseType: premiseTypeFor("practical_reasoning", cqKey) ?? null,
    subLocusId: null,
    closingMoveId: null,
    evidenceRefs: [],
  });

  test("the four ASSUMPTION CQs auto-waive; ORDINARY does not", () => {
    const obligations = [
      "PR.GOAL_ACCEPTED",
      "PR.MEANS_EFFECTIVE",
      "PR.ALTERNATIVES",
      "PR.SIDE_EFFECTS",
      "PR.FEASIBILITY",
      "PR.PERMISSIBILITY",
    ].map(ob);

    const waived = autoWaiveAssumptions(obligations);
    const byKey = new Map(waived.map((o) => [o.cqKey, o.status]));

    // ASSUMPTION CQs auto-waive → not blocking.
    expect(byKey.get("PR.GOAL_ACCEPTED")).toBe("waived");
    expect(byKey.get("PR.ALTERNATIVES")).toBe("waived");
    expect(byKey.get("PR.SIDE_EFFECTS")).toBe("waived");
    expect(byKey.get("PR.FEASIBILITY")).toBe("waived");
    expect(byKey.get("PR.PERMISSIBILITY")).toBe("waived");

    // ORDINARY means-end warrant stays not-offered → still required.
    expect(byKey.get("PR.MEANS_EFFECTIVE")).toBe("not-offered");
  });

  test("a raised side-effects CQ is no longer auto-waived (raise-by-instantiation)", () => {
    // When a challenger raises PR.SIDE_EFFECTS, its status is no longer
    // `not-offered`, so auto-waive does not apply — it re-blocks until resolved.
    const raised: CqObligationRecord = { ...ob("PR.SIDE_EFFECTS"), status: "offered-open" };
    const waived = autoWaiveAssumptions([raised]);
    expect(waived[0].status).toBe("offered-open");
  });
});
