import { prisma } from "@/lib/prismaclient";
import { NetCandidate, SchemeInstance } from "./NetIdentificationService";
import { DependencyGraph, Dependency } from "./DependencyInferenceEngine";

// ============================================================================
// Types
// ============================================================================

export interface NetCriticalQuestion {
  id: string;
  type: "scheme" | "dependency" | "net-structure" | "explicitness";
  targetSchemeId?: string;
  targetSchemeName?: string; // Week 5: Add scheme name for better display
  targetDependencyId?: string;
  questionText: string;
  questionCategory: string;
  priority: "critical" | "high" | "medium" | "low";
  burdenOfProof?: "proponent" | "challenger" | "PROPONENT" | "CHALLENGER"; // Week 5 Task 5.3
  requiresEvidence?: boolean; // Week 5 Task 5.3
  context: {
    netId: string;
    schemeRole?: string;
    dependencyType?: string;
    netType?: string;
  };
  suggestedActions?: string[];
  relatedSchemes: string[];
}

export interface NetCQGroup {
  groupType: "scheme" | "dependency" | "burden" | "attack-type" | "net-level";
  groupLabel: string;
  groupDescription: string;
  targetSchemeId?: string;
  questions: NetCriticalQuestion[];
  priority: "critical" | "high" | "medium" | "low";
}

// ============================================================================
// Main Service
// ============================================================================

export class NetAwareCQService {
  /**
   * Generate all CQs for an argument net
   */
  public async generateNetCQs(
    netId: string,
    net: NetCandidate,
    dependencyGraph: DependencyGraph,
    explicitnessAnalysis: any
  ): Promise<NetCriticalQuestion[]> {
    const questions: NetCriticalQuestion[] = [];

    // 1. Scheme-level CQs (traditional)
    const schemeCQs = await this.generateSchemeCQs(net, explicitnessAnalysis);
    questions.push(...schemeCQs);

    // 2. Dependency CQs
    const dependencyCQs = await this.generateDependencyCQs(
      net,
      dependencyGraph,
      explicitnessAnalysis
    );
    questions.push(...dependencyCQs);

    // 3. Net structure CQs
    const netStructureCQs = await this.generateNetStructureCQs(
      net,
      dependencyGraph
    );
    questions.push(...netStructureCQs);

    // 4. Explicitness CQs
    const explicitnessCQs = await this.generateExplicitnessCQs(
      net,
      explicitnessAnalysis
    );
    questions.push(...explicitnessCQs);

    return questions;
  }

  /**
   * Group CQs by various criteria
   */
  public groupCQs(
    questions: NetCriticalQuestion[],
    groupBy: "scheme" | "dependency" | "attack-type" | "burden" | "priority"
  ): NetCQGroup[] {
    switch (groupBy) {
      case "scheme":
        return this.groupByScheme(questions);
      case "dependency":
        return this.groupByDependency(questions);
      case "attack-type":
        return this.groupByAttackType(questions);
      case "burden":
        return this.groupByBurden(questions);
      case "priority":
        return this.groupByPriority(questions);
      default:
        return [];
    }
  }

  // ==========================================================================
  // Private Methods: Scheme-level CQs
  // ==========================================================================

  private async generateSchemeCQs(
    net: NetCandidate,
    explicitnessAnalysis: any
  ): Promise<NetCriticalQuestion[]> {
    const questions: NetCriticalQuestion[] = [];

    for (const scheme of net.schemes) {
      // Fetch scheme details from database
      const schemeData = await prisma.argumentScheme.findUnique({
        where: { id: scheme.schemeId },
        include: { cqs: true },
      });

      if (!schemeData || !schemeData.cqs) continue;

      // Convert scheme CQs to net-aware format
      for (const cq of schemeData.cqs) {
        const burden = this.determineBurden(cq, scheme); // Week 5 Task 5.3
        
        questions.push({
          id: `cq-${cq.id}-${scheme.schemeId}`,
          type: "scheme",
          targetSchemeId: scheme.schemeId,
          targetSchemeName: scheme.schemeName, // Week 5: Include scheme name
          questionText: this.contextualizeQuestion(cq.text || "", scheme),
          questionCategory: cq.cqKey || "general",
          priority: this.determinePriority(scheme, cq),
          burdenOfProof: burden.burdenOfProof, // Week 5 Task 5.3
          requiresEvidence: burden.requiresEvidence, // Week 5 Task 5.3
          context: {
            netId: net.id,
            schemeRole: scheme.role,
            netType: net.netType,
          },
          suggestedActions: this.generateActions(cq, scheme),
          relatedSchemes: [scheme.schemeId],
        });
      }

      // Add role-specific CQs
      const roleCQs = this.generateRoleCQs(scheme, net);
      questions.push(...roleCQs);
    }

    return questions;
  }

  /**
   * Contextualize CQ text with scheme-specific information
   */
  private contextualizeQuestion(
    questionText: string,
    scheme: SchemeInstance
  ): string {
    // Replace placeholders with actual scheme data
    let contextualized = questionText;

    // Replace scheme name
    contextualized = contextualized.replace(
      /\{scheme\}/g,
      scheme.schemeName
    );

    // Replace conclusion
    if (scheme.conclusion) {
      contextualized = contextualized.replace(
        /\{conclusion\}/g,
        `"${scheme.conclusion}"`
      );
    }

    // Replace premises
    scheme.premises.forEach((premise, index) => {
      contextualized = contextualized.replace(
        new RegExp(`\\{premise${index + 1}\\}`, "g"),
        premise.text || `[premise ${index + 1}]`
      );
    });

    return contextualized;
  }

  /**
   * Generate role-specific CQs
   */
  private generateRoleCQs(
    scheme: SchemeInstance,
    net: NetCandidate
  ): NetCriticalQuestion[] {
    const questions: NetCriticalQuestion[] = [];

    if (scheme.role === "primary") {
      questions.push({
        id: `role-primary-${scheme.schemeId}`,
        type: "scheme",
        targetSchemeId: scheme.schemeId,
        questionText: `Is "${scheme.schemeName}" the strongest scheme for the main conclusion?`,
        questionCategory: "Role Appropriateness",
        priority: "high",
        context: {
          netId: net.id,
          schemeRole: "primary",
          netType: net.netType,
        },
        relatedSchemes: [scheme.schemeId],
      });
    }

    if (scheme.role === "supporting") {
      questions.push({
        id: `role-supporting-${scheme.schemeId}`,
        type: "scheme",
        targetSchemeId: scheme.schemeId,
        questionText: `Does "${scheme.schemeName}" adequately support the primary argument?`,
        questionCategory: "Support Sufficiency",
        priority: "medium",
        context: {
          netId: net.id,
          schemeRole: "supporting",
          netType: net.netType,
        },
        relatedSchemes: [scheme.schemeId],
      });
    }

    return questions;
  }

  // ==========================================================================
  // Private Methods: Dependency CQs
  // ==========================================================================

  private async generateDependencyCQs(
    net: NetCandidate,
    dependencyGraph: DependencyGraph,
    explicitnessAnalysis: any
  ): Promise<NetCriticalQuestion[]> {
    const questions: NetCriticalQuestion[] = [];

    for (const dependency of dependencyGraph.edges) {
      const sourceScheme = net.schemes.find(
        (s) => s.schemeId === dependency.sourceSchemeId
      );
      const targetScheme = net.schemes.find(
        (s) => s.schemeId === dependency.targetSchemeId
      );

      if (!sourceScheme || !targetScheme) continue;

      // Type-specific dependency questions
      switch (dependency.type) {
        case "prerequisite":
          questions.push({
            id: `dep-prereq-${dependency.id}`,
            type: "dependency",
            targetDependencyId: dependency.id,
            questionText: `Must "${sourceScheme.schemeName}" be established before "${targetScheme.schemeName}" can be valid?`,
            questionCategory: "Prerequisite Dependency",
            priority: "high",
            context: {
              netId: net.id,
              dependencyType: "prerequisite",
              netType: net.netType,
            },
            suggestedActions: [
              "Verify the logical ordering",
              "Check if the dependency is necessary",
              "Consider alternative orderings",
            ],
            relatedSchemes: [dependency.sourceSchemeId, dependency.targetSchemeId],
          });
          break;

        case "supporting":
          questions.push({
            id: `dep-support-${dependency.id}`,
            type: "dependency",
            targetDependencyId: dependency.id,
            questionText: `How strongly does "${sourceScheme.schemeName}" support "${targetScheme.schemeName}"?`,
            questionCategory: "Supporting Dependency",
            priority: "medium",
            context: {
              netId: net.id,
              dependencyType: "supporting",
              netType: net.netType,
            },
            suggestedActions: [
              "Assess support strength",
              "Look for counterexamples",
              "Consider additional support needed",
            ],
            relatedSchemes: [dependency.sourceSchemeId, dependency.targetSchemeId],
          });
          break;

        case "enabling":
          questions.push({
            id: `dep-enable-${dependency.id}`,
            type: "dependency",
            targetDependencyId: dependency.id,
            questionText: `Does "${sourceScheme.schemeName}" enable "${targetScheme.schemeName}" to be used?`,
            questionCategory: "Enabling Dependency",
            priority: "medium",
            context: {
              netId: net.id,
              dependencyType: "enabling",
              netType: net.netType,
            },
            suggestedActions: [
              "Verify the enabling relationship",
              "Check if alternatives exist",
              "Assess necessity",
            ],
            relatedSchemes: [dependency.sourceSchemeId, dependency.targetSchemeId],
          });
          break;
      }

      // Strength-based CQs
      if (dependency.strength < 0.5) {
        questions.push({
          id: `dep-weak-${dependency.id}`,
          type: "dependency",
          targetDependencyId: dependency.id,
          questionText: `Why is the connection between "${sourceScheme.schemeName}" and "${targetScheme.schemeName}" weak?`,
          questionCategory: "Weak Dependency",
          priority: "high",
          context: {
            netId: net.id,
            dependencyType: dependency.type,
            netType: net.netType,
          },
          suggestedActions: [
            "Strengthen the connection",
            "Add intermediate schemes",
            "Consider removing the dependency",
          ],
          relatedSchemes: [dependency.sourceSchemeId, dependency.targetSchemeId],
        });
      }

      // Explicitness-based CQs
      const relExplicitness = explicitnessAnalysis.relationshipExplicitness.find(
        (r: any) =>
          r.sourceScheme === dependency.sourceSchemeId &&
          r.targetScheme === dependency.targetSchemeId
      );

      if (relExplicitness?.level === "implicit") {
        questions.push({
          id: `dep-implicit-${dependency.id}`,
          type: "dependency",
          targetDependencyId: dependency.id,
          questionText: `Should the connection between "${sourceScheme.schemeName}" and "${targetScheme.schemeName}" be made more explicit?`,
          questionCategory: "Explicitness",
          priority: "medium",
          context: {
            netId: net.id,
            dependencyType: dependency.type,
            netType: net.netType,
          },
          suggestedActions: [
            "Add explicit connectives",
            "Use signposting language",
            "Add transitional text",
          ],
          relatedSchemes: [dependency.sourceSchemeId, dependency.targetSchemeId],
        });
      }
    }

    return questions;
  }

  // ==========================================================================
  // Private Methods: Net Structure CQs
  // ==========================================================================

  private async generateNetStructureCQs(
    net: NetCandidate,
    dependencyGraph: DependencyGraph
  ): Promise<NetCriticalQuestion[]> {
    const questions: NetCriticalQuestion[] = [];

    // Circular dependencies
    if (dependencyGraph.cycles.length > 0) {
      for (const cycle of dependencyGraph.cycles) {
        questions.push({
          id: `net-cycle-${cycle.join("-")}`,
          type: "net-structure",
          questionText: `Does the circular dependency between ${cycle
            .map((id) => {
              const scheme = net.schemes.find((s) => s.schemeId === id);
              return `"${scheme?.schemeName || id}"`;
            })
            .join(", ")} create logical problems?`,
          questionCategory: "Circular Reasoning",
          priority: "critical",
          context: {
            netId: net.id,
            netType: net.netType,
          },
          suggestedActions: [
            "Restructure to eliminate cycle",
            "Verify each step independently",
            "Consider splitting into separate arguments",
          ],
          relatedSchemes: cycle,
        });
      }
    }

    // Orphaned schemes
    const orphanedSchemes = net.schemes.filter(
      (scheme) =>
        !dependencyGraph.edges.some(
          (e) =>
            e.sourceSchemeId === scheme.schemeId ||
            e.targetSchemeId === scheme.schemeId
        )
    );

    if (orphanedSchemes.length > 0 && net.schemes.length > 1) {
      for (const orphan of orphanedSchemes) {
        questions.push({
          id: `net-orphan-${orphan.schemeId}`,
          type: "net-structure",
          targetSchemeId: orphan.schemeId,
          questionText: `How does "${orphan.schemeName}" relate to the rest of the argument?`,
          questionCategory: "Disconnected Scheme",
          priority: "high",
          context: {
            netId: net.id,
            schemeRole: orphan.role,
            netType: net.netType,
          },
          suggestedActions: [
            "Establish connections to other schemes",
            "Clarify the role of this scheme",
            "Consider if this scheme belongs in a different net",
          ],
          relatedSchemes: [orphan.schemeId],
        });
      }
    }

    // Net complexity
    if (net.complexity > 70) {
      questions.push({
        id: `net-complexity-${net.id}`,
        type: "net-structure",
        questionText: `Is this argument net too complex (${net.complexity}/100) to be easily understood?`,
        questionCategory: "Complexity",
        priority: "medium",
        context: {
          netId: net.id,
          netType: net.netType,
        },
        suggestedActions: [
          "Break into smaller sub-arguments",
          "Simplify dependencies",
          "Remove redundant schemes",
        ],
        relatedSchemes: net.schemes.map((s) => s.schemeId),
      });
    }

    // Critical path analysis
    if (dependencyGraph.criticalPath.length > 0) {
      const criticalSchemes = dependencyGraph.criticalPath
        .map((id) => {
          const scheme = net.schemes.find((s) => s.schemeId === id);
          return scheme?.schemeName || id;
        })
        .join(" → ");

      questions.push({
        id: `net-critical-${net.id}`,
        type: "net-structure",
        questionText: `Is the critical path (${criticalSchemes}) sound?`,
        questionCategory: "Critical Path",
        priority: "high",
        context: {
          netId: net.id,
          netType: net.netType,
        },
        suggestedActions: [
          "Verify each step in the path",
          "Check for weak links",
          "Consider alternative paths",
        ],
        relatedSchemes: dependencyGraph.criticalPath,
      });
    }

    return questions;
  }

  // ==========================================================================
  // Private Methods: Explicitness CQs
  // ==========================================================================

  private async generateExplicitnessCQs(
    net: NetCandidate,
    explicitnessAnalysis: any
  ): Promise<NetCriticalQuestion[]> {
    const questions: NetCriticalQuestion[] = [];

    // Overall explicitness
    if (explicitnessAnalysis.overallExplicitness === "implicit") {
      questions.push({
        id: `explicit-overall-${net.id}`,
        type: "explicitness",
        questionText: "Should the overall argument structure be made more explicit?",
        questionCategory: "Explicitness",
        priority: "high",
        context: {
          netId: net.id,
          netType: net.netType,
        },
        suggestedActions: [
          "Add explicit markers for schemes",
          "Clarify relationships between claims",
          "Use signposting language",
        ],
        relatedSchemes: net.schemes.map((s) => s.schemeId),
      });
    }

    // Implicit schemes
    for (const schemeAnalysis of explicitnessAnalysis.schemeExplicitness) {
      if (schemeAnalysis.level === "implicit") {
        const scheme = net.schemes.find(
          (s) => s.schemeId === schemeAnalysis.schemeId
        );
        if (!scheme) continue;

        questions.push({
          id: `explicit-scheme-${scheme.schemeId}`,
          type: "explicitness",
          targetSchemeId: scheme.schemeId,
          questionText: `Should the use of "${scheme.schemeName}" be made more explicit?`,
          questionCategory: "Scheme Explicitness",
          priority: scheme.role === "primary" ? "high" : "medium",
          context: {
            netId: net.id,
            schemeRole: scheme.role,
            netType: net.netType,
          },
          suggestedActions: [
            `Add explicit marker like "I argue using ${scheme.schemeName}..."`,
            "State premises and conclusion clearly",
            "Clarify the reasoning pattern",
          ],
          relatedSchemes: [scheme.schemeId],
        });
      }
    }

    return questions;
  }

  // ==========================================================================
  // Private Methods: Grouping
  // ==========================================================================

  private groupByScheme(questions: NetCriticalQuestion[]): NetCQGroup[] {
    const schemeMap = new Map<string, NetCriticalQuestion[]>();

    // Group by target scheme
    for (const q of questions) {
      if (q.targetSchemeId) {
        if (!schemeMap.has(q.targetSchemeId)) {
          schemeMap.set(q.targetSchemeId, []);
        }
        schemeMap.get(q.targetSchemeId)!.push(q);
      }
    }

    return Array.from(schemeMap.entries()).map(([schemeId, qs]) => {
      // Week 5: Use scheme name from questions if available
      const schemeName = qs[0]?.targetSchemeName || `Scheme ${schemeId}`;
      return {
        groupType: "scheme" as const,
        groupLabel: `Questions for ${schemeName}`,
        groupDescription: "Critical questions targeting this specific scheme",
        targetSchemeId: schemeId,
        questions: qs,
        priority: this.calculateGroupPriority(qs),
      };
    });
  }

  private groupByDependency(questions: NetCriticalQuestion[]): NetCQGroup[] {
    const dependencyQuestions = questions.filter((q) => q.type === "dependency");

    if (dependencyQuestions.length === 0) {
      return [];
    }

    return [
      {
        groupType: "dependency" as const,
        groupLabel: "Dependency Questions",
        groupDescription: "Questions about relationships between schemes",
        questions: dependencyQuestions,
        priority: this.calculateGroupPriority(dependencyQuestions),
      },
    ];
  }

  private groupByAttackType(questions: NetCriticalQuestion[]): NetCQGroup[] {
    const groups: NetCQGroup[] = [];

    // Group by question category
    const categoryMap = new Map<string, NetCriticalQuestion[]>();

    for (const q of questions) {
      if (!categoryMap.has(q.questionCategory)) {
        categoryMap.set(q.questionCategory, []);
      }
      categoryMap.get(q.questionCategory)!.push(q);
    }

    for (const [category, qs] of categoryMap.entries()) {
      groups.push({
        groupType: "attack-type" as const,
        groupLabel: category,
        groupDescription: `Questions in the "${category}" category`,
        questions: qs,
        priority: this.calculateGroupPriority(qs),
      });
    }

    return groups;
  }

  private groupByBurden(questions: NetCriticalQuestion[]): NetCQGroup[] {
    // Group by who bears the burden of proof
    const proponentBurden = questions.filter((q) =>
      q.questionCategory.includes("Support") ||
      q.questionCategory.includes("Sufficiency")
    );

    const opponentBurden = questions.filter((q) =>
      q.questionCategory.includes("Counterexample") ||
      q.questionCategory.includes("Alternative")
    );

    const sharedBurden = questions.filter(
      (q) =>
        !proponentBurden.includes(q) && !opponentBurden.includes(q)
    );

    return [
      {
        groupType: "burden" as const,
        groupLabel: "Proponent's Burden",
        groupDescription: "Questions that the argument maker should address",
        questions: proponentBurden,
        priority: this.calculateGroupPriority(proponentBurden),
      },
      {
        groupType: "burden" as const,
        groupLabel: "Opponent's Burden",
        groupDescription: "Questions that challengers should address",
        questions: opponentBurden,
        priority: this.calculateGroupPriority(opponentBurden),
      },
      {
        groupType: "burden" as const,
        groupLabel: "Shared Burden",
        groupDescription: "Questions requiring collaborative exploration",
        questions: sharedBurden,
        priority: this.calculateGroupPriority(sharedBurden),
      },
    ].filter((g) => g.questions.length > 0);
  }

  private groupByPriority(questions: NetCriticalQuestion[]): NetCQGroup[] {
    const critical = questions.filter((q) => q.priority === "critical");
    const high = questions.filter((q) => q.priority === "high");
    const medium = questions.filter((q) => q.priority === "medium");
    const low = questions.filter((q) => q.priority === "low");

    return [
      {
        groupType: "net-level" as const,
        groupLabel: "Critical Issues",
        groupDescription: "Must be addressed immediately",
        questions: critical,
        priority: "critical" as const,
      },
      {
        groupType: "net-level" as const,
        groupLabel: "High Priority",
        groupDescription: "Should be addressed soon",
        questions: high,
        priority: "high" as const,
      },
      {
        groupType: "net-level" as const,
        groupLabel: "Medium Priority",
        groupDescription: "Important but not urgent",
        questions: medium,
        priority: "medium" as const,
      },
      {
        groupType: "net-level" as const,
        groupLabel: "Low Priority",
        groupDescription: "Optional improvements",
        questions: low,
        priority: "low" as const,
      },
    ].filter((g) => g.questions.length > 0);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private determinePriority(
    scheme: SchemeInstance,
    cq: any
  ): "critical" | "high" | "medium" | "low" {
    // Primary schemes get higher priority
    if (scheme.role === "primary") {
      return (cq.cqKey?.includes("exception") || cq.attackType === "UNDERCUTS") ? "critical" : "high";
    }

    // Low confidence schemes need more scrutiny
    if (scheme.confidence < 50) {
      return "high";
    }

    return "medium";
  }

  /**
   * Week 5 Task 5.3: Determine burden of proof for a CQ
   * 
   * Burden logic:
   * - "proponent": Asking the question alone shifts burden back (easy for challenger)
   * - "challenger": Requires evidence to make the challenge stick (hard for challenger)
   */
  private determineBurden(
    cq: any,
    scheme: SchemeInstance
  ): { burdenOfProof: "proponent" | "challenger"; requiresEvidence: boolean } {
    const cqKeyLower = (cq.cqKey || "").toLowerCase();
    
    // CQs that require evidence (challenger bears burden)
    if (
      cqKeyLower.includes("bias") ||
      cqKeyLower.includes("inconsistent") ||
      cqKeyLower.includes("conflict") ||
      cqKeyLower.includes("exception") ||
      cq.attackType === "UNDERMINES"
    ) {
      return {
        burdenOfProof: "challenger",
        requiresEvidence: true,
      };
    }

    // CQs that are challenging but don't require hard evidence (moderate)
    if (
      cqKeyLower.includes("plausible") ||
      cqKeyLower.includes("acceptable") ||
      cqKeyLower.includes("relevant") ||
      scheme.confidence < 60
    ) {
      return {
        burdenOfProof: "challenger",
        requiresEvidence: false,
      };
    }

    // Default: Proponent bears burden (question alone shifts burden back)
    // These are "advantage" questions for the challenger
    return {
      burdenOfProof: "proponent",
      requiresEvidence: false,
    };
  }

  private generateActions(cq: any, scheme: SchemeInstance): string[] {
    const actions: string[] = [];

    const cqKeyLower = (cq.cqKey || "").toLowerCase();
    
    if (cqKeyLower.includes("exception")) {
      actions.push("Identify potential exceptions");
      actions.push("Provide evidence exceptions don't apply");
    }

    if (cqKeyLower.includes("source") || cqKeyLower.includes("expert")) {
      actions.push("Verify source credibility");
      actions.push("Check for bias");
    }

    if (cq.attackType === "UNDERCUTS") {
      actions.push("Defend the reasoning process");
    }

    return actions;
  }

  private calculateGroupPriority(
    questions: NetCriticalQuestion[]
  ): "critical" | "high" | "medium" | "low" {
    if (questions.some((q) => q.priority === "critical")) return "critical";
    if (questions.some((q) => q.priority === "high")) return "high";
    if (questions.some((q) => q.priority === "medium")) return "medium";
    return "low";
  }
}
