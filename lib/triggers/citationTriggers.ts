// lib/triggers/citationTriggers.ts
// Phase 3.3: Citation Triggers
// Trigger source usage aggregation when citations change

import { sourceUsageQueue } from "@/lib/queue";

/**
 * Trigger aggregation when a citation is created
 */
export async function onCitationCreated(citation: {
  id: string;
  sourceId: string;
}): Promise<void> {
  try {
    await sourceUsageQueue.add(
      "aggregate-usage",
      {
        sourceId: citation.sourceId,
        triggeredBy: "citation_created" as const,
      },
      {
        delay: 5000, // Debounce rapid citations
        jobId: `usage-${citation.sourceId}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: { count: 3 },
      }
    );
    console.log(`[CitationTrigger] Queued aggregation for source ${citation.sourceId} (created)`);
  } catch (error) {
    console.error(`[CitationTrigger] Error queuing aggregation:`, error);
  }
}

/**
 * Trigger aggregation when a citation is deleted
 */
export async function onCitationDeleted(citation: {
  id: string;
  sourceId: string;
}): Promise<void> {
  try {
    await sourceUsageQueue.add(
      "aggregate-usage",
      {
        sourceId: citation.sourceId,
        triggeredBy: "citation_deleted" as const,
      },
      {
        delay: 5000, // Debounce
        jobId: `usage-${citation.sourceId}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: { count: 3 },
      }
    );
    console.log(`[CitationTrigger] Queued aggregation for source ${citation.sourceId} (deleted)`);
  } catch (error) {
    console.error(`[CitationTrigger] Error queuing aggregation:`, error);
  }
}

/**
 * Trigger aggregation when a citation is updated (e.g., intent changed)
 */
export async function onCitationUpdated(citation: {
  id: string;
  sourceId: string;
}): Promise<void> {
  try {
    await sourceUsageQueue.add(
      "aggregate-usage",
      {
        sourceId: citation.sourceId,
        triggeredBy: "citation_updated" as const,
      },
      {
        delay: 5000, // Debounce
        jobId: `usage-${citation.sourceId}-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: { count: 3 },
      }
    );
    console.log(`[CitationTrigger] Queued aggregation for source ${citation.sourceId} (updated)`);
  } catch (error) {
    console.error(`[CitationTrigger] Error queuing aggregation:`, error);
  }
}

/**
 * Batch trigger aggregation for multiple sources
 * Useful for scheduled re-aggregation or migrations
 */
export async function triggerBulkAggregation(
  sourceIds: string[]
): Promise<{ queued: number; errors: number }> {
  let queued = 0;
  let errors = 0;

  for (const sourceId of sourceIds) {
    try {
      await sourceUsageQueue.add(
        "aggregate-usage",
        {
          sourceId,
          triggeredBy: "scheduled" as const,
        },
        {
          delay: Math.random() * 10000, // Spread load over 10 seconds
          removeOnComplete: true,
          removeOnFail: { count: 3 },
        }
      );
      queued++;
    } catch (error) {
      console.error(`[CitationTrigger] Error queuing source ${sourceId}:`, error);
      errors++;
    }
  }

  console.log(`[CitationTrigger] Bulk aggregation queued: ${queued} success, ${errors} errors`);
  return { queued, errors };
}
