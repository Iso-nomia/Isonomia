#!/usr/bin/env tsx
/**
 * Backfill ArgumentEdges from AIF ConflictApplications
 * 
 * Problem: ArgumentEdge table is empty, but ConflictApplication (CA-nodes) contains
 * all the attack relationships between arguments.
 * 
 * Solution: Derive ArgumentEdge records from CA-nodes based on AIF semantics:
 * - CA → RA (conflictedArgumentId): UNDERCUT (attack on inference)
 * - CA → I (conflictedClaimId = conclusion): REBUT (attack on conclusion)
 * - CA → I (conflictedClaimId = premise): UNDERMINE (attack on premise)
 * 
 * Usage:
 *   npx tsx scripts/backfill-argument-edges-from-aif.ts [deliberationId]
 *   npx tsx scripts/backfill-argument-edges-from-aif.ts --all
 *   npx tsx scripts/backfill-argument-edges-from-aif.ts --dry-run [deliberationId]
 */

import { prisma } from '../lib/prismaclient';
import { EdgeType, ArgumentAttackSubtype, TargetScope } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const PROCESS_ALL = process.argv.includes('--all');
const deliberationId = process.argv.find(arg => !arg.startsWith('--') && arg !== 'scripts/backfill-argument-edges-from-aif.ts');

interface Stats {
  deliberationsProcessed: number;
  caNodesProcessed: number;
  edgesCreated: number;
  edgesSkipped: number;
  errors: string[];
}

/**
 * Determine edge type from CA-node targeting
 */
async function determineEdgeType(
  ca: {
    conflictedArgumentId: string | null;
    conflictedClaimId: string | null;
    conflictingArgumentId: string | null;
    legacyAttackType: string | null;
  },
  deliberationId: string
): Promise<{
  type: EdgeType;
  attackSubtype: ArgumentAttackSubtype;
  targetScope: TargetScope;
  toArgumentId: string | null;
} | null> {
  // Skip if no conflicting argument (can't create arg-to-arg edge)
  if (!ca.conflictingArgumentId) {
    return null;
  }

  // Case 1: CA → RA (attack on argument directly)
  if (ca.conflictedArgumentId) {
    return {
      type: 'undercut' as EdgeType,
      attackSubtype: 'UNDERCUT' as ArgumentAttackSubtype,
      targetScope: 'inference' as TargetScope,
      toArgumentId: ca.conflictedArgumentId,
    };
  }

  // Case 2: CA → I (attack on claim)
  if (ca.conflictedClaimId) {
    // Find which argument this claim belongs to
    const argWithClaimAsConclusion = await prisma.argument.findFirst({
      where: {
        deliberationId,
        conclusionClaimId: ca.conflictedClaimId,
      },
      select: { id: true },
    });

    if (argWithClaimAsConclusion) {
      // Attack on conclusion = REBUT
      return {
        type: 'rebut' as EdgeType,
        attackSubtype: 'REBUT' as ArgumentAttackSubtype,
        targetScope: 'conclusion' as TargetScope,
        toArgumentId: argWithClaimAsConclusion.id,
      };
    }

    // Check if it's a premise
    const argWithClaimAsPremise = await prisma.argument.findFirst({
      where: {
        deliberationId,
        premises: {
          some: {
            claimId: ca.conflictedClaimId,
          },
        },
      },
      select: { id: true },
    });

    if (argWithClaimAsPremise) {
      // Attack on premise = UNDERMINE
      return {
        type: 'rebut' as EdgeType, // Note: EdgeType doesn't have 'undermine', using rebut
        attackSubtype: 'UNDERMINE' as ArgumentAttackSubtype,
        targetScope: 'premise' as TargetScope,
        toArgumentId: argWithClaimAsPremise.id,
      };
    }
  }

  // Use legacy attack type if available
  if (ca.legacyAttackType && ca.conflictedArgumentId) {
    const legacyType = ca.legacyAttackType.toLowerCase();
    if (legacyType === 'undercuts' || legacyType === 'undercut') {
      return {
        type: 'undercut' as EdgeType,
        attackSubtype: 'UNDERCUT' as ArgumentAttackSubtype,
        targetScope: 'inference' as TargetScope,
        toArgumentId: ca.conflictedArgumentId,
      };
    } else if (legacyType === 'rebuts' || legacyType === 'rebut') {
      return {
        type: 'rebut' as EdgeType,
        attackSubtype: 'REBUT' as ArgumentAttackSubtype,
        targetScope: 'conclusion' as TargetScope,
        toArgumentId: ca.conflictedArgumentId,
      };
    } else if (legacyType === 'undermines' || legacyType === 'undermine') {
      return {
        type: 'rebut' as EdgeType,
        attackSubtype: 'UNDERMINE' as ArgumentAttackSubtype,
        targetScope: 'premise' as TargetScope,
        toArgumentId: ca.conflictedArgumentId,
      };
    }
  }

  return null;
}

/**
 * Process a single deliberation
 */
async function processDeliberation(delibId: string, stats: Stats) {
  console.log(`\n📊 Processing deliberation: ${delibId}`);

  // Fetch all ConflictApplications for this deliberation
  const caNodes = await prisma.conflictApplication.findMany({
    where: {
      deliberationId: delibId,
      conflictingArgumentId: { not: null }, // Must have attacking argument
    },
    select: {
      id: true,
      conflictingArgumentId: true,
      conflictedArgumentId: true,
      conflictedClaimId: true,
      legacyAttackType: true,
      createdById: true,
      createdAt: true,
    },
  });

  console.log(`  Found ${caNodes.length} CA-nodes with attacking arguments`);

  for (const ca of caNodes) {
    stats.caNodesProcessed++;

    try {
      // Determine edge type from CA targeting
      const edgeInfo = await determineEdgeType(ca, delibId);

      if (!edgeInfo || !edgeInfo.toArgumentId) {
        stats.edgesSkipped++;
        console.log(`    ⏭️  Skipped CA ${ca.id.slice(0, 8)} - no valid target argument`);
        continue;
      }

      // Check if edge already exists
      const existingEdge = await prisma.argumentEdge.findFirst({
        where: {
          deliberationId: delibId,
          fromArgumentId: ca.conflictingArgumentId!,
          toArgumentId: edgeInfo.toArgumentId,
        },
      });

      if (existingEdge) {
        stats.edgesSkipped++;
        console.log(`    ⏭️  Edge already exists: ${ca.conflictingArgumentId!.slice(0, 8)} → ${edgeInfo.toArgumentId.slice(0, 8)}`);
        continue;
      }

      if (!DRY_RUN) {
        // Create ArgumentEdge
        await prisma.argumentEdge.create({
          data: {
            deliberationId: delibId,
            fromArgumentId: ca.conflictingArgumentId!,
            toArgumentId: edgeInfo.toArgumentId,
            type: edgeInfo.type,
            attackSubtype: edgeInfo.attackSubtype,
            targetScope: edgeInfo.targetScope,
            createdById: ca.createdById,
            createdAt: ca.createdAt,
          },
        });

        stats.edgesCreated++;
        console.log(`    ✅ Created ${edgeInfo.attackSubtype} edge: ${ca.conflictingArgumentId!.slice(0, 8)} → ${edgeInfo.toArgumentId.slice(0, 8)}`);
      } else {
        stats.edgesCreated++;
        console.log(`    [DRY RUN] Would create ${edgeInfo.attackSubtype} edge: ${ca.conflictingArgumentId!.slice(0, 8)} → ${edgeInfo.toArgumentId.slice(0, 8)}`);
      }
    } catch (err: any) {
      stats.errors.push(`CA ${ca.id}: ${err.message}`);
      console.error(`    ❌ Error processing CA ${ca.id}:`, err.message);
    }
  }

  stats.deliberationsProcessed++;
  console.log(`  ✅ Processed ${caNodes.length} CA-nodes, created ${stats.edgesCreated} edges`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔗 ArgumentEdge Backfill from AIF ConflictApplications');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes)' : '✍️  WRITE MODE'}\n`);

  const stats: Stats = {
    deliberationsProcessed: 0,
    caNodesProcessed: 0,
    edgesCreated: 0,
    edgesSkipped: 0,
    errors: [],
  };

  try {
    if (PROCESS_ALL) {
      // Process all deliberations with CA-nodes
      console.log('🔍 Finding all deliberations with ConflictApplications...');
      const deliberations = await prisma.conflictApplication.findMany({
        where: {
          conflictingArgumentId: { not: null },
        },
        select: {
          deliberationId: true,
        },
        distinct: ['deliberationId'],
      });

      const uniqueDelibIds = Array.from(new Set(deliberations.map(d => d.deliberationId)));
      console.log(`Found ${uniqueDelibIds.length} deliberations\n`);

      for (const delibId of uniqueDelibIds) {
        try {
          await processDeliberation(delibId, stats);
        } catch (err: any) {
          stats.errors.push(`${delibId}: ${err.message}`);
          console.error(`  ❌ Error processing ${delibId}:`, err.message);
        }
      }
    } else if (deliberationId) {
      // Process single deliberation
      await processDeliberation(deliberationId, stats);
    } else {
      console.error('❌ Usage: npx tsx scripts/backfill-argument-edges-from-aif.ts <deliberationId>');
      console.error('   or:  npx tsx scripts/backfill-argument-edges-from-aif.ts --all');
      process.exit(1);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`Deliberations Processed: ${stats.deliberationsProcessed}`);
    console.log(`CA-Nodes Processed:      ${stats.caNodesProcessed}`);
    console.log(`Edges Created:           ${stats.edgesCreated}`);
    console.log(`Edges Skipped:           ${stats.edgesSkipped}`);
    console.log(`Errors:                  ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN: No changes were made. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Backfill complete!');
    }
  } catch (err: any) {
    console.error('\n❌ Fatal error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
