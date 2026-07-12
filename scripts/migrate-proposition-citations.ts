#!/usr/bin/env tsx
/**
 * Migrate citations from promoted propositions to their claims
 * Run this once to fix citations for claims that were promoted before the citation migration was added
 */

import { prisma } from '@/lib/prismaclient';

async function migrateCitations() {
  console.log('🔄 Starting citation migration from propositions to promoted claims...\n');

  // Find all propositions that have been promoted to claims
  const promotedPropositions = await prisma.proposition.findMany({
    where: {
      status: 'CLAIMED',
      promotedClaimId: { not: null }
    },
    select: {
      id: true,
      promotedClaimId: true,
      text: true
    }
  });

  console.log(`📊 Found ${promotedPropositions.length} promoted propositions\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const prop of promotedPropositions) {
    if (!prop.promotedClaimId) continue;

    // Find citations for this proposition
    const propCitations = await prisma.citation.findMany({
      where: {
        targetType: 'proposition',
        targetId: prop.id
      }
    });

    if (propCitations.length === 0) {
      skippedCount++;
      continue;
    }

    // Check if claim already has these citations
    const existingClaimCitations = await prisma.citation.findMany({
      where: {
        targetType: 'claim',
        targetId: prop.promotedClaimId
      }
    });

    const existingSourceIds = new Set(existingClaimCitations.map(c => c.sourceId));
    
    // Only copy citations that don't already exist on the claim
    const citationsToMigrate = propCitations.filter(c => !existingSourceIds.has(c.sourceId));

    if (citationsToMigrate.length === 0) {
      console.log(`⏭️  Skipping proposition ${prop.id.slice(0, 8)} - citations already exist on claim`);
      skippedCount++;
      continue;
    }

    // Create duplicate citations for the claim
    await prisma.citation.createMany({
      data: citationsToMigrate.map(c => ({
        targetType: 'claim',
        targetId: prop.promotedClaimId!,
        sourceId: c.sourceId,
        locator: c.locator,
        quote: c.quote,
        note: c.note,
        relevance: c.relevance,
        createdById: c.createdById
      }))
    });

    console.log(`✅ Migrated ${citationsToMigrate.length} citation(s) from proposition ${prop.id.slice(0, 8)} to claim ${prop.promotedClaimId.slice(0, 8)}`);
    console.log(`   Text: "${prop.text.slice(0, 60)}${prop.text.length > 60 ? '...' : ''}"`);
    migratedCount++;
  }

  console.log('\n📈 Migration Summary:');
  console.log(`   ✅ Migrated: ${migratedCount} proposition(s)`);
  console.log(`   ⏭️  Skipped: ${skippedCount} proposition(s) (no citations or already migrated)`);
  console.log(`   📊 Total processed: ${promotedPropositions.length}`);
  console.log('\n✨ Citation migration complete!');
}

migrateCitations()
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
