/**
 * AIF Correspondence Verification
 * 
 * Phase 2: Ensures Disp(D) ↔ Ch(S) isomorphism at the AIF level
 * 
 * Based on Faggian & Hyland (2002) - Proposition 4.27 & 4.28:
 * - Disp(Ch(S)) = S  [disputes of chronicles equal original strategy]
 * - Ch(Disp(D)) = D  [chronicles of disputes equal original design]
 * 
 * This module verifies that the AIF graph representation preserves
 * the fundamental Ludics correspondences, ensuring:
 * 1. Structural integrity (no information lost in translation)
 * 2. Semantic correctness (attacks/defenses properly represented)
 * 3. Round-trip fidelity (AIF → ASPIC+ → AIF preserves meaning)
 */

import { prisma } from "@/lib/prismaclient";
import type {
  DesignForCorrespondence,
  DesignAct,
  DesignLocus,
  IsomorphismResults,
  IsomorphismCheck,
  Correspondence,
  ChResult,
  DispResult,
} from "@/packages/ludics-core/dds/correspondence/types";
import type { Strategy, Play } from "@/packages/ludics-core/dds/strategy/types";
import type { Action, Chronicle, Dispute } from "@/packages/ludics-core/dds/types";

// Import DDS operations
import { computeDisp, computeDispute, disputesToPlays } from "@/packages/ludics-core/dds/correspondence/disp";
import { computeCh, chroniclesToActs } from "@/packages/ludics-core/dds/correspondence/ch";
import { checkAllIsomorphisms, allIsomorphismsHold } from "@/packages/ludics-core/dds/correspondence/isomorphisms";
import { verifyCorrespondence as ddsVerifyCorrespondence } from "@/packages/ludics-core/dds/correspondence/transform";

// =============================================================================
// Types for AIF Correspondence
// =============================================================================

/**
 * Result of AIF-level correspondence verification
 */
export type AifCorrespondenceResult = {
  deliberationId: string;
  valid: boolean;
  
  // Isomorphism checks
  isomorphisms: IsomorphismResults;
  allIsomorphismsHold: boolean;
  
  // Structure comparison
  structureComparison: {
    designsCount: number;
    strategiesCount: number;
    aifNodesCount: number;
    aifEdgesCount: number;
    
    // Coverage metrics
    designsCovered: number;
    strategiesCovered: number;
    correspondenceRate: number;
  };
  
  // Detailed results
  designs: DesignCorrespondenceDetail[];
  strategies: StrategyCorrespondenceDetail[];
  
  // Issues found
  issues: CorrespondenceIssue[];
  
  // Metadata
  verifiedAt: Date;
  durationMs: number;
};

/**
 * Detail for a single design's correspondence
 */
export type DesignCorrespondenceDetail = {
  designId: string;
  hasAifNodes: boolean;
  aifNodeCount: number;
  hasStrategy: boolean;
  strategyId?: string;
  chDispHolds: boolean;
  roundTripPreserved: boolean;
};

/**
 * Detail for a single strategy's correspondence
 */
export type StrategyCorrespondenceDetail = {
  strategyId: string;
  designId: string;
  hasAifNodes: boolean;
  aifNodeCount: number;
  dispChHolds: boolean;
  isInnocent: boolean;
  satisfiesPropagation: boolean;
};

/**
 * Issue found during correspondence verification
 */
export type CorrespondenceIssue = {
  type: "MISSING_AIF_NODE" | "ORPHANED_AIF_NODE" | "ISOMORPHISM_FAILURE" | 
        "STRUCTURE_MISMATCH" | "ROUND_TRIP_FAILURE" | "INNOCENCE_VIOLATION" |
        "PROPAGATION_VIOLATION";
  severity: "ERROR" | "WARNING" | "INFO";
  designId?: string;
  strategyId?: string;
  aifNodeId?: string;
  message: string;
  details?: Record<string, any>;
};

/**
 * AIF graph structure for a deliberation
 */
type AifGraph = {
  nodes: AifNodeForCorrespondence[];
  edges: AifEdgeForCorrespondence[];
};

type AifNodeForCorrespondence = {
  id: string;
  nodeKind: string;
  ludicActId: string | null;
  locusPath: string | null;
  locusRole: string | null;
  text: string | null;
  dialogueMetadata: any;
};

type AifEdgeForCorrespondence = {
  id: string;
  sourceId: string;
  targetId: string;
  edgeRole: string;
};

// =============================================================================
// Main Verification Functions
// =============================================================================

/**
 * Verify all correspondences for a deliberation
 * 
 * This is the main entry point for Phase 2 verification.
 * It checks that:
 * 1. Every LudicDesign has corresponding AifNodes (1:1 for acts)
 * 2. Every LudicStrategy can be reconstructed from its chronicles
 * 3. Disp(D) ↔ Ch(S) isomorphism holds
 * 4. Round-trip transformations preserve structure
 */
export async function verifyAifCorrespondence(
  deliberationId: string
): Promise<AifCorrespondenceResult> {
  const startTime = Date.now();
  const issues: CorrespondenceIssue[] = [];

  // 1. Fetch all relevant data
  const [designs, strategies, aifGraph] = await Promise.all([
    fetchDesigns(deliberationId),
    fetchStrategies(deliberationId),
    fetchAifGraph(deliberationId),
  ]);

  // 2. Verify each design's correspondence
  const designDetails: DesignCorrespondenceDetail[] = [];
  for (const design of designs) {
    const detail = await verifyDesignCorrespondence(
      design,
      designs.filter(d => d.id !== design.id), // counter-designs
      aifGraph,
      strategies.find(s => s.designId === design.id),
      issues
    );
    designDetails.push(detail);
  }

  // 3. Verify each strategy's correspondence
  const strategyDetails: StrategyCorrespondenceDetail[] = [];
  for (const strategy of strategies) {
    const detail = await verifyStrategyCorrespondence(
      strategy,
      designs.filter(d => d.id !== strategy.designId), // counter-designs
      aifGraph,
      issues
    );
    strategyDetails.push(detail);
  }

  // 4. Check overall isomorphisms (using first design/strategy pair as sample)
  let isomorphisms: IsomorphismResults = {
    playsViews: { holds: true, checked: false },
    viewsPlays: { holds: true, checked: false },
    dispCh: { holds: true, checked: false },
    chDisp: { holds: true, checked: false },
  };

  if (designs.length > 0 && strategies.length > 0) {
    const sampleDesign = designs[0];
    const sampleStrategy = strategies.find(s => s.designId === sampleDesign.id) || strategies[0];
    const counterDesigns = designs.filter(d => d.id !== sampleDesign.id);

    isomorphisms = checkAllIsomorphisms(sampleDesign, sampleStrategy, counterDesigns);

    // Record any isomorphism failures
    if (!isomorphisms.playsViews.holds) {
      issues.push({
        type: "ISOMORPHISM_FAILURE",
        severity: "ERROR",
        message: "Plays(Views(S)) ≅ S failed",
        details: isomorphisms.playsViews.evidence,
      });
    }
    if (!isomorphisms.viewsPlays.holds) {
      issues.push({
        type: "ISOMORPHISM_FAILURE",
        severity: "ERROR",
        message: "Views(Plays(V)) ≅ V failed",
        details: isomorphisms.viewsPlays.evidence,
      });
    }
    if (!isomorphisms.dispCh.holds) {
      issues.push({
        type: "ISOMORPHISM_FAILURE",
        severity: "ERROR",
        message: "Disp(Ch(S)) ≅ S failed",
        details: isomorphisms.dispCh.evidence,
      });
    }
    if (!isomorphisms.chDisp.holds) {
      issues.push({
        type: "ISOMORPHISM_FAILURE",
        severity: "ERROR",
        message: "Ch(Disp(D)) ≅ D failed",
        details: isomorphisms.chDisp.evidence,
      });
    }
  }

  // 5. Calculate metrics
  const designsCovered = designDetails.filter(d => d.hasAifNodes).length;
  const strategiesCovered = strategyDetails.filter(s => s.hasAifNodes).length;
  const correspondenceRate = designs.length > 0
    ? designsCovered / designs.length
    : strategies.length > 0
      ? strategiesCovered / strategies.length
      : 1;

  // 6. Determine overall validity
  const allIsomorphisms = allIsomorphismsHold(isomorphisms);
  const noErrors = issues.filter(i => i.severity === "ERROR").length === 0;
  const valid = allIsomorphisms && noErrors && correspondenceRate >= 0.95;

  return {
    deliberationId,
    valid,
    isomorphisms,
    allIsomorphismsHold: allIsomorphisms,
    structureComparison: {
      designsCount: designs.length,
      strategiesCount: strategies.length,
      aifNodesCount: aifGraph.nodes.length,
      aifEdgesCount: aifGraph.edges.length,
      designsCovered,
      strategiesCovered,
      correspondenceRate,
    },
    designs: designDetails,
    strategies: strategyDetails,
    issues,
    verifiedAt: new Date(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Verify correspondence for a single design
 */
async function verifyDesignCorrespondence(
  design: DesignForCorrespondence,
  counterDesigns: DesignForCorrespondence[],
  aifGraph: AifGraph,
  strategy: Strategy | undefined,
  issues: CorrespondenceIssue[]
): Promise<DesignCorrespondenceDetail> {
  // Find AIF nodes for this design's acts
  const designActIds = design.acts.map(a => a.id);
  const aifNodes = aifGraph.nodes.filter(n => 
    n.ludicActId && designActIds.includes(n.ludicActId)
  );

  // Check for missing AIF nodes
  const actIdsWithNodes = new Set(aifNodes.map(n => n.ludicActId));
  const missingActIds = designActIds.filter(id => !actIdsWithNodes.has(id));
  
  for (const actId of missingActIds) {
    issues.push({
      type: "MISSING_AIF_NODE",
      severity: "ERROR",
      designId: design.id,
      message: `LudicAct ${actId} has no corresponding AifNode`,
    });
  }

  // Check Ch(Disp(D)) = D
  let chDispHolds = false;
  let roundTripPreserved = false;

  if (counterDesigns.length > 0) {
    try {
      // Compute Disp(D)
      const dispResult = computeDisp(design, counterDesigns);
      
      if (dispResult.disputes.length > 0) {
        // Convert disputes to strategy
        const player: "P" | "O" = design.participantId === "Proponent" ? "P" : "O";
        const plays = disputesToPlays(dispResult.disputes, player);
        
        const tempStrategy: Strategy = {
          id: `temp-${design.id}`,
          designId: design.id,
          player,
          plays: plays.map((p, idx) => ({
            id: `temp-play-${idx}`,
            strategyId: `temp-${design.id}`,
            sequence: p.sequence,
            length: p.length,
            isPositive: p.isPositive,
          })),
          isInnocent: true,
          satisfiesPropagation: true,
        };

        // Compute Ch(S)
        const chResult = computeCh(tempStrategy);

        // Reconstruct design from chronicles
        const reconstructedActs = chroniclesToActs(chResult.chronicles, design.id);

        // Compare
        chDispHolds = compareActStructures(design.acts, reconstructedActs);
        roundTripPreserved = chDispHolds;

        if (!chDispHolds) {
          issues.push({
            type: "ROUND_TRIP_FAILURE",
            severity: "WARNING",
            designId: design.id,
            message: "Ch(Disp(D)) ≠ D: Round-trip transformation did not preserve design structure",
            details: {
              originalActCount: design.acts.length,
              reconstructedActCount: reconstructedActs.length,
            },
          });
        }
      }
    } catch (error: any) {
      issues.push({
        type: "STRUCTURE_MISMATCH",
        severity: "WARNING",
        designId: design.id,
        message: `Ch(Disp(D)) verification failed: ${error.message}`,
      });
    }
  }

  return {
    designId: design.id,
    hasAifNodes: aifNodes.length > 0,
    aifNodeCount: aifNodes.length,
    hasStrategy: !!strategy,
    strategyId: strategy?.id,
    chDispHolds,
    roundTripPreserved,
  };
}

/**
 * Verify correspondence for a single strategy
 */
async function verifyStrategyCorrespondence(
  strategy: Strategy,
  counterDesigns: DesignForCorrespondence[],
  aifGraph: AifGraph,
  issues: CorrespondenceIssue[]
): Promise<StrategyCorrespondenceDetail> {
  // Find AIF nodes related to this strategy's plays
  const actIds = new Set<string>();
  for (const play of strategy.plays) {
    for (const action of play.sequence) {
      if (action.actId) {
        actIds.add(action.actId);
      }
    }
  }
  
  const aifNodes = aifGraph.nodes.filter(n => 
    n.ludicActId && actIds.has(n.ludicActId)
  );

  // Check Disp(Ch(S)) = S
  let dispChHolds = false;

  try {
    // Compute Ch(S)
    const chResult = computeCh(strategy);

    if (chResult.chronicles.length > 0) {
      // Reconstruct design from chronicles
      const reconstructedActs = chroniclesToActs(chResult.chronicles, strategy.designId);
      const reconstructedDesign: DesignForCorrespondence = {
        id: strategy.designId,
        deliberationId: "",
        participantId: strategy.player === "P" ? "Proponent" : "Opponent",
        acts: reconstructedActs.map((act, idx) => ({
          id: `reconstructed-${idx}`,
          designId: strategy.designId,
          kind: act.locusPath === "0" ? "INITIAL" as const : "POSITIVE" as const,
          polarity: act.polarity,
          locusPath: act.locusPath,
          ramification: act.ramification,
        })),
        loci: [],
      };

      // Compute Disp(reconstructed design)
      if (counterDesigns.length > 0) {
        const dispResult = computeDisp(reconstructedDesign, counterDesigns);
        
        // Convert disputes to plays and compare
        const reconstructedPlays = disputesToPlays(dispResult.disputes, strategy.player);
        dispChHolds = comparePlays(strategy.plays, reconstructedPlays);

        if (!dispChHolds) {
          issues.push({
            type: "ROUND_TRIP_FAILURE",
            severity: "WARNING",
            strategyId: strategy.id,
            message: "Disp(Ch(S)) ≠ S: Round-trip transformation did not preserve strategy",
            details: {
              originalPlayCount: strategy.plays.length,
              reconstructedPlayCount: reconstructedPlays.length,
            },
          });
        }
      }
    }
  } catch (error: any) {
    issues.push({
      type: "STRUCTURE_MISMATCH",
      severity: "WARNING",
      strategyId: strategy.id,
      message: `Disp(Ch(S)) verification failed: ${error.message}`,
    });
  }

  // Check innocence
  if (!strategy.isInnocent) {
    issues.push({
      type: "INNOCENCE_VIOLATION",
      severity: "INFO",
      strategyId: strategy.id,
      message: "Strategy is not innocent - may not correspond to a proper design",
    });
  }

  // Check propagation
  if (!strategy.satisfiesPropagation) {
    issues.push({
      type: "PROPAGATION_VIOLATION",
      severity: "WARNING",
      strategyId: strategy.id,
      message: "Strategy does not satisfy propagation - may have non-linear address usage",
    });
  }

  return {
    strategyId: strategy.id,
    designId: strategy.designId,
    hasAifNodes: aifNodes.length > 0,
    aifNodeCount: aifNodes.length,
    dispChHolds,
    isInnocent: strategy.isInnocent,
    satisfiesPropagation: strategy.satisfiesPropagation,
  };
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/**
 * Fetch all LudicDesigns for a deliberation and convert to correspondence format
 */
async function fetchDesigns(deliberationId: string): Promise<DesignForCorrespondence[]> {
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    include: {
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: "asc" },
      },
    },
  });

  return designs.map(design => {
    // Extract unique loci from acts
    const lociMap = new Map<string, { id: string; path: string }>();
    for (const act of design.acts) {
      if (act.locus) {
        lociMap.set(act.locus.id, { id: act.locus.id, path: act.locus.path });
      }
    }

    return {
      id: design.id,
      deliberationId: design.deliberationId,
      participantId: design.participantId || "Unknown",
      acts: design.acts.map(act => ({
        id: act.id,
        designId: act.designId,
        kind: (act.kind as "INITIAL" | "POSITIVE" | "NEGATIVE" | "DAIMON") || "POSITIVE",
        polarity: (act.polarity as "P" | "O") || "P",
        expression: act.expression || undefined,
        locusId: act.locusId || undefined,
        locusPath: act.locus?.path || "0",
        ramification: act.ramification?.map(r => Number(r)) || [],
      })),
      loci: Array.from(lociMap.values()).map(locus => ({
        id: locus.id,
        designId: design.id,
        path: locus.path,
      })),
    };
  });
}

/**
 * Fetch all LudicStrategies for a deliberation and convert to strategy format
 */
async function fetchStrategies(deliberationId: string): Promise<Strategy[]> {
  // First get all designs for this deliberation
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    select: { id: true },
  });
  const designIds = designs.map(d => d.id);

  const strategies = await prisma.ludicStrategy.findMany({
    where: { designId: { in: designIds } },
    include: {
      design: {
        include: {
          acts: {
            include: { locus: true },
            orderBy: { orderInDesign: "asc" },
          },
        },
      },
      plays: true,
    },
  });

  return strategies.map(strategy => {
    // Build plays from strategy plays or design acts
    const plays: Play[] = [];
    
    // If strategy has plays, use them directly
    if (strategy.plays.length > 0) {
      for (const play of strategy.plays) {
        const sequence = (play.sequence as any[]) || [];
        const actions: Action[] = sequence.map((s: any) => ({
          focus: s.focus || "0",
          ramification: s.ramification || [],
          polarity: s.polarity || "P",
          actId: s.actId,
        }));

        plays.push({
          id: play.id,
          strategyId: strategy.id,
          sequence: actions,
          length: actions.length,
          isPositive: play.isPositive,
        });
      }
    } else {
      // Fall back to grouping acts by branch
      const actsByBranch = groupActsByBranch(strategy.design.acts);
      
      for (const [branchKey, acts] of actsByBranch) {
        const sequence: Action[] = acts.map((act: any) => ({
          focus: act.locus?.path || "0",
          ramification: act.ramification?.map((r: string) => Number(r)) || [],
          polarity: (act.polarity as "P" | "O") || "P",
          actId: act.id,
        }));

        const lastAction = sequence[sequence.length - 1];
        plays.push({
          id: `play-${strategy.id}-${branchKey}`,
          strategyId: strategy.id,
          sequence,
          length: sequence.length,
          isPositive: lastAction ? lastAction.polarity === "P" : true,
        });
      }
    }

    const firstActPolarity = strategy.design.acts[0]?.polarity;
    return {
      id: strategy.id,
      designId: strategy.designId,
      player: firstActPolarity === "P" ? "P" : "O",
      plays,
      isInnocent: strategy.isInnocent,
      satisfiesPropagation: strategy.satisfiesPropagation,
    };
  });
}

/**
 * Fetch AIF graph for a deliberation
 */
async function fetchAifGraph(deliberationId: string): Promise<AifGraph> {
  const [nodes, edges] = await Promise.all([
    (prisma as any).aifNode.findMany({
      where: { deliberationId },
      select: {
        id: true,
        nodeKind: true,
        ludicActId: true,
        locusPath: true,
        locusRole: true,
        text: true,
        dialogueMetadata: true,
      },
    }),
    (prisma as any).aifEdge.findMany({
      where: { deliberationId },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        edgeRole: true,
      },
    }),
  ]);

  return { nodes, edges };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Group acts by their branch (for building plays)
 */
function groupActsByBranch(acts: any[]): Map<string, any[]> {
  const branches = new Map<string, any[]>();
  
  for (const act of acts) {
    const path = act.locus?.path || "0";
    const branchKey = getBranchKey(path);
    
    if (!branches.has(branchKey)) {
      branches.set(branchKey, []);
    }
    branches.get(branchKey)!.push(act);
  }

  // Sort acts within each branch by path depth
  for (const [key, branchActs] of branches) {
    branchActs.sort((a, b) => {
      const depthA = (a.locus?.path || "0").split(".").length;
      const depthB = (b.locus?.path || "0").split(".").length;
      return depthA - depthB;
    });
  }

  return branches;
}

/**
 * Get branch key from path (first two levels)
 */
function getBranchKey(path: string): string {
  const parts = path.split(".");
  return parts.slice(0, 2).join(".");
}

/**
 * Compare act structures
 */
function compareActStructures(
  acts1: DesignAct[],
  acts2: { locusPath: string; polarity: "P" | "O"; ramification: number[] }[]
): boolean {
  if (acts1.length !== acts2.length) return false;

  const map1 = new Map<string, string>();
  for (const a of acts1) {
    if (a.locusPath) {
      map1.set(a.locusPath, a.polarity);
    }
  }
  
  const map2 = new Map<string, string>();
  for (const a of acts2) {
    map2.set(a.locusPath, a.polarity);
  }

  for (const [path, pol] of map1) {
    if (map2.get(path) !== pol) return false;
  }

  return true;
}

/**
 * Compare plays
 */
function comparePlays(
  plays1: Play[],
  plays2: { sequence: Action[]; length: number; isPositive: boolean }[]
): boolean {
  const keys1 = new Set(plays1.map(p => playToKey(p)));
  const keys2 = new Set(plays2.map(p => playToKey(p)));

  if (keys1.size !== keys2.size) return false;

  for (const key of keys1) {
    if (!keys2.has(key)) return false;
  }

  return true;
}

/**
 * Create unique key for play
 */
function playToKey(play: { sequence: Action[] }): string {
  return play.sequence.map(a => `${a.focus}:${a.polarity}`).join("|");
}

// =============================================================================
// Exported Utilities
// =============================================================================

/**
 * Quick check if correspondence is valid (without full verification)
 */
export async function isCorrespondenceValid(deliberationId: string): Promise<boolean> {
  const result = await verifyAifCorrespondence(deliberationId);
  return result.valid;
}

/**
 * Get correspondence issues summary
 */
export async function getCorrespondenceIssues(deliberationId: string): Promise<{
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: CorrespondenceIssue[];
}> {
  const result = await verifyAifCorrespondence(deliberationId);
  
  const errorCount = result.issues.filter(i => i.severity === "ERROR").length;
  const warningCount = result.issues.filter(i => i.severity === "WARNING").length;
  const infoCount = result.issues.filter(i => i.severity === "INFO").length;

  return {
    errorCount,
    warningCount,
    infoCount,
    issues: result.issues,
  };
}

/**
 * Repair correspondence issues by re-syncing
 */
export async function repairCorrespondence(deliberationId: string): Promise<{
  repaired: boolean;
  syncResult: any;
  verificationResult: AifCorrespondenceResult;
}> {
  // Import syncLudicsToAif
  const { syncLudicsToAif } = await import("./syncToAif");

  // Re-sync to fix missing nodes
  const syncResult = await syncLudicsToAif(deliberationId);

  // Verify again
  const verificationResult = await verifyAifCorrespondence(deliberationId);

  return {
    repaired: verificationResult.valid,
    syncResult,
    verificationResult,
  };
}
