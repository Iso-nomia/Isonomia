/**
 * Phase 3.4.1: Knowledge Graph Triggers
 * 
 * Triggers to update the knowledge graph when entities change.
 * Queues incremental graph updates for new/updated sources and deliberations.
 */

import { knowledgeGraphQueue } from "@/lib/queue";

/**
 * Trigger graph update when a new source is created or updated
 */
export async function onSourceCreated(sourceId: string) {
  await knowledgeGraphQueue.add(
    "update-source",
    {
      scope: "incremental",
      entityType: "source",
      entityId: sourceId,
    },
    {
      delay: 5000, // Wait 5s for any follow-up updates
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

/**
 * Trigger graph update when a source is updated
 */
export async function onSourceUpdated(sourceId: string) {
  await knowledgeGraphQueue.add(
    "update-source",
    {
      scope: "incremental",
      entityType: "source",
      entityId: sourceId,
    },
    {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: 100,
      jobId: `source-update-${sourceId}`, // Dedupe rapid updates
    }
  );
}

/**
 * Trigger graph update when a deliberation is created or updated
 */
export async function onDeliberationCreated(deliberationId: string) {
  await knowledgeGraphQueue.add(
    "update-deliberation",
    {
      scope: "incremental",
      entityType: "deliberation",
      entityId: deliberationId,
    },
    {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );
}

/**
 * Trigger graph update when a deliberation is updated
 */
export async function onDeliberationUpdated(deliberationId: string) {
  await knowledgeGraphQueue.add(
    "update-deliberation",
    {
      scope: "incremental",
      entityType: "deliberation",
      entityId: deliberationId,
    },
    {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: 100,
      jobId: `deliberation-update-${deliberationId}`,
    }
  );
}

/**
 * Trigger a full graph rebuild
 * Use sparingly - expensive operation
 */
export async function triggerFullGraphRebuild() {
  await knowledgeGraphQueue.add(
    "full-rebuild",
    { scope: "full" },
    {
      removeOnComplete: true,
      removeOnFail: 10,
    }
  );
}

/**
 * Batch trigger for multiple sources
 */
export async function triggerBulkSourceUpdate(sourceIds: string[]) {
  const jobs = sourceIds.map((sourceId) => ({
    name: "update-source",
    data: {
      scope: "incremental" as const,
      entityType: "source" as const,
      entityId: sourceId,
    },
    opts: {
      delay: 5000,
      removeOnComplete: true,
      removeOnFail: 100,
    },
  }));

  await knowledgeGraphQueue.addBulk(jobs);
}
