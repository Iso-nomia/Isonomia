export const dynamic = "force-dynamic";

/**
 * Phase 3.4.1: Knowledge Graph Rebuild Cron
 * 
 * Triggers periodic rebuilds of the knowledge graph.
 * 
 * Schedule:
 * - Weekly full rebuild (Sunday midnight)
 * - Or manual trigger via POST
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerFullGraphRebuild } from "@/lib/triggers/knowledgeGraphTriggers";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await triggerFullGraphRebuild();

  return NextResponse.json({ 
    success: true, 
    message: "Knowledge graph rebuild queued",
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST for manual trigger (requires auth)
 */
export async function POST(req: NextRequest) {
  // Verify cron secret or admin auth
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await triggerFullGraphRebuild();

  return NextResponse.json({ 
    success: true, 
    message: "Knowledge graph rebuild queued (manual)",
    timestamp: new Date().toISOString(),
  });
}
