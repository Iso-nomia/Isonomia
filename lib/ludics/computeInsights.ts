import { prisma } from "@/lib/prismaclient";

/**
 * Ludics Insights - aggregated metrics for a deliberation
 * Phase 1: Task 1.4
 */
export interface LudicsInsights {
  deliberationId: string;
  totalActs: number;
  totalLoci: number;
  maxDepth: number;
  branchFactor: number; // average branches per locus
  daimonCount: number;
  polarityDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  locusRoleDistribution: {
    opener: number;
    responder: number;
    daimon: number;
    neutral: number;
  };
  interactionComplexity: number; // 0-100 score
  hasOrthogonality: boolean;
  topLociByActivity: Array<{
    path: string;
    actCount: number;
    role: string;
  }>;
}

/**
 * Compute Ludics insights for a deliberation.
 * Aggregates metrics from LudicAct/LudicLocus/AifNode tables.
 */
export async function computeInsights(
  deliberationId: string
): Promise<LudicsInsights | null> {
  // 1. Fetch all acts with loci for this deliberation
  const acts = await prisma.ludicAct.findMany({
    where: { design: { deliberationId } },
    include: {
      locus: true,
      design: true,
    },
  });

  if (acts.length === 0) {
    return null;
  }

  // 2. Fetch AifNodes with locus annotations (denormalized for speed)
  const aifNodes = await (prisma as any).aifNode.findMany({
    where: {
      deliberationId,
      ludicActId: { not: null },
    },
    select: {
      locusPath: true,
      locusRole: true,
    },
  });

  // 3. Aggregate locus metrics
  const locusPathSet = new Set<string>();
  const lociActivityMap = new Map<string, { count: number; role: string }>();
  let maxDepth = 0;
  let daimonCount = 0;
  const polarityCount = { P: 0, O: 0, neutral: 0 };
  const roleCount = { opener: 0, responder: 0, daimon: 0, neutral: 0 };

  for (const act of acts) {
    const path = act.locus?.path ?? "0";
    locusPathSet.add(path);

    // Track activity per locus
    const existing = lociActivityMap.get(path) || { count: 0, role: "neutral" };
    lociActivityMap.set(path, {
      count: existing.count + 1,
      role: existing.role, // Will be set by aifNodes
    });

    // Depth = number of dots in path + 1
    const depth = path.split(".").length;
    maxDepth = Math.max(maxDepth, depth);

    // Count daimons
    if (act.kind === "DAIMON") {
      daimonCount++;
    }

    // Polarity distribution
    if (act.polarity === "P") polarityCount.P++;
    else if (act.polarity === "O") polarityCount.O++;
    else polarityCount.neutral++;
  }

  // 4. Enhance locus map with roles from AifNode
  for (const node of aifNodes) {
    if (node.locusPath && node.locusRole) {
      const existing = lociActivityMap.get(node.locusPath);
      if (existing && existing.role === "neutral") {
        existing.role = node.locusRole;
      }

      // Count role distribution
      if (node.locusRole === "opener") roleCount.opener++;
      else if (node.locusRole === "responder") roleCount.responder++;
      else if (node.locusRole === "daimon") roleCount.daimon++;
      else roleCount.neutral++;
    }
  }

  // 5. Compute branch factor (average children per locus)
  const branchCounts = new Map<string, number>();
  for (const path of locusPathSet) {
    const parts = path.split(".");
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join(".");
      branchCounts.set(parentPath, (branchCounts.get(parentPath) || 0) + 1);
    }
  }
  const avgBranches =
    branchCounts.size > 0
      ? Array.from(branchCounts.values()).reduce((a, b) => a + b, 0) /
        branchCounts.size
      : 0;

  // 6. Compute interaction complexity score (0-100)
  // Factors: depth, branches, polarity switches, daimons
  const depthScore = Math.min(maxDepth * 10, 40); // Max 40 points for depth
  const branchScore = Math.min(avgBranches * 15, 30); // Max 30 points for branching
  const daimonScore = Math.min(daimonCount * 5, 20); // Max 20 points for daimons
  const polarityBalance =
    polarityCount.P > 0 && polarityCount.O > 0 ? 10 : 0; // 10 points if both sides present
  const complexityScore = Math.min(
    depthScore + branchScore + daimonScore + polarityBalance,
    100
  );

  // 7. Check for orthogonality (acts with ramification length > 1)
  const hasOrthogonality = acts.some((act) => act.ramification.length > 1);

  // 8. Top loci by activity (most acts)
  const topLoci = Array.from(lociActivityMap.entries())
    .map(([path, { count, role }]) => ({ path, actCount: count, role }))
    .sort((a, b) => b.actCount - a.actCount)
    .slice(0, 5);

  return {
    deliberationId,
    totalActs: acts.length,
    totalLoci: locusPathSet.size,
    maxDepth,
    branchFactor: Math.round(avgBranches * 100) / 100,
    daimonCount,
    polarityDistribution: {
      positive: polarityCount.P,
      negative: polarityCount.O,
      neutral: polarityCount.neutral,
    },
    locusRoleDistribution: {
      opener: roleCount.opener,
      responder: roleCount.responder,
      daimon: roleCount.daimon,
      neutral: roleCount.neutral,
    },
    interactionComplexity: Math.round(complexityScore),
    hasOrthogonality,
    topLociByActivity: topLoci,
  };
}

/**
 * Compute insights for a specific locus path (filtered view)
 */
export async function computeLocusInsights(
  deliberationId: string,
  locusPath: string
): Promise<Partial<LudicsInsights> | null> {
  const acts = await prisma.ludicAct.findMany({
    where: {
      design: { deliberationId },
      locus: { path: { startsWith: locusPath } },
    },
    include: {
      locus: true,
    },
  });

  if (acts.length === 0) {
    return null;
  }

  const polarityCount = { P: 0, O: 0, neutral: 0 };
  let daimonCount = 0;

  for (const act of acts) {
    if (act.kind === "DAIMON") daimonCount++;
    if (act.polarity === "P") polarityCount.P++;
    else if (act.polarity === "O") polarityCount.O++;
    else polarityCount.neutral++;
  }

  return {
    deliberationId,
    totalActs: acts.length,
    daimonCount,
    polarityDistribution: {
      positive: polarityCount.P,
      negative: polarityCount.O,
      neutral: polarityCount.neutral,
    },
  };
}
