// workers/sourceUsageAggregator.ts
// Phase 3.3: Source Usage Aggregation Worker
// Aggregates citation usage stats and updates SourceUsage & SourceCitationContext tables

import { Worker, Job } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/prismaclient";
import { CitationIntent } from "@prisma/client";

interface AggregationJob {
  sourceId: string;
  triggeredBy: "citation_created" | "citation_deleted" | "citation_updated" | "scheduled";
}

/**
 * Calculate trend score based on recent activity
 * Score range: 0-100
 */
function calculateTrendScore(
  last7Days: number,
  last30Days: number,
  total: number
): number {
  // Heavily weight recent activity
  const recentWeight = 0.6;
  const monthWeight = 0.3;
  const totalWeight = 0.1;

  const recentScore = Math.min(100, last7Days * 10);
  const monthScore = Math.min(100, last30Days * 3);
  const totalScore = Math.min(100, Math.log10(total + 1) * 30);

  return (
    recentScore * recentWeight +
    monthScore * monthWeight +
    totalScore * totalWeight
  );
}

/**
 * Check if a citation's context is publicly visible
 */
async function checkContextVisibility(citation: {
  targetType: string;
  targetId: string;
}): Promise<boolean> {
  // For deliberation-based citations, check if the deliberation is public
  if (citation.targetType === "argument" || citation.targetType === "claim") {
    // Get the argument/claim to find its deliberation
    if (citation.targetType === "argument") {
      const argument = await prisma.argument.findUnique({
        where: { id: citation.targetId },
        select: { 
          deliberationId: true,
        },
      });
      if (argument?.deliberationId) {
        // Check deliberation visibility - assume public for now
        // In reality you'd check isPublic or similar field
        return true;
      }
    }
    if (citation.targetType === "claim") {
      const claim = await prisma.claim.findUnique({
        where: { id: citation.targetId },
        select: { 
          deliberationId: true,
        },
      });
      if (claim?.deliberationId) {
        return true;
      }
    }
  }
  
  // For stack-based citations, check stack visibility
  if (citation.targetType === "block" || citation.targetType === "stack") {
    const block = await prisma.libraryPost.findUnique({
      where: { id: citation.targetId },
      include: {
        stacks: {
          include: {
            stack: {
              select: { visibility: true },
            },
          },
          take: 1,
        },
      },
    });
    if (block?.stacks[0]?.stack.visibility === "public_open" || 
        block?.stacks[0]?.stack.visibility === "public_closed") {
      return true;
    }
  }
  
  return false;
}

/**
 * Update citation contexts for discovery
 */
async function updateCitationContexts(
  sourceId: string,
  citations: Array<{
    id: string;
    targetType: string;
    targetId: string;
    intent: CitationIntent | null;
    quote: string | null;
    createdById: string;
  }>
): Promise<void> {
  for (const citation of citations) {
    try {
      const isPublic = await checkContextVisibility(citation);
      
      // Determine deliberationId, argumentId, stackId based on targetType
      let deliberationId: string | null = null;
      let argumentId: string | null = null;
      let stackId: string | null = null;
      
      if (citation.targetType === "argument") {
        argumentId = citation.targetId;
        const arg = await prisma.argument.findUnique({
          where: { id: citation.targetId },
          select: { deliberationId: true },
        });
        deliberationId = arg?.deliberationId || null;
      } else if (citation.targetType === "claim") {
        const claim = await prisma.claim.findUnique({
          where: { id: citation.targetId },
          select: { deliberationId: true },
        });
        deliberationId = claim?.deliberationId || null;
      } else if (citation.targetType === "block") {
        // Find the stack this block belongs to
        const stackItem = await prisma.stackItem.findFirst({
          where: { blockId: citation.targetId },
          select: { stackId: true },
        });
        stackId = stackItem?.stackId || null;
      }

      await prisma.sourceCitationContext.upsert({
        where: { citationId: citation.id },
        create: {
          sourceId,
          citationId: citation.id,
          deliberationId,
          argumentId,
          stackId,
          intent: citation.intent,
          quote: citation.quote,
          isPublic,
        },
        update: {
          deliberationId,
          argumentId,
          stackId,
          intent: citation.intent,
          quote: citation.quote,
          isPublic,
        },
      });
    } catch (error) {
      console.error(`[SourceUsage] Error updating citation context ${citation.id}:`, error);
    }
  }
}

/**
 * Main aggregation processor
 */
async function processSourceUsageAggregation(job: Job<AggregationJob>): Promise<{
  success: boolean;
  totalCitations?: number;
  deliberationCount?: number;
  error?: string;
}> {
  const { sourceId, triggeredBy } = job.data;

  console.log(`[SourceUsage] Aggregating usage for source ${sourceId} (${triggeredBy})`);

  try {
    // Get all citations for this source
    const citations = await prisma.citation.findMany({
      where: { sourceId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        intent: true,
        quote: true,
        createdById: true,
        createdAt: true,
      },
    });

    // Calculate aggregates
    const deliberationIds = new Set<string>();
    const argumentIds = new Set<string>();
    const stackIds = new Set<string>();
    const userIds = new Set<string>();

    let supportCount = 0;
    let refuteCount = 0;
    let contextCount = 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let citationsLast7Days = 0;
    let citationsLast30Days = 0;
    let firstCitedAt: Date | null = null;
    let lastCitedAt: Date | null = null;

    // Process each citation
    for (const citation of citations) {
      // Track unique users
      if (citation.createdById) {
        userIds.add(citation.createdById);
      }

      // Count by intent
      switch (citation.intent) {
        case "supports":
          supportCount++;
          break;
        case "refutes":
          refuteCount++;
          break;
        case "context":
        case "questions":
          contextCount++;
          break;
        default:
          contextCount++;
      }

      // Time-based counts
      if (citation.createdAt >= sevenDaysAgo) citationsLast7Days++;
      if (citation.createdAt >= thirtyDaysAgo) citationsLast30Days++;

      // First/last tracking
      if (!firstCitedAt || citation.createdAt < firstCitedAt) {
        firstCitedAt = citation.createdAt;
      }
      if (!lastCitedAt || citation.createdAt > lastCitedAt) {
        lastCitedAt = citation.createdAt;
      }

      // Resolve deliberation/argument/stack IDs
      if (citation.targetType === "argument") {
        argumentIds.add(citation.targetId);
        const arg = await prisma.argument.findUnique({
          where: { id: citation.targetId },
          select: { deliberationId: true },
        });
        if (arg?.deliberationId) {
          deliberationIds.add(arg.deliberationId);
        }
      } else if (citation.targetType === "claim") {
        const claim = await prisma.claim.findUnique({
          where: { id: citation.targetId },
          select: { deliberationId: true },
        });
        if (claim?.deliberationId) {
          deliberationIds.add(claim.deliberationId);
        }
      } else if (citation.targetType === "block") {
        const stackItem = await prisma.stackItem.findFirst({
          where: { blockId: citation.targetId },
          select: { stackId: true },
        });
        if (stackItem?.stackId) {
          stackIds.add(stackItem.stackId);
        }
      }
    }

    // Calculate trend score (weighted recent activity)
    const trendScore = calculateTrendScore(
      citationsLast7Days,
      citationsLast30Days,
      citations.length
    );

    // Upsert usage record
    await prisma.sourceUsage.upsert({
      where: { sourceId },
      create: {
        sourceId,
        totalCitations: citations.length,
        deliberationCount: deliberationIds.size,
        argumentCount: argumentIds.size,
        stackCount: stackIds.size,
        uniqueCiters: userIds.size,
        supportCount,
        refuteCount,
        contextCount,
        citationsLast7Days,
        citationsLast30Days,
        trendScore,
        firstCitedAt,
        lastCitedAt,
      },
      update: {
        totalCitations: citations.length,
        deliberationCount: deliberationIds.size,
        argumentCount: argumentIds.size,
        stackCount: stackIds.size,
        uniqueCiters: userIds.size,
        supportCount,
        refuteCount,
        contextCount,
        citationsLast7Days,
        citationsLast30Days,
        trendScore,
        firstCitedAt,
        lastCitedAt,
      },
    });

    // Update citation contexts for discovery
    await updateCitationContexts(sourceId, citations);

    console.log(
      `[SourceUsage] Aggregated: ${citations.length} citations across ${deliberationIds.size} deliberations for source ${sourceId}`
    );

    return {
      success: true,
      totalCitations: citations.length,
      deliberationCount: deliberationIds.size,
    };
  } catch (error) {
    console.error(`[SourceUsage] Error aggregating usage for source ${sourceId}:`, error);
    throw error;
  }
}

// Create and start the worker
new Worker<AggregationJob>(
  "source-usage",
  processSourceUsageAggregation,
  {
    connection,
    concurrency: 5,
    settings: {
      backoffStrategy: (attemptsMade) => Math.min(1000 * Math.pow(2, attemptsMade), 60000),
    },
  }
);

console.log("[source-usage] Worker started");

export { processSourceUsageAggregation };
