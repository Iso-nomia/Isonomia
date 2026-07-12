export const dynamic = "force-dynamic";

/**
 * DDS Landscape API Route
 * 
 * GET /api/ludics/landscape/[arenaId] - Get landscape visualization data
 * POST /api/ludics/landscape/[arenaId] - Compute detailed landscape analysis
 * 
 * Uses Phase 4 landscape module to generate heat maps, position strength
 * analysis, flow paths, critical points, and tree layouts.
 */

import { NextRequest, NextResponse } from "next/server";
import { arenaById } from "../../arenas/store";

// Phase 4 Landscape imports
import {
  generateLandscapeData,
  layoutAsTree,
  findCriticalPoints,
  extractFlowPaths,
  landscapeToJSON,
  landscapeToSVG,
} from "@/packages/ludics-core/dds/landscape/visualization-data";
import {
  analyzePositionStrength,
  analyzeAllPositions,
  runSimulations,
  hasWinningStrategy,
} from "@/packages/ludics-core/dds/landscape/position-analyzer";
import {
  converges,
  computeOrthogonal,
  computeBiorthogonalClosure,
  computeBehaviour,
} from "@/packages/ludics-core/dds/landscape/behaviour-computer";
import {
  checkBehaviourCompleteness,
  checkDesignCompleteness,
  findMissingDesigns,
  validateBehaviourStructure,
} from "@/packages/ludics-core/dds/landscape/completeness-checker";
import {
  analyzeFullLandscape,
  quickStrengthCheck,
} from "@/packages/ludics-core/dds/landscape";

import type { CompleteLandscapeData } from "@/packages/ludics-core/dds/landscape/visualization-data";
import type {
  LandscapeData,
  HeatMapData,
  PositionStrength,
  LudicDesignTheory,
  LudicBehaviourTheory,
  DeliberationArena,
} from "@/packages/ludics-core/dds/types/ludics-theory";

interface RouteParams {
  params: Promise<{ arenaId: string }>;
}

/**
 * GET /api/ludics/landscape/[arenaId]
 * Get landscape visualization data for an arena
 * 
 * Query params:
 * - format: "json" | "svg" (default: "json")
 * - includeHeatMap: "true" | "false" (default: "true")
 * - includeFlowPaths: "true" | "false" (default: "false")
 * - includeCriticalPoints: "true" | "false" (default: "false")
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { arenaId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const includeHeatMap = searchParams.get("includeHeatMap") !== "false";
    const includeFlowPaths = searchParams.get("includeFlowPaths") === "true";
    const includeCriticalPoints = searchParams.get("includeCriticalPoints") === "true";

    if (!arenaId) {
      return NextResponse.json(
        { ok: false, error: "Arena ID is required" },
        { status: 400 }
      );
    }

    const arena = arenaById.get(arenaId);
    if (!arena) {
      return NextResponse.json(
        { ok: false, error: "Arena not found" },
        { status: 404 }
      );
    }

    // Convert arena to designs for landscape generation
    const designs = arenaToDesigns(arena);

    // Analyze positions (required input for landscape generation)
    const analysis = analyzeAllPositions(arena as unknown as DeliberationArena, designs);
    const positions: PositionStrength[] = analysis.positions;

    // Generate landscape data
    const landscape: any = generateLandscapeData(
      arena as unknown as DeliberationArena,
      positions
    );

    // Get tree layout
    const treeLayout: any = layoutAsTree(arena as unknown as DeliberationArena, positions);

    // Optionally find critical points
    let criticalPoints: any[] = [];
    if (includeCriticalPoints) {
      criticalPoints = findCriticalPoints(positions);
    }

    // Optionally extract flow paths
    let flowPaths: any[] = [];
    if (includeFlowPaths) {
      flowPaths = extractFlowPaths(arena as unknown as DeliberationArena, []);
    }

    // Format output
    if (format === "svg") {
      const svg = landscapeToSVG(landscape, 800, 600);

      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
        },
      });
    }

    // JSON format (default)
    const json = landscapeToJSON(landscape);

    return NextResponse.json({
      ok: true,
      arenaId,
      landscape: {
        id: landscape.id,
        nodeCount: landscape.nodes.length,
        edgeCount: landscape.edges.length,
        maxDepth: Math.max(...landscape.nodes.map((n: any) => n.depth), 0),
      },
      heatMap: includeHeatMap ? landscape.heatMap : undefined,
      treeLayout: {
        root: treeLayout.root,
        levels: treeLayout.levels,
        totalNodes: treeLayout.nodes.length,
      },
      criticalPoints: includeCriticalPoints ? criticalPoints : undefined,
      flowPaths: includeFlowPaths ? flowPaths : undefined,
      stats: {
        pPositions: landscape.nodes.filter((n: any) => n.player === "P").length,
        oPositions: landscape.nodes.filter((n: any) => n.player === "O").length,
        terminalNodes: landscape.nodes.filter((n: any) => n.isTerminal).length,
        branchingPoints: landscape.nodes.filter((n: any) => n.children.length > 1).length,
      },
      json: format === "json" ? json : undefined,
    });
  } catch (error: any) {
    console.error("[Landscape GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ludics/landscape/[arenaId]
 * Compute detailed landscape analysis
 * 
 * Body:
 * - computeStrength?: boolean - Run position strength analysis
 * - runSimulations?: boolean - Run game simulations
 * - simulationCount?: number - Number of simulations (default: 100)
 * - computeBehaviours?: boolean - Compute orthogonal/biorthogonal
 * - checkCompleteness?: boolean - Check behaviour completeness
 * - generateVisualization?: boolean - Generate full visualization data
 * - designs?: Design[] - Optional specific designs to analyze
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { arenaId } = await params;
    const body = await req.json();
    const {
      computeStrength = true,
      runSimulationsFlag = false,
      simulationCount = 100,
      computeBehaviours = false,
      checkCompleteness = false,
      generateVisualization = true,
      designs: providedDesigns,
    } = body;

    if (!arenaId) {
      return NextResponse.json(
        { ok: false, error: "Arena ID is required" },
        { status: 400 }
      );
    }

    const arena = arenaById.get(arenaId);
    if (!arena) {
      return NextResponse.json(
        { ok: false, error: "Arena not found" },
        { status: 404 }
      );
    }

    // Use provided designs or generate from arena
    const designs: any[] = providedDesigns || arenaToDesigns(arena);

    // Results container
    const results: any = {
      arenaId,
      designCount: designs.length,
    };

    // Generate base landscape
    if (generateVisualization) {
      const baseAnalysis = analyzeAllPositions(
        arena as unknown as DeliberationArena,
        designs as LudicDesignTheory[]
      );
      const basePositions: PositionStrength[] = baseAnalysis.positions;
      const landscape: any = generateLandscapeData(
        arena as unknown as DeliberationArena,
        basePositions
      );
      const treeLayout: any = layoutAsTree(
        arena as unknown as DeliberationArena,
        basePositions
      );
      const criticalPoints = findCriticalPoints(basePositions);
      const flowPaths = extractFlowPaths(arena as unknown as DeliberationArena, []);

      results.landscape = {
        id: landscape.id,
        nodeCount: landscape.nodes?.length,
        edgeCount: landscape.edges?.length,
        nodes: landscape.nodes,
        edges: landscape.edges,
        heatMap: landscape.heatMap,
      };
      results.treeLayout = treeLayout;
      results.criticalPoints = criticalPoints;
      results.flowPaths = flowPaths;
    }

    // Position strength analysis
    if (computeStrength) {
      const positions = designs.flatMap((d: any) =>
        (d.actions ?? []).map((a: any) => ({
          address: a.focus,
          currentPlayer: a.polarity,
          depth: a.focus?.length,
        }))
      );

      // Quick strength check for overview
      const quickCheck = quickStrengthCheck(
        arena as unknown as DeliberationArena,
        designs as LudicDesignTheory[],
        []
      );

      // Full analysis for all positions
      const allStrengths: PositionStrength[] = analyzeAllPositions(
        arena as unknown as DeliberationArena,
        designs as LudicDesignTheory[]
      ).positions;

      results.strengthAnalysis = {
        quickCheck,
        positions: allStrengths.map((s) => ({
          address: s.address,
          score: s.winRate,
          winRate: s.winRate,
          hasWinningStrategy: s.hasWinningStrategy,
          winningDesignCount: s.winningDesignCount,
          totalDesignCount: s.totalDesignCount,
          depth: s.depth,
        })),
        stats: {
          avgScore:
            allStrengths.reduce((sum, s) => sum + s.winRate, 0) /
            (allStrengths.length || 1),
          maxScore: Math.max(...allStrengths.map((s) => s.winRate), 0),
          minScore: Math.min(...allStrengths.map((s) => s.winRate), 0),
          winningStrategyCount: allStrengths.filter(
            (s) => s.hasWinningStrategy
          ).length,
        },
      };
    }

    // Simulations
    if (runSimulationsFlag) {
      const simResults = runSimulations(
        designs as LudicDesignTheory[],
        [],
        simulationCount,
        50
      );

      const pWins = simResults.filter((r) => r.winner === "P").length;
      const oWins = simResults.filter((r) => r.winner === "O").length;
      const draws = simResults.filter((r) => r.winner === null).length;
      const avgMoveCount =
        simResults.reduce((sum, r) => sum + r.moveCount, 0) /
        (simResults.length || 1);

      results.simulations = {
        count: simulationCount,
        pWins,
        oWins,
        draws,
        avgMoveCount,
        winRate: {
          P: pWins / (simulationCount || 1),
          O: oWins / (simulationCount || 1),
        },
      };
    }

    // Behaviour computation
    if (computeBehaviours) {
      // Separate P and O designs
      const pDesigns = designs.filter(d => d.polarity === "P");
      const oDesigns = designs.filter(d => d.polarity === "O");

      // Compute orthogonal and biorthogonal
      const orthogonal = computeOrthogonal(pDesigns as LudicDesignTheory[]);
      const biorthogonal = computeBiorthogonalClosure(
        pDesigns as LudicDesignTheory[]
      );
      const behaviourResult = computeBehaviour(designs as LudicDesignTheory[]);
      const behaviour = behaviourResult.behaviour;

      results.behaviours = {
        orthogonal: {
          designCount: orthogonal.length,
          designs: orthogonal.map((d) => ({
            id: d.id,
            actionCount: d.chronicles.length,
            polarity: d.polarity,
          })),
        },
        biorthogonal: {
          designCount: biorthogonal.length,
          isClosed: biorthogonal.length === pDesigns.length,
        },
        combined: {
          id: behaviour.id,
          designCount: behaviour.designs.length,
          isComplete: behaviour.isComplete,
        },
      };

      // Check convergence between designs
      const convergenceMatrix: boolean[][] = [];
      for (let i = 0; i < designs.length; i++) {
        convergenceMatrix[i] = [];
        for (let j = 0; j < designs.length; j++) {
          if (i !== j && designs[i].polarity !== designs[j].polarity) {
            convergenceMatrix[i][j] = converges(designs[i], designs[j]);
          } else {
            convergenceMatrix[i][j] = false;
          }
        }
      }
      results.convergenceMatrix = convergenceMatrix;
    }

    // Completeness check
    if (checkCompleteness) {
      const behaviour: LudicBehaviourTheory = {
        id: `behaviour-${arenaId}`,
        designs: designs as LudicDesignTheory[],
        base: [],
        polarity: (designs[0]?.polarity as any) ?? "+",
        isComplete: false,
      };

      const completeness = checkBehaviourCompleteness(behaviour);
      const missingDesigns = findMissingDesigns(behaviour);
      const validation = validateBehaviourStructure(behaviour);

      results.completeness = {
        isComplete: completeness.isComplete,
        isInternallyComplete: completeness.isInternallyComplete,
        diagnostics: completeness.diagnostics,
        statistics: completeness.statistics,
        missingDesigns: missingDesigns.map((d) => ({
          id: d.id,
          polarity: d.polarity,
          actionCount: d.chronicles.length,
        })),
        validation: {
          isValid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
        },
      };
    }

    // Full landscape analysis (combines multiple analyses)
    const fullAnalysis = await analyzeFullLandscape(
      arena as unknown as DeliberationArena,
      designs as LudicDesignTheory[]
    );
    results.fullAnalysis = {
      computeTime: fullAnalysis.computeTime,
      isComplete: fullAnalysis.completeness.isComplete,
      behaviourId: fullAnalysis.behaviour.id,
    };

    return NextResponse.json({
      ok: true,
      ...results,
    });
  } catch (error: any) {
    console.error("[Landscape POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Convert arena moves to designs for landscape analysis
 */
function arenaToDesigns(arena: any): any[] {
  const pActions: any[] = [];
  const oActions: any[] = [];

  for (const move of arena.moves) {
    const action = {
      actId: move.id,
      focus: move.address,
      ramification: move.ramification,
      polarity: move.player,
    };

    if (move.player === "P") {
      pActions.push(action);
    } else {
      oActions.push(action);
    }
  }

  const designs: any[] = [];

  if (pActions.length > 0) {
    designs.push({
      id: `design-p-${arena.id}`,
      polarity: "P",
      base: "",
      actions: pActions,
      hasDaimon: false,
    });
  }

  if (oActions.length > 0) {
    designs.push({
      id: `design-o-${arena.id}`,
      polarity: "O",
      base: "",
      actions: oActions,
      hasDaimon: false,
    });
  }

  return designs;
}
