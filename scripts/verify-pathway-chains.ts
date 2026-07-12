#!/usr/bin/env tsx
/**
 * Verify the per-pathway hash chain across all PathwayEvent rows.
 *
 * Stage-gate check before Scope C (Facilitation) starts: C1 reuses the
 * same chain primitives over FacilitationEvent, so any latent bug in
 * `lib/pathways/hashChain.ts` would be inherited.
 *
 * Usage:
 *   yarn tsx scripts/verify-pathway-chains.ts
 *   yarn tsx scripts/verify-pathway-chains.ts --pathway <id>
 *   yarn tsx scripts/verify-pathway-chains.ts --json
 *
 * Exit code:
 *   0 — every chain verifies
 *   1 — at least one chain failed
 *   2 — script error (DB unreachable, etc.)
 */

import { PrismaClient } from "@prisma/client";
import { verifyChain } from "../lib/pathways/hashChain";
import { PathwayEventType } from "../lib/pathways/types";

const prisma = new PrismaClient();

interface PerChainResult {
  pathwayId: string;
  eventCount: number;
  valid: boolean;
  failedIndex: number;
  reason?: string;
  failingEventId?: string;
}

function parseArgs(argv: string[]) {
  const args: { pathwayId?: string; json: boolean } = { json: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pathway") {
      args.pathwayId = argv[++i];
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--help" || a === "-h") {
      console.log("Usage: yarn tsx scripts/verify-pathway-chains.ts [--pathway <id>] [--json]");
      process.exit(0);
    }
  }
  return args;
}

async function listPathwayIds(filter?: string): Promise<string[]> {
  if (filter) return [filter];
  const rows = await prisma.pathwayEvent.findMany({
    distinct: ["pathwayId"],
    select: { pathwayId: true },
    orderBy: { pathwayId: "asc" },
  });
  return rows.map((r) => r.pathwayId);
}

async function verifyOne(pathwayId: string): Promise<PerChainResult> {
  const events = await prisma.pathwayEvent.findMany({
    where: { pathwayId },
    orderBy: { createdAt: "asc" },
  });

  const result = verifyChain(
    events.map((e) => ({
      id: e.id,
      pathwayId: e.pathwayId,
      packetId: e.packetId,
      submissionId: e.submissionId,
      responseId: e.responseId,
      eventType: e.eventType as unknown as PathwayEventType,
      actorId: e.actorId,
      actorRole: e.actorRole,
      payloadJson: e.payloadJson as Record<string, unknown>,
      hashChainPrev: e.hashChainPrev,
      hashChainSelf: e.hashChainSelf,
      createdAt: e.createdAt,
    })),
  );

  return {
    pathwayId,
    eventCount: events.length,
    valid: result.valid,
    failedIndex: result.failedIndex,
    reason: result.reason,
    failingEventId:
      result.failedIndex >= 0 && events[result.failedIndex]
        ? events[result.failedIndex].id
        : undefined,
  };
}

async function main() {
  const args = parseArgs(process.argv);

  const pathwayIds = await listPathwayIds(args.pathwayId);
  if (pathwayIds.length === 0) {
    if (args.json) {
      console.log(JSON.stringify({ ok: true, totalChains: 0, results: [] }, null, 2));
    } else {
      console.log("No PathwayEvent rows found. Nothing to verify.");
    }
    return 0;
  }

  const results: PerChainResult[] = [];
  for (const id of pathwayIds) {
    results.push(await verifyOne(id));
  }

  const failures = results.filter((r) => !r.valid);
  const totalEvents = results.reduce((s, r) => s + r.eventCount, 0);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          ok: failures.length === 0,
          totalChains: results.length,
          totalEvents,
          failureCount: failures.length,
          results,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Verified ${results.length} pathway chain(s), ${totalEvents} event(s) total.`);
    if (failures.length === 0) {
      console.log("OK — every chain verifies.");
    } else {
      console.log(`FAIL — ${failures.length} chain(s) failed:`);
      for (const f of failures) {
        console.log(
          `  pathwayId=${f.pathwayId} reason=${f.reason} failedIndex=${f.failedIndex} eventId=${f.failingEventId ?? "<n/a>"} eventCount=${f.eventCount}`,
        );
      }
    }
  }

  return failures.length === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error("verify-pathway-chains: fatal error", err);
    process.exitCode = 2;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
