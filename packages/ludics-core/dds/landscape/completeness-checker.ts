/**
 * ============================================
 * COMPLETENESS CHECKER
 * ============================================
 * 
 * Check completeness of behaviours and designs.
 * 
 * From Girard's ludics:
 * - A behaviour is complete if G = G⊥⊥ (biorthogonal closure)
 * - Internal completeness: All positions have defined responses
 * - Saturation: No missing designs
 * 
 * This module provides diagnostics for incomplete behaviours,
 * helping identify where designs need to be extended.
 */

import type {
  LudicDesignTheory,
  LudicBehaviourTheory,
  LudicAddress,
  Chronicle,
  DialogueAct,
  Polarity,
  DeliberationArena,
} from "../types/ludics-theory";

import {
  addressEquals,
  addressToKey,
  keyToAddress,
  isAddressPrefix,
  flipPolarity,
  getParentAddress,
} from "../types/ludics-theory";

import {
  computeBiorthogonalClosure,
  designSetsEqual,
  converges,
  getAllAddresses,
} from "./behaviour-computer";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Completeness check result
 */
export interface CompletenessResult {
  /** Is the behaviour/design complete? */
  isComplete: boolean;

  /** Is the behaviour internally complete? (all positions have responses) */
  isInternallyComplete: boolean;

  /** Designs that would be added by closure */
  missingDesigns: LudicDesignTheory[];

  /** Designs that aren't in the orthogonal's orthogonal */
  excessDesigns: LudicDesignTheory[];

  /** Diagnostic messages */
  diagnostics: CompletenessDialognostic[];

  /** Summary statistics */
  statistics: CompletenessStatistics;
}

/**
 * Completeness diagnostic
 */
export interface CompletenessDialognostic {
  /** Diagnostic type */
  type: "missing_response" | "missing_design" | "excess_design" | "incomplete_chronicle" | "info";

  /** Severity */
  severity: "error" | "warning" | "info";

  /** Message */
  message: string;

  /** Related address (if applicable) */
  address?: LudicAddress;

  /** Related design ID (if applicable) */
  designId?: string;
}

/**
 * Completeness statistics
 */
export interface CompletenessStatistics {
  /** Number of designs checked */
  designCount: number;

  /** Number of complete designs */
  completeDesigns: number;

  /** Number of positions covered */
  positionsCovered: number;

  /** Total positions in arena */
  totalPositions: number;

  /** Coverage ratio (0-1) */
  coverageRatio: number;

  /** Number of missing responses */
  missingResponses: number;
}

/**
 * Design completeness result
 */
export interface DesignCompletenessResult {
  /** Design ID */
  designId: string;

  /** Is the design internally complete? */
  isComplete: boolean;

  /** Positions missing responses */
  missingResponses: MissingResponse[];

  /** Incomplete chronicles */
  incompleteChronicles: Chronicle[];

  /** Total positions in design */
  positionCount: number;

  /** Positions with responses */
  responseCount: number;
}

/**
 * Missing response information
 */
export interface MissingResponse {
  /** Position that needs a response */
  address: LudicAddress;

  /** Expected polarity of response */
  expectedPolarity: Polarity;

  /** Why this response is needed */
  reason: string;
}

/**
 * Validation result type
 */
export interface ValidationResult {
  /** Is valid? */
  valid: boolean;

  /** Validation errors */
  errors: ValidationError[];

  /** Validation warnings */
  warnings: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Location of error */
  location?: string;
}

// ============================================================================
// BEHAVIOUR COMPLETENESS
// ============================================================================

/**
 * Check if a behaviour is complete
 * 
 * A behaviour is complete if G = G⊥⊥.
 * 
 * @param behaviour The behaviour to check
 * @returns Completeness result with diagnostics
 */
export function checkBehaviourCompleteness(
  behaviour: LudicBehaviourTheory
): CompletenessResult {
  const diagnostics: CompletenessDialognostic[] = [];
  
  if (behaviour.designs.length === 0) {
    return {
      isComplete: true, // Empty behaviour is complete
      isInternallyComplete: true,
      missingDesigns: [],
      excessDesigns: [],
      diagnostics: [{
        type: "info",
        severity: "info",
        message: "Empty behaviour is trivially complete",
      }],
      statistics: {
        designCount: 0,
        completeDesigns: 0,
        positionsCovered: 0,
        totalPositions: 0,
        coverageRatio: 1,
        missingResponses: 0,
      },
    };
  }

  // Compute biorthogonal closure
  const closed = computeBiorthogonalClosure(behaviour.designs);

  // Check if closure equals original
  const isComplete = designSetsEqual(behaviour.designs, closed);

  // Find missing designs (in closure but not in original)
  const originalIds = new Set(behaviour.designs.map((d) => d.id));
  const missingDesigns = closed.filter((d) => !originalIds.has(d.id));

  // Find excess designs (in original but not in closure)
  const closedIds = new Set(closed.map((d) => d.id));
  const excessDesigns = behaviour.designs.filter((d) => !closedIds.has(d.id));

  // Add diagnostics
  if (!isComplete) {
    diagnostics.push({
      type: "info",
      severity: "warning",
      message: `Behaviour is not complete: ${missingDesigns.length} missing, ${excessDesigns.length} excess designs`,
    });
  }

  for (const missing of missingDesigns) {
    diagnostics.push({
      type: "missing_design",
      severity: "warning",
      message: `Missing design that would be added by closure`,
      designId: missing.id,
    });
  }

  for (const excess of excessDesigns) {
    diagnostics.push({
      type: "excess_design",
      severity: "warning",
      message: `Design not in biorthogonal closure`,
      designId: excess.id,
    });
  }

  // Check internal completeness of each design
  const designResults = behaviour.designs.map(checkDesignCompleteness);
  const completeDesigns = designResults.filter((r) => r.isComplete).length;
  const totalMissingResponses = designResults.reduce(
    (sum, r) => sum + r.missingResponses.length,
    0
  );

  // Collect all positions covered
  const allAddresses = getAllAddresses(behaviour.designs);
  const positionsCovered = allAddresses.length;

  // Determine internal completeness
  const isInternallyComplete = totalMissingResponses === 0;

  if (!isInternallyComplete) {
    diagnostics.push({
      type: "info",
      severity: "warning",
      message: `${totalMissingResponses} missing responses across designs`,
    });
  }

  return {
    isComplete,
    isInternallyComplete,
    missingDesigns,
    excessDesigns,
    diagnostics,
    statistics: {
      designCount: behaviour.designs.length,
      completeDesigns,
      positionsCovered,
      totalPositions: allAddresses.length,
      coverageRatio: 1, // All known positions are covered by definition
      missingResponses: totalMissingResponses,
    },
  };
}

/**
 * Check internal completeness of a behaviour
 * 
 * Internal completeness means all positions have defined responses.
 * 
 * @param behaviour The behaviour to check
 * @returns Whether internally complete
 */
export function checkInternalCompleteness(
  behaviour: LudicBehaviourTheory
): CompletenessResult {
  return checkBehaviourCompleteness(behaviour);
}

// ============================================================================
// DESIGN COMPLETENESS
// ============================================================================

/**
 * Check completeness of a single design
 * 
 * A design is complete if all chronicles end properly and
 * all reachable positions have responses.
 * 
 * @param design The design to check
 * @returns Design completeness result
 */
export function checkDesignCompleteness(
  design: LudicDesignTheory
): DesignCompletenessResult {
  const missingResponses: MissingResponse[] = [];
  const incompleteChronicles: Chronicle[] = [];

  // Build response map
  const responseMap = new Map<string, DialogueAct[]>();
  for (const chronicle of design.chronicles) {
    for (const action of chronicle.actions) {
      const key = addressToKey(action.focus);
      const existing = responseMap.get(key) ?? [];
      existing.push(action);
      responseMap.set(key, existing);
    }
  }

  // Get all addresses (positions)
  const addresses = getAllAddresses([design]);
  
  // Find reachable addresses that might need responses
  const reachablePositions = findReachablePositions(design);

  // Check each reachable position for responses
  for (const addr of reachablePositions) {
    const key = addressToKey(addr);
    const responses = responseMap.get(key);

    if (!responses || responses.length === 0) {
      // No response at this position
      const expectedPolarity = design.polarity;
      
      missingResponses.push({
        address: addr,
        expectedPolarity,
        reason: `No response defined at position ${key}`,
      });
    }
  }

  // Check for incomplete chronicles
  for (const chronicle of design.chronicles) {
    if (!chronicle.isComplete) {
      // Check if it ends with daimon
      const lastAction = chronicle.actions[chronicle.actions.length - 1];
      if (!lastAction || lastAction.type !== "daimon") {
        incompleteChronicles.push(chronicle);
      }
    }
  }

  const positionCount = addresses.length;
  const responseCount = responseMap.size;

  return {
    designId: design.id,
    isComplete: missingResponses.length === 0 && incompleteChronicles.length === 0,
    missingResponses,
    incompleteChronicles,
    positionCount,
    responseCount,
  };
}

/**
 * Find all positions reachable from design's chronicles
 */
function findReachablePositions(design: LudicDesignTheory): LudicAddress[] {
  const reachable = new Set<string>();

  // Add base positions
  for (const base of design.base) {
    reachable.add(addressToKey(base));
  }

  // Add all ramification addresses
  for (const chronicle of design.chronicles) {
    for (const action of chronicle.actions) {
      // The position itself
      reachable.add(addressToKey(action.focus));

      // All ramifications are reachable
      for (const ram of action.ramification) {
        reachable.add(addressToKey(ram));
      }
    }
  }

  return [...reachable].map(keyToAddress);
}

// ============================================================================
// MISSING DESIGN DETECTION
// ============================================================================

/**
 * Find designs that should exist but don't
 * 
 * @param behaviour The behaviour to analyze
 * @returns Missing designs
 */
export function findMissingDesigns(
  behaviour: LudicBehaviourTheory
): LudicDesignTheory[] {
  const closed = computeBiorthogonalClosure(behaviour.designs);
  const originalIds = new Set(behaviour.designs.map((d) => d.id));
  
  return closed.filter((d) => !originalIds.has(d.id));
}

/**
 * Suggest designs to add for completeness
 * 
 * @param behaviour Current behaviour
 * @param arena Optional arena for context
 * @returns Suggested designs
 */
export function suggestDesigns(
  behaviour: LudicBehaviourTheory,
  arena?: DeliberationArena
): LudicDesignTheory[] {
  const missing = findMissingDesigns(behaviour);
  
  // For now, return the missing designs from closure
  // Future: Generate specific suggestions based on arena structure
  
  return missing;
}

// ============================================================================
// STRUCTURE VALIDATION
// ============================================================================

/**
 * Validate behaviour structure
 * 
 * @param behaviour The behaviour to validate
 * @returns Validation result
 */
export function validateBehaviourStructure(
  behaviour: LudicBehaviourTheory
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check for empty behaviour
  if (behaviour.designs.length === 0) {
    warnings.push("Behaviour contains no designs");
  }

  // Validate each design
  for (const design of behaviour.designs) {
    const designValidation = validateDesignStructure(design);
    
    if (!designValidation.valid) {
      errors.push(...designValidation.errors.map((e) => ({
        ...e,
        location: `design:${design.id}`,
      })));
    }
    
    warnings.push(...designValidation.warnings.map(
      (w) => `[${design.id}] ${w}`
    ));
  }

  // Check base consistency
  if (behaviour.designs.length > 0) {
    const firstBase = behaviour.designs[0].base;
    const inconsistentBases = behaviour.designs.filter(
      (d) => !basesEqual(d.base, firstBase)
    );
    
    if (inconsistentBases.length > 0) {
      warnings.push(`${inconsistentBases.length} designs have inconsistent bases`);
    }
  }

  // Check polarity consistency
  const polarities = new Set(behaviour.designs.map((d) => d.polarity));
  if (polarities.size > 1) {
    warnings.push("Behaviour contains designs with mixed polarities");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate design structure
 */
export function validateDesignStructure(
  design: LudicDesignTheory
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check for empty design
  if (design.chronicles.length === 0) {
    warnings.push("Design contains no chronicles");
  }

  // Validate each chronicle
  for (const chronicle of design.chronicles) {
    // Check for empty chronicle
    if (chronicle.actions.length === 0) {
      warnings.push(`Chronicle ${chronicle.id ?? "unknown"} is empty`);
      continue;
    }

    // Check polarity sequence
    let expectedPolarity = design.polarity;
    for (let i = 0; i < chronicle.actions.length; i++) {
      const action = chronicle.actions[i];
      
      // After first action, polarity should alternate
      if (i > 0 && action.polarity === chronicle.actions[i - 1].polarity) {
        warnings.push(
          `Chronicle has non-alternating polarity at action ${i}`
        );
      }
    }

    // Check address validity
    for (const action of chronicle.actions) {
      for (const ram of action.ramification) {
        // Ramification should be children of focus
        if (!isValidRamification(action.focus, ram)) {
          errors.push({
            code: "INVALID_RAMIFICATION",
            message: `Ramification ${addressToKey(ram)} is not a valid child of ${addressToKey(action.focus)}`,
          });
        }
      }
    }
  }

  // Check daimon consistency
  if (design.hasDaimon) {
    const hasDaimonAction = design.chronicles.some(
      (c) => c.actions.some((a) => a.type === "daimon")
    );
    
    if (!hasDaimonAction) {
      warnings.push("Design marked as having daimon but no daimon action found");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if ramification is valid for focus
 */
function isValidRamification(focus: LudicAddress, ramification: LudicAddress): boolean {
  // Ramification should be a direct child (one level deeper)
  if (ramification.length !== focus.length + 1) {
    return false;
  }
  
  // Should share prefix with focus
  return isAddressPrefix(focus, ramification);
}

/**
 * Check if two base arrays are equal
 */
function basesEqual(a: LudicAddress[], b: LudicAddress[]): boolean {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (!addressEquals(a[i], b[i])) return false;
  }
  
  return true;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get completeness summary as string
 */
export function getCompletenessSummary(result: CompletenessResult): string {
  const lines: string[] = [];
  
  lines.push(`Behaviour Completeness: ${result.isComplete ? "✓ Complete" : "✗ Incomplete"}`);
  lines.push(`Internal Completeness: ${result.isInternallyComplete ? "✓ Complete" : "✗ Incomplete"}`);
  lines.push("");
  lines.push("Statistics:");
  lines.push(`  - Designs: ${result.statistics.designCount} (${result.statistics.completeDesigns} complete)`);
  lines.push(`  - Positions covered: ${result.statistics.positionsCovered}`);
  lines.push(`  - Missing responses: ${result.statistics.missingResponses}`);
  lines.push(`  - Missing designs: ${result.missingDesigns.length}`);
  lines.push(`  - Excess designs: ${result.excessDesigns.length}`);
  
  if (result.diagnostics.length > 0) {
    lines.push("");
    lines.push("Diagnostics:");
    for (const diag of result.diagnostics) {
      const icon = diag.severity === "error" ? "✗" : diag.severity === "warning" ? "!" : "i";
      lines.push(`  [${icon}] ${diag.message}`);
    }
  }
  
  return lines.join("\n");
}

/**
 * Check if behaviour is minimally complete
 * 
 * A behaviour is minimally complete if:
 * 1. It contains at least one design
 * 2. All designs have at least one chronicle
 * 3. All chronicles have at least one action
 */
export function isMinimallyComplete(behaviour: LudicBehaviourTheory): boolean {
  if (behaviour.designs.length === 0) return false;
  
  for (const design of behaviour.designs) {
    if (design.chronicles.length === 0) return false;
    
    for (const chronicle of design.chronicles) {
      if (chronicle.actions.length === 0) return false;
    }
  }
  
  return true;
}

/**
 * Get coverage report for a behaviour
 */
export interface CoverageReport {
  /** All addresses in the behaviour */
  allAddresses: LudicAddress[];
  
  /** Addresses with P responses */
  pCovered: LudicAddress[];
  
  /** Addresses with O responses */
  oCovered: LudicAddress[];
  
  /** Addresses without any response */
  uncovered: LudicAddress[];
  
  /** Coverage percentage */
  coveragePercent: number;
}

/**
 * Generate coverage report
 */
export function getCoverageReport(behaviour: LudicBehaviourTheory): CoverageReport {
  const allAddresses = getAllAddresses(behaviour.designs);
  const pCovered: LudicAddress[] = [];
  const oCovered: LudicAddress[] = [];
  
  // Build response maps
  for (const design of behaviour.designs) {
    for (const chronicle of design.chronicles) {
      for (const action of chronicle.actions) {
        const target = action.polarity === "+" ? pCovered : oCovered;
        if (!target.some((a) => addressEquals(a, action.focus))) {
          target.push(action.focus);
        }
      }
    }
  }
  
  // Find uncovered
  const covered = new Set([
    ...pCovered.map(addressToKey),
    ...oCovered.map(addressToKey),
  ]);
  
  const uncovered = allAddresses.filter(
    (a) => !covered.has(addressToKey(a))
  );
  
  const coveragePercent = allAddresses.length > 0
    ? ((allAddresses.length - uncovered.length) / allAddresses.length) * 100
    : 100;
  
  return {
    allAddresses,
    pCovered,
    oCovered,
    uncovered,
    coveragePercent,
  };
}
