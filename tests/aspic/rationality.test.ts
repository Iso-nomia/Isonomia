/**
 * ASPIC+ Rationality Postulates Tests
 * 
 * Tests for well-formedness and rationality checking.
 */

import { describe, it, expect } from "@jest/globals";
import {
  createEmptyTheory,
  type ArgumentationTheory,
} from "@/lib/aspic/types";
import { constructArguments } from "@/lib/aspic/arguments";
import { computeAttacks, addClassicalNegation } from "@/lib/aspic/attacks";
import { computeDefeats } from "@/lib/aspic/defeats";
import { computeGroundedExtension } from "@/lib/aspic/semantics";
import {
  checkRationalityPostulates,
  checkSubArgumentClosure,
  checkWellFormedness,
  checkTranspositionClosure,
  checkContrapositionClosure,
  generateRationalityReport,
} from "@/lib/aspic/rationality";

// ============================================================================
// TEST UTILITIES
// ============================================================================

function createTestTheory(): ArgumentationTheory {
  const theory = createEmptyTheory();
  theory.system.language.add("p");
  theory.system.language.add("q");
  theory.system.language.add("r");
  addClassicalNegation(theory.system.contraries, theory.system.language);
  return theory;
}

function addDefeasibleRule(
  theory: ArgumentationTheory,
  id: string,
  antecedents: string[],
  consequent: string
): void {
  theory.system.defeasibleRules.push({
    id,
    antecedents,
    consequent,
    type: "defeasible",
  });
}

function addStrictRule(
  theory: ArgumentationTheory,
  id: string,
  antecedents: string[],
  consequent: string
): void {
  theory.system.strictRules.push({
    id,
    antecedents,
    consequent,
    type: "strict",
  });
}

// ============================================================================
// RATIONALITY POSTULATES TESTS
// ============================================================================

describe("ASPIC+ Rationality Postulates", () => {
  describe("Sub-argument Closure", () => {
    it("should pass for simple axiom-only extension", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      expect(rationality.subArgumentClosure).toBe(true);
    });

    it("should pass when all sub-arguments are in extension", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");

      // p → q (strict)
      addStrictRule(theory, "r1", ["p"], "q");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      // Both p and q should be in extension
      expect(rationality.subArgumentClosure).toBe(true);
    });
  });

  describe("Strict Closure", () => {
    it("should pass when extension is closed under strict rules", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.axioms.add("q");

      // p, q → r (strict)
      addStrictRule(theory, "r1", ["p", "q"], "r");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      expect(rationality.strictClosure).toBe(true);
    });
  });

  describe("Direct Consistency", () => {
    it("should pass when no contradictory conclusions in extension", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.axioms.add("q");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      expect(rationality.directConsistency).toBe(true);
    });

    it("should pass when contradictions are excluded from extension", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.premises.add("¬p");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      // p is IN, ¬p is OUT, so extension is consistent
      expect(rationality.directConsistency).toBe(true);
    });
  });

  describe("Indirect Consistency", () => {
    it("should pass when closure under strict rules is consistent", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");

      // p → q (strict)
      addStrictRule(theory, "r1", ["p"], "q");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      expect(rationality.indirectConsistency).toBe(true);
    });
  });

  describe("Overall Rationality", () => {
    it("should be rational for well-behaved theories", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.axioms.add("q");

      // p → r (strict)
      addStrictRule(theory, "r1", ["p"], "r");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);
      const defeats = computeDefeats(attacks, theory, "last-link");
      const extension = computeGroundedExtension(args, defeats);

      const rationality = checkRationalityPostulates(extension, args, theory);

      // All postulates should hold
      expect(rationality.subArgumentClosure).toBe(true);
      expect(rationality.strictClosure).toBe(true);
      expect(rationality.directConsistency).toBe(true);
      expect(rationality.indirectConsistency).toBe(true);
      expect(rationality.violations).toHaveLength(0);
    });
  });
});

// ============================================================================
// WELL-FORMEDNESS TESTS
// ============================================================================

describe("Well-Formedness Checks", () => {
  it("should check individual constraints for simple theory", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");

    const wellFormedness = checkWellFormedness(theory);

    // Axiom consistency passes (no direct contradictions)
    expect(wellFormedness.axiomConsistency).toBe(true);
    
    // Well-formedness FAILS because "p" is an axiom and has contrary "¬p"
    // (This violates: "axioms cannot have contraries")
    expect(wellFormedness.wellFormedness).toBe(false);
    
    // Reasonable ordering passes (vacuously - no rules to check)
    expect(wellFormedness.reasonableOrdering).toBe(true);

    // No strict rules means transposition is vacuously satisfied
    expect(wellFormedness.closureProperty).toBe("transposition");
    
    // Overall isWellDefined is false (fails well-formedness constraint)
    expect(wellFormedness.isWellDefined).toBe(false);
    expect(wellFormedness.issues.length).toBeGreaterThan(0);
  });

  it("should fail when axioms are inconsistent", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");
    theory.knowledgeBase.axioms.add("¬p");

    const wellFormedness = checkWellFormedness(theory);

    expect(wellFormedness.axiomConsistency).toBe(false);
    expect(wellFormedness.isWellDefined).toBe(false);
  });

  it("should fail when axiom has a contrary", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");

    // Manually add ¬p as axiom (violates well-formedness)
    theory.knowledgeBase.axioms.add("¬p");

    const wellFormedness = checkWellFormedness(theory);

    expect(wellFormedness.axiomConsistency).toBe(false);
  });

  it("should check reasonable preferences", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");

    addDefeasibleRule(theory, "d1", ["p"], "q");

    const wellFormedness = checkWellFormedness(theory);

    // No preferences specified, so should be reasonable
    expect(wellFormedness.reasonableOrdering).toBe(true);
  });
});

// ============================================================================
// CLOSURE PROPERTY TESTS
// ============================================================================

describe("Closure Properties", () => {
  describe("Contraposition Closure", () => {
    it("should pass when contrapositives exist", () => {
      const theory = createTestTheory();

      // p → q (strict)
      addStrictRule(theory, "r1", ["p"], "q");

      // ¬q → ¬p (contrapositive)
      addStrictRule(theory, "r2", ["¬q"], "¬p");

      const contraposition = checkContrapositionClosure(theory);

      expect(contraposition.satisfied).toBe(true);
      expect(contraposition.violations).toHaveLength(0);
    });

    it("should fail when contrapositive is missing", () => {
      const theory = createTestTheory();

      // p → q (strict)
      addStrictRule(theory, "r1", ["p"], "q");

      // Missing: ¬q → ¬p

      const contraposition = checkContrapositionClosure(theory);

      expect(contraposition.satisfied).toBe(false);
      expect(contraposition.violations.length).toBeGreaterThan(0);
    });
  });

  describe("Transposition Closure", () => {
    it("should pass for theories with proper transpositions", () => {
      const theory = createTestTheory();

      // p, q → r (strict)
      addStrictRule(theory, "r1", ["p", "q"], "r");

      // q, ¬r → ¬p (transposition)
      addStrictRule(theory, "r2", ["q", "¬r"], "¬p");

      // p, ¬r → ¬q (transposition)
      addStrictRule(theory, "r3", ["p", "¬r"], "¬q");

      const transposition = checkTranspositionClosure(theory);

      expect(transposition.satisfied).toBe(true);
    });

    it("should handle theories without strict rules", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");

      const transposition = checkTranspositionClosure(theory);

      // No strict rules, so vacuously satisfied
      expect(transposition.satisfied).toBe(true);
    });
  });
});

// ============================================================================
// REPORT GENERATION TESTS
// ============================================================================

describe("Rationality Report Generation", () => {
  it("should generate comprehensive report", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");
    const extension = computeGroundedExtension(args, defeats);

    const report = generateRationalityReport(extension, args, theory);

    expect(report).toContain("RATIONALITY REPORT");
    expect(report).toContain("WELL-FORMEDNESS");
    expect(report).toContain("RATIONALITY POSTULATES");
    expect(report).toContain("Sub-argument closure");
  });

  it("should show violations when theory is not rational", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");
    theory.knowledgeBase.axioms.add("¬p");

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");
    const extension = computeGroundedExtension(args, defeats);

    const report = generateRationalityReport(extension, args, theory);

    expect(report).toContain("✗ FAIL");
    expect(report).toContain("Issues:");
  });
});
