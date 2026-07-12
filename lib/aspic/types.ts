/**
 * ASPIC+ Type Definitions
 * 
 * Based on:
 * - Modgil, S., & Prakken, H. (2013). "A general account of argumentation with preferences."
 * - Caminada, M., & Amgoud, L. (2007). "On the evaluation of argumentation formalisms."
 * 
 * This module defines the core types for the ASPIC+ argumentation framework,
 * supporting structured argumentation with strict/defeasible rules, preferences,
 * and attack/defeat mechanisms.
 */

// ============================================================================
// CORE ASPIC+ STRUCTURES
// ============================================================================

/**
 * Rule: Inference pattern (strict or defeasible)
 * 
 * Strict rules (Rs): Premises logically guarantee conclusion
 *   Example: p, p→q ⊢ q
 * 
 * Defeasible rules (Rd): Premises create presumption for conclusion
 *   Example: Bird(x) ⇒ Flies(x)
 */
export interface Rule {
  id: string;
  antecedents: string[];  // Premise formulae
  consequent: string;     // Conclusion formula
  type: "strict" | "defeasible";
}

/**
 * Argumentation System (AS)
 * Defines the language and inference rules
 */
export interface ArgumentationSystem {
  /** Logical language L (set of well-formed formulae) */
  language: Set<string>;
  
  /** Contrariness function: φ̄ maps each formula to its contraries */
  contraries: Map<string, Set<string>>;
  
  /** Strict inference rules Rs */
  strictRules: Rule[];
  
  /** Defeasible inference rules Rd */
  defeasibleRules: Rule[];
  
  /** Naming function n: Rd → L (maps defeasible rules to formulae for undercutting) */
  ruleNames: Map<string, string>; // ruleId → formula
}

/**
 * Knowledge Base (KB)
 * Partitioned into three categories based on fallibility
 */
export interface KnowledgeBase {
  /** Kn: Necessary axioms (infallible, cannot be attacked) */
  axioms: Set<string>;
  
  /** Kp: Ordinary premises (fallible, can be undermined) */
  premises: Set<string>;
  
  /** Ka: Assumptions (fallible, attacks always succeed) */
  assumptions: Set<string>;
  
  /** Preference ordering on ordinary premises ≤' */
  premisePreferences: Array<{ preferred: string; dispreferred: string }>;
  
  /** Preference ordering on defeasible rules ≤ */
  rulePreferences: Array<{ preferred: string; dispreferred: string }>;
}

/**
 * Argumentation Theory (AT)
 * Complete specification: AT = (AS, KB)
 */
export interface ArgumentationTheory {
  system: ArgumentationSystem;
  knowledgeBase: KnowledgeBase;
}

// ============================================================================
// ARGUMENT STRUCTURE
// ============================================================================

/**
 * Argument: Inference tree built from KB and rules
 * 
 * Structure:
 * - Base case: φ (where φ ∈ K)
 * - Strict inference: A1,...,An →s φ
 * - Defeasible inference: A1,...,An ⇒d φ
 */
export interface Argument {
  /** Unique identifier */
  id: string;
  
  /** Premises used: prem(A) */
  premises: Set<string>;
  
  /** Conclusion: conc(A) */
  conclusion: string;
  
  /** Sub-arguments: sub(A) */
  subArguments: Argument[];
  
  /** Defeasible rules used: DefRules(A) */
  defeasibleRules: Set<string>; // Rule IDs
  
  /** Top rule: TopRule(A) (undefined for premise-only args) */
  topRule?: {
    ruleId: string;
    type: "strict" | "defeasible";
  };
  
  /** Argument structure for display/debugging */
  structure: ArgumentStructure;
}

/**
 * Argument structure representation
 */
export type ArgumentStructure =
  | { type: "premise"; formula: string; source: "axiom" | "premise" | "assumption" }
  | { type: "inference"; rule: Rule; subArguments: ArgumentStructure[]; conclusion: string };

/**
 * Argument classification helpers
 */
export interface ArgumentClassification {
  /** Strict: DefRules(A) = ∅ */
  isStrict: boolean;
  
  /** Defeasible: DefRules(A) ≠ ∅ */
  isDefeasible: boolean;
  
  /** Firm: Prem(A) ⊆ Kn */
  isFirm: boolean;
  
  /** Plausible: Prem(A) ∩ Kp ≠ ∅ */
  isPlausible: boolean;
  
  /** Fallible: defeasible OR plausible */
  isFallible: boolean;
}

// ============================================================================
// ATTACK MECHANISMS
// ============================================================================

/**
 * Attack Type
 * Three fundamental mechanisms from ASPIC+ specification
 */
export type AttackType = "undermining" | "rebutting" | "undercutting";

/**
 * Attack: Conflict between arguments
 * 
 * Attack types:
 * 1. Undermining: A attacks B on ordinary premise φ
 *    - conc(A) ∈ φ̄ where φ ∈ Prem(B) ∩ Kp
 * 
 * 2. Rebutting: A attacks B on defeasible conclusion φ
 *    - conc(A) ∈ φ̄ where φ = conc(B') for defeasible sub-arg B'
 * 
 * 3. Undercutting: A attacks B on defeasible rule r
 *    - conc(A) ∈ n(r)̄ where r ∈ DefRules(B')
 */
export interface Attack {
  /** Attacking argument */
  attacker: Argument;
  
  /** Attacked argument */
  attacked: Argument;
  
  /** Attack type */
  type: AttackType;
  
  /** Target of attack (premise, conclusion, or rule) */
  target: {
    /** For undermining: premise formula */
    premise?: string;
    
    /** For rebutting: sub-argument with defeasible conclusion */
    subArgument?: Argument;
    
    /** For undercutting: defeasible rule ID */
    ruleId?: string;
  };
  
  /** Metadata for provenance */
  metadata?: {
    cqId?: string;
    cqText?: string;
    schemeKey?: string;
  };
}

// ============================================================================
// DEFEAT RESOLUTION
// ============================================================================

/**
 * Preference Ordering
 * Determines whether attacks succeed as defeats
 */
export type PreferenceOrdering = "last-link" | "weakest-link" | "custom";

/**
 * Defeat: Successful attack (after preference resolution)
 * 
 * Success conditions:
 * - Undercutting: Always succeeds (no preference check)
 * - Undermining/Rebutting: Succeeds if A ⊀ B' (attacker not strictly less preferred)
 */
export interface Defeat {
  /** Defeating argument */
  defeater: Argument;
  
  /** Defeated argument */
  defeated: Argument;
  
  /** Original attack that succeeded */
  attack: Attack;
  
  /** Whether preferences were consulted */
  preferenceApplied: boolean;
}

/**
 * Abstract Argumentation Framework (AF)
 * Generated from ASPIC+ theory: AF = ⟨A, D⟩
 */
export interface AbstractArgumentationFramework {
  /** Set of all arguments */
  arguments: Argument[];
  
  /** Defeat relation (successful attacks) */
  defeats: Defeat[];
  
  /** Source theory */
  sourceTheory: ArgumentationTheory;
}

// ============================================================================
// SEMANTICS & EXTENSIONS
// ============================================================================

/**
 * Extension Semantics
 * Dungean acceptability semantics
 */
export type ExtensionSemantics = 
  | "grounded"    // Unique, skeptical
  | "preferred"   // Maximal admissible
  | "stable"      // Conflict-free + attacks all outside
  | "complete";   // Admissible + contains all defended args

/**
 * Extension: Set of jointly acceptable arguments
 */
export interface Extension {
  /** Arguments in extension */
  arguments: Set<Argument>;
  
  /** Semantics used */
  semantics: ExtensionSemantics;
  
  /** Conclusions justified by extension */
  conclusions: Set<string>;
}

/**
 * Justification Status
 * Status of a formula under extension semantics
 */
export type JustificationStatus =
  | "unsatisfiable"  // No argument exists for formula
  | "defended"       // Argument in grounded extension
  | "out"            // All arguments defeated by grounded extension
  | "blocked";       // Argument exists but not in grounded extension, not defeated

/**
 * Argument Evaluation Result
 */
export interface ArgumentEvaluation {
  /** Argument being evaluated */
  argument: Argument;
  
  /** Justification status */
  status: JustificationStatus;
  
  /** Extension membership */
  inGroundedExtension: boolean;
  inPreferredExtensions: boolean[];
  
  /** Attackers and their status */
  attackedBy: Array<{
    attacker: Argument;
    attack: Attack;
    defeats: boolean;
  }>;
  
  /** Arguments this defeats */
  defeats: Argument[];
}

// ============================================================================
// RATIONALITY POSTULATES
// ============================================================================

/**
 * Rationality Postulates (Caminada & Amgoud 2007)
 * Properties that well-behaved extensions should satisfy
 */
export interface RationalityCheck {
  /** Sub-argument Closure: A ∈ E ⟹ sub(A) ⊆ E */
  subArgumentClosure: boolean;
  
  /** Closure under Strict Rules: Conc(E) closed under Rs */
  strictClosure: boolean;
  
  /** Direct Consistency: No φ, ψ ∈ Conc(E) where ψ ∈ φ̄ */
  directConsistency: boolean;
  
  /** Indirect Consistency: Cls(Conc(E)) is directly consistent */
  indirectConsistency: boolean;
  
  /** Violations (if any) */
  violations: Array<{
    postulate: keyof Omit<RationalityCheck, "violations">;
    description: string;
    evidence: any;
  }>;
}

/**
 * Well-Defined SAF Requirements
 * Conditions for satisfying rationality postulates
 */
export interface WellDefinedCheck {
  /** Closed under transposition OR contraposition */
  closureProperty: "transposition" | "contraposition" | "none";
  
  /** Axioms Kn are indirectly consistent */
  axiomConsistency: boolean;
  
  /** Well-formedness: contraries not axioms/strict consequents */
  wellFormedness: boolean;
  
  /** Reasonable ordering on preferences */
  reasonableOrdering: boolean;
  
  /** Overall well-defined status */
  isWellDefined: boolean;
  
  /** Issues (if any) */
  issues: string[];
}

// ============================================================================
// COMPUTATION CONTEXT
// ============================================================================

/**
 * ASPIC+ Computation Context
 * Tracks intermediate results during evaluation
 */
export interface AspicComputationContext {
  /** Source theory */
  theory: ArgumentationTheory;
  
  /** All constructed arguments */
  arguments: Argument[];
  
  /** Attack relation */
  attacks: Attack[];
  
  /** Defeat relation */
  defeats: Defeat[];
  
  /** Grounded extension */
  groundedExtension: Extension;
  
  /** Justification status map */
  justificationStatus: Map<string, JustificationStatus>;
  
  /** Performance metrics */
  metrics: {
    argumentCount: number;
    attackCount: number;
    defeatCount: number;
    computationTimeMs: number;
  };
  
  /** Rationality check results */
  rationality: RationalityCheck;
  
  /** Well-defined check results */
  wellDefined: WellDefinedCheck;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Argument comparison result
 */
export type ArgumentComparison = "less" | "equal" | "greater" | "incomparable";

/**
 * Preference relation ≺
 */
export interface PreferenceRelation {
  /** Check if arg1 ≺ arg2 (arg1 strictly less preferred than arg2) */
  isLessPreferred(arg1: Argument, arg2: Argument): boolean;
  
  /** Check if arg1 ≤ arg2 (arg1 less or equally preferred to arg2) */
  isLessOrEquallyPreferred(arg1: Argument, arg2: Argument): boolean;
  
  /** Compare two arguments */
  compare(arg1: Argument, arg2: Argument): ArgumentComparison;
}

/**
 * Conflict check result
 */
export interface ConflictCheck {
  /** Are the formulae contraries? */
  areContraries: boolean;
  
  /** Are they contradictories? (symmetric contraries) */
  areContradictories: boolean;
  
  /** Contrariness direction (if asymmetric) */
  direction?: "phi-contrary-of-psi" | "psi-contrary-of-phi";
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Helper: Create empty knowledge base
 */
export function createEmptyKB(): KnowledgeBase {
  return {
    axioms: new Set(),
    premises: new Set(),
    assumptions: new Set(),
    premisePreferences: [],
    rulePreferences: [],
  };
}

/**
 * Helper: Create empty argumentation system
 */
export function createEmptyAS(): ArgumentationSystem {
  return {
    language: new Set(),
    contraries: new Map(),
    strictRules: [],
    defeasibleRules: [],
    ruleNames: new Map(),
  };
}

/**
 * Helper: Create empty argumentation theory
 */
export function createEmptyTheory(): ArgumentationTheory {
  return {
    system: createEmptyAS(),
    knowledgeBase: createEmptyKB(),
  };
}

/**
 * Helper: Classify an argument
 */
export function classifyArgument(
  arg: Argument,
  kb: KnowledgeBase
): ArgumentClassification {
  const isDefeasible = arg.defeasibleRules.size > 0;
  const isStrict = !isDefeasible;
  
  const plausiblePremises = Array.from(arg.premises).filter(
    p => kb.premises.has(p) || kb.assumptions.has(p)
  );
  const isPlausible = plausiblePremises.length > 0;
  const isFirm = !isPlausible;
  
  const isFallible = isDefeasible || isPlausible;
  
  return {
    isStrict,
    isDefeasible,
    isFirm,
    isPlausible,
    isFallible,
  };
}
