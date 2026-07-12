// app/api/_cron/source_health/route.ts
// Phase 3.1: Source Health Cron Job
// Runs periodically to reverify stale sources and check for retractions

import { NextResponse } from "next/server";
import { getStaleSourcesForReverification } from "@/lib/sources/verification";
import { getSourcesForRetractionCheck, checkSourceRetraction } from "@/lib/sources/retractionCheck";
import { queueStaleSourcesForReverification } from "@/lib/sources/triggers";

export const runtime = "nodejs"; // Need Node.js for BullMQ

/**
 * GET /api/_cron/source_health
 * 
 * Scheduled cron job that:
 * 1. Queues stale sources for reverification
 * 2. Checks sources with DOIs for retractions
 * 
 * Recommended: Run nightly via Vercel Cron or external scheduler
 */
export async function GET() {
  const startTime = Date.now();
  const results = {
    reverification: { queued: 0, errors: 0 },
    retractionCheck: { checked: 0, retracted: 0, errors: 0 },
  };

  try {
    // 1. Queue stale sources for reverification
    const staleSources = await getStaleSourcesForReverification(500);
    if (staleSources.length > 0) {
      const sourceIds = staleSources.map((s: { id: string }) => s.id);
      results.reverification.queued = await queueStaleSourcesForReverification(sourceIds);
    }

    // 2. Check sources for retractions (do a smaller batch directly)
    const sourcesToCheck = await getSourcesForRetractionCheck(50);
    for (const sourceId of sourcesToCheck) {
      try {
        const result = await checkSourceRetraction(sourceId);
        results.retractionCheck.checked++;
        if (result?.retraction.isRetracted) {
          results.retractionCheck.retracted++;
        }
      } catch (error) {
        console.error(`[source_health] Retraction check failed for ${sourceId}:`, error);
        results.retractionCheck.errors++;
      }
    }

    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      ...results,
    });
  } catch (error) {
    console.error("[source_health] Cron job failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: String(error),
        ...results,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/_cron/source_health
 * 
 * Manual trigger with options
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      reverificationLimit = 500,
      retractionLimit = 50,
      skipReverification = false,
      skipRetractionCheck = false,
    } = body;

    const results = {
      reverification: { queued: 0, errors: 0 },
      retractionCheck: { checked: 0, retracted: 0, errors: 0 },
    };

    if (!skipReverification) {
      const staleSources = await getStaleSourcesForReverification(reverificationLimit);
      if (staleSources.length > 0) {
        const sourceIds = staleSources.map((s: { id: string }) => s.id);
        results.reverification.queued = await queueStaleSourcesForReverification(sourceIds);
      }
    }

    if (!skipRetractionCheck) {
      const sourcesToCheck = await getSourcesForRetractionCheck(retractionLimit);
      for (const sourceId of sourcesToCheck) {
        try {
          const result = await checkSourceRetraction(sourceId);
          results.retractionCheck.checked++;
          if (result?.retraction.isRetracted) {
            results.retractionCheck.retracted++;
          }
        } catch (error) {
          results.retractionCheck.errors++;
        }
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
