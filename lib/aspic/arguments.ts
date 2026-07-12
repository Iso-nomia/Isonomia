/**
 * ASPIC+ Argument Construction
 * 
 * Implements recursive argument building from knowledge base and inference rules.
 * Based on ASPIC+ definition 3.3 from Prakken & Modgil (2013).
 * 
 * Arguments are inference trees constructed by:
 * 1. Base case: φ where φ ∈ K (knowledge base)
 * 2. Strict inference: A1,...,An →s φ
 * 3. Defeasible inference: A1,...,An ⇒d φ
 */

import type {
  ArgumentationTheory,
  Argument,
  ArgumentStructure,
  Rule,
} from "./types";

// ============================================================================
// ARGUMENT CONSTRUCTION
// ============================================================================

/**
 * Construct all possible arguments from an argumentation theory
 * 
 * Uses bottom-up construction:
 * 1. Create base arguments from KB
 * 2. Apply rules to derive new arguments
 * 3. Continue until no new arguments can be derived
 * 
 * @param theory Argumentation theory (AS + KB)
 * @param options Construction options
 * @returns Array of all constructible arguments
 */
export function constructArguments(
  theory: ArgumentationTheory,
  options: ArgumentConstructionOptions = {}
): Argument[] {
  const {
    maxDepth = 5,        // Reduced from 10 - prevents combinatorial explosion
    maxArguments = 500,  // Reduced from 1000 - keeps response sizes manageable
    requireConsistency = false,
    maxArgsPerConclusion = 3, // NEW: Limit arguments per conclusion to prevent cartesian explosion
  } = options;

  const builtArguments: Argument[] = [];
  const argumentsByConclusion = new Map<string, Argument[]>();
  let argumentIdCounter = 0;

  // Helper: Register an argument
  const registerArgument = (arg: Argument) => {
    // NEW: Limit arguments per conclusion
    const existingForConclusion = argumentsByConclusion.get(arg.conclusion) || [];
    if (existingForConclusion.length >= maxArgsPerConclusion) {
      return false; // Skip this argument
    }
    
    builtArguments.push(arg);
    
    if (!argumentsByConclusion.has(arg.conclusion)) {
      argumentsByConclusion.set(arg.conclusion, []);
    }
    argumentsByConclusion.get(arg.conclusion)!.push(arg);
    return true;
  };

  // Step 1: Create base arguments from knowledge base
  const kb = theory.knowledgeBase;
  
  // Axioms
  for (const axiom of kb.axioms) {
    registerArgument(createBaseArgument(axiom, "axiom", argumentIdCounter++));
  }
  
  // Ordinary premises
  for (const premise of kb.premises) {
    registerArgument(createBaseArgument(premise, "premise", argumentIdCounter++));
  }
  
  // Assumptions
  for (const assumption of kb.assumptions) {
    registerArgument(createBaseArgument(assumption, "assumption", argumentIdCounter++));
  }

  // Step 2: Iteratively apply rules until fixpoint
  const allRules = [
    ...theory.system.strictRules,
    ...theory.system.defeasibleRules,
  ];

  let depth = 0;
  let newArgumentsCreated = true;

  while (newArgumentsCreated && depth < maxDepth && builtArguments.length < maxArguments) {
    newArgumentsCreated = false;
    depth++;

    for (const rule of allRules) {
      // Find all possible combinations of sub-arguments for rule antecedents
      const subArgumentCombinations = findSubArgumentsForRule(
        rule,
        argumentsByConclusion
      );

      for (const subArgs of subArgumentCombinations) {
        // Check if this argument would be consistent (if required)
        if (requireConsistency) {
          const allPremises = new Set<string>();
          for (const subArg of subArgs) {
            for (const p of subArg.premises) {
              allPremises.add(p);
            }
          }
          
          if (!isPremiseSetConsistent(allPremises, theory.system.contraries)) {
            continue; // Skip inconsistent arguments
          }
        }

        // Check if we've already built an equivalent argument
        const existingArgs = argumentsByConclusion.get(rule.consequent) || [];
        const isDuplicate = existingArgs.some(existing => 
          areArgumentsEquivalent(existing, subArgs, rule)
        );
        
        if (isDuplicate) continue;

        // Create new argument
        const newArg = createInferenceArgument(
          subArgs,
          rule,
          argumentIdCounter++
        );

        registerArgument(newArg);
        newArgumentsCreated = true;

        // Check limit
        if (builtArguments.length >= maxArguments) {
          console.warn(`[ASPIC] Hit max arguments limit: ${maxArguments}`);
          return builtArguments;
        }
      }
    }
  }

  if (depth >= maxDepth) {
    console.warn(`[ASPIC] Hit max depth limit: ${maxDepth}`);
  }

  return builtArguments;
}

/**
 * Create a base argument from a KB formula
 */
function createBaseArgument(
  formula: string,
  source: "axiom" | "premise" | "assumption",
  id: number
): Argument {
  return {
    id: `arg-${id}`,
    premises: new Set([formula]),
    conclusion: formula,
    subArguments: [],
    defeasibleRules: new Set(),
    topRule: undefined,
    structure: {
      type: "premise",
      formula,
      source,
    },
  };
}

/**
 * Create an inference argument from sub-arguments and a rule
 */
function createInferenceArgument(
  subArguments: Argument[],
  rule: Rule,
  id: number
): Argument {
  // Collect all premises from sub-arguments
  const allPremises = new Set<string>();
  for (const subArg of subArguments) {
    for (const p of subArg.premises) {
      allPremises.add(p);
    }
  }

  // Collect all defeasible rules from sub-arguments
  const allDefeasibleRules = new Set<string>();
  for (const subArg of subArguments) {
    for (const ruleId of subArg.defeasibleRules) {
      allDefeasibleRules.add(ruleId);
    }
  }

  // Add current rule if defeasible
  if (rule.type === "defeasible") {
    allDefeasibleRules.add(rule.id);
  }

  return {
    id: `arg-${id}`,
    premises: allPremises,
    conclusion: rule.consequent,
    subArguments: [...subArguments], // Copy array
    defeasibleRules: allDefeasibleRules,
    topRule: {
      ruleId: rule.id,
      type: rule.type,
    },
    structure: {
      type: "inference",
      rule,
      subArguments: subArguments.map(a => a.structure),
      conclusion: rule.consequent,
    },
  };
}

/**
 * Find all combinations of arguments that satisfy rule antecedents
 */
function findSubArgumentsForRule(
  rule: Rule,
  argumentsByConclusion: Map<string, Argument[]>
): Argument[][] {
  if (rule.antecedents.length === 0) {
    return [[]]; // No antecedents needed
  }

  // Get all arguments that conclude each antecedent
  const candidatesPerAntecedent: Argument[][] = rule.antecedents.map(
    antecedent => argumentsByConclusion.get(antecedent) || []
  );

  // Check if any antecedent has no arguments
  if (candidatesPerAntecedent.some(candidates => candidates.length === 0)) {
    return []; // Cannot apply rule
  }

  // Generate cartesian product of candidate arguments
  return cartesianProduct(candidatesPerAntecedent);
}

/**
 * Cartesian product of arrays
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map(item => [item]);

  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);

  const result: T[][] = [];
  for (const item of first) {
    for (const restItems of restProduct) {
      result.push([item, ...restItems]);
    }
  }

  return result;
}

/**
 * Check if two arguments are equivalent (same structure and conclusion)
 */
function areArgumentsEquivalent(
  existing: Argument,
  subArgs: Argument[],
  rule: Rule
): boolean {
  // Check conclusion
  if (existing.conclusion !== rule.consequent) return false;

  // Check top rule
  if (existing.topRule?.ruleId !== rule.id) return false;

  // Check sub-arguments (same IDs, order doesn't matter)
  if (existing.subArguments.length !== subArgs.length) return false;

  const existingSubIds = new Set(existing.subArguments.map(a => a.id));
  const newSubIds = new Set(subArgs.map(a => a.id));

  if (existingSubIds.size !== newSubIds.size) return false;

  for (const id of existingSubIds) {
    if (!newSubIds.has(id)) return false;
  }

  return true;
}

/**
 * Check if a set of premises is consistent
 * (No premise and its contrary both present)
 */
function isPremiseSetConsistent(
  premises: Set<string>,
  contraries: Map<string, Set<string>>
): boolean {
  for (const p of premises) {
    const contrariesOfP = contraries.get(p);
    if (!contrariesOfP) continue;

    for (const contrary of contrariesOfP) {
      if (premises.has(contrary)) {
        return false; // Found p and contrary(p) in same set
      }
    }
  }

  return true;
}

// ============================================================================
// ARGUMENT UTILITIES
// ============================================================================

/**
 * Get all sub-arguments of an argument (including itself)
 */
export function getAllSubArguments(arg: Argument): Argument[] {
  const result: Argument[] = [arg];
  const visited = new Set<string>([arg.id]);

  const traverse = (a: Argument) => {
    for (const subArg of a.subArguments) {
      if (!visited.has(subArg.id)) {
        visited.add(subArg.id);
        result.push(subArg);
        traverse(subArg);
      }
    }
  };

  traverse(arg);
  return result;
}

/**
 * Find argument by ID
 */
export function findArgumentById(
  args: Argument[],
  id: string
): Argument | undefined {
  return args.find(arg => arg.id === id);
}

/**
 * Find arguments concluding a specific formula
 */
export function findArgumentsByConclusion(
  args: Argument[],
  conclusion: string
): Argument[] {
  return args.filter(arg => arg.conclusion === conclusion);
}

/**
 * Check if argument uses a specific rule
 */
export function argumentUsesRule(arg: Argument, ruleId: string): boolean {
  if (arg.topRule?.ruleId === ruleId) return true;

  for (const subArg of arg.subArguments) {
    if (argumentUsesRule(subArg, ruleId)) return true;
  }

  return false;
}

/**
 * Check if argument uses a specific premise
 */
export function argumentUsesPremise(arg: Argument, premise: string): boolean {
  return arg.premises.has(premise);
}

/**
 * Get the depth of an argument (max path length from premise to conclusion)
 */
export function getArgumentDepth(arg: Argument): number {
  if (arg.subArguments.length === 0) return 0;

  const subDepths = arg.subArguments.map(getArgumentDepth);
  return 1 + Math.max(...subDepths);
}

/**
 * Print argument structure as a tree (for debugging)
 */
export function printArgumentTree(arg: Argument, indent = 0): string {
  const prefix = "  ".repeat(indent);
  let result = `${prefix}[${arg.id}] ${arg.conclusion}`;

  if (arg.topRule) {
    result += ` (via ${arg.topRule.type} rule ${arg.topRule.ruleId})`;
  } else {
    result += ` (premise)`;
  }

  result += "\n";

  for (const subArg of arg.subArguments) {
    result += printArgumentTree(subArg, indent + 1);
  }

  return result;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for argument construction
 */
export interface ArgumentConstructionOptions {
  /** Maximum depth of argument trees */
  maxDepth?: number;

  /** Maximum number of arguments to construct */
  maxArguments?: number;

  /** Require c-consistency (premises don't entail contradictions via strict rules) */
  requireConsistency?: boolean;

  /** Maximum arguments per conclusion (prevents cartesian explosion, default: 3) */
  maxArgsPerConclusion?: number;
}

/**
 * Argument construction result
 */
export interface ArgumentConstructionResult {
  /** All constructed arguments */
  arguments: Argument[];

  /** Arguments indexed by conclusion */
  byConclusion: Map<string, Argument[]>;

  /** Construction statistics */
  stats: {
    totalArguments: number;
    baseArguments: number;
    derivedArguments: number;
    maxDepth: number;
    constructionTimeMs: number;
  };
}

/**
 * Construct arguments with detailed result
 */
export function constructArgumentsWithStats(
  theory: ArgumentationTheory,
  options: ArgumentConstructionOptions = {}
): ArgumentConstructionResult {
  const startTime = Date.now();

  const allArgs = constructArguments(theory, options);

  const byConclusion = new Map<string, Argument[]>();
  for (const arg of allArgs) {
    if (!byConclusion.has(arg.conclusion)) {
      byConclusion.set(arg.conclusion, []);
    }
    byConclusion.get(arg.conclusion)!.push(arg);
  }

  const baseArguments = allArgs.filter(a => a.subArguments.length === 0);
  const derivedArguments = allArgs.filter(a => a.subArguments.length > 0);
  const maxDepth = allArgs.length > 0
    ? Math.max(...allArgs.map(getArgumentDepth))
    : 0;

  const constructionTimeMs = Date.now() - startTime;

  return {
    arguments: allArgs,
    byConclusion,
    stats: {
      totalArguments: allArgs.length,
      baseArguments: baseArguments.length,
      derivedArguments: derivedArguments.length,
      maxDepth,
      constructionTimeMs,
    },
  };
}
