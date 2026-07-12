/**
 * DDS Phase 5 - Part 2: Type System Types
 * 
 * Based on Faggian & Hyland (2002) - §6.3-6.4
 * 
 * Types are behaviours with additional structure. The incarnation mechanism
 * relates designs to types, enabling type checking and inference.
 */

import type { Action, View, Chronicle, Dispute } from "../types";
import type { Strategy, Play } from "../strategy/types";
import type { Behaviour } from "../behaviours/types";

// ============================================================================
// Core Type System Types
// ============================================================================

/**
 * Type - A behaviour with type-theoretic structure
 * 
 * Types in ludics are behaviours (biorthogonal closures) that satisfy
 * additional uniformity conditions.
 */
export type LudicsType = {
  id: string;
  /** Human-readable name */
  name: string;
  /** Underlying behaviour */
  behaviourId: string;
  /** Category of type */
  category: TypeCategory;
  /** Designs that inhabit this type */
  inhabitantIds: string[];
  /** Formula representation (e.g., "A → B") */
  formula?: string;
  /** Type parameters if polymorphic */
  parameters?: TypeParameter[];
  /** Creation timestamp */
  createdAt?: Date;
};

/**
 * Type categories
 */
export type TypeCategory =
  | "base"     // Atomic type
  | "arrow"    // Function type A → B
  | "product"  // Product type A × B
  | "sum"      // Sum type A + B
  | "unit"     // Unit type
  | "void"     // Void/empty type
  | "linear";  // Linear type (used exactly once)

/**
 * Type parameter for polymorphic types
 */
export type TypeParameter = {
  name: string;
  constraint?: TypeStructure;
};

/**
 * Type structure - AST for type expressions
 */
export type TypeStructure = {
  kind: TypeStructureKind;
  /** Name for base types and variables */
  name?: string;
  /** Left component for binary type constructors */
  left?: TypeStructure;
  /** Right component for binary type constructors */
  right?: TypeStructure;
  /** Components for n-ary type constructors */
  components?: TypeStructure[];
};

export type TypeStructureKind =
  | "base"
  | "arrow"
  | "product"
  | "sum"
  | "unit"
  | "void"
  | "variable"
  | "forall"
  | "exists";

// ============================================================================
// Incarnation Types (Definition 6.3)
// ============================================================================

/**
 * Incarnation - Relationship between designs
 * 
 * D incarnates in E (D ⊂ E) if D's actions are a subset of E's actions.
 * Sharp incarnation additionally requires branch containment.
 */
export type Incarnation = {
  id: string;
  /** Source design (the one incarnating) */
  sourceDesignId: string;
  /** Target design (the one being incarnated in) */
  targetDesignId: string;
  /** Type of incarnation */
  type: "lax" | "sharp";
  /** Whether incarnation relation holds */
  isValid: boolean;
  /** Actions witnessing the incarnation */
  witnessActions?: WitnessAction[];
  /** Reason if invalid */
  invalidReason?: string;
};

/**
 * Witness action for incarnation
 */
export type WitnessAction = {
  sourceActId: string;
  targetActId: string;
  locusPath: string;
};

/**
 * Incarnation check result
 */
export type IncarnationCheck = {
  sourceDesignId: string;
  targetDesignId: string;
  /** Lax incarnation: D's actions ⊆ E's actions */
  laxIncarnation: boolean;
  /** Sharp incarnation: lax + branch containment */
  sharpIncarnation: boolean;
  /** Witness information */
  witnesses: WitnessAction[];
  /** Missing actions if lax fails */
  missingActions?: Action[];
  /** Non-contained branches if sharp fails */
  nonContainedBranches?: Action[][];
};

// ============================================================================
// Type Checking Types (D : A judgment)
// ============================================================================

/**
 * Type check result - verifies D : A judgment
 * 
 * A design D has type A if:
 * 1. Structural: D's structure matches A's structure
 * 2. Behavioral: D is orthogonal to all counter-designs of A⊥
 * 3. Inference: Inferred type of D matches or is subtype of A
 */
export type TypeCheckResult = {
  /** Design being checked */
  designId: string;
  /** Target type structure */
  targetType: TypeStructure;
  /** Overall result */
  isValid: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Method used for checking */
  method: TypeCheckMethod;
  /** Detailed analysis */
  analysis: TypeCheckAnalysis;
  /** Human-readable judgment string */
  judgment: string;
  /** Timestamp of check */
  checkedAt: Date;
};

export type TypeCheckMethod =
  | "structural"   // Check design structure matches type structure
  | "inference"    // Infer type and compare
  | "orthogonality" // Check orthogonality with counter-designs
  | "combined";    // Use multiple methods

/**
 * Detailed type check analysis
 */
export type TypeCheckAnalysis = {
  /** Structural match details */
  structural?: {
    /** Does structure match? */
    matches: boolean;
    /** Pattern detected in design */
    designPattern: TypeStructureKind;
    /** Target type kind */
    targetKind: TypeStructureKind;
    /** Specific mismatches */
    mismatches?: TypeMismatch[];
    /** Depth comparison */
    depthMatch?: boolean;
    /** Branching comparison */
    branchingMatch?: boolean;
  };
  /** Inference-based comparison */
  inference?: {
    /** Inferred type */
    inferredType: TypeStructure;
    /** Inference confidence */
    inferenceConfidence: number;
    /** Does inferred match target? */
    typesMatch: boolean;
    /** Unification result if applicable */
    unification?: Map<string, TypeStructure> | null;
    /** Is inferred a subtype of target? */
    isSubtype?: boolean;
  };
  /** Orthogonality-based check */
  orthogonality?: {
    /** Number of counter-designs tested */
    counterDesignsTested: number;
    /** All orthogonality checks passed */
    allOrthogonal: boolean;
    /** Failed orthogonality checks */
    failedChecks?: Array<{
      counterDesignId: string;
      reason: string;
    }>;
  };
  /** Why check failed (if applicable) */
  failureReason?: string;
  /** Suggestions for fixing type mismatch */
  suggestions?: string[];
};

/**
 * Type mismatch detail
 */
export type TypeMismatch = {
  /** Path to mismatch in type tree */
  path: string;
  /** Expected structure */
  expected: TypeStructureKind;
  /** Actual structure found */
  actual: TypeStructureKind;
  /** Additional context */
  context?: string;
};

// ============================================================================
// Typing Judgment Types
// ============================================================================

/**
 * Typing - Assignment of type to design (D : A)
 * 
 * Design D has type A if D inhabits the behaviour corresponding to A.
 */
export type Typing = {
  id: string;
  designId: string;
  typeId: string;
  /** String representation of judgment (e.g., "D : A → B") */
  judgment: string;
  /** Whether typing is valid */
  isValid: boolean;
  /** Proof/evidence of typing */
  proof?: TypingProof;
  /** Timestamp of check */
  checkedAt?: Date;
};

/**
 * Proof of typing judgment
 */
export type TypingProof = {
  /** Method used to verify */
  method: "membership" | "incarnation" | "structural";
  /** Witness for membership */
  membershipWitness?: {
    behaviourId: string;
    closureStep?: number;
  };
  /** Incarnation chain if applicable */
  incarnationChain?: Incarnation[];
  /** Additional notes */
  notes?: string;
};

// ============================================================================
// Type Inference Types
// ============================================================================

/**
 * Type inference result
 */
export type TypeInference = {
  designId: string;
  /** Inferred type structure */
  inferredType: TypeStructure;
  /** Confidence in inference (0-1) */
  confidence: number;
  /** Method used for inference */
  method: TypeInferenceMethod;
  /** Alternative typings */
  alternatives?: TypeStructure[];
  /** Inference context */
  context?: TypeInferenceContext;
};

export type TypeInferenceMethod =
  | "structural"    // Based on design structure
  | "behavioural"   // Based on dispute analysis
  | "chronicle"     // Based on chronicle analysis (Prop 4.27)
  | "unification"   // Based on type unification
  | "heuristic";    // Heuristic-based

/**
 * Context for type inference
 */
export type TypeInferenceContext = {
  /** Known type assignments */
  assumptions: Map<string, TypeStructure>;
  /** Unification constraints */
  constraints: TypeConstraint[];
  /** Iteration count */
  iterations: number;
};

/**
 * Type constraint for inference
 */
export type TypeConstraint = {
  kind: "equality" | "subtype" | "inhabits";
  left: TypeStructure;
  right: TypeStructure;
  source: string; // Where constraint came from
};

// ============================================================================
// Type Equivalence Types
// ============================================================================

/**
 * Type equivalence check result
 */
export type TypeEquivalence = {
  type1Id: string;
  type2Id: string;
  /** Whether types are equivalent */
  areEquivalent: boolean;
  /** Method used for comparison */
  equivalenceType: TypeEquivalenceMethod;
  /** Proof/evidence */
  proof?: TypeEquivalenceProof;
};

export type TypeEquivalenceMethod =
  | "syntactic"    // Same formula
  | "semantic"     // Same inhabitants
  | "behavioural"; // Same underlying behaviour

/**
 * Proof of type equivalence
 */
export type TypeEquivalenceProof = {
  method: TypeEquivalenceMethod;
  /** For syntactic: parsed formulas */
  syntacticWitness?: {
    formula1: string;
    formula2: string;
  };
  /** For semantic: common inhabitants */
  semanticWitness?: {
    commonInhabitantIds: string[];
    uniqueToType1: string[];
    uniqueToType2: string[];
  };
  /** For behavioural: behaviour comparison */
  behaviouralWitness?: {
    behaviour1Id: string;
    behaviour2Id: string;
    areSameClosure: boolean;
  };
};

// ============================================================================
// Type Construction Types
// ============================================================================

/**
 * Options for type creation
 */
export type TypeCreationOptions = {
  /** Name for the type */
  name?: string;
  /** Formula representation */
  formula?: string;
  /** Whether to validate inhabitants */
  validateInhabitants?: boolean;
  /** Whether to compute closure */
  computeClosure?: boolean;
};

/**
 * Options for type inference
 */
export type TypeInferenceOptions = {
  /** Maximum inference iterations */
  maxIterations?: number;
  /** Minimum confidence threshold */
  minConfidence?: number;
  /** Whether to try behavioral inference */
  useBehavioural?: boolean;
  /** Whether to return alternatives */
  includeAlternatives?: boolean;
};

/**
 * Type checking context
 */
export type TypeCheckingContext = {
  /** Available types */
  types: Map<string, LudicsType>;
  /** Type aliases */
  aliases: Map<string, TypeStructure>;
  /** Design-type mappings */
  typings: Map<string, string[]>;
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a type structure for a base type
 */
export function baseType(name: string): TypeStructure {
  return { kind: "base", name };
}

/**
 * Create an arrow type (A → B)
 */
export function arrowType(
  domain: TypeStructure,
  codomain: TypeStructure
): TypeStructure {
  return { kind: "arrow", left: domain, right: codomain };
}

/**
 * Create a product type (A × B)
 */
export function productType(
  left: TypeStructure,
  right: TypeStructure
): TypeStructure {
  return { kind: "product", left, right };
}

/**
 * Create a sum type (A + B)
 */
export function sumType(
  left: TypeStructure,
  right: TypeStructure
): TypeStructure {
  return { kind: "sum", left, right };
}

/**
 * Create a type variable
 */
export function typeVariable(name: string): TypeStructure {
  return { kind: "variable", name };
}

/**
 * Create unit type
 */
export function unitType(): TypeStructure {
  return { kind: "unit" };
}

/**
 * Create void type
 */
export function voidType(): TypeStructure {
  return { kind: "void" };
}

/**
 * Create a ludics type
 */
export function createLudicsType(
  name: string,
  behaviourId: string,
  category: TypeCategory,
  inhabitantIds: string[],
  options?: Partial<LudicsType>
): LudicsType {
  return {
    id: options?.id ?? `type-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    behaviourId,
    category,
    inhabitantIds,
    formula: options?.formula,
    parameters: options?.parameters,
    createdAt: options?.createdAt ?? new Date(),
  };
}

/**
 * Create an incarnation record
 */
export function createIncarnation(
  sourceDesignId: string,
  targetDesignId: string,
  type: "lax" | "sharp",
  isValid: boolean,
  options?: Partial<Incarnation>
): Incarnation {
  return {
    id: options?.id ?? `inc-${sourceDesignId}-${targetDesignId}`,
    sourceDesignId,
    targetDesignId,
    type,
    isValid,
    witnessActions: options?.witnessActions,
    invalidReason: options?.invalidReason,
  };
}

/**
 * Create a typing judgment
 */
export function createTyping(
  designId: string,
  typeId: string,
  isValid: boolean,
  options?: Partial<Typing>
): Typing {
  return {
    id: options?.id ?? `typing-${designId}-${typeId}`,
    designId,
    typeId,
    judgment: options?.judgment ?? `${designId} : ${typeId}`,
    isValid,
    proof: options?.proof,
    checkedAt: options?.checkedAt ?? new Date(),
  };
}

/**
 * Create a type inference result
 */
export function createTypeInference(
  designId: string,
  inferredType: TypeStructure,
  confidence: number,
  method: TypeInferenceMethod,
  options?: Partial<TypeInference>
): TypeInference {
  return {
    designId,
    inferredType,
    confidence,
    method,
    alternatives: options?.alternatives,
    context: options?.context,
  };
}

// ============================================================================
// Type Structure Utilities
// ============================================================================

/**
 * Convert type structure to string formula
 */
export function typeToString(type: TypeStructure): string {
  switch (type.kind) {
    case "base":
      return type.name || "?";
    case "variable":
      return type.name || "α";
    case "unit":
      return "1";
    case "void":
      return "0";
    case "arrow":
      return `(${typeToString(type.left!)} → ${typeToString(type.right!)})`;
    case "product":
      return `(${typeToString(type.left!)} × ${typeToString(type.right!)})`;
    case "sum":
      return `(${typeToString(type.left!)} + ${typeToString(type.right!)})`;
    case "forall":
      return `∀${type.name}. ${typeToString(type.right!)}`;
    case "exists":
      return `∃${type.name}. ${typeToString(type.right!)}`;
    default:
      return "?";
  }
}

/**
 * Check if two type structures are syntactically equal
 */
export function typeStructuresEqual(
  t1: TypeStructure,
  t2: TypeStructure
): boolean {
  if (t1.kind !== t2.kind) return false;

  switch (t1.kind) {
    case "base":
    case "variable":
      return t1.name === t2.name;
    case "unit":
    case "void":
      return true;
    case "arrow":
    case "product":
    case "sum":
      return (
        typeStructuresEqual(t1.left!, t2.left!) &&
        typeStructuresEqual(t1.right!, t2.right!)
      );
    case "forall":
    case "exists":
      return (
        t1.name === t2.name && typeStructuresEqual(t1.right!, t2.right!)
      );
    default:
      return false;
  }
}

/**
 * Get free type variables in a type structure
 */
export function freeTypeVariables(type: TypeStructure): Set<string> {
  const vars = new Set<string>();

  function collect(t: TypeStructure, bound: Set<string>): void {
    switch (t.kind) {
      case "variable":
        if (t.name && !bound.has(t.name)) {
          vars.add(t.name);
        }
        break;
      case "arrow":
      case "product":
      case "sum":
        if (t.left) collect(t.left, bound);
        if (t.right) collect(t.right, bound);
        break;
      case "forall":
      case "exists":
        if (t.right) {
          const newBound = new Set(bound);
          if (t.name) newBound.add(t.name);
          collect(t.right, newBound);
        }
        break;
    }
  }

  collect(type, new Set());
  return vars;
}

/**
 * Substitute type variable with another type
 */
export function substituteTypeVariable(
  type: TypeStructure,
  varName: string,
  replacement: TypeStructure
): TypeStructure {
  switch (type.kind) {
    case "variable":
      return type.name === varName ? replacement : type;
    case "base":
    case "unit":
    case "void":
      return type;
    case "arrow":
    case "product":
    case "sum":
      return {
        ...type,
        left: type.left
          ? substituteTypeVariable(type.left, varName, replacement)
          : undefined,
        right: type.right
          ? substituteTypeVariable(type.right, varName, replacement)
          : undefined,
      };
    case "forall":
    case "exists":
      // Don't substitute bound variables
      if (type.name === varName) {
        return type;
      }
      return {
        ...type,
        right: type.right
          ? substituteTypeVariable(type.right, varName, replacement)
          : undefined,
      };
    default:
      return type;
  }
}
