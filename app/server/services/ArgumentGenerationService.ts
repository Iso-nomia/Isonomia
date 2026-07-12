/**
 * ArgumentGenerationService
 * 
 * Core backend service for intelligent argument generation and assistance.
 * Transforms Mesh from reactive analysis to proactive construction platform.
 * 
 * Phase 3.1: Backend Services (Week 9)
 * Implements:
 * - Attack suggestion via critical question analysis
 * - Support suggestion via scheme/evidence matching
 * - Argument template generation
 * - Confidence scoring for partial arguments
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prismaclient";
import type {
  ArgumentScheme,
  CriticalQuestion as PrismaCriticalQuestion,
  Argument,
  ArgumentSchemeInstance,
  Claim,
  BurdenOfProof,
} from "@prisma/client";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Enhanced CriticalQuestion type with argumentation-specific fields
 * Extends Prisma type with runtime data structures
 */
export type CriticalQuestion = Omit<PrismaCriticalQuestion, "burdenOfProof"> & {
  question?: string;
  attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope?: "conclusion" | "inference" | "premise";
  burdenOfProof?: BurdenOfProof | "proponent" | "challenger";
  requiresEvidence?: boolean;
  evidenceTypes?: string[];
  exampleAttacks?: string[];
  commonResponses?: string[];
};

/**
 * Attack suggestion generated from critical question analysis
 */
export type AttackSuggestion = {
  id: string;
  cq: CriticalQuestion;
  targetSchemeInstance: ArgumentSchemeInstance;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "conclusion" | "inference" | "premise";
  
  // Burden & Evidence (from Phase 0)
  burdenOfProof: "proponent" | "challenger";
  requiresEvidence: boolean;
  evidenceTypes: string[];
  
  // Guidance
  template: ArgumentTemplate;
  exampleAttacks: string[];
  commonResponses: string[];
  
  // Scoring
  strengthScore: number; // 0-100
  difficultyScore: number; // 0-100 (lower = easier for user)
  strategicValue: number; // 0-100 (impact on deliberation)
  
  // Justification
  reasoning: string;
};

/**
 * Support suggestion generated from scheme/evidence matching
 */
export type SupportSuggestion = {
  id: string;
  scheme: ArgumentScheme;
  template: ArgumentTemplate;
  premiseMatches: PremiseMatch[];
  missingPremises: string[];
  confidence: number;
  exampleArguments: string[];
  completionSteps: string[];
  strengthScore: number;
  difficultyScore: number;
  strategicValue: number;
  reasoning: string;
};

/**
 * Structured argument template for construction
 */
export type ArgumentTemplate = {
  schemeId: string;
  schemeName: string;
  
  // Structure
  premises: PremiseTemplate[];
  conclusion: string;
  variables: Record<string, string>; // Variable → description
  
  // Pre-filled content
  prefilledPremises: Record<string, string>; // Premise key → content
  prefilledVariables: Record<string, string>; // Variable → value
  
  // Guidance
  constructionSteps: string[];
  evidenceRequirements: string[];
  
  // Formal Structure (Walton-style)
  formalStructure?: {
    majorPremise?: string;
    minorPremise?: string;
    conclusion?: string;
  };
  
  // Scheme Metadata (from admin page integration)
  schemeMetadata?: {
    materialRelation?: string;
    reasoningType?: string;
    clusterTag?: string;
    purpose?: string;
    source?: string;
    slotHints?: Record<string, string>; // Premise key → role hint
    premisesWithVariables?: Array<{
      id: string;
      type: "major" | "minor" | "general";
      text: string;
      variables: string[];
    }>;
  };
};

/**
 * Template for a single premise
 */
export type PremiseTemplate = {
  key: string;
  content: string; // With variables like {agent}, {action}
  required: boolean;
  type: "ordinary" | "assumption" | "exception";
  evidenceType?: string;
};

/**
 * Matched evidence to premise
 */
export type PremiseMatch = {
  premise: PremiseTemplate;
  matchedEvidence: string;
  confidence: number;
  suggestedContent?: string; // Suggestion when no match found
};

/**
 * Scheme premise structure (lightweight parsing)
 */
export type SchemePremise = {
  key: string;
  content: string;
  type: "ordinary" | "assumption" | "exception";
  required?: boolean;
};

// Extended types for internal use
type ArgumentWithSchemes = Argument & {
  claim: any;
  conclusion?: any; // New relation using conclusionClaimId
  argumentSchemes?: any[];
};

type ArgumentSchemeInstanceWithScheme = ArgumentSchemeInstance & {
  scheme: ArgumentScheme;
};

type ClaimWithTopic = {
  id: string;
  text: string;
  topic?: { name: string } | null;
};

// ============================================================================
// ArgumentGenerationService Class
// ============================================================================

export class ArgumentGenerationService {
  /**
   * Generate attack suggestions for a target argument or claim
   * 
   * Analyzes the target's scheme instances and generates CQ-based attacks
   * ranked by strategic value, strength, and difficulty.
   */
  async suggestAttacks(params: {
    targetClaimId: string;
    targetArgumentId?: string;
    userId: string;
    context?: {
      deliberationId?: string;
      existingArguments?: string[]; // Already made these attacks
    };
  }): Promise<AttackSuggestion[]> {
    const { targetClaimId, targetArgumentId, userId, context } = params;

    // 1. Get target argument (if specific) or all arguments for claim
    const targetArguments = targetArgumentId
      ? [await this.getArgumentWithSchemes(targetArgumentId)]
      : await this.getClaimArguments(targetClaimId);

    if (targetArguments.length === 0) {
      // No structured arguments yet - suggest general rebuttal
      return this.suggestGeneralRebuttal(targetClaimId);
    }

    // 2. For each argument, identify schemes and generate CQ-based attacks
    const allSuggestions: AttackSuggestion[] = [];

    for (const argument of targetArguments) {
      const schemes = await this.getArgumentSchemes(argument.id);

      for (const schemeInstance of schemes) {
        const cqAttacks = await this.generateCQAttacks(
          argument,
          schemeInstance,
          context
        );
        allSuggestions.push(...cqAttacks);
      }
    }

    // 3. Filter out attacks user already made
    const filtered = context?.existingArguments
      ? allSuggestions.filter(s => !this.isCQAttackMade(s.cq.id, context.existingArguments!))
      : allSuggestions;

    // 4. Score and rank suggestions
    const scored = await this.scoreAttackSuggestions(filtered, userId);

    // 5. Return top suggestions (limit to 10)
    return scored
      .sort((a, b) => b.strategicValue - a.strategicValue)
      .slice(0, 10);
  }

  /**
   * Generate support suggestions for a claim
   * 
   * Identifies applicable schemes and matches available evidence to premises.
   */
  async suggestSupport(params: {
    claimId: string;
    userId: string;
    availableEvidence?: string[]; // User-provided evidence
    context?: {
      deliberationId?: string;
      existingArguments?: string[];
    };
  }): Promise<SupportSuggestion[]> {
    const { claimId, userId, availableEvidence = [], context } = params;

    // 1. Get claim details
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) throw new Error("Claim not found");

    // 2. Determine applicable schemes based on claim type
    const applicableSchemes = await this.getApplicableSchemes(claim as ClaimWithTopic);

    // 3. For each scheme, try to match evidence to premises
    const suggestions: SupportSuggestion[] = [];

    for (const scheme of applicableSchemes) {
      const match = await this.matchEvidenceToScheme(
        scheme,
        claim,
        availableEvidence
      );

      if (match.confidence > 0.3) {
        // Only include if reasonable match
        suggestions.push(match);
      }
    }

    // 4. Score and rank
    const scored = await this.scoreSupportSuggestions(suggestions, userId);

    // 5. Return top suggestions
    return scored
      .sort((a, b) => b.strengthScore - a.strengthScore)
      .slice(0, 10);
  }

  /**
   * Generate argument template from scheme
   * 
   * Creates a structured skeleton for argument construction with
   * prefilled data and step-by-step guidance.
   */
  async generateTemplate(params: {
    schemeId: string;
    claimId?: string; // Optional - undefined for general mode
    attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
    targetCQ?: string; // If attacking via specific CQ
    prefilledData?: Record<string, string>;
  }): Promise<ArgumentTemplate> {
    const { schemeId, claimId, attackType, targetCQ, prefilledData } = params;

    // 1. Get scheme with formal structure
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      include: {
        cqs: true,
      },
    });

    if (!scheme) throw new Error("Scheme not found");

    // 2. Get claim (optional - for attack/support modes)
    let claim = null;
    if (claimId) {
      claim = await prisma.claim.findUnique({
        where: { id: claimId },
      });

      if (!claim) throw new Error("Claim not found");
    }

    // 3. Build premise templates
    const premises = this.buildPremiseTemplates(scheme, prefilledData);

    // 4. Determine conclusion based on mode
    let conclusion: string;
    if (attackType && claim) {
      // Attack mode: conclusion attacks the claim
      conclusion = this.buildAttackConclusion(claim, attackType, targetCQ);
    } else if (claim) {
      // Support mode: conclusion is the claim itself
      conclusion = claim.text;
    } else {
      // General mode: build conclusion from scheme structure
      conclusion = this.buildGeneralConclusion(scheme);
    }

    // 5. Extract variables and prefill what we can
    const variables = this.extractVariables(scheme);
    const prefilledVariables = claim 
      ? this.prefillVariables(variables, claim, prefilledData)
      : {};

    // 6. Generate construction guidance
    const constructionSteps = this.generateConstructionSteps(scheme, attackType);
    const evidenceRequirements = this.determineEvidenceRequirements(premises);

    // 7. Extract formal structure (if available)
    const formalStructure = this.extractFormalStructure(scheme);

    // 8. Build scheme metadata for UI enhancements
    const schemeMetadata = this.buildSchemeMetadata(scheme);

    return {
      schemeId: scheme.id,
      schemeName: scheme.name || scheme.key,
      premises,
      conclusion,
      variables,
      prefilledPremises: prefilledData || {},
      prefilledVariables,
      constructionSteps,
      evidenceRequirements,
      formalStructure,
      schemeMetadata,
    };
  }

  /**
   * Estimate confidence/strength of a partially constructed argument
   * 
   * Provides real-time feedback as users build arguments.
   */
  async scoreArgument(params: {
    schemeId: string;
    filledPremises: Record<string, string>; // Premise key → user content
    claimId: string;
  }): Promise<{
    overallScore: number; // 0-100
    premiseScores: Record<string, number>;
    missingElements: string[];
    suggestions: string[];
  }> {
    const { schemeId, filledPremises, claimId } = params;

    // Implementation in Step 3.1.5
    return this.computeArgumentScore(schemeId, filledPremises, claimId);
  }

  // ============================================================================
  // Private Helper Methods (implemented in following steps)
  // ============================================================================

  private async getArgumentWithSchemes(argumentId: string): Promise<ArgumentWithSchemes> {
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      include: {
        conclusion: true, // Use conclusion relation (conclusionClaimId)
        claim: true,      // Keep old claim relation for backwards compatibility
        argumentSchemes: {
          include: {
            scheme: {
              include: {
                cqs: true,
              },
            },
          },
        },
      },
    });

    if (!argument) throw new Error("Argument not found");
    return argument as any as ArgumentWithSchemes;
  }

  private async getClaimArguments(claimId: string): Promise<ArgumentWithSchemes[]> {
    const args = await prisma.argument.findMany({
      where: { claimId },
      include: {
        claim: true,
        argumentSchemes: {
          include: {
            scheme: {
              include: {
                cqs: true,
              },
            },
          },
        },
      },
    });

    return args as any as ArgumentWithSchemes[];
  }

  private async getArgumentSchemes(argumentId: string): Promise<ArgumentSchemeInstanceWithScheme[]> {
    const instances = await prisma.argumentSchemeInstance.findMany({
      where: { argumentId },
      include: {
        scheme: {
          include: {
            cqs: true,
          },
        },
      },
    });

    return instances as any as ArgumentSchemeInstanceWithScheme[];
  }

  // ============================================================================
  // Helper Utilities
  // ============================================================================

  /**
   * Normalize burdenOfProof comparison (handle both enum and lowercase string)
   */
  private isProponentBurden(burden?: BurdenOfProof | "proponent" | "challenger"): boolean {
    return burden === "PROPONENT" || burden === "proponent";
  }

  private isChallengerBurden(burden?: BurdenOfProof | "proponent" | "challenger"): boolean {
    return burden === "CHALLENGER" || burden === "challenger";
  }

  // ============================================================================
  // Attack Generation Implementation (Step 3.1.2)
  // ============================================================================

  /**
   * Generate general rebuttal suggestions when no schemes identified
   */
  private async suggestGeneralRebuttal(claimId: string): Promise<AttackSuggestion[]> {
    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
    });

    if (!claim) return [];

    // Create a basic rebuttal suggestion
    const rebuttalTemplate: ArgumentTemplate = {
      schemeId: "general-rebuttal",
      schemeName: "General Rebuttal",
      premises: [
        {
          key: "P1",
          content: "The claim '{claim}' is false/incorrect",
          required: true,
          type: "ordinary",
          evidenceType: "counter-evidence",
        },
        {
          key: "P2",
          content: "Evidence shows {counter_claim}",
          required: true,
          type: "ordinary",
          evidenceType: "empirical-data",
        },
      ],
      conclusion: `Therefore, "${claim.text}" should be rejected`,
      variables: {
        claim: "The original claim being disputed",
        counter_claim: "Your opposing evidence or position",
      },
      prefilledPremises: {},
      prefilledVariables: { claim: claim.text },
      constructionSteps: [
        "1. Identify what aspect of the claim is incorrect",
        "2. Gather evidence that contradicts the claim",
        "3. State your counter-position clearly",
        "4. Explain why the evidence supports rejection of the claim",
      ],
      evidenceRequirements: [
        "Counter-evidence: Data, facts, or expert opinion contradicting the claim",
        "Alternative explanation: Better account of the situation",
      ],
    };

    return [
      {
        id: `general-rebuttal-${claimId}`,
        cq: {
          id: "general-cq",
          question: "Is this claim adequately supported?",
          attackType: "REBUTS",
          targetScope: "conclusion",
          burdenOfProof: "proponent",
          requiresEvidence: false,
        } as CriticalQuestion,
        targetSchemeInstance: {} as ArgumentSchemeInstance,
        attackType: "REBUTS",
        targetScope: "conclusion",
        burdenOfProof: "proponent",
        requiresEvidence: false,
        evidenceTypes: [],
        template: rebuttalTemplate,
        exampleAttacks: [
          `"The claim is unsupported by credible evidence."`,
          `"The reasoning contains logical flaws."`,
          `"Alternative explanations better account for the facts."`,
        ],
        commonResponses: [
          "Proponent provides additional evidence",
          "Proponent clarifies the reasoning",
          "Proponent addresses the counter-evidence",
        ],
        strengthScore: 50,
        difficultyScore: 50,
        strategicValue: 40,
        reasoning: "Direct rebuttal challenges the claim's truth without attacking specific reasoning. Burden is on proponent to defend.",
      },
    ];
  }

  /**
   * Generate CQ-based attack suggestions for an argument using a specific scheme
   */
  private async generateCQAttacks(
    argument: ArgumentWithSchemes,
    schemeInstance: ArgumentSchemeInstanceWithScheme,
    context?: any
  ): Promise<AttackSuggestion[]> {
    const scheme = schemeInstance.scheme;
    const cqs = (scheme as any).cqs || [];

    if (!cqs || cqs.length === 0) {
      return [];
    }

    const suggestions: AttackSuggestion[] = [];

    for (const cq of cqs) {
      // Skip if user already attacked via this CQ
      if (this.isCQAttackMade(cq.id, context?.existingArguments)) {
        continue;
      }

      // Generate attack suggestion
      const suggestion = await this.buildAttackSuggestion(
        cq,
        scheme,
        schemeInstance,
        argument
      );

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Build a complete attack suggestion from a CQ
   */
  private async buildAttackSuggestion(
    cq: CriticalQuestion,
    scheme: ArgumentScheme,
    schemeInstance: ArgumentSchemeInstanceWithScheme,
    targetArgument: ArgumentWithSchemes
  ): Promise<AttackSuggestion> {
    // 1. Generate template for attacking via this CQ
    const attackSchemeId = this.getAttackSchemeForCQ(cq, scheme);
    
    // Get claimId - prefer conclusion (new), fall back to claim (old), then direct fields
    const claimId = 
      targetArgument.conclusion?.id ||
      targetArgument.conclusionClaimId ||
      targetArgument.claim?.id || 
      targetArgument.claimId;
      
    if (!claimId) {
      console.error("[buildAttackSuggestion] No claimId found for argument:", {
        argumentId: targetArgument.id,
        hasConclusionRelation: !!targetArgument.conclusion,
        conclusionClaimId: targetArgument.conclusionClaimId,
        hasClaimRelation: !!targetArgument.claim,
        claimId: targetArgument.claimId,
      });
      throw new Error(`Argument ${targetArgument.id} has no associated claim`);
    }
    
    const template = await this.generateTemplate({
      schemeId: attackSchemeId,
      claimId,
      attackType: cq.attackType as any,
      targetCQ: cq.id,
    });

    // 2. Generate example attacks
    const exampleAttacks = this.generateExampleAttacks(cq, scheme, targetArgument);

    // 3. Identify common responses
    const commonResponses = this.getCommonResponses(cq);

    // 4. Scoring
    const strengthScore = this.estimateAttackStrength(cq, schemeInstance);
    const difficultyScore = this.estimateDifficulty(cq);
    const strategicValue = this.estimateStrategicValue(cq, targetArgument);

    // 5. Generate reasoning
    const reasoning = this.generateAttackReasoning(cq, scheme, schemeInstance);

    return {
      id: `attack-${cq.id}-${schemeInstance.id}`,
      cq,
      targetSchemeInstance: schemeInstance,
      attackType: cq.attackType as any,
      targetScope: cq.targetScope as any,
      burdenOfProof: cq.burdenOfProof as any,
      requiresEvidence: cq.requiresEvidence,
      evidenceTypes: (cq.evidenceTypes as string[]) || [],
      template,
      exampleAttacks,
      commonResponses,
      strengthScore,
      difficultyScore,
      strategicValue,
      reasoning,
    };
  }

  /**
   * Determine which scheme to use for constructing attack via this CQ
   */
  private getAttackSchemeForCQ(
    cq: CriticalQuestion,
    targetScheme: ArgumentScheme
  ): string {
    // If CQ invokes another scheme, use that
    if ((cq as any).invokesScheme) {
      return (cq as any).invokesScheme;
    }

    // Otherwise, use appropriate attack scheme based on CQ type
    switch (cq.attackType) {
      case "REBUTS":
        // Direct contradiction - use same scheme structure but opposite conclusion
        return targetScheme.id;

      case "UNDERCUTS":
        // Attack inference/warrant - use meta-level argumentation
        return targetScheme.id;

      case "UNDERMINES":
        // Attack premise - use evidence-based schemes
        return targetScheme.id;

      default:
        return targetScheme.id;
    }
  }

  /**
   * Generate example attacks for this CQ
   */
  private generateExampleAttacks(
    cq: CriticalQuestion,
    scheme: ArgumentScheme,
    targetArgument: ArgumentWithSchemes
  ): string[] {
    const examples: string[] = [];

    // Use CQ's stored examples if available
    const cqExamples = (cq as any).exampleAttacks;
    if (cqExamples && Array.isArray(cqExamples) && cqExamples.length > 0) {
      return cqExamples;
    }

    // Generate scheme-specific examples
    const schemeName = (scheme.name || scheme.key).toLowerCase();

    if (schemeName.includes("expert opinion") || schemeName.includes("expert")) {
      examples.push(
        `"The cited expert lacks credentials in this specific domain."`,
        `"The expert is biased or has conflicts of interest."`,
        `"Multiple other experts disagree with this assessment."`
      );
    } else if (schemeName.includes("practical reasoning") || schemeName.includes("practical")) {
      examples.push(
        `"This action would create worse consequences than the current situation."`,
        `"There are better alternatives that achieve the same goal."`,
        `"The proposed action is practically impossible given current constraints."`
      );
    } else if (schemeName.includes("cause") || schemeName.includes("causal")) {
      examples.push(
        `"The correlation does not imply causation."`,
        `"There are alternative explanations for the observed effect."`,
        `"The causal mechanism is not scientifically established."`
      );
    } else if (schemeName.includes("analog") || schemeName.includes("similarity")) {
      examples.push(
        `"The two cases differ in crucial respects."`,
        `"The analogy breaks down when we consider..."`,
        `"The conclusion doesn't follow even if the analogy holds."`
      );
    }

    // Generic fallback based on CQ question
    if (examples.length === 0) {
      const question = (cq.question || cq.text || "").toLowerCase();
      if (question.includes("true") || question.includes("accurate")) {
        examples.push(`"The premise is not adequately supported by evidence."`);
      }
      if (question.includes("expert") || question.includes("authority")) {
        examples.push(`"The source lacks sufficient expertise or credibility."`);
      }
      if (question.includes("alternative") || question.includes("other")) {
        examples.push(`"Better alternatives exist that were not considered."`);
      }
    }

    // Ultimate fallback
    if (examples.length === 0) {
      examples.push(
        `"${cq.question || cq.text}"`,
        `"This reasoning contains a logical gap."`,
        `"The evidence does not support this conclusion."`
      );
    }

    return examples;
  }

  /**
   * Get common responses proponents make to this CQ
   */
  private getCommonResponses(cq: CriticalQuestion): string[] {
    const commonResponses = (cq as any).commonResponses;
    if (commonResponses && Array.isArray(commonResponses) && commonResponses.length > 0) {
      return commonResponses;
    }

    // Generic responses based on burden of proof
    if (this.isProponentBurden(cq.burdenOfProof)) {
      return [
        "Provide additional evidence to support the premise",
        "Clarify the reasoning to address the challenge",
        "Cite authoritative sources",
        "Explain why the objection doesn't apply",
      ];
    } else {
      return [
        "Challenge the attacker to provide counter-evidence",
        "Shift burden back by questioning the objection",
        "Point out the lack of proof in the challenge",
      ];
    }
  }

  /**
   * Generate reasoning for why this attack is suggested
   */
  private generateAttackReasoning(
    cq: CriticalQuestion,
    scheme: ArgumentScheme,
    schemeInstance: ArgumentSchemeInstanceWithScheme
  ): string {
    const parts: string[] = [];

    // Explain attack type
    switch (cq.attackType) {
      case "REBUTS":
        parts.push("This attack directly challenges the conclusion.");
        break;
      case "UNDERCUTS":
        parts.push("This attack targets the inference/warrant, making the argument fail even if premises are true.");
        break;
      case "UNDERMINES":
        parts.push("This attack challenges a premise, weakening the foundation.");
        break;
    }

    // Explain burden advantage
    if (this.isProponentBurden(cq.burdenOfProof)) {
      parts.push(
        "Burden of proof advantage: The proponent must defend, you only need to raise doubt."
      );
    } else if (!cq.requiresEvidence) {
      parts.push(
        "Low evidence requirement: You can raise this challenge without extensive proof."
      );
    } else {
      parts.push(
        "Evidence required: You'll need to provide supporting evidence for this attack."
      );
    }

    // Explain scheme-specific considerations
    const schemeName = (scheme.name || scheme.key).toLowerCase();
    if (schemeName.includes("expert opinion") || schemeName.includes("expert")) {
      parts.push(
        "Expert opinion schemes are vulnerable to challenges about expertise, bias, and consensus."
      );
    } else if (schemeName.includes("practical reasoning")) {
      parts.push(
        "Practical reasoning can be attacked by showing better alternatives or negative consequences."
      );
    } else if (schemeName.includes("cause")) {
      parts.push(
        "Causal claims require establishing mechanism and ruling out alternatives."
      );
    }

    // Explain scheme instance role
    if ((schemeInstance as any).role === "presupposed") {
      parts.push(
        "This scheme is presupposed (implicit), making it harder to defend when exposed."
      );
    } else if ((schemeInstance as any).role === "primary") {
      parts.push(
        "This is the primary reasoning scheme, so attacking it strikes at the argument's core."
      );
    }

    return parts.join(" ");
  }

  /**
   * Estimate attack strength (0-100)
   */
  private estimateAttackStrength(
    cq: CriticalQuestion,
    schemeInstance: ArgumentSchemeInstanceWithScheme
  ): number {
    let score = 50; // Base score

    // Burden of proof advantage
    if (this.isProponentBurden(cq.burdenOfProof)) {
      score += 20; // Easier attack
    } else {
      score -= 10; // Harder attack
    }

    // Evidence requirements
    if (!cq.requiresEvidence) {
      score += 15; // Just asking is powerful
    } else {
      score -= 10; // Need proof
    }

    // Attack type (UNDERCUTS most powerful in dialectical theory)
    if (cq.attackType === "UNDERCUTS") {
      score += 15;
    } else if (cq.attackType === "UNDERMINES") {
      score += 10;
    }

    // Scheme instance role
    const role = (schemeInstance as any).role;
    if (role === "presupposed") {
      score += 15; // Presupposed schemes are often implicit, harder to defend
    } else if (role === "primary") {
      score += 10;
    }

    // Target scope (inference hardest to defend)
    if (cq.targetScope === "inference") {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate difficulty for user to make this attack (0-100, lower = easier)
   */
  private estimateDifficulty(cq: CriticalQuestion): number {
    let score = 50;

    if (this.isProponentBurden(cq.burdenOfProof)) {
      score -= 20; // Easier
    } else {
      score += 15; // Harder
    }

    if (cq.requiresEvidence) {
      score += 20; // Much harder
    }

    const evidenceTypes = (cq.evidenceTypes as string[]) || [];
    if (evidenceTypes.length > 0) {
      score += 10; // Need specific evidence type
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate strategic value in deliberation (0-100)
   */
  private estimateStrategicValue(
    cq: CriticalQuestion,
    targetArgument: ArgumentWithSchemes
  ): number {
    let score = 50;

    // High-leverage attack types
    if (cq.attackType === "UNDERCUTS") {
      score += 20; // Defeats without direct contradiction
    }

    // Burden advantage is strategically valuable
    if (this.isProponentBurden(cq.burdenOfProof)) {
      score += 15;
    }

    // Low evidence requirement increases strategic value
    if (!cq.requiresEvidence) {
      score += 10;
    }

    // Target scope
    if (cq.targetScope === "inference") {
      score += 10; // Attacking inference is high-leverage
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Check if this CQ attack has already been made
   */
  private isCQAttackMade(cqId: string, existingArguments?: string[]): boolean {
    if (!existingArguments || existingArguments.length === 0) {
      return false;
    }

    // This would require checking if any existingArguments
    // use this CQ as their basis (stored in argument metadata)
    // Simplified implementation for now:
    return false;
  }

  private async scoreAttackSuggestions(
    suggestions: AttackSuggestion[],
    userId: string
  ): Promise<AttackSuggestion[]> {
    // Could be enhanced with user-specific data (experience level, etc.)
    // For now, scores are already set in buildAttackSuggestion
    return suggestions;
  }

  // ============================================================================
  // Support Generation Implementation (Step 3.1.3)
  // ============================================================================

  /**
   * Get applicable schemes for a claim based on content and context
   * 
   * Analyzes claim characteristics to determine which argumentation schemes
   * are most appropriate for constructing supporting arguments.
   */
  private async getApplicableSchemes(claim: ClaimWithTopic): Promise<ArgumentScheme[]> {
    // Fetch all available schemes
    const allSchemes = await prisma.argumentScheme.findMany({
      include: {
        cqs: true,
      },
    });

    if (!allSchemes || allSchemes.length === 0) {
      return [];
    }

    // Score each scheme by applicability
    const scored = allSchemes.map((scheme) => {
      let score = 0;
      const claimText = claim.text.toLowerCase();
      const schemeName = (scheme.name || scheme.key).toLowerCase();
      const schemeKey = scheme.key.toLowerCase();

      // 1. Keyword matching based on scheme type
      if (
        schemeName.includes("expert") ||
        schemeKey.includes("expert") ||
        schemeKey.includes("authority")
      ) {
        // Expert opinion scheme - look for authority/expertise keywords
        if (
          claimText.match(/expert|study|research|scientist|doctor|professor|according to/i)
        ) {
          score += 30;
        }
        if (claimText.match(/shows|found|discovered|proven|demonstrated/i)) {
          score += 10;
        }
      }

      if (
        schemeName.includes("cause") ||
        schemeKey.includes("cause") ||
        schemeKey.includes("consequence")
      ) {
        // Causal reasoning - look for cause/effect language
        if (claimText.match(/because|causes?|leads? to|results? in|due to|therefore/i)) {
          score += 30;
        }
        if (claimText.match(/if|then|when|consequence|effect|impact/i)) {
          score += 10;
        }
      }

      if (
        schemeName.includes("practical") ||
        schemeKey.includes("practical") ||
        schemeKey.includes("action")
      ) {
        // Practical reasoning - look for action/goal language
        if (claimText.match(/should|must|ought|need to|have to|required/i)) {
          score += 30;
        }
        if (claimText.match(/goal|achieve|accomplish|purpose|benefit/i)) {
          score += 10;
        }
      }

      if (
        schemeName.includes("analog") ||
        schemeName.includes("similar") ||
        schemeKey.includes("analog")
      ) {
        // Argument from analogy - look for comparison language
        if (claimText.match(/like|similar|same as|analogous|comparable|just as/i)) {
          score += 30;
        }
        if (claimText.match(/example|case|instance|parallel/i)) {
          score += 10;
        }
      }

      if (
        schemeName.includes("sign") ||
        schemeName.includes("symptom") ||
        schemeKey.includes("sign")
      ) {
        // Argument from sign - look for indicator language
        if (claimText.match(/indicates?|suggests?|signs?|symptoms?|evidence|shows/i)) {
          score += 30;
        }
      }

      if (
        schemeName.includes("example") ||
        schemeName.includes("precedent") ||
        schemeKey.includes("example")
      ) {
        // Argument from example - look for generalization language
        if (claimText.match(/example|instance|case|typically|generally|usually/i)) {
          score += 25;
        }
      }

      if (
        schemeName.includes("popular") ||
        schemeName.includes("consensus") ||
        schemeKey.includes("popular")
      ) {
        // Popular opinion - look for consensus language
        if (claimText.match(/everyone|most|majority|consensus|widespread|common/i)) {
          score += 25;
        }
      }

      // 2. Boost schemes with more critical questions (more nuanced)
      const cqCount = (scheme as any).cqs?.length || 0;
      if (cqCount > 5) {
        score += 5;
      }

      // 3. General applicability - some schemes work for many claims
      if (schemeKey.includes("position-to-know") || schemeKey.includes("witness")) {
        score += 15; // Witness testimony is broadly applicable
      }

      return { scheme, score };
    });

    // Return schemes with non-zero scores, sorted by score
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.scheme)
      .slice(0, 15); // Top 15 most applicable schemes
  }

  /**
   * Match available evidence to a scheme's premise structure
   * 
   * Analyzes how well user evidence fits the scheme's required premises
   * and creates a support suggestion with prefilled data.
   */
  private async matchEvidenceToScheme(
    scheme: ArgumentScheme,
    claim: ClaimWithTopic,
    evidence: string[]
  ): Promise<SupportSuggestion> {
    // Parse scheme premises
    const premisesData = scheme.premises as any;
    const schemePremises: SchemePremise[] = [];

    if (Array.isArray(premisesData)) {
      premisesData.forEach((p: any) => {
        const premiseText = typeof p === "string" ? p : p?.text || JSON.stringify(p);
        schemePremises.push({
          key: p?.key || `P${schemePremises.length + 1}`,
          content: premiseText,
          type: (p?.type as any) || "ordinary",
          required: p?.required !== false,
        });
      });
    }

    // Match evidence to premises
    const premiseMatches: PremiseMatch[] = [];
    let totalMatchScore = 0;

    for (const premise of schemePremises) {
      const bestMatch = this.findBestEvidenceMatch(premise, evidence, claim);
      premiseMatches.push(bestMatch);
      totalMatchScore += bestMatch.confidence;
    }

    // Calculate overall confidence
    const avgConfidence =
      schemePremises.length > 0 ? totalMatchScore / schemePremises.length : 0;

    // Determine missing premises
    const missingPremises = premiseMatches
      .filter((m) => m.confidence < 0.5)
      .map((m) => m.premise.key);

    // Generate template
    const template = await this.generateTemplate({
      schemeId: scheme.id,
      claimId: claim.id,
      prefilledData: this.extractPrefilledData(premiseMatches),
    });

    // Generate example arguments using this scheme
    const exampleArguments = this.generateExampleSupport(scheme, claim);

    // Estimate completion effort
    const completionSteps = this.estimateCompletionSteps(premiseMatches);

    // Score the suggestion
    const strengthScore = this.estimateSupportStrength(
      avgConfidence,
      premiseMatches,
      scheme
    );
    const difficultyScore = this.estimateSupportDifficulty(missingPremises.length);
    const strategicValue = this.estimateSupportValue(scheme, claim);

    return {
      id: `support-${scheme.id}-${claim.id}`,
      scheme,
      template,
      premiseMatches,
      missingPremises,
      confidence: avgConfidence,
      exampleArguments,
      completionSteps,
      strengthScore,
      difficultyScore,
      strategicValue,
      reasoning: this.generateSupportReasoning(scheme, avgConfidence, premiseMatches),
    };
  }

  /**
   * Find best evidence match for a premise
   */
  private findBestEvidenceMatch(
    premise: SchemePremise,
    evidence: string[],
    claim: ClaimWithTopic
  ): PremiseMatch {
    const premiseText = premise.content.toLowerCase();
    const premiseWords = this.extractKeywords(premiseText);

    let bestMatch = "";
    let bestScore = 0;

    // Check each evidence item
    for (const item of evidence) {
      const itemLower = item.toLowerCase();
      const itemWords = this.extractKeywords(itemLower);

      // Calculate similarity score
      let score = 0;

      // Keyword overlap
      const overlap = premiseWords.filter((w) => itemWords.includes(w));
      score += overlap.length * 0.15;

      // Semantic patterns (simplified)
      if (premiseText.includes("expert") && itemLower.match(/expert|authority|study/)) {
        score += 0.3;
      }
      if (premiseText.includes("cause") && itemLower.match(/cause|leads? to|result/)) {
        score += 0.3;
      }
      if (premiseText.includes("goal") && itemLower.match(/goal|achieve|purpose/)) {
        score += 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Also check if premise can be derived from claim itself
    const claimWords = this.extractKeywords(claim.text.toLowerCase());
    const claimOverlap = premiseWords.filter((w) => claimWords.includes(w));
    if (claimOverlap.length > premiseWords.length * 0.5 && claimOverlap.length > 0) {
      if (bestScore < 0.4) {
        bestMatch = claim.text;
        bestScore = 0.4; // Moderate confidence
      }
    }

    return {
      premise: {
        key: premise.key,
        content: premise.content,
        required: premise.required !== false,
        type: premise.type,
      },
      matchedEvidence: bestMatch,
      confidence: Math.min(1.0, bestScore),
      suggestedContent: bestMatch || this.generatePremiseSuggestion(premise, claim),
    };
  }

  /**
   * Extract keywords from text (simple version)
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "were",
      "been",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "should",
      "could",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Generate premise suggestion when no evidence matches
   */
  private generatePremiseSuggestion(premise: SchemePremise, claim: ClaimWithTopic): string {
    const premiseText = premise.content.toLowerCase();

    // Generate contextual suggestions based on premise type
    if (premiseText.includes("expert") || premiseText.includes("authority")) {
      return "Cite an expert, study, or authoritative source that supports your position";
    }
    if (premiseText.includes("cause") || premiseText.includes("leads to")) {
      return "Explain the causal mechanism or provide evidence of the causal relationship";
    }
    if (premiseText.includes("goal") || premiseText.includes("objective")) {
      return "State the goal or desired outcome clearly";
    }
    if (premiseText.includes("example") || premiseText.includes("case")) {
      return "Provide a specific example or case study";
    }
    if (premiseText.includes("similar") || premiseText.includes("analogy")) {
      return "Identify a similar case or analogous situation";
    }

    return `Provide evidence or reasoning for: ${premise.content}`;
  }

  /**
   * Extract prefilled data from premise matches
   */
  private extractPrefilledData(matches: PremiseMatch[]): Record<string, string> {
    const data: Record<string, string> = {};

    matches.forEach((match) => {
      if (match.confidence > 0.5 && match.matchedEvidence) {
        // Use premise key as variable name
        const varName = match.premise.key.toLowerCase().replace(/[^a-z0-9]/g, "_");
        data[varName] = match.matchedEvidence;
      }
    });

    return data;
  }

  /**
   * Generate example arguments using this scheme
   */
  private generateExampleSupport(scheme: ArgumentScheme, claim: ClaimWithTopic): string[] {
    const examples: string[] = [];
    const schemeName = (scheme.name || scheme.key).toLowerCase();

    if (schemeName.includes("expert")) {
      examples.push(
        "According to [Expert Name], [Expert's Position/Finding].",
        "Research by [Institution] shows that [Finding].",
        "[Authority Figure] states that [Statement]."
      );
    } else if (schemeName.includes("cause")) {
      examples.push(
        "[Action/Event A] causes [Effect B] because [Mechanism].",
        "When [Condition], then [Result] occurs.",
        "[Phenomenon] leads to [Outcome] through [Process]."
      );
    } else if (schemeName.includes("practical")) {
      examples.push(
        "We should [Action] to achieve [Goal].",
        "[Action] is necessary because it will [Benefit].",
        "To accomplish [Objective], we must [Step]."
      );
    } else if (schemeName.includes("analog")) {
      examples.push(
        "[Case A] is similar to [Case B] in [Respect].",
        "Just as [Analogy Source], so too [Target].",
        "[Situation X] parallels [Situation Y] because [Similarity]."
      );
    }

    // Fallback generic example
    if (examples.length === 0) {
      examples.push(
        "Present premises that logically support the conclusion.",
        "Provide evidence that makes the claim more plausible.",
        "Structure your reasoning according to the scheme's pattern."
      );
    }

    return examples;
  }

  /**
   * Estimate steps needed to complete argument
   */
  private estimateCompletionSteps(matches: PremiseMatch[]): string[] {
    const steps: string[] = [];
    const missingCount = matches.filter((m) => m.confidence < 0.5).length;
    const weakCount = matches.filter((m) => m.confidence >= 0.5 && m.confidence < 0.8).length;

    if (missingCount > 0) {
      steps.push(`Gather evidence for ${missingCount} missing premise(s)`);
    }
    if (weakCount > 0) {
      steps.push(`Strengthen ${weakCount} weak premise(s) with better evidence`);
    }

    steps.push("Review and refine the logical flow");
    steps.push("Consider potential objections");
    steps.push("Submit your argument");

    return steps;
  }

  /**
   * Estimate strength of support suggestion
   */
  private estimateSupportStrength(
    confidence: number,
    matches: PremiseMatch[],
    scheme: ArgumentScheme
  ): number {
    let score = confidence * 60; // Base on match confidence

    // Boost for high-quality matches
    const strongMatches = matches.filter((m) => m.confidence > 0.7).length;
    score += strongMatches * 10;

    // Boost for schemes with more CQs (more robust)
    const cqCount = (scheme as any).cqs?.length || 0;
    if (cqCount > 5) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate difficulty of completing support argument
   */
  private estimateSupportDifficulty(missingPremiseCount: number): number {
    let score = 30; // Base difficulty

    // More missing premises = harder
    score += missingPremiseCount * 15;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Estimate strategic value of this support scheme
   */
  private estimateSupportValue(scheme: ArgumentScheme, claim: ClaimWithTopic): number {
    let score = 50;

    const schemeName = (scheme.name || scheme.key).toLowerCase();

    // Expert opinion and causal arguments are generally strong
    if (schemeName.includes("expert") || schemeName.includes("authority")) {
      score += 20;
    }
    if (schemeName.includes("cause") || schemeName.includes("consequence")) {
      score += 15;
    }

    // Schemes with more CQs show sophistication
    const cqCount = (scheme as any).cqs?.length || 0;
    if (cqCount > 5) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate reasoning for why this support is suggested
   */
  private generateSupportReasoning(
    scheme: ArgumentScheme,
    confidence: number,
    matches: PremiseMatch[]
  ): string {
    const parts: string[] = [];
    const schemeName = scheme.name || scheme.key;

    parts.push(`The "${schemeName}" scheme is well-suited for your claim.`);

    // Explain match quality
    if (confidence > 0.7) {
      parts.push("Your available evidence strongly matches the required premises.");
    } else if (confidence > 0.4) {
      parts.push("Your evidence partially matches the premises; some gaps need filling.");
    } else {
      parts.push("This scheme could work, but you'll need to gather more evidence.");
    }

    // Explain scheme advantages
    const schemeNameLower = schemeName.toLowerCase();
    if (schemeNameLower.includes("expert")) {
      parts.push("Expert testimony carries significant persuasive weight.");
    } else if (schemeNameLower.includes("cause")) {
      parts.push("Causal arguments are powerful when the mechanism is clear.");
    } else if (schemeNameLower.includes("practical")) {
      parts.push("Practical reasoning is effective for action-oriented claims.");
    }

    // Note missing pieces
    const missingCount = matches.filter((m) => m.confidence < 0.5).length;
    if (missingCount > 0) {
      parts.push(`You'll need to provide evidence for ${missingCount} premise(s).`);
    }

    return parts.join(" ");
  }

  /**
   * Score and enhance support suggestions with user-specific data
   */
  private async scoreSupportSuggestions(
    suggestions: SupportSuggestion[],
    userId: string
  ): Promise<SupportSuggestion[]> {
    // Could be enhanced with:
    // - User's argumentation skill level
    // - User's past success with different schemes
    // - Time constraints
    // - Deliberation context
    
    // For now, scores are set in matchEvidenceToScheme
    return suggestions;
  }

  // ============================================================================
  // Template Generation Implementation (Step 3.1.4)
  // ============================================================================

  /**
   * Build premise templates from scheme structure
   * 
   * Converts scheme premises into structured templates with variables,
   * types, and evidence requirements.
   */
  private buildPremiseTemplates(
    scheme: ArgumentScheme,
    prefilledData?: Record<string, string>
  ): PremiseTemplate[] {
    const templates: PremiseTemplate[] = [];
    const premisesData = scheme.premises as any;

    if (!premisesData) {
      return templates;
    }

    // Parse premises (may be array or object)
    let premiseArray: any[] = [];
    if (Array.isArray(premisesData)) {
      premiseArray = premisesData;
    } else if (typeof premisesData === "object") {
      // Convert object to array
      premiseArray = Object.entries(premisesData).map(([key, value]) => ({
        key,
        ...(typeof value === "object" ? value : { text: value }),
      }));
    }

    // Build template for each premise
    premiseArray.forEach((premise, index) => {
      const key = premise.key || `P${index + 1}`;
      const content = this.extractPremiseContent(premise, prefilledData);
      const type = this.determinePremiseType(premise);
      const evidenceType = this.inferEvidenceType(content);

      templates.push({
        key,
        content,
        required: premise.required !== false,
        type,
        evidenceType,
      });
    });

    return templates;
  }

  /**
   * Extract premise content with variable substitution
   */
  private extractPremiseContent(premise: any, prefilledData?: Record<string, string>): string {
    let content = "";

    // Get base content
    if (typeof premise === "string") {
      content = premise;
    } else if (premise.text) {
      content = premise.text;
    } else if (premise.content) {
      content = premise.content;
    } else if (premise.template) {
      content = premise.template;
    } else {
      content = JSON.stringify(premise);
    }

    // Substitute prefilled data
    if (prefilledData) {
      Object.entries(prefilledData).forEach(([varName, value]) => {
        // Support both {varName} and {{varName}} syntax
        const patterns = [
          new RegExp(`\\{${varName}\\}`, "g"),
          new RegExp(`\\{\\{${varName}\\}\\}`, "g"),
        ];
        patterns.forEach((pattern) => {
          content = content.replace(pattern, value);
        });
      });
    }

    return content;
  }

  /**
   * Determine premise type (ordinary, assumption, exception)
   */
  private determinePremiseType(premise: any): "ordinary" | "assumption" | "exception" {
    if (premise.type) {
      const type = premise.type.toLowerCase();
      if (type === "assumption") return "assumption";
      if (type === "exception") return "exception";
    }

    // Heuristic: check for assumption keywords
    const content = (premise.text || premise.content || "").toLowerCase();
    if (content.includes("assume") || content.includes("presumed") || content.includes("unless")) {
      return "assumption";
    }
    if (content.includes("except") || content.includes("exception")) {
      return "exception";
    }

    return "ordinary";
  }

  /**
   * Infer evidence type from premise content
   */
  private inferEvidenceType(content: string): string | undefined {
    const lower = content.toLowerCase();

    if (lower.match(/expert|authority|study|research/)) {
      return "expert-testimony";
    }
    if (lower.match(/statistic|data|number|percent/)) {
      return "statistical-data";
    }
    if (lower.match(/witness|observed|saw|experienced/)) {
      return "eyewitness-testimony";
    }
    if (lower.match(/document|report|record|publication/)) {
      return "documentary-evidence";
    }
    if (lower.match(/example|case|instance/)) {
      return "example";
    }
    if (lower.match(/cause|effect|leads to|results in/)) {
      return "causal-evidence";
    }

    return "general-evidence";
  }

  /**
   * Build attack conclusion based on attack type
   * 
   * Generates appropriate conclusion text for attacking arguments:
   * - REBUTS: Direct contradiction
   * - UNDERCUTS: Inference failure
   * - UNDERMINES: Premise challenge
   */
  private buildAttackConclusion(
    claim: any,
    attackType: string,
    targetCQ?: string
  ): string {
    const claimText = claim.text || claim.content || "";

    switch (attackType) {
      case "REBUTS":
        // Direct contradiction of conclusion
        return `Therefore, the claim "${claimText}" is false/incorrect`;

      case "UNDERCUTS":
        // Attack the inference/warrant
        return `Therefore, the reasoning leading to "${claimText}" is flawed`;

      case "UNDERMINES":
        // Challenge a premise
        return `Therefore, a key premise supporting "${claimText}" is questionable`;

      default:
        return `Therefore, "${claimText}" should be rejected`;
    }
  }

  /**
   * Build a conclusion template from scheme structure (for general mode)
   * Uses the scheme's formal structure if available, otherwise generates generic template
   */
  private buildGeneralConclusion(scheme: ArgumentScheme): string {
    // Try to extract conclusion from formal structure
    const premisesData = scheme.premises as any;
    
    if (Array.isArray(premisesData)) {
      // Look for a conclusion premise
      const conclusionPremise = premisesData.find((p: any) => 
        p.type === "conclusion" || 
        (typeof p === "object" && p.text && p.text.toLowerCase().includes("therefore"))
      );
      
      if (conclusionPremise) {
        return typeof conclusionPremise === "string" 
          ? conclusionPremise 
          : conclusionPremise.text || conclusionPremise.content || "";
      }
    }

    // Check if scheme has a dedicated conclusion field
    if ((scheme as any).conclusion) {
      const conclusionData = (scheme as any).conclusion;
      if (typeof conclusionData === "string") {
        return conclusionData;
      } else if (conclusionData.text) {
        return conclusionData.text;
      }
    }

    // Fallback: generate from scheme name/description
    const schemeName = scheme.name || scheme.key;
    if (schemeName.toLowerCase().includes("expert")) {
      return "Therefore, the claim is credible based on expert testimony";
    } else if (schemeName.toLowerCase().includes("cause")) {
      return "Therefore, the effect is likely to occur";
    } else if (schemeName.toLowerCase().includes("analogy")) {
      return "Therefore, the target case is similar to the source case";
    } else if (schemeName.toLowerCase().includes("consequence")) {
      return "Therefore, the action should be pursued/avoided based on its consequences";
    }

    // Generic fallback
    return "Therefore, the conclusion follows from the premises";
  }

  /**
   * Extract variables from scheme structure
   * 
   * Identifies template variables (like {agent}, {action}) and provides
   * descriptions for user guidance.
   */
  private extractVariables(scheme: ArgumentScheme): Record<string, string> {
    const variables: Record<string, string> = {};

    // Extract from scheme metadata if available
    if ((scheme as any).variables) {
      return (scheme as any).variables;
    }

    // Extract from premises by finding {variable} patterns
    const premisesData = scheme.premises as any;
    const allText: string[] = [];

    if (Array.isArray(premisesData)) {
      premisesData.forEach((p: any) => {
        const text = typeof p === "string" ? p : (p?.text || p?.content || "");
        allText.push(text);
      });
    }

    // Also check conclusion
    if ((scheme as any).conclusion) {
      allText.push((scheme as any).conclusion);
    }

    // Find all {variable} patterns
    const varPattern = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    allText.forEach((text) => {
      let match;
      while ((match = varPattern.exec(text)) !== null) {
        const varName = match[1];
        if (!variables[varName]) {
          // Generate description from variable name
          variables[varName] = this.generateVariableDescription(varName);
        }
      }
    });

    // Common scheme-specific variables
    const schemeName = (scheme.name || scheme.key).toLowerCase();
    if (schemeName.includes("expert")) {
      variables["expert"] = variables["expert"] || "The expert or authority being cited";
      variables["domain"] = variables["domain"] || "The expert's domain of expertise";
      variables["position"] = variables["position"] || "The expert's position or finding";
    }
    if (schemeName.includes("cause") || schemeName.includes("consequence")) {
      variables["cause"] = variables["cause"] || "The causal factor or event";
      variables["effect"] = variables["effect"] || "The resulting effect or consequence";
      variables["mechanism"] = variables["mechanism"] || "How the cause produces the effect";
    }
    if (schemeName.includes("practical")) {
      variables["goal"] = variables["goal"] || "The desired goal or outcome";
      variables["action"] = variables["action"] || "The action or means to achieve the goal";
      variables["agent"] = variables["agent"] || "Who should perform the action";
    }
    if (schemeName.includes("analog")) {
      variables["source_case"] = variables["source_case"] || "The source case or analogy";
      variables["target_case"] = variables["target_case"] || "The target case being argued";
      variables["similarity"] = variables["similarity"] || "The relevant similarity between cases";
    }

    return variables;
  }

  /**
   * Generate human-readable description from variable name
   */
  private generateVariableDescription(varName: string): string {
    // Convert camelCase or snake_case to readable text
    const readable = varName
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      .trim();

    // Capitalize first letter
    return readable.charAt(0).toUpperCase() + readable.slice(1);
  }

  /**
   * Prefill variables from claim and context
   * 
   * Auto-fills template variables using claim data and provided context.
   */
  private prefillVariables(
    variables: Record<string, string>,
    claim: any,
    prefilledData?: Record<string, string>
  ): Record<string, string> {
    const prefilled: Record<string, string> = {};

    // Start with explicitly provided data
    if (prefilledData) {
      Object.assign(prefilled, prefilledData);
    }

    // Auto-fill common variables from claim
    if (variables["claim"] && !prefilled["claim"]) {
      prefilled["claim"] = claim.text || claim.content || "";
    }

    // Try to extract subject/topic from claim
    if (variables["topic"] && !prefilled["topic"]) {
      // Simple extraction: first noun phrase
      const claimText = claim.text || "";
      const words = claimText.split(" ");
      if (words.length > 0) {
        prefilled["topic"] = words.slice(0, 3).join(" "); // First few words
      }
    }

    // Extract position keywords if present
    if (variables["position"] && !prefilled["position"]) {
      const claimText = (claim.text || "").toLowerCase();
      if (claimText.includes("should")) {
        const shouldIndex = claimText.indexOf("should");
        prefilled["position"] = claimText.slice(shouldIndex);
      }
    }

    return prefilled;
  }

  /**
   * Generate step-by-step construction guidance
   * 
   * Provides user-friendly steps for building the argument.
   */
  private generateConstructionSteps(
    scheme: ArgumentScheme,
    attackType?: string
  ): string[] {
    const steps: string[] = [];
    const schemeName = (scheme.name || scheme.key).toLowerCase();

    // Attack-specific steps
    if (attackType) {
      switch (attackType) {
        case "REBUTS":
          steps.push("1. Identify the claim you're contradicting");
          steps.push("2. Provide counter-evidence or alternative interpretation");
          steps.push("3. Explain why your position is stronger");
          break;
        case "UNDERCUTS":
          steps.push("1. Identify the inference or reasoning you're challenging");
          steps.push("2. Explain why the reasoning doesn't work");
          steps.push("3. Show the logical gap or fallacy");
          break;
        case "UNDERMINES":
          steps.push("1. Identify the premise you're challenging");
          steps.push("2. Provide evidence against the premise");
          steps.push("3. Explain the impact on the overall argument");
          break;
      }
      steps.push("4. Consider potential responses");
      steps.push("5. Submit your attack");
      return steps;
    }

    // Support argument steps (scheme-specific)
    if (schemeName.includes("expert") || schemeName.includes("authority")) {
      steps.push("1. Identify the expert, authority, or study");
      steps.push("2. Establish their expertise in the relevant domain");
      steps.push("3. State their position or finding clearly");
      steps.push("4. Connect their testimony to your claim");
      steps.push("5. Address potential challenges to expertise");
    } else if (schemeName.includes("cause") || schemeName.includes("consequence")) {
      steps.push("1. Identify the cause and effect clearly");
      steps.push("2. Explain the causal mechanism");
      steps.push("3. Provide evidence of the causal relationship");
      steps.push("4. Rule out alternative causes");
      steps.push("5. Show correlation and temporal precedence");
    } else if (schemeName.includes("practical")) {
      steps.push("1. State the goal or desired outcome");
      steps.push("2. Propose the action or means to achieve it");
      steps.push("3. Explain how the action achieves the goal");
      steps.push("4. Address negative side effects");
      steps.push("5. Compare to alternative actions");
    } else if (schemeName.includes("analog")) {
      steps.push("1. Identify the source case (analogy)");
      steps.push("2. Identify the target case (your situation)");
      steps.push("3. Explain the relevant similarities");
      steps.push("4. Show why the similarity supports your conclusion");
      steps.push("5. Address relevant differences");
    } else {
      // Generic steps
      steps.push("1. Review the required premises");
      steps.push("2. Gather evidence for each premise");
      steps.push("3. Fill in the template with your evidence");
      steps.push("4. Ensure logical flow from premises to conclusion");
      steps.push("5. Review and submit your argument");
    }

    return steps;
  }

  /**
   * Determine evidence requirements for premises
   * 
   * Analyzes premises to identify what types of evidence are needed.
   */
  private determineEvidenceRequirements(premises: PremiseTemplate[]): string[] {
    const requirements: string[] = [];
    const seenTypes = new Set<string>();

    premises.forEach((premise) => {
      const content = premise.content.toLowerCase();
      const evidenceType = premise.evidenceType;

      // Generate requirement based on evidence type
      if (evidenceType && !seenTypes.has(evidenceType)) {
        seenTypes.add(evidenceType);

        switch (evidenceType) {
          case "expert-testimony":
            requirements.push(
              "Expert testimony: Citations from qualified authorities, peer-reviewed studies, or recognized experts"
            );
            break;
          case "statistical-data":
            requirements.push(
              "Statistical data: Numbers, percentages, or quantitative evidence from reliable sources"
            );
            break;
          case "eyewitness-testimony":
            requirements.push(
              "Eyewitness testimony: First-hand accounts or direct observations"
            );
            break;
          case "documentary-evidence":
            requirements.push(
              "Documentary evidence: Official documents, reports, publications, or records"
            );
            break;
          case "example":
            requirements.push("Examples: Specific cases, instances, or precedents");
            break;
          case "causal-evidence":
            requirements.push(
              "Causal evidence: Data showing correlation, mechanism, and temporal precedence"
            );
            break;
          default:
            if (!seenTypes.has("general-evidence")) {
              seenTypes.add("general-evidence");
              requirements.push(
                "General evidence: Facts, data, or reasoning supporting the premises"
              );
            }
        }
      }

      // Also check for specific requirement keywords in content
      if (content.includes("must") || content.includes("required") || content.includes("need")) {
        if (!requirements.some((r) => r.includes("Required"))) {
          requirements.push("Required premises: These must be supported for the argument to work");
        }
      }
    });

    // If no specific requirements identified, add generic one
    if (requirements.length === 0) {
      requirements.push(
        "Evidence: Provide facts, data, or reasoning to support each premise"
      );
    }

    return requirements;
  }

  // ============================================================================
  // Confidence Scoring Implementation (Step 3.1.5)
  // ============================================================================

  /**
   * Compute comprehensive argument quality score
   * 
   * Provides real-time assessment of argument quality across multiple dimensions:
   * - Premise completeness (are all required premises filled?)
   * - Evidence quality (is evidence strong/credible?)
   * - Logical coherence (do premises support conclusion?)
   * - Vulnerability (what attacks are possible?)
   * 
   * Returns overall score (0-100) plus detailed per-premise scores and improvement suggestions.
   */
  private async computeArgumentScore(
    schemeId: string,
    filledPremises: Record<string, string>,
    claimId: string
  ): Promise<{
    overallScore: number;
    premiseScores: Record<string, number>;
    missingElements: string[];
    suggestions: string[];
  }> {
    // 1. Get scheme structure
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: schemeId },
      include: {
        cqs: true,
      },
    });

    if (!scheme) {
      return {
        overallScore: 0,
        premiseScores: {},
        missingElements: ["Scheme not found"],
        suggestions: ["Select a valid argument scheme"],
      };
    }

    // 2. Build premise templates to understand structure
    const premiseTemplates = this.buildPremiseTemplates(scheme);

    // 3. Score each premise
    const premiseScores: Record<string, number> = {};
    const missingElements: string[] = [];
    let totalPremiseScore = 0;
    let requiredPremiseCount = 0;

    for (const template of premiseTemplates) {
      const filled = filledPremises[template.key];
      const score = this.scorePremise(template, filled);
      premiseScores[template.key] = score;

      if (template.required) {
        requiredPremiseCount++;
        if (!filled || filled.trim().length === 0) {
          missingElements.push(`${template.key}: ${template.content}`);
        }
      }

      totalPremiseScore += score;
    }

    // 4. Calculate completeness score (0-40 points)
    const completenessScore =
      premiseTemplates.length > 0
        ? (totalPremiseScore / premiseTemplates.length) * 0.4
        : 0;

    // 5. Calculate evidence quality score (0-30 points)
    const evidenceScore = this.scoreEvidenceQuality(filledPremises, premiseTemplates);

    // 6. Calculate logical coherence score (0-20 points)
    const coherenceScore = this.scoreLogicalCoherence(
      filledPremises,
      premiseTemplates,
      scheme
    );

    // 7. Calculate vulnerability score (0-10 points for low vulnerability)
    const vulnerabilityScore = await this.scoreVulnerability(scheme, filledPremises);

    // 8. Combine scores
    const overallScore = Math.round(
      completenessScore + evidenceScore + coherenceScore + vulnerabilityScore
    );

    // 9. Generate improvement suggestions
    const suggestions = this.generateImprovementSuggestions(
      premiseScores,
      missingElements,
      filledPremises,
      premiseTemplates,
      scheme
    );

    return {
      overallScore: Math.min(100, Math.max(0, overallScore)),
      premiseScores,
      missingElements,
      suggestions,
    };
  }

  /**
   * Score individual premise quality (0-100)
   */
  private scorePremise(template: PremiseTemplate, filled?: string): number {
    if (!filled || filled.trim().length === 0) {
      return 0; // Empty premise
    }

    let score = 30; // Base score for having something

    // Length check (substantive content)
    const wordCount = filled.trim().split(/\s+/).length;
    if (wordCount >= 5) score += 20; // Reasonable detail
    if (wordCount >= 15) score += 10; // Good detail
    if (wordCount >= 30) score += 5; // Excellent detail

    // Evidence keywords (indicates research/support)
    const lowerFilled = filled.toLowerCase();
    if (
      lowerFilled.match(/study|research|data|according to|expert|professor|dr\.|phd/i)
    ) {
      score += 15; // Expert evidence
    }
    if (lowerFilled.match(/\d+%|\d+ percent|statistic|survey|poll/i)) {
      score += 10; // Statistical evidence
    }
    if (lowerFilled.match(/because|since|therefore|thus|consequently/i)) {
      score += 10; // Logical connectives
    }

    // Check for citations/sources
    if (lowerFilled.match(/\(.*\d{4}.*\)|https?:\/\/|doi:|isbn:/i)) {
      score += 10; // Has citations
    }

    // Penalty for very short or placeholder text
    if (wordCount < 3) {
      score -= 20;
    }
    if (lowerFilled.match(/TODO|TBD|placeholder|fill this|enter text/i)) {
      score -= 30; // Placeholder text
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Score overall evidence quality (0-30 points)
   */
  private scoreEvidenceQuality(
    filledPremises: Record<string, string>,
    templates: PremiseTemplate[]
  ): number {
    let score = 0;
    const allText = Object.values(filledPremises).join(" ").toLowerCase();

    // Check for strong evidence types
    if (allText.match(/study|research|experiment|trial/)) {
      score += 10; // Scientific evidence
    }
    if (allText.match(/\d+%|\d+ percent|statistic/)) {
      score += 8; // Quantitative evidence
    }
    if (allText.match(/expert|authority|professor|dr\./)) {
      score += 7; // Expert testimony
    }
    if (allText.match(/\(.*\d{4}.*\)|https?:\/\//)) {
      score += 5; // Citations present
    }

    // Check evidence distribution across premises
    const premisesWithEvidence = Object.values(filledPremises).filter((text) => {
      const lower = text.toLowerCase();
      return (
        lower.match(/study|research|data|expert|statistic|because|according to/i) !==
        null
      );
    }).length;

    const evidenceRatio = premisesWithEvidence / Math.max(1, templates.length);
    if (evidenceRatio > 0.7) {
      score += 5; // Most premises have evidence
    }

    return Math.min(30, score);
  }

  /**
   * Score logical coherence (0-20 points)
   */
  private scoreLogicalCoherence(
    filledPremises: Record<string, string>,
    templates: PremiseTemplate[],
    scheme: ArgumentScheme
  ): number {
    let score = 10; // Base coherence score

    const allText = Object.values(filledPremises).join(" ").toLowerCase();

    // Check for logical connectives
    const connectives = [
      "therefore",
      "thus",
      "consequently",
      "because",
      "since",
      "if",
      "then",
      "when",
      "implies",
      "follows that",
    ];
    const connectiveCount = connectives.filter((c) => allText.includes(c)).length;
    score += Math.min(5, connectiveCount); // Up to 5 points for connectives

    // Check for consistency in terminology
    const schemeName = (scheme.name || scheme.key).toLowerCase();
    if (schemeName.includes("expert") && allText.includes("expert")) {
      score += 2;
    }
    if (schemeName.includes("cause") && allText.match(/cause|effect|leads to/)) {
      score += 2;
    }
    if (schemeName.includes("practical") && allText.match(/goal|achieve|action/)) {
      score += 2;
    }

    // Penalty for contradictions or inconsistency markers
    if (allText.match(/but|however|although|despite/)) {
      score -= 1; // Potential contradiction (mild penalty)
    }

    return Math.min(20, Math.max(0, score));
  }

  /**
   * Score vulnerability to attacks (0-10 points, lower vulnerability = higher score)
   */
  private async scoreVulnerability(
    scheme: ArgumentScheme,
    filledPremises: Record<string, string>
  ): Promise<number> {
    let score = 10; // Start with full points

    const cqs = (scheme as any).cqs || [];
    const allText = Object.values(filledPremises).join(" ").toLowerCase();

    // Check for common vulnerabilities based on CQs
    for (const cq of cqs) {
      const cqText = (cq.text || "").toLowerCase();

      // If the argument doesn't address a critical question, it's vulnerable
      if (cqText.includes("expert") && !allText.match(/credential|qualif|expert/)) {
        score -= 2; // Vulnerable on expertise
      }
      if (cqText.includes("bias") && !allText.match(/unbiased|objective|independent/)) {
        score -= 1; // Vulnerable on bias
      }
      if (cqText.includes("alternative") && !allText.match(/alternative|other|only/)) {
        score -= 1; // Hasn't addressed alternatives
      }
      if (cqText.includes("cause") && !allText.match(/mechanism|because|how/)) {
        score -= 2; // Weak causal explanation
      }
    }

    // Check for hedging language (good for defensibility)
    if (allText.match(/likely|probably|suggests|may|might|could/)) {
      score += 2; // Appropriate hedging
    }

    // Check for overconfidence (bad for defensibility)
    if (allText.match(/always|never|impossible|certain|definitely|proves/)) {
      score -= 2; // Overconfident claims are vulnerable
    }

    return Math.min(10, Math.max(0, score));
  }

  /**
   * Generate actionable improvement suggestions
   */
  private generateImprovementSuggestions(
    premiseScores: Record<string, number>,
    missingElements: string[],
    filledPremises: Record<string, string>,
    templates: PremiseTemplate[],
    scheme: ArgumentScheme
  ): string[] {
    const suggestions: string[] = [];

    // 1. Address missing premises
    if (missingElements.length > 0) {
      suggestions.push(
        `Fill in ${missingElements.length} missing premise(s) to complete the argument structure`
      );
    }

    // 2. Strengthen weak premises
    const weakPremises = Object.entries(premiseScores)
      .filter(([key, score]) => score < 50 && filledPremises[key])
      .map(([key]) => key);

    if (weakPremises.length > 0) {
      suggestions.push(
        `Strengthen weak premises (${weakPremises.join(", ")}) with better evidence or more detail`
      );
    }

    // 3. Add evidence
    const allText = Object.values(filledPremises).join(" ").toLowerCase();
    if (!allText.match(/study|research|data|expert/)) {
      suggestions.push(
        "Add citations, studies, or expert testimony to strengthen your evidence base"
      );
    }

    // 4. Add quantitative evidence
    if (!allText.match(/\d+%|\d+ percent|statistic/)) {
      suggestions.push("Consider adding statistical data or quantitative evidence");
    }

    // 5. Improve logical flow
    if (!allText.match(/therefore|thus|because|consequently/)) {
      suggestions.push(
        "Use logical connectives (therefore, because, thus) to improve argument flow"
      );
    }

    // 6. Address critical questions
    const cqs = (scheme as any).cqs || [];
    const unaddressedCQs: string[] = [];

    for (const cq of cqs.slice(0, 3)) {
      // Check top 3 CQs
      const cqText = (cq.text || "").toLowerCase();
      if (cqText.includes("expert") && !allText.includes("expert")) {
        unaddressedCQs.push("Establish expertise of your sources");
      }
      if (cqText.includes("bias") && !allText.includes("bias")) {
        unaddressedCQs.push("Address potential bias concerns");
      }
      if (cqText.includes("alternative") && !allText.includes("alternative")) {
        unaddressedCQs.push("Consider and address alternative explanations");
      }
    }

    if (unaddressedCQs.length > 0) {
      suggestions.push(...unaddressedCQs);
    }

    // 7. Avoid overconfidence
    if (allText.match(/always|never|impossible|certain|proves/)) {
      suggestions.push(
        "Avoid absolute claims (always/never/proves); use appropriate hedging (likely/suggests)"
      );
    }

    // 8. Length check
    const totalWordCount = Object.values(filledPremises)
      .join(" ")
      .trim()
      .split(/\s+/).length;
    if (totalWordCount < 50) {
      suggestions.push("Expand your argument with more detail and explanation");
    }

    // Limit to top 5-7 most actionable suggestions
    return suggestions.slice(0, 7);
  }

  /**
   * Extract formal structure (major/minor premises) from scheme
   * Phase 2: Admin Integration
   */
  private extractFormalStructure(scheme: ArgumentScheme): {
    majorPremise?: string;
    minorPremise?: string;
    conclusion?: string;
  } | undefined {
    const premises = (scheme as any).premises;
    if (!premises || !Array.isArray(premises)) {
      return undefined;
    }

    const majorPremise = premises.find((p: any) => p.type === "major");
    const minorPremise = premises.find((p: any) => p.type === "minor");
    const conclusion = (scheme as any).conclusion;

    if (majorPremise && minorPremise) {
      return {
        majorPremise: majorPremise.text || majorPremise.content,
        minorPremise: minorPremise.text || minorPremise.content,
        conclusion: conclusion?.text || undefined,
      };
    }

    return undefined;
  }

  /**
   * Build scheme metadata for UI enhancements
   * Phase 2: Admin Integration
   */
  private buildSchemeMetadata(scheme: ArgumentScheme): {
    materialRelation?: string;
    reasoningType?: string;
    clusterTag?: string;
    purpose?: string;
    source?: string;
    slotHints?: Record<string, string>;
    premisesWithVariables?: Array<{
      id: string;
      type: "major" | "minor" | "general";
      text: string;
      variables: string[];
    }>;
  } {
    const metadata: any = {};

    // Extract Macagno & Walton taxonomy fields
    if ((scheme as any).materialRelation) {
      metadata.materialRelation = (scheme as any).materialRelation;
    }
    if ((scheme as any).reasoningType) {
      metadata.reasoningType = (scheme as any).reasoningType;
    }
    if ((scheme as any).clusterTag) {
      metadata.clusterTag = (scheme as any).clusterTag;
    }
    if ((scheme as any).purpose) {
      metadata.purpose = (scheme as any).purpose;
    }
    if ((scheme as any).source) {
      metadata.source = (scheme as any).source;
    }

    // Extract slot hints (for authority schemes)
    if ((scheme as any).slotHints) {
      metadata.slotHints = (scheme as any).slotHints;
    }

    // Extract premises with variables
    const premises = (scheme as any).premises;
    if (premises && Array.isArray(premises)) {
      metadata.premisesWithVariables = premises.map((p: any) => ({
        id: p.id || "P" + (premises.indexOf(p) + 1),
        type: p.type || "general",
        text: p.text || p.content || "",
        variables: p.variables || [],
      }));
    }

    return metadata;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const argumentGenerationService = new ArgumentGenerationService();
