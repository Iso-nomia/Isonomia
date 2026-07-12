/**
 * ASPIC+ Defeat Resolution
 * 
 * Implements preference-based defeat computation with:
 * - Last-link ordering (legal/normative reasoning)
 * - Weakest-link ordering (epistemic reasoning)
 * - Reasonable ordering validation
 * 
 * Based on ASPIC+ Definition 3.7-3.8 (Modgil & Prakken 2013)
 */

import type {
  Argument,
  ArgumentationTheory,
  Attack,
  Defeat,
  PreferenceOrdering,
  PreferenceRelation,
  ArgumentComparison,
} from "./types";
import { classifyArgument } from "./types";

// ============================================================================
// DEFEAT COMPUTATION
// ============================================================================

/**
 * Compute defeats from attacks using preference ordering
 * 
 * An attack succeeds as a defeat if:
 * - Undercutting: Always succeeds (no preference check)
 * - Undermining/Rebutting: Succeeds if attacker ⊀ target (not strictly less preferred)
 * 
 * @param attacks All attacks between arguments
 * @param theory Source argumentation theory (for preferences)
 * @param ordering Preference ordering type
 * @returns Array of successful defeats
 */
export function computeDefeats(
  attacks: Attack[],
  theory: ArgumentationTheory,
  ordering: PreferenceOrdering = "last-link"
): Defeat[] {
  const defeats: Defeat[] = [];

  // Create preference relation based on ordering type
  const preferenceRelation = createPreferenceRelation(theory, ordering);

  for (const attack of attacks) {
    // Undercutting attacks ALWAYS succeed as defeats
    if (attack.type === "undercutting") {
      defeats.push({
        defeater: attack.attacker,
        defeated: attack.attacked,
        attack,
        preferenceApplied: false,
      });
      continue;
    }

    // For undermining and rebutting, check preferences
    const target = getAttackTarget(attack);
    if (!target) continue;

    // Special case: Undermining attacks on assumptions ALWAYS succeed
    if (attack.type === "undermining" && attack.target.premise) {
      const targetPremise = attack.target.premise;
      const isAssumption = theory.knowledgeBase.assumptions.has(targetPremise);
      
      if (isAssumption) {
        defeats.push({
          defeater: attack.attacker,
          defeated: attack.attacked,
          attack,
          preferenceApplied: false, // No preference check for assumptions
        });
        continue;
      }
    }

    // Attack succeeds if attacker ⊀ target (not strictly less preferred)
    const isStrictlyLessPreferred = preferenceRelation.isLessPreferred(
      attack.attacker,
      target
    );

    if (!isStrictlyLessPreferred) {
      defeats.push({
        defeater: attack.attacker,
        defeated: attack.attacked,
        attack,
        preferenceApplied: true,
      });
    }
  }

  return defeats;
}

/**
 * Get the target argument for preference comparison
 * 
 * For undermining: compare with attacked argument
 * For rebutting: compare with sub-argument that has the conclusion
 */
function getAttackTarget(attack: Attack): Argument | null {
  if (attack.type === "undermining") {
    return attack.attacked;
  }

  if (attack.type === "rebutting" && attack.target.subArgument) {
    return attack.target.subArgument;
  }

  return null;
}

// ============================================================================
// PREFERENCE RELATIONS
// ============================================================================

/**
 * Create preference relation based on ordering type
 */
function createPreferenceRelation(
  theory: ArgumentationTheory,
  ordering: PreferenceOrdering
): PreferenceRelation {
  switch (ordering) {
    case "last-link":
      return createLastLinkPreference(theory);
    case "weakest-link":
      return createWeakestLinkPreference(theory);
    case "custom":
      throw new Error("Custom preference ordering not yet implemented");
    default:
      throw new Error(`Unknown preference ordering: ${ordering}`);
  }
}

// ============================================================================
// LAST-LINK PREFERENCE ORDERING
// ============================================================================

/**
 * Last-Link Principle (Definition 3.6)
 * 
 * Suitable for legal/normative reasoning where the final inference is most critical.
 * 
 * A ≺ B if:
 * - Both have defeasible top rules, and TopRule(A) < TopRule(B)
 * - A is observation-based (no top rule) and B has defeasible top rule
 * 
 * Observation-based arguments are never strictly less preferred.
 */
function createLastLinkPreference(theory: ArgumentationTheory): PreferenceRelation {
  const { knowledgeBase, system } = theory;

  const rulePreferenceMap = new Map<string, number>();
  const rulePreferences = knowledgeBase.rulePreferences;

  // Build preference ranking (lower number = less preferred)
  let rank = 0;
  const ranked = new Set<string>();

  // Process preferences to build transitive ranking
  for (const pref of rulePreferences) {
    if (!ranked.has(pref.dispreferred)) {
      rulePreferenceMap.set(pref.dispreferred, rank++);
      ranked.add(pref.dispreferred);
    }
    if (!ranked.has(pref.preferred)) {
      rulePreferenceMap.set(pref.preferred, rank++);
      ranked.add(pref.preferred);
    }
  }

  return {
    isLessPreferred(arg1: Argument, arg2: Argument): boolean {
      const classification1 = classifyArgument(arg1, knowledgeBase);
      const classification2 = classifyArgument(arg2, knowledgeBase);

      // Reasonable ordering: strict & firm > plausible | defeasible
      if (!classification1.isFallible && classification2.isFallible) {
        return false; // arg1 (strict & firm) not less preferred
      }
      if (classification1.isFallible && !classification2.isFallible) {
        return true; // arg1 (fallible) is less preferred
      }

      // Both observation-based (no top rule)
      if (!arg1.topRule && !arg2.topRule) {
        return false; // Equal (not strictly less)
      }

      // arg1 observation-based, arg2 has rule
      if (!arg1.topRule && arg2.topRule) {
        return false; // Observation-based never strictly less preferred
      }

      // arg1 has rule, arg2 observation-based
      if (arg1.topRule && !arg2.topRule) {
        return false; // arg2 is observation-based (preferred)
      }

      // Both have top rules - compare based on rule preferences
      const rule1 = arg1.topRule!.ruleId;
      const rule2 = arg2.topRule!.ruleId;

      const rank1 = rulePreferenceMap.get(rule1) ?? Infinity;
      const rank2 = rulePreferenceMap.get(rule2) ?? Infinity;

      return rank1 < rank2; // Lower rank = less preferred
    },

    isLessOrEquallyPreferred(arg1: Argument, arg2: Argument): boolean {
      return (
        this.isLessPreferred(arg1, arg2) ||
        this.compare(arg1, arg2) === "equal"
      );
    },

    compare(arg1: Argument, arg2: Argument): ArgumentComparison {
      const less = this.isLessPreferred(arg1, arg2);
      const greater = this.isLessPreferred(arg2, arg1);

      if (less && !greater) return "less";
      if (!less && greater) return "greater";
      if (!less && !greater) return "equal";
      return "incomparable"; // Shouldn't happen with reasonable ordering
    },
  };
}

// ============================================================================
// WEAKEST-LINK PREFERENCE ORDERING
// ============================================================================

/**
 * Weakest-Link Principle (Definition 3.8)
 * 
 * Suitable for epistemic reasoning where uncertainty propagates through chain.
 * 
 * A ≺ B if:
 * - DefRules(A) < DefRules(B) (rule comparison), OR
 * - Prem_p(A) < Prem_p(B) (premise comparison)
 * 
 * An argument is only as strong as its weakest link (premise or rule).
 */
function createWeakestLinkPreference(theory: ArgumentationTheory): PreferenceRelation {
  const { knowledgeBase } = theory;

  // Build preference maps
  const rulePreferenceMap = buildPreferenceMap(knowledgeBase.rulePreferences);
  const premisePreferenceMap = buildPreferenceMap(knowledgeBase.premisePreferences);

  return {
    isLessPreferred(arg1: Argument, arg2: Argument): boolean {
      const classification1 = classifyArgument(arg1, knowledgeBase);
      const classification2 = classifyArgument(arg2, knowledgeBase);

      // Reasonable ordering: strict & firm > fallible
      if (!classification1.isFallible && classification2.isFallible) {
        return false;
      }
      if (classification1.isFallible && !classification2.isFallible) {
        return true;
      }

      // Compare defeasible rules (elitist comparison)
      const defRules1 = Array.from(arg1.defeasibleRules);
      const defRules2 = Array.from(arg2.defeasibleRules);

      const ruleComparison = elitistComparison(
        defRules1,
        defRules2,
        rulePreferenceMap
      );

      if (ruleComparison === "less") return true;
      if (ruleComparison === "greater") return false;

      // Compare ordinary premises (elitist comparison)
      const premises1 = Array.from(arg1.premises).filter(
        p => knowledgeBase.premises.has(p) || knowledgeBase.assumptions.has(p)
      );
      const premises2 = Array.from(arg2.premises).filter(
        p => knowledgeBase.premises.has(p) || knowledgeBase.assumptions.has(p)
      );

      const premiseComparison = elitistComparison(
        premises1,
        premises2,
        premisePreferenceMap
      );

      return premiseComparison === "less";
    },

    isLessOrEquallyPreferred(arg1: Argument, arg2: Argument): boolean {
      return (
        this.isLessPreferred(arg1, arg2) ||
        this.compare(arg1, arg2) === "equal"
      );
    },

    compare(arg1: Argument, arg2: Argument): ArgumentComparison {
      const less = this.isLessPreferred(arg1, arg2);
      const greater = this.isLessPreferred(arg2, arg1);

      if (less && !greater) return "less";
      if (!less && greater) return "greater";
      if (!less && !greater) return "equal";
      return "incomparable";
    },
  };
}

// ============================================================================
// SET COMPARISON UTILITIES
// ============================================================================

/**
 * Build preference map with transitive ranking
 */
function buildPreferenceMap(
  preferences: Array<{ preferred: string; dispreferred: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  let rank = 0;
  const ranked = new Set<string>();

  for (const pref of preferences) {
    if (!ranked.has(pref.dispreferred)) {
      map.set(pref.dispreferred, rank++);
      ranked.add(pref.dispreferred);
    }
    if (!ranked.has(pref.preferred)) {
      map.set(pref.preferred, rank++);
      ranked.add(pref.preferred);
    }
  }

  return map;
}

/**
 * Elitist set comparison (≺_Eli)
 * 
 * Γ ≺_Eli Γ' if:
 *   ∃X ∈ Γ: ∀Y ∈ Γ': X < Y
 * 
 * "There exists an element in Γ that is strictly less preferred than all elements in Γ'"
 */
function elitistComparison(
  set1: string[],
  set2: string[],
  preferenceMap: Map<string, number>
): ArgumentComparison {
  if (set1.length === 0 && set2.length === 0) return "equal";
  if (set1.length === 0) return "greater"; // Empty set is "better"
  if (set2.length === 0) return "less";

  const ranks1 = set1.map(x => preferenceMap.get(x) ?? Infinity);
  const ranks2 = set2.map(x => preferenceMap.get(x) ?? Infinity);

  const min1 = Math.min(...ranks1);
  const min2 = Math.min(...ranks2);

  // Check if min element of set1 is less than ALL elements of set2
  const set1HasWeakerElement = ranks1.some(r1 => ranks2.every(r2 => r1 < r2));

  // Check if min element of set2 is less than ALL elements of set1
  const set2HasWeakerElement = ranks2.some(r2 => ranks1.every(r1 => r2 < r1));

  if (set1HasWeakerElement && !set2HasWeakerElement) return "less";
  if (!set1HasWeakerElement && set2HasWeakerElement) return "greater";

  // Compare minimum ranks as fallback
  if (min1 < min2) return "less";
  if (min1 > min2) return "greater";

  return "equal";
}

/**
 * Democratic set comparison (≺_Dem) - for reference
 * 
 * Γ ≺_Dem Γ' if:
 *   ∀X ∈ Γ: ∃Y ∈ Γ': X ≤ Y
 * 
 * "For all elements in Γ, there exists an element in Γ' that is at least as preferred"
 * 
 * (Not currently used but included for completeness)
 */
function democraticComparison(
  set1: string[],
  set2: string[],
  preferenceMap: Map<string, number>
): ArgumentComparison {
  if (set1.length === 0 && set2.length === 0) return "equal";
  if (set1.length === 0) return "greater";
  if (set2.length === 0) return "less";

  const ranks1 = set1.map(x => preferenceMap.get(x) ?? Infinity);
  const ranks2 = set2.map(x => preferenceMap.get(x) ?? Infinity);

  // For all X in set1, exists Y in set2 where X <= Y
  const set1LessOrEqual = ranks1.every(r1 => ranks2.some(r2 => r1 <= r2));

  // For all X in set2, exists Y in set1 where X <= Y
  const set2LessOrEqual = ranks2.every(r2 => ranks1.some(r1 => r2 <= r1));

  if (set1LessOrEqual && !set2LessOrEqual) return "less";
  if (!set1LessOrEqual && set2LessOrEqual) return "greater";
  if (set1LessOrEqual && set2LessOrEqual) return "equal";

  return "incomparable";
}

// ============================================================================
// DEFEAT UTILITIES
// ============================================================================

/**
 * Get all defeats on a specific argument
 */
export function getDefeatsOn(arg: Argument, defeats: Defeat[]): Defeat[] {
  return defeats.filter(defeat => defeat.defeated.id === arg.id);
}

/**
 * Get all defeats by a specific argument
 */
export function getDefeatsBy(arg: Argument, defeats: Defeat[]): Defeat[] {
  return defeats.filter(defeat => defeat.defeater.id === arg.id);
}

/**
 * Check if argument A defeats argument B
 */
export function doesDefeat(
  defeater: Argument,
  defeated: Argument,
  defeats: Defeat[]
): boolean {
  return defeats.some(
    defeat => defeat.defeater.id === defeater.id && defeat.defeated.id === defeated.id
  );
}

/**
 * Get defeat relation as adjacency map
 */
export function getDefeatRelationMap(defeats: Defeat[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const defeat of defeats) {
    if (!map.has(defeat.defeated.id)) {
      map.set(defeat.defeated.id, new Set());
    }
    map.get(defeat.defeated.id)!.add(defeat.defeater.id);
  }

  return map;
}

/**
 * Print defeat summary (for debugging)
 */
export function printDefeatSummary(defeats: Defeat[]): string {
  const withPreference = defeats.filter(d => d.preferenceApplied).length;
  const withoutPreference = defeats.filter(d => !d.preferenceApplied).length;

  let result = `Total defeats: ${defeats.length}\n`;
  result += `- With preference check: ${withPreference}\n`;
  result += `- Without preference (undercutting): ${withoutPreference}\n`;

  return result;
}

/**
 * Print detailed defeat list (for debugging)
 */
export function printDefeats(defeats: Defeat[]): string {
  let result = "";

  for (const defeat of defeats) {
    const attackType = defeat.attack.type.toUpperCase();
    const prefStr = defeat.preferenceApplied ? " (pref)" : "";

    result += `[${attackType}${prefStr}] ${defeat.defeater.id} ⊳ ${defeat.defeated.id}\n`;
  }

  return result;
}
