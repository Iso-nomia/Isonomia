/**
 * scripts/experiments/delete-claims.ts
 *
 * Hard-deletes Claims by deliberationId. ClaimEdges, ClaimLabel, and a
 * few others cascade automatically via Prisma onDelete rules. Urn rows
 * that reference Claim by entityId have no FK cascade, so we prune
 * them first.
 *
 * Used to clear orphaned topology between dev/prod runs of the
 * polarization-1 experiment when the global moid-dedup on Claim makes
 * re-minting the same root impossible.
 *
 * Usage:
 *   tsx --env-file=.env scripts/experiments/delete-claims.ts <deliberationId> [<deliberationId> ...]
 */

import { prisma } from "@/lib/prismaclient";

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error("Usage: tsx scripts/experiments/delete-claims.ts <deliberationId> [<deliberationId> ...]");
    process.exit(1);
  }

  for (const delibId of ids) {
    const claims = await prisma.claim.findMany({ where: { deliberationId: delibId }, select: { id: true } });
    const claimIds = claims.map((c) => c.id);

    if (claimIds.length === 0) {
      console.log(`  [skip] no claims under deliberation ${delibId}`);
      continue;
    }

    const urnDel = await prisma.urn.deleteMany({ where: { entityId: { in: claimIds } } });
    if (urnDel.count > 0) console.log(`  [ok] deleted ${urnDel.count} Urn rows`);

    const claimDel = await prisma.claim.deleteMany({ where: { id: { in: claimIds } } });
    console.log(`  [ok] deleted ${claimDel.count} claims under deliberation ${delibId}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
