/**
 * lib/aspic/validation.ts
 * 
 * ASPIC+ Rationality Postulate Validation
 * 
 * Phase B: Axiom Consistency Validation
 * - Validates that Cl_Rs(K_n) is consistent (no contradictions in axiom closure)
 * 
 * Phase C: Transposition Closure (future)
 * - Validates that strict rules are closed under transposition
 */

import type { ArgumentationTheory } from "../aif/translation/aifToAspic";

/**
 * Validate axiom consistency (Rationality Postulate)
 * 
 * Requirement: Cl_Rs(K_n) must be consistent
 * - The strict closure of axioms cannot contain contradictions
 * - If both φ and ¬φ derivable from axioms via strict rules, system is irrational
 * 
 * @param theory - The ASPIC+ argumentation theory
 * @returns { valid: boolean, errors?: string[] }
 */
export function validateAxiomConsistency(theory: ArgumentationTheory): {
  valid: boolean;
  errors?: string[];
} {
  // ArgumentationTheory has flat structure, not nested
  const { axioms, strictRules, contraries } = theory;

  // If no axioms, trivially consistent
  if (!axioms || axioms.size === 0) {
    return { valid: true };
  }

  // If no strict rules, axioms cannot derive contradictions
  if (!strictRules || strictRules.length === 0) {
    // Still check direct contradictions in axiom set
    const errors: string[] = [];
    
    for (const axiom of axioms) {
      const axiomContraries = contraries.get(axiom) || new Set();
      
      for (const contrary of axiomContraries) {
        if (axioms.has(contrary)) {
          errors.push(
            `Direct contradiction in axioms: "${axiom}" and "${contrary}" are both axioms but are contraries`
          );
        }
      }
    }
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    return { valid: true };
  }

  // Phase C TODO: Compute strict closure when strict rules implemented
  // For now, we only have defeasible rules, so just check direct contradictions
  const errors: string[] = [];
  
  for (const axiom of axioms) {
    const axiomContraries = contraries.get(axiom) || new Set();
    
    for (const contrary of axiomContraries) {
      if (axioms.has(contrary)) {
        errors.push(
          `Direct contradiction in axioms: "${axiom}" and "${contrary}" are both axioms but are contraries`
        );
      }
    }
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Compute strict closure of a set of formulas (Phase C - TODO)
 * 
 * Cl_Rs(S) = smallest set containing S and closed under strict rules
 * 
 * @param formulas - Initial set of formulas
 * @param strictRules - Strict rules to apply
 * @returns Set of all formulas derivable via strict rules
 */
export function computeStrictClosure(
  formulas: Set<string>,
  strictRules: Array<{ antecedents: string[]; consequent: string }>
): Set<string> {
  const closure = new Set(formulas);
  let changed = true;

  while (changed) {
    changed = false;

    for (const rule of strictRules) {
      // Check if all antecedents are in closure
      const allAntecedentsPresent = rule.antecedents.every((ant) =>
        closure.has(ant)
      );

      if (allAntecedentsPresent && !closure.has(rule.consequent)) {
        closure.add(rule.consequent);
        changed = true;
      }
    }
  }

  return closure;
}

/**
 * Ensure strict rules are closed under transposition (Phase C - TODO)
 * 
 * For each rule φ₁,...,φₙ → ψ, add transposed rules:
 * φ₁,...,φᵢ₋₁,¬ψ,φᵢ₊₁,...,φₙ → ¬φᵢ for each i
 * 
 * @param strictRules - Strict rules to close
 * @returns Original + transposed rules
 */
export function ensureTranspositionClosure(
  strictRules: Array<{
    id: string;
    antecedents: string[];
    consequent: string;
    type: "strict";
  }>
): Array<{
  id: string;
  antecedents: string[];
  consequent: string;
  type: "strict";
}> {
  const transposed: typeof strictRules = [];

  for (const rule of strictRules) {
    const { antecedents, consequent } = rule;

    // For each antecedent, create transposed rule
    for (let i = 0; i < antecedents.length; i++) {
      const transposedAntecedents = [
        ...antecedents.slice(0, i),
        negateFormula(consequent), // ¬ψ replaces φᵢ
        ...antecedents.slice(i + 1),
      ];
      const transposedConsequent = negateFormula(antecedents[i]);

      const transposedRule = {
        id: `${rule.id}_transpose_${i}`,
        antecedents: transposedAntecedents,
        consequent: transposedConsequent,
        type: "strict" as const,
      };

      transposed.push(transposedRule);
    }
  }

  // Return original + transposed rules
  return [...strictRules, ...transposed];
}

/**
 * Negate a formula (Phase C - TODO: implement proper negation)
 * 
 * For now, simple string prefix approach.
 * Future: Parse logical structure and apply De Morgan's laws.
 * 
 * @param formula - Formula to negate
 * @returns Negated formula
 */
export function negateFormula(formula: string): string {
  const trimmed = formula.trim();
  
  // Check for existing negation symbols (¬, ~, NOT, not, !)
  const negSymbols = ['¬', '~', 'NOT ', 'not ', '!'];
  
  for (const negSymbol of negSymbols) {
    if (trimmed.startsWith(negSymbol)) {
      // Remove negation (double negation cancels out)
      return trimmed.slice(negSymbol.length).trim();
    }
  }
  
  // Check if formula is "simple" (no operators) or already parenthesized
  const needsParens = 
    trimmed.includes('→') || 
    trimmed.includes('∧') || 
    trimmed.includes('∨') || 
    trimmed.includes(' ') && !trimmed.startsWith('(');
  
  // Add negation (prefer ¬ symbol for consistency)
  if (needsParens && !trimmed.startsWith('(')) {
    return `¬(${trimmed})`;
  }
  return `¬${trimmed}`;
}

/**
 * Validate well-formedness (Rationality Postulate)
 * 
 * Requirement: If φ ∈ ¬̄ψ, then:
 * - ψ ∉ K_n (contraries cannot target axioms)
 * - ψ is not consequent of strict rule (contraries cannot target strict conclusions)
 * 
 * @param theory - The ASPIC+ argumentation theory
 * @returns { valid: boolean, errors?: string[] }
 */
export function validateWellFormedness(theory: ArgumentationTheory): {
  valid: boolean;
  errors?: string[];
} {
  // ArgumentationTheory has flat structure, not nested
  const { contraries, strictRules, axioms } = theory;

  const errors: string[] = [];

  // Collect strict rule conclusions
  const strictConclusions = new Set(
    strictRules.map((rule: { consequent: string }) => rule.consequent)
  );

  // Check each contrary relationship
  for (const [formula, contrarySet] of contraries.entries()) {
    for (const contrary of contrarySet) {
      // Check if contrary targets an axiom
      if (axioms.has(contrary)) {
        errors.push(
          `Well-formedness violation: "${formula}" is contrary to axiom "${contrary}"`
        );
      }

      // Check if contrary targets a strict rule conclusion
      if (strictConclusions.has(contrary)) {
        errors.push(
          `Well-formedness violation: "${formula}" is contrary to strict conclusion "${contrary}"`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
