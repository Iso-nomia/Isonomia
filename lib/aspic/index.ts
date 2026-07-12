/**
 * ASPIC+ Argumentation Framework
 * 
 * Complete implementation of the ASPIC+ framework for structured argumentation.
 * 
 * Main components:
 * - Type definitions for argumentation theories, arguments, attacks, defeats
 * - Argument construction from knowledge bases and inference rules
 * - Attack computation (undermining, rebutting, undercutting)
 * - Defeat resolution with preference orderings
 * - Grounded semantics for justification status evaluation
 * 
 * Based on:
 * - Modgil & Prakken (2013) "A general account of argumentation with preferences"
 * - Dung (1995) "On the acceptability of arguments"
 * - Caminada & Amgoud (2007) "On the evaluation of argumentation formalisms"
 * 
 * @module aspic
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Argumentation system
  ArgumentationSystem,
  Rule,
  
  // Knowledge base
  KnowledgeBase,
  
  // Argumentation theory
  ArgumentationTheory,
  
  // Arguments
  Argument,
  ArgumentClassification,
  
  // Attacks and defeats
  Attack,
  AttackType,
  Defeat,
  
  // Preferences
  PreferenceRelation,
  PreferenceOrdering,
  
  // Justification
  JustificationStatus,
  ArgumentEvaluation,
  
  // Rationality
  RationalityCheck,
  WellDefinedCheck,
  
  // Utilities
  ConflictCheck,
} from "./types";

export {
  createEmptyTheory,
  classifyArgument,
} from "./types";

// ============================================================================
// ARGUMENT CONSTRUCTION
// ============================================================================

export {
  constructArguments,
  getAllSubArguments,
  findArgumentsByConclusion,
  printArgumentTree,
} from "./arguments";

export type {
  ArgumentConstructionOptions,
  ArgumentConstructionResult,
} from "./arguments";

// ============================================================================
// ATTACKS
// ============================================================================

export {
  computeAttacks,
  addClassicalNegation,
  checkConflict,
  getAttacksOn,
  getAttacksBy,
  groupAttacksByType,
  generateAttackGraph,
} from "./attacks";

// ============================================================================
// DEFEATS
// ============================================================================

export {
  computeDefeats,
  getDefeatsOn,
  getDefeatsBy,
} from "./defeats";

// ============================================================================
// SEMANTICS
// ============================================================================

export {
  computeGroundedExtension,
  computeArgumentLabeling,
  getJustificationStatus,
  isJustified,
  isDefeated,
  getArgumentsByStatus,
  summarizeExtension,
  isCompleteExtension,
  computeDefeatGraphStats,
} from "./semantics";

export type {
  GroundedExtension,
  ArgumentLabeling,
} from "./semantics";

// ============================================================================
// RATIONALITY
// ============================================================================

export {
  checkRationalityPostulates,
  checkSubArgumentClosure,
  checkStrictClosure,
  checkDirectConsistency,
  checkIndirectConsistency,
  checkWellFormedness,
  checkTranspositionClosure,
  checkContrapositionClosure,
  generateRationalityReport,
} from "./rationality";

// ============================================================================
// CQ MAPPING
// ============================================================================

export {
  cqToAspicAttack,
  batchCqToAspicAttacks,
  extractSuccessfulAttacks,
  generateCQMappingReport,
} from "./cqMapping";

export type {
  CQMetadata,
  SchemeMetadata,
  CQAttackResult,
} from "./cqMapping";

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Complete ASPIC+ pipeline: from theory to justified arguments
 * 
 * @param theory Argumentation theory (system + knowledge base)
 * @param ordering Preference ordering ("last-link" or "weakest-link")
 * @returns Grounded extension with IN/OUT/UNDECIDED status
 * 
 * @example
 * ```typescript
 * import { evaluateArgumentationTheory, createEmptyTheory } from "@/lib/aspic";
 * 
 * const theory = createEmptyTheory();
 * theory.system.language.add("p");
 * theory.knowledgeBase.axioms.add("p");
 * 
 * const extension = evaluateArgumentationTheory(theory, "last-link");
 * console.log(`Justified arguments: ${extension.inArguments.size}`);
 * ```
 */
export function evaluateArgumentationTheory(
  theory: ArgumentationTheory,
  ordering: PreferenceOrdering = "last-link"
): GroundedExtension {
  const { constructArguments } = require("./arguments");
  const { computeAttacks } = require("./attacks");
  const { computeDefeats } = require("./defeats");
  const { computeGroundedExtension } = require("./semantics");
  
  // Step 1: Construct all arguments
  const args = constructArguments(theory);
  
  // Step 2: Compute attacks
  const attacks = computeAttacks(args, theory);
  
  // Step 3: Resolve to defeats
  const defeats = computeDefeats(attacks, theory, ordering);
  
  // Step 4: Compute grounded extension
  const extension = computeGroundedExtension(args, defeats);
  
  return extension;
}

// Re-export required types for the convenience function
import type { ArgumentationTheory } from "./types";
import type { PreferenceOrdering } from "./types";
import type { GroundedExtension } from "./semantics";
