/**
 * ASPIC+ Core Engine Tests
 * 
 * Validates:
 * 1. Argument construction from knowledge base and rules
 * 2. Attack computation (undermining, rebutting, undercutting)
 * 3. Defeat resolution with preferences
 * 
 * Test cases based on examples from:
 * - Prakken & Modgil (2013) ASPIC+ specification
 * - Caminada & Amgoud (2007) rationality postulates
 */

import { describe, it, expect } from "@jest/globals";
import {
  createEmptyTheory,
  type ArgumentationTheory,
  type Rule,
  type Argument,
} from "@/lib/aspic/types";
import { constructArguments, findArgumentsByConclusion } from "@/lib/aspic/arguments";
import { computeAttacks, addClassicalNegation } from "@/lib/aspic/attacks";
import { computeDefeats } from "@/lib/aspic/defeats";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Helper: Create a simple theory for testing
 */
function createTestTheory(): ArgumentationTheory {
  const theory = createEmptyTheory();

  // Language
  theory.system.language.add("p");
  theory.system.language.add("q");
  theory.system.language.add("r");
  theory.system.language.add("s");

  // Classical negation
  addClassicalNegation(theory.system.contraries, theory.system.language);

  return theory;
}

/**
 * Helper: Add strict rule to theory
 */
function addStrictRule(
  theory: ArgumentationTheory,
  id: string,
  antecedents: string[],
  consequent: string
): void {
  const rule: Rule = {
    id,
    antecedents,
    consequent,
    type: "strict",
  };
  theory.system.strictRules.push(rule);
}

/**
 * Helper: Add defeasible rule to theory
 */
function addDefeasibleRule(
  theory: ArgumentationTheory,
  id: string,
  antecedents: string[],
  consequent: string,
  ruleName?: string
): void {
  const rule: Rule = {
    id,
    antecedents,
    consequent,
    type: "defeasible",
  };
  theory.system.defeasibleRules.push(rule);

  // Add rule name for undercutting
  if (ruleName) {
    theory.system.language.add(ruleName);
    theory.system.ruleNames.set(id, ruleName);
  }
}

// ============================================================================
// ARGUMENT CONSTRUCTION TESTS
// ============================================================================

describe("ASPIC+ Argument Construction", () => {
  it("should create base arguments from axioms", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");
    theory.knowledgeBase.axioms.add("q");

    const args = constructArguments(theory);

    expect(args.length).toBe(2);
    expect(args.some(a => a.conclusion === "p" && a.premises.has("p"))).toBe(true);
    expect(args.some(a => a.conclusion === "q" && a.premises.has("q"))).toBe(true);
  });

  it("should create base arguments from ordinary premises", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");

    const args = constructArguments(theory);

    expect(args.length).toBe(1);
    expect(args[0].conclusion).toBe("p");
    expect(args[0].premises.has("p")).toBe(true);
    expect(args[0].topRule).toBeUndefined();
  });

  it("should apply strict rules to derive new arguments", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");
    theory.knowledgeBase.axioms.add("q");

    // p, q → r (strict)
    addStrictRule(theory, "r1", ["p", "q"], "r");

    const args = constructArguments(theory);

    // Should have: p, q, r
    expect(args.length).toBe(3);

    const argR = args.find(a => a.conclusion === "r");
    expect(argR).toBeDefined();
    expect(argR!.topRule?.ruleId).toBe("r1");
    expect(argR!.topRule?.type).toBe("strict");
    expect(argR!.premises.has("p")).toBe(true);
    expect(argR!.premises.has("q")).toBe(true);
  });

  it("should apply defeasible rules to derive new arguments", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");

    // p ⇒ q (defeasible)
    addDefeasibleRule(theory, "d1", ["p"], "q");

    const args = constructArguments(theory);

    // Should have: p, q
    expect(args.length).toBe(2);

    const argQ = args.find(a => a.conclusion === "q");
    expect(argQ).toBeDefined();
    expect(argQ!.topRule?.ruleId).toBe("d1");
    expect(argQ!.topRule?.type).toBe("defeasible");
    expect(argQ!.defeasibleRules.has("d1")).toBe(true);
  });

  it("should chain rules to build deeper arguments", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("p");

    // p → q (strict)
    addStrictRule(theory, "r1", ["p"], "q");

    // q ⇒ r (defeasible)
    addDefeasibleRule(theory, "d1", ["q"], "r");

    const args = constructArguments(theory);

    // Should have: p, q, r
    expect(args.length).toBe(3);

    const argR = args.find(a => a.conclusion === "r");
    expect(argR).toBeDefined();
    expect(argR!.subArguments.length).toBe(1);
    expect(argR!.subArguments[0].conclusion).toBe("q");
    expect(argR!.premises.has("p")).toBe(true);
  });

  it("should handle multiple derivations of same conclusion", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");
    theory.knowledgeBase.premises.add("q");

    // p ⇒ r
    addDefeasibleRule(theory, "d1", ["p"], "r");

    // q ⇒ r
    addDefeasibleRule(theory, "d2", ["q"], "r");

    const args = constructArguments(theory);

    const argsForR = findArgumentsByConclusion(args, "r");
    expect(argsForR.length).toBe(2);

    const fromP = argsForR.find(a => a.premises.has("p") && !a.premises.has("q"));
    const fromQ = argsForR.find(a => a.premises.has("q") && !a.premises.has("p"));

    expect(fromP).toBeDefined();
    expect(fromQ).toBeDefined();
  });
});

// ============================================================================
// ATTACK COMPUTATION TESTS
// ============================================================================

describe("ASPIC+ Attack Computation", () => {
  describe("Undermining attacks", () => {
    it("should detect undermining attack on ordinary premise", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.premises.add("p");
      theory.knowledgeBase.axioms.add("¬p");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      // ¬p undermines p
      expect(attacks.length).toBe(1);
      expect(attacks[0].type).toBe("undermining");
      expect(attacks[0].attacker.conclusion).toBe("¬p");
      expect(attacks[0].attacked.conclusion).toBe("p");
      expect(attacks[0].target.premise).toBe("p");
    });

    it("should NOT allow undermining of axioms", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.premises.add("¬p");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      // p (axiom) can undermine ¬p (premise), but not vice versa
      expect(attacks.length).toBe(1);
      expect(attacks[0].type).toBe("undermining");
      expect(attacks[0].attacker.conclusion).toBe("p");
      expect(attacks[0].attacked.conclusion).toBe("¬p");
      expect(attacks[0].target.premise).toBe("¬p");
    });

    it("should detect undermining in argument chain", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.premises.add("p");
      theory.knowledgeBase.axioms.add("¬p");

      // p ⇒ q
      addDefeasibleRule(theory, "d1", ["p"], "q");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      // ¬p undermines the argument for q (because q uses premise p)
      const argQ = args.find(a => a.conclusion === "q");
      const underminingAttacks = attacks.filter(
        a => a.type === "undermining" && a.attacked.id === argQ?.id
      );

      expect(underminingAttacks.length).toBe(1);
    });
  });

  describe("Rebutting attacks", () => {
    it("should detect rebutting attack on defeasible conclusion", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.premises.add("p");
      theory.knowledgeBase.premises.add("q");

      // p ⇒ r
      addDefeasibleRule(theory, "d1", ["p"], "r");

      // q ⇒ ¬r
      addDefeasibleRule(theory, "d2", ["q"], "¬r");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      const rebuttingAttacks = attacks.filter(a => a.type === "rebutting");

      // Should have 2 rebutting attacks (mutual)
      expect(rebuttingAttacks.length).toBe(2);

      const argR = args.find(a => a.conclusion === "r" && a.topRule?.ruleId === "d1");
      const argNotR = args.find(a => a.conclusion === "¬r" && a.topRule?.ruleId === "d2");

      expect(rebuttingAttacks.some(
        a => a.attacker.id === argR?.id && a.attacked.id === argNotR?.id
      )).toBe(true);

      expect(rebuttingAttacks.some(
        a => a.attacker.id === argNotR?.id && a.attacked.id === argR?.id
      )).toBe(true);
    });

    it("should NOT allow rebutting of strict conclusions", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.premises.add("q");

      // p → r (strict)
      addStrictRule(theory, "r1", ["p"], "r");

      // q ⇒ ¬r (defeasible)
      addDefeasibleRule(theory, "d1", ["q"], "¬r");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      const argR = args.find(a => a.conclusion === "r");
      const rebuttingOnR = attacks.filter(
        a => a.type === "rebutting" && a.attacked.id === argR?.id
      );

      // Cannot rebut strict conclusion
      expect(rebuttingOnR.length).toBe(0);
    });
  });

  describe("Undercutting attacks", () => {
    it("should detect undercutting attack on defeasible rule", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.premises.add("p");

      // p ⇒ q (with rule name "rule1")
      addDefeasibleRule(theory, "d1", ["p"], "q", "rule1");

      // Add ¬rule1 to language and axioms
      theory.system.language.add("¬rule1");
      theory.knowledgeBase.axioms.add("¬rule1");

      // Set up contrariness: rule1 ↔ ¬rule1
      if (!theory.system.contraries.has("rule1")) {
        theory.system.contraries.set("rule1", new Set());
      }
      if (!theory.system.contraries.has("¬rule1")) {
        theory.system.contraries.set("¬rule1", new Set());
      }
      theory.system.contraries.get("rule1")!.add("¬rule1");
      theory.system.contraries.get("¬rule1")!.add("rule1");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      const undercuttingAttacks = attacks.filter(a => a.type === "undercutting");

      expect(undercuttingAttacks.length).toBe(1);
      expect(undercuttingAttacks[0].attacker.conclusion).toBe("¬rule1");
      expect(undercuttingAttacks[0].target.ruleId).toBe("d1");
    });

    it("should NOT allow undercutting of strict rules", () => {
      const theory = createTestTheory();
      theory.knowledgeBase.axioms.add("p");
      theory.knowledgeBase.premises.add("¬rule1");

      // p → q (strict, no name needed)
      addStrictRule(theory, "r1", ["p"], "q");

      const args = constructArguments(theory);
      const attacks = computeAttacks(args, theory);

      const undercuttingAttacks = attacks.filter(a => a.type === "undercutting");

      // Cannot undercut strict rules
      expect(undercuttingAttacks.length).toBe(0);
    });
  });
});

// ============================================================================
// DEFEAT COMPUTATION TESTS
// ============================================================================

describe("ASPIC+ Defeat Computation", () => {
  it("undercutting attacks always succeed as defeats", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");

    // p ⇒ q (with rule name "rule1")
    addDefeasibleRule(theory, "d1", ["p"], "q", "rule1");

    // Add ¬rule1 to language and axioms
    theory.system.language.add("¬rule1");
    theory.knowledgeBase.axioms.add("¬rule1");

    // Set up contrariness: rule1 ↔ ¬rule1
    if (!theory.system.contraries.has("rule1")) {
      theory.system.contraries.set("rule1", new Set());
    }
    if (!theory.system.contraries.has("¬rule1")) {
      theory.system.contraries.set("¬rule1", new Set());
    }
    theory.system.contraries.get("rule1")!.add("¬rule1");
    theory.system.contraries.get("¬rule1")!.add("rule1");

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");

    // Undercutting always succeeds
    expect(defeats.length).toBe(1);
    expect(defeats[0].attack.type).toBe("undercutting");
    expect(defeats[0].preferenceApplied).toBe(false);
  });

  it("undermining succeeds when attacker not less preferred", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");
    theory.knowledgeBase.premises.add("¬p");

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");

    // Both are premises (equal preference), so both attacks succeed (mutual defeat)
    expect(defeats.length).toBe(2);
    expect(defeats.every(d => d.preferenceApplied === true)).toBe(true);
  });

  it("rebutting fails when attacker is less preferred", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.premises.add("p");
    theory.knowledgeBase.premises.add("q");

    // p ⇒ r (rule d1)
    addDefeasibleRule(theory, "d1", ["p"], "r");

    // q ⇒ ¬r (rule d2)
    addDefeasibleRule(theory, "d2", ["q"], "¬r");

    // Preference: d1 preferred over d2
    theory.knowledgeBase.rulePreferences.push({
      preferred: "d1",
      dispreferred: "d2",
    });

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");

    const argR = args.find(a => a.conclusion === "r" && a.topRule?.ruleId === "d1");
    const argNotR = args.find(a => a.conclusion === "¬r" && a.topRule?.ruleId === "d2");

    // d2 (¬r) attacking d1 (r) should FAIL (d2 less preferred)
    const d2AttacksD1 = defeats.find(
      d => d.defeater.id === argNotR?.id && d.defeated.id === argR?.id
    );
    expect(d2AttacksD1).toBeUndefined();

    // d1 (r) attacking d2 (¬r) should SUCCEED (d1 preferred)
    const d1AttacksD2 = defeats.find(
      d => d.defeater.id === argR?.id && d.defeated.id === argNotR?.id
    );
    expect(d1AttacksD2).toBeDefined();
  });

  it("strict and firm arguments preferred over defeasible/plausible", () => {
    const theory = createTestTheory();
    theory.knowledgeBase.axioms.add("¬p"); // Strict & firm
    theory.knowledgeBase.premises.add("p"); // Plausible

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");

    const argNotP = args.find(a => a.conclusion === "¬p");
    const argP = args.find(a => a.conclusion === "p");

    // ¬p (axiom) defeating p (premise) should SUCCEED
    const axiomDefeats = defeats.find(
      d => d.defeater.id === argNotP?.id && d.defeated.id === argP?.id
    );
    expect(axiomDefeats).toBeDefined();

    // p (premise) attacking ¬p (axiom) should FAIL
    const premiseAttacks = defeats.find(
      d => d.defeater.id === argP?.id && d.defeated.id === argNotP?.id
    );
    expect(premiseAttacks).toBeUndefined();
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("ASPIC+ Integration Tests", () => {
  it("Example 1: Bird reasoning (Tweety)", () => {
    const theory = createEmptyTheory();

    // Language
    const formulas = ["bird", "penguin", "flies", "¬flies"];
    formulas.forEach(f => theory.system.language.add(f));
    addClassicalNegation(theory.system.contraries, theory.system.language);

    // Knowledge base
    theory.knowledgeBase.axioms.add("bird");
    theory.knowledgeBase.axioms.add("penguin");

    // Rules
    // bird ⇒ flies (r1)
    addDefeasibleRule(theory, "r1", ["bird"], "flies", "r1_name");

    // penguin ⇒ ¬flies (r2, preferred over r1)
    addDefeasibleRule(theory, "r2", ["penguin"], "¬flies", "r2_name");

    // Preference: r2 > r1 (more specific)
    theory.knowledgeBase.rulePreferences.push({
      preferred: "r2",
      dispreferred: "r1",
    });

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);
    const defeats = computeDefeats(attacks, theory, "last-link");

    // Should have arguments for: bird, penguin, flies, ¬flies
    expect(args.length).toBe(4);

    const argFlies = args.find(a => a.conclusion === "flies");
    const argNotFlies = args.find(a => a.conclusion === "¬flies");

    expect(argFlies).toBeDefined();
    expect(argNotFlies).toBeDefined();

    // argNotFlies should defeat argFlies (r2 preferred over r1)
    const notFliesWins = defeats.some(
      d => d.defeater.id === argNotFlies?.id && d.defeated.id === argFlies?.id
    );
    expect(notFliesWins).toBe(true);

    // argFlies should NOT defeat argNotFlies
    const fliesLoses = defeats.some(
      d => d.defeater.id === argFlies?.id && d.defeated.id === argNotFlies?.id
    );
    expect(fliesLoses).toBe(false);
  });

  it("Example 2: Multiple attack types", () => {
    const theory = createTestTheory();

    // KB
    theory.knowledgeBase.premises.add("p");
    theory.knowledgeBase.axioms.add("¬p");      // Undermines p

    // Rules
    // p ⇒ q (rule1)
    addDefeasibleRule(theory, "d1", ["p"], "q", "rule1");

    // Set up undercutter
    theory.system.language.add("¬rule1");
    theory.knowledgeBase.axioms.add("¬rule1");  // Undercuts rule1
    if (!theory.system.contraries.has("rule1")) {
      theory.system.contraries.set("rule1", new Set());
    }
    if (!theory.system.contraries.has("¬rule1")) {
      theory.system.contraries.set("¬rule1", new Set());
    }
    theory.system.contraries.get("rule1")!.add("¬rule1");
    theory.system.contraries.get("¬rule1")!.add("rule1");

    // ¬q (via strict rule from premise)
    theory.knowledgeBase.axioms.add("r");
    addStrictRule(theory, "s1", ["r"], "¬q");

    const args = constructArguments(theory);
    const attacks = computeAttacks(args, theory);

    // Should have multiple attack types
    const undermining = attacks.filter(a => a.type === "undermining");
    const rebutting = attacks.filter(a => a.type === "rebutting");
    const undercutting = attacks.filter(a => a.type === "undercutting");

    expect(undermining.length).toBeGreaterThan(0);
    expect(rebutting.length).toBeGreaterThan(0);
    expect(undercutting.length).toBeGreaterThan(0);
  });
});
