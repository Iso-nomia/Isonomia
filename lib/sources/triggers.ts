// lib/sources/triggers.ts
// Phase 3.1: Source Creation and Update Triggers
// Automatically queue verification and archiving jobs

import { sourceVerificationQueue, sourceArchivingQueue } from "@/lib/queue";

interface SourceTriggerOptions {
  autoVerify?: boolean;
  autoArchive?: boolean;
  archiveDelay?: number; // Delay in ms before archiving (to let verification complete)
}

const DEFAULT_OPTIONS: SourceTriggerOptions = {
  autoVerify: true,
  autoArchive: true,
  archiveDelay: 30000, // 30 seconds
};

/**
 * Called when a new source is created
 * Queues verification and optionally archiving jobs
 */
export async function onSourceCreated(
  sourceId: string,
  options: SourceTriggerOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Queue verification (high priority for new sources)
  if (opts.autoVerify) {
    await sourceVerificationQueue.add(
      "verify-new",
      { sourceId, isRecheck: false, priority: "high" },
      { 
        delay: 1000, // Small delay to let DB transaction settle
        priority: 1, // Highest priority
      }
    );
    console.log(`[source-triggers] Queued verification for new source ${sourceId}`);
  }

  // Queue archiving (with delay to let verification complete first)
  if (opts.autoArchive) {
    await sourceArchivingQueue.add(
      "archive-new",
      { sourceId, strategy: "wayback" },
      { 
        delay: opts.archiveDelay,
        priority: 5, // Normal priority
      }
    );
    console.log(`[source-triggers] Queued archiving for new source ${sourceId}`);
  }
}

/**
 * Called when a source URL is updated
 * Re-queues verification and archiving
 */
export async function onSourceUrlUpdated(
  sourceId: string,
  options: SourceTriggerOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.autoVerify) {
    await sourceVerificationQueue.add(
      "verify-updated",
      { sourceId, isRecheck: false, priority: "high" },
      { priority: 2 }
    );
  }

  if (opts.autoArchive) {
    await sourceArchivingQueue.add(
      "archive-updated",
      { sourceId, strategy: "wayback", forceNew: true },
      { delay: opts.archiveDelay, priority: 5 }
    );
  }
}

/**
 * Request immediate verification of a source
 * Used when user clicks "Verify Now" button
 */
export async function verifySourceNow(sourceId: string): Promise<void> {
  await sourceVerificationQueue.add(
    "verify-now",
    { sourceId, isRecheck: false, priority: "high" },
    { priority: 1 } // Highest priority
  );
}

/**
 * Request immediate archiving of a source
 * Used when user clicks "Archive" button
 */
export async function archiveSourceNow(sourceId: string): Promise<void> {
  await sourceArchivingQueue.add(
    "archive-now",
    { sourceId, strategy: "wayback", forceNew: false },
    { priority: 1 } // Highest priority
  );
}

/**
 * Queue batch reverification of stale sources
 * Called by cron job
 */
export async function queueStaleSourcesForReverification(
  sourceIds: string[]
): Promise<number> {
  let queued = 0;
  
  for (const sourceId of sourceIds) {
    await sourceVerificationQueue.add(
      "recheck",
      { sourceId, isRecheck: true, priority: "low" },
      { priority: 10 } // Lower priority than new sources
    );
    queued++;
  }
  
  console.log(`[source-triggers] Queued ${queued} sources for reverification`);
  return queued;
}
