/**
 * DDS Phase 5 - Part 2: Type Inference
 * 
 * Based on Faggian & Hyland (2002) - §6.4
 * 
 * Type inference analyzes design structure to determine its type.
 * Uses structural, behavioural, and chronicle-based methods.
 * 
 * Chronicle-based inference leverages verified Prop 4.27 correspondence:
 * Ch(Disp(D)) ≅ D means chronicles faithfully represent design structure,
 * so we can extract types directly from chronicle patterns.
 */

import type { Action, Chronicle, Strategy, Play } from "../types";
import type { DesignForCorrespondence, DesignAct } from "../correspondence/types";
import {
  computeCh,
  getTerminalActions,
  groupChroniclesByTerminal,
  computeChronicleDepth,
  countUniqueLoci,
} from "../correspondence/ch";
import type {
  TypeStructure,
  TypeInference,
  TypeInferenceMethod,
  TypeInferenceOptions,
  TypeInferenceContext,
  TypeConstraint,
  baseType,
  arrowType,
  productType,
  sumType,
  typeVariable,
  unitType,
  voidType,
  typeToString,
  createTypeInference,
} from "./types";

/**
 * Server-side logging for inference debugging
 */
const LOG_PREFIX = "[DDS Type Inference Core]";
function log(msg: string, data?: Record<string, any>) {
  if (data) {
    console.log(`${LOG_PREFIX} ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ${msg}`);
  }
}

/**
 * Default inference options
 */
const DEFAULT_INFERENCE_OPTIONS: Required<TypeInferenceOptions> = {
  maxIterations: 10,
  minConfidence: 0.5,
  useBehavioural: true,
  includeAlternatives: true,
};

/**
 * Infer type from design structure (structural inference)
 * 
 * Analyzes the shape of a design to determine its most likely type.
 */
export function inferTypeStructural(
  design: DesignForCorrespondence
): TypeStructure {
  const acts = design.acts || [];
  log(`inferTypeStructural: design ${design.id}, ${acts.length} acts`);

  // Empty design → Unit type
  if (acts.length === 0) {
    log(`inferTypeStructural: empty design → unit type`);
    return { kind: "unit" };
  }

  // Single daimon → Unit type
  if (acts.length === 1 && acts[0].kind === "DAIMON") {
    log(`inferTypeStructural: single daimon → unit type`);
    return { kind: "unit" };
  }

  // Analyze first action for primary structure
  const firstAct = acts[0];
  const ramification = firstAct.ramification || [];
  log(`inferTypeStructural: first act expression="${firstAct.expression}", ramification=${JSON.stringify(ramification)}`);

  // Check for specific patterns
  const isArrow = hasArrowPattern(acts);
  log(`inferTypeStructural: hasArrowPattern = ${isArrow}`);
  if (isArrow) {
    const arrowType = inferArrowType(acts);
    log(`inferTypeStructural: inferred arrow type: ${JSON.stringify(arrowType)}`);
    return arrowType;
  }

  const isProduct = hasProductPattern(acts, ramification);
  log(`inferTypeStructural: hasProductPattern = ${isProduct}`);
  if (isProduct) {
    return inferProductType(acts, ramification);
  }

  if (hasSumPattern(acts, ramification)) {
    return inferSumType(acts, ramification);
  }

  // Default to base type with design's expression as name
  return {
    kind: "base",
    name: firstAct.expression || design.id || "Unknown",
  };
}

/**
 * Check if actions follow arrow (function) pattern
 * 
 * Arrow pattern: alternating P/O polarities with input-output flow
 * Also checks for depth-based alternation (Faggian-Hyland semantics)
 */
function hasArrowPattern(acts: DesignAct[]): boolean {
  if (acts.length < 2) {
    log(`hasArrowPattern: false (less than 2 acts)`);
    return false;
  }

  // Check for explicit polarity alternation
  let hasExplicitAlternation = true;
  for (let i = 1; i < acts.length; i++) {
    if (acts[i].polarity === acts[i - 1].polarity) {
      hasExplicitAlternation = false;
      break;
    }
  }
  
  if (hasExplicitAlternation) {
    log(`hasArrowPattern: true (explicit polarity alternation)`);
    return true;
  }

  // Check for depth-based alternation (Faggian-Hyland semantics)
  // Odd depth (1, 3, 5...) = P, Even depth (2, 4, 6...) = O
  // If we have acts at multiple depths, it indicates an arrow pattern
  const depths = new Set<number>();
  for (const act of acts) {
    const path = act.locusPath || "";
    const depth = path.split(".").filter(Boolean).length;
    depths.add(depth);
  }
  
  log(`hasArrowPattern: depths found = [${Array.from(depths).sort((a,b) => a-b).join(", ")}]`);
  
  // Arrow pattern if we have multiple depths (indicating function structure)
  const result = depths.size >= 2;
  log(`hasArrowPattern: ${result} (multiple depths = ${depths.size >= 2})`);
  return result;
}

/**
 * Infer arrow type from actions
 * 
 * Groups acts by depth to determine input (odd depth) and output (even depth) types
 */
function inferArrowType(acts: DesignAct[]): TypeStructure {
  // Group acts by depth
  const byDepth = new Map<number, DesignAct[]>();
  for (const act of acts) {
    const path = act.locusPath || "";
    const depth = path.split(".").filter(Boolean).length;
    if (!byDepth.has(depth)) {
      byDepth.set(depth, []);
    }
    byDepth.get(depth)!.push(act);
  }

  // Find shallowest (input) and deepest (output) depths
  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  
  // Get representative acts for input and output
  const inputDepth = depths[0] || 1;
  const outputDepth = depths[depths.length - 1] || inputDepth;
  
  const inputActs = byDepth.get(inputDepth) || [];
  const outputActs = byDepth.get(outputDepth) || [];

  // Find representative expressions
  const inputExpr = inputActs.find(a => a.expression)?.expression;
  const outputExpr = outputActs.find(a => a.expression)?.expression;

  // If many input branches, could be curried function
  const inputCount = inputActs.length;
  
  if (inputCount > 1 && outputActs.length === 1) {
    // Multiple inputs → single output: product input
    return {
      kind: "arrow",
      left: {
        kind: "product",
        left: { kind: "variable", name: inputExpr || "A" },
        right: { kind: "variable", name: `Input[${inputCount}]` },
      },
      right: {
        kind: "variable",
        name: outputExpr || "B",
      },
    };
  }

  return {
    kind: "arrow",
    left: {
      kind: "variable",
      name: inputExpr || "Input",
    },
    right: {
      kind: "variable",
      name: outputExpr || "Output",
    },
  };
}

/**
 * Check if actions follow product (pair) pattern
 *
 * Product pattern: 
 * 1. First action has ramification ≥ 2 (explicit branches), OR
 * 2. Multiple sibling branches at the same depth level
 */
function hasProductPattern(
  acts: DesignAct[],
  ramification: (string | number)[]
): boolean {
  if (acts.length === 0) return false;

  // Check explicit ramification
  if (ramification.length >= 2) {
    return true;
  }
  
  // Check for multiple sibling branches at root level
  // e.g., 0.1, 0.2, 0.3 are siblings indicating a product structure
  const rootBranches = new Set<string>();
  for (const act of acts) {
    const path = act.locusPath || "";
    const parts = path.split(".");
    if (parts.length >= 2) {
      rootBranches.add(parts[1]); // The second component (0.X)
    }
  }
  
  return rootBranches.size >= 2;
}

/**
 * Infer product type from actions
 * 
 * Analyzes branch structure to create component types
 */
function inferProductType(
  acts: DesignAct[],
  ramification: (string | number)[]
): TypeStructure {
  // Group acts by their root branch (0.X)
  const branchGroups = new Map<string, DesignAct[]>();
  for (const act of acts) {
    const path = act.locusPath || "";
    const parts = path.split(".");
    const branchKey = parts.length >= 2 ? parts[1] : "0";
    if (!branchGroups.has(branchKey)) {
      branchGroups.set(branchKey, []);
    }
    branchGroups.get(branchKey)!.push(act);
  }
  
  // Create component types from branches
  const branchKeys = Array.from(branchGroups.keys()).sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
  
  const components: TypeStructure[] = branchKeys.map((key, i) => {
    const branchActs = branchGroups.get(key) || [];
    // Use expression from first act in branch if available
    const expr = branchActs.find(a => a.expression)?.expression;
    return {
      kind: "variable" as const,
      name: expr || `T${i}`,
    };
  });

  if (components.length === 0) {
    return { kind: "unit" };
  }
  
  if (components.length === 1) {
    return components[0];
  }

  if (components.length === 2) {
    return {
      kind: "product",
      left: components[0],
      right: components[1],
    };
  }

  // N-ary product as nested binary (right-associative)
  let result = components[components.length - 1];
  for (let i = components.length - 2; i >= 0; i--) {
    result = {
      kind: "product",
      left: components[i],
      right: result,
    };
  }

  return result;
}

/**
 * Check if actions follow sum (either) pattern
 * 
 * Sum pattern: first action has ramification = 1 (injection)
 */
function hasSumPattern(
  acts: DesignAct[],
  ramification: (string | number)[]
): boolean {
  if (acts.length === 0) return false;

  // Sum uses injection (single branch)
  return ramification.length === 1;
}

/**
 * Infer sum type from actions
 */
function inferSumType(
  acts: DesignAct[],
  ramification: (string | number)[]
): TypeStructure {
  // Determine which branch was taken
  const branch = ramification[0];
  const branchIndex = typeof branch === "string" ? parseInt(branch, 10) : branch;

  return {
    kind: "sum",
    left: {
      kind: "variable",
      name: "A",
    },
    right: {
      kind: "variable",
      name: "B",
    },
  };
}

/**
 * Infer type behaviorally (from dispute patterns)
 * 
 * Analyzes how a design interacts in disputes to determine its type.
 */
export async function inferTypeBehavioural(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): Promise<TypeStructure> {
  // Find designs this one interacts with
  const interactions = findInteractingDesigns(design, allDesigns);

  // If no interactions, fall back to structural
  if (interactions.length === 0) {
    return inferTypeStructural(design);
  }

  // Analyze interaction patterns
  const interactionPatterns = analyzeInteractionPatterns(design, interactions);

  // Determine type from patterns
  if (interactionPatterns.hasArrowInteraction) {
    return {
      kind: "arrow",
      left: { kind: "variable", name: "Input" },
      right: { kind: "variable", name: "Output" },
    };
  }

  if (interactionPatterns.hasProductInteraction) {
    return {
      kind: "product",
      left: { kind: "variable", name: "Fst" },
      right: { kind: "variable", name: "Snd" },
    };
  }

  if (interactionPatterns.hasSumInteraction) {
    return {
      kind: "sum",
      left: { kind: "variable", name: "Left" },
      right: { kind: "variable", name: "Right" },
    };
  }

  // Default to base type
  return {
    kind: "base",
    name: design.acts?.[0]?.expression || "Base",
  };
}

/**
 * Find designs that interact with the given design
 */
function findInteractingDesigns(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[]
): DesignForCorrespondence[] {
  const designLoci = new Set(
    (design.acts || []).map((a) => a.locusPath).filter(Boolean)
  );

  return allDesigns.filter((d) => {
    if (d.id === design.id) return false;

    // Check for shared loci
    const otherLoci = (d.acts || [])
      .map((a) => a.locusPath)
      .filter(Boolean);

    return otherLoci.some((l) => designLoci.has(l as string));
  });
}

/**
 * Analyze interaction patterns for a design
 */
function analyzeInteractionPatterns(
  design: DesignForCorrespondence,
  interactions: DesignForCorrespondence[]
): {
  hasArrowInteraction: boolean;
  hasProductInteraction: boolean;
  hasSumInteraction: boolean;
} {
  const designActs = design.acts || [];

  let hasArrowInteraction = false;
  let hasProductInteraction = false;
  let hasSumInteraction = false;

  for (const other of interactions) {
    const otherActs = other.acts || [];

    // Check for arrow interaction (alternating responses)
    const hasAlternation = checkAlternation(designActs, otherActs);
    if (hasAlternation) {
      hasArrowInteraction = true;
    }

    // Check for product interaction (parallel branches)
    const hasParallel = checkParallelBranches(designActs, otherActs);
    if (hasParallel) {
      hasProductInteraction = true;
    }

    // Check for sum interaction (exclusive branches)
    const hasExclusive = checkExclusiveBranches(designActs, otherActs);
    if (hasExclusive) {
      hasSumInteraction = true;
    }
  }

  return {
    hasArrowInteraction,
    hasProductInteraction,
    hasSumInteraction,
  };
}

/**
 * Check for alternating interaction pattern
 */
function checkAlternation(
  acts1: DesignAct[],
  acts2: DesignAct[]
): boolean {
  const loci1 = new Set(acts1.map((a) => a.locusPath));
  const loci2 = new Set(acts2.map((a) => a.locusPath));

  // Find shared loci
  const shared = [...loci1].filter((l) => loci2.has(l));

  if (shared.length < 2) return false;

  // Check if actions at shared loci alternate in polarity
  for (const locus of shared) {
    const act1 = acts1.find((a) => a.locusPath === locus);
    const act2 = acts2.find((a) => a.locusPath === locus);

    if (act1 && act2 && act1.polarity === act2.polarity) {
      return false;
    }
  }

  return true;
}

/**
 * Check for parallel branch pattern
 */
function checkParallelBranches(
  acts1: DesignAct[],
  acts2: DesignAct[]
): boolean {
  // Check if first actions have multiple ramifications
  const firstAct1 = acts1[0];
  const firstAct2 = acts2[0];

  if (!firstAct1 || !firstAct2) return false;

  const ram1 = firstAct1.ramification || [];
  const ram2 = firstAct2.ramification || [];

  return ram1.length >= 2 && ram2.length >= 2;
}

/**
 * Check for exclusive branch pattern
 */
function checkExclusiveBranches(
  acts1: DesignAct[],
  acts2: DesignAct[]
): boolean {
  // Check if designs take different branches at same locus
  const firstAct1 = acts1[0];
  const firstAct2 = acts2[0];

  if (!firstAct1 || !firstAct2) return false;

  // Same locus but different ramification = sum pattern
  if (firstAct1.locusPath === firstAct2.locusPath) {
    const ram1 = firstAct1.ramification || [];
    const ram2 = firstAct2.ramification || [];

    // Different single branches = injection
    if (ram1.length === 1 && ram2.length === 1 && ram1[0] !== ram2[0]) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Chronicle-Based Type Inference
// ============================================================================

/**
 * Chronicle analysis result for type inference
 */
export type ChronicleAnalysis = {
  /** Number of chronicles in the design */
  chronicleCount: number;
  /** Maximum depth across all chronicles */
  maxDepth: number;
  /** Number of unique loci */
  uniqueLoci: number;
  /** Terminal action patterns */
  terminals: {
    positive: number;  // Terminals ending on player's move
    negative: number;  // Terminals ending on opponent's move (daimon)
  };
  /** Branch structure analysis */
  branching: {
    firstActionRamification: number;  // Number of branches at root
    maxRamification: number;          // Maximum branching factor
    isLinear: boolean;                // Single path (no branching)
  };
  /** Polarity patterns */
  polarity: {
    startsPositive: boolean;
    alternatesConsistently: boolean;
  };
};

/**
 * Analyze chronicles to extract structural information for type inference
 * 
 * This leverages the verified Prop 4.27 correspondence: Ch(Disp(D)) ≅ D
 * Chronicles faithfully represent design structure.
 */
export function analyzeChronicles(chronicles: Chronicle[]): ChronicleAnalysis {
  if (chronicles.length === 0) {
    return {
      chronicleCount: 0,
      maxDepth: 0,
      uniqueLoci: 0,
      terminals: { positive: 0, negative: 0 },
      branching: { firstActionRamification: 0, maxRamification: 0, isLinear: true },
      polarity: { startsPositive: true, alternatesConsistently: true },
    };
  }

  // Compute basic metrics
  const chronicleCount = chronicles.length;
  const maxDepth = Math.max(...chronicles.map(c => computeChronicleDepth(c)));
  const uniqueLoci = countUniqueLoci(chronicles);

  // Analyze terminals
  let positiveTerminals = 0;
  let negativeTerminals = 0;
  for (const chronicle of chronicles) {
    if (chronicle.isPositive) {
      positiveTerminals++;
    } else {
      negativeTerminals++;
    }
  }

  // Analyze branching structure
  let firstActionRamification = 0;
  let maxRamification = 0;
  
  for (const chronicle of chronicles) {
    for (const action of chronicle.actions) {
      const ramSize = action.ramification?.length || 0;
      if (ramSize > maxRamification) {
        maxRamification = ramSize;
      }
    }
    
    // First action ramification (root branching)
    if (chronicle.actions.length > 0) {
      const firstRam = chronicle.actions[0].ramification?.length || 0;
      if (firstRam > firstActionRamification) {
        firstActionRamification = firstRam;
      }
    }
  }

  const isLinear = chronicleCount === 1 && maxRamification <= 1;

  // Analyze polarity patterns
  let startsPositive = true;
  let alternatesConsistently = true;
  let hasMultipleDepths = false;

  // Track depths for depth-based arrow detection
  const depths = new Set<number>();

  for (const chronicle of chronicles) {
    if (chronicle.actions.length > 0) {
      const firstPolarity = chronicle.actions[0].polarity;
      if (firstPolarity !== "P") {
        startsPositive = false;
      }

      // Check explicit polarity alternation
      let hasExplicitAlternation = true;
      for (let i = 1; i < chronicle.actions.length; i++) {
        if (chronicle.actions[i].polarity === chronicle.actions[i - 1].polarity) {
          hasExplicitAlternation = false;
          break;
        }
      }

      // Also check depth-based alternation (Faggian-Hyland semantics)
      // Odd depth = P, Even depth = O
      for (const action of chronicle.actions) {
        const depth = action.focus?.split(".").filter(Boolean).length || 0;
        depths.add(depth);
      }

      // If explicit alternation fails, check depth-based
      if (!hasExplicitAlternation && depths.size < 2) {
        alternatesConsistently = false;
      }
    }
  }

  // Multiple depths indicates arrow pattern even without explicit polarity alternation
  hasMultipleDepths = depths.size >= 2;
  if (hasMultipleDepths) {
    alternatesConsistently = true; // Depth-based alternation counts
  }

  return {
    chronicleCount,
    maxDepth,
    uniqueLoci,
    terminals: { positive: positiveTerminals, negative: negativeTerminals },
    branching: { firstActionRamification, maxRamification, isLinear },
    polarity: { startsPositive, alternatesConsistently },
  };
}

/**
 * Infer type from chronicles (chronicle-based inference)
 * 
 * Chronicle-based inference leverages the verified Prop 4.27 correspondence
 * to extract types directly from chronicle patterns:
 * 
 * 1. Arrow Type (→): Chronicles show alternating P/O with linear flow
 *    - Input on O moves, output on P moves
 *    - Depth indicates function complexity
 * 
 * 2. Product Type (×): Root ramification ≥ 2 with parallel branches
 *    - Each branch represents a component
 *    - Branches can be accessed independently
 * 
 * 3. Sum Type (+): Root ramification = 1 with exclusive choice
 *    - Single branch taken represents injection
 *    - Different chronicles may take different branches
 * 
 * 4. Unit Type (1): Single chronicle with single positive terminal
 *    - Trivial interaction pattern
 * 
 * 5. Void Type (0): No positive terminals (all daimons)
 *    - No successful completion possible
 */
export function inferTypeFromChronicles(
  chronicles: Chronicle[]
): TypeStructure {
  const analysis = analyzeChronicles(chronicles);

  // Empty chronicles → Void type
  if (analysis.chronicleCount === 0) {
    return { kind: "void" };
  }

  // All negative terminals (daimons) → Void type
  if (analysis.terminals.positive === 0 && analysis.terminals.negative > 0) {
    return { kind: "void" };
  }

  // Single chronicle, linear, single positive terminal → Unit type
  if (
    analysis.branching.isLinear &&
    analysis.terminals.positive === 1 &&
    analysis.terminals.negative === 0 &&
    analysis.maxDepth <= 1
  ) {
    return { kind: "unit" };
  }

  // Product pattern: root ramification ≥ 2
  if (analysis.branching.firstActionRamification >= 2) {
    return inferProductFromChronicles(chronicles, analysis);
  }

  // Sum pattern: multiple chronicles with different single branches
  if (analysis.chronicleCount > 1 && hasSumPatternInChronicles(chronicles)) {
    return inferSumFromChronicles(chronicles, analysis);
  }

  // Arrow pattern: alternating polarity with depth > 1
  if (analysis.polarity.alternatesConsistently && analysis.maxDepth > 1) {
    return inferArrowFromChronicles(chronicles, analysis);
  }

  // Default: infer from first chronicle's structure
  if (chronicles.length > 0 && chronicles[0].actions.length > 0) {
    const firstAction = chronicles[0].actions[0];
    return {
      kind: "base",
      name: firstAction.expression || "T",
    };
  }

  return { kind: "variable", name: "X" };
}

/**
 * Infer product type from chronicle branching structure
 */
function inferProductFromChronicles(
  chronicles: Chronicle[],
  analysis: ChronicleAnalysis
): TypeStructure {
  // Group chronicles by their root branch
  const groups = groupChroniclesByTerminal(chronicles);
  const groupCount = groups.size;

  // Create component types based on branch groups
  const componentTypes: TypeStructure[] = [];
  let branchIndex = 0;
  
  for (const [_terminal, groupChronicles] of groups) {
    // Recursively infer type for this branch
    if (groupChronicles.length === 1 && groupChronicles[0].actions.length <= 1) {
      // Simple terminal
      componentTypes.push({
        kind: "variable",
        name: `T${branchIndex}`,
      });
    } else {
      // Deeper structure - analyze recursively
      const subAnalysis = analyzeChronicles(groupChronicles);
      if (subAnalysis.polarity.alternatesConsistently && subAnalysis.maxDepth > 1) {
        componentTypes.push({
          kind: "arrow",
          left: { kind: "variable", name: `A${branchIndex}` },
          right: { kind: "variable", name: `B${branchIndex}` },
        });
      } else {
        componentTypes.push({
          kind: "variable",
          name: `T${branchIndex}`,
        });
      }
    }
    branchIndex++;
  }

  // Build product type
  if (componentTypes.length === 0) {
    return { kind: "unit" };
  }

  if (componentTypes.length === 1) {
    return componentTypes[0];
  }

  if (componentTypes.length === 2) {
    return {
      kind: "product",
      left: componentTypes[0],
      right: componentTypes[1],
    };
  }

  // N-ary product as nested binary (right-associative)
  let result = componentTypes[componentTypes.length - 1];
  for (let i = componentTypes.length - 2; i >= 0; i--) {
    result = {
      kind: "product",
      left: componentTypes[i],
      right: result,
    };
  }

  return result;
}

/**
 * Check if chronicles exhibit sum pattern (exclusive branches)
 */
function hasSumPatternInChronicles(chronicles: Chronicle[]): boolean {
  if (chronicles.length < 2) return false;

  // Check if different chronicles take different branches at root
  const rootBranches = new Set<string>();
  
  for (const chronicle of chronicles) {
    if (chronicle.actions.length > 0) {
      const firstAction = chronicle.actions[0];
      const branchKey = JSON.stringify(firstAction.ramification || []);
      
      // Sum pattern: single ramification (injection)
      if ((firstAction.ramification?.length || 0) === 1) {
        rootBranches.add(branchKey);
      }
    }
  }

  // Multiple different single branches = sum pattern
  return rootBranches.size > 1;
}

/**
 * Infer sum type from exclusive chronicle branches
 */
function inferSumFromChronicles(
  chronicles: Chronicle[],
  analysis: ChronicleAnalysis
): TypeStructure {
  // Determine which branches are taken
  const branches = new Map<number, Chronicle[]>();
  
  for (const chronicle of chronicles) {
    if (chronicle.actions.length > 0) {
      const firstAction = chronicle.actions[0];
      const ram = firstAction.ramification || [];
      
      if (ram.length === 1) {
        const branchNum = typeof ram[0] === "number" ? ram[0] : parseInt(String(ram[0]), 10);
        if (!branches.has(branchNum)) {
          branches.set(branchNum, []);
        }
        branches.get(branchNum)!.push(chronicle);
      }
    }
  }

  // Create sum type with branch types
  const branchTypes: TypeStructure[] = [];
  const sortedBranches = Array.from(branches.keys()).sort((a, b) => a - b);
  
  for (let i = 0; i < sortedBranches.length; i++) {
    const branchChronicles = branches.get(sortedBranches[i]) || [];
    
    if (branchChronicles.length === 1 && branchChronicles[0].actions.length <= 2) {
      // Simple branch
      branchTypes.push({
        kind: "variable",
        name: sortedBranches[i] === 0 ? "Left" : "Right",
      });
    } else {
      // Complex branch - could be further analyzed
      branchTypes.push({
        kind: "variable",
        name: `Branch${sortedBranches[i]}`,
      });
    }
  }

  if (branchTypes.length === 0) {
    return { kind: "void" };
  }

  if (branchTypes.length === 1) {
    return branchTypes[0];
  }

  if (branchTypes.length === 2) {
    return {
      kind: "sum",
      left: branchTypes[0],
      right: branchTypes[1],
    };
  }

  // N-ary sum as nested binary
  let result = branchTypes[branchTypes.length - 1];
  for (let i = branchTypes.length - 2; i >= 0; i--) {
    result = {
      kind: "sum",
      left: branchTypes[i],
      right: result,
    };
  }

  return result;
}

/**
 * Infer arrow type from alternating chronicle structure
 */
function inferArrowFromChronicles(
  chronicles: Chronicle[],
  analysis: ChronicleAnalysis
): TypeStructure {
  // Arrow type: analyze input (O moves) and output (P moves)
  let inputExpression: string | undefined;
  let outputExpression: string | undefined;

  for (const chronicle of chronicles) {
    for (const action of chronicle.actions) {
      // Determine polarity by depth (Faggian-Hyland)
      const depth = action.focus.split(".").length;
      const depthPolarity: "P" | "O" = depth % 2 === 1 ? "P" : "O";

      if (depthPolarity === "O" && !inputExpression && action.expression) {
        inputExpression = action.expression;
      }
      if (depthPolarity === "P" && !outputExpression && action.expression) {
        outputExpression = action.expression;
      }
    }
  }

  // Determine arrow complexity from depth
  const arrowDepth = Math.floor(analysis.maxDepth / 2);
  
  if (arrowDepth <= 1) {
    // Simple arrow A → B
    return {
      kind: "arrow",
      left: {
        kind: "variable",
        name: inputExpression || "A",
      },
      right: {
        kind: "variable",
        name: outputExpression || "B",
      },
    };
  }

  // Higher-order arrow (A → B) → C or A → (B → C)
  // Detected by depth > 2 with consistent alternation
  return {
    kind: "arrow",
    left: {
      kind: "arrow",
      left: { kind: "variable", name: "A" },
      right: { kind: "variable", name: "B" },
    },
    right: {
      kind: "variable",
      name: outputExpression || "C",
    },
  };
}

/**
 * Compute confidence for chronicle-based inference
 */
export function computeChronicleConfidence(
  chronicles: Chronicle[],
  inferredType: TypeStructure
): number {
  const analysis = analyzeChronicles(chronicles);

  // Base confidence
  let confidence = 0.7;

  // Higher confidence with more chronicles
  if (analysis.chronicleCount > 1) {
    confidence += 0.05 * Math.min(analysis.chronicleCount - 1, 4);
  }

  // Higher confidence for consistent polarity alternation
  if (analysis.polarity.alternatesConsistently) {
    confidence += 0.1;
  }

  // Higher confidence for clear type patterns
  if (inferredType.kind === "arrow" && analysis.maxDepth >= 2) {
    confidence += 0.1;
  }

  if (inferredType.kind === "product" && analysis.branching.firstActionRamification >= 2) {
    confidence += 0.1;
  }

  if (inferredType.kind === "sum" && hasSumPatternInChronicles(chronicles)) {
    confidence += 0.1;
  }

  // Higher confidence for designs with positive terminals (not all daimons)
  if (analysis.terminals.positive > 0) {
    confidence += 0.05;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Create a strategy from design for chronicle extraction
 */
function designToStrategy(design: DesignForCorrespondence): Strategy {
  const acts = design.acts || [];
  
  // Convert design acts to actions
  const actions: Action[] = acts
    .filter(act => act.kind !== "DAIMON") // Exclude daimons for play construction
    .map(act => ({
      focus: act.locusPath || "",
      ramification: (act.ramification || []).map(r => 
        typeof r === "string" ? parseInt(r, 10) : r
      ),
      polarity: act.polarity as "P" | "O",
      expression: act.expression || undefined,
    }));

  // Create a single play from all actions
  const play: Play = {
    id: `play-${design.id}`,
    strategyId: design.id,
    sequence: actions,
    length: actions.length,
    isPositive: actions.length > 0 && actions[actions.length - 1].polarity === "P",
  };

  return {
    id: design.id,
    designId: design.id,
    player: "P",
    plays: actions.length > 0 ? [play] : [],
    isInnocent: true,
    satisfiesPropagation: true,
  };
}

/**
 * Infer type from a design using chronicles
 * 
 * This is the main entry point for chronicle-based type inference.
 * It computes Ch(S) from the design and analyzes the chronicle structure.
 */
export function inferTypeFromDesignChronicles(
  design: DesignForCorrespondence
): { type: TypeStructure; analysis: ChronicleAnalysis; confidence: number } {
  // Convert design to strategy for Ch computation
  const strategy = designToStrategy(design);
  
  // Compute chronicles using verified Ch(S) operation
  const chResult = computeCh(strategy);
  const chronicles = chResult.chronicles;
  
  // Analyze and infer type
  const analysis = analyzeChronicles(chronicles);
  const type = inferTypeFromChronicles(chronicles);
  const confidence = computeChronicleConfidence(chronicles, type);

  return { type, analysis, confidence };
}

/**
 * Comprehensive type inference combining multiple methods
 */
export async function inferDesignType(
  design: DesignForCorrespondence,
  allDesigns: DesignForCorrespondence[],
  options?: TypeInferenceOptions
): Promise<TypeInference> {
  const opts = { ...DEFAULT_INFERENCE_OPTIONS, ...options };
  log(`inferDesignType: Starting for design ${design.id}, ${design.acts?.length || 0} acts, ${allDesigns.length} total designs in context`);

  // Structural inference
  log(`inferDesignType: Running structural inference...`);
  const structuralType = inferTypeStructural(design);
  let structuralConfidence = computeStructuralConfidence(design, structuralType);
  log(`inferDesignType: Structural result`, {
    type: structuralType,
    confidence: structuralConfidence
  });

  // Behavioural inference (if enabled and designs available)
  let behaviouralType: TypeStructure | null = null;
  let behaviouralConfidence = 0;

  if (opts.useBehavioural && allDesigns.length > 1) {
    try {
      log(`inferDesignType: Running behavioural inference...`);
      behaviouralType = await inferTypeBehavioural(design, allDesigns);
      behaviouralConfidence = computeBehaviouralConfidence(
        design,
        behaviouralType,
        allDesigns
      );
      log(`inferDesignType: Behavioural result`, {
        type: behaviouralType,
        confidence: behaviouralConfidence
      });
    } catch (error) {
      log(`inferDesignType: Behavioural inference failed: ${error}`);
      console.warn("Behavioural inference failed:", error);
    }
  } else {
    log(`inferDesignType: Skipping behavioural (useBehavioural=${opts.useBehavioural}, designCount=${allDesigns.length})`);
  }

  // Chronicle-based inference (new method leveraging Prop 4.27)
  let chronicleType: TypeStructure | null = null;
  let chronicleConfidence = 0;
  let chronicleAnalysis: ChronicleAnalysis | null = null;

  try {
    log(`inferDesignType: Running chronicle-based inference...`);
    const chronicleResult = inferTypeFromDesignChronicles(design);
    chronicleType = chronicleResult.type;
    chronicleConfidence = chronicleResult.confidence;
    chronicleAnalysis = chronicleResult.analysis;
    log(`inferDesignType: Chronicle result`, {
      type: chronicleType,
      confidence: chronicleConfidence,
      chronicleCount: chronicleAnalysis?.chronicleCount,
      maxDepth: chronicleAnalysis?.maxDepth
    });
  } catch (error) {
    log(`inferDesignType: Chronicle inference failed: ${error}`);
    console.warn("Chronicle-based inference failed:", error);
  }

  // Combine results - choose best method
  let inferredType: TypeStructure;
  let confidence: number;
  let method: TypeInferenceMethod;

  // Compare all three methods and pick the highest confidence
  const candidates: Array<{
    type: TypeStructure;
    confidence: number;
    method: TypeInferenceMethod;
  }> = [
    { type: structuralType, confidence: structuralConfidence, method: "structural" },
  ];

  if (behaviouralType) {
    candidates.push({
      type: behaviouralType,
      confidence: behaviouralConfidence,
      method: "behavioural",
    });
  }

  if (chronicleType) {
    candidates.push({
      type: chronicleType,
      confidence: chronicleConfidence,
      method: "chronicle" as TypeInferenceMethod,
    });
  }

  log(`inferDesignType: Candidate comparison`, {
    candidates: candidates.map(c => ({
      method: c.method,
      confidence: c.confidence,
      typeKind: c.type.kind
    }))
  });

  // Type specificity ranking: more specific types are preferred when confidence is equal
  // arrow > product > sum > base > variable > unit > void
  const typeSpecificity: Record<string, number> = {
    arrow: 7,
    product: 6,
    sum: 5,
    base: 4,
    variable: 3,
    unit: 2,
    void: 1,
  };

  // Sort by confidence first, then by type specificity as tie-breaker
  candidates.sort((a, b) => {
    const confidenceDiff = b.confidence - a.confidence;
    if (Math.abs(confidenceDiff) > 0.01) {
      return confidenceDiff; // Significant confidence difference
    }
    // Tie-breaker: prefer more specific types
    const specA = typeSpecificity[a.type.kind] || 0;
    const specB = typeSpecificity[b.type.kind] || 0;
    return specB - specA;
  });
  const best = candidates[0];

  log(`inferDesignType: Tie-breaker applied, specificity ranking used`);

  log(`inferDesignType: Selected best method: ${best.method} (confidence: ${best.confidence})`);

  inferredType = best.type;
  confidence = best.confidence;
  method = best.method;

  // Build alternatives if requested
  const alternatives: TypeStructure[] = [];
  if (opts.includeAlternatives) {
    for (const candidate of candidates.slice(1)) {
      if (candidate.confidence >= opts.minConfidence) {
        alternatives.push(candidate.type);
      }
    }
  }

  return {
    designId: design.id,
    inferredType,
    confidence: Math.min(confidence, 1.0),
    method,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
  };
}

/**
 * Compute confidence for structural inference
 */
function computeStructuralConfidence(
  design: DesignForCorrespondence,
  type: TypeStructure
): number {
  const acts = design.acts || [];

  // Base confidence
  let confidence = 0.6;

  // Higher confidence for well-formed designs
  if (acts.length > 0) {
    confidence += 0.1;
  }

  // Higher confidence for consistent polarity patterns
  if (acts.length >= 2) {
    const hasAlternation = acts.slice(1).every(
      (act, i) => act.polarity !== acts[i].polarity
    );
    if (hasAlternation) {
      confidence += 0.1;
    }
  }

  // Higher confidence for specific type patterns
  if (type.kind === "arrow" && hasArrowPattern(acts)) {
    confidence += 0.15;
  }

  if (type.kind === "product" && (acts[0]?.ramification?.length || 0) >= 2) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Compute confidence for behavioural inference
 */
function computeBehaviouralConfidence(
  design: DesignForCorrespondence,
  type: TypeStructure,
  allDesigns: DesignForCorrespondence[]
): number {
  // Base confidence
  let confidence = 0.7;

  // Higher confidence if design interacts with many others
  const interactions = findInteractingDesigns(design, allDesigns);
  if (interactions.length > 3) {
    confidence += 0.1;
  }

  // Higher confidence for consistent interaction patterns
  if (interactions.length > 0) {
    const patterns = analyzeInteractionPatterns(design, interactions);
    const patternCount = [
      patterns.hasArrowInteraction,
      patterns.hasProductInteraction,
      patterns.hasSumInteraction,
    ].filter(Boolean).length;

    if (patternCount === 1) {
      // Single clear pattern
      confidence += 0.15;
    }
  }

  return Math.min(confidence, 1.0);
}

/**
 * Infer types for multiple designs (batch)
 */
export async function inferTypesForDesigns(
  designs: DesignForCorrespondence[],
  options?: TypeInferenceOptions
): Promise<Map<string, TypeInference>> {
  const results = new Map<string, TypeInference>();

  // Process in parallel
  const inferences = await Promise.all(
    designs.map((design) => inferDesignType(design, designs, options))
  );

  inferences.forEach((inference, idx) => {
    results.set(designs[idx].id, inference);
  });

  return results;
}

/**
 * Suggest type refinements for low-confidence inferences
 */
export function suggestTypeRefinements(
  inference: TypeInference
): TypeStructure[] {
  const suggestions: TypeStructure[] = [];

  // If base type with low confidence, suggest arrow
  if (inference.inferredType.kind === "base" && inference.confidence < 0.7) {
    suggestions.push({
      kind: "arrow",
      left: inference.inferredType,
      right: { kind: "variable", name: "B" },
    });
  }

  // Suggest variable if unknown
  if (inference.inferredType.kind === "base" && !inference.inferredType.name) {
    suggestions.push({
      kind: "variable",
      name: "T",
    });
  }

  // Suggest product if arrow with low confidence
  if (inference.inferredType.kind === "arrow" && inference.confidence < 0.6) {
    suggestions.push({
      kind: "product",
      left: inference.inferredType.left!,
      right: inference.inferredType.right!,
    });
  }

  return suggestions;
}

/**
 * Unify two type structures
 * 
 * Returns a substitution that makes the types equal, or null if impossible.
 */
export function unifyTypes(
  type1: TypeStructure,
  type2: TypeStructure
): Map<string, TypeStructure> | null {
  const substitution = new Map<string, TypeStructure>();

  function unify(t1: TypeStructure, t2: TypeStructure): boolean {
    // Variable case
    if (t1.kind === "variable") {
      if (substitution.has(t1.name!)) {
        return unify(substitution.get(t1.name!)!, t2);
      }
      substitution.set(t1.name!, t2);
      return true;
    }

    if (t2.kind === "variable") {
      if (substitution.has(t2.name!)) {
        return unify(t1, substitution.get(t2.name!)!);
      }
      substitution.set(t2.name!, t1);
      return true;
    }

    // Same kind check
    if (t1.kind !== t2.kind) {
      return false;
    }

    // Handle specific kinds
    switch (t1.kind) {
      case "base":
        return t1.name === t2.name;

      case "unit":
      case "void":
        return true;

      case "arrow":
      case "product":
      case "sum":
        return (
          unify(t1.left!, t2.left!) && unify(t1.right!, t2.right!)
        );

      default:
        return false;
    }
  }

  return unify(type1, type2) ? substitution : null;
}
