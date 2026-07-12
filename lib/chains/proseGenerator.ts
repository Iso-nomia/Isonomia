/**
 * Argument Chain Prose Generator
 * Transforms structured argument chains into legal brief-style prose narratives
 * 
 * Creates coherent, readable text that:
 * - Elaborates arguments based on their scheme structure
 * - Describes logical flow between arguments via edges
 * - Follows legal briefing conventions
 */

import { ArgumentChainWithRelations, ArgumentChainNodeWithArgument, ArgumentChainEdgeWithNodes } from "@/lib/types/argumentChain";

// ===== Types =====

export interface ProseOptions {
  /** Document style */
  style?: "legal_brief" | "academic" | "summary";
  /** Include section headers */
  includeSections?: boolean;
  /** Include argument numbering */
  includeNumbering?: boolean;
  /** Include critical questions analysis */
  includeCriticalQuestions?: boolean;
  /** Include chain metadata */
  includeMetadata?: boolean;
  /** Maximum characters per argument elaboration */
  maxElaborationLength?: number;
  /** Include chain type description in introduction (Phase 4) */
  includeChainTypeDescription?: boolean;
  /** Apply epistemic status language prefixes/suffixes (Phase 4) */
  includeEpistemicLanguage?: boolean;
  /** Group arguments by scope (Phase 4 - Phase C) */
  groupByScope?: boolean;
  /** Adjust flow based on chain type (Phase 4 - Phase C) */
  adjustFlowForChainType?: boolean;
}

export interface ProseResult {
  title: string;
  sections: ProseSection[];
  fullText: string;
  metadata: {
    chainId: string;
    chainName: string;
    argumentCount: number;
    connectionCount: number;
    generatedAt: string;
  };
}

export interface ProseSection {
  id: string;
  heading: string;
  content: string;
  type: "introduction" | "argument" | "transition" | "analysis" | "conclusion";
}

// ===== Scheme Elaboration Templates =====

interface SchemeTemplate {
  /** How to introduce an argument using this scheme */
  introduction: string;
  /** How to elaborate the reasoning */
  elaboration: string;
  /** Transition phrases for supporting arguments */
  supportTransition: string;
  /** Transition phrases for attacking arguments */
  attackTransition: string;
  /** Critical questions to mention */
  criticalQuestions: string[];
}

const SCHEME_TEMPLATES: Record<string, SchemeTemplate> = {
  "argument_from_expert_opinion": {
    introduction: "Drawing upon expert testimony",
    elaboration: "This argument invokes the authority of specialized knowledge. The reasoning proceeds as follows: when an expert in a relevant field asserts a proposition within their domain of expertise, that proposition carries significant epistemic weight.",
    supportTransition: "This expert assessment is further corroborated by",
    attackTransition: "However, this reliance on expert opinion is challenged by",
    criticalQuestions: [
      "Is the source a genuine expert in the relevant field?",
      "Is the assertion within the expert's domain of expertise?",
      "Are there other experts who disagree?",
      "Is the expert's opinion based on evidence?"
    ]
  },
  "expert_opinion": {
    introduction: "Drawing upon expert testimony",
    elaboration: "This argument invokes the authority of specialized knowledge. The reasoning proceeds as follows: when an expert in a relevant field asserts a proposition within their domain of expertise, that proposition carries significant epistemic weight.",
    supportTransition: "This expert assessment is further corroborated by",
    attackTransition: "However, this reliance on expert opinion is challenged by",
    criticalQuestions: [
      "Is the source a genuine expert in the relevant field?",
      "Is the assertion within the expert's domain of expertise?",
      "Are there other experts who disagree?"
    ]
  },
  "practical_reasoning": {
    introduction: "From a practical standpoint",
    elaboration: "This argument employs practical reasoning, connecting means to ends. The structure is: given a desired goal, and that a particular action would achieve that goal, there is reason to perform that action.",
    supportTransition: "The practicality of this approach is reinforced by",
    attackTransition: "The practical feasibility of this reasoning is questioned by",
    criticalQuestions: [
      "Are there alternative means to achieve the goal?",
      "Are there negative side effects of the proposed action?",
      "Is the goal actually desirable?"
    ]
  },
  "argument_from_analogy": {
    introduction: "By way of analogy",
    elaboration: "This argument proceeds by analogical reasoning. Two cases are compared, and because they share relevant similarities, what holds true in one case is argued to hold true in the other.",
    supportTransition: "This analogical reasoning is strengthened by",
    attackTransition: "The validity of this analogy is contested by",
    criticalQuestions: [
      "Are the compared cases sufficiently similar?",
      "Are there relevant differences between the cases?",
      "Is the comparison appropriate in this context?"
    ]
  },
  "analogy": {
    introduction: "By way of analogy",
    elaboration: "This argument proceeds by analogical reasoning, drawing parallels between comparable situations to derive conclusions.",
    supportTransition: "This analogical reasoning is strengthened by",
    attackTransition: "The validity of this analogy is contested by",
    criticalQuestions: [
      "Are the compared cases sufficiently similar?",
      "Are there relevant differences between the cases?"
    ]
  },
  "argument_from_consequences": {
    introduction: "Considering the consequences",
    elaboration: "This argument evaluates a course of action based on its expected outcomes. If an action leads to beneficial consequences, that provides reason to undertake it; if harmful consequences, reason to avoid it.",
    supportTransition: "The consequential analysis is supported by",
    attackTransition: "This consequentialist reasoning faces the objection that",
    criticalQuestions: [
      "How certain are the predicted consequences?",
      "Are there unintended consequences not considered?",
      "How are the consequences being evaluated?"
    ]
  },
  "cause_to_effect": {
    introduction: "Through causal analysis",
    elaboration: "This argument traces a causal chain from an established cause to its effect. The reasoning depends on the reliability of the causal relationship identified.",
    supportTransition: "This causal connection is further evidenced by",
    attackTransition: "The causal link is challenged by",
    criticalQuestions: [
      "Is the causal relationship well-established?",
      "Could there be alternative causes?",
      "Is the effect actually attributable to the stated cause?"
    ]
  },
  "causal": {
    introduction: "Through causal analysis",
    elaboration: "This argument establishes a causal relationship between events or conditions, reasoning from cause to effect. The warrant licensing this inference is that effects follow from their causes under normal circumstances.",
    supportTransition: "This causal connection is further evidenced by",
    attackTransition: "The causal link is challenged by",
    criticalQuestions: [
      "Is the causal relationship well-established?",
      "Could there be alternative causes?",
      "Is the effect actually attributable to the stated cause?"
    ]
  },
  "causal_reasoning": {
    introduction: "Through causal analysis",
    elaboration: "This argument establishes a causal relationship between events or conditions, reasoning from cause to effect.",
    supportTransition: "This causal connection is further evidenced by",
    attackTransition: "The causal link is challenged by",
    criticalQuestions: [
      "Is the causal relationship well-established?",
      "Could there be alternative causes?"
    ]
  },
  "argument_from_sign": {
    introduction: "Based on observable indicators",
    elaboration: "This argument reasons from a sign to what it signifies. The presence of certain observable features serves as evidence for an underlying condition or state.",
    supportTransition: "Additional indicators supporting this include",
    attackTransition: "The reliability of these indicators is questioned by",
    criticalQuestions: [
      "Is the sign reliably correlated with what it signifies?",
      "Could the sign indicate something else?"
    ]
  },
  "modus_ponens": {
    introduction: "By logical deduction",
    elaboration: "This argument follows the classical deductive form: if a conditional statement is true, and its antecedent is established, then the consequent necessarily follows.",
    supportTransition: "This deductive inference is supported by",
    attackTransition: "This logical chain is challenged by",
    criticalQuestions: [
      "Is the conditional premise true?",
      "Is the antecedent actually established?"
    ]
  },
  "mp": {
    introduction: "By logical deduction",
    elaboration: "This argument applies modus ponens, deriving a conclusion from a conditional premise and its antecedent.",
    supportTransition: "This deductive inference is supported by",
    attackTransition: "This logical chain is challenged by",
    criticalQuestions: [
      "Is the conditional premise true?",
      "Is the antecedent actually established?"
    ]
  },
  "argument_from_popular_opinion": {
    introduction: "Reflecting widespread consensus",
    elaboration: "This argument appeals to the views held by the majority. While popular opinion does not guarantee truth, widespread agreement can constitute relevant evidence in certain contexts.",
    supportTransition: "This popular view is reinforced by",
    attackTransition: "Despite popular opinion, it is argued that",
    criticalQuestions: [
      "Is the opinion truly widespread?",
      "Is popular opinion relevant to the truth of this matter?",
      "Could popular opinion be mistaken?"
    ]
  },
  "argument_from_negative_consequences": {
    introduction: "Considering the negative consequences",
    elaboration: "This argument evaluates a course of action based on its harmful or undesirable outcomes. The reasoning proceeds: if an action leads to bad consequences, that provides reason to avoid it or take preventive measures.",
    supportTransition: "The potential for harm is further evidenced by",
    attackTransition: "However, the claimed negative consequences are disputed by",
    criticalQuestions: [
      "Are the stated bad consequences likely to occur?",
      "Can the bad effects be mitigated so they are acceptable?",
      "Are there benefits that outweigh the bad effects?"
    ]
  },
  "negative_consequences": {
    introduction: "Considering the negative consequences",
    elaboration: "This argument warns of harmful outcomes that would result from a particular course of action.",
    supportTransition: "The potential for harm is further evidenced by",
    attackTransition: "However, the claimed negative consequences are disputed by",
    criticalQuestions: [
      "Are the stated bad consequences likely to occur?",
      "Can the bad effects be mitigated?"
    ]
  },
  "argument_from_division": {
    introduction: "Through reasoning from whole to parts",
    elaboration: "This argument infers properties of parts from properties of the whole. Like composition, it's defeasible because not all properties distribute from wholes to parts. The formal structure is: Major Premise: The whole W has property F. Minor Premise (implicit): What is true of the whole is true of its parts. Conclusion: Therefore, each part of W has property F. The warrant licensing this inference is that in certain cases, properties of wholes distribute to their constituent parts.",
    supportTransition: "This division of the whole into parts is supported by",
    attackTransition: "However, this inference from whole to parts is challenged by",
    criticalQuestions: [
      "Does the whole really have the stated property?",
      "Is this the kind of property that transfers from wholes to parts?",
      "Are there properties of the whole that do not distribute to the parts?"
    ]
  },
  "argument_from_composition": {
    introduction: "Through reasoning from parts to whole",
    elaboration: "This argument infers properties of a whole from properties of its parts. The formal structure is: Major Premise: The parts (or members) of whole W all have property F. Minor Premise (implicit): What is true of the parts is true of the whole. Conclusion: Therefore, the whole W has property F. The warrant licensing this inference is that in certain cases, properties of parts aggregate to the whole—though this is defeasible because not all properties transfer from parts to wholes (e.g., each part being lightweight doesn't necessarily make the whole lightweight).",
    supportTransition: "This composition analysis is supported by",
    attackTransition: "However, this inference from parts to whole is challenged by",
    criticalQuestions: [
      "Do all the parts really have property F?",
      "Is F the kind of property that transfers from parts to wholes?",
      "Are there emergent properties of the whole that differ from the parts?"
    ]
  },
  "composition": {
    introduction: "Through reasoning from parts to whole",
    elaboration: "This argument infers properties of a whole from properties of its parts.",
    supportTransition: "This composition analysis is supported by",
    attackTransition: "However, this inference from parts to whole is challenged by",
    criticalQuestions: [
      "Do all the parts really have property F?",
      "Is F the kind of property that transfers from parts to wholes?"
    ]
  },
  "slippery_slope": {
    introduction: "Warning of a slippery slope",
    elaboration: "This argument warns that taking a first step will lead down a chain of consequences to an unacceptable outcome. The formal structure is: Major Premise: Doing A will lead to B, B will lead to C, and eventually to unacceptable Z. Minor Premise: We should avoid Z. Conclusion: Therefore, we should not do A. The warrant licensing this inference is that causal or probabilistic chains, once initiated, tend to continue to their natural endpoints—though this is highly defeasible when stopping points exist or the chain is speculative.",
    supportTransition: "The likelihood of this slippery slope is supported by",
    attackTransition: "However, the plausibility of this slippery slope is challenged by",
    criticalQuestions: [
      "Is the causal/probabilistic chain from A to Z plausible?",
      "Are there realistic stopping points or safeguards?",
      "How probable is the slide under normal governance?",
      "Is the endpoint Z truly unacceptable?"
    ]
  },
  "argument_from_example": {
    introduction: "By way of example",
    elaboration: "This argument reasons from a particular case to a general rule, then applies it to a new case. The formal structure is: Major Premise: In case C, individual a has property F and also property G. Minor Premise: Therefore, generally, if x has F then x has G. Additional Premise: Individual b has property F. Conclusion: Therefore, b also has property G. The warrant licensing this inference is that representative instances support generalizations, which can then be applied to similar cases.",
    supportTransition: "This example-based reasoning is supported by",
    attackTransition: "However, the generalization from this example is challenged by",
    criticalQuestions: [
      "Is the example representative of the population?",
      "Are there counterexamples that would support a different conclusion?",
      "Is the sample size sufficient to support the generalization?"
    ]
  },
  "division": {
    introduction: "Through reasoning from whole to parts",
    elaboration: "This argument infers properties of parts from properties of the whole.",
    supportTransition: "This division analysis is supported by",
    attackTransition: "However, this inference from whole to parts is challenged by",
    criticalQuestions: [
      "Does the whole really have the stated property?",
      "Is this the kind of property that transfers from wholes to parts?"
    ]
  },
  "argument_from_definition_to_verbal_classification": {
    introduction: "By definitional classification",
    elaboration: "This argument uses an established definition to justify classifying something under a term. It makes the definitional basis explicit, connecting defining properties to the classification.",
    supportTransition: "This classificatory reasoning is supported by",
    attackTransition: "However, this classification is contested by",
    criticalQuestions: [
      "Does the subject actually have all the defining properties?",
      "Is the definition acceptable and authoritative?",
      "Are the defining properties sufficient for the classification?"
    ]
  },
  "definition_to_verbal_classification": {
    introduction: "By definitional classification",
    elaboration: "This argument classifies something by showing it meets the defining properties of a category.",
    supportTransition: "This classification is supported by",
    attackTransition: "However, this classification is contested by",
    criticalQuestions: [
      "Does the subject have all the defining properties?",
      "Is the definition authoritative?"
    ]
  },
  "sign": {
    introduction: "Based on observable signs",
    elaboration: "This argument reasons from observable signs or indicators to a conclusion about what they signify.",
    supportTransition: "Additional indicators include",
    attackTransition: "However, these signs are questioned by",
    criticalQuestions: [
      "Is the sign reliable in this context?",
      "Are there alternative explanations?"
    ]
  },
  "practical_reasoning_goal_means_ought": {
    introduction: "From a practical standpoint",
    elaboration: "This argument employs practical reasoning, connecting means to ends. The structure is: given a desired goal, and that a particular action would achieve that goal, there is reason to perform that action.",
    supportTransition: "The practicality of this approach is reinforced by",
    attackTransition: "The practical feasibility of this reasoning is questioned by",
    criticalQuestions: [
      "Is the goal/value explicit and acceptable?",
      "Will the action actually achieve the goal?",
      "Is there a better alternative?",
      "Do negative consequences outweigh achieving the goal?"
    ]
  },
  "position_to_know": {
    introduction: "From an informed perspective",
    elaboration: "This argument relies on testimony from someone in a position to have relevant knowledge, whether through direct experience, access to information, or professional standing.",
    supportTransition: "This informed perspective is corroborated by",
    attackTransition: "The reliability of this testimony is questioned by",
    criticalQuestions: [
      "Is the source actually in a position to know?",
      "Is the source being truthful?",
      "Could the source be mistaken?"
    ]
  },
  "default": {
    introduction: "the argument contends",
    elaboration: "This reasoning connects premises to conclusion through inference, establishing the basis for the claim.",
    supportTransition: "This position is further supported by",
    attackTransition: "This argument faces the objection that",
    criticalQuestions: [

      "Are the premises well-established?",
      "Does the conclusion follow from the premises?"
    ]
  }
};

// ===== Chain Type Descriptions (Phase 4) =====

const CHAIN_TYPE_DESCRIPTIONS: Record<string, {
  intro: string;
  structure: string;
  flowHint: string;
}> = {
  SERIAL: {
    intro: "This argument proceeds as a chain of sequential reasoning",
    structure: "Each step builds upon the previous, forming a linear inferential path from initial premises to final conclusion.",
    flowHint: "follows a step-by-step progression"
  },
  CONVERGENT: {
    intro: "Multiple independent lines of reasoning converge to support a central conclusion",
    structure: "Several distinct arguments, each with their own premises and warrants, combine their force to establish a shared thesis.",
    flowHint: "brings together complementary perspectives"
  },
  DIVERGENT: {
    intro: "From a foundational claim, several distinct implications and conclusions emerge",
    structure: "A single premise or established fact gives rise to multiple independent conclusions, each warranting separate consideration.",
    flowHint: "branches into multiple applications"
  },
  TREE: {
    intro: "This argument exhibits a hierarchical structure",
    structure: "Moving from general principles to specific applications, the reasoning branches at key points to address distinct aspects of the matter.",
    flowHint: "proceeds from broad principles to specific conclusions"
  },
  GRAPH: {
    intro: "The argumentative structure forms an interconnected network of claims and inferences",
    structure: "Arguments relate to one another in complex ways, with support, attack, and qualification relationships creating a rich deliberative fabric.",
    flowHint: "navigates an interconnected web of considerations"
  }
};

// ===== Epistemic Status Language (Phase 4) =====

const EPISTEMIC_LANGUAGE: Record<string, {
  prefix: string;
  suffix: string;
  contextPhrase: string;
}> = {
  ASSERTED: {
    prefix: "",
    suffix: "",
    contextPhrase: ""
  },
  HYPOTHETICAL: {
    prefix: "Suppose, for the sake of argument, that ",
    suffix: "",
    contextPhrase: "Under this hypothesis, "
  },
  COUNTERFACTUAL: {
    prefix: "Had it been the case that ",
    suffix: ", though we know this to be contrary to fact",
    contextPhrase: "In this counterfactual scenario, "
  },
  CONDITIONAL: {
    prefix: "If we accept that ",
    suffix: "",
    contextPhrase: "Given this condition, "
  },
  QUESTIONED: {
    prefix: "It remains an open question whether ",
    suffix: "—this matter awaits further examination",
    contextPhrase: "Pending resolution of this question, "
  },
  DENIED: {
    prefix: "While it has been argued that ",
    suffix: "—though this claim has been rejected",
    contextPhrase: "Despite the denial, some maintain that "
  },
  SUSPENDED: {
    prefix: "Setting aside for the moment the question of whether ",
    suffix: "",
    contextPhrase: "Bracketing this consideration, "
  }
};

/**
 * Get epistemic prefix for argument text
 */
function getEpistemicPrefix(status: string | null | undefined): string {
  if (!status || status === "ASSERTED") return "";
  return EPISTEMIC_LANGUAGE[status]?.prefix || "";
}

/**
 * Get epistemic suffix for argument text
 */
function getEpistemicSuffix(status: string | null | undefined): string {
  if (!status || status === "ASSERTED") return "";
  return EPISTEMIC_LANGUAGE[status]?.suffix || "";
}

/**
 * Get epistemic context phrase for transitions
 */
function getEpistemicContextPhrase(status: string | null | undefined): string {
  if (!status || status === "ASSERTED") return "";
  return EPISTEMIC_LANGUAGE[status]?.contextPhrase || "";
}

// ===== Scope Section Generation (Phase C) =====

/**
 * Scope introduction phrases by type
 */
const SCOPE_INTRODUCTIONS: Record<string, {
  opening: string;
  transition: string;
  closing: string;
}> = {
  HYPOTHETICAL: {
    opening: "For the sake of argument, let us assume",
    transition: "Under this hypothesis, we consider the following arguments:",
    closing: "This hypothetical analysis illuminates potential implications worth considering."
  },
  COUNTERFACTUAL: {
    opening: "Consider a counterfactual scenario in which",
    transition: "Contrary to the actual state of affairs, in this alternative scenario:",
    closing: "Though contrary to fact, this counterfactual analysis reveals important structural features of the argument."
  },
  CONDITIONAL: {
    opening: "Under the condition that",
    transition: "Given this conditional framework, the following reasoning applies:",
    closing: "The conditional nature of these arguments should inform their application."
  },
  OPPONENT: {
    opening: "From the opposing perspective, which maintains that",
    transition: "This opposing view advances the following arguments:",
    closing: "Understanding this opposing position is essential for a complete analysis."
  },
  MODAL: {
    opening: "In a possible world where",
    transition: "Within this modal context, we find:",
    closing: "This modal analysis expands our understanding of the argumentative space."
  }
};

/**
 * Interface for scope data with nodes
 */
interface ScopeWithNodes {
  id: string;
  scopeType: string;
  assumption: string;
  color?: string | null;
  parentId?: string | null;
  nodes: ArgumentChainNodeWithArgument[];
  childScopes?: ScopeWithNodes[];
}

/**
 * Group nodes by their scope assignment
 */
function groupNodesByScope(
  nodes: ArgumentChainNodeWithArgument[],
  scopes: any[] | undefined
): { unscopedNodes: ArgumentChainNodeWithArgument[]; scopedGroups: ScopeWithNodes[] } {
  const unscopedNodes: ArgumentChainNodeWithArgument[] = [];
  const scopeMap = new Map<string, ScopeWithNodes>();

  // Initialize scope groups
  if (scopes) {
    for (const scope of scopes) {
      scopeMap.set(scope.id, {
        id: scope.id,
        scopeType: scope.scopeType,
        assumption: scope.assumption,
        color: scope.color,
        parentId: scope.parentId,
        nodes: [],
        childScopes: []
      });
    }
  }

  // Assign nodes to scopes or unscoped list
  for (const node of nodes) {
    const scopeId = (node as any).scopeId;
    if (scopeId && scopeMap.has(scopeId)) {
      scopeMap.get(scopeId)!.nodes.push(node);
    } else {
      unscopedNodes.push(node);
    }
  }

  // Build scope hierarchy (nest child scopes under parents)
  const rootScopes: ScopeWithNodes[] = [];
  for (const scope of scopeMap.values()) {
    if (scope.parentId && scopeMap.has(scope.parentId)) {
      scopeMap.get(scope.parentId)!.childScopes?.push(scope);
    } else {
      rootScopes.push(scope);
    }
  }

  return { unscopedNodes, scopedGroups: rootScopes };
}

/**
 * Generate prose section for a single scope
 */
function generateScopeSection(
  scope: ScopeWithNodes,
  sectionNumber: string,
  style: string,
  includeNumbering: boolean,
  includeCriticalQuestions: boolean,
  includeEpistemicLanguage: boolean,
  nodeById: Map<string, ArgumentChainNodeWithArgument>,
  edges: any[],
  depth: number = 0
): ProseSection {
  const scopeIntro = SCOPE_INTRODUCTIONS[scope.scopeType] || SCOPE_INTRODUCTIONS.HYPOTHETICAL;
  const indent = "  ".repeat(depth);
  
  const contentParts: string[] = [];
  
  // Scope header with assumption
  contentParts.push(`${indent}**${scopeIntro.opening}:** "${scope.assumption}"\n`);
  contentParts.push(`${indent}${scopeIntro.transition}\n`);
  
  // Generate prose for each node in this scope
  scope.nodes.forEach((node, index) => {
    const argNumber = includeNumbering ? `${sectionNumber}.${index + 1}. ` : "";
    const argText = getArgumentText(node);
    const schemeInfo = getSchemeInfo(node);
    
    const epistemicStatus = (node as any).epistemicStatus as string | null;
    const premises = getArgumentPremises(node);
    const implicitWarrant = getImplicitWarrant(node);
    
    const paragraphs: string[] = [];
    
    // Opening with scheme introduction
    const introduction = generateSchemeIntroduction(schemeInfo);
    
    // Apply epistemic language
    let formattedArgText = cleanText(argText);
    if (includeEpistemicLanguage && epistemicStatus && epistemicStatus !== "ASSERTED") {
      const prefix = getEpistemicPrefix(epistemicStatus);
      const suffix = getEpistemicSuffix(epistemicStatus);
      if (prefix) {
        formattedArgText = `${prefix}${formattedArgText.charAt(0).toLowerCase()}${formattedArgText.slice(1)}`;
      }
      if (suffix) {
        formattedArgText = `${formattedArgText}${suffix}`;
      }
    }
    
    const opening = `${indent}${argNumber}${introduction}: "${formattedArgText}"`;
    paragraphs.push(opening);
    
    // Scheme elaboration for detailed styles
    if (style === "legal_brief" || style === "academic") {
      const elaboration = generateSchemeElaboration(schemeInfo);
      paragraphs.push(`${indent}${elaboration}`);
      
      // Premise analysis
      const premiseAnalysis = generatePremiseAnalysis(premises, implicitWarrant);
      if (premiseAnalysis) {
        paragraphs.push(`${indent}${premiseAnalysis}`);
      }
    }
    
    contentParts.push(paragraphs.join("\n\n"));
  });
  
  // Recursively generate nested scopes
  if (scope.childScopes && scope.childScopes.length > 0) {
    scope.childScopes.forEach((childScope, index) => {
      const childSection = generateScopeSection(
        childScope,
        `${sectionNumber}.${scope.nodes.length + index + 1}`,
        style,
        includeNumbering,
        includeCriticalQuestions,
        includeEpistemicLanguage,
        nodeById,
        edges,
        depth + 1
      );
      contentParts.push(`\n${childSection.content}`);
    });
  }
  
  // Scope closing
  contentParts.push(`\n${indent}${scopeIntro.closing}`);
  
  return {
    id: `scope_${scope.id}`,
    heading: `${scope.scopeType}: ${scope.assumption}`,
    content: contentParts.join("\n\n"),
    type: "analysis"
  };
}

/**
 * Generate chain-type-specific flow structure
 */
function generateChainTypeFlow(
  chainType: string,
  nodes: ArgumentChainNodeWithArgument[],
  edges: any[],
  nodeById: Map<string, ArgumentChainNodeWithArgument>
): { structuredNodes: ArgumentChainNodeWithArgument[][]; flowDescription: string } {
  const typeInfo = CHAIN_TYPE_DESCRIPTIONS[chainType] || CHAIN_TYPE_DESCRIPTIONS.GRAPH;
  
  switch (chainType) {
    case "SERIAL": {
      // For serial chains, maintain topological order
      const { sorted } = topologicalSort(nodes, edges);
      return {
        structuredNodes: [sorted],
        flowDescription: "The arguments are presented in sequence, each building upon its predecessor."
      };
    }
    
    case "CONVERGENT": {
      // For convergent chains, group by their target conclusion
      const targetCounts = new Map<string, number>();
      edges.forEach(e => {
        if (e.edgeType === "SUPPORTS" || e.edgeType === "SUPPORT") {
          targetCounts.set(e.targetNodeId, (targetCounts.get(e.targetNodeId) || 0) + 1);
        }
      });
      
      // Find the main conclusion (most supported)
      let mainConclusionId: string | null = null;
      let maxSupport = 0;
      targetCounts.forEach((count, id) => {
        if (count > maxSupport) {
          maxSupport = count;
          mainConclusionId = id;
        }
      });
      
      if (mainConclusionId) {
        // Group: premises that support conclusion, then the conclusion itself
        const supportingPremises = edges
          .filter(e => e.targetNodeId === mainConclusionId && (e.edgeType === "SUPPORTS" || e.edgeType === "SUPPORT"))
          .map(e => nodeById.get(e.sourceNodeId))
          .filter(Boolean) as ArgumentChainNodeWithArgument[];
        
        const conclusion = nodeById.get(mainConclusionId);
        const otherNodes = nodes.filter(n => 
          n.id !== mainConclusionId && 
          !supportingPremises.some(p => p.id === n.id)
        );
        
        return {
          structuredNodes: [supportingPremises, conclusion ? [conclusion] : [], otherNodes].filter(arr => arr.length > 0),
          flowDescription: `${supportingPremises.length} independent lines of reasoning converge to support the central thesis.`
        };
      }
      
      return { structuredNodes: [nodes], flowDescription: typeInfo.flowHint };
    }
    
    case "DIVERGENT": {
      // For divergent chains, find root premise and group by branches
      const inDegree = new Map<string, number>();
      nodes.forEach(n => inDegree.set(n.id, 0));
      edges.forEach(e => inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1));
      
      const rootNodes = nodes.filter(n => inDegree.get(n.id) === 0);
      
      if (rootNodes.length === 1) {
        const root = rootNodes[0];
        const branches = edges
          .filter(e => e.sourceNodeId === root.id)
          .map(e => nodeById.get(e.targetNodeId))
          .filter(Boolean) as ArgumentChainNodeWithArgument[];
        
        const otherNodes = nodes.filter(n => 
          n.id !== root.id && 
          !branches.some(b => b.id === n.id)
        );
        
        return {
          structuredNodes: [[root], branches, otherNodes].filter(arr => arr.length > 0),
          flowDescription: `From the foundational claim, ${branches.length} distinct implications emerge.`
        };
      }
      
      return { structuredNodes: [nodes], flowDescription: typeInfo.flowHint };
    }
    
    case "TREE": {
      // For tree chains, organize by depth level
      const levels: ArgumentChainNodeWithArgument[][] = [];
      const visited = new Set<string>();
      const inDegree = new Map<string, number>();
      
      nodes.forEach(n => inDegree.set(n.id, 0));
      edges.forEach(e => inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1));
      
      // Start with roots
      let currentLevel = nodes.filter(n => inDegree.get(n.id) === 0);
      
      while (currentLevel.length > 0) {
        levels.push(currentLevel);
        currentLevel.forEach(n => visited.add(n.id));
        
        // Find next level: nodes whose all predecessors have been visited
        const nextLevel: ArgumentChainNodeWithArgument[] = [];
        nodes.forEach(n => {
          if (visited.has(n.id)) return;
          const predecessors = edges
            .filter(e => e.targetNodeId === n.id)
            .map(e => e.sourceNodeId);
          if (predecessors.length > 0 && predecessors.every(p => visited.has(p))) {
            nextLevel.push(n);
          }
        });
        
        currentLevel = nextLevel;
      }
      
      // Add any remaining unvisited nodes
      const remaining = nodes.filter(n => !visited.has(n.id));
      if (remaining.length > 0) {
        levels.push(remaining);
      }
      
      return {
        structuredNodes: levels,
        flowDescription: `The argument proceeds through ${levels.length} levels, from general principles to specific applications.`
      };
    }
    
    default: {
      // GRAPH: Use topological sort
      const { sorted, orphans } = topologicalSort(nodes, edges);
      return {
        structuredNodes: orphans.length > 0 ? [sorted, orphans] : [sorted],
        flowDescription: typeInfo.flowHint
      };
    }
  }
}

// ===== Edge Type Transition Phrases =====

const EDGE_TRANSITIONS: Record<string, { support: string; flow: string }> = {
  "SUPPORT": {
    support: "In support of this conclusion",
    flow: "Building upon this foundation"
  },
  "SUPPORTS": {
    support: "In support of this conclusion",
    flow: "Building upon this foundation"
  },
  "ATTACK": {
    support: "Challenging this position",
    flow: "In opposition to the foregoing"
  },
  "ATTACKS": {
    support: "Challenging this position",
    flow: "In opposition to the foregoing"
  },
  "UNDERCUT": {
    support: "Questioning the inferential link",
    flow: "While not disputing the premises"
  },
  "UNDERCUTS": {
    support: "Questioning the inferential link",
    flow: "While not disputing the premises"
  },
  "REBUT": {
    support: "Directly contradicting",
    flow: "In direct contradiction"
  },
  "REBUTS": {
    support: "Directly contradicting",
    flow: "In direct contradiction"
  },
  "SEQUENCE": {
    support: "Following from this",
    flow: "Subsequently"
  },
  "ELABORATION": {
    support: "Elaborating on this point",
    flow: "To elaborate further"
  },
  "default": {
    support: "Related to this",
    flow: "Furthermore"
  }
};

// ===== Helper Functions =====

/**
 * Get the argument's display text, with fallbacks
 */
function getArgumentText(node: ArgumentChainNodeWithArgument): string {
  const arg = node.argument;
  if (!arg) return "No argument text available";
  
  // Try conclusion text first (canonical), then argument text
  if ((arg as any).conclusion?.text) return (arg as any).conclusion.text;
  if (arg.text) return arg.text;
  
  return "Argument text unavailable";
}

/**
 * Extended scheme information with rich metadata
 */
interface ExtendedSchemeInfo {
  key: string;
  name: string | null;
  description: string | null;
  summary: string | null;
  cq: unknown; // JSON array of critical questions
  premises: unknown; // JSON array of premise templates
  conclusion: unknown; // JSON conclusion template
  purpose: string | null;
  source: string | null;
  materialRelation: string | null;
  reasoningType: string | null;
  ruleForm: string | null;
  conclusionType: string | null;
  whenToUse: string | null;
  tags: string[];
}

/**
 * Get extended scheme information from an argument node
 */
function getSchemeInfo(node: ArgumentChainNodeWithArgument): ExtendedSchemeInfo | null {
  const arg = node.argument;
  if (!arg) return null;
  
  // Check argumentSchemes relation
  if (arg.argumentSchemes && arg.argumentSchemes.length > 0) {
    const scheme = arg.argumentSchemes[0].scheme as any;
    return {
      key: scheme.key,
      name: scheme.name || null,
      description: scheme.description || null,
      summary: scheme.summary || null,
      cq: scheme.cq || [],
      premises: scheme.premises || null,
      conclusion: scheme.conclusion || null,
      purpose: scheme.purpose || null,
      source: scheme.source || null,
      materialRelation: scheme.materialRelation || null,
      reasoningType: scheme.reasoningType || null,
      ruleForm: scheme.ruleForm || null,
      conclusionType: scheme.conclusionType || null,
      whenToUse: scheme.whenToUse || null,
      tags: scheme.tags || [],
    };
  }
  
  // Check schemeNet
  if (arg.schemeNet?.steps && arg.schemeNet.steps.length > 0) {
    const scheme = arg.schemeNet.steps[0].scheme as any;
    return {
      key: scheme.key,
      name: scheme.name || null,
      description: scheme.description || null,
      summary: scheme.summary || null,
      cq: scheme.cq || [],
      premises: scheme.premises || null,
      conclusion: scheme.conclusion || null,
      purpose: scheme.purpose || null,
      source: scheme.source || null,
      materialRelation: scheme.materialRelation || null,
      reasoningType: scheme.reasoningType || null,
      ruleForm: scheme.ruleForm || null,
      conclusionType: scheme.conclusionType || null,
      whenToUse: scheme.whenToUse || null,
      tags: scheme.tags || [],
    };
  }
  
  return null;
}

/**
 * Parse critical questions from scheme metadata
 */
function parseCriticalQuestions(cq: unknown): string[] {
  if (!cq) return [];
  
  // Handle array of strings
  if (Array.isArray(cq)) {
    return cq.map(q => {
      if (typeof q === "string") return q;
      if (typeof q === "object" && q !== null) {
        // Handle { text: "..." } or { question: "..." } format
        return (q as any).text || (q as any).question || JSON.stringify(q);
      }
      return String(q);
    }).filter(Boolean);
  }
  
  // Handle object format { cq1: "...", cq2: "..." }
  if (typeof cq === "object" && cq !== null) {
    return Object.values(cq as Record<string, any>)
      .map(v => typeof v === "string" ? v : (v as any)?.text || (v as any)?.question)
      .filter(Boolean);
  }
  
  return [];
}

/**
 * Generate introduction phrase based on scheme metadata
 */
function generateSchemeIntroduction(schemeInfo: ExtendedSchemeInfo | null): string {
  if (!schemeInfo) return "The argument asserts";
  
  // Try to get hardcoded template first for standard schemes
  const hardcodedTemplate = getSchemeTemplate(schemeInfo.key || schemeInfo.name || null);
  if (hardcodedTemplate !== SCHEME_TEMPLATES["default"]) {
    return capitalize(hardcodedTemplate.introduction);
  }
  
  // Generate dynamic introduction based on metadata
  const { reasoningType, materialRelation, purpose, conclusionType, name, key } = schemeInfo;
  
  // Map reasoning types to natural language
  if (reasoningType) {
    const reasoningIntros: Record<string, string> = {
      "deductive": "By deductive reasoning",
      "inductive": "Through inductive inference",
      "abductive": "By abductive reasoning (inference to best explanation)",
      "practical": "From a practical standpoint",
      "presumptive": "Through presumptive reasoning",
      "defeasible": "By defeasible inference",
    };
    if (reasoningIntros[reasoningType.toLowerCase()]) {
      return reasoningIntros[reasoningType.toLowerCase()];
    }
  }
  
  // Map material relations to natural language
  if (materialRelation) {
    const relationIntros: Record<string, string> = {
      "cause": "Through causal analysis",
      "effect": "Examining the effects",
      "definition": "By definitional classification",
      "analogy": "By way of analogy",
      "authority": "Drawing upon authoritative testimony",
      "sign": "Based on observable indicators",
      "example": "By way of example",
      "opposition": "Through comparative opposition",
      "classification": "Through classification",
      "rule": "Applying the relevant rule",
    };
    if (relationIntros[materialRelation.toLowerCase()]) {
      return relationIntros[materialRelation.toLowerCase()];
    }
  }
  
  // Map purpose to natural language
  if (purpose) {
    if (purpose.toLowerCase() === "action") {
      return "Considering what action to take";
    }
    if (purpose.toLowerCase().includes("state")) {
      return "Examining the state of affairs";
    }
  }
  
  // Map conclusion type
  if (conclusionType) {
    if (conclusionType.toLowerCase() === "ought") {
      return "Regarding what ought to be done";
    }
  }
  
  // Fall back to using the scheme name itself
  if (name) {
    // Clean up the name for prose
    const cleanName = name
      .replace(/^argument from /i, "")
      .replace(/^argument for /i, "")
      .replace(/_/g, " ")
      .toLowerCase();
    return `Employing ${cleanName} reasoning`;
  }
  
  return "The argument asserts";
}

/**
 * Generate elaboration based on scheme metadata
 * Uses a default formal structure when scheme-specific structure is unavailable:
 * 1. Major Premise, 2. Minor Premise (optional), 3. Conclusion, 4. Warrant description
 */
function generateSchemeElaboration(schemeInfo: ExtendedSchemeInfo | null): string {
  if (!schemeInfo) {
    return "This reasoning connects premises to conclusion through inference, establishing the basis for the claim.";
  }
  
  // Try to get hardcoded template first for standard schemes
  const hardcodedTemplate = getSchemeTemplate(schemeInfo.key || schemeInfo.name || null);
  if (hardcodedTemplate !== SCHEME_TEMPLATES["default"]) {
    return hardcodedTemplate.elaboration;
  }
  
  const parts: string[] = [];
  
  // Use description or summary from scheme
  if (schemeInfo.description) {
    parts.push(schemeInfo.description);
  } else if (schemeInfo.summary) {
    parts.push(schemeInfo.summary);
  }
  
  // Parse and display formal premise structure if available
  const formalStructure = generateFormalStructure(schemeInfo);
  if (formalStructure) {
    parts.push(formalStructure);
  }
  
  // Generate warrant description based on scheme taxonomy
  const warrantDescription = generateWarrantDescription(schemeInfo);
  if (warrantDescription && !parts.some(p => p.includes(warrantDescription))) {
    parts.push(warrantDescription);
  }
  
  // Add reasoning type context only if we don't have better content
  if (parts.length < 2 && schemeInfo.reasoningType) {
    const reasoningExplanations: Record<string, string> = {
      "deductive": "The argument proceeds deductively, where the conclusion follows necessarily from the premises if they are true.",
      "inductive": "The argument proceeds inductively, generalizing from particular observations to broader conclusions.",
      "abductive": "The argument proceeds abductively, inferring the most likely explanation for observed phenomena.",
      "practical": "The argument connects goals to actions, reasoning about what should be done to achieve desired outcomes.",
      "presumptive": "The argument establishes a presumption that holds unless defeated by counterargument.",
      "defeasible": "The argument is defeasible, meaning its conclusion can be retracted in light of new information.",
    };
    if (reasoningExplanations[schemeInfo.reasoningType.toLowerCase()]) {
      parts.push(reasoningExplanations[schemeInfo.reasoningType.toLowerCase()]);
    }
  }
  
  // Add usage guidance if available
  if (schemeInfo.whenToUse) {
    parts.push(`This form of argument is typically used when ${schemeInfo.whenToUse.toLowerCase()}.`);
  }
  
  // If we couldn't generate anything meaningful, use default with warrant info
  if (parts.length === 0) {
    const defaultWithWarrant = generateDefaultElaboration(schemeInfo);
    return defaultWithWarrant;
  }
  
  return parts.join(" ");
}

/**
 * Parse scheme premises from JSON and generate formal structure prose
 */
function generateFormalStructure(schemeInfo: ExtendedSchemeInfo): string | null {
  if (!schemeInfo.premises) return null;
  
  let premisesArray: any[] = [];
  
  // Handle various premise formats from the database
  if (Array.isArray(schemeInfo.premises)) {
    premisesArray = schemeInfo.premises;
  } else if (typeof schemeInfo.premises === "object" && schemeInfo.premises !== null) {
    // Handle object format like { P1: {...}, P2: {...} }
    premisesArray = Object.values(schemeInfo.premises as Record<string, any>);
  }
  
  if (premisesArray.length === 0) return null;
  
  // Categorize premises by type
  const majorPremises: string[] = [];
  const minorPremises: string[] = [];
  const otherPremises: string[] = [];
  
  premisesArray.forEach((premise: any) => {
    const text = premise.text || premise.template || (typeof premise === "string" ? premise : null);
    if (!text) return;
    
    const premiseType = (premise.type || premise.premiseType || "").toLowerCase();
    
    if (premiseType === "major" || premiseType.includes("major")) {
      majorPremises.push(text);
    } else if (premiseType === "minor" || premiseType.includes("minor")) {
      minorPremises.push(text);
    } else {
      otherPremises.push(text);
    }
  });
  
  // If no typed premises, treat first as major and rest as minor/supporting
  if (majorPremises.length === 0 && minorPremises.length === 0 && otherPremises.length > 0) {
    majorPremises.push(otherPremises.shift()!);
    minorPremises.push(...otherPremises);
    otherPremises.length = 0;
  }
  
  const structureParts: string[] = [];
  
  structureParts.push("The formal structure of this argument follows the pattern:");
  
  if (majorPremises.length > 0) {
    majorPremises.forEach((p, i) => {
      const label = majorPremises.length > 1 ? `Major Premise ${i + 1}` : "Major Premise";
      structureParts.push(`${label}: "${p}"`);
    });
  }
  
  if (minorPremises.length > 0) {
    minorPremises.forEach((p, i) => {
      const label = minorPremises.length > 1 ? `Minor Premise ${i + 1}` : "Minor Premise";
      structureParts.push(`${label}: "${p}"`);
    });
  }
  
  // Parse and add conclusion if available
  if (schemeInfo.conclusion) {
    const conclusionText = typeof schemeInfo.conclusion === "string" 
      ? schemeInfo.conclusion 
      : (schemeInfo.conclusion as any).text || (schemeInfo.conclusion as any).template;
    
    if (conclusionText) {
      structureParts.push(`Conclusion: "${conclusionText}"`);
    }
  }
  
  return structureParts.length > 1 ? structureParts.join(" ") : null;
}

/**
 * Generate a description of the warrant (inferential license) based on scheme taxonomy
 */
function generateWarrantDescription(schemeInfo: ExtendedSchemeInfo): string | null {
  const { materialRelation, reasoningType, ruleForm, conclusionType, purpose } = schemeInfo;
  
  // Build warrant description based on taxonomy fields
  const warrantParts: string[] = [];
  
  // Material relation describes the type of connection
  if (materialRelation) {
    const relationWarrants: Record<string, string> = {
      "cause": "The warrant licensing this inference is that effects follow from their causes under normal circumstances.",
      "effect": "The warrant is that observed effects can be traced back to their probable causes.",
      "analogy": "The warrant is that what holds true in a similar case also holds in the present case, absent relevant disanalogies.",
      "definition": "The warrant is that if something satisfies the defining criteria of a category, it belongs to that category.",
      "authority": "The warrant is that testimony from a qualified authority within their domain of expertise is presumptively reliable.",
      "sign": "The warrant is that observable indicators reliably correlate with underlying conditions.",
      "example": "The warrant is that representative instances support generalizations that apply to similar cases.",
      "classification": "The warrant is that membership in a category confers the properties characteristic of that category.",
      "practical": "The warrant is that actions which achieve goals without unacceptable costs should be undertaken.",
      "opposition": "The warrant is that contrasting alternatives help illuminate the relative merits of each option.",
      "rule": "The warrant is that applicable rules transfer properties from conditions to conclusions.",
    };
    
    if (relationWarrants[materialRelation.toLowerCase()]) {
      warrantParts.push(relationWarrants[materialRelation.toLowerCase()]);
    }
  }
  
  // Rule form describes the logical structure of the warrant
  if (ruleForm && warrantParts.length === 0) {
    const ruleFormWarrants: Record<string, string> = {
      "mp": "The warrant has modus ponens form: if the conditional and its antecedent hold, the consequent follows.",
      "defeasible_mp": "The warrant is a defeasible conditional: the conclusion normally follows, but can be defeated by exceptions.",
      "mt": "The warrant has modus tollens form: denying the consequent allows us to deny the antecedent.",
      "disjunctive_syllogism": "The warrant eliminates alternatives: given an either/or, ruling out one option establishes the other.",
    };
    
    if (ruleFormWarrants[ruleForm.toLowerCase()]) {
      warrantParts.push(ruleFormWarrants[ruleForm.toLowerCase()]);
    }
  }
  
  // Conclusion type adds context about what is being established
  if (conclusionType && warrantParts.length > 0) {
    if (conclusionType.toLowerCase() === "ought") {
      warrantParts.push("The conclusion establishes what ought to be done.");
    } else if (conclusionType.toLowerCase() === "is") {
      warrantParts.push("The conclusion establishes a factual state of affairs.");
    }
  }
  
  return warrantParts.length > 0 ? warrantParts.join(" ") : null;
}

/**
 * Generate default elaboration with basic formal structure when no metadata available
 */
function generateDefaultElaboration(schemeInfo: ExtendedSchemeInfo): string {
  const parts: string[] = [];
  
  parts.push("This argument follows a standard inferential pattern connecting premises to conclusion.");
  
  // Try to infer structure from what we know
  if (schemeInfo.reasoningType) {
    const type = schemeInfo.reasoningType.toLowerCase();
    if (type === "deductive") {
      parts.push("The reasoning is deductive: if the premises are true, the conclusion must follow.");
    } else if (type === "inductive") {
      parts.push("The reasoning is inductive: the premises provide probabilistic support for the conclusion.");
    } else if (type === "abductive") {
      parts.push("The reasoning is abductive: the conclusion represents the best explanation for the observed premises.");
    } else if (type === "practical") {
      parts.push("The reasoning is practical: it connects goals and means to reach a normative conclusion about action.");
    }
  }
  
  // Add generic warrant structure description
  const warrantDesc = generateWarrantDescription(schemeInfo);
  if (warrantDesc) {
    parts.push(warrantDesc);
  } else {
    parts.push("The warrant (implicit rule) authorizing the inference from premises to conclusion should be critically examined.");
  }
  
  return parts.join(" ");
}

/**
 * Get critical questions for a scheme
 */
function getSchemeCriticalQuestions(schemeInfo: ExtendedSchemeInfo | null): string[] {
  if (!schemeInfo) return SCHEME_TEMPLATES["default"].criticalQuestions;
  
  // First try to parse from scheme metadata
  const dbCQs = parseCriticalQuestions(schemeInfo.cq);
  if (dbCQs.length > 0) {
    return dbCQs;
  }
  
  // Fall back to hardcoded templates
  const template = getSchemeTemplate(schemeInfo.key || schemeInfo.name || null);
  return template.criticalQuestions;
}

/**
 * Get scheme template by key or name (for hardcoded standard schemes)
 */
function getSchemeTemplate(schemeKeyOrName: string | null): SchemeTemplate {
  if (!schemeKeyOrName) return SCHEME_TEMPLATES["default"];
  
  // First try exact key match
  const key = schemeKeyOrName.toLowerCase().replace(/\s+/g, "_");
  if (SCHEME_TEMPLATES[key]) return SCHEME_TEMPLATES[key];
  
  // Try with "argument_from_" prefix
  const withPrefix = `argument_from_${key}`;
  if (SCHEME_TEMPLATES[withPrefix]) return SCHEME_TEMPLATES[withPrefix];
  
  // Try removing "argument from " prefix and matching
  const withoutPrefix = key.replace(/^argument_from_/, "");
  if (SCHEME_TEMPLATES[withoutPrefix]) return SCHEME_TEMPLATES[withoutPrefix];
  
  // Try partial match (useful for long scheme names)
  for (const templateKey of Object.keys(SCHEME_TEMPLATES)) {
    if (key.includes(templateKey) || templateKey.includes(key)) {
      return SCHEME_TEMPLATES[templateKey];
    }
  }
  
  return SCHEME_TEMPLATES["default"];
}

/**
 * Get argument premise information for richer prose analysis
 */
interface PremiseInfo {
  text: string;
  isImplicit: boolean;
  isAxiom: boolean;
}

function getArgumentPremises(node: ArgumentChainNodeWithArgument): PremiseInfo[] {
  const arg = node.argument as any;
  if (!arg?.premises || !Array.isArray(arg.premises)) return [];
  
  return arg.premises.map((p: any) => ({
    text: p.claim?.text || "",
    isImplicit: p.isImplicit || false,
    isAxiom: p.isAxiom || false,
  })).filter((p: PremiseInfo) => p.text);
}

/**
 * Get implicit warrant if available
 */
function getImplicitWarrant(node: ArgumentChainNodeWithArgument): string | null {
  const arg = node.argument as any;
  if (!arg?.implicitWarrant) return null;
  
  // implicitWarrant could be JSON or string
  if (typeof arg.implicitWarrant === "string") {
    return arg.implicitWarrant;
  }
  if (typeof arg.implicitWarrant === "object" && arg.implicitWarrant !== null) {
    return (arg.implicitWarrant as any).text || (arg.implicitWarrant as any).warrant || null;
  }
  return null;
}

/**
 * Generate premise analysis prose
 */
function generatePremiseAnalysis(premises: PremiseInfo[], implicitWarrant: string | null): string | null {
  if (premises.length === 0 && !implicitWarrant) return null;
  
  const parts: string[] = [];
  
  // Separate explicit and implicit premises
  const explicitPremises = premises.filter(p => !p.isImplicit);
  const implicitPremises = premises.filter(p => p.isImplicit);
  const axiomPremises = premises.filter(p => p.isAxiom);
  
  if (explicitPremises.length > 0) {
    if (explicitPremises.length === 1) {
      parts.push(`The argument rests on the premise: "${explicitPremises[0].text}"`);
    } else {
      const premiseList = explicitPremises.map((p, i) => `(${i + 1}) "${p.text}"`).join("; ");
      parts.push(`The argument is supported by ${explicitPremises.length} explicit premises: ${premiseList}`);
    }
  }
  
  if (implicitPremises.length > 0) {
    const implicitList = implicitPremises.map(p => `"${p.text}"`).join(", ");
    parts.push(`Additionally, the argument relies on implicit premise${implicitPremises.length > 1 ? "s" : ""}: ${implicitList}`);
  }
  
  if (axiomPremises.length > 0) {
    parts.push(`The argument treats ${axiomPremises.length} premise${axiomPremises.length > 1 ? "s" : ""} as axiomatic (not subject to challenge).`);
  }
  
  if (implicitWarrant) {
    parts.push(`The underlying warrant connecting premises to conclusion is: "${implicitWarrant}"`);
  }
  
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Get edge transition phrases
 */
function getEdgeTransition(edgeType: string): { support: string; flow: string } {
  const type = edgeType.toUpperCase();
  return EDGE_TRANSITIONS[type] || EDGE_TRANSITIONS["default"];
}

/**
 * Perform topological sort on chain nodes
 */
function topologicalSort(
  nodes: ArgumentChainNodeWithArgument[],
  edges: ArgumentChainEdgeWithNodes[]
): { sorted: ArgumentChainNodeWithArgument[]; orphans: ArgumentChainNodeWithArgument[] } {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const visited = new Set<string>();
  const sorted: ArgumentChainNodeWithArgument[] = [];
  
  // Initialize
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });
  
  // Build graph
  edges.forEach(e => {
    adjacency.get(e.sourceNodeId)?.push(e.targetNodeId);
    inDegree.set(e.targetNodeId, (inDegree.get(e.targetNodeId) || 0) + 1);
  });
  
  // Find roots
  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });
  
  // BFS
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    
    const node = nodeMap.get(id);
    if (node) sorted.push(node);
    
    adjacency.get(id)?.forEach(targetId => {
      const newDeg = (inDegree.get(targetId) || 1) - 1;
      inDegree.set(targetId, newDeg);
      if (newDeg === 0 && !visited.has(targetId)) {
        queue.push(targetId);
      }
    });
  }
  
  // Find orphans
  const orphans = nodes.filter(n => !visited.has(n.id));
  
  return { sorted, orphans };
}

/**
 * Find edges connected to a node
 */
function findEdgesForNode(
  nodeId: string,
  edges: ArgumentChainEdgeWithNodes[],
  direction: "incoming" | "outgoing"
): ArgumentChainEdgeWithNodes[] {
  if (direction === "incoming") {
    return edges.filter(e => e.targetNodeId === nodeId);
  }
  return edges.filter(e => e.sourceNodeId === nodeId);
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Clean and format text for prose
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/([.!?])\s*$/, "$1");
}

/**
 * Convert number to Roman numeral for section headings
 */
function toRoman(num: number): string {
  const romanNumerals: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let result = "";
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

/**
 * Get human-readable heading for scope type
 */
function getScopeHeading(scopeType: string): string {
  const headings: Record<string, string> = {
    HYPOTHETICAL: "Hypothetical Analysis",
    COUNTERFACTUAL: "Counterfactual Scenario",
    CONDITIONAL: "Conditional Reasoning",
    OPPONENT: "Opposing Perspective",
    MODAL: "Modal Analysis"
  };
  return headings[scopeType] || "Scoped Analysis";
}

/**
 * Generate prose for a single argument (refactored for reuse)
 */
function generateArgumentProse(
  node: ArgumentChainNodeWithArgument,
  argNumber: string,
  style: string,
  includeEpistemicLanguage: boolean,
  includeCriticalQuestions: boolean,
  nodeById: Map<string, ArgumentChainNodeWithArgument>,
  edges: any[]
): string {
  const argText = getArgumentText(node);
  const schemeInfo = getSchemeInfo(node);
  
  // Phase 4: Get epistemic status
  const epistemicStatus = (node as any).epistemicStatus as string | null;
  
  // Get intra-argument structure
  const premises = getArgumentPremises(node);
  const implicitWarrant = getImplicitWarrant(node);
  
  // Find incoming edges (what supports/attacks this argument)
  const incomingEdges = findEdgesForNode(node.id, edges, "incoming");
  
  // Build argument paragraph
  const paragraphs: string[] = [];
  
  // Opening with scheme introduction - use dynamic generation based on metadata
  const introduction = generateSchemeIntroduction(schemeInfo);
  
  // Phase 4: Apply epistemic language if enabled
  let formattedArgText = cleanText(argText);
  if (includeEpistemicLanguage && epistemicStatus && epistemicStatus !== "ASSERTED") {
    const prefix = getEpistemicPrefix(epistemicStatus);
    const suffix = getEpistemicSuffix(epistemicStatus);
    // For prefix-style statuses, integrate with the text
    if (prefix) {
      formattedArgText = `${prefix}${formattedArgText.charAt(0).toLowerCase()}${formattedArgText.slice(1)}`;
    }
    if (suffix) {
      formattedArgText = `${formattedArgText}${suffix}`;
    }
  }
  
  const opening = `${argNumber}${introduction}: "${formattedArgText}"`;
  paragraphs.push(opening);
  
  // Scheme elaboration (for detailed style) - use database metadata
  if (style === "legal_brief" || style === "academic") {
    const elaboration = generateSchemeElaboration(schemeInfo);
    paragraphs.push(elaboration);
    
    // Add scheme name context for custom schemes
    if (schemeInfo?.name && !SCHEME_TEMPLATES[schemeInfo.key?.toLowerCase().replace(/\s+/g, "_") || ""]) {
      paragraphs.push(`This reasoning employs the "${schemeInfo.name}" argumentation scheme.`);
    }
    
    // Add intra-argument structure analysis (premises, warrants)
    const premiseAnalysis = generatePremiseAnalysis(premises, implicitWarrant);
    if (premiseAnalysis) {
      paragraphs.push(premiseAnalysis);
    }
  }
  
  // Describe incoming connections (what leads to this argument)
  if (incomingEdges.length > 0) {
    const connectionDescriptions = incomingEdges.map(edge => {
      const sourceNode = nodeById.get(edge.sourceNodeId);
      const sourceText = sourceNode ? getArgumentText(sourceNode) : "a prior argument";
      const transition = getEdgeTransition(edge.edgeType);
      const snippet = sourceText.length > 100 ? sourceText.slice(0, 100) + "..." : sourceText;
      
      // Phase 4: Add epistemic context phrase if source has non-ASSERTED status
      const sourceEpistemicStatus = (sourceNode as any)?.epistemicStatus as string | null;
      const contextPhrase = includeEpistemicLanguage ? getEpistemicContextPhrase(sourceEpistemicStatus) : "";
      
      return `${transition.support}, we note that this follows from: ${contextPhrase}"${snippet}"`;
    });
    paragraphs.push(connectionDescriptions.join(" Additionally, "));
  }
  
  // Critical questions (if enabled) - use database CQs for custom schemes
  if (includeCriticalQuestions) {
    const criticalQuestions = getSchemeCriticalQuestions(schemeInfo);
    if (criticalQuestions.length > 0) {
      const cqIntro = "This form of argument invites scrutiny of the following questions:";
      const cqList = criticalQuestions.map(cq => `• ${cq}`).join("\n");
      paragraphs.push(`${cqIntro}\n${cqList}`);
    }
  }
  
  return paragraphs.join("\n\n");
}

// ===== Main Generator Function =====

/**
 * Generate legal brief-style prose from an argument chain
 */
export function generateProse(
  chain: ArgumentChainWithRelations,
  options: ProseOptions = {}
): ProseResult {
  const {
    style = "legal_brief",
    includeSections = true,
    includeNumbering = true,
    includeCriticalQuestions = false,
    includeMetadata = true,
    includeChainTypeDescription = true,
    includeEpistemicLanguage = true,
    groupByScope = true,
    adjustFlowForChainType = true,
  } = options;
  
  const nodes = chain.nodes || [];
  const edges = chain.edges || [];
  const scopes = (chain as any).scopes || [];
  const chainType = (chain as any).chainType || "GRAPH";
  
  const sections: ProseSection[] = [];
  
  // Build node lookup for edge references
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  
  // Phase C: Group nodes by scope
  const { unscopedNodes, scopedGroups } = groupByScope 
    ? groupNodesByScope(nodes, scopes)
    : { unscopedNodes: nodes, scopedGroups: [] };
  
  // Phase C: Apply chain type flow structure to unscoped nodes
  const { structuredNodes, flowDescription } = adjustFlowForChainType
    ? generateChainTypeFlow(chainType, unscopedNodes, edges, nodeById)
    : { structuredNodes: [unscopedNodes], flowDescription: "" };
  
  // For simple topological sort fallback
  const { sorted, orphans } = topologicalSort(nodes, edges);
  
  // ===== Introduction Section =====
  if (includeSections) {
    let introContent = generateIntroduction(chain, sorted.length, edges.length, style, includeChainTypeDescription);
    
    // Phase C: Add flow description if chain type adjustment is enabled
    if (adjustFlowForChainType && flowDescription) {
      introContent += `\n\n${flowDescription}`;
    }
    
    // Phase C: Mention scopes if present
    if (groupByScope && scopedGroups.length > 0) {
      const scopeTypes = scopedGroups.map(s => s.scopeType.toLowerCase()).join(", ");
      introContent += `\n\nThe analysis includes ${scopedGroups.length} specialized scope${scopedGroups.length > 1 ? "s" : ""} (${scopeTypes}) that examine the arguments under specific assumptions or perspectives.`;
    }
    
    sections.push({
      id: "introduction",
      heading: "I. Introduction",
      content: introContent,
      type: "introduction"
    });
  }
  
  // ===== Main Arguments Section (Unscoped) =====
  const argumentsContent: string[] = [];
  let sectionNumber = 2; // Track section numbering
  
  // Phase C: Process structured node groups for chain type flow
  if (adjustFlowForChainType && structuredNodes.length > 0) {
    structuredNodes.forEach((nodeGroup, groupIndex) => {
      // Add group separator for multi-group structures (convergent, divergent, tree)
      if (structuredNodes.length > 1 && groupIndex > 0) {
        const groupLabels: Record<string, string[]> = {
          CONVERGENT: ["Supporting Arguments", "Central Thesis", "Additional Considerations"],
          DIVERGENT: ["Foundational Premise", "Derived Implications", "Extended Analysis"],
          TREE: [`Level ${groupIndex + 1}`, `Level ${groupIndex + 1}`, `Level ${groupIndex + 1}`],
          SERIAL: ["Sequential Arguments"],
          GRAPH: ["Connected Arguments", "Related Arguments"]
        };
        const labels = groupLabels[chainType] || groupLabels.GRAPH;
        const label = labels[Math.min(groupIndex, labels.length - 1)];
        argumentsContent.push(`\n### ${label}\n`);
      }
      
      nodeGroup.forEach((node, index) => {
        const argNumber = includeNumbering ? `${groupIndex + 1}.${index + 1}. ` : "";
        const argProse = generateArgumentProse(
          node, 
          argNumber, 
          style, 
          includeEpistemicLanguage, 
          includeCriticalQuestions,
          nodeById,
          edges
        );
        argumentsContent.push(argProse);
      });
    });
  } else {
    // Fallback: Original linear processing
    sorted.forEach((node, index) => {
      // Skip scoped nodes if grouping by scope
      if (groupByScope && (node as any).scopeId) return;
      
      const argNumber = includeNumbering ? `${index + 1}. ` : "";
      const argProse = generateArgumentProse(
        node,
        argNumber,
        style,
        includeEpistemicLanguage,
        includeCriticalQuestions,
        nodeById,
        edges
      );
      argumentsContent.push(argProse);
    });
  }
  
  if (argumentsContent.length > 0) {
    sections.push({
      id: "arguments",
      heading: "II. Analysis of Arguments",
      content: argumentsContent.join("\n\n---\n\n"),
      type: "argument"
    });
    sectionNumber++;
  }
  
  // ===== Phase C: Scope Sections =====
  if (groupByScope && scopedGroups.length > 0) {
    scopedGroups.forEach((scope, scopeIndex) => {
      const scopeSection = generateScopeSection(
        scope,
        `${sectionNumber}`,
        style,
        includeNumbering,
        includeCriticalQuestions,
        includeEpistemicLanguage,
        nodeById,
        edges,
        0
      );
      
      sections.push({
        id: scopeSection.id,
        heading: `${toRoman(sectionNumber)}. ${getScopeHeading(scope.scopeType)}: "${scope.assumption}"`,
        content: scopeSection.content,
        type: "analysis"
      });
      sectionNumber++;
    });
  }
  
  // ===== Chain Flow Section =====
  if (edges.length > 0 && !adjustFlowForChainType) {
    // Only show separate flow section if not already integrated via chain type adjustment
    const flowContent = generateChainFlow(sorted, edges, nodeById);
    sections.push({
      id: "flow",
      heading: `${toRoman(sectionNumber)}. Logical Structure`,
      content: flowContent,
      type: "transition"
    });
    sectionNumber++;
  }
  
  // ===== Orphan Arguments (if any) =====
  if (orphans.length > 0) {
    const orphanContent = orphans.map((node, i) => {
      const text = getArgumentText(node);
      return `${i + 1}. "${cleanText(text)}" (Not connected to main chain)`;
    }).join("\n\n");
    
    sections.push({
      id: "orphans",
      heading: `${toRoman(sectionNumber)}. Additional Considerations`,
      content: `The following arguments exist within this chain but are not directly connected to the main line of reasoning:\n\n${orphanContent}`,
      type: "analysis"
    });
    sectionNumber++;
  }
  
  // ===== Conclusion Section =====
  if (includeSections && sorted.length > 0) {
    const conclusionContent = generateConclusion(chain, sorted, edges, style);
    sections.push({
      id: "conclusion",
      heading: `${toRoman(sectionNumber)}. Conclusion`,
      content: conclusionContent,
      type: "conclusion"
    });
  }
  
  // ===== Compile Full Text =====
  const fullText = sections.map(s => {
    if (includeSections) {
      return `${s.heading}\n\n${s.content}`;
    }
    return s.content;
  }).join("\n\n");
  
  return {
    title: chain.name || "Argument Chain Analysis",
    sections,
    fullText,
    metadata: {
      chainId: chain.id,
      chainName: chain.name || "Untitled",
      argumentCount: sorted.length + orphans.length,
      connectionCount: edges.length,
      generatedAt: new Date().toISOString()
    }
  };
}

// ===== Section Generators =====

function generateIntroduction(
  chain: ArgumentChainWithRelations,
  nodeCount: number,
  edgeCount: number,
  style: string,
  includeChainTypeDescription: boolean = true
): string {
  const name = chain.name || "This argument chain";
  const description = chain.description || "";
  const purpose = chain.purpose || "";
  const chainType = (chain as any).chainType || "GRAPH";
  
  let intro = "";
  
  // Get chain type description
  const typeInfo = CHAIN_TYPE_DESCRIPTIONS[chainType] || CHAIN_TYPE_DESCRIPTIONS.GRAPH;
  
  if (style === "legal_brief") {
    intro = `${name} presents a structured analysis comprising ${nodeCount} argument${nodeCount !== 1 ? "s" : ""} connected through ${edgeCount} logical relationship${edgeCount !== 1 ? "s" : ""}.`;
    
    // Add chain type description (Phase 4)
    if (includeChainTypeDescription && typeInfo) {
      intro += ` ${typeInfo.intro}. ${typeInfo.structure}`;
    }
    
    if (description) {
      intro += `\n\n${description}`;
    }
    
    if (purpose) {
      intro += `\n\nThe purpose of this analysis is: ${purpose}`;
    }
    
    intro += `\n\nThe arguments are presented below in logical order, as the reasoning ${typeInfo.flowHint}.`;
  } else if (style === "academic") {
    intro = `This document analyzes ${name}, a chain of ${nodeCount} interconnected arguments.`;
    
    // Add chain type description (Phase 4)
    if (includeChainTypeDescription && typeInfo) {
      intro += ` ${typeInfo.intro}. ${typeInfo.structure}`;
    }
    
    intro += ` ${description ? description + " " : ""}The analysis proceeds by examining each argument in turn, elucidating its structure and relationship to other arguments in the chain.`;
  } else {
    intro = `${name} contains ${nodeCount} arguments and ${edgeCount} connections.`;
    
    // Add chain type description even in summary mode (Phase 4)
    if (includeChainTypeDescription && typeInfo) {
      intro += ` ${typeInfo.intro}.`;
    }
    
    if (description) {
      intro += ` ${description}`;
    }
  }
  
  return intro;
}

function generateChainFlow(
  sortedNodes: ArgumentChainNodeWithArgument[],
  edges: ArgumentChainEdgeWithNodes[],
  nodeById: Map<string, ArgumentChainNodeWithArgument>
): string {
  if (sortedNodes.length === 0) return "No logical flow established.";
  
  const flowParts: string[] = [];
  
  // Describe the overall structure
  const roots = sortedNodes.filter(n => {
    const incoming = edges.filter(e => e.targetNodeId === n.id);
    return incoming.length === 0;
  });
  
  const leaves = sortedNodes.filter(n => {
    const outgoing = edges.filter(e => e.sourceNodeId === n.id);
    return outgoing.length === 0;
  });
  
  flowParts.push(`The chain of reasoning proceeds from ${roots.length} foundational argument${roots.length !== 1 ? "s" : ""} toward ${leaves.length} conclusion${leaves.length !== 1 ? "s" : ""}.`);
  
  // Categorize edges by type for detailed analysis
  const supportEdges = edges.filter(e => 
    e.edgeType.toUpperCase().includes("SUPPORT")
  );
  const rebuttingEdges = edges.filter(e => 
    e.edgeType.toUpperCase().includes("REBUT")
  );
  const undercuttingEdges = edges.filter(e => 
    e.edgeType.toUpperCase().includes("UNDERCUT")
  );
  const attackEdges = edges.filter(e => 
    e.edgeType.toUpperCase().includes("ATTACK") && 
    !e.edgeType.toUpperCase().includes("REBUT") &&
    !e.edgeType.toUpperCase().includes("UNDERCUT")
  );
  const sequenceEdges = edges.filter(e => 
    e.edgeType.toUpperCase().includes("SEQUENCE") ||
    e.edgeType.toUpperCase().includes("ELABORATION")
  );
  
  // Describe relationship types present
  if (supportEdges.length > 0) {
    flowParts.push(`There are ${supportEdges.length} supporting relationship${supportEdges.length !== 1 ? "s" : ""} where arguments build upon or reinforce one another.`);
  }
  
  if (rebuttingEdges.length > 0) {
    flowParts.push(`The chain includes ${rebuttingEdges.length} rebuttal${rebuttingEdges.length !== 1 ? "s" : ""}, where arguments directly challenge the conclusions of others.`);
  }
  
  if (undercuttingEdges.length > 0) {
    flowParts.push(`There are ${undercuttingEdges.length} undercutting attack${undercuttingEdges.length !== 1 ? "s" : ""}, which challenge the inferential connection between premises and conclusions rather than the conclusions themselves.`);
  }
  
  if (attackEdges.length > 0) {
    flowParts.push(`The chain also contains ${attackEdges.length} general attack${attackEdges.length !== 1 ? "s" : ""} where arguments challenge or undermine others.`);
  }
  
  if (sequenceEdges.length > 0) {
    flowParts.push(`Additionally, ${sequenceEdges.length} sequential or elaborative connection${sequenceEdges.length !== 1 ? "s" : ""} link arguments in a narrative progression.`);
  }
  
  // Describe dialectical structure if there are opposing relationships
  const totalAttacks = rebuttingEdges.length + undercuttingEdges.length + attackEdges.length;
  if (totalAttacks > 0 && supportEdges.length > 0) {
    flowParts.push(`\nThe dialectical structure reveals a debate with both constructive support (${supportEdges.length} relationships) and critical opposition (${totalAttacks} attacks).`);
  }
  
  // Narrative flow description with argument numbers for clarity
  flowParts.push("\nThe logical progression unfolds as follows:");
  
  sortedNodes.forEach((node, index) => {
    const argNum = index + 1;
    const text = getArgumentText(node);
    const snippet = text.length > 80 ? text.slice(0, 80) + "..." : text;
    const incoming = edges.filter(e => e.targetNodeId === node.id);
    
    if (index === 0) {
      flowParts.push(`\n[Argument ${argNum}] The analysis begins with: "${snippet}"`);
    } else if (incoming.length > 0) {
      const edge = incoming[0];
      const transition = getEdgeTransition(edge.edgeType);
      flowParts.push(`\n[Argument ${argNum}] ${transition.flow}, the chain addresses: "${snippet}"`);
    } else {
      flowParts.push(`\n[Argument ${argNum}] Additionally, the chain considers: "${snippet}"`);
    }
  });
  
  return flowParts.join(" ");
}

function generateConclusion(
  chain: ArgumentChainWithRelations,
  sortedNodes: ArgumentChainNodeWithArgument[],
  edges: ArgumentChainEdgeWithNodes[],
  style: string
): string {
  // Find terminal nodes (leaves)
  const leaves = sortedNodes.filter(n => {
    const outgoing = edges.filter(e => e.sourceNodeId === n.id);
    return outgoing.length === 0;
  });
  
  // Find root nodes for summary
  const roots = sortedNodes.filter(n => {
    const incoming = edges.filter(e => e.targetNodeId === n.id);
    return incoming.length === 0;
  });
  
  // Count attack types for dialectical summary
  const totalAttacks = edges.filter(e => 
    e.edgeType.toUpperCase().includes("ATTACK") || 
    e.edgeType.toUpperCase().includes("REBUT") ||
    e.edgeType.toUpperCase().includes("UNDERCUT")
  ).length;
  
  let conclusion = "";
  
  if (style === "legal_brief") {
    conclusion = "In summary, this chain of argumentation ";
    
    if (leaves.length === 1) {
      const leafText = getArgumentText(leaves[0]);
      const snippet = leafText.length > 150 ? leafText.slice(0, 150) + "..." : leafText;
      conclusion += `ultimately supports the conclusion that: "${snippet}"`;
    } else if (leaves.length > 1) {
      conclusion += `reaches ${leaves.length} conclusions:\n\n`;
      leaves.forEach((leaf, i) => {
        const text = getArgumentText(leaf);
        const snippet = text.length > 100 ? text.slice(0, 100) + "..." : text;
        conclusion += `${i + 1}. "${snippet}"\n`;
      });
    } else {
      conclusion += "establishes the reasoning presented above.";
    }
    
    conclusion += "\n\nThe strength of these conclusions depends upon the soundness of the underlying premises and the validity of the inferential steps connecting them.";
    
    // Add dialectical assessment
    if (totalAttacks > 0) {
      conclusion += ` The presence of ${totalAttacks} critical challenge${totalAttacks !== 1 ? "s" : ""} indicates points of contention that may affect the overall persuasiveness of the argument chain.`;
    }
    
    // Add provenance note if multiple roots
    if (roots.length > 1) {
      conclusion += ` The chain draws from ${roots.length} independent starting points, which may represent different lines of reasoning or sources of evidence.`;
    }
  } else if (style === "academic") {
    conclusion = `This analysis has examined ${sortedNodes.length} arguments and their interconnections. `;
    
    if (leaves.length > 0) {
      conclusion += `The chain culminates in ${leaves.length} final conclusion${leaves.length !== 1 ? "s" : ""}.`;
    }
    
    if (totalAttacks > 0) {
      conclusion += ` The dialectical structure includes ${totalAttacks} oppositional relationship${totalAttacks !== 1 ? "s" : ""}, reflecting scholarly debate on the topic.`;
    }
    
    conclusion += " Further investigation of the critical questions associated with each scheme would strengthen this analysis.";
  } else {
    conclusion = `This analysis has examined ${sortedNodes.length} arguments and their interconnections. `;
    if (leaves.length > 0) {
      conclusion += `The chain culminates in ${leaves.length} final conclusion${leaves.length !== 1 ? "s" : ""}.`;
    }
  }
  
  return conclusion;
}

// ===== Export Utility =====

/**
 * Generate prose and return as plain text
 */
export function generateProseText(
  chain: ArgumentChainWithRelations,
  options?: ProseOptions
): string {
  const result = generateProse(chain, options);
  return result.fullText;
}

/**
 * Generate prose and return as HTML (for rich rendering)
 */
export function generateProseHtml(
  chain: ArgumentChainWithRelations,
  options?: ProseOptions
): string {
  const result = generateProse(chain, {
    ...options,
    includeSections: true
  });
  
  const sections = result.sections.map(s => {
    const content = s.content
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>")
      .replace(/---/g, "<hr/>");
    
    return `
      <section class="prose-section prose-${s.type}">
        <h2>${s.heading}</h2>
        <p>${content}</p>
      </section>
    `;
  }).join("\n");
  
  return `
    <article class="argument-chain-prose">
      <h1>${result.title}</h1>
      ${sections}
      <footer>
        <small>Generated ${new Date(result.metadata.generatedAt).toLocaleString()}</small>
      </footer>
    </article>
  `;
}
