export const dynamic = "force-dynamic";

/**
 * DDS Views API - Deliberation-Wide View Computation
 * GET/POST /api/ludics/dds/views
 * 
 * Computes views from disputes between P and O designs at shared loci.
 * Views emerge from interactions (normalization) between designs.
 * 
 * Based on Faggian & Hyland (2002) Definition 3.5:
 * - Views are player-specific projections of positions
 * - Multiple views arise from branching interaction paths
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  extractProponentView,
  extractOpponentView,
} from "@/packages/ludics-core/dds";
import type { Action, Position } from "@/packages/ludics-core/dds/types";

// Extended View type with length for API responses
type ViewWithLength = {
  id: string;
  player: "P" | "O";
  sequence: Action[];
  designId: string;
  parentDisputeId?: string;
  length: number;
};

/**
 * GET: Fetch cached views for a deliberation
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const deliberationId = url.searchParams.get("deliberationId");
    const designId = url.searchParams.get("designId"); // For backward compatibility
    const scope = url.searchParams.get("scope"); // Filter by scope
    const player = url.searchParams.get("player") as "P" | "O" | null;

    if (!deliberationId && !designId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId or designId query param required" },
        { status: 400 }
      );
    }

    // Build where clause
    let where: any = {};
    if (deliberationId) {
      // Get designs for this deliberation, optionally filtered by scope
      let designWhere: any = { deliberationId };
      if (scope) designWhere.scope = scope;
      
      let designs = await prisma.ludicDesign.findMany({
        where: designWhere,
        select: { id: true },
      });
      
      // Fall back to all designs if scope filter returns nothing
      if (designs.length === 0 && scope) {
        designs = await prisma.ludicDesign.findMany({
          where: { deliberationId },
          select: { id: true },
        });
      }
      
      where.designId = { in: designs.map((d) => d.id) };
    } else {
      where.designId = designId;
    }
    if (player) where.player = player;

    const views = await prisma.ludicView.findMany({
      where,
      orderBy: [
        { player: "asc" }, // P before O
        { createdAt: "desc" },
      ],
      // No limit - return all views for deliberation-wide analysis
    });

    // Map to View type format
    const formattedViews: ViewWithLength[] = views.map((v) => ({
      id: v.id,
      designId: v.designId,
      player: v.player as "P" | "O",
      sequence: (v.viewSequence as any[]) || [],
      length: ((v.viewSequence as any[]) || []).length,
    }));

    // Return with stats
    const pCount = formattedViews.filter(v => v.player === "P").length;
    const oCount = formattedViews.filter(v => v.player === "O").length;

    return NextResponse.json({
      ok: true,
      views: formattedViews,
      count: formattedViews.length,
      stats: {
        pViewCount: pCount,
        oViewCount: oCount,
      },
    });
  } catch (error: any) {
    console.error("[DDS Views GET Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST: Compute views from deliberation by auto-computing disputes
 * 
 * This is the key function that:
 * 1. Fetches both P and O designs for the deliberation
 * 2. Finds shared loci between them
 * 3. Builds interaction positions (alternating P/O at shared loci)
 * 4. Extracts views from each interaction path
 */
export async function POST(req: NextRequest) {
  try {
    const { deliberationId, designId, scope, forceRecompute } = await req.json();

    // Support both deliberationId (preferred) and designId (backward compat)
    let targetDeliberationId = deliberationId;
    let targetScope = scope; // Optional scope filter
    
    if (!targetDeliberationId && designId) {
      // Get deliberationId and scope from design
      const design = await prisma.ludicDesign.findUnique({
        where: { id: designId },
        select: { deliberationId: true, scope: true },
      });
      if (!design) {
        return NextResponse.json(
          { ok: false, error: "Design not found" },
          { status: 404 }
        );
      }
      targetDeliberationId = design.deliberationId;
      // If no scope specified but we got a designId, use that design's scope
      if (!targetScope && design.scope) {
        targetScope = design.scope;
      }
    }

    if (!targetDeliberationId) {
      return NextResponse.json(
        { ok: false, error: "deliberationId is required" },
        { status: 400 }
      );
    }

    // Fetch designs for this deliberation, optionally filtered by scope
    let designWhere: any = { deliberationId: targetDeliberationId };
    if (targetScope) {
      designWhere.scope = targetScope;
      console.log(`[Views] Filtering by scope: ${targetScope}`);
    }
    
    let designs = await prisma.ludicDesign.findMany({
      where: designWhere,
      include: {
        acts: {
          include: { locus: true },
          orderBy: { orderInDesign: "asc" },
        },
      },
    });

    // If no designs found with scope filter, fall back to all designs
    if (designs.length === 0 && targetScope) {
      console.log(`[Views] No designs found for scope '${targetScope}', falling back to all designs`);
      designs = await prisma.ludicDesign.findMany({
        where: { deliberationId: targetDeliberationId },
        include: {
          acts: {
            include: { locus: true },
            orderBy: { orderInDesign: "asc" },
          },
        },
      });
    }

    if (designs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No designs found for deliberation" },
        { status: 404 }
      );
    }

    // Aggregate ALL P and O designs (may span multiple scopes)
    const pDesigns = designs.filter((d) => d.participantId === "Proponent");
    const oDesigns = designs.filter((d) => d.participantId === "Opponent");
    
    // Collect all acts from all designs of each type
    const allPActs = pDesigns.flatMap((d) => d.acts);
    const allOActs = oDesigns.flatMap((d) => d.acts);
    
    // Use first design of each type as representative (for storing views)
    const pDesign = pDesigns[0];
    const oDesign = oDesigns[0];

    console.log(`[Views] Found ${pDesigns.length} P designs with ${allPActs.length} total P acts`);
    console.log(`[Views] Found ${oDesigns.length} O designs with ${allOActs.length} total O acts`);

    if (!pDesign || !oDesign) {
      return NextResponse.json({
        ok: true,
        views: [],
        count: 0,
        message: "Need both Proponent and Opponent designs to compute views",
      });
    }

    // Get all design IDs for cache lookup/deletion
    const allDesignIds = designs.map((d) => d.id);

    // Check for cached views if not forcing recompute
    if (!forceRecompute) {
      const existingViews = await prisma.ludicView.findMany({
        where: {
          designId: { in: allDesignIds },
        },
      });

      if (existingViews.length > 0) {
        const formattedViews: ViewWithLength[] = existingViews.map((v) => ({
          id: v.id,
          designId: v.designId,
          player: v.player as "P" | "O",
          sequence: (v.viewSequence as any[]) || [],
          length: ((v.viewSequence as any[]) || []).length,
        }));

        return NextResponse.json({
          ok: true,
          views: formattedViews,
          count: formattedViews.length,
          cached: true,
        });
      }
    } else {
      // Delete existing views when forcing recompute
      await prisma.ludicView.deleteMany({
        where: {
          designId: { in: allDesignIds },
        },
      });
    }

    // Build act index by locus path (aggregate from ALL designs)
    const pActsByLocus = new Map<string, typeof pDesign.acts>();
    const oActsByLocus = new Map<string, typeof oDesign.acts>();

    for (const act of allPActs) {
      const path = act.locus?.path || "0";
      if (!pActsByLocus.has(path)) pActsByLocus.set(path, []);
      pActsByLocus.get(path)!.push(act);
    }

    for (const act of allOActs) {
      const path = act.locus?.path || "0";
      if (!oActsByLocus.has(path)) oActsByLocus.set(path, []);
      oActsByLocus.get(path)!.push(act);
    }

    // Find all loci that appear in both designs (shared interaction points)
    const allLoci = new Set([...pActsByLocus.keys(), ...oActsByLocus.keys()]);
    const sharedLoci = [...allLoci].filter(
      (l) => pActsByLocus.has(l) || oActsByLocus.has(l)
    );

    // Sort loci by depth and then lexicographically for deterministic ordering
    sharedLoci.sort((a, b) => {
      const depthA = a.split(".").length;
      const depthB = b.split(".").length;
      if (depthA !== depthB) return depthA - depthB;
      return a.localeCompare(b);
    });

    console.log(`[Views] Found ${sharedLoci.length} loci for deliberation ${targetDeliberationId}`);
    console.log(`[Views] P acts at loci: ${[...pActsByLocus.keys()].join(", ")}`);
    console.log(`[Views] O acts at loci: ${[...oActsByLocus.keys()].join(", ")}`);

    // Build interaction positions from the tree structure
    // Each path through the tree creates a position
    const { pPositions, oPositions } = buildInteractionPositions(
      pActsByLocus,
      oActsByLocus,
      sharedLoci
    );

    console.log(`[Views] Generated ${pPositions.length} P positions, ${oPositions.length} O positions`);

    // Extract views from positions
    const allViews: ViewWithLength[] = [];
    const seenViewKeys = new Set<string>();

    // Extract P views from P-focused positions
    for (const position of pPositions) {
      const pView = extractProponentView(position);
      const pKey = viewKey(pView);
      if (!seenViewKeys.has(pKey) && pView.length > 0) {
        seenViewKeys.add(pKey);
        allViews.push({
          id: `view-P-${allViews.length}`,
          designId: pDesign.id,
          player: "P",
          sequence: pView,
          length: pView.length,
        });
      }
    }

    // Extract O views from O-focused positions
    for (const position of oPositions) {
      const oView = extractOpponentView(position);
      const oKey = viewKey(oView);
      if (!seenViewKeys.has(oKey) && oView.length > 0) {
        seenViewKeys.add(oKey);
        allViews.push({
          id: `view-O-${allViews.length}`,
          designId: oDesign.id,
          player: "O",
          sequence: oView,
          length: oView.length,
        });
      }
    }

    console.log(`[Views] Extracted ${allViews.filter(v => v.player === "P").length} P views, ${allViews.filter(v => v.player === "O").length} O views`);

    // If no interaction positions (no shared loci), create views from each design's acts independently
    if (pPositions.length === 0 && oPositions.length === 0) {
      console.log(`[Views] No interaction positions, creating act-based views`);
      
      // P design view
      const pSequence: Action[] = pDesign.acts.map((act) => ({
        focus: act.locus?.path || "0",
        polarity: "P" as const,
        ramification: [],
        actId: act.id,
      }));
      if (pSequence.length > 0) {
        allViews.push({
          id: `view-P-acts`,
          designId: pDesign.id,
          player: "P",
          sequence: pSequence,
          length: pSequence.length,
        });
      }

      // O design view
      const oSequence: Action[] = oDesign.acts.map((act) => ({
        focus: act.locus?.path || "0",
        polarity: "O" as const,
        ramification: [],
        actId: act.id,
      }));
      if (oSequence.length > 0) {
        allViews.push({
          id: `view-O-acts`,
          designId: oDesign.id,
          player: "O",
          sequence: oSequence,
          length: oSequence.length,
        });
      }
    }

    // Save views to database
    // First verify the designs still exist (race condition protection)
    const designsStillExist = await prisma.ludicDesign.findMany({
      where: { id: { in: [pDesign.id, oDesign.id] } },
      select: { id: true },
    });
    
    if (designsStillExist.length < 2) {
      console.log(`[Views] Designs were deleted during computation, aborting save`);
      return NextResponse.json({
        ok: false,
        error: "Designs were deleted during view computation. Please recompute.",
        views: [],
        count: 0,
      }, { status: 409 }); // Conflict
    }
    
    const savedViews: ViewWithLength[] = [];
    for (const view of allViews) {
      try {
        const saved = await prisma.ludicView.create({
          data: {
            designId: view.designId,
            player: view.player,
            viewSequence: view.sequence as any,
          },
        });
        savedViews.push({
          id: saved.id,
          designId: saved.designId,
          player: saved.player as "P" | "O",
          sequence: view.sequence,
          length: view.sequence.length,
        });
      } catch (err: any) {
        // Handle race condition where design is deleted mid-save
        if (err.code === 'P2003') {
          console.log(`[Views] Design ${view.designId} was deleted during save, skipping remaining views`);
          break;
        }
        throw err;
      }
    }

    return NextResponse.json({
      ok: true,
      views: savedViews,
      count: savedViews.length,
      cached: false,
      stats: {
        pDesignId: pDesign.id,
        oDesignId: oDesign.id,
        sharedLociCount: sharedLoci.length,
        pPositionCount: pPositions.length,
        oPositionCount: oPositions.length,
        pActCount: pDesign.acts.length,
        oActCount: oDesign.acts.length,
      },
    });
  } catch (error: any) {
    console.error("[DDS Views POST Error]", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Build interaction positions from the tree structure
 * 
 * Each path through the tree (following parent-child relationships)
 * creates interaction positions showing how P and O acts meet.
 * 
 * Returns separate P-focused and O-focused positions:
 * - P positions: P acts are positive (player's own), O acts are negative (opponent's)
 * - O positions: O acts are positive (player's own), P acts are negative (opponent's)
 */
function buildInteractionPositions(
  pActsByLocus: Map<string, any[]>,
  oActsByLocus: Map<string, any[]>,
  allLoci: string[]
): { pPositions: Position[]; oPositions: Position[] } {
  // Build tree structure from loci paths
  interface TreeNode {
    path: string;
    children: TreeNode[];
    pActs: any[];
    oActs: any[];
  }

  const root: TreeNode = {
    path: "0",
    children: [],
    pActs: pActsByLocus.get("0") || [],
    oActs: oActsByLocus.get("0") || [],
  };

  const nodesByPath = new Map<string, TreeNode>();
  nodesByPath.set("0", root);

  // Build tree from loci
  for (const path of allLoci) {
    if (path === "0") continue;
    
    const parts = path.split(".");
    const parentPath = parts.slice(0, -1).join(".") || "0";
    
    let parent = nodesByPath.get(parentPath);
    if (!parent) {
      // Create missing parent nodes
      parent = {
        path: parentPath,
        children: [],
        pActs: pActsByLocus.get(parentPath) || [],
        oActs: oActsByLocus.get(parentPath) || [],
      };
      nodesByPath.set(parentPath, parent);
    }

    const node: TreeNode = {
      path,
      children: [],
      pActs: pActsByLocus.get(path) || [],
      oActs: oActsByLocus.get(path) || [],
    };
    nodesByPath.set(path, node);
    parent.children.push(node);
  }

  // DFS to collect all paths through the tree
  function collectPaths(node: TreeNode, currentPath: TreeNode[]): TreeNode[][] {
    const paths: TreeNode[][] = [];
    const withCurrent = [...currentPath, node];
    
    if (node.children.length === 0) {
      // Leaf node - this is a complete path
      paths.push(withCurrent);
    } else {
      // Continue down each child branch
      for (const child of node.children) {
        paths.push(...collectPaths(child, withCurrent));
      }
    }
    
    return paths;
  }

  const treePaths = collectPaths(root, []);

  // Build P-focused positions (P is the protagonist, O is the respondent)
  // In these positions, P acts come first at each locus, then O responds
  const pPositions: Position[] = [];
  
  for (const treePath of treePaths) {
    const sequence: Action[] = [];
    
    for (const node of treePath) {
      // P acts first (positive moves for P)
      for (const act of node.pActs) {
        sequence.push({
          focus: node.path,
          polarity: "P",
          ramification: act.ramification || [],
          actId: act.id,
        });
      }
      // O responds (negative moves for P, but P still needs to see them)
      for (const act of node.oActs) {
        sequence.push({
          focus: node.path,
          polarity: "O",
          ramification: act.ramification || [],
          actId: act.id,
        });
      }
    }

    if (sequence.length > 0) {
      pPositions.push({
        id: `pos-P-${pPositions.length}`,
        sequence,
        player: "P",
        isLinear: true,
        isLegal: true,
      });
    }
  }

  // Build O-focused positions (O is the protagonist, P is the respondent)
  // In these positions, O acts come first at each locus, then P responds
  const oPositions: Position[] = [];
  
  for (const treePath of treePaths) {
    const sequence: Action[] = [];
    
    for (const node of treePath) {
      // O acts first (positive moves for O)
      for (const act of node.oActs) {
        sequence.push({
          focus: node.path,
          polarity: "O",
          ramification: act.ramification || [],
          actId: act.id,
        });
      }
      // P responds (negative moves for O, but O still needs to see them)
      for (const act of node.pActs) {
        sequence.push({
          focus: node.path,
          polarity: "P",
          ramification: act.ramification || [],
          actId: act.id,
        });
      }
    }

    if (sequence.length > 0) {
      oPositions.push({
        id: `pos-O-${oPositions.length}`,
        sequence,
        player: "O",
        isLinear: true,
        isLegal: true,
      });
    }
  }

  // Also add prefixes of each path as positions (for partial views)
  const allPPositions = [...pPositions];
  for (const pos of pPositions) {
    for (let i = 1; i < pos.sequence.length; i++) {
      const prefix = pos.sequence.slice(0, i);
      allPPositions.push({
        id: `pos-P-prefix-${allPPositions.length}`,
        sequence: prefix,
        player: "P",
        isLinear: true,
        isLegal: true,
      });
    }
  }

  const allOPositions = [...oPositions];
  for (const pos of oPositions) {
    for (let i = 1; i < pos.sequence.length; i++) {
      const prefix = pos.sequence.slice(0, i);
      allOPositions.push({
        id: `pos-O-prefix-${allOPositions.length}`,
        sequence: prefix,
        player: "O",
        isLinear: true,
        isLegal: true,
      });
    }
  }

  return { pPositions: allPPositions, oPositions: allOPositions };
}

/**
 * Generate unique key for a view sequence
 */
function viewKey(actions: Action[]): string {
  return JSON.stringify(
    actions.map((a) => ({
      f: a.focus,
      p: a.polarity,
    }))
  );
}
