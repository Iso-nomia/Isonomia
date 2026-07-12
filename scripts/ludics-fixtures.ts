// scripts/ludics.fixtures.ts
import { prisma } from '@/lib/prisma-cli';

async function seedAdditives(deliberationId: string) { /* build two designs at same base with additive openers (& = ∩) */ }
async function seedMultiplicatives(deliberationId: string) { /* two independent sub-bases; factorized tests */ }
async function seedExponentials(deliberationId: string) { /* base σ; call /api/loci/copy; spawn σ.1 σ.2; attach saturation testers */ }
async function seedQuantifiers(deliberationId: string) { /* call /api/loci/instantiate for σ.a and σ.b; add maskNamesAt in runs; push uniformity check */ }
async function seedConsensus(deliberationId: string) { /* attach timeout-draw tester; herd-to-σ·i tester via virtualNegPaths */ }

(async () => {
  const deliberationId = process.argv[2];
  if (!deliberationId) throw new Error('usage: ts-node scripts/ludics.fixtures.ts <deliberationId>');
  await seedAdditives(deliberationId);
  await seedMultiplicatives(deliberationId);
  await seedExponentials(deliberationId);
  await seedQuantifiers(deliberationId);
  await seedConsensus(deliberationId);
  console.log('Ludics fixtures seeded.');
})();
