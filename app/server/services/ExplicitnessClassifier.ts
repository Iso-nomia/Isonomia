import { NetCandidate, SchemeInstance } from "./NetIdentificationService";
import { DependencyGraph } from "./DependencyInferenceEngine";

// ============================================================================
// Types
// ============================================================================

export interface ExplicitnessAnalysis {
  netId: string;
  overallExplicitness: "explicit" | "semi-explicit" | "implicit";
  confidence: number; // 0-100

  schemeExplicitness: Array<{
    schemeId: string;
    level: "explicit" | "semi-explicit" | "implicit";
    confidence: number;
    indicators: {
      hasExplicitMarkers: boolean;
      hasMetaCommentary: boolean;
      hasStructuralCues: boolean;
      userConfirmed: boolean;
    };
    evidence: string[];
  }>;

  relationshipExplicitness: Array<{
    sourceScheme: string;
    targetScheme: string;
    level: "explicit" | "semi-explicit" | "implicit";
    confidence: number;
    indicators: {
      hasConnectives: boolean;
      hasSequenceMarkers: boolean;
      hasProximityCues: boolean;
    };
    evidence: string[];
  }>;

  reconstructionNeeded: boolean;
  reconstructionPriority: "high" | "medium" | "low";
  suggestions: string[];
}

export interface ExplicitnessMarkers {
  schemeMarkers: string[];
  relationshipMarkers: string[];
  metaCommentary: string[];
}

// ============================================================================
// Main Classifier
// ============================================================================

export class ExplicitnessClassifier {
  // Common linguistic markers
  private readonly EXPLICIT_MARKERS = {
    schemeIntro: [
      "i argue that",
      "my argument is",
      "i claim that",
      "i contend that",
      "this shows that",
      "therefore",
      "by analogy to",
    ],
    relationships: [
      "because",
      "since",
      "therefore",
      "thus",
      "consequently",
      "as a result",
      "this means",
      "following from",
    ],
    metaCommentary: [
      "first",
      "second",
      "third",
      "next",
      "finally",
      "in addition",
      "as i mentioned",
    ],
  };

  /**
   * Analyze the explicitness of a net structure
   */
  public async classifyExplicitness(
    net: NetCandidate,
    dependencyGraph: DependencyGraph,
    argumentText?: string
  ): Promise<ExplicitnessAnalysis> {
    // Step 1: Analyze scheme-level explicitness
    const schemeExplicitness = await this.analyzeSchemeExplicitness(
      net.schemes,
      argumentText
    );

    // Step 2: Analyze relationship explicitness
    const relationshipExplicitness = await this.analyzeRelationshipExplicitness(
      dependencyGraph,
      argumentText
    );

    // Step 3: Calculate overall explicitness
    const overallExplicitness = this.calculateOverallExplicitness(
      schemeExplicitness,
      relationshipExplicitness
    );

    // Step 4: Calculate confidence
    const confidence = this.calculateConfidence(
      schemeExplicitness,
      relationshipExplicitness
    );

    // Step 5: Determine reconstruction needs
    const reconstructionNeeded = this.needsReconstruction(
      overallExplicitness,
      schemeExplicitness,
      relationshipExplicitness
    );

    const reconstructionPriority = this.prioritizeReconstruction(
      overallExplicitness,
      net.complexity,
      confidence
    );

    // Step 6: Generate suggestions
    const suggestions = this.generateSuggestions(
      overallExplicitness,
      schemeExplicitness,
      relationshipExplicitness
    );

    return {
      netId: net.id,
      overallExplicitness,
      confidence,
      schemeExplicitness,
      relationshipExplicitness,
      reconstructionNeeded,
      reconstructionPriority,
      suggestions,
    };
  }

  /**
   * Extract explicit markers from argument text
   */
  public extractMarkers(argumentText: string): ExplicitnessMarkers {
    const lowerText = argumentText.toLowerCase();

    const schemeMarkers = this.EXPLICIT_MARKERS.schemeIntro.filter((marker) =>
      lowerText.includes(marker)
    );

    const relationshipMarkers = this.EXPLICIT_MARKERS.relationships.filter(
      (marker) => lowerText.includes(marker)
    );

    const metaCommentary = this.EXPLICIT_MARKERS.metaCommentary.filter(
      (marker) => lowerText.includes(marker)
    );

    return {
      schemeMarkers,
      relationshipMarkers,
      metaCommentary,
    };
  }

  // ============================================================================
  // Private Methods: Scheme Analysis
  // ============================================================================

  private async analyzeSchemeExplicitness(
    schemes: SchemeInstance[],
    argumentText?: string
  ): Promise<Array<any>> {
    const results = [];

    for (const scheme of schemes) {
      const indicators = {
        hasExplicitMarkers: false,
        hasMetaCommentary: false,
        hasStructuralCues: false,
        userConfirmed: scheme.confidence > 90, // High confidence suggests explicit
      };

      const evidence: string[] = [];

      if (argumentText) {
        const markers = this.extractMarkers(argumentText);

        // Check for explicit scheme markers
        if (markers.schemeMarkers.length > 0) {
          indicators.hasExplicitMarkers = true;
          evidence.push(
            `Contains explicit markers: ${markers.schemeMarkers.join(", ")}`
          );
        }

        // Check for meta-commentary
        if (markers.metaCommentary.length > 0) {
          indicators.hasMetaCommentary = true;
          evidence.push(
            `Has meta-commentary: ${markers.metaCommentary.join(", ")}`
          );
        }
      }

      // Check for structural cues (filled premises, evidence)
      const filledPremises = scheme.premises.filter((p) => p.isFilled);
      if (filledPremises.length === scheme.premises.length) {
        indicators.hasStructuralCues = true;
        evidence.push("All premises are explicitly filled");
      }

      const level = this.determineSchemeLevel(indicators);
      const confidence = this.calculateSchemeConfidence(indicators, scheme);

      results.push({
        schemeId: scheme.schemeId,
        level,
        confidence,
        indicators,
        evidence,
      });
    }

    return results;
  }

  private determineSchemeLevel(
    indicators: any
  ): "explicit" | "semi-explicit" | "implicit" {
    const explicitCount = Object.values(indicators).filter(Boolean).length;

    if (explicitCount >= 3) return "explicit";
    if (explicitCount >= 2) return "semi-explicit";
    return "implicit";
  }

  private calculateSchemeConfidence(
    indicators: any,
    scheme: SchemeInstance
  ): number {
    let confidence = 0;

    if (indicators.hasExplicitMarkers) confidence += 30;
    if (indicators.hasMetaCommentary) confidence += 20;
    if (indicators.hasStructuralCues) confidence += 25;
    if (indicators.userConfirmed) confidence += 25;

    return Math.min(100, Math.round(confidence));
  }

  // ============================================================================
  // Private Methods: Relationship Analysis
  // ============================================================================

  private async analyzeRelationshipExplicitness(
    dependencyGraph: DependencyGraph,
    argumentText?: string
  ): Promise<Array<any>> {
    const results = [];

    for (const edge of dependencyGraph.edges) {
      const indicators = {
        hasConnectives: false,
        hasSequenceMarkers: false,
        hasProximityCues: edge.strength > 0.7, // High strength suggests proximity
      };

      const evidence: string[] = [];

      if (argumentText) {
        const markers = this.extractMarkers(argumentText);

        // Check for connectives
        if (markers.relationshipMarkers.length > 0) {
          indicators.hasConnectives = true;
          evidence.push(
            `Contains connectives: ${markers.relationshipMarkers.join(", ")}`
          );
        }

        // Check for sequence markers
        if (markers.metaCommentary.length > 0) {
          indicators.hasSequenceMarkers = true;
          evidence.push(
            `Has sequence markers: ${markers.metaCommentary.join(", ")}`
          );
        }
      }

      // Check dependency type
      if (edge.type === "prerequisite" || edge.type === "supporting") {
        evidence.push(`Strong ${edge.type} dependency detected`);
      }

      const level = this.determineRelationshipLevel(indicators, edge);
      const confidence = this.calculateRelationshipConfidence(indicators, edge);

      results.push({
        sourceScheme: edge.sourceSchemeId,
        targetScheme: edge.targetSchemeId,
        level,
        confidence,
        indicators,
        evidence,
      });
    }

    return results;
  }

  private determineRelationshipLevel(
    indicators: any,
    edge: any
  ): "explicit" | "semi-explicit" | "implicit" {
    const indicatorCount = Object.values(indicators).filter(Boolean).length;

    // Explicit: has connectives AND sequence markers
    if (indicators.hasConnectives && indicators.hasSequenceMarkers) {
      return "explicit";
    }

    // Semi-explicit: has one marker or strong proximity
    if (indicatorCount >= 2) {
      return "semi-explicit";
    }

    return "implicit";
  }

  private calculateRelationshipConfidence(
    indicators: any,
    edge: any
  ): number {
    let confidence = 0;

    if (indicators.hasConnectives) confidence += 35;
    if (indicators.hasSequenceMarkers) confidence += 25;
    if (indicators.hasProximityCues) confidence += 20;
    if (edge.strength > 0.6) confidence += 20;

    return Math.min(100, Math.round(confidence));
  }

  // ============================================================================
  // Private Methods: Overall Analysis
  // ============================================================================

  private calculateOverallExplicitness(
    schemeExplicitness: Array<any>,
    relationshipExplicitness: Array<any>
  ): "explicit" | "semi-explicit" | "implicit" {
    const schemeLevels = schemeExplicitness.map((s) => s.level);
    const relationshipLevels = relationshipExplicitness.map((r) => r.level);

    const explicitCount =
      schemeLevels.filter((l) => l === "explicit").length +
      relationshipLevels.filter((l) => l === "explicit").length;

    const totalCount = schemeLevels.length + relationshipLevels.length;

    if (explicitCount >= totalCount * 0.7) return "explicit";
    if (explicitCount >= totalCount * 0.3) return "semi-explicit";
    return "implicit";
  }

  private calculateConfidence(
    schemeExplicitness: Array<any>,
    relationshipExplicitness: Array<any>
  ): number {
    const allConfidences = [
      ...schemeExplicitness.map((s) => s.confidence),
      ...relationshipExplicitness.map((r) => r.confidence),
    ];

    if (allConfidences.length === 0) return 0;

    const avgConfidence =
      allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length;

    return Math.round(avgConfidence);
  }

  private needsReconstruction(
    overallExplicitness: string,
    schemeExplicitness: Array<any>,
    relationshipExplicitness: Array<any>
  ): boolean {
    // Needs reconstruction if:
    // 1. Overall is implicit
    if (overallExplicitness === "implicit") return true;

    // 2. Many implicit components
    const implicitCount =
      schemeExplicitness.filter((s) => s.level === "implicit").length +
      relationshipExplicitness.filter((r) => r.level === "implicit").length;

    const totalCount =
      schemeExplicitness.length + relationshipExplicitness.length;

    if (implicitCount >= totalCount * 0.5) return true;

    return false;
  }

  private prioritizeReconstruction(
    overallExplicitness: string,
    complexity: number,
    confidence: number
  ): "high" | "medium" | "low" {
    // High priority: implicit + complex + low confidence
    if (
      overallExplicitness === "implicit" &&
      complexity > 60 &&
      confidence < 50
    ) {
      return "high";
    }

    // Medium priority: semi-explicit or moderate complexity
    if (
      overallExplicitness === "semi-explicit" ||
      (complexity > 40 && confidence < 70)
    ) {
      return "medium";
    }

    return "low";
  }

  private generateSuggestions(
    overallExplicitness: string,
    schemeExplicitness: Array<any>,
    relationshipExplicitness: Array<any>
  ): string[] {
    const suggestions: string[] = [];

    // Suggest based on overall explicitness
    if (overallExplicitness === "implicit") {
      suggestions.push(
        "Add explicit markers to indicate the argumentative structure"
      );
      suggestions.push(
        "Use meta-commentary to guide readers through the reasoning"
      );
    }

    // Suggest for implicit schemes
    const implicitSchemes = schemeExplicitness.filter(
      (s) => s.level === "implicit"
    );
    if (implicitSchemes.length > 0) {
      suggestions.push(
        `Make ${implicitSchemes.length} implicit schemes more explicit with clear scheme markers`
      );
    }

    // Suggest for implicit relationships
    const implicitRelationships = relationshipExplicitness.filter(
      (r) => r.level === "implicit"
    );
    if (implicitRelationships.length > 0) {
      suggestions.push(
        `Add connectives to clarify ${implicitRelationships.length} implicit relationships`
      );
    }

    // Suggest structural improvements
    const lowConfidenceSchemes = schemeExplicitness.filter(
      (s) => s.confidence < 50
    );
    if (lowConfidenceSchemes.length > 0) {
      suggestions.push(
        "Fill in missing premises to strengthen scheme structure"
      );
    }

    return suggestions;
  }
}
