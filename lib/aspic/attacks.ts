/**
 * ASPIC+ Attack Computation
 * 
 * Implements three fundamental attack types:
 * 1. Undermining - attacking ordinary premises
 * 2. Rebutting - attacking defeasible conclusions
 * 3. Undercutting - attacking defeasible rule applications
 * 
 * Based on ASPIC+ Definition 3.6 (Modgil & Prakken 2013)
 */

import type {
  Argument,
  ArgumentationTheory,
  Attack,
  AttackType,
  ConflictCheck,
} from "./types";
import { getAllSubArguments } from "./arguments";

// ============================================================================
// ATTACK COMPUTATION
// ============================================================================

/**
 * Compute all attacks between arguments
 * 
 * Systematically checks all argument pairs for:
 * - Undermining attacks on ordinary premises
 * - Rebutting attacks on defeasible conclusions
 * - Undercutting attacks on defeasible rules
 * 
 * @param args All arguments in the framework
 * @param theory Source argumentation theory (for KB and contrariness)
 * @returns Array of all attacks
 */
export function computeAttacks(
  args: Argument[],
  theory: ArgumentationTheory
): Attack[] {
  const attacks: Attack[] = [];
  const { system, knowledgeBase } = theory;

  // Check all pairs of arguments
  for (const attacker of args) {
    for (const attacked of args) {
      // Self-attacks not allowed
      if (attacker.id === attacked.id) continue;

      // Check for undermining
      const underminingAttacks = checkUndermining(
        attacker,
        attacked,
        system.contraries,
        knowledgeBase.premises,
        knowledgeBase.assumptions
      );
      attacks.push(...underminingAttacks);

      // Check for rebutting
      const rebuttingAttacks = checkRebutting(
        attacker,
        attacked,
        system.contraries
      );
      attacks.push(...rebuttingAttacks);

      // Check for undercutting
      const undercuttingAttacks = checkUndercutting(
        attacker,
        attacked,
        system.contraries,
        system.ruleNames
      );
      attacks.push(...undercuttingAttacks);
    }
  }

  return attacks;
}

// ============================================================================
// UNDERMINING ATTACKS
// ============================================================================

/**
 * Check for undermining attacks
 * 
 * A undermines B on ordinary premise φ if:
 * - conc(A) ∈ φ̄ (contrary of φ)
 * - φ ∈ Prem(B) ∩ (Kp ∪ Ka)
 * 
 * Ordinary premises (Kp) and assumptions (Ka) can be undermined.
 * Axioms (Kn) CANNOT be undermined.
 */
function checkUndermining(
  attacker: Argument,
  attacked: Argument,
  contraries: Map<string, Set<string>>,
  ordinaryPremises: Set<string>,
  assumptions: Set<string>
): Attack[] {
  const attacks: Attack[] = [];
  const attackerConclusion = attacker.conclusion;

  // Check each premise of attacked argument
  for (const premise of attacked.premises) {
    // Can only undermine ordinary premises and assumptions
    const isOrdinaryPremise = ordinaryPremises.has(premise);
    const isAssumption = assumptions.has(premise);

    if (!isOrdinaryPremise && !isAssumption) {
      continue; // Cannot undermine axioms
    }

    // Check if attacker conclusion is contrary to premise
    const conflict = checkConflict(attackerConclusion, premise, contraries);

    if (conflict.areContraries) {
      attacks.push({
        attacker,
        attacked,
        type: "undermining",
        target: {
          premise,
        },
      });
    }
  }

  return attacks;
}

// ============================================================================
// REBUTTING ATTACKS
// ============================================================================

/**
 * Check for rebutting attacks
 * 
 * A rebuts B on B' if:
 * - B' ∈ Sub(B)
 * - B' has defeasible top rule
 * - conc(A) ∈ conc(B')̄
 * 
 * Can only rebut conclusions derived via defeasible rules.
 * Strict conclusions CANNOT be rebutted (restricted rebut).
 */
function checkRebutting(
  attacker: Argument,
  attacked: Argument,
  contraries: Map<string, Set<string>>
): Attack[] {
  const attacks: Attack[] = [];
  const attackerConclusion = attacker.conclusion;

  // Get all sub-arguments of attacked (including itself)
  const subArguments = getAllSubArguments(attacked);

  for (const subArg of subArguments) {
    // Can only rebut if sub-argument has DEFEASIBLE top rule
    if (!subArg.topRule || subArg.topRule.type !== "defeasible") {
      continue;
    }

    // Check if attacker conclusion is contrary to sub-argument conclusion
    const conflict = checkConflict(attackerConclusion, subArg.conclusion, contraries);

    if (conflict.areContraries) {
      attacks.push({
        attacker,
        attacked,
        type: "rebutting",
        target: {
          subArgument: subArg,
        },
      });
    }
  }

  return attacks;
}

// ============================================================================
// UNDERCUTTING ATTACKS
// ============================================================================

/**
 * Check for undercutting attacks
 * 
 * A undercuts B on B' if:
 * - B' ∈ Sub(B)
 * - B' has defeasible top rule r
 * - conc(A) ∈ n(r)̄ (contrary of rule name)
 * 
 * Undercutting attacks the APPLICABILITY of a defeasible rule.
 * This is formalized via the naming function n: Rd → L.
 * 
 * Example:
 *   Rule r: Bird(x) ⇒ Flies(x)
 *   Name n(r): "reliable_flying_rule"
 *   Undercutter: ¬reliable_flying_rule
 */
function checkUndercutting(
  attacker: Argument,
  attacked: Argument,
  contraries: Map<string, Set<string>>,
  ruleNames: Map<string, string>
): Attack[] {
  const attacks: Attack[] = [];
  const attackerConclusion = attacker.conclusion;

  // Get all sub-arguments of attacked (including itself)
  const subArguments = getAllSubArguments(attacked);

  for (const subArg of subArguments) {
    // Can only undercut if sub-argument has DEFEASIBLE top rule
    if (!subArg.topRule || subArg.topRule.type !== "defeasible") {
      continue;
    }

    const ruleId = subArg.topRule.ruleId;
    const ruleName = ruleNames.get(ruleId);

    // Rule must have a name for undercutting
    if (!ruleName) {
      continue;
    }

    // Check if attacker conclusion is contrary to rule name
    const conflict = checkConflict(attackerConclusion, ruleName, contraries);

    if (conflict.areContraries) {
      attacks.push({
        attacker,
        attacked,
        type: "undercutting",
        target: {
          ruleId,
        },
      });
    }
  }

  return attacks;
}

// ============================================================================
// CONFLICT CHECKING
// ============================================================================

/**
 * Check if two formulae are contraries
 * 
 * Types of contrariness:
 * - Contradictory: φ ∈ ψ̄ AND ψ ∈ φ̄ (symmetric)
 * - Contrary: φ ∈ ψ̄ but ψ ∉ φ̄ (asymmetric)
 * 
 * Classical negation is contradictory (symmetric).
 * Negation-as-failure is contrary (asymmetric): α is contrary of ~α, but ~α not contrary of α.
 */
export function checkConflict(
  phi: string,
  psi: string,
  contraries: Map<string, Set<string>>
): ConflictCheck {
  const phiContraries = contraries.get(phi);
  const psiContraries = contraries.get(psi);

  const phiContraryOfPsi = phiContraries?.has(psi) || false;
  const psiContraryOfPhi = psiContraries?.has(phi) || false;

  const areContraries = phiContraryOfPsi || psiContraryOfPhi;
  const areContradictories = phiContraryOfPsi && psiContraryOfPhi;

  let direction: "phi-contrary-of-psi" | "psi-contrary-of-phi" | undefined;
  if (areContraries && !areContradictories) {
    direction = phiContraryOfPsi ? "phi-contrary-of-psi" : "psi-contrary-of-phi";
  }

  return {
    areContraries,
    areContradictories,
    direction,
  };
}

/**
 * Add classical negation contraries
 * 
 * For each formula φ in language, add:
 * - φ̄ = {¬φ}
 * - ¬φ̄ = {φ}
 * 
 * This ensures symmetric conflict (contradictories).
 */
export function addClassicalNegation(
  contraries: Map<string, Set<string>>,
  language: Set<string>
): void {
  for (const formula of language) {
    // Skip if already negated
    if (formula.startsWith("¬")) continue;

    const negated = `¬${formula}`;

    // φ̄ = {¬φ}
    if (!contraries.has(formula)) {
      contraries.set(formula, new Set());
    }
    contraries.get(formula)!.add(negated);

    // ¬φ̄ = {φ}
    if (!contraries.has(negated)) {
      contraries.set(negated, new Set());
    }
    contraries.get(negated)!.add(formula);
  }
}

// ============================================================================
// ATTACK UTILITIES
// ============================================================================

/**
 * Get all attacks on a specific argument
 */
export function getAttacksOn(
  arg: Argument,
  attacks: Attack[]
): Attack[] {
  return attacks.filter(attack => attack.attacked.id === arg.id);
}

/**
 * Get all attacks by a specific argument
 */
export function getAttacksBy(
  arg: Argument,
  attacks: Attack[]
): Attack[] {
  return attacks.filter(attack => attack.attacker.id === arg.id);
}

/**
 * Get attacks by type
 */
export function getAttacksByType(
  attacks: Attack[],
  type: AttackType
): Attack[] {
  return attacks.filter(attack => attack.type === type);
}

/**
 * Check if argument A attacks argument B
 */
export function doesAttack(
  attacker: Argument,
  attacked: Argument,
  attacks: Attack[]
): boolean {
  return attacks.some(
    attack => attack.attacker.id === attacker.id && attack.attacked.id === attacked.id
  );
}

/**
 * Get attack types between two arguments
 */
export function getAttackTypes(
  attacker: Argument,
  attacked: Argument,
  attacks: Attack[]
): AttackType[] {
  return attacks
    .filter(attack => attack.attacker.id === attacker.id && attack.attacked.id === attacked.id)
    .map(attack => attack.type);
}

/**
 * Group attacks by type
 */
export function groupAttacksByType(attacks: Attack[]): Map<AttackType, Attack[]> {
  const grouped = new Map<AttackType, Attack[]>();

  grouped.set("undermining", []);
  grouped.set("rebutting", []);
  grouped.set("undercutting", []);

  for (const attack of attacks) {
    grouped.get(attack.type)!.push(attack);
  }

  return grouped;
}

/**
 * Print attack summary (for debugging)
 */
export function printAttackSummary(attacks: Attack[]): string {
  const grouped = groupAttacksByType(attacks);

  let result = `Total attacks: ${attacks.length}\n`;
  result += `- Undermining: ${grouped.get("undermining")!.length}\n`;
  result += `- Rebutting: ${grouped.get("rebutting")!.length}\n`;
  result += `- Undercutting: ${grouped.get("undercutting")!.length}\n`;

  return result;
}

/**
 * Print detailed attack list (for debugging)
 */
export function printAttacks(attacks: Attack[]): string {
  let result = "";

  for (const attack of attacks) {
    result += `[${attack.type.toUpperCase()}] ${attack.attacker.id} → ${attack.attacked.id}`;

    if (attack.target.premise) {
      result += ` (on premise: ${attack.target.premise})`;
    } else if (attack.target.subArgument) {
      result += ` (on sub-arg: ${attack.target.subArgument.id})`;
    } else if (attack.target.ruleId) {
      result += ` (on rule: ${attack.target.ruleId})`;
    }

    result += "\n";
  }

  return result;
}

// ============================================================================
// ATTACK GRAPH GENERATION
// ============================================================================

/**
 * Generate attack graph (for visualization)
 * 
 * Format: adjacency list
 */
export interface AttackGraph {
  /** Nodes (arguments) */
  nodes: Array<{
    id: string;
    label: string;
    conclusion: string;
  }>;

  /** Edges (attacks) */
  edges: Array<{
    source: string;
    target: string;
    type: AttackType;
    label: string;
  }>;
}

export function generateAttackGraph(
  args: Argument[],
  attacks: Attack[]
): AttackGraph {
  const nodes = args.map(arg => ({
    id: arg.id,
    label: arg.id,
    conclusion: arg.conclusion,
  }));

  const edges = attacks.map(attack => {
    let label = attack.type;

    if (attack.target.premise) {
      label += ` (${attack.target.premise})`;
    } else if (attack.target.ruleId) {
      label += ` (${attack.target.ruleId})`;
    }

    return {
      source: attack.attacker.id,
      target: attack.attacked.id,
      type: attack.type,
      label,
    };
  });

  return { nodes, edges };
}
