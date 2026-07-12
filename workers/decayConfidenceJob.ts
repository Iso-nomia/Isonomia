// workers/decayConfidenceJob.ts
import { prisma } from "@/lib/prismaclient";
import { decayConfidence } from "@/lib/confidence/decayConfidence";

/**
 * Daily worker job to apply temporal confidence decay to arguments.
 * 
 * Finds arguments with lastUpdatedAt > 1 day ago and applies exponential decay
 * to their confidence values based on time elapsed.
 */

async function applyConfidenceDecay() {
  const startTime = Date.now();
  console.log("[decayConfidenceJob] Starting daily confidence decay...");

  try {
    // Find all arguments with confidence that haven't been updated today
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const args = await prisma.argument.findMany({
      where: {
        confidence: { not: null },
        lastUpdatedAt: { lt: oneDayAgo },
      },
      select: {
        id: true,
        confidence: true,
        lastUpdatedAt: true,
      },
    });

    console.log(`[decayConfidenceJob] Found ${args.length} arguments to decay`);

    let updated = 0;
    let skipped = 0;

    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < args.length; i += batchSize) {
      const batch = args.slice(i, i + batchSize);

      // Apply decay to each argument in the batch
      const updates = await Promise.all(
        batch.map(async (arg) => {
          if (arg.confidence === null) {
            skipped++;
            return null;
          }

          // Calculate decayed confidence
          const decayed = decayConfidence(arg.confidence, arg.lastUpdatedAt);

          // Only update if decay is significant (> 1% change)
          const changePercent = Math.abs(arg.confidence - decayed) / arg.confidence;
          if (changePercent < 0.01) {
            skipped++;
            return null;
          }

          // Update confidence with decayed value
          return prisma.argument.update({
            where: { id: arg.id },
            data: { confidence: decayed },
          });
        })
      );

      // Count successful updates
      updated += updates.filter((u) => u !== null).length;

      console.log(
        `[decayConfidenceJob] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(args.length / batchSize)}`
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[decayConfidenceJob] Complete! Updated ${updated} arguments, skipped ${skipped}. Duration: ${duration}ms`
    );
  } catch (error) {
    console.error("[decayConfidenceJob] Error applying confidence decay:", error);
  }
}

// Run daily at 2 AM (adjust as needed)
const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Run immediately on startup
applyConfidenceDecay().catch((e) =>
  console.error("[decayConfidenceJob] Initial run failed:", e)
);

// Then run every 24 hours
setInterval(() => {
  applyConfidenceDecay().catch((e) =>
    console.error("[decayConfidenceJob] Scheduled run failed:", e)
  );
}, DAILY_INTERVAL);

console.log("[decayConfidenceJob] Worker initialized - running daily");
