/**
 * CQ to ASPIC+ Attack Mapping
 * 
 * This module translates Critical Questions into formal ASPIC+ attacks.
 * It implements the theoretical foundation from Modgil & Prakken 2013:
 * 
 * - CQ challenging premise → Undermining attack
 * - CQ challenging inference → Undercutting attack  
 * - CQ challenging conclusion → Rebutting attack
 * 
 * The mapping uses ArgumentScheme.aspicMapping and CriticalQuestion.aspicMapping
 * metadata to construct precise ASPIC+ attack relations.
 */

import type { Argument, Attack, ArgumentationTheory } from "./types";
import { addClassicalNegation } from "./attacks";

// ============================================================================
// TYPES
// ============================================================================

/**
 * CQ metadata structure (from database)
 */
export interface CQMetadata {
  cqKey: string;
  text: string;
  attackType: "UNDERMINES" | "UNDERCUTS" | "REBUTS";
  targetScope: "premise" | "inference" | "conclusion";
  aspicMapping?: {
    ruleId?: string;              // For UNDERCUTS (which rule to attack)
    premiseIndex?: number;         // For UNDERMINES (which premise to attack)
    defeasibleRuleRequired?: boolean; // Attack constraint
  };
}

/**
 * Argument scheme metadata (from database)
 */
export interface SchemeMetadata {
  key: string;
  name: string;
  aspicMapping?: {
    ruleType: "strict" | "defeasible";
    ruleId: string;
    preferenceLevel: number;
  };
}

/**
 * Result of CQ → ASPIC+ translation
 */
export interface CQAttackResult {
  attack: Attack | null;
  attackingArgument: Argument | null;
  targetArgument: Argument;
  cqMetadata: CQMetadata;
  reason: string; // Explanation of why attack was/wasn't created
}

// ============================================================================
// MAIN TRANSLATION FUNCTION
// ============================================================================

/**
 * Translate a Critical Question into an ASPIC+ attack
 * 
 * This is the main entry point for CQ → ASPIC+ mapping.
 * 
 * Algorithm:
 * 1. Validate CQ and target argument compatibility
 * 2. Route to appropriate attack constructor based on attackType
 * 3. Construct attacking argument (if possible)
 * 4. Return attack relation or null with explanation
 * 
 * @param cq - Critical question metadata
 * @param targetArg - Argument being challenged
 * @param theory - Current argumentation theory
 * @returns Attack result with explanation
 */
export function cqToAspicAttack(
  cq: CQMetadata,
  targetArg: Argument,
  theory: ArgumentationTheory
): CQAttackResult {
  // Validate inputs
  if (!cq.aspicMapping) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "CQ has no ASPIC+ mapping metadata",
    };
  }

  // Route to appropriate attack type
  switch (cq.attackType) {
    case "UNDERMINES":
      return constructUnderminingAttack(cq, targetArg, theory);
    
    case "UNDERCUTS":
      return constructUndercuttingAttack(cq, targetArg, theory);
    
    case "REBUTS":
      return constructRebuttingAttack(cq, targetArg, theory);
    
    default:
      return {
        attack: null,
        attackingArgument: null,
        targetArgument: targetArg,
        cqMetadata: cq,
        reason: `Unknown attack type: ${cq.attackType}`,
      };
  }
}

// ============================================================================
// UNDERMINING ATTACKS
// ============================================================================

/**
 * Construct an undermining attack from a CQ
 * 
 * Undermining attacks target ordinary premises (Kp).
 * 
 * Formalization (from ASPIC+ spec):
 * - Attack: A undermines B on φ if conc(A) ∈ φ̄ where φ ∈ Prem(B) ∩ Kp
 * - Success: Attack succeeds as defeat if A ⊀ B' (preference check)
 * 
 * @param cq - CQ with attackType='UNDERMINES'
 * @param targetArg - Argument being undermined
 * @param theory - Argumentation theory
 * @returns Attack result
 */
function constructUnderminingAttack(
  cq: CQMetadata,
  targetArg: Argument,
  theory: ArgumentationTheory
): CQAttackResult {
  const mapping = cq.aspicMapping!;

  // Identify target premise
  const targetPremise = identifyTargetPremise(cq, targetArg, mapping);
  if (!targetPremise) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Could not identify target premise for undermining",
    };
  }

  // Verify premise is ordinary (in Kp, not Kn or Ka)
  if (!theory.knowledgeBase.premises.has(targetPremise)) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: `Target premise '${targetPremise}' is not an ordinary premise (must be in Kp)`,
    };
  }

  // Construct attacking argument with conclusion = ¬premise
  const attackingArg = constructCounterPremiseArgument(
    targetPremise,
    cq,
    theory
  );

  if (!attackingArg) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Could not construct attacking argument for premise",
    };
  }

  // Create attack relation
  const attack: Attack = {
    attacker: attackingArg,
    attacked: targetArg,
    type: "undermining",
    target: {
      premise: targetPremise,
    },
    metadata: {
      cqId: cq.cqKey,
      cqText: cq.text,
    },
  };

  return {
    attack,
    attackingArgument: attackingArg,
    targetArgument: targetArg,
    cqMetadata: cq,
    reason: `Undermining attack on premise '${targetPremise}'`,
  };
}

/**
 * Identify which premise the CQ targets
 * 
 * Uses premiseIndex from aspicMapping if available,
 * otherwise attempts to infer from argument structure.
 * 
 * @param cq - Critical question
 * @param targetArg - Argument being attacked
 * @param mapping - ASPIC+ mapping metadata
 * @returns Target premise or null
 */
function identifyTargetPremise(
  cq: CQMetadata,
  targetArg: Argument,
  mapping: NonNullable<CQMetadata["aspicMapping"]>
): string | null {
  const premisesArray = Array.from(targetArg.premises);
  
  // Use explicit premiseIndex if provided
  if (typeof mapping.premiseIndex === "number") {
    const premise = premisesArray[mapping.premiseIndex];
    if (premise) {
      return premise;
    }
  }

  // Fallback: target first premise (common case for simple schemes)
  if (premisesArray.length > 0) {
    return premisesArray[0];
  }

  return null;
}

/**
 * Construct an argument that contradicts a premise
 * 
 * Creates a simple argument with conclusion = ¬premise.
 * Uses an assumption (Ka) to allow the attack to be defeasible.
 * 
 * @param premise - Premise to contradict
 * @param cq - Critical question context
 * @param theory - Argumentation theory
 * @returns Attacking argument or null
 */
function constructCounterPremiseArgument(
  premise: string,
  cq: CQMetadata,
  theory: ArgumentationTheory
): Argument | null {
  // Get contrary of premise
  const contrary = getContrary(premise, theory);
  if (!contrary) {
    return null;
  }

  // Create attacking argument
  // Structure: [assumption: ¬premise] ⊢ ¬premise
  const attackingArg: Argument = {
    id: `cq_undermine_${cq.cqKey}_${Date.now()}`,
    premises: new Set([contrary]),
    conclusion: contrary,
    defeasibleRules: new Set<string>(),
    topRule: undefined,
    subArguments: [],
    structure: {
      type: "premise",
      formula: contrary,
      source: "assumption",
    },
  };

  return attackingArg;
}

// ============================================================================
// UNDERCUTTING ATTACKS
// ============================================================================

/**
 * Construct an undercutting attack from a CQ
 * 
 * Undercutting attacks target defeasible rules.
 * 
 * Formalization (from ASPIC+ spec):
 * - Attack: A undercuts B on r if conc(A) ∈ r̄ where r ∈ DefRules(B)
 * - Success: Always succeeds (no preference check)
 * - Rule naming: r̄ = {¬name(r)} where name: Rd → L
 * 
 * @param cq - CQ with attackType='UNDERCUTS'
 * @param targetArg - Argument being undercut
 * @param theory - Argumentation theory
 * @returns Attack result
 */
function constructUndercuttingAttack(
  cq: CQMetadata,
  targetArg: Argument,
  theory: ArgumentationTheory
): CQAttackResult {
  const mapping = cq.aspicMapping!;

  // Verify target has defeasible rules
  if (
    mapping.defeasibleRuleRequired &&
    targetArg.defeasibleRules.size === 0
  ) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Target argument has no defeasible rules to undercut",
    };
  }

  // Identify target rule
  const targetRule = identifyTargetRule(cq, targetArg, mapping, theory);
  if (!targetRule) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Could not identify target rule for undercutting",
    };
  }

  // Construct attacking argument with conclusion = ¬name(rule)
  const attackingArg = constructRuleAttackArgument(targetRule, cq, theory);

  if (!attackingArg) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Could not construct attacking argument for rule",
    };
  }

  // Create attack relation
  const attack: Attack = {
    attacker: attackingArg,
    attacked: targetArg,
    type: "undercutting",
    target: {
      ruleId: targetRule.id,
    },
    metadata: {
      cqId: cq.cqKey,
      cqText: cq.text,
    },
  };

  return {
    attack,
    attackingArgument: attackingArg,
    targetArgument: targetArg,
    cqMetadata: cq,
    reason: `Undercutting attack on rule '${targetRule.id}'`,
  };
}

/**
 * Identify which defeasible rule the CQ targets
 * 
 * Uses ruleId from aspicMapping if available,
 * otherwise targets the top rule of the argument.
 * 
 * @param cq - Critical question
 * @param targetArg - Argument being attacked
 * @param mapping - ASPIC+ mapping metadata
 * @param theory - Argumentation theory
 * @returns Target rule or null
 */
function identifyTargetRule(
  cq: CQMetadata,
  targetArg: Argument,
  mapping: NonNullable<CQMetadata["aspicMapping"]>,
  theory: ArgumentationTheory
): { id: string; antecedents: string[]; consequent: string } | null {
  // Use explicit ruleId if provided
  if (mapping.ruleId) {
    const rule = theory.system.defeasibleRules.find(
      (r) => r.id === mapping.ruleId
    );
    if (rule) {
      return rule;
    }
  }

  // Fallback: target top rule if it's defeasible
  if (targetArg.topRule) {
    const rule = theory.system.defeasibleRules.find(
      (r) => r.id === targetArg.topRule?.ruleId
    );
    if (rule) {
      return rule;
    }
  }

  // Last resort: use first defeasible rule from argument
  const defRulesArray = Array.from(targetArg.defeasibleRules);
  if (defRulesArray.length > 0) {
    const ruleId = defRulesArray[0];
    const rule = theory.system.defeasibleRules.find((r) => r.id === ruleId);
    if (rule) {
      return rule;
    }
  }

  return null;
}

/**
 * Construct an argument that attacks a rule's applicability
 * 
 * Creates an argument with conclusion = ¬name(rule).
 * The rule name is the rule's identifier in the language.
 * 
 * @param rule - Rule to attack
 * @param cq - Critical question context
 * @param theory - Argumentation theory
 * @returns Attacking argument or null
 */
function constructRuleAttackArgument(
  rule: { id: string; antecedents: string[]; consequent: string },
  cq: CQMetadata,
  theory: ArgumentationTheory
): Argument | null {
  // Rule naming: name(r) = r.id
  const ruleName = rule.id;
  
  // Get contrary of rule name
  const contrary = getContrary(ruleName, theory);
  if (!contrary) {
    // If no contrary exists, create one
    const negatedRuleName = `¬${ruleName}`;
    
    // Add to theory's language and contraries
    theory.system.language.add(negatedRuleName);
    addClassicalNegation(theory.system.contraries, new Set([ruleName]));
    
    // Create attacking argument
    const attackingArg: Argument = {
      id: `cq_undercut_${cq.cqKey}_${Date.now()}`,
      premises: new Set([negatedRuleName]),
      conclusion: negatedRuleName,
      defeasibleRules: new Set<string>(),
      topRule: undefined,
      subArguments: [],
      structure: {
        type: "premise",
        formula: negatedRuleName,
        source: "assumption",
      },
    };

    return attackingArg;
  }

  // Create attacking argument with existing contrary
  const attackingArg: Argument = {
    id: `cq_undercut_${cq.cqKey}_${Date.now()}`,
    premises: new Set([contrary]),
    conclusion: contrary,
    defeasibleRules: new Set<string>(),
    topRule: undefined,
    subArguments: [],
    structure: {
      type: "premise",
      formula: contrary,
      source: "assumption",
    },
  };

  return attackingArg;
}

// ============================================================================
// REBUTTING ATTACKS
// ============================================================================

/**
 * Construct a rebutting attack from a CQ
 * 
 * Rebutting attacks target defeasible conclusions.
 * 
 * Formalization (from ASPIC+ spec):
 * - Attack: A rebuts B if ∃B' ∈ Sub(B) where:
 *   - conc(A) ∈ conc(B')̄
 *   - B' is defeasible (TopRule(B') is defeasible)
 * - Success: Attack succeeds as defeat if A ⊀ B' (preference check)
 * 
 * @param cq - CQ with attackType='REBUTS'
 * @param targetArg - Argument being rebutted
 * @param theory - Argumentation theory
 * @returns Attack result
 */
function constructRebuttingAttack(
  cq: CQMetadata,
  targetArg: Argument,
  theory: ArgumentationTheory
): CQAttackResult {
  // Verify target is defeasible (has at least one defeasible rule)
  if (targetArg.defeasibleRules.size === 0) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Cannot rebut strict arguments (target must be defeasible)",
    };
  }

  // Construct attacking argument with conclusion = ¬conc(target)
  const attackingArg = constructCounterConclusionArgument(
    targetArg.conclusion,
    cq,
    theory
  );

  if (!attackingArg) {
    return {
      attack: null,
      attackingArgument: null,
      targetArgument: targetArg,
      cqMetadata: cq,
      reason: "Could not construct attacking argument for conclusion",
    };
  }

  // Create attack relation
  const attack: Attack = {
    attacker: attackingArg,
    attacked: targetArg,
    type: "rebutting",
    target: {
      subArgument: targetArg, // Rebutting targets the argument itself
    },
    metadata: {
      cqId: cq.cqKey,
      cqText: cq.text,
    },
  };

  return {
    attack,
    attackingArgument: attackingArg,
    targetArgument: targetArg,
    cqMetadata: cq,
    reason: `Rebutting attack on conclusion '${targetArg.conclusion}'`,
  };
}

/**
 * Construct an argument that contradicts a conclusion
 * 
 * Creates an argument with conclusion = ¬conclusion.
 * 
 * @param conclusion - Conclusion to contradict
 * @param cq - Critical question context
 * @param theory - Argumentation theory
 * @returns Attacking argument or null
 */
function constructCounterConclusionArgument(
  conclusion: string,
  cq: CQMetadata,
  theory: ArgumentationTheory
): Argument | null {
  // Get contrary of conclusion
  const contrary = getContrary(conclusion, theory);
  if (!contrary) {
    return null;
  }

  // Create attacking argument
  const attackingArg: Argument = {
    id: `cq_rebut_${cq.cqKey}_${Date.now()}`,
    premises: new Set([contrary]),
    conclusion: contrary,
    defeasibleRules: new Set<string>(),
    topRule: undefined,
    subArguments: [],
    structure: {
      type: "premise",
      formula: contrary,
      source: "assumption",
    },
  };

  return attackingArg;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the contrary of a literal from the theory
 * 
 * @param literal - Literal to find contrary for
 * @param theory - Argumentation theory
 * @returns Contrary or null
 */
function getContrary(
  literal: string,
  theory: ArgumentationTheory
): string | null {
  const contraries = theory.system.contraries.get(literal);
  if (contraries && contraries.size > 0) {
    // Return first contrary (arbitrary choice if multiple)
    return Array.from(contraries)[0];
  }

  // Try classical negation pattern
  if (literal.startsWith("¬")) {
    return literal.slice(1);
  } else {
    return `¬${literal}`;
  }
}

/**
 * Batch translate multiple CQs into ASPIC+ attacks
 * 
 * Useful for processing all CQs for an argument at once.
 * 
 * @param cqs - Array of critical questions
 * @param targetArg - Argument being challenged
 * @param theory - Argumentation theory
 * @returns Array of attack results
 */
export function batchCqToAspicAttacks(
  cqs: CQMetadata[],
  targetArg: Argument,
  theory: ArgumentationTheory
): CQAttackResult[] {
  return cqs.map((cq) => cqToAspicAttack(cq, targetArg, theory));
}

/**
 * Extract successful attacks from CQ attack results
 * 
 * Filters results to only include those that produced valid attacks.
 * 
 * @param results - CQ attack results
 * @returns Array of successful attacks
 */
export function extractSuccessfulAttacks(
  results: CQAttackResult[]
): Attack[] {
  return results
    .filter((r) => r.attack !== null)
    .map((r) => r.attack!);
}

/**
 * Generate summary report of CQ → ASPIC+ translation
 * 
 * Useful for debugging and validation.
 * 
 * @param results - CQ attack results
 * @returns Human-readable summary
 */
export function generateCQMappingReport(results: CQAttackResult[]): string {
  const total = results.length;
  const successful = results.filter((r) => r.attack !== null).length;
  const failed = total - successful;

  let report = "CQ → ASPIC+ Attack Mapping Report\n";
  report += "=" .repeat(50) + "\n\n";
  report += `Total CQs processed: ${total}\n`;
  report += `Successful attacks: ${successful}\n`;
  report += `Failed translations: ${failed}\n\n`;

  if (failed > 0) {
    report += "Failed Translations:\n";
    report += "-".repeat(50) + "\n";
    results
      .filter((r) => r.attack === null)
      .forEach((r) => {
        report += `CQ: ${r.cqMetadata.cqKey} (${r.cqMetadata.attackType})\n`;
        report += `Reason: ${r.reason}\n\n`;
      });
  }

  if (successful > 0) {
    report += "Successful Attacks:\n";
    report += "-".repeat(50) + "\n";
    results
      .filter((r) => r.attack !== null)
      .forEach((r) => {
        report += `CQ: ${r.cqMetadata.cqKey}\n`;
        report += `Type: ${r.attack!.type}\n`;
        report += `Attacker: ${r.attackingArgument!.id}\n`;
        report += `Target: ${r.targetArgument.id}\n`;
        report += `Reason: ${r.reason}\n\n`;
      });
  }

  return report;
}
