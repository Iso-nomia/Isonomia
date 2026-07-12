/**
 * Ludicability Validation
 * 
 * Validates that a set of positions forms a proper ludic structure.
 * 
 * Based on Girard's ludics theory, a design (behaviour) must satisfy:
 * 
 * 1. **Prefix-closed**: If an address ξ is in the design, all prefixes must be too
 *    - Ensures the tree structure is complete (no orphan nodes)
 * 
 * 2. **Daimon-closed**: Terminal positions (empty ramification) must be explicit daimons
 *    - A player who has no response is "stuck" and either:
 *      a) Played a daimon (explicit termination, loses)
 *      b) Is truly stuck (implicit termination, loses)
 * 
 * 3. **Saturated**: At positive positions, all ramification branches must be covered
 *    - The active player must have a response for every possible challenge
 * 
 * These properties ensure the structure can be used for meaningful interaction
 * where the ludics semantics (stuck player loses) applies correctly.
 * 
 * @module
 */

import {
  LudicAddress,
  ArenaPositionTheory,
  addressToKey,
  keyToAddress,
  isPrefix,
  polarityAtAddress,
} from "../types/ludics-theory";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of ludicability validation
 */
export interface LudicabilityResult {
  /** Overall validation result */
  isValid: boolean;
  
  /** Prefix closure check passed */
  isPrefixClosed: boolean;
  
  /** Daimon closure check passed */
  isDaimonClosed: boolean;
  
  /** Saturation check passed */
  isSaturated: boolean;
  
  /** List of validation errors */
  errors: LudicabilityError[];
  
  /** Statistics about the structure */
  stats: {
    totalPositions: number;
    maxDepth: number;
    terminalPositions: number;
    positivePositions: number;
    negativePositions: number;
  };
}

/**
 * A specific validation error
 */
export interface LudicabilityError {
  /** Type of error */
  type: "missing-prefix" | "unclosed-daimon" | "unsaturated" | "invalid-ramification";
  
  /** Address where error occurred */
  address: LudicAddress;
  
  /** Human-readable error message */
  message: string;
  
  /** Severity level */
  severity: "error" | "warning";
  
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * Options for validation
 */
export interface ValidationOptions {
  /** Check prefix closure (default: true) */
  checkPrefixClosure?: boolean;
  
  /** Check daimon closure (default: true) */
  checkDaimonClosure?: boolean;
  
  /** Check saturation (default: true) */
  checkSaturation?: boolean;
  
  /** Strict mode: treat warnings as errors (default: false) */
  strict?: boolean;
  
  /** Max errors to report (default: 50) */
  maxErrors?: number;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate that positions form a ludicable structure
 * 
 * @param positions Map of address key → position
 * @param options Validation options
 * @returns Validation result with errors and statistics
 */
export function validateLudicability(
  positions: Map<string, ArenaPositionTheory>,
  options: ValidationOptions = {}
): LudicabilityResult {
  const {
    checkPrefixClosure = true,
    checkDaimonClosure = true,
    checkSaturation = true,
    maxErrors = 50,
  } = options;
  
  const errors: LudicabilityError[] = [];
  
  // Compute statistics
  const stats = computeStats(positions);
  
  // Check prefix closure
  let isPrefixClosed = true;
  if (checkPrefixClosure) {
    const prefixErrors = checkPrefixClosureProperty(positions, maxErrors);
    if (prefixErrors.length > 0) {
      isPrefixClosed = false;
      errors.push(...prefixErrors);
    }
  }
  
  // Check daimon closure
  let isDaimonClosed = true;
  if (checkDaimonClosure) {
    const daimonErrors = checkDaimonClosureProperty(positions, maxErrors - errors.length);
    if (daimonErrors.length > 0) {
      isDaimonClosed = false;
      errors.push(...daimonErrors);
    }
  }
  
  // Check saturation
  let isSaturated = true;
  if (checkSaturation) {
    const saturationErrors = checkSaturationProperty(positions, maxErrors - errors.length);
    if (saturationErrors.length > 0) {
      isSaturated = false;
      errors.push(...saturationErrors);
    }
  }
  
  return {
    isValid: isPrefixClosed && isDaimonClosed && isSaturated,
    isPrefixClosed,
    isDaimonClosed,
    isSaturated,
    errors: errors.slice(0, maxErrors),
    stats,
  };
}

// ============================================================================
// INDIVIDUAL PROPERTY CHECKS
// ============================================================================

/**
 * Check prefix closure property
 * 
 * For every address in positions, all prefixes must also exist.
 * 
 * Example: If [0,1,2] exists, then [], [0], and [0,1] must all exist.
 */
export function checkPrefixClosureProperty(
  positions: Map<string, ArenaPositionTheory>,
  maxErrors: number = 50
): LudicabilityError[] {
  const errors: LudicabilityError[] = [];
  const addressSet = new Set(positions.keys());
  
  for (const position of positions.values()) {
    if (errors.length >= maxErrors) break;
    
    // Check each prefix
    for (let i = 0; i < position.address.length; i++) {
      const prefix = position.address.slice(0, i);
      const prefixKey = addressToKey(prefix);
      
      if (!addressSet.has(prefixKey)) {
        errors.push({
          type: "missing-prefix",
          address: position.address,
          message: `Missing prefix [${prefix.join(",")}] for address [${position.address.join(",")}]`,
          severity: "error",
          details: {
            missingPrefix: prefix,
            originalAddress: position.address,
          },
        });
        break; // Only report first missing prefix per address
      }
    }
  }
  
  return errors;
}

/**
 * Check daimon closure property
 * 
 * Terminal positions (those with empty ramification) should be explicit.
 * This is more of a structural check - in ludics, an empty ramification
 * means the player at that position is "stuck".
 */
export function checkDaimonClosureProperty(
  positions: Map<string, ArenaPositionTheory>,
  maxErrors: number = 50
): LudicabilityError[] {
  const errors: LudicabilityError[] = [];
  
  for (const position of positions.values()) {
    if (errors.length >= maxErrors) break;
    
    // Check if this is a terminal position
    if (position.ramification.length === 0) {
      // Terminal positions are okay, but we might want to flag them as implicit daimons
      // For now, this is informational - actual "daimon" type would be explicit
      
      // Check if there should be children but none exist
      // This would indicate an incomplete structure
      const hasChildPositions = Array.from(positions.values()).some(
        (p) => isPrefix(position.address, p.address) && p.address.length > position.address.length
      );
      
      if (hasChildPositions) {
        // There are children but ramification is empty - inconsistency
        errors.push({
          type: "unclosed-daimon",
          address: position.address,
          message: `Position [${position.address.join(",")}] has children but empty ramification`,
          severity: "warning",
          details: {
            hasChildren: true,
            ramification: position.ramification,
          },
        });
      }
    }
  }
  
  return errors;
}

/**
 * Check saturation property
 * 
 * At positive positions (P's turn, even depth), all ramification indices
 * should have corresponding child positions.
 * 
 * This ensures P has a response for every possible O challenge.
 */
export function checkSaturationProperty(
  positions: Map<string, ArenaPositionTheory>,
  maxErrors: number = 50
): LudicabilityError[] {
  const errors: LudicabilityError[] = [];
  
  for (const position of positions.values()) {
    if (errors.length >= maxErrors) break;
    
    // Only check positive positions (P's turn) - polarity is "+" not "P"
    if (position.polarity !== "+") continue;
    
    // Check each ramification index has a corresponding child
    for (const index of position.ramification) {
      const childAddress: LudicAddress = [...position.address, index];
      const childKey = addressToKey(childAddress);
      
      if (!positions.has(childKey)) {
        errors.push({
          type: "unsaturated",
          address: position.address,
          message: `Position [${position.address.join(",")}] missing child at index ${index}`,
          severity: "error",
          details: {
            missingIndex: index,
            missingChildAddress: childAddress,
            ramification: position.ramification,
          },
        });
      }
    }
  }
  
  return errors;
}

/**
 * Check ramification consistency
 * 
 * Ramification indices should be consistent with actual children.
 */
export function checkRamificationConsistency(
  positions: Map<string, ArenaPositionTheory>
): LudicabilityError[] {
  const errors: LudicabilityError[] = [];
  
  // Build parent-children map
  const childrenByParent = new Map<string, LudicAddress[]>();
  
  for (const position of positions.values()) {
    if (position.address.length === 0) continue;
    
    const parentAddress = position.address.slice(0, -1);
    const parentKey = addressToKey(parentAddress);
    
    const siblings = childrenByParent.get(parentKey) || [];
    siblings.push(position.address);
    childrenByParent.set(parentKey, siblings);
  }
  
  // Check each position's ramification matches actual children
  for (const position of positions.values()) {
    const children = childrenByParent.get(addressToKey(position.address)) || [];
    const actualIndices = children.map((c) => c[c.length - 1]).sort((a, b) => a - b);
    const declaredIndices = [...position.ramification].sort((a, b) => a - b);
    
    // Check for missing in ramification
    for (const actualIndex of actualIndices) {
      if (!declaredIndices.includes(actualIndex)) {
        errors.push({
          type: "invalid-ramification",
          address: position.address,
          message: `Position [${position.address.join(",")}] has child at index ${actualIndex} not in ramification`,
          severity: "warning",
          details: {
            actualChildren: actualIndices,
            declaredRamification: declaredIndices,
          },
        });
      }
    }
  }
  
  return errors;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Compute statistics about the position structure
 */
function computeStats(positions: Map<string, ArenaPositionTheory>): LudicabilityResult["stats"] {
  let maxDepth = 0;
  let terminalPositions = 0;
  let positivePositions = 0;
  let negativePositions = 0;
  
  for (const position of positions.values()) {
    // Max depth
    if (position.address.length > maxDepth) {
      maxDepth = position.address.length;
    }
    
    // Terminal (no children)
    if (position.ramification.length === 0) {
      terminalPositions++;
    }
    
    // Polarity count
    if (position.polarity === "+") {
      positivePositions++;
    } else {
      negativePositions++;
    }
  }
  
  return {
    totalPositions: positions.size,
    maxDepth,
    terminalPositions,
    positivePositions,
    negativePositions,
  };
}

// ============================================================================
// REPAIR FUNCTIONS
// ============================================================================

/**
 * Attempt to repair prefix closure by adding missing prefixes
 * 
 * @param positions Mutable positions map to repair
 * @returns Number of positions added
 */
export function repairPrefixClosure(
  positions: Map<string, ArenaPositionTheory>
): number {
  const missing: LudicAddress[] = [];
  
  // Find all missing prefixes
  for (const position of positions.values()) {
    for (let i = 0; i < position.address.length; i++) {
      const prefix = position.address.slice(0, i);
      const prefixKey = addressToKey(prefix);
      
      if (!positions.has(prefixKey)) {
        missing.push(prefix);
      }
    }
  }
  
  // Add missing prefixes with placeholder content
  for (const prefix of missing) {
    const key = addressToKey(prefix);
    if (positions.has(key)) continue;
    
    // Find a child to determine ramification
    const ramification: number[] = [];
    for (const position of positions.values()) {
      if (isPrefix(prefix, position.address) && position.address.length === prefix.length + 1) {
        ramification.push(position.address[prefix.length]);
      }
    }
    
    positions.set(key, {
      address: prefix,
      content: "(reconstructed)",
      type: "claim",
      ramification: [...new Set(ramification)].sort((a, b) => a - b),
      polarity: polarityAtAddress(prefix),
    });
  }
  
  return missing.length;
}

/**
 * Update ramifications to match actual children
 */
export function repairRamifications(
  positions: Map<string, ArenaPositionTheory>
): number {
  let repaired = 0;
  
  // Build children map
  const childrenByParent = new Map<string, number[]>();
  
  for (const position of positions.values()) {
    if (position.address.length === 0) continue;
    
    const parentKey = addressToKey(position.address.slice(0, -1));
    const children = childrenByParent.get(parentKey) || [];
    children.push(position.address[position.address.length - 1]);
    childrenByParent.set(parentKey, children);
  }
  
  // Update ramifications
  for (const position of positions.values()) {
    const key = addressToKey(position.address);
    const actualChildren = childrenByParent.get(key) || [];
    const sortedChildren = [...new Set(actualChildren)].sort((a, b) => a - b);
    
    if (JSON.stringify(sortedChildren) !== JSON.stringify(position.ramification)) {
      position.ramification = sortedChildren;
      repaired++;
    }
  }
  
  return repaired;
}
