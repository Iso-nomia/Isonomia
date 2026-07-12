/**
 * TypeScript types for Multi-Scheme Arguments (Phase 1.1)
 * 
 * These types support the ArgumentNet data model where arguments can use
 * multiple argumentation schemes simultaneously.
 */

import type { 
  Argument, 
  ArgumentScheme, 
  ArgumentSchemeInstance,
  Claim 
} from "@prisma/client";

// Note: ArgumentDependency and SchemeNetPattern types will be available after full Prisma regeneration
// For now, we define them manually to match the schema
type ArgumentDependency = {
  id: string;
  sourceArgId: string | null;
  targetArgId: string | null;
  sourceSchemeId: string | null;
  targetSchemeId: string | null;
  dependencyType: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SchemeNetPattern = {
  id: string;
  name: string;
  description: string;
  domain: string | null;
  structure: any; // JSON
  usageCount: number;
  examples: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// Scheme Role & Explicitness
// ============================================================================

/**
 * Role of a scheme within an argument
 * 
 * - primary: The main inferential pattern (exactly one per argument)
 * - supporting: Enables or justifies premises of the primary scheme
 * - presupposed: Background assumptions necessary for the argument
 * - implicit: Recoverable from context or common knowledge
 */
export type SchemeRole = "primary" | "supporting" | "presupposed" | "implicit";

/**
 * Explicitness level of a scheme in the argument text
 * 
 * - explicit: Clearly stated in the argument text
 * - presupposed: Necessary but unstated assumption
 * - implied: Recoverable from context
 */
export type ExplicitnessLevel = "explicit" | "presupposed" | "implied";

/**
 * Type of dependency between arguments or schemes
 * 
 * - premise_conclusion: One scheme's conclusion feeds into another's premise
 * - enables_premise: One scheme provides support for another's premise
 * - supports_inference: One scheme justifies another's inference rule
 * - presupposes: One scheme assumes another as background
 * - sequential: Schemes applied in cognitive/temporal order
 */
export type DependencyType = 
  | "premise_conclusion"
  | "enables_premise"
  | "supports_inference"
  | "presupposes"
  | "sequential";

// ============================================================================
// Extended Argument Types
// ============================================================================

/**
 * ArgumentSchemeInstance with full scheme details
 */
export interface ArgumentSchemeInstanceWithScheme extends ArgumentSchemeInstance {
  scheme: ArgumentScheme;
}

/**
 * Argument with all scheme instances loaded
 */
export interface ArgumentWithSchemes extends Argument {
  argumentSchemes: ArgumentSchemeInstanceWithScheme[];
  scheme?: ArgumentScheme | null; // Legacy single scheme (for backward compatibility)
  claim?: Claim | null;
  conclusion?: Claim | null;
}

/**
 * Organized view of schemes by role
 */
export interface OrganizedSchemes {
  primary: ArgumentSchemeInstanceWithScheme | null;
  supporting: ArgumentSchemeInstanceWithScheme[];
  presupposed: ArgumentSchemeInstanceWithScheme[];
  implicit: ArgumentSchemeInstanceWithScheme[];
  all: ArgumentSchemeInstanceWithScheme[];
}

// ============================================================================
// Dependency Types
// ============================================================================

/**
 * ArgumentDependency with source and target details
 */
export interface ArgumentDependencyWithDetails extends ArgumentDependency {
  sourceArgument?: Argument | null;
  targetArgument?: Argument | null;
  sourceScheme?: ArgumentSchemeInstance | null;
  targetScheme?: ArgumentSchemeInstance | null;
}

// ============================================================================
// Pattern Types
// ============================================================================

/**
 * Structure definition for scheme net patterns
 */
export interface SchemeNetPatternStructure {
  primary: string; // Primary scheme key
  supporting?: string[]; // Supporting scheme keys
  presupposed?: string[]; // Presupposed scheme keys
  implicit?: string[]; // Implicit scheme keys
  dependencies?: {
    source: string; // Scheme key
    target: string; // Scheme key
    type: DependencyType;
  }[];
}

/**
 * SchemeNetPattern with parsed structure
 */
export interface SchemeNetPatternWithStructure extends SchemeNetPattern {
  structure: SchemeNetPatternStructure;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of argument net validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
}

// ============================================================================
// UI Helper Types
// ============================================================================

/**
 * Styling information for explicitness levels
 */
export interface ExplicitnessStyle {
  borderStyle: "solid" | "dashed" | "dotted";
  label: string;
  description: string;
  color: string;
  icon: string;
}

/**
 * Styling information for scheme roles
 */
export interface RoleStyle {
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  description: string;
  icon: string;
}

/**
 * Formatting for dependency types
 */
export interface DependencyTypeFormat {
  label: string;
  description: string;
  icon: string;
  color: string;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Statistics about multi-scheme usage
 */
export interface MultiSchemeStatistics {
  totalArguments: number;
  argumentsWithMultipleSchemes: number;
  averageSchemesPerArgument: number;
  mostUsedSchemes: {
    schemeId: string;
    schemeName: string;
    count: number;
    primaryCount: number;
    supportingCount: number;
  }[];
  roleDistribution: {
    primary: number;
    supporting: number;
    presupposed: number;
    implicit: number;
  };
  explicitnessDistribution: {
    explicit: number;
    presupposed: number;
    implied: number;
  };
}

/**
 * Statistics for a specific argument
 */
export interface ArgumentSchemeStatistics {
  schemeCount: number;
  roles: {
    primary: number;
    supporting: number;
    presupposed: number;
    implicit: number;
  };
  explicitness: {
    explicit: number;
    presupposed: number;
    implied: number;
  };
  averageConfidence: number;
  hasDependencies: boolean;
}

// ============================================================================
// Composed Critical Questions Types
// ============================================================================

/**
 * Critical question composed from multiple schemes
 */
export interface ComposedCriticalQuestion {
  id: string;
  question: string;
  schemeId: string;
  schemeName: string;
  schemeInstanceId: string;
  role: SchemeRole;
  attackType: string;
  targetRole?: SchemeRole;
  burden: "proponent" | "challenger" | "shared";
  satisfied: boolean;
}

/**
 * Set of critical questions composed from all schemes in an argument
 */
export interface ComposedCQSet {
  argumentId: string;
  totalCount: number;
  byScheme: {
    schemeId: string;
    schemeName: string;
    role: SchemeRole;
    cqs: ComposedCriticalQuestion[];
  }[];
  byAttackType: {
    attackType: string;
    count: number;
    cqs: ComposedCriticalQuestion[];
  }[];
  byTargetRole: {
    role: SchemeRole;
    count: number;
    cqs: ComposedCriticalQuestion[];
  }[];
  statistics: {
    total: number;
    satisfied: number;
    unsatisfied: number;
    byBurden: {
      proponent: number;
      challenger: number;
      shared: number;
    };
  };
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Options for querying arguments with schemes
 */
export interface ArgumentWithSchemesOptions {
  includeScheme?: boolean; // Include legacy single scheme
  includeClaim?: boolean; // Include claim relation
  includeConclusion?: boolean; // Include conclusion relation
  includeDependencies?: boolean; // Include argument dependencies
}

/**
 * Options for filtering scheme instances
 */
export interface SchemeInstanceFilter {
  roles?: SchemeRole[];
  explicitness?: ExplicitnessLevel[];
  minConfidence?: number;
  schemeIds?: string[];
}
