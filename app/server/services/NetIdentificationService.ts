import { prisma } from "@/lib/prismaclient";

// ============================================================================
// Types
// ============================================================================

export interface SchemeInstance {
  schemeId: string;
  schemeName: string;
  schemeCategory: string;
  confidence: number; // 0-100
  premises: Array<{
    key: string;
    text: string;
    isFilled: boolean;
    evidenceIds: string[];
  }>;
  conclusion: string;
  role: "primary" | "supporting" | "subordinate";
  span: {
    argumentId: string;
    premiseKeys: string[];
    conclusionKey?: string;
  };
}

export interface NetCandidate {
  id: string;
  deliberationId: string;
  rootArgumentId: string;
  schemes: SchemeInstance[];
  netType: "convergent" | "linked" | "serial" | "divergent" | "hybrid";
  complexity: number; // 0-100
  confidence: number; // 0-100
  relationships: Array<{
    sourceScheme: string;
    targetScheme: string;
    type: "supports" | "depends-on" | "challenges" | "refines";
    strength: number;
  }>;
  dependencyGraph: {
    nodes: Array<{
      schemeId: string;
      schemeName: string;
      schemeCategory: string;
      role: string;
      depth: number;
    }>;
    edges: Array<{
      sourceSchemeId: string;
      targetSchemeId: string;
      type: string;
      strength: number;
      criticality: string;
      explanation: string;
    }>;
    cycles: string[][];
    criticalPath: string[];
  };
  explicitnessAnalysis: {
    overallExplicitness: string;
    confidence: number;
    schemeExplicitness: Array<{
      schemeId: string;
      level: string;
      confidence: number;
    }>;
    relationshipExplicitness: Array<{
      sourceScheme: string;
      targetScheme: string;
      level: string;
      confidence: number;
    }>;
  };
  detection: {
    method: "structural" | "semantic" | "hybrid";
    timestamp: Date;
    signals: string[];
  };
}

// ============================================================================
// Main Service
// ============================================================================

export class NetIdentificationService {
  /**
   * Analyze an argument to detect if it contains multiple schemes (a net)
   */
  public async detectMultiScheme(argumentId: string): Promise<NetCandidate | null> {
    const argument = await this.fetchArgumentWithContext(argumentId);

    if (!argument) {
      return null;
    }

    // PRIORITY 1: Check for explicit SchemeNet in database (Phase 4+)
    const explicitNet = await this.fetchExplicitSchemeNet(argumentId);
    if (explicitNet) {
      return explicitNet;
    }

    // PRIORITY 2: Check for multiple ArgumentSchemeInstance records (Phase 4+)
    const schemeInstancesNet = await this.fetchSchemeInstancesAsNet(argumentId);
    if (schemeInstancesNet) {
      return schemeInstancesNet;
    }

    // PRIORITY 3: Heuristic detection (fallback for legacy arguments)
    // Step 1: Detect potential scheme instances
    const schemeInstances = await this.identifySchemeInstances(argument);

    // If only one scheme detected, not a net
    if (schemeInstances.length <= 1) {
      return null;
    }

    // Step 2: Analyze relationships between schemes
    const relationships = await this.analyzeSchemeRelationships(
      schemeInstances,
      argument
    );

    // Step 3: Classify net type
    const netType = this.classifyNetType(schemeInstances, relationships);

    // Step 4: Calculate complexity and confidence
    const complexity = this.calculateComplexity(schemeInstances, relationships);
    const confidence = this.calculateDetectionConfidence(
      schemeInstances,
      relationships
    );

    // Only return if confidence is high enough
    if (confidence < 60) {
      return null;
    }

    return {
      id: `net-${argumentId}-${Date.now()}`,
      deliberationId: argument.deliberationId,
      rootArgumentId: argumentId,
      schemes: schemeInstances,
      netType,
      complexity,
      confidence,
      relationships,
      dependencyGraph: {
        nodes: schemeInstances.map((s, index) => ({
          schemeId: s.schemeId,
          schemeName: s.schemeName,
          schemeCategory: s.schemeCategory,
          role: s.role,
          depth: index,
        })),
        edges: relationships.map((r: any) => ({
          sourceSchemeId: r.sourceScheme,
          targetSchemeId: r.targetScheme,
          type: r.type,
          strength: r.strength,
          criticality: "normal",
          explanation: `${r.type} relationship`,
        })),
        cycles: [],
        criticalPath: schemeInstances.map((s) => s.schemeId),
      },
      explicitnessAnalysis: {
        overallExplicitness: "hybrid",
        confidence: confidence,
        schemeExplicitness: schemeInstances.map((s) => ({
          schemeId: s.schemeId,
          level: s.role === "primary" ? "explicit" : s.role === "supporting" ? "presupposed" : "implicit",
          confidence: s.confidence,
        })),
        relationshipExplicitness: relationships.map((r: any) => ({
          sourceScheme: r.sourceScheme,
          targetScheme: r.targetScheme,
          level: r.type === "supports" ? "presupposed" : "implicit",
          confidence: r.strength * 100,
        })),
      },
      detection: {
        method: "hybrid",
        timestamp: new Date(),
        signals: this.extractDetectionSignals(schemeInstances, relationships),
      },
    };
  }

  /**
   * Batch analyze multiple arguments in a deliberation
   */
  public async detectNetsInDeliberation(
    deliberationId: string
  ): Promise<NetCandidate[]> {
    const argumentsInDelib = await prisma.argument.findMany({
      where: { deliberationId },
      select: { id: true },
    });

    const netCandidates: NetCandidate[] = [];

    for (const argument of argumentsInDelib) {
      const netCandidate = await this.detectMultiScheme(argument.id);
      if (netCandidate) {
        netCandidates.push(netCandidate);
      }
    }

    // Merge overlapping net candidates
    return this.mergeOverlappingNets(netCandidates);
  }

  // ============================================================================
  // Private Methods: Explicit Net Detection (Phase 4+)
  // ============================================================================

  /**
   * Check if argument has an explicit SchemeNet record in database
   * This is the highest priority detection method for Phase 4+ arguments
   */
  private async fetchExplicitSchemeNet(
    argumentId: string
  ): Promise<NetCandidate | null> {
    const schemeNet = await prisma.schemeNet.findUnique({
      where: { argumentId },
      include: {
        steps: {
          include: {
            scheme: true,
          },
          orderBy: { stepOrder: "asc" },
        },
        argument: {
          include: {
            deliberation: true,
          },
        },
      },
    });

    if (!schemeNet || schemeNet.steps.length <= 1) {
      return null;
    }

    // Convert SchemeNet to NetCandidate format
    const schemes: SchemeInstance[] = schemeNet.steps.map((step) => ({
      schemeId: step.schemeId,
      schemeName: step.scheme.name || "Unknown Scheme",
      schemeCategory: this.extractCategory(step.scheme),
      confidence: step.confidence * 100, // DB stores 0-1, we use 0-100
      premises: [], // Will be populated from step text
      conclusion: step.stepText || schemeNet.argument.text,
      role: step.stepOrder === 1 ? "primary" : "supporting",
      span: {
        argumentId: argumentId,
        premiseKeys: [],
        conclusionKey: "conclusion",
      },
    }));

    // Build relationships from sequential structure
    const relationships: Array<{
      sourceScheme: string;
      targetScheme: string;
      type: "supports" | "depends-on" | "challenges" | "refines";
      strength: number;
    }> = [];
    for (let i = 0; i < schemeNet.steps.length - 1; i++) {
      const currentStep = schemeNet.steps[i];
      const nextStep = schemeNet.steps[i + 1];

      relationships.push({
        sourceScheme: currentStep.schemeId,
        targetScheme: nextStep.schemeId,
        type: "supports" as const,
        strength: Math.min(currentStep.confidence, nextStep.confidence),
      });
    }

    return {
      id: schemeNet.id,
      deliberationId: schemeNet.argument.deliberationId,
      rootArgumentId: argumentId,
      schemes,
      netType: "serial", // Sequential composition is serial
      complexity: Math.min(100, schemes.length * 20),
      confidence: schemeNet.overallConfidence * 100,
      relationships,
      dependencyGraph: {
        nodes: schemes.map((s, index) => ({
          schemeId: s.schemeId,
          schemeName: s.schemeName,
          schemeCategory: s.schemeCategory,
          role: s.role,
          depth: index,
        })),
        edges: relationships.map((r) => ({
          sourceSchemeId: r.sourceScheme,
          targetSchemeId: r.targetScheme,
          type: r.type,
          strength: r.strength,
          criticality: "normal",
          explanation: `${r.type} relationship`,
        })),
        cycles: [],
        criticalPath: schemes.map((s) => s.schemeId),
      },
      explicitnessAnalysis: {
        overallExplicitness: "explicit",
        confidence: schemes.reduce((sum, s) => sum + s.confidence, 0) / schemes.length,
        schemeExplicitness: schemes.map((s) => ({
          schemeId: s.schemeId,
          level: "explicit",
          confidence: s.confidence,
        })),
        relationshipExplicitness: relationships.map((r) => ({
          sourceScheme: r.sourceScheme,
          targetScheme: r.targetScheme,
          level: "explicit",
          confidence: r.strength * 100,
        })),
      },
      detection: {
        method: "structural",
        timestamp: schemeNet.createdAt,
        signals: [
          `Explicit SchemeNet with ${schemes.length} steps`,
          `Overall confidence: ${schemeNet.overallConfidence}`,
          schemeNet.description || "",
        ].filter(Boolean),
      },
    };
  }

  /**
   * Check if argument has multiple ArgumentSchemeInstance records
   * This is the second priority detection method for Phase 4+ arguments
   */
  private async fetchSchemeInstancesAsNet(
    argumentId: string
  ): Promise<NetCandidate | null> {
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      include: {
        argumentSchemes: {
          include: {
            scheme: true,
          },
          orderBy: { order: "asc" },
        },
        deliberation: true,
        schemeNet: true, // Include SchemeNet to check for custom dependencies
      },
    });

    if (!argument || argument.argumentSchemes.length <= 1) {
      return null;
    }

    // Convert ArgumentSchemeInstances to SchemeInstance format
    const schemes: SchemeInstance[] = argument.argumentSchemes.map((instance) => ({
      schemeId: instance.schemeId,
      schemeName: instance.scheme.name || "Unknown Scheme",
      schemeCategory: this.extractCategory(instance.scheme),
      confidence: instance.confidence * 100,
      premises: [], // Will be extracted from textEvidence if available
      conclusion: argument.text,
      role: instance.role as "primary" | "supporting" | "subordinate",
      span: {
        argumentId: argumentId,
        premiseKeys: [],
        conclusionKey: "conclusion",
      },
    }));

    // Check for custom dependencies from SchemeNet (Phase 2 Feature #2)
    let customDependencies: Array<{
      from: string;
      to: string;
      type: string;
      explanation?: string;
    }> = [];
    
    if (argument.schemeNet?.description) {
      try {
        const parsed = JSON.parse(argument.schemeNet.description);
        customDependencies = parsed.dependencies || [];
      } catch {
        // Not JSON or no dependencies, that's okay
      }
    }

    // Build relationships: prioritize custom dependencies, fall back to role-based inference
    const relationships: Array<{
      sourceScheme: string;
      targetScheme: string;
      type: "supports" | "depends-on" | "challenges" | "refines";
      strength: number;
    }> = [];

    if (customDependencies.length > 0) {
      // Use custom dependencies
      for (const dep of customDependencies) {
        // Map custom types to service types
        const mappedType = 
          dep.type === "sequential" || dep.type === "support" ? "supports" :
          dep.type === "presuppositional" || dep.type === "justificational" ? "depends-on" :
          "supports"; // default
        
        relationships.push({
          sourceScheme: dep.from,
          targetScheme: dep.to,
          type: mappedType as "supports" | "depends-on",
          strength: 0.9, // High strength for manually defined dependencies
        });
      }
    } else {
      // Fall back to role-based inference
      const primaryScheme = schemes.find((s) => s.role === "primary");

      if (primaryScheme) {
        for (const scheme of schemes) {
          if (scheme.role !== "primary") {
            relationships.push({
              sourceScheme: scheme.schemeId,
              targetScheme: primaryScheme.schemeId,
              type: "supports" as const,
              strength: scheme.confidence / 100,
            });
          }
        }
      }
    }

    return {
      id: `net-instances-${argumentId}`,
      deliberationId: argument.deliberationId,
      rootArgumentId: argumentId,
      schemes,
      netType: this.classifyNetType(schemes, relationships),
      complexity: Math.min(100, schemes.length * 20),
      confidence: schemes.reduce((sum, s) => sum + s.confidence, 0) / schemes.length,
      relationships,
      dependencyGraph: {
        nodes: schemes.map((s, index) => ({
          schemeId: s.schemeId,
          schemeName: s.schemeName,
          schemeCategory: s.schemeCategory,
          role: s.role,
          depth: index,
        })),
        edges: relationships.map((r) => {
          // Find custom explanation if it exists
          const customDep = customDependencies.find(
            (d) => d.from === r.sourceScheme && d.to === r.targetScheme
          );
          
          return {
            sourceSchemeId: r.sourceScheme,
            targetSchemeId: r.targetScheme,
            type: r.type,
            strength: r.strength,
            criticality: "normal",
            explanation: customDep?.explanation || `${r.type} relationship`,
          };
        }),
        cycles: [],
        criticalPath: schemes.map((s) => s.schemeId),
      },
      explicitnessAnalysis: {
        overallExplicitness: "explicit",
        confidence: schemes.reduce((sum, s) => sum + s.confidence, 0) / schemes.length,
        schemeExplicitness: schemes.map((s) => ({
          schemeId: s.schemeId,
          level: "explicit",
          confidence: s.confidence,
        })),
        relationshipExplicitness: relationships.map((r) => ({
          sourceScheme: r.sourceScheme,
          targetScheme: r.targetScheme,
          level: "explicit",
          confidence: r.strength * 100,
        })),
      },
      detection: {
        method: "structural",
        timestamp: new Date(),
        signals: [
          `${schemes.length} ArgumentSchemeInstances`,
          `Roles: ${schemes.map((s) => s.role).join(", ")}`,
        ],
      },
    };
  }

  // ============================================================================
  // Private Methods: Scheme Detection
  // ============================================================================

  private async identifySchemeInstances(
    argument: any
  ): Promise<SchemeInstance[]> {
    const instances: SchemeInstance[] = [];

    // Method 1: Explicit scheme (already assigned)
    if (argument.schemeId && argument.scheme) {
      const explicitScheme = await this.createSchemeInstance(
        argument.scheme,
        argument,
        "primary",
        95
      );
      instances.push(explicitScheme);
    }

    // Method 2: Structural analysis - look for embedded schemes
    const embeddedSchemes = await this.detectEmbeddedSchemes(argument);
    instances.push(...embeddedSchemes);

    // Method 3: Semantic analysis - analyze premise patterns
    const semanticSchemes = await this.detectSemanticSchemes(argument);
    instances.push(...semanticSchemes);

    // Deduplicate similar schemes
    return this.deduplicateSchemes(instances);
  }

  private async detectEmbeddedSchemes(argument: any): Promise<SchemeInstance[]> {
    const embedded: SchemeInstance[] = [];
    const premises = this.extractPremises(argument);

    // Look for premises that themselves contain scheme patterns
    for (const premise of premises) {
      const premiseText = premise.text.toLowerCase();

      // Expert opinion pattern
      if (
        premiseText.includes("expert") ||
        premiseText.includes("according to") ||
        premiseText.includes("research shows")
      ) {
        const expertScheme = await prisma.argumentScheme.findFirst({
          where: { key: { contains: "expert" } },
        });
        if (expertScheme) {
          const instance = await this.createSchemeInstance(
            expertScheme,
            argument,
            "supporting",
            70
          );
          embedded.push(instance);
        }
      }

      // Causal pattern
      if (
        premiseText.includes("because") ||
        premiseText.includes("causes") ||
        premiseText.includes("leads to") ||
        premiseText.includes("results in")
      ) {
        const causalScheme = await prisma.argumentScheme.findFirst({
          where: { key: { contains: "cause" } },
        });
        if (causalScheme) {
          const instance = await this.createSchemeInstance(
            causalScheme,
            argument,
            "supporting",
            65
          );
          embedded.push(instance);
        }
      }

      // Analogy pattern
      if (
        premiseText.includes("similar to") ||
        premiseText.includes("like") ||
        premiseText.includes("analogous")
      ) {
        const analogyScheme = await prisma.argumentScheme.findFirst({
          where: { key: { contains: "analogy" } },
        });
        if (analogyScheme) {
          const instance = await this.createSchemeInstance(
            analogyScheme,
            argument,
            "supporting",
            60
          );
          embedded.push(instance);
        }
      }
    }

    return embedded;
  }

  private async detectSemanticSchemes(
    argument: any
  ): Promise<SchemeInstance[]> {
    const semantic: SchemeInstance[] = [];

    // Use premise structure and content to infer schemes
    const premises = this.extractPremises(argument);
    const premiseTexts = premises.map((p: any) => p.text).join(" ");

    // Get all schemes and calculate similarity
    const allSchemes = await prisma.argumentScheme.findMany({
      take: 20, // Limit for performance
    });

    for (const scheme of allSchemes) {
      // Skip the primary scheme if already assigned
      if (argument.schemeId === scheme.id) continue;

      const similarity = await this.calculateSchemeSimilarity(
        premiseTexts,
        scheme
      );

      // If similarity is high enough, consider it a subordinate scheme
      if (similarity > 0.3) {
        const instance = await this.createSchemeInstance(
          scheme,
          argument,
          "subordinate",
          similarity * 100
        );
        semantic.push(instance);
      }
    }

    return semantic;
  }

  private async createSchemeInstance(
    scheme: any,
    argument: any,
    role: "primary" | "supporting" | "subordinate",
    confidence: number
  ): Promise<SchemeInstance> {
    const premises = this.extractPremises(argument).map((p: any) => ({
      key: p.key || `premise-${p.id}`,
      text: p.text || "",
      isFilled: !!p.text,
      evidenceIds: [],
    }));

    return {
      schemeId: scheme.id,
      schemeName: scheme.name || "Unknown Scheme",
      schemeCategory: this.extractCategory(scheme),
      confidence,
      premises,
      conclusion: argument.text || "",
      role,
      span: {
        argumentId: argument.id,
        premiseKeys: premises.map((p) => p.key),
        conclusionKey: "conclusion",
      },
    };
  }

  private deduplicateSchemes(schemes: SchemeInstance[]): SchemeInstance[] {
    const seen = new Map<string, SchemeInstance>();

    for (const scheme of schemes) {
      const key = `${scheme.schemeId}-${scheme.role}`;
      if (!seen.has(key) || seen.get(key)!.confidence < scheme.confidence) {
        seen.set(key, scheme);
      }
    }

    return Array.from(seen.values());
  }

  // ============================================================================
  // Private Methods: Relationship Analysis
  // ============================================================================

  private async analyzeSchemeRelationships(
    schemes: SchemeInstance[],
    argument: any
  ): Promise<Array<any>> {
    const relationships = [];

    // Analyze pairwise relationships
    for (let i = 0; i < schemes.length; i++) {
      for (let j = i + 1; j < schemes.length; j++) {
        const relationship = await this.inferRelationship(
          schemes[i],
          schemes[j],
          argument
        );
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  private async inferRelationship(
    source: SchemeInstance,
    target: SchemeInstance,
    argument: any
  ): Promise<any | null> {
    // Check for support relationships
    if (source.role === "supporting" && target.role === "primary") {
      return {
        sourceScheme: source.schemeId,
        targetScheme: target.schemeId,
        type: "supports",
        strength: 0.8,
      };
    }

    // Check for dependency relationships
    if (source.role === "subordinate" || target.role === "subordinate") {
      // Analyze premise dependencies
      const sourcePremises = new Set(source.premises.map((p) => p.text));
      const targetPremises = new Set(target.premises.map((p) => p.text));
      const overlap = [...sourcePremises].filter((p) => targetPremises.has(p));

      if (overlap.length > 0) {
        return {
          sourceScheme: source.schemeId,
          targetScheme: target.schemeId,
          type: "depends-on",
          strength: overlap.length / Math.max(sourcePremises.size, 1),
        };
      }
    }

    // Check for refinement relationships
    if (source.schemeCategory === target.schemeCategory) {
      return {
        sourceScheme: source.schemeId,
        targetScheme: target.schemeId,
        type: "refines",
        strength: 0.5,
      };
    }

    return null;
  }

  // ============================================================================
  // Private Methods: Net Classification
  // ============================================================================

  private classifyNetType(
    schemes: SchemeInstance[],
    relationships: Array<any>
  ): "convergent" | "linked" | "serial" | "divergent" | "hybrid" {
    const supportCount = relationships.filter((r) => r.type === "supports")
      .length;
    const dependsCount = relationships.filter((r) => r.type === "depends-on")
      .length;
    const primary = schemes.find((s) => s.role === "primary");
    const supporting = schemes.filter((s) => s.role === "supporting");

    // Convergent: multiple independent schemes support conclusion
    if (supporting.length >= 2 && supportCount >= 2 && dependsCount === 0) {
      return "convergent";
    }

    // Linked: schemes depend on each other
    if (dependsCount >= relationships.length * 0.5) {
      return "linked";
    }

    // Serial: chain of schemes
    if (schemes.length >= 3 && this.isSerialChain(schemes, relationships)) {
      return "serial";
    }

    // Divergent: one scheme supports multiple conclusions
    if (primary && supporting.length === 0 && schemes.length >= 2) {
      return "divergent";
    }

    // Hybrid: mixed structure
    return "hybrid";
  }

  private isSerialChain(
    schemes: SchemeInstance[],
    relationships: Array<any>
  ): boolean {
    // Check if schemes form a linear chain
    const graph = new Map<string, string[]>();

    for (const rel of relationships) {
      if (!graph.has(rel.sourceScheme)) {
        graph.set(rel.sourceScheme, []);
      }
      graph.get(rel.sourceScheme)!.push(rel.targetScheme);
    }

    // Simple chain detection (can be enhanced)
    for (const [_, targets] of graph) {
      if (targets.length > 1) return false; // Branching
    }

    return true;
  }

  // ============================================================================
  // Private Methods: Metrics
  // ============================================================================

  private calculateComplexity(
    schemes: SchemeInstance[],
    relationships: Array<any>
  ): number {
    // Factors: number of schemes, relationships, premise overlap
    const schemeCount = schemes.length;
    const relationshipCount = relationships.length;
    const avgConfidence =
      schemes.reduce((sum, s) => sum + s.confidence, 0) / schemes.length;

    // Normalize to 0-100
    const complexity = Math.min(
      100,
      schemeCount * 15 +
        relationshipCount * 10 +
        (100 - avgConfidence) * 0.5
    );

    return Math.round(complexity);
  }

  private calculateDetectionConfidence(
    schemes: SchemeInstance[],
    relationships: Array<any>
  ): number {
    // High confidence if:
    // - Multiple schemes detected with high individual confidence
    // - Clear relationships between schemes
    // - Consistent roles

    const avgSchemeConfidence =
      schemes.reduce((sum, s) => sum + s.confidence, 0) / schemes.length;
    const relationshipStrength =
      relationships.reduce((sum, r) => sum + r.strength, 0) /
      Math.max(relationships.length, 1);
    const hasRoleVariety = new Set(schemes.map((s) => s.role)).size > 1;

    const confidence =
      avgSchemeConfidence * 0.5 +
      relationshipStrength * 30 +
      (hasRoleVariety ? 20 : 0);

    return Math.min(100, Math.round(confidence));
  }

  private extractDetectionSignals(
    schemes: SchemeInstance[],
    relationships: Array<any>
  ): string[] {
    const signals: string[] = [];

    signals.push(`${schemes.length} schemes detected`);
    signals.push(`${relationships.length} inter-scheme relationships`);

    const primary = schemes.find((s) => s.role === "primary");
    const supporting = schemes.filter((s) => s.role === "supporting");
    const subordinate = schemes.filter((s) => s.role === "subordinate");

    if (primary) signals.push("Primary scheme identified");
    if (supporting.length > 0)
      signals.push(`${supporting.length} supporting schemes`);
    if (subordinate.length > 0)
      signals.push(`${subordinate.length} subordinate schemes`);

    const categories = new Set(schemes.map((s) => s.schemeCategory));
    if (categories.size > 1)
      signals.push(`${categories.size} scheme categories involved`);

    return signals;
  }

  // ============================================================================
  // Private Methods: Utility
  // ============================================================================

  private async fetchArgumentWithContext(argumentId: string): Promise<any> {
    return await prisma.argument.findUnique({
      where: { id: argumentId },
      include: {
        scheme: true,
        deliberation: true,
      },
    });
  }

  private extractPremises(argument: any): Array<any> {
    // Extract premises from argument structure
    // This is a simplified version - actual implementation depends on data model
    if (argument.premises && Array.isArray(argument.premises)) {
      return argument.premises;
    }

    // Fallback: parse from text if structured premises not available
    const text = argument.text || "";
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);

    return sentences.map((sentence: string, index: number) => ({
      id: `premise-${index}`,
      key: `p${index + 1}`,
      text: sentence.trim(),
    }));
  }

  private extractCategory(scheme: any): string {
    // Extract category from scheme metadata
    if (scheme.category) return scheme.category;
    if (scheme.tags && Array.isArray(scheme.tags) && scheme.tags.length > 0) {
      return scheme.tags[0];
    }
    return "general";
  }

  private async calculateSchemeSimilarity(
    argumentText: string,
    scheme: any
  ): Promise<number> {
    // Simplified semantic similarity
    // In production, use embeddings or ML model
    const argWords = new Set(argumentText.toLowerCase().split(/\s+/));
    const schemeText = `${scheme.name} ${scheme.description || ""}`;
    const schemeWords = new Set(schemeText.toLowerCase().split(/\s+/));

    const intersection = new Set(
      [...argWords].filter((w) => schemeWords.has(w))
    );
    const union = new Set([...argWords, ...schemeWords]);

    return intersection.size / union.size;
  }

  private mergeOverlappingNets(candidates: NetCandidate[]): NetCandidate[] {
    // Simple merge: if nets share arguments, merge them
    // More sophisticated logic can be added
    const merged: NetCandidate[] = [];
    const processed = new Set<string>();

    for (const candidate of candidates) {
      if (processed.has(candidate.id)) continue;

      const overlapping = candidates.filter(
        (other) =>
          other.id !== candidate.id &&
          !processed.has(other.id) &&
          this.netsOverlap(candidate, other)
      );

      if (overlapping.length > 0) {
        const mergedNet = this.mergeNetCandidates(candidate, overlapping);
        merged.push(mergedNet);
        processed.add(candidate.id);
        overlapping.forEach((n) => processed.add(n.id));
      } else {
        merged.push(candidate);
        processed.add(candidate.id);
      }
    }

    return merged;
  }

  private netsOverlap(net1: NetCandidate, net2: NetCandidate): boolean {
    const schemes1 = new Set(net1.schemes.map((s) => s.schemeId));
    const schemes2 = new Set(net2.schemes.map((s) => s.schemeId));

    const intersection = [...schemes1].filter((s) => schemes2.has(s));
    return intersection.length > 0;
  }

  private mergeNetCandidates(
    primary: NetCandidate,
    others: NetCandidate[]
  ): NetCandidate {
    const allSchemes = [primary, ...others].flatMap((n) => n.schemes);
    const allRelationships = [primary, ...others].flatMap(
      (n) => n.relationships
    );

    // Deduplicate
    const uniqueSchemes = this.deduplicateSchemes(allSchemes);
    const uniqueRelationships = this.deduplicateRelationships(allRelationships);

    return {
      ...primary,
      schemes: uniqueSchemes,
      relationships: uniqueRelationships,
      complexity: this.calculateComplexity(uniqueSchemes, uniqueRelationships),
      confidence: this.calculateDetectionConfidence(
        uniqueSchemes,
        uniqueRelationships
      ),
    };
  }

  private deduplicateRelationships(relationships: Array<any>): Array<any> {
    const seen = new Map<string, any>();

    for (const rel of relationships) {
      const key = `${rel.sourceScheme}-${rel.targetScheme}-${rel.type}`;
      if (!seen.has(key) || seen.get(key)!.strength < rel.strength) {
        seen.set(key, rel);
      }
    }

    return Array.from(seen.values());
  }
}
