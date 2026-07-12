/* ts-node scripts/backfill-propositions.ts */
import { prisma } from '@/lib/prisma-cli';
async function main() {
  // Select legacy free-form arguments
  // schemeId IS NULL AND conclusionClaimId IS NULL  → not structured RA (AIF)
  const legacy = await prisma.argument.findMany({
    where: { schemeId: null, conclusionClaimId: null },
    select: {
      id: true, deliberationId: true, authorId: true, text: true,
      mediaType: true, mediaUrl: true, claimId: true, createdAt: true
    }
  });

  console.log(`Found ${legacy.length} legacy free-form arguments to migrate`);

  let created = 0, skipped = 0;
  for (const a of legacy) {
    try {
      await prisma.proposition.create({
        data: {
          deliberationId: a.deliberationId,
          authorId: a.authorId,
          text: a.text,
          mediaType: (a.mediaType as any) ?? 'text',
          mediaUrl: a.mediaUrl ?? null,
          status: a.claimId ? 'CLAIMED' : 'PUBLISHED',
          promotedClaimId: a.claimId ?? null,
          promotedAt: a.claimId ? a.createdAt : null,
          legacyArgumentId: a.id,
          createdAt: a.createdAt,
        }
      });
      created += 1;
    } catch (e: any) {
      // If unique violation on legacyArgumentId, we already migrated it
      const msg = String(e?.message || '');
      if (msg.includes('Unique') || msg.includes('unique')) skipped += 1;
      else throw e;
    }
  }

  console.log(`Done. Created: ${created}, Skipped: ${skipped}`);
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  return prisma.$disconnect().finally(() => process.exit(1));
});
