export const dynamic = "force-dynamic";

/**
 * DDS Phase 5: Type Inference API
 * POST /api/ludics/dds/types/infer
 * 
 * Infers the Ludics type of a design based on its structure.
 * Types in Ludics are behaviours, representing interaction capabilities.
 * 
 * Supports three inference methods:
 * - structural: Based on design shape (fast, heuristic)
 * - behavioral: Based on interaction patterns with other designs
 * - chronicle: Based on chronicle analysis (leverages Prop 4.27 correspondence)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  inferTypeStructural,
  inferTypeBehavioural,
  inferDesignType,
  unifyTypes,
  inferTypeFromDesignChronicles,
  analyzeChronicles,
} from "@/packages/ludics-core/dds/types/inference";
import type { DesignForCorrespondence } from "@/packages/ludics-core/dds/correspondence/types";

// Logging prefix for easy filtering
const LOG_PREFIX = "[TypeInference]";

/**
 * Log helper with timestamp
 */
function log(message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`${LOG_PREFIX} ${timestamp} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ${timestamp} ${message}`);
  }
}

/**
 * Prisma design type with acts including locus relation
 */
type PrismaDesignWithActs = {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: Array<{
    id: string;
    designId: string;
    locusId: string | null;
    locus: { path: string } | null;
    polarity: string | null;
    ramification: string[];
    kind: string;
    expression: string | null;
    orderInDesign: number;
  }>;
};

/**
 * Helper to convert Prisma design to DesignForCorrespondence format
 * Maps actual Prisma schema fields to the correspondence types
 */
function toDesignForCorr(design: PrismaDesignWithActs): DesignForCorrespondence {
  return {
    id: design.id,
    deliberationId: design.deliberationId,
    participantId: design.participantId,
    acts: design.acts.map((act) => ({
      id: act.id,
      designId: act.designId,
      // Use locus.path if available, otherwise fall back to locusId or generate from order
      locusPath: act.locus?.path || act.locusId || `${act.orderInDesign}`,
      polarity: (act.polarity as "P" | "O") || "P",
      // ramification is String[] in schema, convert to numbers where possible
      ramification: (act.ramification || []).map((r) => {
        const num = parseInt(r, 10);
        return isNaN(num) ? r : num;
      }),
      kind: act.kind as "PROPER" | "DAIMON",
      expression: act.expression || undefined,
      orderInDesign: act.orderInDesign,
    })),
  };
}

/**
 * Fetch design with acts including locus paths
 */
async function fetchDesignWithLocus(designId: string) {
  return prisma.ludicDesign.findUnique({
    where: { id: designId },
    include: {
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: "asc" },
      },
    },
  });
}

/**
 * Fetch all designs in a deliberation with acts including locus paths
 */
async function fetchDeliberationDesigns(deliberationId: string) {
  return prisma.ludicDesign.findMany({
    where: { deliberationId },
    include: {
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: "asc" },
      },
    },
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { designId, mode = "infer", compareDesignId } = await req.json();
    log(`POST request started`, { designId, mode, compareDesignId });

    if (!designId) {
      log(`Error: designId is required`);
      return NextResponse.json(
        { ok: false, error: "designId is required" },
        { status: 400 }
      );
    }

    // Fetch design with locus paths
    const fetchStart = Date.now();
    const design = await fetchDesignWithLocus(designId);
    log(`Design fetched in ${Date.now() - fetchStart}ms`, { 
      found: !!design, 
      actCount: design?.acts?.length || 0 
    });

    if (!design) {
      log(`Error: Design not found`, { designId });
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Analyze design structure for logging
    const acts = design.acts || [];
    const pathsWithLocus = acts.filter(a => a.locus?.path).length;
    const uniquePaths = new Set(acts.map(a => a.locus?.path).filter(Boolean));
    const depths = acts.map(a => (a.locus?.path || "").split(".").filter(Boolean).length);
    const maxDepth = Math.max(...depths, 0);
    const polarities = { P: acts.filter(a => a.polarity === "P").length, O: acts.filter(a => a.polarity === "O").length };
    const withRamification = acts.filter(a => a.ramification && a.ramification.length > 0).length;
    
    log(`Design structure analysis`, {
      designId,
      totalActs: acts.length,
      pathsWithLocus,
      uniquePaths: uniquePaths.size,
      maxDepth,
      polarities,
      withRamification,
      samplePaths: Array.from(uniquePaths).slice(0, 5),
    });

    const convertStart = Date.now();
    const designForCorr = toDesignForCorr(design as PrismaDesignWithActs);
    log(`Converted to correspondence format in ${Date.now() - convertStart}ms`);

    if (mode === "structural") {
      log(`Running structural inference`);
      const inferStart = Date.now();
      const typeStructure = inferTypeStructural(designForCorr);
      log(`Structural inference completed in ${Date.now() - inferStart}ms`, { 
        typeKind: typeStructure.kind,
        typeName: typeStructure.kind === "base" ? typeStructure.name : undefined,
      });

      return NextResponse.json({
        ok: true,
        designId,
        mode: "structural",
        type: typeStructure,
        confidence: 0.75,
        details: { method: "structural", actCount: design.acts.length },
      });
    } else if (mode === "behavioral") {
      log(`Running behavioral inference`);
      const fetchAllStart = Date.now();
      const allDesigns = await fetchDeliberationDesigns(design.deliberationId);
      log(`Fetched ${allDesigns.length} designs in ${Date.now() - fetchAllStart}ms`);

      const allDesignsForCorr = allDesigns.map((d) => toDesignForCorr(d as PrismaDesignWithActs));
      
      const inferStart = Date.now();
      const typeStructure = await inferTypeBehavioural(designForCorr, allDesignsForCorr);
      log(`Behavioral inference completed in ${Date.now() - inferStart}ms`, {
        typeKind: typeStructure.kind,
      });

      return NextResponse.json({
        ok: true,
        designId,
        mode: "behavioral",
        type: typeStructure,
        confidence: 0.8,
        details: { method: "behavioral", designCount: allDesigns.length },
      });
    } else if (mode === "chronicle") {
      log(`Running chronicle-based inference (Prop 4.27)`);
      const inferStart = Date.now();
      const result = inferTypeFromDesignChronicles(designForCorr);
      log(`Chronicle inference completed in ${Date.now() - inferStart}ms`, {
        typeKind: result.type.kind,
        confidence: result.confidence,
        chronicleCount: result.analysis.chronicleCount,
        maxDepth: result.analysis.maxDepth,
      });

      return NextResponse.json({
        ok: true,
        designId,
        mode: "chronicle",
        type: result.type,
        confidence: result.confidence,
        details: {
          method: "chronicle",
          actCount: design.acts.length,
          chronicleAnalysis: result.analysis,
        },
      });
    } else if (mode === "compare" && compareDesignId) {
      // Compare types of two designs
      log(`Compare mode: comparing ${designId} with ${compareDesignId}`);
      const compareDesign = await fetchDesignWithLocus(compareDesignId);

      if (!compareDesign) {
        log(`Compare design ${compareDesignId} not found`);
        return NextResponse.json(
          { ok: false, error: "Compare design not found" },
          { status: 404 }
        );
      }

      const compareDesignForCorr = toDesignForCorr(compareDesign as PrismaDesignWithActs);
      
      log(`Inferring types for comparison...`);
      const typeA = inferTypeStructural(designForCorr);
      log(`Design A type: ${JSON.stringify(typeA)}`);
      const typeB = inferTypeStructural(compareDesignForCorr);
      log(`Design B type: ${JSON.stringify(typeB)}`);
      
      const unification = unifyTypes(typeA, typeB);
      log(`Unification result: ${unification ? "equivalent" : "not equivalent"}`);

      return NextResponse.json({
        ok: true,
        designA: {
          id: designId,
          type: typeA,
          confidence: 0.75,
        },
        designB: {
          id: compareDesignId,
          type: typeB,
          confidence: 0.75,
        },
        typeEquivalence: {
          areEquivalent: unification !== null,
          substitution: unification ? Object.fromEntries(unification) : null,
        },
      });
    } else {
      // Default: full type inference using all three methods
      log(`Default infer mode for design ${designId}`);
      const inferStart = Date.now();
      
      const allDesigns = await fetchDeliberationDesigns(design.deliberationId);
      log(`Fetched ${allDesigns.length} designs for behavioral context`);

      const allDesignsForCorr = allDesigns.map((d) => toDesignForCorr(d as PrismaDesignWithActs));
      
      log(`Starting full type inference (structural + behavioral + chronicle)...`);
      const result = await inferDesignType(designForCorr, allDesignsForCorr);
      log(`Full inference completed in ${Date.now() - inferStart}ms`, {
        inferredType: result.inferredType,
        confidence: result.confidence,
        method: result.method,
        alternativeCount: result.alternatives?.length || 0,
      });

      return NextResponse.json({
        ok: true,
        designId,
        mode: "infer",
        type: result.inferredType,
        confidence: result.confidence,
        method: result.method,
        alternatives: result.alternatives,
        inferenceDetails: {
          designCount: allDesigns.length,
        },
      });
    }
  } catch (error: any) {
    console.error("[DDS Type Inference Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");
    const deliberationId = url.searchParams.get("deliberationId");

    log(`GET request`, { designId, deliberationId });

    if (designId) {
      // Get type for specific design
      log(`GET: Fetching design ${designId}`);
      const design = await fetchDesignWithLocus(designId);

      if (!design) {
        log(`GET: Design ${designId} not found`);
        return NextResponse.json(
          { ok: false, error: "Design not found" },
          { status: 404 }
        );
      }

      // Fetch all designs for behavioral inference
      log(`GET: Fetching all designs for deliberation ${design.deliberationId}`);
      const allDesigns = await fetchDeliberationDesigns(design.deliberationId);
      log(`GET: Found ${allDesigns.length} designs in deliberation`);

      const designForCorr = toDesignForCorr(design as PrismaDesignWithActs);
      const allDesignsForCorr = allDesigns.map((d) => toDesignForCorr(d as PrismaDesignWithActs));
      
      log(`GET: Running full type inference for design ${designId}`);
      const inferStart = Date.now();
      const result = await inferDesignType(designForCorr, allDesignsForCorr);
      log(`GET: Inference completed in ${Date.now() - inferStart}ms`, {
        type: result.inferredType,
        confidence: result.confidence,
        method: result.method,
      });

      return NextResponse.json({
        ok: true,
        designId,
        type: result.inferredType,
        confidence: result.confidence,
        method: result.method,
        details: {
          alternatives: result.alternatives,
          designCount: allDesigns.length,
        },
      });
    }


    if (deliberationId) {
      // Get types for all designs in deliberation
      log(`GET: Fetching all designs for deliberation ${deliberationId}`);
      const designs = await fetchDeliberationDesigns(deliberationId);
      log(`GET: Found ${designs.length} designs`);

      const allDesignsForCorr = designs.map((d) => toDesignForCorr(d as PrismaDesignWithActs));

      log(`GET: Running type inference for all ${designs.length} designs...`);
      const inferStart = Date.now();
      
      const typesPromises = allDesignsForCorr.map(async (d) => {
        const result = await inferDesignType(d, allDesignsForCorr);
        return {
          designId: d.id,
          type: result.inferredType,
          confidence: result.confidence,
          method: result.method,
        };
      });

      const types = await Promise.all(typesPromises);
      log(`GET: All inferences completed in ${Date.now() - inferStart}ms`);

      // Group by type equivalence
      const typeGroups: Record<string, string[]> = {};
      for (const t of types) {
        const typeKey = JSON.stringify(t.type);
        if (!typeGroups[typeKey]) {
          typeGroups[typeKey] = [];
        }
        typeGroups[typeKey].push(t.designId);
      }

      log(`GET: Found ${Object.keys(typeGroups).length} unique types among ${designs.length} designs`);

      return NextResponse.json({
        ok: true,
        deliberationId,
        designs: types,
        typeGroups: Object.entries(typeGroups).map(([typeKey, designIds]) => ({
          type: JSON.parse(typeKey),
          designIds,
          count: designIds.length,
        })),
        totalDesigns: designs.length,
        uniqueTypes: Object.keys(typeGroups).length,
      });
    }

    return NextResponse.json(
      { ok: false, error: "designId or deliberationId required" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[DDS Type Inference GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
