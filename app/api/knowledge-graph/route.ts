export const dynamic = "force-dynamic";

/**
 * Phase 3.4.1: Knowledge Graph API
 * 
 * Provides endpoints for querying the knowledge graph for visualization.
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  queryKnowledgeGraph, 
  searchNodes, 
  getGraphStats,
  GraphQueryOptions 
} from "@/lib/knowledgeGraph";

// Valid node and edge types for the knowledge graph
type NodeType = "source" | "topic" | "claim" | "deliberation" | "argument" | "author" | "institution";
type EdgeType = "cites" | "discusses" | "contains" | "supports" | "refutes" | "authored_by" | "affiliated_with" | "related_to" | "builds_on";

/**
 * GET /api/knowledge-graph
 * 
 * Query the knowledge graph for visualization
 * 
 * Query params:
 * - centerType: Node type to center on (source, topic, deliberation, etc.)
 * - centerId: Reference ID of the center node
 * - depth: How many hops from center (default: 2)
 * - maxNodes: Maximum nodes to return (default: 100)
 * - nodeTypes: Comma-separated list of node types to include
 * - edgeTypes: Comma-separated list of edge types to include
 * - search: Search query for node labels
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Check for search mode
    const search = searchParams.get("search");
    if (search) {
      const nodeTypesParam = searchParams.get("nodeTypes");
      const limit = parseInt(searchParams.get("limit") || "20", 10);
      
      const nodeTypes = nodeTypesParam 
        ? nodeTypesParam.split(",").filter(Boolean) as NodeType[]
        : undefined;
      
      const nodes = await searchNodes(search, { nodeTypes: nodeTypes as any, limit });
      return NextResponse.json({ nodes, mode: "search" });
    }
    
    // Check for stats mode
    if (searchParams.get("stats") === "true") {
      const stats = await getGraphStats();
      return NextResponse.json({ stats, mode: "stats" });
    }
    
    // Graph query mode
    const centerType = searchParams.get("centerType") as NodeType | null;
    const centerId = searchParams.get("centerId");
    const depth = parseInt(searchParams.get("depth") || "2", 10);
    const maxNodes = Math.min(500, parseInt(searchParams.get("maxNodes") || "100", 10));
    
    const nodeTypesParam = searchParams.get("nodeTypes");
    const edgeTypesParam = searchParams.get("edgeTypes");
    
    const nodeTypes = nodeTypesParam 
      ? nodeTypesParam.split(",").filter(Boolean) as NodeType[]
      : undefined;
    
    const edgeTypes = edgeTypesParam 
      ? edgeTypesParam.split(",").filter(Boolean) as EdgeType[]
      : undefined;
    
    const options: GraphQueryOptions = {
      centerNodeType: centerType as any || undefined,
      centerNodeId: centerId || undefined,
      depth: Math.min(5, depth), // Cap depth at 5
      maxNodes,
      nodeTypes: nodeTypes as any,
      edgeTypes: edgeTypes as any,
    };
    
    const graphData = await queryKnowledgeGraph(options);
    
    return NextResponse.json({
      ...graphData,
      mode: "graph",
      query: {
        centerType,
        centerId,
        depth: options.depth,
        maxNodes: options.maxNodes,
      },
    });
  } catch (error) {
    console.error("[KnowledgeGraph API] Error:", error);
    return NextResponse.json(
      { error: "Failed to query knowledge graph" },
      { status: 500 }
    );
  }
}
