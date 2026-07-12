/**
 * Helper utilities for ASPIC+ integration with ConflictApplication
 * 
 * Phase 1d: ConflictApplication Enhancement
 * 
 * Provides standardized functions for:
 * - Computing ASPIC+ attack metadata
 * - Populating aspicAttackType, aspicDefeatStatus, aspicMetadata fields
 * - Maintaining consistency across all ConflictApplication creation points
 */

import type { Attack, Argument } from "@/lib/aspic/types";

// ============================================================================
// TYPES
// ============================================================================

export interface AspicConflictMetadata {
  aspicAttackType: string | null;
  aspicDefeatStatus: boolean;
  aspicMetadata: Record<string, any> | null;
}

export interface AttackContext {
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "premise" | "inference" | "conclusion";
  cqKey?: string;
  cqText?: string;
  schemeKey?: string;
  aspicMapping?: any;
}

// ============================================================================
// ASPIC+ METADATA COMPUTATION
// ============================================================================

/**
 * Compute ASPIC+ metadata for ConflictApplication
 * 
 * This function generates the aspicAttackType, aspicDefeatStatus, and aspicMetadata
 * fields for a ConflictApplication record.
 * 
 * When full ASPIC+ attack computation is available (attackResult provided),
 * it uses the formal attack details. Otherwise, it creates metadata from
 * the legacy attack context.
 * 
 * @param attackResult - Optional ASPIC+ attack computation result
 * @param context - Attack context (type, scope, CQ info)
 * @param attackerId - ID of attacking argument/claim
 * @param defenderId - ID of defended argument/claim
 * @returns Metadata fields for ConflictApplication
 */
export function computeAspicConflictMetadata(
  attackResult: { attack: Attack | null; reason: string } | null,
  context: AttackContext,
  attackerId?: string,
  defenderId?: string
): AspicConflictMetadata {
  // Case 1: Full ASPIC+ attack computation available
  if (attackResult?.attack) {
    return {
      aspicAttackType: attackResult.attack.type.toLowerCase(),
      aspicDefeatStatus: true, // Attack succeeded (simplified - real implementation checks preferences)
      aspicMetadata: {
        attackerId: attackResult.attack.attacker.id,
        defenderId: attackResult.attack.attacked.id,
        attackType: attackResult.attack.type,
        targetScope: context.targetScope,
        cqKey: context.cqKey,
        cqText: context.cqText,
        schemeKey: context.schemeKey,
        aspicMapping: context.aspicMapping,
        computationReason: attackResult.reason,
        defeatStatus: true,
        timestamp: new Date().toISOString(),
        source: "full-aspic-computation",
      },
    };
  }

  // Case 2: Legacy attack context only (no ASPIC+ computation)
  // Create metadata based on attack type mapping
  if (context.attackType) {
    const aspicType = mapLegacyAttackToAspic(context.attackType);
    
    return {
      aspicAttackType: aspicType,
      aspicDefeatStatus: false, // Unknown defeat status without computation
      aspicMetadata: {
        attackerId,
        defenderId,
        attackType: context.attackType,
        targetScope: context.targetScope,
        cqKey: context.cqKey,
        cqText: context.cqText,
        schemeKey: context.schemeKey,
        aspicMapping: context.aspicMapping,
        computationReason: "Legacy attack - no ASPIC+ computation performed",
        defeatStatus: null,
        timestamp: new Date().toISOString(),
        source: "legacy-attack-mapping",
      },
    };
  }

  // Case 3: No attack information available
  return {
    aspicAttackType: null,
    aspicDefeatStatus: false,
    aspicMetadata: null,
  };
}

/**
 * Map legacy attack types to ASPIC+ attack types
 */
function mapLegacyAttackToAspic(
  legacyType: "REBUTS" | "UNDERCUTS" | "UNDERMINES"
): string {
  const mapping: Record<string, string> = {
    REBUTS: "rebutting",
    UNDERCUTS: "undercutting",
    UNDERMINES: "undermining",
  };
  return mapping[legacyType] || legacyType.toLowerCase();
}

/**
 * Check if attack succeeded as defeat based on preferences
 * 
 * ASPIC+ Defeat Conditions:
 * - Undermining: Attack on φ ∈ Prem(B) succeeds unless B' ≺' A (premise preference)
 * - Undercutting: Attack on n(r) succeeds unless B' ≺ A (rule preference)
 * - Rebutting: Attack on conc(B) succeeds unless B' ≺ A (rule preference)
 * 
 * This is a simplified implementation. Full implementation would:
 * 1. Fetch preference orderings from ArgumentationTheory
 * 2. Check if defending argument is preferred over attacking argument
 * 3. Return true only if attack is not blocked by preferences
 * 
 * @param attack - ASPIC+ attack
 * @param preferences - Preference orderings (optional)
 * @returns true if attack succeeded as defeat
 */
export function checkDefeatStatus(
  attack: Attack,
  preferences?: {
    premisePreferences?: Array<{ preferred: string; dispreferred: string }>;
    rulePreferences?: Array<{ preferred: string; dispreferred: string }>;
  }
): boolean {
  // Simplified: Assume attack succeeds as defeat unless blocked by preferences
  // Real implementation would check:
  // - For undermining: premise preferences
  // - For undercutting/rebutting: rule preferences
  
  if (!preferences) {
    return true; // No preferences = attack always succeeds
  }

  // TODO: Implement full preference checking
  // For now, return true (attack succeeds)
  return true;
}

/**
 * Extract ASPIC+ metadata from DialogueMove payload
 * 
 * Used in Ludics compilation and AIF synchronization to preserve
 * ASPIC+ provenance across the dialogue → ludics → AIF pipeline.
 * 
 * @param dialogueMovePayload - DialogueMove.payload JSON
 * @returns Extracted ASPIC+ metadata or null
 */
export function extractAspicMetadataFromMove(
  dialogueMovePayload: any
): Record<string, any> | null {
  if (!dialogueMovePayload?.aspicAttack) {
    return null;
  }

  return {
    attackType: dialogueMovePayload.aspicAttack.type,
    attackerId: dialogueMovePayload.aspicAttack.attackerId,
    defenderId: dialogueMovePayload.aspicAttack.defenderId,
    succeeded: dialogueMovePayload.aspicAttack.succeeded,
    targetScope: dialogueMovePayload.aspicMetadata?.targetScope,
    cqKey: dialogueMovePayload.cqKey,
    cqText: dialogueMovePayload.cqText,
    reason: dialogueMovePayload.aspicMetadata?.reason,
  };
}
