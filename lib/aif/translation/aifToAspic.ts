// // src/lib/aif/translation/aifToAspic.ts
// import type { AIFGraph } from '../types';

// export interface Rule {
//   id: string;
//   antecedents: string[];
//   consequent: string;
//   type: 'strict' | 'defeasible';
// }

// export interface ArgumentationTheory {
//   language: Set<string>;
//   contraries: Map<string, Set<string>>;
//   strictRules: Rule[];
//   defeasibleRules: Rule[];
//   axioms: Set<string>;
//   premises: Set<string>;
//   assumptions: Set<string>;
// }

// export function aifToASPIC(graph: AIFGraph): ArgumentationTheory {
//   const language = new Set<string>();
//   const contraries = new Map<string, Set<string>>();
//   const strictRules: Rule[] = [];
//   const defeasibleRules: Rule[] = [];
//   const axioms = new Set<string>();
//   const premises = new Set<string>();
//   const assumptions = new Set<string>();

//   // Language: all I-node contents + RA ids
//   for (const n of graph.nodes) {
//     if (n.nodeType === 'I') language.add(n.content);
//     if (n.nodeType === 'RA') language.add(n.id);
//   }

//   // KB: initial I-nodes (no predecessors)
//   const incomingByTarget = new Map<string, number>();
//   for (const e of graph.edges) {
//     incomingByTarget.set(e.targetId, (incomingByTarget.get(e.targetId) ?? 0) + 1);
//   }
//   for (const n of graph.nodes) {
//     if (n.nodeType !== 'I') continue;
//     const incoming = incomingByTarget.get(n.id) ?? 0;
//     if (incoming === 0) {
//       // Default: ordinary premise (can be overridden via metadata if needed)
//       premises.add(n.content);
//     }
//   }

//   // Rules from RA: premises -> conclusion
//   for (const ra of graph.nodes.filter(n => n.nodeType === 'RA')) {
//     const premiseEdges = graph.edges.filter(e => e.targetId === ra.id && e.edgeType === 'premise');
//     const antecedents = premiseEdges.map(e => {
//       const src = graph.nodes.find(n => n.id === e.sourceId);
//       return src?.content ?? '';
//     }).filter(Boolean);

//     const concl = graph.edges.find(e => e.sourceId === ra.id && e.edgeType === 'conclusion');
//     if (!concl) continue;
//     const conclNode = graph.nodes.find(n => n.id === concl.targetId);
//     if (!conclNode) continue;

//     const type = (ra as any).schemeType === 'deductive' ? 'strict' : 'defeasible';
//     const rule = { id: ra.id, antecedents, consequent: (conclNode as any).content, type } as Rule;
//     if (type === 'strict') strictRules.push(rule); else defeasibleRules.push(rule);
//   }

//   // Contraries from CA
//   for (const ca of graph.nodes.filter(n => n.nodeType === 'CA')) {
//     const attackerE = graph.edges.find(e => e.targetId === ca.id && e.edgeType === 'conflicting');
//     const attackedE = graph.edges.find(e => e.sourceId === ca.id && e.edgeType === 'conflicted');
//     if (!attackerE || !attackedE) continue;
//     const attackerNode = graph.nodes.find(n => n.id === attackerE.sourceId);
//     const attackedNode = graph.nodes.find(n => n.id === attackedE.targetId);
//     if (!attackerNode || !attackedNode) continue;

//     const attackerSymbol = attackerNode.nodeType === 'I' ? attackerNode.content : attackerNode.id;
//     const attackedSymbol = attackedNode.nodeType === 'I' ? attackedNode.content : attackedNode.id;

//     if (!contraries.has(attackerSymbol)) contraries.set(attackerSymbol, new Set());
//     contraries.get(attackerSymbol)!.add(attackedSymbol);
//   }

//   return { language, contraries, strictRules, defeasibleRules, axioms, premises, assumptions };
// }
// lib/aif/translation/aifToAspic.ts
import type { AIFGraph, INode, RANode, CANode, PANode } from '../types';
import type { Argument, Attack, Defeat, ArgumentationSystem } from '../../aspic/types';
import { constructArguments } from '../../aspic/arguments';
import { computeAttacks } from '../../aspic/attacks';
import { computeDefeats } from '../../aspic/defeats';
import { computeGroundedExtension, computeArgumentLabeling } from '../../aspic/semantics';

// Debug logging - set to true to see verbose translation logs
const DEBUG_ASPIC = process.env.DEBUG_ASPIC === "true";

export interface Rule {
  id: string;
  antecedents: string[];
  consequent: string;
  type: 'strict' | 'defeasible';
}

export interface ArgumentationTheory {
  language: Set<string>;
  contraries: Map<string, Set<string>>;
  strictRules: Rule[];
  defeasibleRules: Rule[];
  axioms: Set<string>;
  premises: Set<string>;
  assumptions: Set<string>;
  preferences: Array<{ preferred: string; dispreferred: string }>;
}

export interface AspicSemantics {
  arguments: Argument[];
  attacks: Attack[];
  defeats: Defeat[];
  groundedExtension: Set<string>;
  justificationStatus: Map<string, 'in' | 'out' | 'undec'>;
}

export function aifToASPIC(
  graph: AIFGraph,
  explicitContraries?: Array<{ claimId: string; contraryId: string; isSymmetric: boolean; claim: { text: string }; contrary: { text: string } }>
): ArgumentationTheory {
  const language = new Set<string>();
  const contraries = new Map<string, Set<string>>();
  const strictRules: Rule[] = [];
  const defeasibleRules: Rule[] = [];
  const axioms = new Set<string>();
  const premises = new Set<string>();
  const assumptions = new Set<string>();
  const preferences: Array<{ preferred: string; dispreferred: string }> = [];

  const incomingByTarget = new Map<string, number>();
  for (const e of graph.edges) incomingByTarget.set(e.targetId, (incomingByTarget.get(e.targetId) ?? 0) + 1);

  // Language base
  for (const n of graph.nodes) {
    if (n.nodeType === 'I') language.add((n as any).content ?? (n as any).text ?? n.id);
    if (n.nodeType === 'RA') language.add(n.id);
  }

  // Phase D-1: Add explicit contraries FIRST (before CA-nodes)
  // This allows users to pre-define semantic relationships independent of attacks
  if (explicitContraries && explicitContraries.length > 0) {
    if (DEBUG_ASPIC) console.log(`[aifToAspic] Processing ${explicitContraries.length} explicit contraries`);
    for (const contrary of explicitContraries) {
      const claimText = contrary.claim.text;
      const contraryText = contrary.contrary.text;
      
      // Add to language
      language.add(claimText);
      language.add(contraryText);
      
      // Add to contraries map: claimText -> contraryText
      if (!contraries.has(claimText)) {
        contraries.set(claimText, new Set());
      }
      contraries.get(claimText)!.add(contraryText);
      
      // If symmetric (contradictory), add reverse mapping
      if (contrary.isSymmetric) {
        if (!contraries.has(contraryText)) {
          contraries.set(contraryText, new Set());
        }
        contraries.get(contraryText)!.add(claimText);
      }
    }
  }

  // Phase B & A: KB premises classification - separate axioms (K_n), ordinary premises (K_p), and assumptions (K_a)
  // I-nodes with no incoming edges are initial premises
  // ALSO check ALL I-nodes for role metadata (even if they have incoming edges)
  for (const n of graph.nodes) {
    if (n.nodeType !== 'I') continue;
    
    const content = (n as any).content ?? (n as any).text ?? n.id;
    const metadata = (n as any).metadata ?? {};
    const role = metadata.role ?? null;
    
    // Phase A: Check for assumption role FIRST (highest priority)
    if (role === 'assumption') {
      assumptions.add(content);
      if (DEBUG_ASPIC) console.log(`[aifToAspic] Added assumption from I-node metadata: "${content}"`);
      continue; // Don't add to premises or axioms
    }
    
    // Phase B: Check for axiom role
    if (role === 'axiom' || metadata.isAxiom === true) {
      axioms.add(content);
      if (DEBUG_ASPIC) console.log(`[aifToAspic] Added axiom from I-node metadata: "${content}"`);
      continue; // Don't add to premises
    }
    
    // Default: ordinary premise (K_p) - but only if no incoming edges (initial premise)
    const incoming = incomingByTarget.get(n.id) ?? 0;
    if (incoming === 0 && role !== 'assumption' && role !== 'axiom') {
      premises.add(content);
      if (DEBUG_ASPIC) console.log(`[aifToAspic] Added ordinary premise: "${content}"`);
    }
  }

  // Additional pass: I-nodes linked via presumption edges are also assumptions
  // This catches assumptions created through edge relationships
  for (const e of graph.edges) {
    if (e.edgeType === 'presumption') {
      const assumptionNode = graph.nodes.find(n => n.id === e.sourceId);
      if (assumptionNode?.nodeType === 'I') {
        const content = (assumptionNode as any).content ?? (assumptionNode as any).text ?? assumptionNode.id;
        // Only add if not already in axioms or premises
        if (!axioms.has(content) && !premises.has(content)) {
          assumptions.add(content);
          if (DEBUG_ASPIC) console.log(`[aifToAspic] Added assumption from presumption edge: "${content}"`);
        }
      }
    }
  }

  // RA: rules
  for (const ra of graph.nodes.filter(n => n.nodeType === 'RA')) {
    const premiseEdges = graph.edges.filter(e => e.targetId === ra.id && e.edgeType === 'premise');
    const antecedents = premiseEdges.map(e => {
      const src = graph.nodes.find(n => n.id === e.sourceId);
      return (src as any)?.content ?? (src as any)?.text ?? src?.id ?? '';
    }).filter(Boolean);

    const concl = graph.edges.find(e => e.sourceId === ra.id && e.edgeType === 'conclusion');
    if (!concl) continue;
    const conclNode = graph.nodes.find(n => n.id === concl.targetId);
    if (!conclNode) continue;

    // ASPIC+ Phase 1b.2: Read ruleType from ArgumentSchemeInstance metadata
    const raMetadata = (ra as any).metadata ?? {};
    const schemeInstance = raMetadata.schemeInstance;
    
    // Determine rule type (priority order):
    // 1. schemeInstance.ruleType (from ArgumentSchemeInstance - Phase 1b.2)
    // 2. schemeType metadata (legacy support)
    // 3. Default to 'defeasible'
    let ruleType: 'strict' | 'defeasible' = 'defeasible';
    
    if (schemeInstance?.ruleType) {
      // Phase 1b.2: Use ruleType from ArgumentSchemeInstance
      ruleType = schemeInstance.ruleType.toLowerCase() as 'strict' | 'defeasible';
    } else if ((ra as any).schemeType === 'deductive') {
      // Legacy: infer from schemeType
      ruleType = 'strict';
    }
    
    const ruleName = schemeInstance?.ruleName || null;
    
    const rule = {
      id: ra.id,
      antecedents,
      consequent: (conclNode as any).content ?? (conclNode as any).text ?? conclNode.id,
      type: ruleType,
    } as Rule;
    
    // Classify rule by type
    if (ruleType === 'strict') {
      strictRules.push(rule);
      if (DEBUG_ASPIC) {
        console.log(`[aifToAspic] ✅ Added STRICT rule: ${rule.id}`);
        console.log(`  Antecedents: [${rule.antecedents.join(', ')}]`);
        console.log(`  Consequent: ${rule.consequent}`);
        if (ruleName) {
          console.log(`  Rule name: "${ruleName}"`);
        }
      }
    } else {
      defeasibleRules.push(rule);
      if (DEBUG_ASPIC) console.log(`[aifToAspic] Added defeasible rule: ${rule.id}`);
    }
  }

  // CA: contraries and exceptions (Phase 7: Enhanced with ASPIC+ metadata)
  for (const ca of graph.nodes.filter(n => n.nodeType === 'CA')) {
    const attackerE = graph.edges.find(e => e.targetId === ca.id && e.edgeType === 'conflicting');
    const attackedE = graph.edges.find(e => e.sourceId === ca.id && e.edgeType === 'conflicted');
    if (!attackerE || !attackedE) continue;
    const attackerNode = graph.nodes.find(n => n.id === attackerE.sourceId);
    const attackedNode = graph.nodes.find(n => n.id === attackedE.targetId);
    if (!attackerNode || !attackedNode) continue;

    const attackerSymbol = attackerNode.nodeType === 'I'
      ? ((attackerNode as any).content ?? (attackerNode as any).text ?? attackerNode.id)
      : attackerNode.id;
    const attackedSymbol = attackedNode.nodeType === 'I'
      ? ((attackedNode as any).content ?? (attackedNode as any).text ?? attackedNode.id)
      : attackedNode.id;

    // Phase 7: Read ASPIC+ attack type from CA-node metadata (if available)
    const caMetadata = (ca as any).metadata ?? {};
    const aspicAttackType = (ca as any).aspicAttackType ?? caMetadata.aspicAttackType ?? null;

    // Phase 7: Classify attack based on type
    if (aspicAttackType === 'undercutting') {
      // UNDERCUTS attacks are exceptions (attack the inference, not the conclusion)
      // In ASPIC+, exceptions are represented in assumptions rather than contraries
      // For now, we add to assumptions to mark them as defeasible inference blockers
      assumptions.add(attackerSymbol);
    } else {
      // UNDERMINES and REBUTS are contraries (attack premises or conclusions)
      // These represent contradictory propositions in ASPIC+
      if (!contraries.has(attackerSymbol)) contraries.set(attackerSymbol, new Set());
      contraries.get(attackerSymbol)!.add(attackedSymbol);
    }
  }

  // PA: preferences (preferred over dispreferred)
  for (const pa of graph.nodes.filter(n => n.nodeType === 'PA')) {
    const prefE = graph.edges.find(e => e.targetId === pa.id && /preferred/i.test(e.edgeType));
    const dispE = graph.edges.find(e => e.sourceId === pa.id && /dispreferred/i.test(e.edgeType));
    if (!prefE || !dispE) continue;
    const prefNode = graph.nodes.find(n => n.id === prefE.sourceId);
    const dispNode = graph.nodes.find(n => n.id === dispE.targetId);
    if (!prefNode || !dispNode) continue;
    const preferred = prefNode.nodeType === 'I'
      ? ((prefNode as any).content ?? (prefNode as any).text ?? prefNode.id)
      : prefNode.id;
    const dispreferred = dispNode.nodeType === 'I'
      ? ((dispNode as any).content ?? (dispNode as any).text ?? dispNode.id)
      : dispNode.id;
    preferences.push({ preferred, dispreferred });
  }

  // Summary logging for debugging (always show summary, but condensed in non-debug mode)
  if (DEBUG_ASPIC) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`[aifToAspic] 📊 Translation Summary`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Language:        ${language.size} formulas`);
    console.log(`Contraries:      ${contraries.size} contrary pairs`);
    console.log(`Strict Rules:    ${strictRules.length} (R_s)`);
    console.log(`Defeasible Rules: ${defeasibleRules.length} (R_d)`);
    console.log(`Total Rules:     ${strictRules.length + defeasibleRules.length}`);
    console.log(`Axioms (K_n):    ${axioms.size}`);
    console.log(`Premises (K_p):  ${premises.size}`);
    console.log(`Assumptions (K_a): ${assumptions.size}`);
    console.log(`Preferences:     ${preferences.length}`);
    console.log(`${'='.repeat(70)}\n`);
  } else {
    // Condensed summary in production
    console.log(`[aifToAspic] Translated: ${strictRules.length} strict + ${defeasibleRules.length} defeasible rules, ${axioms.size} axioms, ${premises.size} premises, ${assumptions.size} assumptions`);
  }

  return { language, contraries, strictRules, defeasibleRules, axioms, premises, assumptions, preferences };
}

// ============================================================================
// SEMANTIC COMPUTATION
// ============================================================================

/**
 * Options for ASPIC+ semantic computation
 */
export interface ComputeSemanticsOptions {
  /** Maximum depth for argument construction (default: 5) */
  maxDepth?: number;
  /** Maximum number of arguments to construct (default: 1000) */
  maxArguments?: number;
  /** Whether to dedupe structurally equivalent strict rules (default: true) */
  dedupeStrictRules?: boolean;
}

/**
 * Normalize a formula by:
 * 1. Stripping outer parentheses: "(p)" → "p"
 * 2. Normalizing whitespace
 * 3. Keeping inner structure intact
 */
function normalizeFormula(formula: string): string {
  let result = formula.trim();
  
  // Recursively strip outer parentheses if balanced
  while (result.startsWith('(') && result.endsWith(')')) {
    // Check if the outer parens are actually matching
    // by verifying removing them leaves a balanced formula
    const inner = result.slice(1, -1);
    let depth = 0;
    let balanced = true;
    for (const char of inner) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) { balanced = false; break; }
    }
    if (balanced && depth === 0) {
      result = inner.trim();
    } else {
      break; // Not safe to strip
    }
  }
  
  return result;
}

/**
 * Deduplicate strict rules that have equivalent antecedents and consequent
 * This prevents combinatorial explosion from stored transposition rules
 * 
 * Now handles:
 * - Rules with "(p)" vs "p" (parenthesis normalization)
 * - Rules with different orderings of antecedents
 * - Nested transpositions like "SRSJ (transposed) (transposed)"
 */
function dedupeStrictRules(rules: Rule[]): Rule[] {
  const seen = new Map<string, Rule>();
  
  for (const rule of rules) {
    // Normalize antecedents and consequent
    const normalizedAntecedents = rule.antecedents.map(normalizeFormula).sort();
    const normalizedConsequent = normalizeFormula(rule.consequent);
    
    // Create canonical key from normalized formulas
    const key = `${normalizedAntecedents.join('|||')}==>${normalizedConsequent}`;
    
    // Keep first occurrence (prefer non-transposed rules)
    if (!seen.has(key)) {
      seen.set(key, rule);
    } else {
      // If current rule is not a transpose but existing is, replace
      const existingRule = seen.get(key)!;
      const currentIsTranspose = rule.id.includes('_transpose_') || 
        (rule as any).ruleName?.includes('(transposed)');
      const existingIsTranspose = existingRule.id.includes('_transpose_') || 
        (existingRule as any).ruleName?.includes('(transposed)');
      
      if (!currentIsTranspose && existingIsTranspose) {
        seen.set(key, rule);
      }
    }
  }
  
  const dedupedRules = Array.from(seen.values());
  if (dedupedRules.length < rules.length) {
    console.log(`[computeAspicSemantics] Deduped strict rules: ${rules.length} → ${dedupedRules.length} (removed ${rules.length - dedupedRules.length} duplicates)`);
  }
  
  return dedupedRules;
}

/**
 * Compute complete ASPIC+ semantics from an argumentation theory
 * 
 * This performs the full ASPIC+ pipeline:
 * 1. Construct all possible arguments
 * 2. Compute attack relations
 * 3. Resolve attacks to defeats using preferences
 * 4. Compute grounded extension
 * 5. Assign justification status to all arguments
 * 
 * @param theory The ASPIC+ argumentation theory (old format)
 * @param options Optional configuration for construction limits
 * @returns Complete semantics including arguments, attacks, defeats, extension, and status
 */
export function computeAspicSemantics(
  theory: ArgumentationTheory,
  options: ComputeSemanticsOptions = {}
): AspicSemantics {
  const {
    maxDepth = 5,        // Reduced from 10 to prevent explosion
    maxArguments = 1000, // Reasonable limit
    dedupeStrictRules: shouldDedupe = true,
  } = options;

  // Dedupe strict rules to prevent combinatorial explosion from transpositions
  const strictRules = shouldDedupe 
    ? dedupeStrictRules(theory.strictRules)
    : theory.strictRules;

  // Build ASPIC+ ArgumentationTheory from old format
  const aspicTheory: import('../../aspic/types').ArgumentationTheory = {
    system: {
      language: theory.language,
      contraries: theory.contraries,
      strictRules,
      defeasibleRules: theory.defeasibleRules,
      ruleNames: new Map(theory.defeasibleRules.map(r => [r.id, `rule_${r.id}`])),
    },
    knowledgeBase: {
      axioms: theory.axioms,
      premises: theory.premises,
      assumptions: theory.assumptions,
      premisePreferences: theory.preferences,
      rulePreferences: theory.preferences,
    },
  };

  // Step 1: Construct arguments with limits
  const args = constructArguments(aspicTheory, { maxDepth, maxArguments });

  // Step 2: Compute attacks
  const attacks = computeAttacks(args, aspicTheory);

  // Step 3: Resolve to defeats
  const defeats = computeDefeats(attacks, aspicTheory);

  // Step 4: Compute grounded extension
  const groundedResult = computeGroundedExtension(args, defeats);

  // Step 5: Compute justification labels
  const labeling = computeArgumentLabeling(args, defeats);

  // Convert labeling to status map
  const justificationStatus = new Map<string, 'in' | 'out' | 'undec'>();
  for (const id of labeling.in) {
    justificationStatus.set(id, 'in');
  }
  for (const id of labeling.out) {
    justificationStatus.set(id, 'out');
  }
  for (const id of labeling.undecided) {
    justificationStatus.set(id, 'undec');
  }

  return {
    arguments: args,
    attacks,
    defeats,
    groundedExtension: groundedResult.inArguments,
    justificationStatus,
  };
}

/**
 * Enhanced AIF to ASPIC+ translation with optional semantic computation
 * 
 * @param graph AIF graph structure
 * @param computeSemantics Whether to compute full ASPIC+ semantics (default: false)
 * @returns Argumentation theory and optionally computed semantics
 */
export function aifToAspicWithSemantics(
  graph: AIFGraph,
  computeSemantics = false
): { theory: ArgumentationTheory; semantics?: AspicSemantics } {
  const theory = aifToASPIC(graph);

  if (!computeSemantics) {
    return { theory };
  }

  const semantics = computeAspicSemantics(theory);
  return { theory, semantics };
}

// ============================================================================
// REVERSE TRANSLATION: ASPIC+ → AIF
// ============================================================================

/**
 * Translate ASPIC+ arguments and attacks back to AIF graph structure
 * 
 * This creates:
 * - I-nodes for premises and conclusions
 * - RA-nodes for inference rules used in arguments
 * - CA-nodes for attack relations
 * - Edges connecting the structure
 * 
 * @param args ASPIC+ arguments to translate
 * @param attacks Attack relations between arguments
 * @param defeats Defeat relations (attacks + preferences)
 * @param debateId ID of the debate/deliberation
 * @returns AIF graph representing the argumentation structure
 */
export function aspicToAif(
  args: Argument[],
  attacks: Attack[],
  defeats: Defeat[],
  debateId: string
): AIFGraph {
  const nodes: AIFGraph['nodes'] = [];
  const edges: AIFGraph['edges'] = [];
  const nodeIdMap = new Map<string, string>(); // formula -> node ID

  // Helper: Get or create I-node for a formula
  function getOrCreateINode(formula: string): string {
    if (nodeIdMap.has(formula)) {
      return nodeIdMap.get(formula)!;
    }

    const nodeId = `aif_i_${nodes.length}`;
    nodes.push({
      id: nodeId,
      nodeType: 'I',
      content: formula,
      claimText: formula,
      debateId,
      metadata: { source: 'aspic', formula },
    } as INode);

    nodeIdMap.set(formula, nodeId);
    return nodeId;
  }

  // Helper: Create RA-node for a rule application
  function createRANode(
    ruleId: string,
    ruleType: 'strict' | 'defeasible',
    argId: string
  ): string {
    const nodeId = `aif_ra_${ruleId}_${argId}`;
    nodes.push({
      id: nodeId,
      nodeType: 'RA',
      content: ruleId,
      debateId,
      schemeType: ruleType === 'strict' ? 'deductive' : 'defeasible',
      inferenceType: 'generic',
      metadata: { source: 'aspic', ruleId, argumentId: argId },
    } as RANode);

    return nodeId;
  }

  // Process each argument
  for (const arg of args) {
    // Create I-nodes for all premises
    const premiseNodeIds = Array.from(arg.premises).map(p => getOrCreateINode(p));

    // Create I-node for conclusion
    const conclusionNodeId = getOrCreateINode(arg.conclusion);

    // If argument has structure (uses rules), create RA-nodes
    if (arg.structure.type === 'inference') {
      const raNodeId = createRANode(
        arg.structure.rule.id,
        arg.structure.rule.type,
        arg.id
      );

      // Edges: premises → RA
      for (const premiseId of premiseNodeIds) {
        edges.push({
          id: `edge_${premiseId}_${raNodeId}`,
          sourceId: premiseId,
          targetId: raNodeId,
          edgeType: 'premise',
          debateId,
        });
      }

      // Edge: RA → conclusion
      edges.push({
        id: `edge_${raNodeId}_${conclusionNodeId}`,
        sourceId: raNodeId,
        targetId: conclusionNodeId,
        edgeType: 'conclusion',
        debateId,
      });
    }
  }

  // Process defeats (attacks that succeeded) as CA-nodes
  for (const defeat of defeats) {
    const caNodeId = `aif_ca_${defeat.defeater.id}_${defeat.defeated.id}`;

    // Determine conflict type based on attack type
    const conflictType: 'rebut' | 'undercut' | 'undermine' =
      defeat.attack.type === 'rebutting' ? 'rebut' :
      defeat.attack.type === 'undercutting' ? 'undercut' :
      'undermine';

    nodes.push({
      id: caNodeId,
      nodeType: 'CA',
      content: `${defeat.defeater.conclusion} attacks ${defeat.defeated.conclusion}`,
      debateId,
      conflictType,
      metadata: {
        source: 'aspic',
        attackType: defeat.attack.type,
        defeaterArgId: defeat.defeater.id,
        defeatedArgId: defeat.defeated.id,
        preferenceApplied: defeat.preferenceApplied,
      },
    } as CANode);

    // Get node IDs for defeater and defeated conclusions
    const defeaterNodeId = getOrCreateINode(defeat.defeater.conclusion);
    const defeatedNodeId = getOrCreateINode(defeat.defeated.conclusion);

    // Edge: defeater → CA (conflicting)
    edges.push({
      id: `edge_${defeaterNodeId}_${caNodeId}`,
      sourceId: defeaterNodeId,
      targetId: caNodeId,
      edgeType: 'conflicting',
      debateId,
    });

    // Edge: CA → defeated (conflicted)
    edges.push({
      id: `edge_${caNodeId}_${defeatedNodeId}`,
      sourceId: caNodeId,
      targetId: defeatedNodeId,
      edgeType: 'conflicted',
      debateId,
    });
  }

  return { nodes, edges };
}

/**
 * Complete ASPIC+ evaluation: compute semantics and generate AIF graph
 * 
 * This is the full pipeline:
 * 1. Build ASPIC+ theory from AIF
 * 2. Compute arguments, attacks, defeats, extension
 * 3. Translate back to enriched AIF with CA-nodes
 * 
 * @param inputGraph Input AIF graph
 * @param debateId ID for output nodes
 * @returns Enriched AIF graph with computed attacks and semantics
 */
export function evaluateAifWithAspic(
  inputGraph: AIFGraph,
  debateId: string
): { outputGraph: AIFGraph; semantics: AspicSemantics } {
  // AIF → ASPIC+ theory
  const theory = aifToASPIC(inputGraph);

  // Compute semantics
  const semantics = computeAspicSemantics(theory);

  // ASPIC+ → AIF (with attacks as CA-nodes)
  const outputGraph = aspicToAif(
    semantics.arguments,
    semantics.attacks,
    semantics.defeats,
    debateId
  );

  return { outputGraph, semantics };
}
