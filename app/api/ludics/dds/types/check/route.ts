export const dynamic = "force-dynamic";

/**
 * API Route: Type Checking
 * 
 * POST /api/ludics/dds/types/check
 * 
 * Verifies the typing judgment D : A (design D has type A).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import type { DesignForCorrespondence, DesignAct } from "@/packages/ludics-core/dds/correspondence/types";
import type { TypeStructure, TypeCheckResult } from "@/packages/ludics-core/dds/types/types";
import { checkDesignType, typeToString } from "@/packages/ludics-core/dds/types/typecheck";

const LOG_PREFIX = "[TypeCheck API]";
function log(msg: string, data?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`${LOG_PREFIX} ${timestamp} ${msg}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ${timestamp} ${msg}`);
  }
}

/**
 * Prisma result type with acts and locus
 */
type PrismaDesignWithActs = {
  id: string;
  deliberationId: string;
  participantId: string;
  acts: Array<{
    id: string;
    expression: string | null;
    polarity: string | null;
    kind: string;
    ramification: string[];
    locus: { path: string } | null;
  }>;
};

/**
 * Convert Prisma design to DesignForCorrespondence format
 */
function toDesignForCorr(design: PrismaDesignWithActs): DesignForCorrespondence {
  return {
    id: design.id,
    deliberationId: design.deliberationId,
    participantId: design.participantId,
    acts: design.acts.map((act): DesignAct => ({
      id: act.id,
      designId: design.id,
      expression: act.expression || "",
      polarity: (act.polarity as "P" | "O") || "P",
      kind: act.kind as "PROPER" | "DAIMON",
      ramification: act.ramification.map(r => {
        const num = parseInt(r, 10);
        return isNaN(num) ? r : num;
      }),
      locusPath: act.locus?.path || "",
    })),
  };
}

/**
 * Fetch design with acts
 */
async function fetchDesignWithActs(designId: string) {
  return prisma.ludicDesign.findUnique({
    where: { id: designId },
    include: {
      acts: {
        include: { locus: true },
      },
    },
  });
}

/**
 * Fetch all designs in a deliberation
 */
async function fetchDeliberationDesigns(deliberationId: string) {
  return prisma.ludicDesign.findMany({
    where: { deliberationId },
    include: {
      acts: {
        include: { locus: true },
      },
    },
  });
}

/**
 * POST /api/ludics/dds/types/check
 * 
 * Body:
 * - designId: string - Design to check
 * - targetType: TypeStructure - Type to check against
 * - method?: "structural" | "inference" | "orthogonality" | "combined"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { designId, targetType, method = "combined" } = body;

    log(`POST request`, { designId, targetTypeKind: targetType?.kind, method });

    if (!designId) {
      return NextResponse.json(
        { ok: false, error: "designId is required" },
        { status: 400 }
      );
    }

    if (!targetType || !targetType.kind) {
      return NextResponse.json(
        { ok: false, error: "targetType with kind is required" },
        { status: 400 }
      );
    }

    // Fetch the design
    const design = await fetchDesignWithActs(designId);
    if (!design) {
      log(`Design not found: ${designId}`);
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    log(`Fetched design ${designId} with ${design.acts.length} acts`);

    // Fetch all designs for behavioral context
    const allDesigns = await fetchDeliberationDesigns(design.deliberationId);
    log(`Fetched ${allDesigns.length} designs for context`);

    // Convert to correspondence format
    const designForCorr = toDesignForCorr(design as unknown as PrismaDesignWithActs);
    const allDesignsForCorr = allDesigns.map((d: any) => toDesignForCorr(d as unknown as PrismaDesignWithActs));

    // Run type check
    log(`Running type check (method: ${method})...`);
    const checkStart = Date.now();
    
    const result = await checkDesignType(designForCorr, targetType, {
      method,
      allDesigns: allDesignsForCorr,
      skipOrthogonality: method !== "orthogonality",
    });

    log(`Type check completed in ${Date.now() - checkStart}ms`, {
      isValid: result.isValid,
      confidence: result.confidence,
      method: result.method,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ludics/dds/types/check
 * 
 * Query params:
 * - designId: string - Design to check
 * - typeKind: string - Type kind (arrow, product, sum, unit, base)
 * 
 * Quick check using structural method
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const designId = url.searchParams.get("designId");
    const typeKind = url.searchParams.get("typeKind") || "arrow";

    log(`GET request`, { designId, typeKind });

    if (!designId) {
      return NextResponse.json(
        { ok: false, error: "designId is required" },
        { status: 400 }
      );
    }

    // Fetch the design
    const design = await fetchDesignWithActs(designId);
    if (!design) {
      return NextResponse.json(
        { ok: false, error: "Design not found" },
        { status: 404 }
      );
    }

    // Convert to correspondence format
    const designForCorr = toDesignForCorr(design as unknown as PrismaDesignWithActs);

    // Build simple target type
    const targetType: TypeStructure = { kind: typeKind as any };

    // Quick structural check
    const result = await checkDesignType(designForCorr, targetType, {
      method: "structural",
    });

    return NextResponse.json({
      ok: true,
      designId,
      typeKind,
      isValid: result.isValid,
      confidence: result.confidence,
      analysis: result.analysis.structural,
    });
  } catch (error: any) {
    console.error(`${LOG_PREFIX} GET Error:`, error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
