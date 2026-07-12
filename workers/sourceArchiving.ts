// workers/sourceArchiving.ts
// Phase 3.1: Source Archiving Worker
// Handles background archiving of sources to Wayback Machine

import { Worker, Job } from "bullmq";
import { connection } from "@/lib/queue";
import { archiveSourceById } from "@/lib/sources/archiving";

interface ArchiveSourceJob {
  sourceId: string;
  strategy?: "wayback" | "local" | "both";
  forceNew?: boolean; // Force new archive even if recent one exists
}

/**
 * Source archiving worker
 * Processes archiving jobs from the queue
 */
new Worker<ArchiveSourceJob>(
  "source-archiving",
  async (job: Job<ArchiveSourceJob>) => {
    const { sourceId, strategy = "wayback", forceNew = false } = job.data;
    
    console.log(`[source-archiving] Processing archive request for source ${sourceId} (strategy: ${strategy})`);
    
    try {
      const result = await archiveSourceById(sourceId);
      
      if (!result) {
        console.log(`[source-archiving] Source ${sourceId} not found or no URL`);
        return { success: false, error: "Source not found or no URL" };
      }
      
      console.log(`[source-archiving] Source ${sourceId} archived with status: ${result.status}`);
      
      if (result.status === "failed") {
        console.log(`[source-archiving] WARNING: Archiving failed for source ${sourceId}: ${result.error}`);
      }
      
      return { 
        success: result.status === "archived" || result.status === "exists",
        status: result.status,
        archiveUrl: result.archiveUrl,
      };
    } catch (error) {
      console.error(`[source-archiving] Error archiving source ${sourceId}:`, error);
      throw error;
    }
  },
  { 
    connection, 
    concurrency: 5, // Lower concurrency to be nice to archive.org
    // Retry failed jobs with backoff
    settings: {
      backoffStrategy: (attemptsMade) => Math.min(5000 * Math.pow(2, attemptsMade), 300000),
    },
  }
);

console.log("[source-archiving] Worker started");
