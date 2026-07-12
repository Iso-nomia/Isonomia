/**
 * High-level integration orchestration
 * Combines ASPIC+ evaluation with AIF preference translation
 * 
 * This module provides the main entry points for:
 * 1. Evaluating deliberations with AIF preferences
 * 2. Syncing ASPIC+ preferences back to AIF
 * 3. Round-trip translation validation
 */

import { populateKBPreferencesFromAIF, computeTransitiveClosure, detectPreferenceCycles } from "./aifToASPIC";
import { createPANodesFromASPICPreferences, batchCreatePANodesFromASPICPreferences } from "./aspicToAIF";
import { constructArguments } from "@/lib/aspic/arguments";
import { computeAttacks } from "@/lib/aspic/attacks";
import { computeDefeats } from "@/lib/aspic/defeats";
import { computeGroundedExtension } from "@/lib/aspic/semantics";
import type { ArgumentationTheory, PreferenceOrdering, Argument, Attack, Defeat } from "@/lib/aspic/types";

/**
 * Result of ASPIC+ evaluation with AIF preferences
 */
export interface EvaluationResult {
  theory: ArgumentationTheory;
  arguments: Argument[];
  attacks: Attack[];
  defeats: Defeat[];
  groundedExtension: {
    inArguments: Set<string>;
    outArguments: Set<string>;
    undecidedArguments: Set<string>;
  };
  metrics: {
    argumentCount: number;
    attackCount: number;
    defeatCount: number;
    preferenceCount: number;
    cycleCount: number;
    computationTimeMs: number;
  };
  warnings: string[];
}

/**
 * Evaluate deliberation with AIF preferences
 * Main entry point combining translation + evaluation
 * 
 * @param deliberationId The deliberation to evaluate
 * @param theory Base argumentation theory (without preferences)
 * @param ordering Preference ordering type (last-link or weakest-link)
 * @param options Additional evaluation options
 * @returns Complete evaluation result with arguments, attacks, defeats, and extensions
 */
export async function evaluateWithAIFPreferences(
  deliberationId: string,
  theory: ArgumentationTheory,
  ordering: PreferenceOrdering = "last-link",
  options: {
    computeTransitiveClosure?: boolean;
    detectCycles?: boolean;
  } = {}
): Promise<EvaluationResult> {
  const startTime = performance.now();
  const warnings: string[] = [];

  // STEP 1: Translate AIF PA-nodes → ASPIC+ KB preferences
  const { premisePreferences, rulePreferences } = await populateKBPreferencesFromAIF(
    deliberationId
  );

  const preferenceCount = premisePreferences.length + rulePreferences.length;

  // STEP 2: Optionally compute transitive closure
  let finalPremisePrefs = premisePreferences;
  let finalRulePrefs = rulePreferences;

  if (options.computeTransitiveClosure) {
    finalPremisePrefs = computeTransitiveClosure(premisePreferences);
    finalRulePrefs = computeTransitiveClosure(rulePreferences);

    if (finalPremisePrefs.length > premisePreferences.length) {
      warnings.push(
        `Transitive closure added ${finalPremisePrefs.length - premisePreferences.length} premise preferences`
      );
    }
    if (finalRulePrefs.length > rulePreferences.length) {
      warnings.push(
        `Transitive closure added ${finalRulePrefs.length - rulePreferences.length} rule preferences`
      );
    }
  }

  // STEP 3: Optionally detect cycles
  let cycleCount = 0;
  if (options.detectCycles) {
    const premiseCycles = detectPreferenceCycles(finalPremisePrefs);
    const ruleCycles = detectPreferenceCycles(finalRulePrefs);
    cycleCount = premiseCycles.length + ruleCycles.length;

    if (premiseCycles.length > 0) {
      warnings.push(`Detected ${premiseCycles.length} cycles in premise preferences`);
    }
    if (ruleCycles.length > 0) {
      warnings.push(`Detected ${ruleCycles.length} cycles in rule preferences`);
    }
  }

  // STEP 4: Update theory with preferences
  theory.knowledgeBase.premisePreferences = finalPremisePrefs;
  theory.knowledgeBase.rulePreferences = finalRulePrefs;

  // STEP 5: Construct arguments
  const args = constructArguments(theory);

  // STEP 6: Compute attacks
  const attacks = computeAttacks(args, theory);

  // STEP 7: Compute defeats (with preferences)
  const defeats = computeDefeats(attacks, theory, ordering);

  // STEP 8: Compute extensions
  const extension = computeGroundedExtension(args, defeats);

  const endTime = performance.now();

  return {
    theory,
    arguments: args,
    attacks,
    defeats,
    groundedExtension: extension,
    metrics: {
      argumentCount: args.length,
      attackCount: attacks.length,
      defeatCount: defeats.length,
      preferenceCount,
      cycleCount,
      computationTimeMs: endTime - startTime,
    },
    warnings,
  };
}

/**
 * Sync ASPIC+ preferences back to AIF
 * Creates PA-nodes for preferences not yet in AIF
 * 
 * @param deliberationId The deliberation context
 * @param theory Argumentation theory with preferences
 * @param userId User creating the PA-nodes
 * @param useBatch Whether to use batch creation (faster for many preferences)
 * @returns Statistics about created and skipped PA-nodes
 */
export async function syncPreferencesToAIF(
  deliberationId: string,
  theory: ArgumentationTheory,
  userId: string,
  useBatch: boolean = false
): Promise<{ created: number; skipped: number; errors: string[] }> {
  if (useBatch) {
    return await batchCreatePANodesFromASPICPreferences(
      deliberationId,
      theory.knowledgeBase,
      userId
    );
  } else {
    return await createPANodesFromASPICPreferences(
      deliberationId,
      theory.knowledgeBase,
      userId
    );
  }
}

/**
 * Validate round-trip translation (AIF → ASPIC+ → AIF)
 * Ensures preferences are preserved through translation
 * 
 * @param deliberationId The deliberation to validate
 * @param userId User for creating test PA-nodes
 * @returns Validation result with any discrepancies
 */
export async function validateRoundTripTranslation(
  deliberationId: string,
  userId: string
): Promise<{
  success: boolean;
  premisePreferencesPreserved: boolean;
  rulePreferencesPreserved: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Step 1: Get initial AIF preferences
  const initial = await populateKBPreferencesFromAIF(deliberationId);

  // Step 2: Create a theory with these preferences
  const theory: ArgumentationTheory = {
    system: {
      language: new Set(),
      contraries: new Map(),
      strictRules: [],
      defeasibleRules: [],
      ruleNames: new Map(),
    },
    knowledgeBase: {
      axioms: new Set(),
      premises: new Set(),
      assumptions: new Set(),
      premisePreferences: initial.premisePreferences,
      rulePreferences: initial.rulePreferences,
    },
  };

  // Step 3: Translate back to AIF (this should be idempotent)
  const syncResult = await syncPreferencesToAIF(deliberationId, theory, userId);

  if (syncResult.errors.length > 0) {
    errors.push(...syncResult.errors);
  }

  // Step 4: Verify preferences match
  const final = await populateKBPreferencesFromAIF(deliberationId);

  const premisePreferencesPreserved =
    initial.premisePreferences.length === final.premisePreferences.length;
  const rulePreferencesPreserved =
    initial.rulePreferences.length === final.rulePreferences.length;

  if (!premisePreferencesPreserved) {
    errors.push(
      `Premise preference count mismatch: ${initial.premisePreferences.length} → ${final.premisePreferences.length}`
    );
  }

  if (!rulePreferencesPreserved) {
    errors.push(
      `Rule preference count mismatch: ${initial.rulePreferences.length} → ${final.rulePreferences.length}`
    );
  }

  return {
    success: errors.length === 0 && premisePreferencesPreserved && rulePreferencesPreserved,
    premisePreferencesPreserved,
    rulePreferencesPreserved,
    errors,
  };
}

/**
 * Get preference statistics for a deliberation
 * Useful for debugging and monitoring
 * 
 * @param deliberationId The deliberation to analyze
 * @returns Preference statistics
 */
export async function getPreferenceStatistics(deliberationId: string): Promise<{
  totalPreferences: number;
  premisePreferences: number;
  rulePreferences: number;
  schemePreferences: number;
  cycles: {
    premiseCycles: string[][];
    ruleCycles: string[][];
  };
}> {
  const { premisePreferences, rulePreferences } = await populateKBPreferencesFromAIF(
    deliberationId
  );

  // Count scheme-specific preferences
  // (These are included in rulePreferences but worth tracking separately)
  const schemePreferences = rulePreferences.filter(pref =>
    pref.preferred.startsWith("scheme_") && pref.dispreferred.startsWith("scheme_")
  ).length;

  const premiseCycles = detectPreferenceCycles(premisePreferences);
  const ruleCycles = detectPreferenceCycles(rulePreferences);

  return {
    totalPreferences: premisePreferences.length + rulePreferences.length,
    premisePreferences: premisePreferences.length,
    rulePreferences: rulePreferences.length,
    schemePreferences,
    cycles: {
      premiseCycles,
      ruleCycles,
    },
  };
}

/**
 * Clear all preferences for a deliberation
 * Useful for testing and reset operations
 * 
 * @param deliberationId The deliberation to clear
 * @returns Number of preferences deleted
 */
export async function clearAllPreferences(deliberationId: string): Promise<number> {
  const { prisma } = await import("@/lib/prismaclient");
  
  const result = await prisma.preferenceApplication.deleteMany({
    where: { deliberationId },
  });

  return result.count;
}

/**
 * Compare evaluation results with different orderings
 * Useful for understanding how ordering affects defeat computation
 * 
 * @param deliberationId The deliberation to evaluate
 * @param theory Base argumentation theory
 * @returns Comparison of last-link vs weakest-link results
 */
export async function compareOrderings(
  deliberationId: string,
  theory: ArgumentationTheory
): Promise<{
  lastLink: EvaluationResult;
  weakestLink: EvaluationResult;
  differences: {
    defeatCountDiff: number;
    uniqueToLastLink: number;
    uniqueToWeakestLink: number;
  };
}> {
  const lastLink = await evaluateWithAIFPreferences(deliberationId, theory, "last-link");
  const weakestLink = await evaluateWithAIFPreferences(deliberationId, theory, "weakest-link");

  // Find defeats unique to each ordering
  const lastLinkDefeatIds = new Set(
    lastLink.defeats.map(d => `${d.defeater.id}->${d.defeated.id}`)
  );
  const weakestLinkDefeatIds = new Set(
    weakestLink.defeats.map(d => `${d.defeater.id}->${d.defeated.id}`)
  );

  const uniqueToLastLink = [...lastLinkDefeatIds].filter(id => !weakestLinkDefeatIds.has(id)).length;
  const uniqueToWeakestLink = [...weakestLinkDefeatIds].filter(id => !lastLinkDefeatIds.has(id)).length;

  return {
    lastLink,
    weakestLink,
    differences: {
      defeatCountDiff: lastLink.defeats.length - weakestLink.defeats.length,
      uniqueToLastLink,
      uniqueToWeakestLink,
    },
  };
}
