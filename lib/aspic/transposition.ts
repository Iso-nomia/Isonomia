/**
 * ASPIC+ Transposition Closure
 * 
 * Validates and generates contrapositive rules for strict rules.
 * 
 * Theoretical Foundation:
 * - An argumentation system is closed under transposition iff for every strict rule,
 *   all its contrapositive forms are also in the strict rule set
 * - Required for rationality postulates (Caminada & Amgoud 2007)
 * - Enables modus tollens and proof by contradiction patterns
 * 
 * @see Modgil & Prakken (2013), Section 3.2
 * @see lib/aspic/validation.ts (original ensureTranspositionClosure implementation)
 */

import { Rule } from "./types";
import { negateFormula } from "./validation";

/**
 * Result of transposition closure validation
 */
export interface TranspositionValidation {
  /** Whether rule set is closed under transposition */
  isClosed: boolean;
  
  /** Missing transposed rules that should exist */
  missingRules: TransposedRule[];
  
  /** Total number of transposed rules required */
  totalRequired: number;
  
  /** Total number of transposed rules present */
  totalPresent: number;
  
  /** Summary message */
  message: string;
}

/**
 * A transposed rule with metadata about its origin
 */
export interface TransposedRule extends Rule {
  /** Original rule ID this was transposed from */
  sourceRuleId: string;
  
  /** Which antecedent index was transposed (0-based) */
  transposedIndex: number;
  
  /** Human-readable explanation of the transposition */
  explanation: string;
}

/**
 * Validate whether a set of strict rules satisfies transposition closure
 * 
 * For each strict rule φ₁,...,φₙ → ψ, checks if all n transposed rules exist:
 * - φ₁,...,φᵢ₋₁,¬ψ,φᵢ₊₁,...,φₙ → ¬φᵢ (for each i ∈ {1...n})
 * 
 * @param strictRules - Array of strict rules to validate
 * @returns Validation result with missing rules
 * 
 * @example
 * ```typescript
 * const rules = [{ id: "r1", antecedents: ["p"], consequent: "q", type: "strict" }];
 * const validation = validateTranspositionClosure(rules);
 * // validation.isClosed === false
 * // validation.missingRules[0] === { antecedents: ["¬q"], consequent: "¬p", ... }
 * ```
 */
export function validateTranspositionClosure(
  strictRules: Rule[]
): TranspositionValidation {
  const missingRules: TransposedRule[] = [];
  let totalRequired = 0;
  let totalPresent = 0;

  // For each strict rule, check if all transpositions exist
  for (const rule of strictRules) {
    const { id, antecedents, consequent } = rule;
    
    // Skip already-transposed rules to avoid infinite recursion
    if (id.includes("_transpose_")) continue;
    
    // Each rule requires n transpositions (one per antecedent)
    totalRequired += antecedents.length;

    // Check each possible transposition
    for (let i = 0; i < antecedents.length; i++) {
      const transposedId = `${id}_transpose_${i}`;
      
      // Build expected transposed rule
      const expectedAntecedents = [
        ...antecedents.slice(0, i),        // Keep antecedents before i
        negateFormula(consequent),         // Replace antecedent i with ¬consequent
        ...antecedents.slice(i + 1),       // Keep antecedents after i
      ];
      
      const expectedConsequent = negateFormula(antecedents[i]);
      
      // Check if this transposed rule exists in the rule set
      const exists = strictRules.some(r =>
        // Match by ID or by structural equivalence
        r.id === transposedId ||
        (
          arraysEqual(r.antecedents, expectedAntecedents) &&
          r.consequent === expectedConsequent
        )
      );
      
      if (exists) {
        totalPresent++;
      } else {
        // Missing - add to list with metadata
        const otherAntecedents = antecedents.filter((_, idx) => idx !== i);
        const explanation = otherAntecedents.length > 0
          ? `If ${otherAntecedents.join(", ")} and ¬(${consequent}), then ¬(${antecedents[i]})`
          : `If ¬(${consequent}), then ¬(${antecedents[i]})`;
        
        missingRules.push({
          id: transposedId,
          antecedents: expectedAntecedents,
          consequent: expectedConsequent,
          type: "strict",
          sourceRuleId: id,
          transposedIndex: i,
          explanation,
        });
      }
    }
  }

  const isClosed = missingRules.length === 0;
  const message = isClosed
    ? "✅ Strict rules are closed under transposition"
    : `⚠️ ${missingRules.length} transposed rule${missingRules.length !== 1 ? "s" : ""} missing`;

  return {
    isClosed,
    missingRules,
    totalRequired,
    totalPresent,
    message,
  };
}

/**
 * Generate all transposed rules for a single strict rule
 * 
 * For a rule with n antecedents, generates n transposed rules
 * 
 * @param rule - The strict rule to transpose
 * @returns Array of transposed rules
 * @throws Error if rule is not strict type
 * 
 * @example
 * ```typescript
 * const rule = { id: "mp", antecedents: ["p", "p→q"], consequent: "q", type: "strict" };
 * const transposed = generateTranspositions(rule);
 * // transposed[0]: ¬q, p→q → ¬p  (modus tollens)
 * // transposed[1]: p, ¬q → ¬(p→q)
 * ```
 */
export function generateTranspositions(rule: Rule): TransposedRule[] {
  if (rule.type !== "strict") {
    throw new Error(`Cannot transpose non-strict rule: ${rule.id} (type: ${rule.type})`);
  }
  
  const transposed: TransposedRule[] = [];
  const { id, antecedents, consequent } = rule;
  
  for (let i = 0; i < antecedents.length; i++) {
    const otherAntecedents = antecedents.filter((_, idx) => idx !== i);
    const explanation = otherAntecedents.length > 0
      ? `Contrapositive of rule ${id} on antecedent ${i + 1}: "${antecedents[i]}". If ${otherAntecedents.join(", ")} and ¬(${consequent}), then ¬(${antecedents[i]})`
      : `Contrapositive of rule ${id}: If ¬(${consequent}), then ¬(${antecedents[i]})`;
    
    const transposedRule: TransposedRule = {
      id: `${id}_transpose_${i}`,
      antecedents: [
        ...antecedents.slice(0, i),
        negateFormula(consequent),
        ...antecedents.slice(i + 1),
      ],
      consequent: negateFormula(antecedents[i]),
      type: "strict",
      sourceRuleId: id,
      transposedIndex: i,
      explanation,
    };
    
    transposed.push(transposedRule);
  }
  
  return transposed;
}

/**
 * Apply transposition closure to a set of strict rules
 * 
 * Generates all missing transposed rules and returns the closed set.
 * This is idempotent - applying it twice gives the same result.
 * 
 * @param strictRules - Original strict rules
 * @returns Closed set (original + transposed rules)
 * 
 * @example
 * ```typescript
 * const rules = [{ id: "r1", antecedents: ["p"], consequent: "q", type: "strict" }];
 * const closed = applyTranspositionClosure(rules);
 * // closed.length === 2 (original + 1 transposition)
 * 
 * const validation = validateTranspositionClosure(closed);
 * // validation.isClosed === true
 * ```
 */
export function applyTranspositionClosure(strictRules: Rule[]): Rule[] {
  const allRules: Rule[] = [...strictRules];
  const seen = new Set<string>(strictRules.map(r => r.id));
  
  // For each original rule (not already transposed)
  for (const rule of strictRules) {
    // Skip already transposed rules to avoid duplicates
    if (rule.id.includes("_transpose_")) continue;
    
    // Generate transpositions
    const transposedRules = generateTranspositions(rule);
    
    // Add transpositions that don't already exist
    for (const tr of transposedRules) {
      if (!seen.has(tr.id)) {
        allRules.push(tr);
        seen.add(tr.id);
      }
    }
  }
  
  return allRules;
}

/**
 * Get human-readable summary of transposition closure status
 * 
 * @param validation - Validation result
 * @returns Formatted summary string
 */
export function getTranspositionSummary(validation: TranspositionValidation): string {
  if (validation.isClosed) {
    return "All strict rules are closed under transposition. ✅";
  }
  
  const { missingRules, totalRequired, totalPresent } = validation;
  const percentage = totalRequired > 0
    ? Math.round((totalPresent / totalRequired) * 100)
    : 0;
  
  return `${percentage}% complete: ${totalPresent}/${totalRequired} transpositions present. ${missingRules.length} missing.`;
}

/**
 * Check if two formula arrays are structurally equal
 * Helper for validation logic
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}
