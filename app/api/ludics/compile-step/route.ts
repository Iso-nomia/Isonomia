export const dynamic = "force-dynamic";

// app/api/ludics/compile-step/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { compileFromMoves } from "@/packages/ludics-engine/compileFromMoves";
import { stepInteraction } from "packages/ludics-engine/stepper";

// Phase 3 Extraction imports
import {
  extractPath,
  extractAllPaths,
} from "@/packages/ludics-core/dds/extraction/path-extractor";
import {
  formatAsNarrative,
  narrativeToJSON,
} from "@/packages/ludics-core/dds/extraction/narrative-formatter";

// Phase 4 Landscape imports  
import {
  generateLandscapeData,
  findCriticalPoints,
} from "@/packages/ludics-core/dds/landscape/visualization-data";
import {
  quickStrengthCheck,
} from "@/packages/ludics-core/dds/landscape";

import type {
  LudicDesignTheory,
  DeliberationArena,
} from "@/packages/ludics-core/dds/types/ludics-theory";

/**
 * Build a minimal DeliberationArena around a set of designs.
 * The landscape/strength analysis utilities require an arena context;
 * this provides the structural shape they expect for the available designs.
 */
function buildMinimalArena(
  deliberationId: string,
  designs: LudicDesignTheory[]
): DeliberationArena {
  return {
    deliberationId,
    rootAddress: [],
    positions: new Map(),
    availableDesigns: designs,
  };
}

/**
 * POST /api/ludics/compile-step
 * Compiles dialogue moves into Ludics designs and runs the stepper.
 * 
 * Body: { deliberationId, action?, phase?, compositionMode?, fuel? }
 * 
 * Actions:
 * - "compile-step" (default): Compile and step interaction
 * - "extract-path": Extract paths from trace
 * - "compute-landscape": Generate landscape visualization
 * - "analyze-strength": Quick position strength analysis
 * 
 * Returns: { ok, proId, oppId, trace, [pathData], [landscape], [strength] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { 
    deliberationId, 
    action = "compile-step",
    phase = "neutral", 
    compositionMode = "assoc", 
    fuel = 2048,
    traceId,
    includeExtraction = false,
    includeLandscape = false,
  } = body;

  if (!deliberationId) {
    return NextResponse.json({ ok: false, error: "deliberationId required" }, { status: 400 });
  }

  try {
    // Route based on action
    switch (action) {
      case "extract-path": {
        // Extract paths from existing designs/trace
        return await handleExtractPath(deliberationId, traceId);
      }

      case "compute-landscape": {
        // Generate landscape visualization
        return await handleComputeLandscape(deliberationId);
      }

      case "analyze-strength": {
        // Quick strength analysis
        return await handleAnalyzeStrength(deliberationId);
      }

      case "compile-step":
      default: {
        // Original compile-step logic with optional extraction/landscape
        return await handleCompileStep(
          deliberationId, 
          phase, 
          compositionMode, 
          fuel,
          includeExtraction,
          includeLandscape
        );
      }
    }
  } catch (e: any) {
    console.error("[compile-step] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Original compile-step logic
 */
async function handleCompileStep(
  deliberationId: string,
  phase: string,
  compositionMode: string,
  fuel: number,
  includeExtraction: boolean,
  includeLandscape: boolean
) {
  // 1) Compile from moves (direct function call, no internal fetch)
  // Note: withCompileLock inside compileFromMoves serializes concurrent calls
  await compileFromMoves(deliberationId).catch((e) => {
    console.warn("[compile-step] compile warning:", e?.message);
  });

  // 2) Wait for designs to be fully committed and lock to release
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3) Pick designs
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    orderBy: { participantId: "asc" },
    select: { id: true, participantId: true },
  });

  if (designs.length < 1) {
    return NextResponse.json({ ok: true, trace: null, status: "EMPTY" });
  }

  const pro = designs.find(d => d.participantId === "Proponent") ?? designs[0];
  const opp = designs.find(d => d.participantId === "Opponent") ?? designs[1] ?? designs[0];

  // 4) Step interaction (direct function call, no internal fetch)
  const trace = await stepInteraction({
    dialogueId: deliberationId,
    posDesignId: pro.id,
    negDesignId: opp.id,
    phase: phase as "neutral" | "focus-P" | "focus-O",
    compositionMode: compositionMode as "assoc" | "partial" | "spiritual",
    maxPairs: fuel,
  });

  // Build response
  const response: any = {
    ok: true,
    proId: pro.id,
    oppId: opp.id,
    trace,
  };

  // Optional: Include path extraction
  if (includeExtraction && trace) {
    try {
      const design = traceToDesign(trace, deliberationId);
      const path = extractPath(design as any);
      const narrative = formatAsNarrative(path, undefined, {
        showTimestamps: true,
      });
      response.pathData = {
        pathId: path.id,
        length: path.actions.length,
        narrative: narrativeToJSON(narrative),
      };
    } catch (e) {
      console.warn("[compile-step] extraction warning:", e);
    }
  }

  // Optional: Include landscape hints
  if (includeLandscape && trace) {
    try {
      const design = traceToDesign(trace, deliberationId);
      const arena = buildMinimalArena(deliberationId, [design]);
      const strength = quickStrengthCheck(arena, [design], arena.rootAddress);
      response.landscapeHints = {
        strengthSummary: strength,
      };
    } catch (e) {
      console.warn("[compile-step] landscape warning:", e);
    }
  }

  return NextResponse.json(response);
}

/**
 * Extract paths from deliberation designs
 */
async function handleExtractPath(deliberationId: string, traceId?: string) {
  // Fetch designs with acts
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    include: { acts: true },
  });

  if (designs.length === 0) {
    return NextResponse.json({ ok: false, error: "No designs found" }, { status: 404 });
  }

  // Convert to LudicDesignTheory format
  const designTheories: any[] = designs.map(d => ({
    id: d.id,
    polarity: d.participantId === "Proponent" ? "P" : "O",
    base: "",
    actions: d.acts.map(act => ({
      actId: act.id,
      focus: act.locusId || "",
      ramification: act.ramification || [],
      polarity: (act.polarity as "P" | "O") || "P",
    })),
    hasDaimon: false,
  }));

  // Extract paths from each design
  const pathResults = designTheories.map(design => {
    const path = extractPath(design as any);
    const allPaths = extractAllPaths(design as any);
    const narrative = formatAsNarrative(path, undefined, {
      showTimestamps: true,
    });

    return {
      designId: design.id,
      polarity: design.polarity,
      primaryPath: {
        id: path.id,
        length: path.actions.length,
        sequence: path.actions,
      },
      allPathsCount: allPaths.length,
      narrative: narrativeToJSON(narrative),
    };
  });

  return NextResponse.json({
    ok: true,
    action: "extract-path",
    deliberationId,
    paths: pathResults,
    stats: {
      designCount: designs.length,
      totalPaths: pathResults.reduce((sum, p) => sum + p.allPathsCount, 0),
    },
  });
}

/**
 * Compute landscape for deliberation
 */
async function handleComputeLandscape(deliberationId: string) {
  // Fetch designs
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    include: { acts: true },
  });

  if (designs.length === 0) {
    return NextResponse.json({ ok: false, error: "No designs found" }, { status: 404 });
  }

  // Convert to LudicDesignTheory format
  const designTheories: any[] = designs.map(d => ({
    id: d.id,
    polarity: d.participantId === "Proponent" ? "P" : "O",
    base: "",
    actions: d.acts.map(act => ({
      actId: act.id,
      focus: act.locusId || "",
      ramification: act.ramification || [],
      polarity: (act.polarity as "P" | "O") || "P",
    })),
    hasDaimon: false,
  }));

  // Generate landscape
  const arena = buildMinimalArena(deliberationId, designTheories as LudicDesignTheory[]);
  const landscape = generateLandscapeData(arena, []);
  const criticalPoints = findCriticalPoints(landscape.positions);

  return NextResponse.json({
    ok: true,
    action: "compute-landscape",
    deliberationId,
    landscape: {
      id: arena.id ?? deliberationId,
      nodeCount: landscape.positions.length,
      edgeCount: landscape.flowPaths.length,
      nodes: landscape.positions.slice(0, 50), // Limit for response size
      heatMap: landscape.heatMap,
    },
    criticalPoints: criticalPoints.slice(0, 10),
    stats: {
      designCount: designs.length,
      pDesigns: designTheories.filter(d => d.polarity === "P").length,
      oDesigns: designTheories.filter(d => d.polarity === "O").length,
    },
  });
}

/**
 * Quick strength analysis for deliberation
 */
async function handleAnalyzeStrength(deliberationId: string) {
  // Fetch designs
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId },
    include: { acts: true },
  });

  if (designs.length === 0) {
    return NextResponse.json({ ok: false, error: "No designs found" }, { status: 404 });
  }

  // Convert to LudicDesignTheory format
  const designTheories: any[] = designs.map(d => ({
    id: d.id,
    polarity: d.participantId === "Proponent" ? "P" : "O",
    base: "",
    actions: d.acts.map(act => ({
      actId: act.id,
      focus: act.locusId || "",
      ramification: act.ramification || [],
      polarity: (act.polarity as "P" | "O") || "P",
    })),
    hasDaimon: false,
  }));

  // Quick strength check
  const arena = buildMinimalArena(deliberationId, designTheories as LudicDesignTheory[]);
  const strength = quickStrengthCheck(arena, designTheories as LudicDesignTheory[], arena.rootAddress);

  return NextResponse.json({
    ok: true,
    action: "analyze-strength",
    deliberationId,
    strength,
    stats: {
      designCount: designs.length,
      pDesigns: designTheories.filter(d => d.polarity === "P").length,
      oDesigns: designTheories.filter(d => d.polarity === "O").length,
    },
  });
}

/**
 * Convert trace to design for extraction
 */
function traceToDesign(trace: any, deliberationId: string): any {
  const steps = trace.steps || trace.pairs || [];
  const actions = steps.map((step: any, idx: number) => ({
    actId: step.posActId || step.negActId || `act-${idx}`,
    focus: step.locusPath || step.locus || "",
    ramification: [],
    polarity: step.posActId ? "P" : "O",
  }));

  return {
    id: `design-from-trace-${deliberationId}`,
    polarity: "P",
    base: "",
    actions,
    hasDaimon: trace.status === "stuck" || trace.status === "daimon",
  };
}
