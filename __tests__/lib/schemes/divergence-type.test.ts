import {
  classifyDivergence,
  divergenceTypeFor,
  DIVERGENCE_TYPES,
  type DivergenceType,
} from "@/lib/schemes/divergence-type";

describe("divergence-type read-model", () => {
  test("every mapped CQ has a valid divergence type", () => {
    const valid: DivergenceType[] = ["FACTUAL", "EVALUATIVE", "STRUCTURAL"];
    for (const scheme of Object.values(DIVERGENCE_TYPES)) {
      for (const t of Object.values(scheme)) {
        expect(valid).toContain(t);
      }
    }
  });

  test("PR CQs split factual / evaluative / structural as intended", () => {
    const pr = DIVERGENCE_TYPES.practical_reasoning;
    expect(pr["PR.MEANS_EFFECTIVE"]).toBe("FACTUAL");
    expect(pr["PR.SIDE_EFFECTS"]).toBe("FACTUAL");
    expect(pr["PR.GOAL_ACCEPTED"]).toBe("EVALUATIVE");
    expect(pr["PR.PERMISSIBILITY"]).toBe("EVALUATIVE");
    expect(pr["PR.ALTERNATIVES"]).toBe("STRUCTURAL");
    expect(pr["PR.FEASIBILITY"]).toBe("STRUCTURAL");
  });

  test("mapped CQ classification reports basis=mapped", () => {
    const r = classifyDivergence("practical_reasoning", "PR.GOAL_ACCEPTED", "premise");
    expect(r.type).toBe("EVALUATIVE");
    expect(r.basis).toBe("mapped");
  });

  test("unmapped CQ falls back to the scope heuristic", () => {
    const inf = classifyDivergence("some_scheme", "x", "inference");
    expect(inf).toMatchObject({ type: "FACTUAL", basis: "heuristic" });

    const concl = classifyDivergence("some_scheme", "x", "conclusion");
    expect(concl).toMatchObject({ type: "EVALUATIVE", basis: "heuristic" });
  });

  test("unmapped CQ with no scope is honestly unknown (never silently guessed)", () => {
    const r = classifyDivergence("some_scheme", "x");
    expect(r.type).toBeNull();
    expect(r.basis).toBe("unknown");
  });

  test("the explicit map wins over the heuristic even when scope is supplied", () => {
    // PR.PERMISSIBILITY is conclusion-scoped; the heuristic would say EVALUATIVE
    // too, but PR.MEANS_EFFECTIVE is inference-scoped and the map says FACTUAL —
    // confirm the map (not the scope) is authoritative for mapped CQs.
    const r = classifyDivergence("practical_reasoning", "PR.MEANS_EFFECTIVE", "inference");
    expect(r.type).toBe("FACTUAL");
    expect(r.basis).toBe("mapped");
  });

  test("divergenceTypeFor returns undefined for unmapped CQs", () => {
    expect(divergenceTypeFor("practical_reasoning", "PR.SIDE_EFFECTS")).toBe("FACTUAL");
    expect(divergenceTypeFor("expert_opinion", "domain_fit")).toBeUndefined();
  });
});
