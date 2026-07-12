#!/usr/bin/env tsx
/**
 * scripts/generate-debate-sheets.ts
 * 
 * Generates DebateSheet content from deliberation Arguments.
 * Creates DebateNodes (with metadata) and DebateEdges from ArgumentEdges.
 * 
 * Phase 4 Task 1: Debate Layer Modernization
 * 
 * Usage:
 *   npx tsx scripts/generate-debate-sheets.ts <deliberationId>
 *   npx tsx scripts/generate-debate-sheets.ts --all
 *   npx tsx scripts/generate-debate-sheets.ts --dry-run <deliberationId>
 */

import { prisma } from '@/lib/prismaclient';
import type { ArgumentAttackSubtype, DebateEdgeKind, EdgeType } from '@prisma/client';

const DRY_RUN = process.argv.includes('--dry-run');
const PROCESS_ALL = process.argv.includes('--all');
const deliberationId = process.argv[2]?.startsWith('--') ? null : process.argv[2];

type Stats = {
  deliberationsProcessed: number;
  nodesCreated: number;
  edgesCreated: number;
  sheetsUpdated: number;
  errors: string[];
};

// ============================================================================
// METADATA COMPUTATION HELPERS
// ============================================================================

/**
 * Compute scheme metadata for an argument
 */
async function computeSchemeMetadata(argumentId: string) {
  // Try to get scheme from Argument.schemeId first
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { 
      schemeId: true,
      scheme: {
        select: { key: true, title: true }
      }
    }
  });

  if (argument?.scheme) {
    return {
      schemeKey: argument.scheme.key,
      schemeName: argument.scheme.title
    };
  }

  // Fallback: Try to get from ArgumentDiagram if it exists
  // Note: ArgumentDiagram doesn't have a direct argumentId link, skip this for now
  // Could be enhanced later to link via DebateNode.diagramId
  
  return { schemeKey: null, schemeName: null };
}

/**
 * Compute CQ status for an argument from CQStatus table
 * Matches logic from /api/deliberations/[id]/arguments/aif endpoint
 */
async function computeCQStatus(argumentId: string) {
  // Step 1: Get scheme CQs (required count)
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      schemeId: true,
      scheme: {
        select: {
          cqs: { select: { cqKey: true, text: true } }
        }
      }
    }
  });

  const requiredCQs = argument?.scheme?.cqs || [];
  const required = requiredCQs.length;

  if (required === 0) {
    // No scheme or scheme has no CQs
    return {
      open: [],
      answered: [],
      openCount: 0,
      answeredCount: 0,
      totalCount: 0,
      keys: []
    };
  }

  // Step 2: Get CQ statuses (supports both argumentId and targetType/targetId)
  const cqStatuses = await prisma.cQStatus.findMany({
    where: {
      OR: [
        { argumentId },
        { targetType: 'argument' as any, targetId: argumentId }
      ]
    },
    select: { cqKey: true, status: true }
  });

  // Step 3: Categorize CQs (dedupe by cqKey)
  const answeredKeys = new Set<string>();
  const openKeys = new Set<string>();

  for (const status of cqStatuses) {
    if (!status.cqKey) continue;
    
    if (status.status === 'answered') {
      answeredKeys.add(status.cqKey);
    } else {
      openKeys.add(status.cqKey);
    }
  }

  // Step 4: Find unanswered required CQs
  const allRequiredKeys = new Set(requiredCQs.map(cq => cq.cqKey).filter((k): k is string => k !== null));
  const unansweredKeys = [...allRequiredKeys].filter(key => !answeredKeys.has(key));

  return {
    open: unansweredKeys,
    answered: Array.from(answeredKeys),
    openCount: unansweredKeys.length,
    answeredCount: answeredKeys.size,
    totalCount: required,
    keys: Array.from(allRequiredKeys)
  };
}

/**
 * Compute attack counts from ConflictApplication (CA-nodes)
 * Returns breakdown by attack type: REBUTS, UNDERCUTS, UNDERMINES
 * Matches logic from /api/deliberations/[id]/arguments/aif endpoint
 */
async function computeAttackCounts(argumentId: string, deliberationId: string) {
  // Fetch argument's conclusion and premise claims
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      conclusionClaimId: true,
      premises: { select: { claimId: true } }
    }
  });

  if (!argument) return { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0, total: 0 };

  const premiseClaimIds = argument.premises.map(p => p.claimId);
  const claimIds = [argument.conclusionClaimId, ...premiseClaimIds].filter(Boolean) as string[];

  // Fetch ConflictApplications targeting this argument or its claims
  const caRows = await prisma.conflictApplication.findMany({
    where: {
      deliberationId,
      OR: [
        { conflictedArgumentId: argumentId },       // Undercuts (RA target)
        { conflictedClaimId: { in: claimIds } }     // Rebuts/Undermines (I target)
      ]
    },
    select: {
      conflictedArgumentId: true,
      conflictedClaimId: true,
      legacyAttackType: true
    }
  });

  const counts = { REBUTS: 0, UNDERCUTS: 0, UNDERMINES: 0 };

  for (const ca of caRows) {
    let bucket: 'REBUTS' | 'UNDERCUTS' | 'UNDERMINES' | null = null;

    if (ca.legacyAttackType) {
      // Explicit type from legacy data
      bucket = ca.legacyAttackType as any;
    } else if (ca.conflictedArgumentId === argumentId) {
      // CA → RA implies undercut
      bucket = 'UNDERCUTS';
    } else if (ca.conflictedClaimId) {
      // Check if claim is conclusion (rebut) or premise (undermine)
      if (ca.conflictedClaimId === argument.conclusionClaimId) {
        bucket = 'REBUTS';
      } else if (premiseClaimIds.includes(ca.conflictedClaimId)) {
        bucket = 'UNDERMINES';
      }
    }

    if (bucket) counts[bucket] += 1;
  }

  return {
    ...counts,
    total: counts.REBUTS + counts.UNDERCUTS + counts.UNDERMINES
  };
}

/**
 * Compute preference data from PreferenceApplication (PA-nodes)
 * Returns: { preferredBy, dispreferredBy, rank }
 * Matches logic from /api/deliberations/[id]/arguments/aif endpoint
 */
async function computePreferences(argumentId: string, deliberationId: string) {
  // Fetch PA-nodes where this argument is preferred or dispreferred
  const [preferredCount, dispreferredCount] = await Promise.all([
    prisma.preferenceApplication.count({
      where: {
        deliberationId,
        preferredArgumentId: argumentId
      }
    }),
    prisma.preferenceApplication.count({
      where: {
        deliberationId,
        dispreferredArgumentId: argumentId
      }
    })
  ]);

  // Compute preference rank (0.0 = all dispreferred, 1.0 = all preferred)
  const total = preferredCount + dispreferredCount;
  const rank = total === 0 ? 0.5 : preferredCount / total;

  return {
    preferredBy: preferredCount,
    dispreferredBy: dispreferredCount,
    rank: Math.round(rank * 100) / 100  // Round to 2 decimals
  };
}

/**
 * Compute Toulmin structure depth (max inference chain depth)
 */
async function computeToulminDepth(argumentId: string): Promise<number> {
  // Fetch ArgumentEdges that support this argument (incoming support edges)
  const supportEdges = await prisma.argumentEdge.findMany({
    where: {
      toArgumentId: argumentId,
      type: 'support'
    },
    select: { fromArgumentId: true }
  });

  if (supportEdges.length === 0) return 1; // Base case: no supporting arguments

  // Recursively compute depth of supporting arguments
  const depths = await Promise.all(
    supportEdges.map(edge => computeToulminDepth(edge.fromArgumentId))
  );

  return 1 + Math.max(...depths, 0);
}

/**
 * Aggregate all metadata for a DebateNode
 */
async function computeNodeMetadata(argumentId: string, deliberationId: string) {
  const [scheme, cqStatus, attacks, preferences, toulminDepth] = await Promise.all([
    computeSchemeMetadata(argumentId),
    computeCQStatus(argumentId),
    computeAttackCounts(argumentId, deliberationId),
    computePreferences(argumentId, deliberationId),
    computeToulminDepth(argumentId).catch(() => 1) // Fallback to 1 if recursion fails
  ]);

  return {
    schemeKey: scheme.schemeKey,
    schemeName: scheme.schemeName,
    cqStatus,
    attacks,
    preferences,
    toulminDepth
  };
}

// ============================================================================
// EDGE TYPE MAPPING
// ============================================================================

/**
 * Map ArgumentEdge type + attackSubtype to DebateEdge kind + attackSubtype
 */
function mapEdgeType(
  edgeType: EdgeType,
  attackSubtype: ArgumentAttackSubtype | null,
  targetScope: string | null
): { kind: DebateEdgeKind; attackSubtype: ArgumentAttackSubtype | null } {
  // Support edges map directly
  if (edgeType === 'support') {
    return { kind: 'supports', attackSubtype: null };
  }

  // Undercut edges (attack on inference)
  if (edgeType === 'undercut' || attackSubtype === 'UNDERCUT' || targetScope === 'inference') {
    return { kind: 'undercuts', attackSubtype: 'UNDERCUT' };
  }

  // Rebut edges (attack on conclusion)
  if (attackSubtype === 'REBUT' || targetScope === 'conclusion') {
    return { kind: 'rebuts', attackSubtype: 'REBUT' };
  }

  // Undermine edges (attack on premise)
  if (attackSubtype === 'UNDERMINE' || targetScope === 'premise') {
    return { kind: 'rebuts', attackSubtype: 'UNDERMINE' }; // Use 'rebuts' kind with UNDERMINE subtype
  }

  // Default: rebut for any attack type
  if (edgeType === 'rebut') {
    return { kind: 'rebuts', attackSubtype: attackSubtype || 'REBUT' };
  }

  // Fallback
  return { kind: 'rebuts', attackSubtype: null };
}

// ============================================================================
// SHEET GENERATION LOGIC
// ============================================================================

async function generateDebateSheet(deliberationId: string, stats: Stats) {
  console.log(`\n📊 Processing deliberation: ${deliberationId}`);
  
  // Step 1: Find or verify synthetic DebateSheet exists
  const sheetId = `delib:${deliberationId}`;
  const existingSheet = await prisma.debateSheet.findUnique({
    where: { id: sheetId },
    select: { id: true, title: true }
  });

  if (!existingSheet) {
    stats.errors.push(`No DebateSheet found for deliberation ${deliberationId}`);
    console.error(`  ❌ Sheet ${sheetId} does not exist (run backfill-agora-debate-chain.ts first)`);
    return;
  }

  console.log(`  ✅ Found sheet: ${existingSheet.title}`);

  // Step 2: Fetch all arguments in deliberation
  const args = await prisma.argument.findMany({
    where: { deliberationId },
    select: {
      id: true,
      claimId: true,
      authorId: true, // Correct field name
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`  📝 Found ${args.length} arguments`);

  if (args.length === 0) {
    console.log(`  ⚠️  No arguments to generate nodes from`);
    return;
  }

  // Step 3: Create DebateNodes with metadata
  console.log(`  🔨 Creating DebateNodes...`);
  
  for (const arg of args) {
    const nodeId = `node:${arg.id}`;
    
    // Check if node already exists
    const existingNode = await prisma.debateNode.findFirst({
      where: {
        sheetId,
        argumentId: arg.id
      }
    });

    if (existingNode) {
      console.log(`    ⏭️  Node already exists for argument ${arg.id.slice(0, 8)}`);
      continue;
    }

    // Compute metadata
    console.log(`    🧮 Computing metadata for argument ${arg.id.slice(0, 8)}...`);
    const metadata = await computeNodeMetadata(arg.id, deliberationId);

    // Fetch claim text if we have a claimId
    let claimText: string | null = null;
    if (arg.claimId) {
      const claim = await prisma.claim.findUnique({
        where: { id: arg.claimId },
        select: { text: true }
      });
      claimText = claim?.text || null;
    }

    const nodeData = {
      id: nodeId,
      sheetId,
      argumentId: arg.id,
      claimId: arg.claimId,
      title: claimText || `Argument ${arg.id.slice(0, 6)}`,
      summary: `Scheme: ${metadata.schemeName || 'None'} | CQs: ${metadata.cqStatus.answeredCount}/${metadata.cqStatus.totalCount} answered | Attacks: ${metadata.attacks.total} (R:${metadata.attacks.REBUTS} U:${metadata.attacks.UNDERCUTS} M:${metadata.attacks.UNDERMINES}) | Prefs: +${metadata.preferences.preferredBy}/-${metadata.preferences.dispreferredBy}`,
      authorsJson: { authorId: arg.authorId },
      createdAt: arg.createdAt
    };

    if (!DRY_RUN) {
      await prisma.debateNode.create({ data: nodeData });
      stats.nodesCreated++;
      console.log(`    ✅ Created node ${nodeId} (scheme: ${metadata.schemeKey || 'none'}, CQs: ${metadata.cqStatus.answeredCount}/${metadata.cqStatus.totalCount}, attacks: ${metadata.attacks.total}, prefs: ${metadata.preferences.rank})`);
    } else {
      console.log(`    [DRY RUN] Would create node ${nodeId}`);
      stats.nodesCreated++;
    }
  }

  // Step 4: Create DebateEdges from ConflictApplication (AIF system)
  console.log(`  🔗 Step 4: Creating DebateEdges from ConflictApplication...`);
  
  // Build map of argumentId → nodeId for quick lookups
  const debateNodeMap = new Map<string, string>();
  for (const arg of args) {
    debateNodeMap.set(arg.id, `node:${arg.id}`);
  }
  
  // Fetch ALL ConflictApplication records for this deliberation
  // We'll filter in memory since conflicts can involve claims or arguments
  const conflicts = await prisma.conflictApplication.findMany({
    where: {
      deliberationId
    },
    select: {
      id: true,
      conflictingArgumentId: true,
      conflictingClaimId: true,
      conflictedArgumentId: true,
      conflictedClaimId: true,
      legacyAttackType: true,
      legacyTargetScope: true
    }
  });

  console.log(`    Found ${conflicts.length} ConflictApplication records in deliberation`);
  
  // Build claim-to-argument map for resolution
  // Key insight from diagram-neighborhoods.ts: ConflictApplications link to CLAIMS,
  // and we need to resolve those back to their parent Arguments
  const claimToArgMap = new Map<string, string>();
  
  // Map conclusion claims to arguments
  for (const arg of args) {
    if (arg.claimId) {
      claimToArgMap.set(arg.claimId, arg.id);
    }
  }
  
  // Also need to fetch and map premise claims to their arguments
  const premises = await prisma.argumentPremise.findMany({
    where: {
      argumentId: { in: args.map(a => a.id) }
    },
    select: {
      argumentId: true,
      claimId: true
    }
  });
  
  for (const prem of premises) {
    // For premises, we map the claim to the argument that uses it as a premise
    // Note: Multiple arguments might use the same premise claim
    if (!claimToArgMap.has(prem.claimId)) {
      claimToArgMap.set(prem.claimId, prem.argumentId);
    }
  }
  
  console.log(`    Built claim-to-argument map with ${claimToArgMap.size} entries`);
  
  // Map ConflictApplications to DebateEdges
  const debateEdgesToCreate: Array<{
    fromArgId: string;
    toArgId: string;
    kind: string;
    attackSubtype: string | null;
  }> = [];
  
  const argIdSet = new Set(args.map(a => a.id));
  
  for (const c of conflicts) {
    // Resolve attacking argument (conflicting side)
    let fromArgId: string | null = null;
    if (c.conflictingArgumentId) {
      fromArgId = c.conflictingArgumentId;
    } else if (c.conflictingClaimId) {
      fromArgId = claimToArgMap.get(c.conflictingClaimId) || null;
    }
    
    // Resolve targeted argument (conflicted side)
    let toArgId: string | null = null;
    if (c.conflictedArgumentId) {
      toArgId = c.conflictedArgumentId;
    } else if (c.conflictedClaimId) {
      toArgId = claimToArgMap.get(c.conflictedClaimId) || null;
    }
    
    // Only create edge if both sides resolve to arguments in our sheet
    if (!fromArgId || !toArgId) {
      console.log(`    ⚠️  Skipping CA ${c.id.slice(0, 8)}: could not resolve to arguments (from: ${fromArgId?.slice(0,8) || 'null'}, to: ${toArgId?.slice(0,8) || 'null'})`);
      continue;
    }
    
    if (!argIdSet.has(fromArgId) || !argIdSet.has(toArgId)) {
      console.log(`    ⚠️  Skipping CA ${c.id.slice(0, 8)}: arguments not in sheet (${fromArgId.slice(0, 8)} → ${toArgId.slice(0, 8)})`);
      continue;
    }
    
    const attackType = c.legacyAttackType || "REBUT";
    
    // Map attack type to both kind (for DebateEdge.kind) and attackSubtype (for DebateEdge.attackSubtype)
    let kind: string;
    let attackSubtype: string;
    
    if (attackType === "UNDERCUT") {
      kind = "undercuts";
      attackSubtype = "UNDERCUT";
    } else if (attackType === "UNDERMINE") {
      kind = "objects";
      attackSubtype = "UNDERMINE";
    } else {
      kind = "rebuts";
      attackSubtype = "REBUT";
    }
    
    debateEdgesToCreate.push({
      fromArgId,
      toArgId,
      kind,
      attackSubtype
    });
  }

  console.log(`    Derived ${debateEdgesToCreate.length} debate edges from conflicts`);  // Create DebateEdges from derived edges
  let edgesCreated = 0;
  for (const edge of debateEdgesToCreate) {
    const fromNodeId = debateNodeMap.get(edge.fromArgId);
    const toNodeId = debateNodeMap.get(edge.toArgId);
    
    if (!fromNodeId || !toNodeId) {
      console.log(`    ⚠️  Skipping edge: missing node mapping`);
      continue;
    }

    // Check if edge already exists
    const existingEdge = await prisma.debateEdge.findFirst({
      where: {
        sheetId,
        fromId: fromNodeId,
        toId: toNodeId
      }
    });

    if (existingEdge) {
      console.log(`    ⏭️  Edge already exists: ${edge.fromArgId.slice(0, 8)} → ${edge.toArgId.slice(0, 8)}`);
      continue;
    }

    await prisma.debateEdge.create({
      data: {
        sheetId,
        fromId: fromNodeId,
        toId: toNodeId,
        kind: edge.kind as any, // Cast to DebateEdgeKind
        attackSubtype: edge.attackSubtype
      }
    });
    
    edgesCreated++;
    stats.edgesCreated++;
  }

  console.log(`  ✅ Created ${edgesCreated} debate edges from AIF graph`);

  // Step 5: Populate UnresolvedCQ table with open CQs
  console.log(`  🔍 Step 5: Populating UnresolvedCQ records...`);
  
  // Find all CQStatus records with open status for arguments in this deliberation
  const openCQs = await prisma.cQStatus.findMany({
    where: {
      argumentId: {
        in: args.map(arg => arg.id)
      },
      status: { not: 'answered' }
    },
    select: {
      id: true,
      argumentId: true,
      cqKey: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  console.log(`    Found ${openCQs.length} open CQs across all arguments`);

  for (const cqStatus of openCQs) {
    // Find the DebateNode for this argument
    const nodeId = `node:${cqStatus.argumentId}`;
    
    // Check if UnresolvedCQ already exists
    const existing = await prisma.unresolvedCQ.findFirst({
      where: {
        sheetId,
        nodeId,
        cqKey: cqStatus.cqKey
      }
    });

    if (existing) {
      console.log(`    ⏭️  UnresolvedCQ already exists for CQ ${cqStatus.cqKey} on node ${nodeId.slice(5, 13)}`);
      continue;
    }

    if (!DRY_RUN) {
      await prisma.unresolvedCQ.create({
        data: {
          sheetId,
          nodeId,
          cqKey: cqStatus.cqKey
        }
      });
      console.log(`    ✅ Created UnresolvedCQ for ${cqStatus.cqKey} (${cqStatus.status || 'open'})`);
    } else {
      console.log(`    [DRY RUN] Would create UnresolvedCQ for ${cqStatus.cqKey}`);
    }
  }

  // Step 6: Update sheet timestamp
  if (!DRY_RUN) {
    await prisma.debateSheet.update({
      where: { id: sheetId },
      data: { updatedAt: new Date() }
    });
    stats.sheetsUpdated++;
  }

  console.log(`  ✅ Sheet generation complete`);
  stats.deliberationsProcessed++;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('📋 DebateSheet Generation Script');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes)' : '✍️  WRITE MODE'}\n`);

  const stats: Stats = {
    deliberationsProcessed: 0,
    nodesCreated: 0,
    edgesCreated: 0,
    sheetsUpdated: 0,
    errors: []
  };

  try {
    if (PROCESS_ALL) {
      // Process all deliberations with sheets
      console.log('🔍 Finding all deliberations with sheets...');
      const sheets = await prisma.debateSheet.findMany({
        where: {
          deliberationId: { not: null }
        },
        select: {
          deliberationId: true,
          title: true
        }
      });

      console.log(`Found ${sheets.length} sheets to process\n`);

      for (const sheet of sheets) {
        if (sheet.deliberationId) {
          try {
            await generateDebateSheet(sheet.deliberationId, stats);
          } catch (err: any) {
            stats.errors.push(`${sheet.deliberationId}: ${err.message}`);
            console.error(`  ❌ Error processing ${sheet.deliberationId}:`, err.message);
          }
        }
      }
    } else if (deliberationId) {
      // Process single deliberation
      await generateDebateSheet(deliberationId, stats);
    } else {
      console.error('❌ Usage: npx tsx scripts/generate-debate-sheets.ts <deliberationId>');
      console.error('   or:  npx tsx scripts/generate-debate-sheets.ts --all');
      process.exit(1);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Deliberations Processed: ${stats.deliberationsProcessed}`);
    console.log(`DebateNodes Created:     ${stats.nodesCreated}`);
    console.log(`DebateEdges Created:     ${stats.edgesCreated}`);
    console.log(`Sheets Updated:          ${stats.sheetsUpdated}`);
    console.log(`Errors:                  ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN: No changes were made. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Generation complete!');
    }

  } catch (err: any) {
    console.error('\n❌ Fatal error:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
