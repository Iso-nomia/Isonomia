/**
 * DDS Phase 5 - Part 2: Type Checking
 * 
 * Based on Faggian & Hyland (2002) - §6.3-6.4
 * 
 * Type checking verifies the judgment D : A (design D has type A).
 * 
 * Methods:
 * 1. Structural: Check if design's structure matches type structure
 * 2. Inference: Infer design's type and compare to target
 * 3. Orthogonality: Check design is orthogonal to counter-designs of A⊥
 * 4. Combined: Use multiple methods for higher confidence
 */

import type { DesignForCorrespondence, DesignAct } from "../correspondence/types";
import type {
  TypeStructure,
  TypeCheckResult,
  TypeCheckMethod,
  TypeCheckAnalysis,
  TypeMismatch,
  TypeStructureKind,
} from "./types";
import { inferTypeStructural, inferDesignType, unifyTypes } from "./inference";

/**
 * Server-side logging for type checking
 */
const LOG_PREFIX = "[DDS Type Check]";
function log(msg: string, data?: Record<string, any>) {
  if (data) {
    console.log(`${LOG_PREFIX} ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ${msg}`);
  }
}

/**
 * Type check options
 */
export interface TypeCheckOptions {
  /** Method to use (default: combined) */
  method?: TypeCheckMethod;
  /** All designs for behavioral analysis */
  allDesigns?: DesignForCorrespondence[];
  /** Skip orthogonality check (expensive) */
  skipOrthogonality?: boolean;
  /** Minimum confidence threshold */
  minConfidence?: number;
}

/**
 * Check if a design has a specific type (D : A judgment)
 * 
 * This is the main entry point for type checking.
 */
export async function checkDesignType(
  design: DesignForCorrespondence,
  targetType: TypeStructure,
  options: TypeCheckOptions = {}
): Promise<TypeCheckResult> {
  const method = options.method || "combined";
  log(`Checking design ${design.id} against type ${typeToString(targetType)}`, {
    method,
    designActCount: design.acts?.length || 0,
  });

  const analysis: TypeCheckAnalysis = {};
  let isValid = false;
  let confidence = 0;

  // Run checks based on method
  if (method === "structural" || method === "combined") {
    const structuralResult = checkStructuralMatch(design, targetType);
    analysis.structural = structuralResult;
    if (structuralResult) {
      log(`Structural check: ${structuralResult.matches ? "PASS" : "FAIL"}`, {
        designPattern: structuralResult.designPattern,
        targetKind: structuralResult.targetKind,
      });
    }
  }

  if (method === "inference" || method === "combined") {
    const inferenceResult = await checkViaInference(design, targetType, options.allDesigns);
    analysis.inference = inferenceResult;
    if (inferenceResult) {
      log(`Inference check: ${inferenceResult.typesMatch ? "PASS" : "FAIL"}`, {
        inferredKind: inferenceResult.inferredType.kind,
        targetKind: targetType.kind,
        confidence: inferenceResult.inferenceConfidence,
      });
    }
  }

  // Orthogonality check is more expensive - only run if requested and designs available
  if (method === "orthogonality" && !options.skipOrthogonality && options.allDesigns) {
    const orthResult = await checkViaOrthogonality(design, targetType, options.allDesigns);
    analysis.orthogonality = orthResult;
    if (orthResult) {
      log(`Orthogonality check: ${orthResult.allOrthogonal ? "PASS" : "FAIL"}`, {
        counterDesignsTested: orthResult.counterDesignsTested,
      });
    }
  }

  // Compute overall result based on method
  if (method === "combined") {
    const { valid, conf } = combineResults(analysis);
    isValid = valid;
    confidence = conf;
  } else if (method === "structural") {
    isValid = analysis.structural?.matches ?? false;
    confidence = isValid ? 0.85 : 0.15;
  } else if (method === "inference") {
    isValid = analysis.inference?.typesMatch ?? false;
    confidence = analysis.inference?.inferenceConfidence ?? 0.5;
  } else if (method === "orthogonality") {
    isValid = analysis.orthogonality?.allOrthogonal ?? false;
    confidence = isValid ? 0.95 : 0.05;
  }

  // Generate failure reason and suggestions
  if (!isValid) {
    analysis.failureReason = generateFailureReason(analysis, targetType);
    analysis.suggestions = generateSuggestions(analysis, design, targetType);
  }

  const result: TypeCheckResult = {
    designId: design.id,
    targetType,
    isValid,
    confidence,
    method,
    analysis,
    judgment: `${design.id.slice(0, 8)}... : ${typeToString(targetType)}`,
    checkedAt: new Date(),
  };

  log(`Type check complete: ${isValid ? "VALID" : "INVALID"} (${(confidence * 100).toFixed(0)}% confidence)`);
  
  return result;
}

/**
 * Check structural match between design and type
 */
function checkStructuralMatch(
  design: DesignForCorrespondence,
  targetType: TypeStructure
): TypeCheckAnalysis["structural"] {
  const acts = design.acts || [];
  
  // Detect design's structural pattern
  const designPattern = detectDesignPattern(acts);
  const targetKind = targetType.kind;
  
  // Check if patterns match
  const kindMatch = designPattern === targetKind;
  
  // Additional checks based on type
  let depthMatch = true;
  let branchingMatch = true;
  const mismatches: TypeMismatch[] = [];
  
  if (targetKind === "arrow") {
    // Arrow type should have multiple depths
    const depths = getActDepths(acts);
    depthMatch = depths.size >= 2;
    
    if (!depthMatch) {
      mismatches.push({
        path: "root",
        expected: "arrow",
        actual: designPattern,
        context: `Arrow type requires multiple depths, found ${depths.size}`,
      });
    }
  }
  
  if (targetKind === "product") {
    // Product type should have multiple branches at root
    const rootBranches = countRootBranches(acts);
    branchingMatch = rootBranches >= 2;
    
    if (!branchingMatch) {
      mismatches.push({
        path: "root",
        expected: "product",
        actual: designPattern,
        context: `Product type requires multiple branches, found ${rootBranches}`,
      });
    }
  }
  
  if (targetKind === "sum") {
    // Sum type should have exclusive branches
    const hasExclusiveBranches = checkExclusiveBranches(acts);
    branchingMatch = hasExclusiveBranches;
    
    if (!branchingMatch) {
      mismatches.push({
        path: "root",
        expected: "sum",
        actual: designPattern,
        context: "Sum type requires exclusive branches",
      });
    }
  }
  
  if (targetKind === "unit") {
    // Unit type should be minimal (0-1 acts, or single daimon)
    const isMinimal = acts.length === 0 || 
      (acts.length === 1 && acts[0].kind === "DAIMON");
    
    if (!isMinimal) {
      mismatches.push({
        path: "root",
        expected: "unit",
        actual: designPattern,
        context: `Unit type should be minimal, found ${acts.length} acts`,
      });
    }
  }
  
  const matches = kindMatch && depthMatch && branchingMatch && mismatches.length === 0;
  
  return {
    matches,
    designPattern,
    targetKind,
    mismatches: mismatches.length > 0 ? mismatches : undefined,
    depthMatch,
    branchingMatch,
  };
}

/**
 * Check type via inference comparison
 */
async function checkViaInference(
  design: DesignForCorrespondence,
  targetType: TypeStructure,
  allDesigns?: DesignForCorrespondence[]
): Promise<TypeCheckAnalysis["inference"]> {
  // Infer the design's type
  const inferredType = allDesigns && allDesigns.length > 0
    ? (await inferDesignType(design, allDesigns)).inferredType
    : inferTypeStructural(design);
  
  const inferenceConfidence = 0.75; // Base confidence for structural inference
  
  // Check if types match exactly
  const exactMatch = typesEqual(inferredType, targetType);
  
  // Check if types unify
  const unification = unifyTypes(inferredType, targetType);
  const unifies = unification !== null;
  
  // Check if inferred is subtype of target
  const isSubtype = checkSubtype(inferredType, targetType);
  
  const typesMatch = exactMatch || unifies || isSubtype;
  
  return {
    inferredType,
    inferenceConfidence,
    typesMatch,
    unification,
    isSubtype,
  };
}

/**
 * Check type via orthogonality with counter-designs
 */
async function checkViaOrthogonality(
  design: DesignForCorrespondence,
  targetType: TypeStructure,
  allDesigns: DesignForCorrespondence[]
): Promise<TypeCheckAnalysis["orthogonality"]> {
  // Find counter-designs (designs of the dual type A⊥)
  // For now, use heuristic: designs with opposite polarity structure
  const counterDesigns = findCounterDesigns(design, targetType, allDesigns);
  
  const failedChecks: Array<{ counterDesignId: string; reason: string }> = [];
  
  // In a full implementation, we'd check orthogonality with each counter-design
  // For now, we do a structural compatibility check
  for (const counter of counterDesigns) {
    const compatible = checkCompatibility(design, counter);
    if (!compatible.isCompatible) {
      failedChecks.push({
        counterDesignId: counter.id,
        reason: compatible.reason || "Structural incompatibility",
      });
    }
  }
  
  return {
    counterDesignsTested: counterDesigns.length,
    allOrthogonal: failedChecks.length === 0,
    failedChecks: failedChecks.length > 0 ? failedChecks : undefined,
  };
}

/**
 * Combine results from multiple checking methods
 */
function combineResults(analysis: TypeCheckAnalysis): { valid: boolean; conf: number } {
  const scores: number[] = [];
  
  if (analysis.structural) {
    scores.push(analysis.structural.matches ? 0.85 : 0.15);
  }
  
  if (analysis.inference) {
    const baseConf = analysis.inference.inferenceConfidence;
    if (analysis.inference.typesMatch) {
      scores.push(baseConf);
    } else {
      scores.push(1 - baseConf);
    }
  }
  
  if (analysis.orthogonality) {
    scores.push(analysis.orthogonality.allOrthogonal ? 0.95 : 0.05);
  }
  
  if (scores.length === 0) {
    return { valid: false, conf: 0.5 };
  }
  
  // Average confidence
  const avgConf = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Valid if average confidence > 0.5
  return {
    valid: avgConf > 0.5,
    conf: avgConf,
  };
}

/**
 * Generate human-readable failure reason
 */
function generateFailureReason(
  analysis: TypeCheckAnalysis,
  targetType: TypeStructure
): string {
  const reasons: string[] = [];
  
  if (analysis.structural && !analysis.structural.matches) {
    reasons.push(
      `Structure mismatch: design has ${analysis.structural.designPattern} pattern, ` +
      `expected ${analysis.structural.targetKind}`
    );
    
    if (analysis.structural.mismatches) {
      for (const m of analysis.structural.mismatches) {
        reasons.push(`  - ${m.context || `Expected ${m.expected}, found ${m.actual}`}`);
      }
    }
  }
  
  if (analysis.inference && !analysis.inference.typesMatch) {
    reasons.push(
      `Inferred type (${typeToString(analysis.inference.inferredType)}) ` +
      `does not match target type (${typeToString(targetType)})`
    );
  }
  
  if (analysis.orthogonality && !analysis.orthogonality.allOrthogonal) {
    const failCount = analysis.orthogonality.failedChecks?.length || 0;
    reasons.push(`Failed orthogonality with ${failCount} counter-design(s)`);
  }
  
  return reasons.join("; ");
}

/**
 * Generate suggestions for fixing type mismatch
 */
function generateSuggestions(
  analysis: TypeCheckAnalysis,
  design: DesignForCorrespondence,
  targetType: TypeStructure
): string[] {
  const suggestions: string[] = [];
  
  if (analysis.structural) {
    const s = analysis.structural;
    
    if (targetType.kind === "arrow" && !s.depthMatch) {
      suggestions.push(
        "Add actions at different depths to create input-output flow for arrow type"
      );
    }
    
    if (targetType.kind === "product" && !s.branchingMatch) {
      suggestions.push(
        "Add parallel branches at the root locus to match product type structure"
      );
    }
    
    if (targetType.kind === "unit" && s.designPattern !== "unit") {
      suggestions.push(
        "Simplify design to a single daimon or empty design for unit type"
      );
    }
  }
  
  if (analysis.inference && analysis.inference.inferredType) {
    const inferred = analysis.inference.inferredType;
    
    if (inferred.kind !== targetType.kind) {
      suggestions.push(
        `Design appears to have ${inferred.kind} type - consider checking against ${typeToString(inferred)} instead`
      );
    }
  }
  
  return suggestions;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect the structural pattern of a design's acts
 */
function detectDesignPattern(acts: DesignAct[]): TypeStructureKind {
  if (acts.length === 0) {
    return "unit";
  }
  
  if (acts.length === 1 && acts[0].kind === "DAIMON") {
    return "unit";
  }
  
  // Check for multiple depths (arrow pattern)
  const depths = getActDepths(acts);
  if (depths.size >= 2) {
    return "arrow";
  }
  
  // Check for multiple branches at root (product/sum)
  const rootBranches = countRootBranches(acts);
  if (rootBranches >= 2) {
    // Check if branches are exclusive (sum) or parallel (product)
    if (checkExclusiveBranches(acts)) {
      return "sum";
    }
    return "product";
  }
  
  // Default to base type
  return "base";
}

/**
 * Get unique depths from acts
 */
function getActDepths(acts: DesignAct[]): Set<number> {
  const depths = new Set<number>();
  for (const act of acts) {
    const path = act.locusPath || "";
    const depth = path.split(".").filter(Boolean).length;
    depths.add(depth);
  }
  return depths;
}

/**
 * Count root-level branches
 */
function countRootBranches(acts: DesignAct[]): number {
  const rootRamifications = new Set<string>();
  for (const act of acts) {
    const ram = act.ramification || [];
    if (ram.length > 0) {
      rootRamifications.add(JSON.stringify(ram));
    }
  }
  return rootRamifications.size;
}

/**
 * Check if branches are exclusive (sum pattern)
 */
function checkExclusiveBranches(acts: DesignAct[]): boolean {
  // Sum pattern: single-element ramifications that differ
  const singleBranches = new Set<string>();
  for (const act of acts) {
    const ram = act.ramification || [];
    if (ram.length === 1) {
      singleBranches.add(String(ram[0]));
    }
  }
  return singleBranches.size > 1;
}

/**
 * Check if two type structures are equal
 */
function typesEqual(t1: TypeStructure, t2: TypeStructure): boolean {
  if (t1.kind !== t2.kind) return false;
  
  if (t1.kind === "base" || t1.kind === "variable") {
    return t1.name === t2.name;
  }
  
  if (t1.kind === "unit" || t1.kind === "void") {
    return true;
  }
  
  // Binary types
  if (t1.left && t2.left && t1.right && t2.right) {
    return typesEqual(t1.left, t2.left) && typesEqual(t1.right, t2.right);
  }
  
  return false;
}

/**
 * Check if t1 is a subtype of t2
 * 
 * Simple subtyping rules:
 * - void <: A (void is subtype of everything)
 * - A <: A (reflexivity)
 * - (A → B) <: (A' → B') if A' <: A and B <: B' (contravariant in domain)
 */
function checkSubtype(t1: TypeStructure, t2: TypeStructure): boolean {
  // void is subtype of everything
  if (t1.kind === "void") return true;
  
  // Everything is supertype of void
  if (t2.kind === "void") return false;
  
  // Reflexivity
  if (typesEqual(t1, t2)) return true;
  
  // Variable matches anything (polymorphism)
  if (t1.kind === "variable" || t2.kind === "variable") return true;
  
  // Arrow subtyping (contravariant in domain, covariant in codomain)
  if (t1.kind === "arrow" && t2.kind === "arrow") {
    const domainOk = t1.left && t2.left ? checkSubtype(t2.left, t1.left) : true;
    const codomainOk = t1.right && t2.right ? checkSubtype(t1.right, t2.right) : true;
    return domainOk && codomainOk;
  }
  
  return false;
}

/**
 * Find counter-designs (designs of dual type)
 */
function findCounterDesigns(
  design: DesignForCorrespondence,
  targetType: TypeStructure,
  allDesigns: DesignForCorrespondence[]
): DesignForCorrespondence[] {
  // Heuristic: find designs with opposite polarity or different structure
  return allDesigns.filter(d => {
    if (d.id === design.id) return false;
    
    // Check if design has different primary polarity
    const designPolarity = design.acts?.[0]?.polarity;
    const otherPolarity = d.acts?.[0]?.polarity;
    
    return designPolarity !== otherPolarity;
  }).slice(0, 5); // Limit to 5 for performance
}

/**
 * Check structural compatibility between designs
 */
function checkCompatibility(
  design1: DesignForCorrespondence,
  design2: DesignForCorrespondence
): { isCompatible: boolean; reason?: string } {
  // Simple compatibility: designs can interact if they have complementary loci
  const loci1 = new Set((design1.acts || []).map(a => a.locusPath));
  const loci2 = new Set((design2.acts || []).map(a => a.locusPath));
  
  // Check for overlap
  let hasOverlap = false;
  for (const l of loci1) {
    if (loci2.has(l)) {
      hasOverlap = true;
      break;
    }
  }
  
  if (!hasOverlap) {
    return { isCompatible: false, reason: "No overlapping loci" };
  }
  
  return { isCompatible: true };
}

/**
 * Convert type structure to string representation
 */
function typeToString(type: TypeStructure): string {
  switch (type.kind) {
    case "base":
      return type.name || "Base";
    case "variable":
      return type.name || "T";
    case "unit":
      return "1";
    case "void":
      return "0";
    case "arrow":
      return `(${type.left ? typeToString(type.left) : "?"} → ${type.right ? typeToString(type.right) : "?"})`;
    case "product":
      return `(${type.left ? typeToString(type.left) : "?"} × ${type.right ? typeToString(type.right) : "?"})`;
    case "sum":
      return `(${type.left ? typeToString(type.left) : "?"} + ${type.right ? typeToString(type.right) : "?"})`;
    default:
      return "Unknown";
  }
}

// Export typeToString for use in other modules
export { typeToString };
