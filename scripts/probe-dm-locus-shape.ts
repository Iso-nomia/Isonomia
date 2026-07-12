/**
 * scripts/probe-dm-locus-shape.ts
 *
 * Diagnostic: for a single deliberation, classify every DialogueMove by
 * which payload field actually carries the locus (if any). Read-only.
 *
 *   npx tsx scripts/probe-dm-locus-shape.ts --deliberation-id <id>
 */
import { prisma } from "@/lib/prismaclient";

const argv = process.argv.slice(2);
const idx = argv.indexOf("--deliberation-id");
const deliberationId = idx >= 0 ? argv[idx + 1] : null;
if (!deliberationId) {
  console.error("Missing --deliberation-id <id>");
  process.exit(1);
}

async function main() {
  const dms = await prisma.dialogueMove.findMany({
    where: { deliberationId },
    select: { id: true, kind: true, locusId: true, payload: true },
  });

  const buckets = {
    payload_locusPath: 0,
    payload_locus: 0,
    payload_locusAddress: 0,
    payload_path: 0,
    payload_acts_locusPath: 0,
    dm_locusId_only: 0,
    no_locus_anywhere: 0,
  };
  const byKindNoLocus = new Map<string, number>();
  const sampleNoLocus: any[] = [];
  const sampleWithActs: any[] = [];
  const distinctPaths = new Set<string>();

  for (const dm of dms) {
    const p = (dm.payload ?? null) as any;
    if (p && typeof p.locusPath === "string") {
      buckets.payload_locusPath++;
      distinctPaths.add(p.locusPath);
      continue;
    }
    if (p && typeof p.locus === "string") {
      buckets.payload_locus++;
      distinctPaths.add(p.locus);
      continue;
    }
    if (p && typeof p.locusAddress === "string") {
      buckets.payload_locusAddress++;
      distinctPaths.add(p.locusAddress);
      continue;
    }
    if (p && typeof p.path === "string") {
      buckets.payload_path++;
      distinctPaths.add(p.path);
      continue;
    }
    if (p && Array.isArray(p.acts)) {
      const inner = p.acts.find(
        (a: any) => a && typeof a.locusPath === "string",
      );
      if (inner) {
        buckets.payload_acts_locusPath++;
        for (const a of p.acts) {
          if (a && typeof a.locusPath === "string") distinctPaths.add(a.locusPath);
        }
        if (sampleWithActs.length < 3) sampleWithActs.push({ id: dm.id, kind: dm.kind, payload: p });
        continue;
      }
    }
    if (dm.locusId) {
      buckets.dm_locusId_only++;
      continue;
    }
    buckets.no_locus_anywhere++;
    byKindNoLocus.set(dm.kind, (byKindNoLocus.get(dm.kind) ?? 0) + 1);
    if (sampleNoLocus.length < 5) sampleNoLocus.push({ id: dm.id, kind: dm.kind, payload: p });
  }

  console.log(`\nTotal DialogueMoves: ${dms.length}\n`);
  console.log("Locus source distribution:");
  for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(28)} ${v}`);

  console.log("\nDistinct locus paths discovered:", distinctPaths.size);

  console.log("\nNo-locus DMs broken down by kind:");
  for (const [k, v] of [...byKindNoLocus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(k).padEnd(18)} ${v}`);
  }

  if (sampleWithActs.length) {
    console.log("\nSample DMs with payload.acts[*].locusPath:");
    console.log(JSON.stringify(sampleWithActs, null, 2));
  }
  if (sampleNoLocus.length) {
    console.log("\nSample no-locus DMs:");
    console.log(JSON.stringify(sampleNoLocus, null, 2));
  }

  // Cross-check: how many of those paths exist as LudicLocus rows?
  if (distinctPaths.size) {
    const existing = await prisma.ludicLocus.findMany({
      where: { dialogueId: deliberationId, path: { in: [...distinctPaths] } },
      select: { path: true },
    });
    const found = new Set(existing.map((r) => r.path));
    const missing = [...distinctPaths].filter((p) => !found.has(p));
    console.log(
      `\nDM paths matched against LudicLocus: ${found.size}/${distinctPaths.size}`,
    );
    if (missing.length) {
      console.log(`Missing paths (first 10):`, missing.slice(0, 10));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
