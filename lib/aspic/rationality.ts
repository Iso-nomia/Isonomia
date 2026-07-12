/**
 * ASPIC+ Rationality Postulates
 * 
 * Implements rationality checking from Caminada & Amgoud (2007):
 * "On the evaluation of argumentation formalisms"
 * 
 * A "rational" argumentation system must satisfy:
 * 1. Sub-argument closure
 * 2. Closure under strict rules
 * 3. Direct consistency
 * 4. Indirect consistency
 * 
 * Necessary conditions for rationality:
 * - Theory must be closed under transposition OR contraposition
 * - Axioms must be indirectly consistent
 * - Preferences must be "reasonable"
 * - Theory must be well-formed
 */

import type {
  Argument,
  ArgumentationTheory,
  Rule,
  RationalityCheck,
  WellDefinedCheck,
} from "./types";
import type { GroundedExtension } from "./semantics";
import { getAllSubArguments } from "./arguments";

// ============================================================================
// RATIONALITY POSTULATES
// ============================================================================

/**
 * Check all rationality postulates for a grounded extension
 * 
 * @param extension Grounded extension to check
 * @param args All arguments in the theory
 * @param theory Argumentation theory
 * @returns Rationality check results
 */
export function checkRationalityPostulates(
  extension: GroundedExtension,
  args: Argument[],
  theory: ArgumentationTheory
): RationalityCheck {
  // Get arguments in the extension
  const extensionArgs = args.filter((arg) => extension.inArguments.has(arg.id));

  // Check each postulate
  const subArgResult = checkSubArgumentClosure(extensionArgs);
  const strictResult = checkStrictClosure(extensionArgs, theory);
  const directResult = checkDirectConsistency(extensionArgs, theory);
  const indirectResult = checkIndirectConsistency(extensionArgs, theory);

  // Collect all violations
  const violations: Array<{
    postulate: keyof Omit<RationalityCheck, "violations">;
    description: string;
    evidence: any;
  }> = [];

  if (!subArgResult.satisfied) {
    violations.push({
      postulate: "subArgumentClosure",
      description: "Sub-argument closure violated",
      evidence: subArgResult.violations,
    });
  }

  if (!strictResult.satisfied) {
    violations.push({
      postulate: "strictClosure",
      description: "Closure under strict rules violated",
      evidence: strictResult.violations,
    });
  }

  if (!directResult.satisfied) {
    violations.push({
      postulate: "directConsistency",
      description: "Direct consistency violated",
      evidence: directResult.violations,
    });
  }

  if (!indirectResult.satisfied) {
    violations.push({
      postulate: "indirectConsistency",
      description: "Indirect consistency violated",
      evidence: indirectResult.violations,
    });
  }

  return {
    subArgumentClosure: subArgResult.satisfied,
    strictClosure: strictResult.satisfied,
    directConsistency: directResult.satisfied,
    indirectConsistency: indirectResult.satisfied,
    violations,
  };
}

/**
 * Postulate 1: Sub-argument Closure
 * 
 * If A ∈ E, then all sub(A) ⊆ E
 * 
 * Intuition: If an argument is justified, all arguments it depends on
 * must also be justified.
 * 
 * @param extensionArgs Arguments in the extension
 * @returns Check result with violations
 */
export function checkSubArgumentClosure(
  extensionArgs: Argument[]
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];
  const extensionIds = new Set(extensionArgs.map((a) => a.id));

  for (const arg of extensionArgs) {
    const subArgs = getAllSubArguments(arg);

    for (const subArg of subArgs) {
      if (!extensionIds.has(subArg.id)) {
        violations.push(
          `Argument ${arg.id} (conclusion: ${arg.conclusion}) is in extension, ` +
          `but sub-argument ${subArg.id} (conclusion: ${subArg.conclusion}) is not`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Postulate 2: Closure under Strict Rules
 * 
 * If all antecedents of a strict rule r ∈ Rs are in Conc(E),
 * then the consequent of r must be in Conc(E).
 * 
 * Intuition: The extension should be closed under logical consequence
 * (for strict rules).
 * 
 * @param extensionArgs Arguments in the extension
 * @param theory Argumentation theory
 * @returns Check result with violations
 */
export function checkStrictClosure(
  extensionArgs: Argument[],
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // Get all conclusions in the extension
  const conclusions = new Set(extensionArgs.map((a) => a.conclusion));

  // Check each strict rule
  for (const rule of theory.system.strictRules) {
    // Check if all antecedents are in Conc(E)
    const allAntecedentsPresent = rule.antecedents.every((ant) =>
      conclusions.has(ant)
    );

    if (allAntecedentsPresent) {
      // Consequent must be in Conc(E)
      if (!conclusions.has(rule.consequent)) {
        violations.push(
          `Strict rule ${rule.id}: All antecedents [${rule.antecedents.join(", ")}] ` +
          `are in extension, but consequent '${rule.consequent}' is not`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Postulate 3: Direct Consistency
 * 
 * No φ, ψ ∈ Conc(E) where ψ ∈ φ̄
 * 
 * Intuition: The extension should not contain contradictions.
 * 
 * @param extensionArgs Arguments in the extension
 * @param theory Argumentation theory
 * @returns Check result with violations
 */
export function checkDirectConsistency(
  extensionArgs: Argument[],
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];
  const conclusions = extensionArgs.map((a) => a.conclusion);

  // Check all pairs
  for (let i = 0; i < conclusions.length; i++) {
    for (let j = i + 1; j < conclusions.length; j++) {
      const phi = conclusions[i];
      const psi = conclusions[j];

      // Check if phi and psi are contraries
      const phiContraries = theory.system.contraries.get(phi);
      const psiContraries = theory.system.contraries.get(psi);

      if (phiContraries?.has(psi)) {
        violations.push(
          `Extension contains contradictory conclusions: '${phi}' and '${psi}'`
        );
      } else if (psiContraries?.has(phi)) {
        violations.push(
          `Extension contains contradictory conclusions: '${psi}' and '${phi}'`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Postulate 4: Indirect Consistency
 * 
 * Cls(Conc(E)) is directly consistent, where Cls is closure under strict rules.
 * 
 * Intuition: Even after applying all strict rules to the extension conclusions,
 * no contradictions should arise.
 * 
 * @param extensionArgs Arguments in the extension
 * @param theory Argumentation theory
 * @returns Check result with violations
 */
export function checkIndirectConsistency(
  extensionArgs: Argument[],
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // Compute closure under strict rules
  const closure = computeStrictClosure(extensionArgs, theory);

  // Check direct consistency of closure
  const closureArray = Array.from(closure);
  for (let i = 0; i < closureArray.length; i++) {
    for (let j = i + 1; j < closureArray.length; j++) {
      const phi = closureArray[i];
      const psi = closureArray[j];

      const phiContraries = theory.system.contraries.get(phi);
      const psiContraries = theory.system.contraries.get(psi);

      if (phiContraries?.has(psi)) {
        violations.push(
          `Strict closure contains contradictory formulas: '${phi}' and '${psi}'`
        );
      } else if (psiContraries?.has(phi)) {
        violations.push(
          `Strict closure contains contradictory formulas: '${psi}' and '${phi}'`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Compute closure under strict rules
 * 
 * Repeatedly apply strict rules until no new formulas can be derived.
 * 
 * @param extensionArgs Arguments in the extension
 * @param theory Argumentation theory
 * @returns Set of formulas in the closure
 */
function computeStrictClosure(
  extensionArgs: Argument[],
  theory: ArgumentationTheory
): Set<string> {
  const closure = new Set(extensionArgs.map((a) => a.conclusion));
  let changed = true;
  const maxIterations = 1000; // Safety limit
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const rule of theory.system.strictRules) {
      // Check if all antecedents are in closure
      const applicable = rule.antecedents.every((ant) => closure.has(ant));

      if (applicable && !closure.has(rule.consequent)) {
        closure.add(rule.consequent);
        changed = true;
      }
    }
  }

  return closure;
}

// ============================================================================
// WELL-FORMEDNESS CHECKS
// ============================================================================

/**
 * Check if argumentation theory is well-formed
 * 
 * Well-formedness conditions (necessary for rationality):
 * 1. Axioms are indirectly consistent
 * 2. If φ ∈ ψ̄, then ψ ∉ Kn and ψ not consequent of strict rule
 * 3. Preferences are "reasonable" (strict & firm > defeasible & plausible)
 * 
 * @param theory Argumentation theory
 * @returns Well-formedness check results
 */
export function checkWellFormedness(
  theory: ArgumentationTheory
): WellDefinedCheck {
  const axiomConsistencyResult = checkAxiomConsistency(theory);
  const contrariesResult = checkContraryWellFormedness(theory);
  const preferencesResult = checkReasonablePreferences(theory);

  // Check closure properties
  const transposition = checkTranspositionClosure(theory);
  const contraposition = checkContrapositionClosure(theory);

  let closureProperty: "transposition" | "contraposition" | "none" = "none";
  if (transposition.satisfied) closureProperty = "transposition";
  else if (contraposition.satisfied) closureProperty = "contraposition";

  // Collect all issues
  const issues: string[] = [
    ...axiomConsistencyResult.violations,
    ...contrariesResult.violations,
    ...preferencesResult.violations,
    ...transposition.violations,
    ...contraposition.violations,
  ];

  const isWellDefined =
    axiomConsistencyResult.satisfied &&
    contrariesResult.satisfied &&
    preferencesResult.satisfied &&
    closureProperty !== "none";

  return {
    closureProperty,
    axiomConsistency: axiomConsistencyResult.satisfied,
    wellFormedness: contrariesResult.satisfied,
    reasonableOrdering: preferencesResult.satisfied,
    isWellDefined,
    issues,
  };
}

/**
 * Check if axioms are consistent (directly and indirectly)
 * 
 * @param theory Argumentation theory
 * @returns Check result
 */
function checkAxiomConsistency(
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // Direct consistency
  const axioms = Array.from(theory.knowledgeBase.axioms);
  for (let i = 0; i < axioms.length; i++) {
    for (let j = i + 1; j < axioms.length; j++) {
      const phi = axioms[i];
      const psi = axioms[j];

      const phiContraries = theory.system.contraries.get(phi);
      if (phiContraries?.has(psi)) {
        violations.push(
          `Axioms directly inconsistent: '${phi}' and '${psi}' are contraries`
        );
      }
    }
  }

  // Indirect consistency (closure under strict rules)
  const closure = new Set(axioms);
  let changed = true;
  let iteration = 0;
  const maxIterations = 1000;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    for (const rule of theory.system.strictRules) {
      const applicable = rule.antecedents.every((ant) => closure.has(ant));
      if (applicable && !closure.has(rule.consequent)) {
        closure.add(rule.consequent);
        changed = true;
      }
    }
  }

  // Check closure for contradictions
  const closureArray = Array.from(closure);
  for (let i = 0; i < closureArray.length; i++) {
    for (let j = i + 1; j < closureArray.length; j++) {
      const phi = closureArray[i];
      const psi = closureArray[j];

      const phiContraries = theory.system.contraries.get(phi);
      if (phiContraries?.has(psi)) {
        violations.push(
          `Axioms indirectly inconsistent: '${phi}' and '${psi}' derivable but contrary`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Check contrary well-formedness constraint
 * 
 * If φ ∈ ψ̄, then:
 * - ψ ∉ Kn (not an axiom)
 * - ψ is not the consequent of any strict rule
 * 
 * Rationale: Axioms and strict conclusions are infallible,
 * so they cannot have contraries.
 * 
 * @param theory Argumentation theory
 * @returns Check result
 */
function checkContraryWellFormedness(
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // Get all strict consequents
  const strictConsequents = new Set(
    theory.system.strictRules.map((r) => r.consequent)
  );

  // Check each contrary pair
  for (const [phi, contraries] of theory.system.contraries.entries()) {
    for (const psi of contraries) {
      // Check if psi is an axiom
      if (theory.knowledgeBase.axioms.has(psi)) {
        violations.push(
          `Contrary constraint violated: '${psi}' is an axiom but has contrary '${phi}'`
        );
      }

      // Check if psi is a strict consequent
      if (strictConsequents.has(psi)) {
        violations.push(
          `Contrary constraint violated: '${psi}' is a strict rule consequent but has contrary '${phi}'`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Check if preferences are "reasonable"
 * 
 * Reasonable ordering: Strict & firm arguments should be preferred
 * over defeasible & plausible arguments.
 * 
 * In practice, this is enforced by the defeat computation (defeats.ts),
 * but we can validate the preference structure here.
 * 
 * @param theory Argumentation theory
 * @returns Check result
 */
function checkReasonablePreferences(
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check that no strict rules are marked as dispreferred
  const strictRuleIds = new Set(theory.system.strictRules.map((r) => r.id));

  for (const pref of theory.knowledgeBase.rulePreferences) {
    if (strictRuleIds.has(pref.dispreferred)) {
      violations.push(
        `Unreasonable preference: Strict rule '${pref.dispreferred}' ` +
        `marked as dispreferred to '${pref.preferred}'`
      );
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

// ============================================================================
// CLOSURE CHECKING (Transposition & Contraposition)
// ============================================================================

/**
 * Check if theory is closed under transposition
 * 
 * Transposition: If (φ₁, ..., φₙ → ψ) ∈ Rs, then (φ₁, ..., φₙ, ψ̄ → φ̄ᵢ) ∈ Rs
 * for each i ∈ {1, ..., n}
 * 
 * @param theory Argumentation theory
 * @returns Check result
 */
export function checkTranspositionClosure(
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // For each strict rule, check all transpositions exist
  for (const rule of theory.system.strictRules) {
    for (let i = 0; i < rule.antecedents.length; i++) {
      const targetAntecedent = rule.antecedents[i];

      // Get contrary of target antecedent
      const targetContraries = theory.system.contraries.get(targetAntecedent);
      if (!targetContraries || targetContraries.size === 0) {
        continue; // No contraries, skip
      }

      const targetContrary = Array.from(targetContraries)[0]; // Use first contrary

      // Get contrary of consequent
      const consequentContraries = theory.system.contraries.get(rule.consequent);
      if (!consequentContraries || consequentContraries.size === 0) {
        continue; // No contraries, skip
      }

      const consequentContrary = Array.from(consequentContraries)[0];

      // Build expected transposed rule
      const transposedAntecedents = [
        ...rule.antecedents.filter((_, idx) => idx !== i),
        consequentContrary,
      ];

      // Check if transposed rule exists
      const transposedExists = theory.system.strictRules.some(
        (r) =>
          r.consequent === targetContrary &&
          r.antecedents.length === transposedAntecedents.length &&
          r.antecedents.every((ant) => transposedAntecedents.includes(ant))
      );

      if (!transposedExists) {
        violations.push(
          `Missing transposition of rule ${rule.id}: ` +
          `Expected rule with antecedents [${transposedAntecedents.join(", ")}] → ${targetContrary}`
        );
      }
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

/**
 * Check if theory is closed under contraposition
 * 
 * Contraposition: If (φ → ψ) ∈ Rs, then (ψ̄ → φ̄) ∈ Rs
 * 
 * Note: Only applies to unary strict rules (single antecedent)
 * 
 * @param theory Argumentation theory
 * @returns Check result
 */
export function checkContrapositionClosure(
  theory: ArgumentationTheory
): { satisfied: boolean; violations: string[] } {
  const violations: string[] = [];

  // Check each unary strict rule
  for (const rule of theory.system.strictRules) {
    if (rule.antecedents.length !== 1) {
      continue; // Contraposition only for unary rules
    }

    const phi = rule.antecedents[0];
    const psi = rule.consequent;

    // Get contraries
    const phiContraries = theory.system.contraries.get(phi);
    const psiContraries = theory.system.contraries.get(psi);

    if (!phiContraries || !psiContraries) {
      continue; // Need contraries defined
    }

    const phiBar = Array.from(phiContraries)[0];
    const psiBar = Array.from(psiContraries)[0];

    // Check if contrapositive exists: ψ̄ → φ̄
    const contrapositiveExists = theory.system.strictRules.some(
      (r) =>
        r.antecedents.length === 1 &&
        r.antecedents[0] === psiBar &&
        r.consequent === phiBar
    );

    if (!contrapositiveExists) {
      violations.push(
        `Missing contrapositive of rule ${rule.id}: Expected ${psiBar} → ${phiBar}`
      );
    }
  }

  return {
    satisfied: violations.length === 0,
    violations,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a comprehensive rationality report
 * 
 * @param extension Grounded extension
 * @param args All arguments
 * @param theory Argumentation theory
 * @returns Human-readable report
 */
export function generateRationalityReport(
  extension: GroundedExtension,
  args: Argument[],
  theory: ArgumentationTheory
): string {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("ASPIC+ RATIONALITY REPORT");
  lines.push("=".repeat(60));
  lines.push("");

  // Well-formedness
  const wellFormedness = checkWellFormedness(theory);
  lines.push("WELL-FORMEDNESS:");
  lines.push(`  Overall: ${wellFormedness.isWellDefined ? "✓ PASS" : "✗ FAIL"}`);
  lines.push(`  Axiom consistency: ${wellFormedness.axiomConsistency ? "✓" : "✗"}`);
  lines.push(`  Contrary well-formedness: ${wellFormedness.wellFormedness ? "✓" : "✗"}`);
  lines.push(`  Reasonable preferences: ${wellFormedness.reasonableOrdering ? "✓" : "✗"}`);
  lines.push(`  Closure property: ${wellFormedness.closureProperty}`);

  if (!wellFormedness.isWellDefined && wellFormedness.issues.length > 0) {
    lines.push("\n  Issues:");
    for (const issue of wellFormedness.issues) {
      lines.push(`    - ${issue}`);
    }
  }

  lines.push("");

  // Rationality postulates
  const rationality = checkRationalityPostulates(extension, args, theory);
  const isRational =
    rationality.subArgumentClosure &&
    rationality.strictClosure &&
    rationality.directConsistency &&
    rationality.indirectConsistency;

  lines.push("RATIONALITY POSTULATES:");
  lines.push(`  Overall: ${isRational ? "✓ PASS" : "✗ FAIL"}`);
  lines.push(`  Sub-argument closure: ${rationality.subArgumentClosure ? "✓" : "✗"}`);
  lines.push(`  Strict closure: ${rationality.strictClosure ? "✓" : "✗"}`);
  lines.push(`  Direct consistency: ${rationality.directConsistency ? "✓" : "✗"}`);
  lines.push(`  Indirect consistency: ${rationality.indirectConsistency ? "✓" : "✗"}`);

  if (!isRational && rationality.violations.length > 0) {
    lines.push("\n  Violations:");
    for (const violation of rationality.violations) {
      lines.push(`    ${violation.postulate}: ${violation.description}`);
      if (Array.isArray(violation.evidence)) {
        for (const detail of violation.evidence) {
          lines.push(`      - ${detail}`);
        }
      }
    }
  }

  lines.push("");
  lines.push("=".repeat(60));

  return lines.join("\n");
}
