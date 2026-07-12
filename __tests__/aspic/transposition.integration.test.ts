/**
 * Integration Tests for ASPIC+ Transposition Closure
 * 
 * Tests the full workflow of transposition validation and application
 * including modus tollens patterns, complex rule interactions, and
 * real-world reasoning scenarios.
 */

import {
  validateTranspositionClosure,
  generateTranspositions,
  applyTranspositionClosure,
  type StrictRule,
} from "@/lib/aspic/transposition";

describe("Transposition Closure - Integration Tests", () => {
  describe("Modus Tollens Reasoning Patterns", () => {
    it("should enable modus tollens with transposed rules", () => {
      // Original rule: If it's raining, the ground is wet
      const originalRule: StrictRule = {
        id: "rule1",
        antecedents: ["raining"],
        consequent: "ground_wet",
        type: "strict",
      };

      // Generate transpositions
      const transposedRules = generateTranspositions(originalRule);

      // Should generate: ¬ground_wet → ¬raining
      expect(transposedRules).toHaveLength(1);
      expect(transposedRules[0].antecedents).toEqual(["¬ground_wet"]);
      expect(transposedRules[0].consequent).toBe("¬raining");

      // Verify modus tollens pattern
      // Given: raining → ground_wet
      // Given: ¬ground_wet (observation: ground is dry)
      // Conclude: ¬raining (it's not raining)
      expect(transposedRules[0].explanation).toContain("Contrapositive");
      expect(transposedRules[0].sourceRuleId).toBe("rule1");
    });

    it("should support multi-step modus tollens reasoning", () => {
      // Chain: A → B, B → C
      const rules: StrictRule[] = [
        { id: "r1", antecedents: ["A"], consequent: "B", type: "strict" },
        { id: "r2", antecedents: ["B"], consequent: "C", type: "strict" },
      ];

      // Apply closure
      const closedRules = applyTranspositionClosure(rules);

      // Should have 4 rules total: A→B, ¬B→¬A, B→C, ¬C→¬B
      expect(closedRules).toHaveLength(4);

      // Find the transposed rules
      const notBtoNotA = closedRules.find(
        (r) => r.antecedents.includes("¬B") && r.consequent === "¬A"
      );
      const notCtoNotB = closedRules.find(
        (r) => r.antecedents.includes("¬C") && r.consequent === "¬B"
      );

      expect(notBtoNotA).toBeDefined();
      expect(notCtoNotB).toBeDefined();

      // With these transpositions, we can reason:
      // ¬C → ¬B (via r2 transposition)
      // ¬B → ¬A (via r1 transposition)
      // Therefore: ¬C → ¬A (by chaining)
    });

    it("should handle complex real-world Kantian argument", () => {
      // Kant: "Experience requires categories of understanding"
      // If no categories, then no experience (contrapositive)
      const kantRule: StrictRule = {
        id: "kant_transcendental",
        antecedents: ["sensory_input", "categories_of_understanding"],
        consequent: "experience",
        type: "strict",
      };

      const transpositions = generateTranspositions(kantRule);

      // Should generate 2 transpositions (one per antecedent)
      expect(transpositions).toHaveLength(2);

      // Transposition 1: sensory_input, ¬experience → ¬categories_of_understanding
      const trans1 = transpositions.find((t) =>
        t.antecedents.includes("sensory_input")
      );
      expect(trans1).toBeDefined();
      expect(trans1!.antecedents).toContain("¬experience");
      expect(trans1!.consequent).toBe("¬categories_of_understanding");

      // Transposition 2: categories_of_understanding, ¬experience → ¬sensory_input
      const trans2 = transpositions.find((t) =>
        t.antecedents.includes("categories_of_understanding")
      );
      expect(trans2).toBeDefined();
      expect(trans2!.antecedents).toContain("¬experience");
      expect(trans2!.consequent).toBe("¬sensory_input");

      // This enables the key Kantian move:
      // "If you have no experience, you must lack either sensory input or categories"
    });
  });

  describe("Mathematical Proof Patterns", () => {
    it("should support proof by contradiction with transposition", () => {
      // Mathematical rule: If n is even, then n² is even
      const mathRule: StrictRule = {
        id: "even_square",
        antecedents: ["n_is_even"],
        consequent: "n²_is_even",
        type: "strict",
      };

      const transpositions = generateTranspositions(mathRule);

      // Contrapositive: If n² is not even (i.e., odd), then n is not even (i.e., odd)
      expect(transpositions[0].antecedents).toEqual(["¬n²_is_even"]);
      expect(transpositions[0].consequent).toBe("¬n_is_even");

      // This enables proof by contradiction:
      // Assume n is even, derive n² is even
      // But if we observe n² is odd (¬n²_is_even)
      // We can conclude n must be odd (¬n_is_even)
    });

    it("should handle syllogistic reasoning with transposition", () => {
      // All humans are mortal: human(x) → mortal(x)
      // Socrates is human: human(Socrates)
      // Therefore: mortal(Socrates)
      const rules: StrictRule[] = [
        {
          id: "all_humans_mortal",
          antecedents: ["human(x)"],
          consequent: "mortal(x)",
          type: "strict",
        },
      ];

      const closedRules = applyTranspositionClosure(rules);

      // Should include contrapositive: ¬mortal(x) → ¬human(x)
      const contrapositive = closedRules.find(
        (r) => r.antecedents.includes("¬mortal(x)") && r.consequent === "¬human(x)"
      );

      expect(contrapositive).toBeDefined();
      expect(contrapositive!.explanation).toContain("Contrapositive");

      // This enables: "If x is immortal, x cannot be human"
    });
  });

  describe("Legal Reasoning Patterns", () => {
    it("should support statutory contraposition", () => {
      // Law: If citizen, then has voting rights
      const statutoryRule: StrictRule = {
        id: "voting_rights",
        antecedents: ["is_citizen"],
        consequent: "has_voting_rights",
        type: "strict",
      };

      const transpositions = generateTranspositions(statutoryRule);

      // Contrapositive: If no voting rights, then not a citizen
      expect(transpositions[0].antecedents).toEqual(["¬has_voting_rights"]);
      expect(transpositions[0].consequent).toBe("¬is_citizen");

      // Legal reasoning: "If someone lacks voting rights, they must not be a citizen"
      // (assuming the statute is complete and no exceptions)
    });

    it("should handle multi-condition legal rules", () => {
      // Contract validity: offer + acceptance + consideration → valid_contract
      const contractRule: StrictRule = {
        id: "contract_formation",
        antecedents: ["offer", "acceptance", "consideration"],
        consequent: "valid_contract",
        type: "strict",
      };

      const transpositions = generateTranspositions(contractRule);

      // Should generate 3 transpositions (one per antecedent)
      expect(transpositions).toHaveLength(3);

      // Example: offer, acceptance, ¬valid_contract → ¬consideration
      const missingConsideration = transpositions.find(
        (t) =>
          t.antecedents.includes("offer") &&
          t.antecedents.includes("acceptance") &&
          t.antecedents.includes("¬valid_contract")
      );

      expect(missingConsideration).toBeDefined();
      expect(missingConsideration!.consequent).toBe("¬consideration");

      // Legal reasoning: "If we have offer and acceptance but no valid contract,
      // then consideration must be missing"
    });
  });

  describe("End-to-End Workflow Tests", () => {
    it("should detect, warn, and fix non-closed rule sets", () => {
      // User creates strict rules without thinking about transposition
      const userRules: StrictRule[] = [
        { id: "r1", antecedents: ["P"], consequent: "Q", type: "strict" },
        { id: "r2", antecedents: ["Q"], consequent: "R", type: "strict" },
        { id: "r3", antecedents: ["R"], consequent: "S", type: "strict" },
      ];

      // Step 1: Validate (should detect violations)
      const validation = validateTranspositionClosure(userRules);
      expect(validation.isClosed).toBe(false);
      expect(validation.missingRules).toHaveLength(3); // 3 missing transpositions
      expect(validation.totalRequired).toBe(3);
      expect(validation.totalPresent).toBe(0);

      // Step 2: Auto-generate transpositions
      const fixedRules = applyTranspositionClosure(userRules);

      // Step 3: Re-validate (should now be closed)
      const revalidation = validateTranspositionClosure(fixedRules);
      expect(revalidation.isClosed).toBe(true);
      expect(revalidation.missingRules).toHaveLength(0);
      expect(fixedRules).toHaveLength(6); // 3 original + 3 transposed
    });

    it("should handle iterative rule building with validation feedback", () => {
      const rules: StrictRule[] = [];

      // User adds first rule
      rules.push({ id: "r1", antecedents: ["A"], consequent: "B", type: "strict" });
      let validation = validateTranspositionClosure(rules);
      expect(validation.isClosed).toBe(false);
      expect(validation.missingRules).toHaveLength(1);

      // User auto-generates transposition
      const fixed1 = applyTranspositionClosure(rules);
      validation = validateTranspositionClosure(fixed1);
      expect(validation.isClosed).toBe(true);

      // User adds second rule (breaks closure again)
      fixed1.push({ id: "r2", antecedents: ["B"], consequent: "C", type: "strict" });
      validation = validateTranspositionClosure(fixed1);
      expect(validation.isClosed).toBe(false);
      expect(validation.missingRules).toHaveLength(1); // Only new rule needs transposition

      // User auto-generates again (full closure restored)
      const fixed2 = applyTranspositionClosure(fixed1);
      validation = validateTranspositionClosure(fixed2);
      expect(validation.isClosed).toBe(true);
      expect(fixed2).toHaveLength(4); // 2 original + 2 transposed
    });

    it("should preserve closure under idempotent application", () => {
      const rules: StrictRule[] = [
        { id: "r1", antecedents: ["X"], consequent: "Y", type: "strict" },
        { id: "r2", antecedents: ["Y"], consequent: "Z", type: "strict" },
      ];

      // Apply closure multiple times
      const closed1 = applyTranspositionClosure(rules);
      const closed2 = applyTranspositionClosure(closed1);
      const closed3 = applyTranspositionClosure(closed2);

      // Should be idempotent (same result)
      expect(closed1).toHaveLength(closed2.length);
      expect(closed2).toHaveLength(closed3.length);
      expect(closed1).toHaveLength(4); // 2 original + 2 transposed

      // All should be closed
      expect(validateTranspositionClosure(closed1).isClosed).toBe(true);
      expect(validateTranspositionClosure(closed2).isClosed).toBe(true);
      expect(validateTranspositionClosure(closed3).isClosed).toBe(true);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large rule sets efficiently", () => {
      // Generate 50 rules
      const rules: StrictRule[] = Array.from({ length: 50 }, (_, i) => ({
        id: `rule_${i}`,
        antecedents: [`P${i}`],
        consequent: `Q${i}`,
        type: "strict" as const,
      }));

      const start = Date.now();
      const validation = validateTranspositionClosure(rules);
      const validationTime = Date.now() - start;

      expect(validationTime).toBeLessThan(100); // Should be very fast
      expect(validation.missingRules).toHaveLength(50);

      const applyStart = Date.now();
      const closed = applyTranspositionClosure(rules);
      const applyTime = Date.now() - applyStart;

      expect(applyTime).toBeLessThan(200); // Should still be fast
      expect(closed).toHaveLength(100); // 50 + 50 transposed
    });

    it("should handle rules with many antecedents", () => {
      // Rule with 5 antecedents (generates 5 transpositions)
      const complexRule: StrictRule = {
        id: "complex",
        antecedents: ["A", "B", "C", "D", "E"],
        consequent: "F",
        type: "strict",
      };

      const transpositions = generateTranspositions(complexRule);
      expect(transpositions).toHaveLength(5);

      // Verify each transposition is unique
      const uniqueConsequents = new Set(transpositions.map((t) => t.consequent));
      expect(uniqueConsequents.size).toBe(5);
    });
  });
});
