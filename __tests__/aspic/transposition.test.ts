/**
 * Unit tests for ASPIC+ Transposition Closure
 * 
 * Tests validation, generation, and application of contrapositive rules
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateTranspositionClosure,
  generateTranspositions,
  applyTranspositionClosure,
  getTranspositionSummary,
  TranspositionValidation,
} from "@/lib/aspic/transposition";
import { Rule } from "@/lib/aspic/types";

describe("Transposition Closure Validation", () => {
  describe("validateTranspositionClosure", () => {
    it("should detect missing transposition for single-antecedent rule", () => {
      const rules: Rule[] = [
        {
          id: "rule1",
          antecedents: ["p"],
          consequent: "q",
          type: "strict",
        },
      ];

      const validation = validateTranspositionClosure(rules);

      expect(validation.isClosed).toBe(false);
      expect(validation.missingRules).toHaveLength(1);
      expect(validation.totalRequired).toBe(1);
      expect(validation.totalPresent).toBe(0);
      expect(validation.missingRules[0]).toMatchObject({
        antecedents: ["¬q"],
        consequent: "¬p",
        sourceRuleId: "rule1",
        transposedIndex: 0,
      });
      expect(validation.message).toContain("1 transposed rule missing");
    });

    it("should detect missing transpositions for multi-antecedent rule", () => {
      const rules: Rule[] = [
        {
          id: "modus_ponens",
          antecedents: ["p", "p→q"],
          consequent: "q",
          type: "strict",
        },
      ];

      const validation = validateTranspositionClosure(rules);

      expect(validation.isClosed).toBe(false);
      expect(validation.missingRules).toHaveLength(2);
      expect(validation.totalRequired).toBe(2);
      expect(validation.totalPresent).toBe(0);

      // Transposition 1: ¬q, p→q → ¬p  (modus tollens)
      expect(validation.missingRules[0]).toMatchObject({
        id: "modus_ponens_transpose_0",
        antecedents: ["¬q", "p→q"],
        consequent: "¬p",
        type: "strict",
      });

      // Transposition 2: p, ¬q → ¬(p→q)
      expect(validation.missingRules[1]).toMatchObject({
        id: "modus_ponens_transpose_1",
        antecedents: ["p", "¬q"],
        consequent: "¬(p→q)",
        type: "strict",
      });
    });

    it("should recognize closed rule sets", () => {
      const rules: Rule[] = [
        {
          id: "rule1",
          antecedents: ["p"],
          consequent: "q",
          type: "strict",
        },
        {
          id: "rule1_transpose_0",
          antecedents: ["¬q"],
          consequent: "¬p",
          type: "strict",
        },
      ];

      const validation = validateTranspositionClosure(rules);

      expect(validation.isClosed).toBe(true);
      expect(validation.missingRules).toHaveLength(0);
      expect(validation.totalRequired).toBe(1);
      expect(validation.totalPresent).toBe(1);
      expect(validation.message).toContain("✅");
    });

    it("should handle multiple rules correctly", () => {
      const rules: Rule[] = [
        {
          id: "r1",
          antecedents: ["a"],
          consequent: "b",
          type: "strict",
        },
        {
          id: "r2",
          antecedents: ["c", "d"],
          consequent: "e",
          type: "strict",
        },
      ];

      const validation = validateTranspositionClosure(rules);

      expect(validation.isClosed).toBe(false);
      expect(validation.totalRequired).toBe(3); // 1 from r1 + 2 from r2
      expect(validation.missingRules).toHaveLength(3);
    });

    it("should skip already-transposed rules to avoid recursion", () => {
      const rules: Rule[] = [
        {
          id: "rule1",
          antecedents: ["p"],
          consequent: "q",
          type: "strict",
        },
        {
          id: "rule1_transpose_0",
          antecedents: ["¬q"],
          consequent: "¬p",
          type: "strict",
        },
      ];

      const validation = validateTranspositionClosure(rules);

      // Should only check rule1, not rule1_transpose_0
      expect(validation.totalRequired).toBe(1);
      expect(validation.isClosed).toBe(true);
    });

    it("should handle empty rule set", () => {
      const validation = validateTranspositionClosure([]);

      expect(validation.isClosed).toBe(true);
      expect(validation.missingRules).toHaveLength(0);
      expect(validation.totalRequired).toBe(0);
      expect(validation.totalPresent).toBe(0);
    });

    it("should include explanations in missing rules", () => {
      const rules: Rule[] = [
        {
          id: "syllogism",
          antecedents: ["all_humans_mortal", "socrates_human"],
          consequent: "socrates_mortal",
          type: "strict",
        },
      ];

      const validation = validateTranspositionClosure(rules);

      expect(validation.missingRules[0].explanation).toContain("all_humans_mortal");
      expect(validation.missingRules[0].explanation).toContain("¬(socrates_mortal)");
      expect(validation.missingRules[1].explanation).toContain("socrates_human");
    });
  });

  describe("generateTranspositions", () => {
    it("should generate transposition for single-antecedent rule", () => {
      const rule: Rule = {
        id: "simple",
        antecedents: ["p"],
        consequent: "q",
        type: "strict",
      };

      const transposed = generateTranspositions(rule);

      expect(transposed).toHaveLength(1);
      expect(transposed[0]).toMatchObject({
        id: "simple_transpose_0",
        antecedents: ["¬q"],
        consequent: "¬p",
        type: "strict",
        sourceRuleId: "simple",
        transposedIndex: 0,
      });
      expect(transposed[0].explanation).toBeTruthy();
    });

    it("should generate all transpositions for multi-antecedent rule", () => {
      const rule: Rule = {
        id: "syllogism",
        antecedents: ["all_humans_mortal", "socrates_human"],
        consequent: "socrates_mortal",
        type: "strict",
      };

      const transposed = generateTranspositions(rule);

      expect(transposed).toHaveLength(2);

      // First transposition: ¬socrates_mortal, socrates_human → ¬all_humans_mortal
      expect(transposed[0]).toMatchObject({
        id: "syllogism_transpose_0",
        antecedents: ["¬socrates_mortal", "socrates_human"],
        consequent: "¬all_humans_mortal",
        type: "strict",
        sourceRuleId: "syllogism",
        transposedIndex: 0,
      });

      // Second transposition: all_humans_mortal, ¬socrates_mortal → ¬socrates_human
      expect(transposed[1]).toMatchObject({
        id: "syllogism_transpose_1",
        antecedents: ["all_humans_mortal", "¬socrates_mortal"],
        consequent: "¬socrates_human",
        type: "strict",
        sourceRuleId: "syllogism",
        transposedIndex: 1,
      });
    });

    it("should throw error for defeasible rules", () => {
      const rule: Rule = {
        id: "defeasible",
        antecedents: ["bird(x)"],
        consequent: "flies(x)",
        type: "defeasible",
      };

      expect(() => generateTranspositions(rule)).toThrow("Cannot transpose non-strict rule");
    });

    it("should handle rules with complex formulas", () => {
      const rule: Rule = {
        id: "complex",
        antecedents: ["(p ∧ q)", "r → s"],
        consequent: "(t ∨ u)",
        type: "strict",
      };

      const transposed = generateTranspositions(rule);

      expect(transposed).toHaveLength(2);
      expect(transposed[0].antecedents).toContain("¬(t ∨ u)");
      expect(transposed[0].consequent).toBe("¬(p ∧ q)");
      expect(transposed[1].consequent).toBe("¬(r → s)");
    });
  });

  describe("applyTranspositionClosure", () => {
    it("should apply closure to single rule", () => {
      const rules: Rule[] = [
        {
          id: "rule1",
          antecedents: ["p"],
          consequent: "q",
          type: "strict",
        },
      ];

      const closed = applyTranspositionClosure(rules);

      expect(closed).toHaveLength(2); // Original + 1 transposition
      
      const validation = validateTranspositionClosure(closed);
      expect(validation.isClosed).toBe(true);
    });

    it("should apply closure to multiple rules", () => {
      const rules: Rule[] = [
        {
          id: "r1",
          antecedents: ["a"],
          consequent: "b",
          type: "strict",
        },
        {
          id: "r2",
          antecedents: ["c", "d"],
          consequent: "e",
          type: "strict",
        },
      ];

      const closed = applyTranspositionClosure(rules);

      // Original 2 + 1 transposition (r1) + 2 transpositions (r2)
      expect(closed).toHaveLength(5);
      
      const validation = validateTranspositionClosure(closed);
      expect(validation.isClosed).toBe(true);
    });

    it("should be idempotent", () => {
      const rules: Rule[] = [
        {
          id: "rule1",
          antecedents: ["p"],
          consequent: "q",
          type: "strict",
        },
      ];

      const closed1 = applyTranspositionClosure(rules);
      const closed2 = applyTranspositionClosure(closed1);

      expect(closed1.length).toBe(closed2.length);
      expect(closed1.map(r => r.id).sort()).toEqual(closed2.map(r => r.id).sort());
    });

    it("should skip already-transposed rules", () => {
      const rules: Rule[] = [
        {
          id: "rule1",
          antecedents: ["p"],
          consequent: "q",
          type: "strict",
        },
        {
          id: "rule1_transpose_0",
          antecedents: ["¬q"],
          consequent: "¬p",
          type: "strict",
        },
      ];

      const closed = applyTranspositionClosure(rules);

      // Should have 2 rules (no duplicates)
      expect(closed).toHaveLength(2);
      
      const validation = validateTranspositionClosure(closed);
      expect(validation.isClosed).toBe(true);
    });

    it("should handle empty rule set", () => {
      const closed = applyTranspositionClosure([]);
      expect(closed).toHaveLength(0);
    });

    it("should preserve rule metadata", () => {
      const rules: Rule[] = [
        {
          id: "modus_ponens",
          antecedents: ["p", "p→q"],
          consequent: "q",
          type: "strict",
        },
      ];

      const closed = applyTranspositionClosure(rules);
      
      const transposedRules = closed.filter(r => r.id.includes("_transpose_"));
      expect(transposedRules).toHaveLength(2);
      
      transposedRules.forEach(tr => {
        expect(tr.type).toBe("strict");
        expect((tr as any).sourceRuleId).toBe("modus_ponens");
      });
    });
  });

  describe("getTranspositionSummary", () => {
    it("should format closed set message", () => {
      const validation: TranspositionValidation = {
        isClosed: true,
        missingRules: [],
        totalRequired: 3,
        totalPresent: 3,
        message: "✅ Strict rules are closed under transposition",
      };

      const summary = getTranspositionSummary(validation);
      expect(summary).toContain("✅");
      expect(summary).toContain("closed under transposition");
    });

    it("should format partial closure message", () => {
      const validation: TranspositionValidation = {
        isClosed: false,
        missingRules: [{} as any, {} as any], // 2 missing
        totalRequired: 5,
        totalPresent: 3,
        message: "⚠️ 2 transposed rules missing",
      };

      const summary = getTranspositionSummary(validation);
      expect(summary).toContain("60%"); // 3/5 = 60%
      expect(summary).toContain("3/5");
      expect(summary).toContain("2 missing");
    });

    it("should handle empty set", () => {
      const validation: TranspositionValidation = {
        isClosed: false,
        missingRules: [],
        totalRequired: 0,
        totalPresent: 0,
        message: "",
      };

      const summary = getTranspositionSummary(validation);
      expect(summary).toContain("0%");
    });
  });

  describe("Edge Cases", () => {
    it("should handle double negation in formulas", () => {
      const rule: Rule = {
        id: "double_neg",
        antecedents: ["¬¬p"],
        consequent: "q",
        type: "strict",
      };

      const transposed = generateTranspositions(rule);
      
      // negateFormula should handle double negation: ¬(¬¬p) = ¬¬¬p or potentially simplify to ¬p
      expect(transposed[0].antecedents).toContain("¬q");
      expect(transposed[0].consequent).toMatch(/¬/); // Should have negation
    });

    it("should handle rules with many antecedents", () => {
      const rule: Rule = {
        id: "many_ants",
        antecedents: ["a", "b", "c", "d", "e"],
        consequent: "z",
        type: "strict",
      };

      const transposed = generateTranspositions(rule);
      expect(transposed).toHaveLength(5);
      
      // Each transposition should have 5 antecedents (4 original + 1 negated consequent)
      transposed.forEach(tr => {
        expect(tr.antecedents).toHaveLength(5);
        expect(tr.antecedents).toContain("¬z");
      });
    });

    it("should handle rules with special characters in formulas", () => {
      const rule: Rule = {
        id: "special",
        antecedents: ["p→q", "q→r"],
        consequent: "p→r",
        type: "strict",
      };

      const transposed = generateTranspositions(rule);
      expect(transposed).toHaveLength(2);
      expect(transposed[0].consequent).toBe("¬(p→q)");
      expect(transposed[1].consequent).toBe("¬(q→r)");
    });
  });
});
