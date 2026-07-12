// workers/sourceVerification.ts
// Phase 3.1: Source Verification Worker
// Handles background verification of source URLs

import { Worker, Job } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/prismaclient";
import { verifySourceById, getStaleSourcesForReverification } from "@/lib/sources/verification";

interface VerifySourceJob {
  sourceId: string;
  isRecheck?: boolean;
  priority?: "high" | "normal" | "low";
}

/**
 * Source verification worker
 * Processes verification jobs from the queue
 */
new Worker<VerifySourceJob>(
  "source-verification",
  async (job: Job<VerifySourceJob>) => {
    const { sourceId, isRecheck } = job.data;
    
    console.log(`[source-verification] Processing ${isRecheck ? "recheck" : "verification"} for source ${sourceId}`);
    
    try {
      const result = await verifySourceById(sourceId);
      
      if (!result) {
        console.log(`[source-verification] Source ${sourceId} not found`);
        return { success: false, error: "Source not found" };
      }
      
      console.log(`[source-verification] Source ${sourceId} verified with status: ${result.status}`);
      
      // If source is broken, we could emit an event here for notifications
      if (result.status === "broken") {
        console.log(`[source-verification] WARNING: Source ${sourceId} is broken`);
        // Future: emit event for notification system
        // await emitBus("source:broken", { sourceId });
      }
      
      return { 
        success: true, 
        status: result.status,
      };
    } catch (error) {
      console.error(`[source-verification] Error verifying source ${sourceId}:`, error);
      throw error;
    }
  },
  { 
    connection, 
    concurrency: 10,
    // Retry failed jobs
    settings: {
      backoffStrategy: (attemptsMade) => Math.min(1000 * Math.pow(2, attemptsMade), 60000),
    },
  }
);

console.log("[source-verification] Worker started");
