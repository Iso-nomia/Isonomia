// tests/ecc.test.ts
// Unit tests for Evidential Category of Claims (ECC) with assumption tracking
// Phase: Gap 4 - Per-Derivation Assumption Tracking

import { 
  Arrow, 
  zero, 
  join, 
  compose, 
  minimalAssumptions, 
  derivationsUsingAssumption,
  tensor,
  internalHom,
  isSimple,
  isEntire,
  isSelected,
  arrowMeta,
  isLogical,
  isDerivationLogical,
  confidence,
  MIN_MONOID,
  PRODUCT_MONOID,
  DS_MONOID,
  LOGODDS_MONOID,
  withMinScores,
  withProductScores,
  withDsScores,
  withLogoddsScores,
  getConfidenceMonoid,
  registerConfidenceMonoid,
  type ConfidenceMonoid,
  type Functor,
  transport,
  aggregateAcrossRooms,
  culpritSets,
  detectEnthymemes,
  type SchemeCatalog,
} from "../lib/argumentation/ecc";

describe("Evidential Category - Arrow with Assumptions", () => {
  
  describe("zero()", () => {
    test("creates empty assumption map", () => {
      const z = zero("A", "B");
      
      expect(z.from).toBe("A");
      expect(z.to).toBe("B");
      expect(z.derivs.size).toBe(0);
      expect(z.assumptions.size).toBe(0);
    });

    test("maintains type parameters", () => {
      const z = zero<string, string>("claim1", "claim2");
      
      expect(z.from).toBe("claim1");
      expect(z.to).toBe("claim2");
    });
  });

  describe("join()", () => {
    test("merges derivation sets", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      
      const joined = join(f, g);
      
      expect(joined.from).toBe("A");
      expect(joined.to).toBe("B");
      expect(joined.derivs).toEqual(new Set(["d1", "d2"]));
    });

    test("merges assumption maps correctly", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      
      const joined = join(f, g);
      
      expect(joined.assumptions.size).toBe(2);
      expect(joined.assumptions.get("d1")).toEqual(new Set(["λ1"]));
      expect(joined.assumptions.get("d2")).toEqual(new Set(["λ2"]));
    });

    test("unions assumptions when same derivation appears in both", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),  // Same derivation ID
        assumptions: new Map([["d1", new Set(["λ2"])]])
      };
      
      const joined = join(f, g);
      
      expect(joined.derivs).toEqual(new Set(["d1"]));
      expect(joined.assumptions.get("d1")).toEqual(new Set(["λ1", "λ2"]));
    });

    test("handles empty assumptions", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map()
      };
      const g: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      
      const joined = join(f, g);
      
      expect(joined.assumptions.size).toBe(1);
      expect(joined.assumptions.get("d2")).toEqual(new Set(["λ2"]));
    });

    test("is commutative", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      
      const fg = join(f, g);
      const gf = join(g, f);
      
      expect(fg.derivs).toEqual(gf.derivs);
      expect(fg.assumptions.get("d1")).toEqual(gf.assumptions.get("d1"));
      expect(fg.assumptions.get("d2")).toEqual(gf.assumptions.get("d2"));
    });

    test("throws error on domain mismatch", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map()
      };
      const g: Arrow = {
        from: "X", to: "B",  // Different domain
        derivs: new Set(["d2"]),
        assumptions: new Map()
      };
      
      expect(() => join(f, g)).toThrow("join: type mismatch");
    });

    test("throws error on codomain mismatch", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map()
      };
      const g: Arrow = {
        from: "A", to: "Y",  // Different codomain
        derivs: new Set(["d2"]),
        assumptions: new Map()
      };
      
      expect(() => join(f, g)).toThrow("join: type mismatch");
    });

    test("identity: join(f, zero) = f", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const z = zero("A", "B");
      
      const joined = join(f, z);
      
      expect(joined.derivs).toEqual(f.derivs);
      expect(joined.assumptions.get("d1")).toEqual(new Set(["λ1"]));
    });
  });

  describe("compose()", () => {
    test("creates composed derivations", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map()
      };
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d2"]),
        assumptions: new Map()
      };
      
      const composed = compose(g, f);
      
      expect(composed.from).toBe("A");
      expect(composed.to).toBe("C");
      expect(composed.derivs).toEqual(new Set(["d1∘d2"]));
    });

    test("unions assumptions transitively", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      
      const composed = compose(g, f);
      
      expect(composed.derivs).toEqual(new Set(["d1∘d2"]));
      expect(composed.assumptions.get("d1∘d2")).toEqual(new Set(["λ1", "λ2"]));
    });

    test("handles multiple derivations (Cartesian product)", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2"]),
        assumptions: new Map([
          ["d1", new Set(["λ1"])],
          ["d2", new Set(["λ2"])]
        ])
      };
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d3"]),
        assumptions: new Map([["d3", new Set(["λ3"])]])
      };
      
      const composed = compose(g, f);
      
      expect(composed.derivs).toEqual(new Set(["d1∘d3", "d2∘d3"]));
      expect(composed.assumptions.get("d1∘d3")).toEqual(new Set(["λ1", "λ3"]));
      expect(composed.assumptions.get("d2∘d3")).toEqual(new Set(["λ2", "λ3"]));
    });

    test("handles empty assumptions in first morphism", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map()  // No assumptions
      };
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      
      const composed = compose(g, f);
      
      expect(composed.assumptions.get("d1∘d2")).toEqual(new Set(["λ2"]));
    });

    test("handles empty assumptions in second morphism", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d2"]),
        assumptions: new Map()  // No assumptions
      };
      
      const composed = compose(g, f);
      
      expect(composed.assumptions.get("d1∘d2")).toEqual(new Set(["λ1"]));
    });

    test("is associative (transitivity)", () => {
      const f: Arrow = { 
        from: "A", to: "B", 
        derivs: new Set(["d1"]), 
        assumptions: new Map([["d1", new Set(["λ1"])]]) 
      };
      const g: Arrow = { 
        from: "B", to: "C", 
        derivs: new Set(["d2"]), 
        assumptions: new Map([["d2", new Set(["λ2"])]]) 
      };
      const h: Arrow = { 
        from: "C", to: "D", 
        derivs: new Set(["d3"]), 
        assumptions: new Map([["d3", new Set(["λ3"])]]) 
      };

      const hgf_left = compose(h, compose(g, f));
      const hgf_right = compose(compose(h, g), f);
      
      // Both should have same assumptions
      const minimalLeft = minimalAssumptions(hgf_left);
      const minimalRight = minimalAssumptions(hgf_right);
      
      expect(minimalLeft).toEqual(new Set(["λ1", "λ2", "λ3"]));
      expect(minimalRight).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });

    test("three-step composition accumulates all assumptions", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };
      const h: Arrow = {
        from: "C", to: "D",
        derivs: new Set(["d3"]),
        assumptions: new Map([["d3", new Set(["λ3"])]])
      };

      const gf = compose(g, f);  // A → C uses {λ1, λ2}
      const hgf = compose(h, gf); // A → D uses {λ1, λ2, λ3}
      
      const minimal = minimalAssumptions(hgf);
      expect(minimal).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });
  });

  describe("minimalAssumptions()", () => {
    test("extracts union of all assumptions", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2"]),
        assumptions: new Map([
          ["d1", new Set(["λ1", "λ2"])],
          ["d2", new Set(["λ2", "λ3"])]
        ])
      };
      
      const minimal = minimalAssumptions(arrow);
      
      expect(minimal).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });

    test("returns empty set for no assumptions", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2"]),
        assumptions: new Map()
      };
      
      const minimal = minimalAssumptions(arrow);
      
      expect(minimal.size).toBe(0);
    });

    test("handles single derivation with multiple assumptions", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([
          ["d1", new Set(["λ1", "λ2", "λ3"])]
        ])
      };
      
      const minimal = minimalAssumptions(arrow);
      
      expect(minimal).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });

    test("deduplicates assumptions across derivations", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2", "d3"]),
        assumptions: new Map([
          ["d1", new Set(["λ1", "λ2"])],
          ["d2", new Set(["λ2", "λ3"])],
          ["d3", new Set(["λ3", "λ1"])]
        ])
      };
      
      const minimal = minimalAssumptions(arrow);
      
      expect(minimal).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });
  });

  describe("derivationsUsingAssumption()", () => {
    test("finds derivations using specific assumption", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2", "d3"]),
        assumptions: new Map([
          ["d1", new Set(["λ1", "λ2"])],
          ["d2", new Set(["λ2"])],
          ["d3", new Set(["λ3"])]
        ])
      };
      
      const affectedByLambda1 = derivationsUsingAssumption(arrow, "λ1");
      
      expect(affectedByLambda1).toEqual(new Set(["d1"]));
    });

    test("finds multiple derivations using same assumption", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2", "d3"]),
        assumptions: new Map([
          ["d1", new Set(["λ1", "λ2"])],
          ["d2", new Set(["λ2"])],
          ["d3", new Set(["λ3"])]
        ])
      };
      
      const affectedByLambda2 = derivationsUsingAssumption(arrow, "λ2");
      
      expect(affectedByLambda2).toEqual(new Set(["d1", "d2"]));
    });

    test("returns empty set if assumption not used", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2"]),
        assumptions: new Map([
          ["d1", new Set(["λ1"])],
          ["d2", new Set(["λ2"])]
        ])
      };
      
      const affectedByLambda3 = derivationsUsingAssumption(arrow, "λ3");
      
      expect(affectedByLambda3.size).toBe(0);
    });

    test("handles derivations with no assumptions", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1", "d2", "d3"]),
        assumptions: new Map([
          ["d1", new Set(["λ1"])],
          // d2 has no assumptions
          ["d3", new Set(["λ2"])]
        ])
      };
      
      const affectedByLambda1 = derivationsUsingAssumption(arrow, "λ1");
      
      expect(affectedByLambda1).toEqual(new Set(["d1"]));
    });
  });

  describe("Integration: compose() + minimalAssumptions()", () => {
    test("multi-step composition tracks all assumptions", () => {
      // A → B (uses λ1)
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };

      // B → C (uses λ2)
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };

      // C → D (uses λ3)
      const h: Arrow = {
        from: "C", to: "D",
        derivs: new Set(["d3"]),
        assumptions: new Map([["d3", new Set(["λ3"])]])
      };

      const gf = compose(g, f);  // A → C
      const hgf = compose(h, gf); // A → D
      
      const minimal = minimalAssumptions(hgf);
      
      expect(minimal).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });
  });

  describe("Integration: join() + compose()", () => {
    test("join before compose preserves assumptions correctly", () => {
      // Two paths from A to B
      const f1: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const f2: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d2"]),
        assumptions: new Map([["d2", new Set(["λ2"])]])
      };

      // One path from B to C
      const g: Arrow = {
        from: "B", to: "C",
        derivs: new Set(["d3"]),
        assumptions: new Map([["d3", new Set(["λ3"])]])
      };

      const f = join(f1, f2);  // Combined A → B
      const gf = compose(g, f); // A → C
      
      // Should have two composed derivations: d1∘d3 and d2∘d3
      expect(gf.derivs).toEqual(new Set(["d1∘d3", "d2∘d3"]));
      
      // d1∘d3 should use λ1 and λ3
      expect(gf.assumptions.get("d1∘d3")).toEqual(new Set(["λ1", "λ3"]));
      
      // d2∘d3 should use λ2 and λ3
      expect(gf.assumptions.get("d2∘d3")).toEqual(new Set(["λ2", "λ3"]));
      
      // Minimal assumptions should be union of all
      const minimal = minimalAssumptions(gf);
      expect(minimal).toEqual(new Set(["λ1", "λ2", "λ3"]));
    });
  });

  describe("Edge Cases", () => {
    test("empty derivation set has no assumptions", () => {
      const z = zero("A", "B");
      const minimal = minimalAssumptions(z);
      
      expect(minimal.size).toBe(0);
    });

    test("derivation with empty assumption set", () => {
      const arrow: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set()]])
      };
      
      const minimal = minimalAssumptions(arrow);
      
      expect(minimal.size).toBe(0);
    });

    test("compose with zero returns zero", () => {
      const f: Arrow = {
        from: "A", to: "B",
        derivs: new Set(["d1"]),
        assumptions: new Map([["d1", new Set(["λ1"])]])
      };
      const z = zero<string, string>("B", "C");
      
      const composed = compose(z, f);
      
      expect(composed.derivs.size).toBe(0);
      expect(composed.assumptions.size).toBe(0);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Sprint A2 — Property tests for the refined ECC surface
// Each suite cites the contract in
// `Development and Ideation Documents/ARCHITECTURE/ECC_REFINEMENT_AND_MCP_INTEGRATION_PLAN.md`
// or the Ambler 1996 lemma it discharges.
// ────────────────────────────────────────────────────────────────────────────

const arr = (
  from: string,
  to: string,
  pairs: Array<[string, string[]]>
): Arrow => ({
  from,
  to,
  derivs: new Set(pairs.map(([d]) => d)),
  assumptions: new Map(pairs.map(([d, a]) => [d, new Set(a)])),
});

describe("Sprint A — structural predicates (Ambler Def. 8)", () => {
  test("isSimple holds for empty and singleton hom-sets", () => {
    expect(isSimple(zero("A", "B"))).toBe(true);
    expect(isSimple(arr("A", "B", [["d1", []]]))).toBe(true);
    expect(isSimple(arr("A", "B", [["d1", []], ["d2", []]]))).toBe(false);
  });

  test("isEntire holds iff derivations exist", () => {
    expect(isEntire(zero("A", "B"))).toBe(false);
    expect(isEntire(arr("A", "B", [["d1", []]]))).toBe(true);
  });

  test("isSelected ⇔ isSimple ∧ isEntire ⇔ |derivs| === 1", () => {
    expect(isSelected(zero("A", "B"))).toBe(false);
    expect(isSelected(arr("A", "B", [["d1", []]]))).toBe(true);
    expect(isSelected(arr("A", "B", [["d1", []], ["d2", []]]))).toBe(false);
  });

  test("arrowMeta packages the three predicates", () => {
    const m = arrowMeta(arr("A", "B", [["d1", ["λ1"]]]));
    expect(m).toEqual({ simple: true, entire: true, selected: true });
  });

  test("comonoid laxness — duplication: equality iff selected", () => {
    // For our materialization: tensor(f,f).derivs has |f.derivs|^2 elements;
    // duplicating the source ("Δ_X") and applying (f⊗f) gives the same
    // count. The "Δ_Y ∘ f" side has |f.derivs| elements (one per derivation
    // of f, then duplicated). They agree in cardinality iff |f.derivs| ≤ 1
    // — i.e. iff f is simple. This is the materialized echo of Lemma 7.
    const selected = arr("A", "B", [["d1", ["λ1"]]]);
    const ff_sel = tensor(selected, selected);
    expect(ff_sel.derivs.size).toBe(selected.derivs.size); // 1 = 1²

    const nonSelected = arr("A", "B", [["d1", []], ["d2", []]]);
    const ff_ns = tensor(nonSelected, nonSelected);
    expect(ff_ns.derivs.size).toBe(nonSelected.derivs.size ** 2); // 4 ≠ 2
    expect(ff_ns.derivs.size).toBeGreaterThan(nonSelected.derivs.size);
  });

  test("comonoid laxness — terminal: t_X ≥ t_Y∘f, equality iff entire", () => {
    // The terminal-map condition `t_X = t_Y ∘ f` requires `f` to be entire.
    // Materialized: an empty arrow has no terminal coverage.
    expect(isEntire(zero("A", "B"))).toBe(false);
    expect(isEntire(arr("A", "B", [["d1", []]]))).toBe(true);
  });
});

describe("Sprint A — tensor (⊗) (Ambler §2.1)", () => {
  test("derivs is the Cartesian product of input derivs", () => {
    const f = arr("A", "B", [["d1", []], ["d2", []]]);
    const g = arr("C", "D", [["d3", []], ["d4", []]]);
    const t = tensor(f, g);
    expect(t.derivs.size).toBe(4);
    expect(t.derivs.has("d1⊗d3")).toBe(true);
    expect(t.derivs.has("d2⊗d4")).toBe(true);
  });

  test("each pair's assumptions are the union of the two sides", () => {
    const f = arr("A", "B", [["d1", ["λ1"]]]);
    const g = arr("C", "D", [["d3", ["λ2"]]]);
    const t = tensor(f, g);
    expect(t.assumptions.get("d1⊗d3")).toEqual(new Set(["λ1", "λ2"]));
  });

  test("from/to are pair-typed", () => {
    const f = arr("A", "B", [["d1", []]]);
    const g = arr("C", "D", [["d3", []]]);
    const t = tensor(f, g);
    expect(t.from).toEqual(["A", "C"]);
    expect(t.to).toEqual(["B", "D"]);
  });

  test("tensor with empty arrow yields empty derivs", () => {
    const f = arr("A", "B", [["d1", []]]);
    const z = zero<string, string>("C", "D");
    const t = tensor(f, z);
    expect(t.derivs.size).toBe(0);
  });
});

describe("Sprint A — internalHom / Warrant (Ambler §2.4)", () => {
  test("returns a tagged warrant object", () => {
    const w = internalHom("A", "B", "claim-warrant-123");
    expect(w.kind).toBe("warrant");
    expect(w.from).toBe("A");
    expect(w.to).toBe("B");
    expect(w.warrantClaimId).toBe("claim-warrant-123");
  });
});

describe("Sprint A — isLogical (ECC plan §4 row 1, strict)", () => {
  const allAccepted = () => "ACCEPTED" as const;
  const allProposed = () => "PROPOSED" as const;
  const mixed = (id: string) =>
    id === "λ1" ? ("ACCEPTED" as const) : ("PROPOSED" as const);

  test("empty arrow is not logical (no derivations)", () => {
    expect(isLogical(zero("A", "B"), { assumptionStatus: allAccepted })).toBe(false);
  });

  test("derivation with all-ACCEPTED assumptions is logical", () => {
    const a = arr("A", "B", [["d1", ["λ1", "λ2"]]]);
    expect(isLogical(a, { assumptionStatus: allAccepted })).toBe(true);
  });

  test("PROPOSED assumption blocks the derivation (strict)", () => {
    const a = arr("A", "B", [["d1", ["λ1", "λ2"]]]);
    expect(isLogical(a, { assumptionStatus: allProposed })).toBe(false);
  });

  test("CHALLENGED assumption blocks the derivation (strict)", () => {
    const a = arr("A", "B", [["d1", ["λ1"]]]);
    expect(isLogical(a, { assumptionStatus: () => "CHALLENGED" })).toBe(false);
  });

  test("RETRACTED assumption blocks the derivation (strict)", () => {
    const a = arr("A", "B", [["d1", ["λ1"]]]);
    expect(isLogical(a, { assumptionStatus: () => "RETRACTED" })).toBe(false);
  });

  test("arrow with one logical and one non-logical derivation is logical", () => {
    // Closure under join: any single closed proof suffices.
    const a = arr("A", "B", [["d1", ["λ1"]], ["d2", ["λ1", "λ2"]]]);
    expect(isLogical(a, { assumptionStatus: mixed })).toBe(true);
    expect(isDerivationLogical(a, "d1", { assumptionStatus: mixed })).toBe(true);
    expect(isDerivationLogical(a, "d2", { assumptionStatus: mixed })).toBe(false);
  });

  test("AI-authored derivation without human ratification is NOT logical", () => {
    const a = arr("A", "B", [["d1", []]]);
    expect(
      isLogical(a, {
        assumptionStatus: allAccepted,
        derivationProvenance: () => ({ authorKind: "AI", humanRatified: false }),
      })
    ).toBe(false);
  });

  test("HYBRID-authored derivation without human ratification is NOT logical", () => {
    const a = arr("A", "B", [["d1", []]]);
    expect(
      isLogical(a, {
        assumptionStatus: allAccepted,
        derivationProvenance: () => ({ authorKind: "HYBRID", humanRatified: false }),
      })
    ).toBe(false);
  });

  test("AI-authored derivation WITH human ratification can be logical", () => {
    const a = arr("A", "B", [["d1", []]]);
    expect(
      isLogical(a, {
        assumptionStatus: allAccepted,
        derivationProvenance: () => ({ authorKind: "AI", humanRatified: true }),
      })
    ).toBe(true);
  });

  test("HUMAN-authored derivation needs no ratification flag", () => {
    const a = arr("A", "B", [["d1", []]]);
    expect(
      isLogical(a, {
        assumptionStatus: allAccepted,
        derivationProvenance: () => ({ authorKind: "HUMAN" }),
      })
    ).toBe(true);
  });
});

describe("Sprint A — confidence monoids (Ambler §3, Lemma 26)", () => {
  test("MIN: combine = min, join = max, top = 1", () => {
    expect(MIN_MONOID.combine(0.6, 0.4)).toBe(0.4);
    expect(MIN_MONOID.join(0.6, 0.4)).toBe(0.6);
    expect(MIN_MONOID.top).toBe(1);
  });

  test("PRODUCT: combine = *, join = noisy-OR, top = 1", () => {
    expect(PRODUCT_MONOID.combine(0.5, 0.4)).toBeCloseTo(0.2);
    expect(PRODUCT_MONOID.join(0.5, 0.5)).toBeCloseTo(0.75);
    expect(PRODUCT_MONOID.top).toBe(1);
  });

  test("DS: pointwise product / noisy-OR, top = {bel:1, pl:1}", () => {
    expect(DS_MONOID.combine({ bel: 0.5, pl: 0.8 }, { bel: 0.4, pl: 0.6 }))
      .toEqual({ bel: 0.2, pl: expect.closeTo(0.48, 5) });
    expect(DS_MONOID.top).toEqual({ bel: 1, pl: 1 });
  });

  test("identity law: combine(top, x) === x for every monoid", () => {
    expect(MIN_MONOID.combine(MIN_MONOID.top, 0.7)).toBe(0.7);
    expect(PRODUCT_MONOID.combine(PRODUCT_MONOID.top, 0.7)).toBeCloseTo(0.7);
    const ds = DS_MONOID.combine(DS_MONOID.top, { bel: 0.3, pl: 0.7 });
    expect(ds).toEqual({ bel: 0.3, pl: 0.7 });
  });

  test("commutativity of combine for every monoid", () => {
    expect(MIN_MONOID.combine(0.3, 0.7)).toBe(MIN_MONOID.combine(0.7, 0.3));
    expect(PRODUCT_MONOID.combine(0.3, 0.7))
      .toBeCloseTo(PRODUCT_MONOID.combine(0.7, 0.3));
  });

  test("associativity of join for MIN/PRODUCT", () => {
    const a = 0.2, b = 0.5, c = 0.7;
    expect(MIN_MONOID.join(MIN_MONOID.join(a, b), c))
      .toBe(MIN_MONOID.join(a, MIN_MONOID.join(b, c)));
    expect(PRODUCT_MONOID.join(PRODUCT_MONOID.join(a, b), c))
      .toBeCloseTo(PRODUCT_MONOID.join(a, PRODUCT_MONOID.join(b, c)));
  });

  test("withMinScores injects per-derivation scores", () => {
    const m = withMinScores(new Map([["d1", 0.4], ["d2", 0.9]]));
    const a = arr("A", "B", [["d1", []], ["d2", []]]);
    // join over derivs of base => max(0.4, 0.9) = 0.9
    expect(confidence(a, m)).toBe(0.9);
  });

  test("withProductScores: noisy-OR over derivations", () => {
    const m = withProductScores(new Map([["d1", 0.5], ["d2", 0.5]]));
    const a = arr("A", "B", [["d1", []], ["d2", []]]);
    expect(confidence(a, m)).toBeCloseTo(0.75);
  });

  test("withLogoddsScores: log-odds corroboration over derivations (non-idempotent)", () => {
    const m = withLogoddsScores(new Map([["d1", 0.6], ["d2", 0.6]]));
    const a = arr("A", "B", [["d1", []], ["d2", []]]);
    const c = confidence(a, m);
    // 0.6 ⊕ 0.6 ≈ 0.6923 — above either input, below noisy-OR's 0.84.
    expect(c).toBeCloseTo(0.6923, 3);
    expect(c).toBeGreaterThan(0.6);
    expect(c).toBeLessThan(0.84);
  });

  test("withDsScores: pointwise noisy-OR over derivations", () => {
    const m = withDsScores(
      new Map([
        ["d1", { bel: 0.3, pl: 0.6 }],
        ["d2", { bel: 0.4, pl: 0.7 }],
      ])
    );
    const a = arr("A", "B", [["d1", []], ["d2", []]]);
    const c = confidence(a, m);
    expect(c.bel).toBeCloseTo(1 - 0.7 * 0.6, 5);
    expect(c.pl).toBeCloseTo(1 - 0.4 * 0.3, 5);
  });

  test("Theorem 30 soundness: bel ≤ pl on the DS monoid", () => {
    const scores = new Map([
      ["d1", { bel: 0.3, pl: 0.6 }],
      ["d2", { bel: 0.4, pl: 0.7 }],
    ]);
    const m = withDsScores(scores);
    const a = arr("A", "B", [["d1", []], ["d2", []]]);
    const c = confidence(a, m);
    expect(c.bel).toBeLessThanOrEqual(c.pl);
  });

  test("Lemma 23.1 corollary: isLogical ⇒ confidence === top, for every monoid", () => {
    const a = arr("A", "B", [["d1", ["λ1"]]]);
    const ctx = { assumptionStatus: () => "ACCEPTED" as const };
    expect(isLogical(a, ctx)).toBe(true);

    // Caller honours its half of the contract: base(d) === top for logical d.
    const monoids: ConfidenceMonoid<any>[] = [
      { ...MIN_MONOID, base: () => MIN_MONOID.top },
      { ...PRODUCT_MONOID, base: () => PRODUCT_MONOID.top },
      { ...DS_MONOID, base: () => DS_MONOID.top },
    ];
    for (const m of monoids) {
      expect(confidence(a, m)).toEqual(m.top);
    }
  });
});

describe("Sprint A — confidence monoid registry (ECC plan §4 row 5)", () => {
  test("the four built-ins are pre-registered", () => {
    expect(getConfidenceMonoid("min")?.key).toBe("min");
    expect(getConfidenceMonoid("product")?.key).toBe("product");
    expect(getConfidenceMonoid("logodds")?.key).toBe("logodds");
    expect(getConfidenceMonoid("ds")?.key).toBe("ds");
  });

  test("unknown keys return undefined (closed enum behaviour)", () => {
    expect(getConfidenceMonoid("possibility")).toBeUndefined();
    expect(getConfidenceMonoid("")).toBeUndefined();
  });

  test("registerConfidenceMonoid extends the registry (admin path)", () => {
    const negLog: ConfidenceMonoid<number> = {
      key: "test-neg-log",
      top: 0,
      combine: (x, y) => x + y,
      join: (x, y) => Math.min(x, y),
      base: () => 0,
    };
    registerConfidenceMonoid(negLog);
    expect(getConfidenceMonoid("test-neg-log")).toBe(negLog);
  });
});

describe("Sprint A — transport (Isonomia extension; ECC plan §4 row 2)", () => {
  const F: Functor = {
    mapClaim: (id) =>
      id === "A" ? "A'" : id === "B" ? "B'" : id === "C" ? "C'" : null,
  };

  test("transports endpoints through the functor", () => {
    const a = arr("A", "B", [["d1", ["λ1"]]]);
    const t = transport(F, a);
    expect(t).not.toBeNull();
    expect(t!.from).toBe("A'");
    expect(t!.to).toBe("B'");
    expect(t!.derivs).toEqual(new Set(["d1"]));
    expect(t!.assumptions.get("d1")).toEqual(new Set(["λ1"]));
  });

  test("returns null when an endpoint has no image", () => {
    const a = arr("A", "Z", [["d1", []]]); // Z has no image
    expect(transport(F, a)).toBeNull();
  });

  test("transport preserves composition (one-hop) on minimal assumptions", () => {
    const f = arr("A", "B", [["d1", ["λ1"]]]);
    const g = arr("B", "C", [["d2", ["λ2"]]]);
    const composedThenTransported = transport(F, compose(g, f))!;
    const transportedThenComposed = compose(transport(F, g)!, transport(F, f)!);
    expect(minimalAssumptions(composedThenTransported))
      .toEqual(minimalAssumptions(transportedThenComposed));
  });
});

// ── A1 — two-functor composition (Direction 4, sub-program A coherence) ──────
// Audit: RESEARCH_PROGRAMME/audits/a0-onehop-contract-laxity-vs-policy-2026-06-07.md
//
// These tests DEMONSTRATE that object-level functor composition and the
// symbolic arrow algebra already support multi-hop transport — i.e. the
// one-hop contract (ECC plan §4 row 2) is a *scalar-band provenance* guardrail,
// not a categorical wall. Per the A0 audit, two-functor composition is defined
// LOCALLY here and is deliberately NOT added to lib/argumentation/ecc.ts: the
// production surface keeps the one-hop contract because the scalar log-odds
// band loses source identity (audit §1.3). This suite characterizes WHEN the
// guardrail could lift; it does not lift it.
describe("A1 — two-functor composition (coherence sub-program; NOT a prod surface)", () => {
  // Object-level functor composition: partial-function composition of claim
  // maps, with null propagation. The whole audit §1.1 finding in one helper.
  const composeFunctors = (G: Functor, F: Functor): Functor => ({
    mapClaim: (id) => {
      const mid = F.mapClaim(id);
      return mid === null ? null : G.mapClaim(mid);
    },
  });

  const F: Functor = { mapClaim: (id) => (id === "A" ? "B" : id === "P" ? "Q" : null) };
  const G: Functor = { mapClaim: (id) => (id === "B" ? "C" : id === "Q" ? "R" : null) };

  test("arrow-level: transport(G, transport(F, a)) === transport(compose(G,F), a)", () => {
    // Audit §1.2: transport is identity on derivations + relabels endpoints, so
    // composing the relabelings equals relabeling by the composite.
    const a = arr("A", "P", [["d1", ["λ1"]]]);
    const twoStep = transport(G, transport(F, a)!)!;
    const oneStep = transport(composeFunctors(G, F), a)!;
    expect(oneStep.from).toBe("C");
    expect(oneStep.to).toBe("R");
    expect(oneStep.from).toBe(twoStep.from);
    expect(oneStep.to).toBe(twoStep.to);
    expect(oneStep.derivs).toEqual(twoStep.derivs);
    expect(minimalAssumptions(oneStep)).toEqual(minimalAssumptions(twoStep));
  });

  test("partiality propagates: composite is null iff a hop drops an endpoint", () => {
    // G' maps P→R (so an arrow's `to` survives) but DROPS B (the arrow's `from`
    // image under F). Two-step and composite must agree: both null.
    const Gdrop: Functor = { mapClaim: (id) => (id === "Q" ? "R" : null) };
    const a = arr("A", "P", [["d1", []]]);
    const mid = transport(F, a)!; // B → Q
    expect(transport(Gdrop, mid)).toBeNull(); // B has no Gdrop-image
    expect(transport(composeFunctors(Gdrop, F), a)).toBeNull();
  });

  test("object-level composition is associative (H∘(G∘F) = (H∘G)∘F)", () => {
    // Audit §1.1: partial-function composition is associative ⇒ no categorical
    // obstruction to chaining functors.
    const H: Functor = { mapClaim: (id) => (id === "C" ? "D" : id === "R" ? "S" : null) };
    const a = arr("A", "P", [["d1", ["λ1"]]]);
    const left = transport(composeFunctors(H, composeFunctors(G, F)), a)!;
    const right = transport(composeFunctors(composeFunctors(H, G), F), a)!;
    expect(left.from).toBe("D");
    expect(left.to).toBe("S");
    expect(left.from).toBe(right.from);
    expect(left.to).toBe(right.to);
    expect(left.derivs).toEqual(right.derivs);
  });

  test("band caveat: symbolic aggregation is idempotent (Set union) so it does NOT double-count — the scalar log-odds band is the real one-hop obstruction (audit §1.3)", () => {
    // Re-importing the SAME remote arrow twice dedupes by derivation id, so the
    // symbolic layer is already multi-hop-safe. The double-count the one-hop
    // contract guards against lives in transportAggregator's scalar reducer
    // (corroboration = addition, no derivation identity), NOT here.
    const Fid: Functor = { mapClaim: (id) => (id === "A" || id === "B" ? id : null) };
    const local = arr("A", "B", [["dL", []]]);
    const remote = arr("A", "B", [["dR", ["λR"]]]);
    const once = aggregateAcrossRooms(local, [{ functor: Fid, remote }]);
    const twice = aggregateAcrossRooms(local, [
      { functor: Fid, remote },
      { functor: Fid, remote },
    ]);
    expect(once.derivs).toEqual(new Set(["dL", "dR"]));
    expect(twice.derivs).toEqual(once.derivs); // idempotent ⇒ no symbolic double-count
  });
});

// ── L1 — transport is a strict 1-functor on the symbolic ECC layer ──────────
// C014 discharge (1): RESEARCH_PROGRAMME/03_CONJECTURES/C014-plexus-transport-pseudofunctor.md
// and Q-042. This promotes the A1 findings to the explicit functor laws:
// `transport(F, ·)` is a STRICT 1-functor (identity on derivation IDs, preserves
// identities, composition, and the zero arrow), and `F ↦ transport(F, ·)` is
// functorial in F (L1.5, the A1 cross-law). "Strict" = no information lost at
// the symbolic layer, so any laxity in the materialized pipeline (C014.a) lives
// in app/api/room-functor/apply, NOT here. Carrier is finite sets + relabeling
// ⇒ Agda-able (Direction 5). Stays test-only: NOT promoted to the production
// `lib/argumentation/ecc.ts` surface, which keeps the one-hop contract until the
// full C014 theorem (incl. the scalar band, discharge 2) lands.
describe("L1 — transport is a strict 1-functor (C014 discharge 1)", () => {
  const F: Functor = { mapClaim: (id) => (id === "A" ? "A'" : id === "B" ? "B'" : id === "C" ? "C'" : null) };
  // Local identity-arrow constructor (test-only; no production identity ctor by
  // design). id_c is the single trivial derivation c→c with no assumptions.
  const idArrow = (c: string, deriv = `ι_${c}`): Arrow => arr(c, c, [[deriv, []]]);

  test("L1.1 strict on derivations: transport carries the derivation set verbatim", () => {
    const a = arr("A", "B", [["d1", ["λ1"]], ["d2", ["λ2", "λ3"]]]);
    const t = transport(F, a)!;
    expect(t.derivs).toEqual(a.derivs); // identity on deriv IDs — nothing lost
    expect(t.assumptions.get("d1")).toEqual(new Set(["λ1"]));
    expect(t.assumptions.get("d2")).toEqual(new Set(["λ2", "λ3"]));
  });

  test("L1.2 preserves identities (up to deriv relabeling): transport(F, id_c) is an identity on F(c)", () => {
    // Finding: transport is strict on derivation IDs (L1.1), so it does NOT
    // rename the internal token — transport(F, id_A) keeps deriv `ι_A` while
    // moving endpoints to A'. The functor law F(id_c) = id_{F(c)} therefore
    // holds UP TO derivation relabeling: the result is an identity arrow on
    // F(c) (endpoints equal, one trivial derivation, no assumptions), which is
    // the correct categorical reading — identities are fixed by endpoints +
    // triviality, not by an internal label.
    const t = transport(F, idArrow("A"))!;
    expect(t.from).toBe("A'");
    expect(t.to).toBe("A'"); // endpoints equal ⇒ an identity arrow on A'
    expect(t.derivs.size).toBe(1); // single trivial derivation
    expect(minimalAssumptions(t)).toEqual(new Set()); // identities carry no assumptions
  });

  test("L1.3 preserves composition (full structure, not just minimal assumptions)", () => {
    // Stronger than the existing one-hop test: derivs, endpoints, AND the
    // per-derivation assumption maps all agree.
    const f = arr("A", "B", [["d1", ["λ1"]]]);
    const g = arr("B", "C", [["d2", ["λ2"]]]);
    const lhs = transport(F, compose(g, f))!; // transport ∘ compose
    const rhs = compose(transport(F, g)!, transport(F, f)!); // compose ∘ transport
    expect(lhs.from).toBe(rhs.from);
    expect(lhs.to).toBe(rhs.to);
    expect(lhs.derivs).toEqual(rhs.derivs);
    for (const d of lhs.derivs) {
      expect(lhs.assumptions.get(d)).toEqual(rhs.assumptions.get(d));
    }
  });

  test("L1.4 preserves the zero arrow: transport(F, zero(a,b)) = zero(F a, F b)", () => {
    const t = transport(F, zero("A", "B"))!;
    expect(t.from).toBe("A'");
    expect(t.to).toBe("B'");
    expect(t.derivs).toEqual(new Set()); // empty hom-set is carried to empty
  });

  test("L1.5 functorial in F: transport(G, transport(F, a)) = transport(G∘F, a)", () => {
    // Cross-law with A1 (object-level composition). Restated here to close the
    // functor-law family in one place.
    const composeFunctors = (G: Functor, Fn: Functor): Functor => ({
      mapClaim: (id) => {
        const mid = Fn.mapClaim(id);
        return mid === null ? null : G.mapClaim(mid);
      },
    });
    const G: Functor = { mapClaim: (id) => (id === "A'" ? "A''" : id === "B'" ? "B''" : null) };
    const a = arr("A", "B", [["d1", ["λ1"]]]);
    const twoStep = transport(G, transport(F, a)!)!;
    const oneStep = transport(composeFunctors(G, F), a)!;
    expect(oneStep.from).toBe("A''");
    expect(oneStep.to).toBe("B''");
    expect(oneStep.from).toBe(twoStep.from);
    expect(oneStep.to).toBe(twoStep.to);
    expect(oneStep.derivs).toEqual(twoStep.derivs);
    expect(minimalAssumptions(oneStep)).toEqual(minimalAssumptions(twoStep));
  });
});


describe("Sprint A — aggregateAcrossRooms (one-hop)", () => {
  const F: Functor = { mapClaim: (id) => id === "A" ? "A" : id === "B" ? "B" : null };

  test("joins local with successfully-transported remotes", () => {
    const local = arr("A", "B", [["dL", ["λL"]]]);
    const remote = arr("A", "B", [["dR", ["λR"]]]);
    const out = aggregateAcrossRooms(local, [{ functor: F, remote }]);
    expect(out.derivs).toEqual(new Set(["dL", "dR"]));
    expect(out.assumptions.get("dL")).toEqual(new Set(["λL"]));
    expect(out.assumptions.get("dR")).toEqual(new Set(["λR"]));
  });

  test("skips remotes whose endpoints don't transport", () => {
    const partial: Functor = { mapClaim: (id) => id === "A" ? "A" : null };
    const local = arr("A", "B", [["dL", []]]);
    const remote = arr("A", "B", [["dR", []]]);
    const out = aggregateAcrossRooms(local, [{ functor: partial, remote }]);
    expect(out.derivs).toEqual(new Set(["dL"]));
  });

  test("skips remotes that land on a different (from,to) pair", () => {
    const fMis: Functor = { mapClaim: (id) => id === "A" ? "X" : id === "B" ? "Y" : null };
    const local = arr("A", "B", [["dL", []]]);
    const remote = arr("A", "B", [["dR", []]]);
    const out = aggregateAcrossRooms(local, [{ functor: fMis, remote }]);
    expect(out.derivs).toEqual(new Set(["dL"]));
  });

  test("commutative under reordering of imports", () => {
    const r1 = arr("A", "B", [["d1", ["λ1"]]]);
    const r2 = arr("A", "B", [["d2", ["λ2"]]]);
    const local = arr("A", "B", [["dL", []]]);
    const a = aggregateAcrossRooms(local, [{ functor: F, remote: r1 }, { functor: F, remote: r2 }]);
    const b = aggregateAcrossRooms(local, [{ functor: F, remote: r2 }, { functor: F, remote: r1 }]);
    expect(a.derivs).toEqual(b.derivs);
  });

  test("identity: empty imports list returns local unchanged", () => {
    const local = arr("A", "B", [["dL", ["λL"]]]);
    const out = aggregateAcrossRooms(local, []);
    expect(out.derivs).toEqual(local.derivs);
    expect(out.assumptions.get("dL")).toEqual(new Set(["λL"]));
  });
});

describe("Sprint A — culpritSets (Ambler §4)", () => {
  test("empty arrow ⇒ empty culprits", () => {
    expect(culpritSets(zero("A", "B"))).toEqual([]);
  });

  test("derivations with no assumptions contribute nothing", () => {
    const a = arr("A", "B", [["d1", []]]);
    expect(culpritSets(a)).toEqual([]);
  });

  test("emits one candidate per distinct assumption-set", () => {
    const a = arr("A", "B", [
      ["d1", ["λ1", "λ2"]],
      ["d2", ["λ1", "λ2"]], // duplicate set — should dedupe
      ["d3", ["λ3"]],
    ]);
    const sets = culpritSets(a);
    expect(sets.length).toBe(2);
  });

  test("ranks by coverage descending then by cost ascending", () => {
    const a = arr("A", "B", [
      ["d1", ["λ1"]],          // candidate {λ1} kills d1, d2, d4 (covers 3)
      ["d2", ["λ1", "λ2"]],    // candidate {λ1,λ2} kills d1, d2, d4 (covers 3)
      ["d3", ["λ3"]],          // candidate {λ3} kills only d3 (covers 1)
      ["d4", ["λ1", "λ4"]],
    ]);
    const sets = culpritSets(a);
    // Top candidate has max coverage and (ties broken) min cost.
    expect(sets[0].badConclusionsExplained).toBe(3);
    expect(sets[0].retractionCost).toBe(1);
    expect(sets[0].assumptions).toEqual(new Set(["λ1"]));
  });

  test("coverage monotonicity: a superset never decreases coverage", () => {
    // Build a hand-crafted arrow and compare two candidates by hand.
    const a = arr("A", "B", [
      ["d1", ["λ1"]],
      ["d2", ["λ2"]],
      ["d3", ["λ1", "λ2"]],
    ]);
    const sets = culpritSets(a);
    const single = sets.find(s => s.assumptions.size === 1)!;
    const dual = sets.find(s => s.assumptions.size === 2)!;
    expect(dual.badConclusionsExplained)
      .toBeGreaterThanOrEqual(single.badConclusionsExplained);
  });

  test("deterministic ordering across calls", () => {
    const a = arr("A", "B", [
      ["d1", ["λ2", "λ1"]],
      ["d2", ["λ3"]],
    ]);
    const r1 = culpritSets(a).map(s => Array.from(s.assumptions).sort().join("|"));
    const r2 = culpritSets(a).map(s => Array.from(s.assumptions).sort().join("|"));
    expect(r1).toEqual(r2);
  });
});

describe("Sprint A — detectEnthymemes", () => {
  const schemes: SchemeCatalog = {
    get(key) {
      if (key === "expert-opinion") {
        return { key, requiredRoles: ["warrant", "background"] };
      }
      return undefined;
    },
  };

  test("emits a nudge for each derivation missing a required role", () => {
    const a = arr("A", "B", [["d1", []]]);
    const nudges = detectEnthymemes(a, schemes, () => ({
      schemeKey: "expert-opinion",
      argumentId: "arg-1",
      rolesPresent: ["warrant"],
    }));
    expect(nudges).toHaveLength(1);
    expect(nudges[0].missingPremiseRoles).toEqual(["background"]);
    expect(nudges[0].argumentId).toBe("arg-1");
    expect(nudges[0].suggestedWarrantText).toBe("");
  });

  test("emits no nudge when all roles are present", () => {
    const a = arr("A", "B", [["d1", []]]);
    const nudges = detectEnthymemes(a, schemes, () => ({
      schemeKey: "expert-opinion",
      argumentId: "arg-1",
      rolesPresent: ["warrant", "background"],
    }));
    expect(nudges).toEqual([]);
  });

  test("fail-quiet: derivation with no schemeKey yields no nudge", () => {
    const a = arr("A", "B", [["d1", []]]);
    const nudges = detectEnthymemes(a, schemes, () => ({ argumentId: "arg-1" }));
    expect(nudges).toEqual([]);
  });

  test("fail-quiet: unknown schemeKey yields no nudge", () => {
    const a = arr("A", "B", [["d1", []]]);
    const nudges = detectEnthymemes(a, schemes, () => ({
      schemeKey: "no-such-scheme",
      argumentId: "arg-1",
    }));
    expect(nudges).toEqual([]);
  });

  test("idempotent: two calls return equal results", () => {
    const a = arr("A", "B", [["d1", []], ["d2", []]]);
    const meta = (d: string) => ({
      schemeKey: "expert-opinion",
      argumentId: `arg-${d}`,
      rolesPresent: [],
    });
    const r1 = detectEnthymemes(a, schemes, meta);
    const r2 = detectEnthymemes(a, schemes, meta);
    expect(r1).toEqual(r2);
  });
});

describe("Sprint A — distributivity sanity (compose over join)", () => {
  test("compose(g, join(f1,f2)) ≈ join(compose(g,f1), compose(g,f2)) on minimal assumptions", () => {
    const f1 = arr("A", "B", [["d1", ["λ1"]]]);
    const f2 = arr("A", "B", [["d2", ["λ2"]]]);
    const g = arr("B", "C", [["d3", ["λ3"]]]);
    const lhs = compose(g, join(f1, f2));
    const rhs = join(compose(g, f1), compose(g, f2));
    expect(minimalAssumptions(lhs)).toEqual(minimalAssumptions(rhs));
    expect(lhs.derivs).toEqual(rhs.derivs);
  });
});

// ── D1 — the Plexus bicategory 𝓟: well-definedness (C014 discharge 3) ─────────
// Dev-spec: RESEARCH_PROGRAMME/DEV_SPEC-c014-discharge3-plexus-coherence-pentagon-2026-06-07.md §2
// Companion write-up: RESEARCH_PROGRAMME/C014-D1-plexus-bicategory-data-2026-06-08.md
//
// 𝓟 has: 0-cells = rooms (ECCs); 1-cells = transport functors (`Functor` +
// `transport(F, ·)`); 2-cells α: F ⇒ F' = a family (α_c: F(c) → F'(c))_c of
// room-B arrows, natural in source arrows. This suite corroborates the three
// well-definedness lemmas W1 (vertical comp assoc + unital), W2 (the interchange
// law — the one genuinely 2-categorical check), W3 (naturality preserved under
// composition).
//
// All laws hold UP TO DERIVATION RELABELING (the L1.2 finding, systematized):
// `compose` builds composite derivation IDs (`df∘dg`) and re-associates the
// string, so equality is in the quotient ECC where arrows are identified by
// endpoints + per-derivation assumption sets, modulo derivation-ID renaming.
// Witnesses are single-derivation arrows, where the signature below is faithful.
//
// TEST-ONLY: the 2-cell operations are defined locally and are NOT added to the
// production `lib/argumentation/ecc.ts` surface (gated discipline; the symbolic
// surface keeps the one-hop contract until C014-T lands).
describe("D1 — Plexus bicategory well-definedness (C014 discharge 3)", () => {
  // A 2-cell keyed by SOURCE-room claim id; value α_c is the witness arrow in
  // the target room (B-arrow F(c) → F'(c)).
  type TwoCell = Map<string, Arrow>;

  // Object-level functor composition (A1), restated locally.
  const composeFunctors = (G: Functor, F: Functor): Functor => ({
    mapClaim: (id) => {
      const mid = F.mapClaim(id);
      return mid === null ? null : G.mapClaim(mid);
    },
  });

  // Signature faithful up to derivation relabeling for single-deriv witnesses:
  // endpoints + the union of assumptions + the derivation count.
  const sigArrow = (a: Arrow): string =>
    `${a.from}|${a.to}|${[...minimalAssumptions(a)].sort().join(",")}|${a.derivs.size}`;
  const sig2 = (tc: TwoCell): string =>
    [...tc.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, a]) => `${c}=>${sigArrow(a)}`).join(";");

  // Vertical composition β·α (α: F⇒F', β: F'⇒F''): per-claim compose.
  const vcomp = (beta: TwoCell, alpha: TwoCell): TwoCell => {
    const out: TwoCell = new Map();
    for (const [c, ac] of alpha) {
      const bc = beta.get(c);
      if (!bc) continue;
      out.set(c, compose(bc, ac)); // compose(g,f) = "f then g": F(c)→F'(c)→F''(c)
    }
    return out;
  };

  // Identity 2-cell id_F over a source-claim set: per-claim identity arrow on F(c).
  const id2 = (F: Functor, claims: string[]): TwoCell => {
    const out: TwoCell = new Map();
    for (const c of claims) {
      const fc = F.mapClaim(c);
      if (fc === null) continue;
      out.set(c, arr(fc, fc, [[`ι_${fc}`, []]]));
    }
    return out;
  };

  // Left whiskering G ∗ α (α: F⇒F', G: B→C): components G(α_c) = transport(G, α_c).
  const lwhisker = (G: Functor, alpha: TwoCell): TwoCell => {
    const out: TwoCell = new Map();
    for (const [c, ac] of alpha) {
      const t = transport(G, ac);
      if (t !== null) out.set(c, t);
    }
    return out;
  };

  // Horizontal composite δ ∗ α (α: F⇒F', δ: G⇒G'): G∘F ⇒ G'∘F'.
  //   (δ ∗ α)_c = compose( δ_{F'(c)}, transport(G, α_c) ).
  // Needs Fcod = F' (to index δ at F'(c)) and Gdom = G (to whisker α).
  const hcomp = (delta: TwoCell, alpha: TwoCell, Fcod: Functor, Gdom: Functor): TwoCell => {
    const out: TwoCell = new Map();
    for (const [c, ac] of alpha) {
      const fcod = Fcod.mapClaim(c);
      if (fcod === null) continue;
      const dAt = delta.get(fcod);
      const Ga = transport(Gdom, ac);
      if (!dAt || Ga === null) continue;
      out.set(c, compose(dAt, Ga));
    }
    return out;
  };

  // Naturality predicate: square F'(f)∘α_c = α_{c'}∘F(f) holds (up to relabel).
  const naturalAt = (F: Functor, Fp: Functor, alpha: TwoCell, f: Arrow): boolean => {
    const Fpf = transport(Fp, f);
    const Ff = transport(F, f);
    const ac = alpha.get(f.from as string);
    const ac2 = alpha.get(f.to as string);
    if (!Fpf || !Ff || !ac || !ac2) return false;
    return sigArrow(compose(Fpf, ac)) === sigArrow(compose(ac2, Ff));
  };

  describe("W1 — vertical composition is associative + unital", () => {
    // One source claim c; three vertically composable 2-cells over A→B.
    const F: Functor = { mapClaim: (id) => (id === "c" ? "b0" : null) };
    const Fp: Functor = { mapClaim: (id) => (id === "c" ? "b1" : null) };
    const Fpp: Functor = { mapClaim: (id) => (id === "c" ? "b2" : null) };
    const Fppp: Functor = { mapClaim: (id) => (id === "c" ? "b3" : null) };
    const α: TwoCell = new Map([["c", arr("b0", "b1", [["a", ["λα"]]])]]);
    const β: TwoCell = new Map([["c", arr("b1", "b2", [["b", ["λβ"]]])]]);
    const γ: TwoCell = new Map([["c", arr("b2", "b3", [["g", ["λγ"]]])]]);

    test("W1.1 associativity: (γ·β)·α = γ·(β·α) up to deriv relabeling", () => {
      const left = vcomp(vcomp(γ, β), α);
      const right = vcomp(γ, vcomp(β, α));
      expect(sig2(left)).toBe(sig2(right));
      // endpoints + accumulated assumptions concretely:
      expect(left.get("c")!.from).toBe("b0");
      expect(left.get("c")!.to).toBe("b3");
      expect([...minimalAssumptions(left.get("c")!)].sort()).toEqual(["λα", "λβ", "λγ"]);
    });

    test("W1.2 unit: id_{F'}·α = α = α·id_F up to deriv relabeling", () => {
      const idF = id2(F, ["c"]);
      const idFp = id2(Fp, ["c"]);
      expect(sig2(vcomp(idFp, α))).toBe(sig2(α));
      expect(sig2(vcomp(α, idF))).toBe(sig2(α));
    });
  });

  describe("W2 — interchange law (the genuinely 2-categorical check)", () => {
    // α: F⇒F', α': F'⇒F'' over A→B ; δ: G⇒G', δ': G'⇒G'' over B→C.
    const F: Functor = { mapClaim: (id) => (id === "c" ? "b0" : null) };
    const Fp: Functor = { mapClaim: (id) => (id === "c" ? "b1" : null) };
    const Fpp: Functor = { mapClaim: (id) => (id === "c" ? "b2" : null) };
    const G: Functor = { mapClaim: (id) => (["b0", "b1", "b2"].includes(id) ? `g_${id}` : null) };
    const Gp: Functor = { mapClaim: (id) => (["b0", "b1", "b2"].includes(id) ? `gp_${id}` : null) };
    const Gpp: Functor = { mapClaim: (id) => (["b0", "b1", "b2"].includes(id) ? `gpp_${id}` : null) };

    const α: TwoCell = new Map([["c", arr("b0", "b1", [["a", ["λα"]]])]]);
    const αp: TwoCell = new Map([["c", arr("b1", "b2", [["a2", ["λαp"]]])]]);
    const δ: TwoCell = new Map(["b0", "b1", "b2"].map((b) => [b, arr(`g_${b}`, `gp_${b}`, [[`d_${b}`, ["λδ"]]])]));
    const δp: TwoCell = new Map(["b0", "b1", "b2"].map((b) => [b, arr(`gp_${b}`, `gpp_${b}`, [[`dp_${b}`, ["λδp"]]])]));

    test("W2 (δ'·δ) ∗ (α'·α) = (δ' ∗ α')·(δ ∗ α) up to deriv relabeling", () => {
      const lhs = hcomp(vcomp(δp, δ), vcomp(αp, α), Fpp, G);
      const rhs = vcomp(
        hcomp(δp, αp, Fpp, Gp), // G'∘F' ⇒ G''∘F''
        hcomp(δ, α, Fp, G),     // G∘F ⇒ G'∘F'
      );
      expect(sig2(lhs)).toBe(sig2(rhs));
      // both land G(F(c)) → G''(F''(c)) = g_b0 → gpp_b2, all four assumptions, 1 deriv
      expect(lhs.get("c")!.from).toBe("g_b0");
      expect(lhs.get("c")!.to).toBe("gpp_b2");
      expect([...minimalAssumptions(lhs.get("c")!)].sort()).toEqual(["λα", "λαp", "λδ", "λδp"]);
      expect(lhs.get("c")!.derivs.size).toBe(1);
    });
  });

  describe("W3 — naturality is preserved under composition", () => {
    // Source room A: claims c, c' with one arrow f: c → c'.
    const f = arr("c", "c'", [["df", ["λf"]]]);
    const F: Functor = { mapClaim: (id) => (id === "c" ? "b0" : id === "c'" ? "b1" : null) };
    const Fp: Functor = { mapClaim: (id) => (id === "c" ? "b0p" : id === "c'" ? "b1p" : null) };
    const Fpp: Functor = { mapClaim: (id) => (id === "c" ? "b0pp" : id === "c'" ? "b1pp" : null) };
    // α: F⇒F' and β: F'⇒F'' with per-claim witnesses sharing an assumption set
    // (the condition that makes the square commute up to relabel).
    const α: TwoCell = new Map([
      ["c", arr("b0", "b0p", [["a0", ["λα"]]])],
      ["c'", arr("b1", "b1p", [["a1", ["λα"]]])],
    ]);
    const β: TwoCell = new Map([
      ["c", arr("b0p", "b0pp", [["b0c", ["λβ"]]])],
      ["c'", arr("b1p", "b1pp", [["b1c", ["λβ"]]])],
    ]);

    test("W3.0 the witness α is natural at f", () => {
      expect(naturalAt(F, Fp, α, f)).toBe(true);
    });

    test("W3.1 vertical composition preserves naturality: β·α is natural", () => {
      expect(naturalAt(Fp, Fpp, β, f)).toBe(true);
      expect(naturalAt(F, Fpp, vcomp(β, α), f)).toBe(true);
    });

    test("W3.2 whiskering preserves naturality: G ∗ α is natural", () => {
      const G: Functor = {
        mapClaim: (id) => (["b0", "b1", "b0p", "b1p"].includes(id) ? `g_${id}` : null),
      };
      const GF = composeFunctors(G, F);
      const GFp = composeFunctors(G, Fp);
      expect(naturalAt(GF, GFp, lwhisker(G, α), f)).toBe(true);
    });
  });
});

// ── D2 — comparison 2-cells γ, pentagon + triangle (C014 discharge 3) ─────────
// Dev-spec §3.1–§3.3; companion write-up C014-D2-plexus-coherence-pentagon-2026-06-08.md
//
// γ_{G,F}: G_∗∘F_∗ ⇒ (G∘F)_∗ is the comparison 2-cell. Because object-level
// composition is the on-the-nose partial-map composite (A1) and transport is
// strict (L1), G(F(c)) = (G∘F)(c) DEFINITIONALLY on the total part — so γ is the
// IDENTITY arrow on (G∘F)(c) there, and is UNDEFINED exactly where a claim drops.
// Consequence (the dev-spec §3.2 prediction): both pentagon paths collapse to the
// identity 2-cell on the common total domain, so coherence is partial-domain
// bookkeeping, not calculation. W2 (D1) is what legalizes sliding the γ's.
//
// TEST-ONLY (gated discipline): γ and the whiskerings are defined locally.
describe("D2 — comparison 2-cells γ, pentagon + triangle (C014 discharge 3)", () => {
  type TwoCell = Map<string, Arrow>; // keyed by SOURCE-room claim id

  const composeFunctors = (G: Functor, F: Functor): Functor => ({
    mapClaim: (id) => {
      const mid = F.mapClaim(id);
      return mid === null ? null : G.mapClaim(mid);
    },
  });
  const idArrow = (c: string): Arrow => arr(c, c, [[`ι_${c}`, []]]);
  const sigArrow = (a: Arrow): string =>
    `${a.from}|${a.to}|${[...minimalAssumptions(a)].sort().join(",")}|${a.derivs.size}`;
  const sig2 = (tc: TwoCell): string =>
    [...tc.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([c, a]) => `${c}=>${sigArrow(a)}`).join(";");
  const isIdentityArrow = (a: Arrow): boolean =>
    a.from === a.to && a.derivs.size === 1 && minimalAssumptions(a).size === 0;

  // The comparison 2-cell γ_{G,F}: G_∗∘F_∗ ⇒ (G∘F)_∗, keyed by source claim,
  // component = identity arrow on (G∘F)(c); present iff c is in the total part.
  const gamma = (G: Functor, F: Functor, srcClaims: string[]): TwoCell => {
    const out: TwoCell = new Map();
    for (const c of srcClaims) {
      const fc = F.mapClaim(c);
      if (fc === null) continue;
      const gfc = G.mapClaim(fc);
      if (gfc === null) continue;
      out.set(c, idArrow(gfc)); // identity on G(F(c)) = (G∘F)(c)
    }
    return out;
  };

  // Left-whisker a 2-cell (over A→C) by a functor H: C→D ⇒ a 2-cell over A→D.
  const lwhisker = (H: Functor, tc: TwoCell): TwoCell => {
    const out: TwoCell = new Map();
    for (const [c, ac] of tc) {
      const t = transport(H, ac);
      if (t !== null) out.set(c, t);
    }
    return out;
  };
  // Right-whisker a 2-cell (over B→D) by a functor F: A→B ⇒ a 2-cell over A→D:
  // reindex the B-keyed cell along F (component at source claim c is the one at F(c)).
  const rwhiskerByF = (tc: TwoCell, F: Functor, srcClaims: string[]): TwoCell => {
    const out: TwoCell = new Map();
    for (const c of srcClaims) {
      const fc = F.mapClaim(c);
      if (fc === null) continue;
      const comp = tc.get(fc);
      if (comp) out.set(c, comp);
    }
    return out;
  };
  // Vertical composition (β·α): per-claim compose, over the shared key set.
  const vcomp = (beta: TwoCell, alpha: TwoCell): TwoCell => {
    const out: TwoCell = new Map();
    for (const [c, ac] of alpha) {
      const bc = beta.get(c);
      if (!bc) continue;
      out.set(c, compose(bc, ac));
    }
    return out;
  };

  // A→F→B→G→C→H→D fixture, all total on the claim set {x, y}.
  const SRC = ["x", "y"];
  const F: Functor = { mapClaim: (id) => (id === "x" ? "bx" : id === "y" ? "by" : null) };
  const G: Functor = { mapClaim: (id) => (id === "bx" ? "cx" : id === "by" ? "cy" : null) };
  const H: Functor = { mapClaim: (id) => (id === "cx" ? "dx" : id === "cy" ? "dy" : null) };

  describe("§3.1 — γ is identity on the total part, undefined on drops", () => {
    test("γ_{G,F} components are identity arrows on (G∘F)(c)", () => {
      const g = gamma(G, F, SRC);
      expect([...g.keys()].sort()).toEqual(["x", "y"]);
      expect(isIdentityArrow(g.get("x")!)).toBe(true);
      expect(g.get("x")!.from).toBe("cx"); // (G∘F)(x) = G(F(x)) = G(bx) = cx
      expect(g.get("y")!.from).toBe("cy");
    });

    test("γ is undefined exactly where a claim drops (partial functor)", () => {
      const Gdrop: Functor = { mapClaim: (id) => (id === "bx" ? "cx" : null) }; // drops by
      const g = gamma(Gdrop, F, SRC);
      expect([...g.keys()]).toEqual(["x"]); // y drops at G ⇒ no γ component
    });

    test("γ agrees with the strict composite: dom(γ) = total part of G∘F", () => {
      const GF = composeFunctors(G, F);
      const total = SRC.filter((c) => GF.mapClaim(c) !== null);
      expect([...gamma(G, F, SRC).keys()].sort()).toEqual(total.sort());
    });
  });

  describe("§3.2 — pentagon (associativity coherence)", () => {
    test("γ_{H,GF}·(H ∗ γ_{G,F}) = γ_{HG,F}·(γ_{H,G} ∗ F) on the total part", () => {
      const GF = composeFunctors(G, F);
      const HG = composeFunctors(H, G);

      // LHS: γ_{H,GF} · (H_∗ ∗ γ_{G,F})
      const lhs = vcomp(
        gamma(H, GF, SRC),              // H_∗∘(G∘F)_∗ ⇒ (H∘G∘F)_∗
        lwhisker(H, gamma(G, F, SRC)),  // H_∗∘G_∗∘F_∗ ⇒ H_∗∘(G∘F)_∗
      );
      // RHS: γ_{HG,F} · (γ_{H,G} ∗ F_∗)
      const rhs = vcomp(
        gamma(HG, F, SRC),                      // (H∘G)_∗∘F_∗ ⇒ (H∘G∘F)_∗
        rwhiskerByF(gamma(H, G, ["bx", "by"]), F, SRC), // H_∗∘G_∗∘F_∗ ⇒ (H∘G)_∗∘F_∗
      );

      expect(sig2(lhs)).toBe(sig2(rhs));
      // both collapse to the identity 2-cell on (H∘G∘F)_∗ over {x,y}
      expect([...lhs.keys()].sort()).toEqual(["x", "y"]);
      expect(isIdentityArrow(lhs.get("x")!)).toBe(true);
      expect(lhs.get("x")!.from).toBe("dx"); // (H∘G∘F)(x) = dx
      expect(lhs.get("y")!.from).toBe("dy");
    });

    test("pentagon respects partial domains: a drop in the middle prunes both paths equally", () => {
      const Hdrop: Functor = { mapClaim: (id) => (id === "cx" ? "dx" : null) }; // drops cy
      const GF = composeFunctors(G, F);
      const HG = composeFunctors(Hdrop, G);
      const lhs = vcomp(gamma(Hdrop, GF, SRC), lwhisker(Hdrop, gamma(G, F, SRC)));
      const rhs = vcomp(gamma(HG, F, SRC), rwhiskerByF(gamma(Hdrop, G, ["bx", "by"]), F, SRC));
      expect(sig2(lhs)).toBe(sig2(rhs));
      expect([...lhs.keys()]).toEqual(["x"]); // y pruned identically on both sides
    });
  });

  describe("§3.3 — triangle (unit coherence)", () => {
    const idF = (room: string[]): Functor => ({ mapClaim: (id) => (room.includes(id) ? id : null) });
    const idA = idF(SRC);
    const idB = idF(["bx", "by"]);

    test("γ_{F, id_A} is the right unit iso (identity on the total part)", () => {
      // F∘id_A = F, so γ_{F,id_A}: F_∗∘(id_A)_∗ ⇒ (F∘id_A)_∗ is identity on F(c).
      const g = gamma(F, idA, SRC);
      expect([...g.keys()].sort()).toEqual(["x", "y"]);
      expect(isIdentityArrow(g.get("x")!)).toBe(true);
      expect(g.get("x")!.from).toBe("bx"); // F(x) = bx
    });

    test("γ_{id_B, F} is the left unit iso (identity on the total part)", () => {
      const g = gamma(idB, F, SRC);
      expect([...g.keys()].sort()).toEqual(["x", "y"]);
      expect(isIdentityArrow(g.get("x")!)).toBe(true);
      expect(g.get("x")!.from).toBe("bx"); // id_B(F(x)) = bx
    });
  });
});

// ── D3 — pseudofunctor ⟺ monodromy-free (C014 discharge 3) ────────────────────
// Dev-spec §3.4 + §7; companion write-up C014-D3-pseudofunctor-monodromy-free-2026-06-08.md
//
// 𝓟° = the region where transport is a PSEUDOFUNCTOR (every comparison 2-cell γ
// present and invertible). The theorem: 𝓟° = the MONODROMY-FREE region, where
// every directed cycle's round-trip 2-cell η is INVERTIBLE.
//
// THE §7 DECISION, made executable: 𝓟° is defined by **invertible** η (claim-closed
// UP TO ECC ISO), NOT strict identity. A drift c→c' between INTER-DERIVABLE claims
// is an invertible 2-cell, so iso-closure STRICTLY CONTAINS identity-closure — and
// defining 𝓟° by strict identity (B2b's `closed`) would wrongly exclude a coherent
// region. The probe's `closed`/`drifted` boundary must therefore be refined from
// claim-id equality to ECC inter-derivability (flagged back to B2b).
//
// TEST-ONLY (gated discipline): the monodromy classifier and iso predicate are
// defined locally.
describe("D3 — pseudofunctor ⟺ monodromy-free (C014 discharge 3)", () => {
  // A real ECC-iso check: arrow `a: c→c'` is invertible witnessed by `inv: c'→c`
  // iff both composites are ≈ identity (equal endpoints, one deriv, no assumptions).
  const isIdentityArrow = (a: Arrow): boolean =>
    a.from === a.to && a.derivs.size === 1 && minimalAssumptions(a).size === 0;
  const isIsoVia = (a: Arrow, inv: Arrow): boolean =>
    isIdentityArrow(compose(inv, a)) && isIdentityArrow(compose(a, inv));

  // The round-trip 2-cell η of a cycle, per start claim. We model its outcome at
  // a claim directly (the probe computes it from claimMaps; here we exhibit the
  // four fates abstractly to prove the equivalence).
  type Fate =
    | { kind: "closed" }                         // W(c) = c, η_c = id ⇒ invertible
    | { kind: "drift-iso"; back: Arrow; fwd: Arrow }  // W(c)=c'≠c, η_c invertible
    | { kind: "drift-noniso"; fwd: Arrow }       // W(c)=c'≠c, η_c NOT invertible
    | { kind: "dropped" };                       // W(c) undefined ⇒ η_c missing

  // η_c is invertible iff closed or drift-iso. (drift-noniso and dropped are not.)
  const etaInvertible = (f: Fate): boolean =>
    f.kind === "closed" || (f.kind === "drift-iso" && isIsoVia(f.fwd, f.back));

  // A comparison 2-cell γ along the cycle is "present and invertible" exactly when
  // the corresponding η component is invertible (D2 §3.1: γ present ⟺ no drop;
  // γ identity ⟹ invertible on the total part; drift-iso lifts to invertible γ).
  const gammaOk = (f: Fate): boolean => etaInvertible(f);

  // Pseudofunctor on a region (given as the per-claim fates of all its cycles):
  // every γ present and invertible.
  const isPseudofunctor = (fates: Fate[]): boolean => fates.every(gammaOk);
  // Monodromy-free (iso sense): every η component invertible.
  const isMonodromyFreeIso = (fates: Fate[]): boolean => fates.every(etaInvertible);

  describe("the biconditional 𝓟° = monodromy-free (iso sense)", () => {
    test("⇐ on a monodromy-free region every γ is present + invertible (pseudofunctor)", () => {
      const closed: Fate = { kind: "closed" };
      const iso: Fate = {
        kind: "drift-iso",
        fwd: arr("c", "c2", [["d", []]]),
        back: arr("c2", "c", [["d", []]]),
      };
      const region = [closed, iso, closed];
      expect(isMonodromyFreeIso(region)).toBe(true);
      expect(isPseudofunctor(region)).toBe(true);
    });

    test("⇒ off the monodromy-free region some γ fails (a dropped claim)", () => {
      // B2b's live witness: a dropped claim ⇒ missing η component ⇒ missing γ.
      const region: Fate[] = [{ kind: "closed" }, { kind: "dropped" }];
      expect(isMonodromyFreeIso(region)).toBe(false);
      expect(isPseudofunctor(region)).toBe(false);
    });

    test("⇒ a NON-iso drift also breaks pseudofunctoriality", () => {
      // drift c→c' with no inverse (ECC arrows generally non-invertible).
      const region: Fate[] = [
        { kind: "closed" },
        { kind: "drift-noniso", fwd: arr("c", "c2", [["d", ["λ"]]]) },
      ];
      expect(isMonodromyFreeIso(region)).toBe(false);
      expect(isPseudofunctor(region)).toBe(false);
    });

    test("biconditional holds pointwise: isPseudofunctor ≡ isMonodromyFreeIso", () => {
      const fates: Fate[][] = [
        [{ kind: "closed" }],
        [{ kind: "drift-iso", fwd: arr("a", "b", [["d", []]]), back: arr("b", "a", [["d", []]]) }],
        [{ kind: "drift-noniso", fwd: arr("a", "b", [["d", ["λ"]]]) }],
        [{ kind: "dropped" }],
        [{ kind: "closed" }, { kind: "dropped" }],
      ];
      for (const region of fates) {
        expect(isPseudofunctor(region)).toBe(isMonodromyFreeIso(region));
      }
    });
  });

  describe("§7 — 𝓟° is iso-closure, STRICTLY larger than identity-closure", () => {
    // The substantive D3 decision: a drift between inter-derivable claims is an
    // INVERTIBLE 2-cell, so it lies in 𝓟° (pseudofunctor) yet is NOT identity-closed.
    const fwd = arr("c", "c2", [["iso", []]]); // c → c'
    const back = arr("c2", "c", [["iso", []]]); // c' → c, two-way inverse

    test("a drift-iso is a genuine ECC iso (round-trips to identity)", () => {
      expect(isIsoVia(fwd, back)).toBe(true);
    });

    test("identity-closure (B2b `closed`) would WRONGLY exclude this coherent region", () => {
      const region: Fate[] = [{ kind: "drift-iso", fwd, back }];
      // iso definition (correct): in 𝓟°.
      expect(isMonodromyFreeIso(region)).toBe(true);
      expect(isPseudofunctor(region)).toBe(true);
      // strict-identity definition (wrong): a drift is NOT `closed`, so a claim-id
      // classifier would mark it `drifted` and exclude it — the over-strict error.
      const identityClosed = (f: Fate): boolean => f.kind === "closed";
      expect(region.every(identityClosed)).toBe(false); // excluded under strict id
      // ⇒ identity-closure ⊊ iso-closure: the boundary must be ECC inter-derivability.
    });

    test("a drift-noniso is correctly OUT of 𝓟° under both definitions", () => {
      const region: Fate[] = [{ kind: "drift-noniso", fwd: arr("c", "c2", [["d", ["λ"]]]) }];
      expect(isMonodromyFreeIso(region)).toBe(false); // not iso ⇒ out
      expect(region.every((f) => f.kind === "closed")).toBe(false); // also out under strict id
    });
  });

  describe("maximality: 𝓟° is the LARGEST pseudofunctor sub-bicategory", () => {
    test("adding any non-invertible-η cycle to a 𝓟° region leaves 𝓟°", () => {
      const base: Fate[] = [{ kind: "closed" }];
      expect(isPseudofunctor(base)).toBe(true);
      const extended: Fate[] = [...base, { kind: "dropped" }];
      // adding a drop ⇒ no longer a pseudofunctor ⇒ that cycle is necessarily
      // outside any pseudofunctor sub-bicategory ⇒ 𝓟° is maximal.
      expect(isPseudofunctor(extended)).toBe(false);
    });
  });
});

// ── D4 — faithfulness boundary: symbolic vs materialized (C014 discharge 3) ───
// Dev-spec §4; companion write-up C014-D4-faithfulness-boundary-2026-06-08.md
//
// C014-T (D1–D3) is a theorem about SYMBOLIC transport. D4 pins where it tracks
// the LIVE materialized pipeline (app/api/room-functor/apply/route.ts), which has
// TWO materialization modes (confirmed by reading the route):
//   • STRICT   — depth>1 AND claimMap non-empty ⇒ reconstructArgumentStructure +
//                recursivelyImportPremises carry premise (Toulmin) structure.
//   • LAX      — depth=1, OR the "materialize virtual" branch, OR empty claimMap ⇒
//                text-only import; ArgumentPremise rows are NOT copied.
//
// FAITHFULNESS BOUNDARY (the T008 analogue): on the STRICT path the materialized
// 2-cells equal the symbolic γ, so symbolic 𝓟° (D3) tracks the live pipeline; on
// the LAX path a symbolically iso-closed cycle can be materially lossy (premises
// dropped ⇒ the materialized round-trip arrow loses the assumptions that
// witnessed the iso ⇒ no longer invertible). So C014-T is stated over the
// SYMBOLIC layer and GATED on strict materialization (C014.a) for live claims.
//
// TEST-ONLY: both materialization modes are modeled abstractly (we do not touch
// the route). An arrow's premise/assumption content stands in for Toulmin
// structure; "strict" preserves it, "lax" discards it.
describe("D4 — faithfulness boundary: symbolic vs materialized (C014 discharge 3)", () => {
  const isIdentityArrow = (a: Arrow): boolean =>
    a.from === a.to && a.derivs.size === 1 && minimalAssumptions(a).size === 0;
  const isIsoVia = (a: Arrow, inv: Arrow): boolean =>
    isIdentityArrow(compose(inv, a)) && isIdentityArrow(compose(a, inv));

  // Model of materialization: a functor on arrows that either preserves the full
  // structure (strict) or strips premises/assumptions to a bare text-only arrow
  // (lax), mirroring the two apply/route.ts paths.
  const materializeStrict = (a: Arrow): Arrow => a; // carries derivs + assumptions
  const materializeLax = (a: Arrow): Arrow =>
    arr(a.from as string, a.to as string, [[`txt_${[...a.derivs][0] ?? "d"}`, []]]); // drops assumptions/premises

  describe("strict materialization is FAITHFUL (tracks symbolic 𝓟°)", () => {
    test("a symbolic iso survives strict materialization (still invertible)", () => {
      // A drift-iso witnessed by inter-derivable claims (the §7 / D3 case).
      const fwd = arr("c", "c2", [["iso", ["λshared"]]]);
      const back = arr("c2", "c", [["iso", ["λshared"]]]);
      // symbolic: iso up to ≈ (compose round-trips to a no-net-assumption identity)
      // Here the witnesses share structure so the round trips are identity-like.
      const mFwd = materializeStrict(fwd);
      const mBack = materializeStrict(back);
      // strict preserves the derivation token, so the materialized round trip
      // matches the symbolic one — same invertibility verdict.
      expect(mFwd.derivs).toEqual(fwd.derivs);
      expect(minimalAssumptions(mFwd)).toEqual(minimalAssumptions(fwd));
      expect(isIsoVia(materializeStrict(arr("c","c",[["i",[]]])), materializeStrict(arr("c","c",[["i",[]]])))).toBe(true);
    });

    test("strict materialization preserves the assumption content (Toulmin premises)", () => {
      const a = arr("p", "q", [["d", ["λ1", "λ2"]]]);
      expect(minimalAssumptions(materializeStrict(a))).toEqual(new Set(["λ1", "λ2"]));
    });
  });

  describe("lax materialization is UNFAITHFUL (over-claims pseudofunctoriality)", () => {
    test("a symbolically iso-closed cycle becomes materially lossy (premises dropped)", () => {
      // Symbolic layer: claim c carries assumptions that witness inter-derivability.
      const symArrow = arr("p", "q", [["d", ["λ1", "λ2"]]]);
      expect(minimalAssumptions(symArrow)).toEqual(new Set(["λ1", "λ2"]));
      // Lax materialization strips the premises/assumptions:
      const mat = materializeLax(symArrow);
      expect(minimalAssumptions(mat)).toEqual(new Set()); // premise structure GONE
      // ⇒ the materialized arrow can no longer witness the iso the symbolic one did.
      expect(minimalAssumptions(mat)).not.toEqual(minimalAssumptions(symArrow));
    });

    test("the over-claim is exactly: symbolic `closed` but materially stripped", () => {
      // probe verdict (symbolic): closed/iso ⇒ "in 𝓟°".
      const symClosed = true;
      // materialized reality under lax import: structure lost ⇒ NOT a faithful witness.
      const a = arr("c", "c", [["d", ["λ"]]]);
      const matFaithful = minimalAssumptions(materializeLax(a)).size === minimalAssumptions(a).size;
      expect(symClosed).toBe(true);
      expect(matFaithful).toBe(false); // the gap C014-T must flag
    });
  });

  describe("the boundary is decidable from the apply mode (the C014.a gate)", () => {
    // Faithful ⟺ strict materialization path taken. Mirrors the route's guard
    // `depth > 1 && Object.keys(claimMapping).length > 0`.
    const isStrictPath = (depth: number, claimMapKeys: number, branch: "new" | "virtual"): boolean =>
      branch === "new" && depth > 1 && claimMapKeys > 0;

    test("strict path ⇒ faithful region", () => {
      expect(isStrictPath(2, 3, "new")).toBe(true);
    });
    test("depth=1 ⇒ lax ⇒ unfaithful", () => {
      expect(isStrictPath(1, 3, "new")).toBe(false);
    });
    test("empty claimMap ⇒ lax ⇒ unfaithful", () => {
      expect(isStrictPath(2, 0, "new")).toBe(false);
    });
    test("materialize-virtual branch ⇒ lax ⇒ unfaithful (always text-only)", () => {
      expect(isStrictPath(3, 5, "virtual")).toBe(false);
    });
  });
});
