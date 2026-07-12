export const dynamic = "force-dynamic";

// app/api/arguments/[id]/hom-set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import {
  computeHomSetConfidence,
  type Morphism,
  type HomSetConfidenceResult,
} from "@/lib/agora/homSetConfidence";
import { EdgeType } from "@prisma/client";

/**
 * GET /api/arguments/[id]/hom-set
 * 
 * Retrieve morphisms (edges) in hom-sets involving an argument:
 * - Hom(A, *): Outgoing edges from argument A
 * - Hom(*, A): Incoming edges to argument A
 * - Optionally compute aggregate confidence metrics
 * 
 * Query Parameters:
 * - direction: "outgoing" | "incoming" | "both" (default: "both")
 * - edgeType: Filter by edge type (support, rebut, undercut, etc.)
 * - minConfidence: Minimum confidence threshold (0-1)
 * - maxConfidence: Maximum confidence threshold (0-1)
 * - targetArgumentId: Filter edges to/from specific target argument
 * - computeAggregate: "true" to compute aggregate confidence (default: "false")
 * - includeCompositionalPaths: "true" to include compositional paths (default: "false")
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const argumentId = params.id;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const direction = searchParams.get("direction") || "both";
    const edgeTypeFilter = searchParams.get("edgeType") as EdgeType | null;
    const minConfidence = parseFloat(searchParams.get("minConfidence") || "0");
    const maxConfidence = parseFloat(searchParams.get("maxConfidence") || "1");
    const targetArgumentId = searchParams.get("targetArgumentId");
    const computeAggregate = searchParams.get("computeAggregate") === "true";
    const includeCompositionalPaths =
      searchParams.get("includeCompositionalPaths") === "true";

    // Validate argument exists
    const argument = await prisma.argument.findUnique({
      where: { id: argumentId },
      select: { id: true, deliberationId: true },
    });

    if (!argument) {
      return NextResponse.json(
        { error: "Argument not found" },
        { status: 404 }
      );
    }

    // Build query filters
    const whereClause: any = {
      deliberationId: argument.deliberationId,
    };

    // Direction filter
    if (direction === "outgoing") {
      whereClause.fromArgumentId = argumentId;
    } else if (direction === "incoming") {
      whereClause.toArgumentId = argumentId;
    } else {
      // Both: (from = A) OR (to = A)
      whereClause.OR = [
        { fromArgumentId: argumentId },
        { toArgumentId: argumentId },
      ];
    }

    // Edge type filter
    if (edgeTypeFilter) {
      whereClause.type = edgeTypeFilter;
    }

    // Target argument filter
    if (targetArgumentId) {
      if (direction === "outgoing") {
        whereClause.toArgumentId = targetArgumentId;
      } else if (direction === "incoming") {
        whereClause.fromArgumentId = targetArgumentId;
      } else {
        // Both directions: must connect to target
        whereClause.OR = [
          { fromArgumentId: argumentId, toArgumentId: targetArgumentId },
          { fromArgumentId: targetArgumentId, toArgumentId: argumentId },
        ];
      }
    }

    // Fetch edges
    const edges = await prisma.argumentEdge.findMany({
      where: whereClause,
      select: {
        id: true,
        fromArgumentId: true,
        toArgumentId: true,
        type: true,
        createdAt: true,
        // Note: confidence not currently in ArgumentEdge schema
        // Will need to add or compute from related data
        from: {
          select: {
            id: true,
            text: true,
            confidence: true,
          },
        },
        to: {
          select: {
            id: true,
            text: true,
            confidence: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Convert to Morphism format
    const morphisms: Morphism[] = edges.map((edge) => ({
      id: edge.id,
      fromArgumentId: edge.fromArgumentId,
      toArgumentId: edge.toArgumentId,
      type: edge.type,
      // Use source argument confidence as proxy for edge confidence
      // TODO: Add explicit edge confidence field in future schema update
      confidence: edge.from.confidence ?? 0.5,
      createdAt: edge.createdAt,
    }));

    // Apply confidence filter
    const filteredMorphisms = morphisms.filter(
      (m) =>
        (m.confidence ?? 0.5) >= minConfidence &&
        (m.confidence ?? 0.5) <= maxConfidence
    );

    // Compute aggregate confidence if requested
    let aggregateResult: HomSetConfidenceResult | undefined;
    if (computeAggregate) {
      aggregateResult = computeHomSetConfidence(filteredMorphisms, {
        includeCompositionalPaths,
      });
    }

    // Build response
    const response: any = {
      argumentId,
      direction,
      morphismCount: filteredMorphisms.length,
      morphisms: filteredMorphisms.map((m) => ({
        id: m.id,
        fromArgumentId: m.fromArgumentId,
        toArgumentId: m.toArgumentId,
        type: m.type,
        confidence: m.confidence,
        createdAt: m.createdAt,
        // Include argument text for UI display
        fromText:
          edges.find((e) => e.id === m.id)?.from.text?.substring(0, 100) +
          "...",
        toText:
          edges.find((e) => e.id === m.id)?.to.text?.substring(0, 100) + "...",
      })),
    };

    if (aggregateResult) {
      response.aggregate = aggregateResult;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching hom-set:", error);
    return NextResponse.json(
      { error: "Failed to fetch hom-set" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/arguments/[id]/hom-set/compute
 * 
 * Compute aggregate confidence for a custom set of morphisms.
 * Useful for analyzing specific subsets or testing different configurations.
 * 
 * Body:
 * {
 *   morphismIds: string[],
 *   includeCompositionalPaths?: boolean,
 *   uncertaintyFactor?: number
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromCookies();
    if (!user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const argumentId = params.id;
    const body = await request.json();
    const {
      morphismIds = [],
      includeCompositionalPaths = false,
      uncertaintyFactor = 0.1,
    } = body;

    if (!Array.isArray(morphismIds) || morphismIds.length === 0) {
      return NextResponse.json(
        { error: "morphismIds array required" },
        { status: 400 }
      );
    }

    // Fetch specified edges
    const edges = await prisma.argumentEdge.findMany({
      where: {
        id: { in: morphismIds },
        OR: [
          { fromArgumentId: argumentId },
          { toArgumentId: argumentId },
        ],
      },
      select: {
        id: true,
        fromArgumentId: true,
        toArgumentId: true,
        type: true,
        createdAt: true,
        from: {
          select: { confidence: true },
        },
      },
    });

    if (edges.length === 0) {
      return NextResponse.json(
        { error: "No matching morphisms found" },
        { status: 404 }
      );
    }

    // Convert to Morphism format
    const morphisms: Morphism[] = edges.map((edge) => ({
      id: edge.id,
      fromArgumentId: edge.fromArgumentId,
      toArgumentId: edge.toArgumentId,
      type: edge.type,
      confidence: edge.from.confidence ?? 0.5,
      createdAt: edge.createdAt,
    }));

    // Compute aggregate confidence
    const aggregateResult = computeHomSetConfidence(morphisms, {
      includeCompositionalPaths,
      uncertaintyFactor,
    });

    return NextResponse.json(
      {
        argumentId,
        morphismCount: morphisms.length,
        aggregate: aggregateResult,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error computing hom-set confidence:", error);
    return NextResponse.json(
      { error: "Failed to compute hom-set confidence" },
      { status: 500 }
    );
  }
}
