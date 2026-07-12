// app/(editor)/about/onboarding/demos/ceg-explorer/ceg-explorer-real/page.tsx
/**
 * CEG Explorer with Real Data Integration
 * 
 * This page connects to the live CEG API endpoint and displays real deliberation data.
 * It uses the actual CegMiniMap component with live data from the database.
 */
import { Metadata } from "next";
import type { CegNode, CegEdge } from "@/components/graph/useCegData";
import { prisma } from "@/lib/prismaclient";
import CegExplorerRealClient from "./client";

export const metadata: Metadata = {
  title: "CEG Explorer - Real Data | Mesh",
  description: "Claim Evaluation Graph with live deliberation data",
};

/**
 * Fetch CEG data directly from the database
 * This replicates the logic from /api/deliberations/[id]/ceg/mini
 * but runs directly in the server component for better performance
 */
async function fetchCegData(deliberationId: string): Promise<{
  nodes: CegNode[];
  edges: CegEdge[];
  metadata: {
    title: string;
    description: string | null;
    claimCount: number;
    edgeCount: number;
  };
}> {
  // 1. Get all claims
  const claims = await prisma.claim.findMany({
    where: { deliberationId },
    select: {
      id: true,
      text: true,
    },
  });

  const claimIds = claims.map((c) => c.id);

  if (claimIds.length === 0) {
    return {
      nodes: [],
      edges: [],
      metadata: {
        title: "Deliberation CEG",
        description: null,
        claimCount: 0,
        edgeCount: 0,
      },
    };
  }

  // 2. Get grounded semantics labels
  const claimLabels = await prisma.claimLabel.findMany({
    where: {
      deliberationId,
      claimId: { in: claimIds },
    },
    select: {
      claimId: true,
      label: true,
    },
  });

  const labelMap = new Map<string, "IN" | "OUT" | "UNDEC">(
    claimLabels.map((cl) => [cl.claimId, cl.label as "IN" | "OUT" | "UNDEC"])
  );

  // 3. Get all ClaimEdges
  const claimEdges = await prisma.claimEdge.findMany({
    where: { deliberationId },
    select: {
      id: true,
      fromClaimId: true,
      toClaimId: true,
      type: true,
      attackType: true,
      targetScope: true,
    },
  });

  // 4. Build graph structure
  const edges: CegEdge[] = [];
  const claimInDegree = new Map<string, number>();
  const claimOutDegree = new Map<string, number>();
  const claimSupportStrength = new Map<string, number>();
  const claimAttackStrength = new Map<string, number>();

  claims.forEach((c) => {
    claimInDegree.set(c.id, 0);
    claimOutDegree.set(c.id, 0);
    claimSupportStrength.set(c.id, 0);
    claimAttackStrength.set(c.id, 0);
  });

  // Process edges
  for (const edge of claimEdges) {
    // Filter out self-loops
    if (edge.fromClaimId === edge.toClaimId) continue;

    const conf = 0.7; // Default confidence

    // Determine edge type
    let edgeType: "supports" | "rebuts" | "undercuts";
    if (edge.type === "supports") {
      edgeType = "supports";
    } else if (edge.attackType === "UNDERCUTS") {
      edgeType = "undercuts";
    } else {
      edgeType = "rebuts";
    }

    edges.push({
      id: edge.id,
      source: edge.fromClaimId,
      target: edge.toClaimId,
      type: edgeType,
      attackType: edge.attackType ?? undefined,
      confidence: conf,
      targetScope: edge.targetScope as "premise" | "inference" | "conclusion" | null | undefined,
    });

    // Update degrees
    claimOutDegree.set(edge.fromClaimId, (claimOutDegree.get(edge.fromClaimId) ?? 0) + 1);
    claimInDegree.set(edge.toClaimId, (claimInDegree.get(edge.toClaimId) ?? 0) + 1);

    // Update strengths
    if (edgeType === "supports") {
      claimSupportStrength.set(
        edge.toClaimId,
        (claimSupportStrength.get(edge.toClaimId) ?? 0) + conf
      );
    } else {
      claimAttackStrength.set(
        edge.toClaimId,
        (claimAttackStrength.get(edge.toClaimId) ?? 0) + conf
      );
    }
  }

  // 5. Detect controversial claims
  const detectControversial = (
    supportStr: number,
    attackStr: number
  ): boolean => {
    const total = supportStr + attackStr;
    if (total < 1.5) return false;

    const balance = Math.abs(supportStr - attackStr) / total;
    return balance < 0.4;
  };

  // 6. Simple clustering (connected components)
  const computeClusters = (
    claimIds: string[],
    edges: CegEdge[]
  ): Map<string, number> => {
    const clusters = new Map<string, number>();
    const visited = new Set<string>();
    let clusterId = 0;

    const adjacency = new Map<string, Set<string>>();
    claimIds.forEach((id) => adjacency.set(id, new Set()));

    edges.forEach((e) => {
      adjacency.get(e.source)?.add(e.target);
      adjacency.get(e.target)?.add(e.source);
    });

    const dfs = (nodeId: string, cid: number) => {
      visited.add(nodeId);
      clusters.set(nodeId, cid);
      adjacency.get(nodeId)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          dfs(neighbor, cid);
        }
      });
    };

    claimIds.forEach((id) => {
      if (!visited.has(id)) {
        dfs(id, clusterId++);
      }
    });

    return clusters;
  };

  const clusterMap = computeClusters(claimIds, edges);

  // 7. Compute centrality
  const maxDegree = Math.max(
    ...claimIds.map(
      (id) => (claimInDegree.get(id) ?? 0) + (claimOutDegree.get(id) ?? 0)
    ),
    1
  );

  // 8. Build enriched node data
  const nodes: CegNode[] = claims.map((c) => {
    const supportStr = claimSupportStrength.get(c.id) ?? 0;
    const attackStr = claimAttackStrength.get(c.id) ?? 0;
    const netStr = supportStr - attackStr;
    const inDeg = claimInDegree.get(c.id) ?? 0;
    const outDeg = claimOutDegree.get(c.id) ?? 0;
    const centrality = (inDeg + outDeg) / maxDegree;

    return {
      id: c.id,
      type: "claim" as const,
      text: c.text,
      label: labelMap.get(c.id) ?? "UNDEC",
      confidence: 0.7,
      approvals: 0, // Not fetched in this query
      supportStrength: +supportStr.toFixed(2),
      attackStrength: +attackStr.toFixed(2),
      netStrength: +netStr.toFixed(2),
      inDegree: inDeg,
      outDegree: outDeg,
      centrality: +centrality.toFixed(2),
      isControversial: detectControversial(supportStr, attackStr),
      clusterId: clusterMap.get(c.id),
    };
  });

  return {
    nodes,
    edges,
    metadata: {
      title: "Deliberation CEG",
      description: null,
      claimCount: nodes.length,
      edgeCount: edges.length,
    },
  };
}

interface PageProps {
  searchParams: {
    id?: string;
  };
}

export default async function CegExplorerRealDataPage({ searchParams }: PageProps) {
  // Get deliberation ID from search params
  const deliberationId = searchParams.id;

  if (!deliberationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Deliberation ID Required
          </h1>
          <p className="text-slate-600 mb-4">
            Please provide a deliberation ID to view its CEG
          </p>
          <code className="text-sm bg-slate-100 px-3 py-1 rounded">
            ?id=YOUR_DELIBERATION_ID
          </code>
        </div>
      </div>
    );
  }

  // Fetch real data
  let data;
  try {
    data = await fetchCegData(deliberationId);
  } catch (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-900 mb-2">
            Failed to Load Data
          </h1>
          <p className="text-red-600 mb-4">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <p className="text-sm text-slate-600">
            Check that the deliberation ID is valid and the API is accessible.
          </p>
        </div>
      </div>
    );
  }

  // Pass data to client component for interactive display
  return <CegExplorerRealClient deliberationId={deliberationId} initialData={data} />;
}

/**
 * USAGE EXAMPLES:
 * 
 * 1. Direct URL:
 *    /about/onboarding/demos/ceg-explorer/ceg-explorer-real?id=clxxx123
 * 
 * 2. From another component:
 *    <Link href={`/about/onboarding/demos/ceg-explorer/ceg-explorer-real?id=${deliberationId}`}>
 *      View CEG
 *    </Link>
 */