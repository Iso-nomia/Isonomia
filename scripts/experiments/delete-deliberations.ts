/**
 * scripts/experiments/delete-deliberations.ts
 *
 * Hard-deletes one or more Deliberations by id, cascading to all
 * Claims/ClaimEdges/etc. via Prisma's onDelete rules.
 *
 * Usage:
 *   tsx --env-file=.env scripts/experiments/delete-deliberations.ts <id1> [<id2> ...]
 *
 * Used to clear orphaned topology between dev/prod runs of the
 * polarization-1 experiment when the global moid-dedup on Claim makes
 * re-minting the same root impossible.
 */

import { prisma } from "@/lib/prismaclient";

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error("Usage: tsx scripts/experiments/delete-deliberations.ts <id1> [<id2> ...]");
    process.exit(1);
  }

  for (const id of ids) {
    const claims = await prisma.claim.findMany({ where: { deliberationId: id }, select: { id: true } });
    const claimIds = claims.map((c) => c.id);

    if (claimIds.length > 0) {
      // Urn.entityId references Claim without onDelete cascade — clean up first.
      const urnDel = await prisma.urn.deleteMany({ where: { entityId: { in: claimIds } } });
      if (urnDel.count > 0) console.log(`  [ok] deleted ${urnDel.count} Urn rows for ${id}`);
    }

    const exists = await prisma.deliberation.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      console.log(`  [skip] deliberation ${id} does not exist`);
      continue;
    }
    await prisma.deliberation.delete({ where: { id } }).catch((err) => {
      console.error(`  [error] failed to delete ${id}: ${err.message}`);
      throw err;
    });
    console.log(`  [ok] deleted deliberation ${id} (was carrying ${claimIds.length} claims)`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
