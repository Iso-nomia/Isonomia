import { NetCandidate, SchemeInstance } from "./NetIdentificationService";
import { DependencyGraph, Dependency } from "./DependencyInferenceEngine";
import { ExplicitnessAnalysis } from "./ExplicitnessClassifier";

// ============================================================================
// Types
// ============================================================================

export interface ReconstructionSuggestion {
  id: string;
  type:
    | "add-scheme"
    | "clarify-relationship"
    | "strengthen-premise"
    | "reorder-structure"
    | "add-evidence";
  priority: "critical" | "high" | "medium" | "low";
  target: {
    schemeId?: string;
    relationshipId?: string;
    premiseKey?: string;
  };
  suggestion: {
    title: string;
    description: string;
    example: string;
    alternatives?: string[];
  };
  impact: {
    explicitnessGain: number; // How much more explicit
    coherenceGain: number; // How much more coherent
    completenessGain: number; // How much more complete
  };
  effort: "low" | "medium" | "high";
  automatable: boolean;
  automaticFix?: any; // If automatable, what to apply
}

export interface ReconstructionPlan {
  netId: string;
  currentState: {
    explicitness: string;
    complexity: number;
    clarity: number;
  };
  targetState: {
    explicitness: string;
    complexity: number;
    clarity: number;
  };
  suggestions: ReconstructionSuggestion[];
  phases: Array<{
    name: string;
    suggestions: string[];
    estimatedEffort: string;
  }>;
  totalEffort: string;
}

// ============================================================================
// Main Service
// ============================================================================

export class NetReconstructionService {
  /**
   * Generate reconstruction suggestions for a net
   */
  public async generateSuggestions(
    net: NetCandidate,
    dependencyGraph: DependencyGraph,
    explicitnessAnalysis: ExplicitnessAnalysis
  ): Promise<ReconstructionSuggestion[]> {
    const suggestions: ReconstructionSuggestion[] = [];

    // Type 1: Scheme improvements (explicit markers)
    const schemeSuggestions = await this.suggestSchemeImprovements(
      net,
      explicitnessAnalysis
    );
    suggestions.push(...schemeSuggestions);

    // Type 2: Relationship improvements (connectives)
    const relationshipSuggestions = await this.suggestRelationshipImprovements(
      dependencyGraph,
      explicitnessAnalysis
    );
    suggestions.push(...relationshipSuggestions);

    // Type 3: Premise improvements (completeness)
    const premiseSuggestions = await this.suggestPremiseImprovements(net);
    suggestions.push(...premiseSuggestions);

    // Type 4: Structural improvements (ordering)
    const structuralSuggestions = await this.suggestStructuralImprovements(
      net,
      dependencyGraph
    );
    suggestions.push(...structuralSuggestions);

    // Prioritize and return
    return this.prioritizeSuggestions(suggestions);
  }

  /**
   * Create a complete reconstruction plan
   */
  public async createReconstructionPlan(
    net: NetCandidate,
    dependencyGraph: DependencyGraph,
    explicitnessAnalysis: ExplicitnessAnalysis
  ): Promise<ReconstructionPlan> {
    const suggestions = await this.generateSuggestions(
      net,
      dependencyGraph,
      explicitnessAnalysis
    );

    const currentState = {
      explicitness: explicitnessAnalysis.overallExplicitness,
      complexity: net.complexity,
      clarity: explicitnessAnalysis.confidence,
    };

    const targetState = this.estimateTargetState(currentState, suggestions);

    const phases = this.createPhases(suggestions);

    const totalEffort = this.calculateTotalEffort(suggestions);

    return {
      netId: net.id,
      currentState,
      targetState,
      suggestions,
      phases,
      totalEffort,
    };
  }

  // ============================================================================
  // Private Methods: Scheme Suggestions
  // ============================================================================

  private async suggestSchemeImprovements(
    net: NetCandidate,
    explicitnessAnalysis: ExplicitnessAnalysis
  ): Promise<ReconstructionSuggestion[]> {
    const suggestions: ReconstructionSuggestion[] = [];

    for (const schemeAnalysis of explicitnessAnalysis.schemeExplicitness) {
      if (schemeAnalysis.level === "implicit") {
        const scheme = net.schemes.find(
          (s) => s.schemeId === schemeAnalysis.schemeId
        );
        if (!scheme) continue;

        suggestions.push({
          id: `scheme-explicit-${scheme.schemeId}`,
          type: "add-scheme",
          priority: scheme.role === "primary" ? "critical" : "high",
          target: { schemeId: scheme.schemeId },
          suggestion: {
            title: `Make ${scheme.schemeName} explicit`,
            description: `Add explicit markers to indicate the use of ${scheme.schemeName}`,
            example: `Start with: "I argue by ${scheme.schemeCategory} that..."`,
            alternatives: [
              `"My argument from ${scheme.schemeCategory} shows that..."`,
              `"Using ${scheme.schemeName}, I contend that..."`,
            ],
          },
          impact: {
            explicitnessGain: 25,
            coherenceGain: 15,
            completenessGain: 5,
          },
          effort: "low",
          automatable: false,
        });
      }
    }

    return suggestions;
  }

  // ============================================================================
  // Private Methods: Relationship Suggestions
  // ============================================================================

  private async suggestRelationshipImprovements(
    dependencyGraph: DependencyGraph,
    explicitnessAnalysis: ExplicitnessAnalysis
  ): Promise<ReconstructionSuggestion[]> {
    const suggestions: ReconstructionSuggestion[] = [];

    for (const relAnalysis of explicitnessAnalysis.relationshipExplicitness) {
      if (relAnalysis.level === "implicit") {
        const dependency = dependencyGraph.edges.find(
          (e) =>
            e.sourceSchemeId === relAnalysis.sourceScheme &&
            e.targetSchemeId === relAnalysis.targetScheme
        );

        if (!dependency) continue;

        const connective = this.suggestConnective(dependency);

        suggestions.push({
          id: `rel-clarify-${dependency.id}`,
          type: "clarify-relationship",
          priority: dependency.criticality === "critical" ? "high" : "medium",
          target: {
            relationshipId: dependency.id,
          },
          suggestion: {
            title: `Clarify ${dependency.type} relationship`,
            description: `Add connective to show how schemes relate`,
            example: `"${connective} [target scheme follows]"`,
            alternatives: this.getAlternativeConnectives(dependency.type),
          },
          impact: {
            explicitnessGain: 20,
            coherenceGain: 25,
            completenessGain: 0,
          },
          effort: "low",
          automatable: true,
          automaticFix: {
            insertConnective: connective,
            beforeScheme: dependency.targetSchemeId,
          },
        });
      }
    }

    return suggestions;
  }

  private suggestConnective(dependency: Dependency): string {
    const connectives = {
      prerequisite: "First,",
      supporting: "Additionally,",
      enabling: "This allows us to see that",
      background: "To understand this,",
    };

    return connectives[dependency.type] || "Additionally,";
  }

  private getAlternativeConnectives(type: string): string[] {
    const alternatives = {
      prerequisite: ["Before proceeding,", "As a foundation,"],
      supporting: ["Furthermore,", "Moreover,", "In addition,"],
      enabling: ["This makes it possible to", "From this we can"],
      background: ["As context,", "To frame this,"],
    };

    return alternatives[type as keyof typeof alternatives] || ["Therefore,", "Thus,"];
  }

  // ============================================================================
  // Private Methods: Premise Suggestions
  // ============================================================================

  private async suggestPremiseImprovements(
    net: NetCandidate
  ): Promise<ReconstructionSuggestion[]> {
    const suggestions: ReconstructionSuggestion[] = [];

    for (const scheme of net.schemes) {
      const unfilledPremises = scheme.premises.filter((p) => !p.isFilled);

      for (const premise of unfilledPremises) {
        suggestions.push({
          id: `premise-fill-${scheme.schemeId}-${premise.key}`,
          type: "strengthen-premise",
          priority: scheme.role === "primary" ? "high" : "medium",
          target: {
            schemeId: scheme.schemeId,
            premiseKey: premise.key,
          },
          suggestion: {
            title: `Fill missing premise: ${premise.key}`,
            description: `Complete the ${scheme.schemeName} by providing the ${premise.key} premise`,
            example: `Add text for: "${premise.key}"`,
          },
          impact: {
            explicitnessGain: 5,
            coherenceGain: 10,
            completenessGain: 30,
          },
          effort: "medium",
          automatable: false,
        });
      }

      // Suggest evidence for weak premises
      const weakPremises = scheme.premises.filter(
        (p) => p.isFilled && p.evidenceIds.length === 0
      );

      for (const premise of weakPremises) {
        suggestions.push({
          id: `premise-evidence-${scheme.schemeId}-${premise.key}`,
          type: "add-evidence",
          priority: "low",
          target: {
            schemeId: scheme.schemeId,
            premiseKey: premise.key,
          },
          suggestion: {
            title: `Add evidence for ${premise.key}`,
            description: `Strengthen premise "${premise.text}" with supporting evidence`,
            example: "Add citation, data, or example to support this claim",
          },
          impact: {
            explicitnessGain: 0,
            coherenceGain: 15,
            completenessGain: 20,
          },
          effort: "high",
          automatable: false,
        });
      }
    }

    return suggestions;
  }

  // ============================================================================
  // Private Methods: Structural Suggestions
  // ============================================================================

  private async suggestStructuralImprovements(
    net: NetCandidate,
    dependencyGraph: DependencyGraph
  ): Promise<ReconstructionSuggestion[]> {
    const suggestions: ReconstructionSuggestion[] = [];

    // Check if schemes follow dependency order
    const { roots, criticalPath } = dependencyGraph;

    if (roots.length > 1) {
      suggestions.push({
        id: "struct-multiple-roots",
        type: "reorder-structure",
        priority: "medium",
        target: {},
        suggestion: {
          title: "Multiple entry points detected",
          description: `This argument has ${roots.length} independent starting points. Consider establishing a clear order.`,
          example: "Reorganize to present schemes in dependency order",
        },
        impact: {
          explicitnessGain: 15,
          coherenceGain: 20,
          completenessGain: 0,
        },
        effort: "medium",
        automatable: false,
      });
    }

    // Suggest following critical path
    if (criticalPath.length > 2) {
      suggestions.push({
        id: "struct-critical-path",
        type: "reorder-structure",
        priority: "high",
        target: {},
        suggestion: {
          title: "Follow critical dependency path",
          description: `Emphasize the main reasoning chain: ${criticalPath.length} key steps`,
          example: "Present schemes in order of their dependencies",
        },
        impact: {
          explicitnessGain: 10,
          coherenceGain: 30,
          completenessGain: 0,
        },
        effort: "high",
        automatable: false,
      });
    }

    // Detect cycles
    if (dependencyGraph.cycles.length > 0) {
      suggestions.push({
        id: "struct-cycles",
        type: "reorder-structure",
        priority: "critical",
        target: {},
        suggestion: {
          title: "Resolve circular reasoning",
          description: `${dependencyGraph.cycles.length} circular dependencies detected. Break the cycle.`,
          example: "Reorder schemes to eliminate circular dependencies",
        },
        impact: {
          explicitnessGain: 20,
          coherenceGain: 40,
          completenessGain: 0,
        },
        effort: "high",
        automatable: false,
      });
    }

    return suggestions;
  }

  // ============================================================================
  // Private Methods: Plan Creation
  // ============================================================================

  private prioritizeSuggestions(
    suggestions: ReconstructionSuggestion[]
  ): ReconstructionSuggestion[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return suggestions.sort((a, b) => {
      // First by priority
      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by impact (total gain)
      const aImpact =
        a.impact.explicitnessGain +
        a.impact.coherenceGain +
        a.impact.completenessGain;
      const bImpact =
        b.impact.explicitnessGain +
        b.impact.coherenceGain +
        b.impact.completenessGain;

      return bImpact - aImpact;
    });
  }

  private calculateCompleteness(net: NetCandidate): number {
    let totalPremises = 0;
    let filledPremises = 0;

    for (const scheme of net.schemes) {
      totalPremises += scheme.premises.length;
      filledPremises += scheme.premises.filter((p) => p.isFilled).length;
    }

    return totalPremises > 0 ? (filledPremises / totalPremises) * 100 : 0;
  }

  private estimateTargetState(
    currentState: any,
    suggestions: ReconstructionSuggestion[]
  ): any {
    const totalExplicitnessGain = suggestions.reduce(
      (sum, s) => sum + s.impact.explicitnessGain,
      0
    );
    const totalCoherenceGain = suggestions.reduce(
      (sum, s) => sum + s.impact.coherenceGain,
      0
    );

    return {
      explicitness: totalExplicitnessGain > 30 ? "explicit" : "semi-explicit",
      complexity: currentState.complexity, // Complexity doesn't change
      clarity: Math.min(100, currentState.clarity + totalCoherenceGain),
    };
  }

  private createPhases(suggestions: ReconstructionSuggestion[]): Array<any> {
    const phases = [
      {
        name: "Critical Fixes",
        suggestions: suggestions
          .filter((s) => s.priority === "critical")
          .map((s) => s.id),
        estimatedEffort: "",
      },
      {
        name: "Quick Wins",
        suggestions: suggestions
          .filter((s) => s.priority === "high" && s.effort === "low")
          .map((s) => s.id),
        estimatedEffort: "",
      },
      {
        name: "Major Improvements",
        suggestions: suggestions
          .filter(
            (s) => s.priority === "high" && (s.effort === "medium" || s.effort === "high")
          )
          .map((s) => s.id),
        estimatedEffort: "",
      },
      {
        name: "Polish",
        suggestions: suggestions
          .filter((s) => s.priority === "medium" || s.priority === "low")
          .map((s) => s.id),
        estimatedEffort: "",
      },
    ];

    // Calculate effort for each phase
    for (const phase of phases) {
      const phaseSuggestions = suggestions.filter((s) =>
        phase.suggestions.includes(s.id)
      );
      phase.estimatedEffort = this.calculatePhaseEffort(phaseSuggestions);
    }

    return phases.filter((p) => p.suggestions.length > 0);
  }

  private calculatePhaseEffort(suggestions: ReconstructionSuggestion[]): string {
    const effortMap = { low: 1, medium: 3, high: 5 };
    const totalEffort = suggestions.reduce(
      (sum, s) => sum + effortMap[s.effort],
      0
    );

    if (totalEffort <= 5) return "5-10 minutes";
    if (totalEffort <= 10) return "10-20 minutes";
    if (totalEffort <= 20) return "20-40 minutes";
    return "40+ minutes";
  }

  private calculateTotalEffort(suggestions: ReconstructionSuggestion[]): string {
    return this.calculatePhaseEffort(suggestions);
  }
}
