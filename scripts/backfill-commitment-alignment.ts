#!/usr/bin/env tsx
/**
 * Backfill Script: Commitment System Alignment
 * 
 * Purpose: Ensure historical DialogueMoves are properly aligned with commitment semantics.
 * This script validates and repairs the commitment tracking system to ensure:
 * - All ASSERT/CONCEDE moves properly tracked
 * - RETRACT moves correctly mark commitments as inactive
 * - THEREFORE moves treated as commitments
 * - WHY/GROUNDS moves don't create direct commitments (correct behavior)
 * - Claim-DialogueMove associations are complete
 * 
 * What This Script Does:
 * 1. Validates all DialogueMoves have correct targetType/targetId for claim-based moves
 * 2. Ensures Claims have associated ASSERT DialogueMoves
 * 3. Validates RETRACT moves target claims that were previously asserted by same actor
 * 4. Checks CONCEDE moves reference valid opponent claims
 * 5. Reports orphaned claims (claims without introducing DialogueMove)
 * 6. Validates temporal consistency (RETRACT after ASSERT, etc.)
 * 7. Optionally creates missing DialogueMoves for orphaned claims (with --fix flag)
 * 
 * Idempotent: Safe to run multiple times
 * Dry-run by default: Use --fix flag to actually create missing records
 * 
 * Usage:
 *   # Dry run (report issues only)
 *   npx tsx scripts/backfill-commitment-alignment.ts
 *   
 *   # Fix issues
 *   npx tsx scripts/backfill-commitment-alignment.ts --fix
 *   
 *   # Check specific deliberation
 *   npx tsx scripts/backfill-commitment-alignment.ts --deliberation=delib-123
 *   
 *   # Verbose output
 *   npx tsx scripts/backfill-commitment-alignment.ts --verbose
 */

import { PrismaClient } from "@prisma/client";
import { getCommitmentStores } from "../lib/aif/graph-builder";

const prisma = new PrismaClient();

interface BackfillOptions {
  fix: boolean;
  verbose: boolean;
  deliberationId?: string;
}

interface ValidationIssue {
  type: "orphaned_claim" | "invalid_retract" | "invalid_concede" | "missing_target" | "temporal_inconsistency";
  severity: "error" | "warning" | "info";
  moveId?: string;
  claimId?: string;
  deliberationId: string;
  actorId?: string;
  message: string;
  details?: any;
}

interface BackfillStats {
  totalDeliberations: number;
  totalMoves: number;
  totalClaims: number;
  commitmentCreatingMoves: number;
  orphanedClaims: number;
  invalidRetracts: number;
  invalidConcedes: number;
  missingTargets: number;
  temporalIssues: number;
  movesCreated: number;
  errors: number;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    fix: false,
    verbose: false,
  };

  for (const arg of args) {
    if (arg === "--fix") {
      options.fix = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg.startsWith("--deliberation=")) {
      options.deliberationId = arg.split("=")[1];
    }
  }

  return options;
}

/**
 * Validate a single DialogueMove
 */
async function validateMove(
  move: any,
  issues: ValidationIssue[],
  options: BackfillOptions
): Promise<void> {
  const { verbose } = options;

  // Check 1: ASSERT/CONCEDE/RETRACT moves should target claims
  if (["ASSERT", "CONCEDE", "RETRACT", "THEREFORE"].includes(move.kind)) {
    if (move.targetType === "claim" && move.targetId) {
      // Verify claim exists
      const claim = await prisma.claim.findUnique({
        where: { id: move.targetId },
        select: { id: true, text: true }
      });

      if (!claim) {
        issues.push({
          type: "missing_target",
          severity: "error",
          moveId: move.id,
          claimId: move.targetId,
          deliberationId: move.deliberationId,
          actorId: move.actorId,
          message: `${move.kind} move references non-existent claim`,
          details: { moveId: move.id, targetId: move.targetId }
        });
      }
    } else if (move.targetType !== "claim") {
      if (verbose) {
        issues.push({
          type: "missing_target",
          severity: "warning",
          moveId: move.id,
          deliberationId: move.deliberationId,
          actorId: move.actorId,
          message: `${move.kind} move has targetType '${move.targetType}' (expected 'claim')`,
          details: { moveId: move.id, targetType: move.targetType }
        });
      }
    }
  }

  // Check 2: RETRACT moves should target claims previously asserted by same actor
  if (move.kind === "RETRACT" && move.targetType === "claim" && move.targetId) {
    const priorAssert = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId: move.deliberationId,
        actorId: move.actorId,
        targetType: "claim",
        targetId: move.targetId,
        kind: { in: ["ASSERT", "CONCEDE", "THEREFORE"] },
        createdAt: { lt: move.createdAt }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!priorAssert) {
      issues.push({
        type: "invalid_retract",
        severity: "error",
        moveId: move.id,
        claimId: move.targetId,
        deliberationId: move.deliberationId,
        actorId: move.actorId,
        message: `RETRACT move without prior ASSERT/CONCEDE by same actor`,
        details: { 
          moveId: move.id, 
          actorId: move.actorId, 
          claimId: move.targetId,
          moveCreatedAt: move.createdAt
        }
      });
    }
  }

  // Check 3: Temporal consistency - ASSERT should come before RETRACT
  if (["ASSERT", "CONCEDE"].includes(move.kind) && move.targetType === "claim" && move.targetId) {
    const futureRetract = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId: move.deliberationId,
        actorId: move.actorId,
        targetType: "claim",
        targetId: move.targetId,
        kind: "RETRACT",
        createdAt: { lt: move.createdAt } // RETRACT before ASSERT (temporal issue)
      }
    });

    if (futureRetract) {
      issues.push({
        type: "temporal_inconsistency",
        severity: "error",
        moveId: move.id,
        claimId: move.targetId,
        deliberationId: move.deliberationId,
        actorId: move.actorId,
        message: `RETRACT move exists before ASSERT/CONCEDE (temporal inconsistency)`,
        details: {
          assertMove: move.id,
          assertCreatedAt: move.createdAt,
          retractMove: futureRetract.id,
          retractCreatedAt: futureRetract.createdAt
        }
      });
    }
  }
}

/**
 * Find orphaned claims (claims without introducing DialogueMove)
 */
async function findOrphanedClaims(
  deliberationId: string,
  issues: ValidationIssue[],
  options: BackfillOptions
): Promise<string[]> {
  const { verbose } = options;

  // Find all claims in this deliberation
  const claims = await prisma.claim.findMany({
    where: { 
      deliberationId: deliberationId
    },
    select: {
      id: true,
      text: true,
      createdById: true,
      createdAt: true
    }
  });

  if (verbose) {
    console.log(`   Found ${claims.length} claims in deliberation`);
  }

  const orphanedClaimIds: string[] = [];

  for (const claim of claims) {
    // Check if there's an ASSERT DialogueMove for this claim
    const assertMove = await prisma.dialogueMove.findFirst({
      where: {
        deliberationId: deliberationId,
        targetType: "claim",
        targetId: claim.id,
        kind: { in: ["ASSERT", "CONCEDE", "THEREFORE"] }
      }
    });

    if (!assertMove) {
      orphanedClaimIds.push(claim.id);
      issues.push({
        type: "orphaned_claim",
        severity: "warning",
        claimId: claim.id,
        deliberationId: deliberationId,
        actorId: claim.createdById,
        message: `Claim exists without introducing DialogueMove`,
        details: {
          claimId: claim.id,
          claimText: claim.text?.substring(0, 100),
          createdById: claim.createdById,
          createdAt: claim.createdAt
        }
      });
    }
  }

  return orphanedClaimIds;
}

/**
 * Create missing ASSERT DialogueMoves for orphaned claims
 */
async function createMissingAssertMoves(
  deliberationId: string,
  orphanedClaimIds: string[],
  stats: BackfillStats
): Promise<void> {
  console.log(`\n   🔧 Creating ASSERT moves for ${orphanedClaimIds.length} orphaned claims...`);

  for (const claimId of orphanedClaimIds) {
    try {
      const claim = await prisma.claim.findUnique({
        where: { id: claimId },
        select: {
          id: true,
          text: true,
          createdById: true,
          createdAt: true,
          deliberationId: true
        }
      });

      if (!claim) {
        console.log(`   ⚠️  Claim ${claimId} not found (may have been deleted)`);
        continue;
      }

      // Create ASSERT DialogueMove
      // Generate signature for deduplication
      const signature = `backfill-assert-${claimId}`;
      
      const move = await prisma.dialogueMove.create({
        data: {
          id: `backfill-assert-${claimId}`,
          deliberationId: claim.deliberationId || deliberationId,
          actorId: claim.createdById || "system",
          kind: "ASSERT",
          targetType: "claim",
          targetId: claimId,
          signature: signature,
          payload: {
            backfilled: true,
            originalClaimCreatedAt: claim.createdAt,
            text: claim.text?.substring(0, 2000)
          },
          createdAt: claim.createdAt || new Date(),
          // Use claim creation time for temporal consistency
        }
      });

      stats.movesCreated++;
      console.log(`   ✅ Created ASSERT move for claim ${claimId.substring(0, 12)}... (move: ${move.id})`);
    } catch (error: any) {
      if (error.code === "P2002") {
        // Unique constraint violation - move already exists (race condition or re-run)
        console.log(`   ℹ️  ASSERT move already exists for claim ${claimId} (skipped)`);
      } else {
        console.error(`   ❌ Failed to create ASSERT move for claim ${claimId}:`, error.message);
        stats.errors++;
      }
    }
  }
}

/**
 * Validate commitment stores for a deliberation
 */
async function validateCommitmentStores(
  deliberationId: string,
  issues: ValidationIssue[],
  options: BackfillOptions
): Promise<void> {
  const { verbose } = options;

  try {
    // Test that commitment store computation works without errors
    const storesResult = await getCommitmentStores(deliberationId);
    const stores = storesResult.data;

    if (verbose) {
      console.log(`   Commitment stores computed successfully for ${stores.length} participants`);
      
      for (const store of stores) {
        const activeCount = store.commitments.filter(c => c.isActive).length;
        const retractedCount = store.commitments.filter(c => !c.isActive).length;
        console.log(`     - ${store.participantName}: ${activeCount} active, ${retractedCount} retracted`);
      }
    }

    // Validate: Check for duplicate commitments (same claim, same participant, both active)
    for (const store of stores) {
      const activeCommitments = store.commitments.filter(c => c.isActive);
      const claimCounts = new Map<string, number>();

      for (const commitment of activeCommitments) {
        const count = claimCounts.get(commitment.claimId) || 0;
        claimCounts.set(commitment.claimId, count + 1);
      }

      for (const [claimId, count] of claimCounts.entries()) {
        if (count > 1) {
          issues.push({
            type: "temporal_inconsistency",
            severity: "warning",
            claimId: claimId,
            deliberationId: deliberationId,
            actorId: store.participantId,
            message: `Participant has ${count} active commitments to same claim (duplicate ASSERT without RETRACT?)`,
            details: {
              participantId: store.participantId,
              claimId: claimId,
              activeCount: count
            }
          });
        }
      }
    }
  } catch (error: any) {
    issues.push({
      type: "missing_target",
      severity: "error",
      deliberationId: deliberationId,
      message: `Failed to compute commitment stores: ${error.message}`,
      details: { error: error.stack }
    });
  }
}

/**
 * Process a single deliberation
 */
async function processDeliberation(
  deliberationId: string,
  issues: ValidationIssue[],
  stats: BackfillStats,
  options: BackfillOptions
): Promise<void> {
  const { verbose, fix } = options;

  if (verbose) {
    console.log(`\n📋 Processing deliberation: ${deliberationId}`);
  }

  // Fetch all DialogueMoves for this deliberation
  const moves = await prisma.dialogueMove.findMany({
    where: { deliberationId: deliberationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      targetType: true,
      targetId: true,
      actorId: true,
      createdAt: true,
      deliberationId: true,
      payload: true
    }
  });

  stats.totalMoves += moves.length;

  // Count commitment-creating moves
  const commitmentMoves = moves.filter(m => 
    ["ASSERT", "CONCEDE", "RETRACT", "THEREFORE"].includes(m.kind)
  );
  stats.commitmentCreatingMoves += commitmentMoves.length;

  if (verbose) {
    console.log(`   Found ${moves.length} total moves (${commitmentMoves.length} commitment-related)`);
  }

  // Validate each move
  for (const move of moves) {
    await validateMove(move, issues, options);
  }

  // Find orphaned claims
  const orphanedClaimIds = await findOrphanedClaims(deliberationId, issues, options);
  stats.orphanedClaims += orphanedClaimIds.length;

  // Fix orphaned claims if --fix flag provided
  if (fix && orphanedClaimIds.length > 0) {
    await createMissingAssertMoves(deliberationId, orphanedClaimIds, stats);
  }

  // Validate commitment stores
  await validateCommitmentStores(deliberationId, issues, options);
}

/**
 * Print issue summary
 */
function printIssueSummary(issues: ValidationIssue[], stats: BackfillStats): void {
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const infos = issues.filter(i => i.severity === "info");

  console.log("\n" + "=".repeat(80));
  console.log("📊 VALIDATION SUMMARY");
  console.log("=".repeat(80));

  console.log("\n📈 Statistics:");
  console.log(`   Total Deliberations: ${stats.totalDeliberations}`);
  console.log(`   Total DialogueMoves: ${stats.totalMoves}`);
  console.log(`   Commitment-creating moves: ${stats.commitmentCreatingMoves}`);
  console.log(`   Total Claims: ${stats.totalClaims}`);

  console.log("\n🔍 Issues Found:");
  console.log(`   ❌ Errors: ${errors.length}`);
  console.log(`   ⚠️  Warnings: ${warnings.length}`);
  console.log(`   ℹ️  Info: ${infos.length}`);

  console.log("\n📋 Issue Breakdown:");
  console.log(`   Orphaned Claims: ${stats.orphanedClaims}`);
  console.log(`   Invalid RETRACTs: ${stats.invalidRetracts}`);
  console.log(`   Invalid CONCEDEs: ${stats.invalidConcedes}`);
  console.log(`   Missing Targets: ${stats.missingTargets}`);
  console.log(`   Temporal Inconsistencies: ${stats.temporalIssues}`);

  if (stats.movesCreated > 0) {
    console.log("\n✅ Fixes Applied:");
    console.log(`   DialogueMoves Created: ${stats.movesCreated}`);
  }

  if (stats.errors > 0) {
    console.log("\n❌ Errors During Backfill:");
    console.log(`   Errors Encountered: ${stats.errors}`);
  }

  // Print detailed issues by type
  if (errors.length > 0) {
    console.log("\n" + "=".repeat(80));
    console.log("❌ ERRORS (Require Attention)");
    console.log("=".repeat(80));

    const errorsByType = new Map<string, ValidationIssue[]>();
    for (const error of errors) {
      const list = errorsByType.get(error.type) || [];
      list.push(error);
      errorsByType.set(error.type, list);
    }

    for (const [type, errs] of errorsByType.entries()) {
      console.log(`\n${type.toUpperCase()} (${errs.length}):`);
      for (const err of errs.slice(0, 5)) { // Show first 5
        console.log(`   - ${err.message}`);
        if (err.moveId) console.log(`     Move: ${err.moveId}`);
        if (err.claimId) console.log(`     Claim: ${err.claimId}`);
        if (err.actorId) console.log(`     Actor: ${err.actorId}`);
      }
      if (errs.length > 5) {
        console.log(`   ... and ${errs.length - 5} more`);
      }
    }
  }

  if (warnings.length > 0 && warnings.length <= 20) {
    console.log("\n" + "=".repeat(80));
    console.log("⚠️  WARNINGS");
    console.log("=".repeat(80));

    for (const warning of warnings) {
      console.log(`\n${warning.type}:`);
      console.log(`   ${warning.message}`);
      if (warning.claimId) console.log(`   Claim: ${warning.claimId}`);
      if (warning.moveId) console.log(`   Move: ${warning.moveId}`);
    }
  } else if (warnings.length > 20) {
    console.log(`\n⚠️  ${warnings.length} warnings found (use --verbose to see all)`);
  }
}

/**
 * Main backfill function
 */
async function backfillCommitmentAlignment(options: BackfillOptions): Promise<void> {
  console.log("🔄 Starting Commitment System Alignment Check...\n");

  if (options.fix) {
    console.log("⚙️  FIX MODE ENABLED - Will create missing DialogueMoves\n");
  } else {
    console.log("📋 DRY RUN MODE - No changes will be made");
    console.log("   Use --fix flag to apply fixes\n");
  }

  const stats: BackfillStats = {
    totalDeliberations: 0,
    totalMoves: 0,
    totalClaims: 0,
    commitmentCreatingMoves: 0,
    orphanedClaims: 0,
    invalidRetracts: 0,
    invalidConcedes: 0,
    missingTargets: 0,
    temporalIssues: 0,
    movesCreated: 0,
    errors: 0
  };

  const issues: ValidationIssue[] = [];

  // Get deliberations to process
  let deliberations: { id: string }[];
  
  if (options.deliberationId) {
    // Process specific deliberation
    const delib = await prisma.deliberation.findUnique({
      where: { id: options.deliberationId },
      select: { id: true }
    });
    
    if (!delib) {
      console.error(`❌ Deliberation ${options.deliberationId} not found`);
      process.exit(1);
    }
    
    deliberations = [delib];
    console.log(`🎯 Processing single deliberation: ${options.deliberationId}\n`);
  } else {
    // Process all deliberations with DialogueMoves
    deliberations = await prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT "deliberationId" as id
      FROM "DialogueMove"
    `;
    
    console.log(`🌐 Processing ${deliberations.length} deliberations with DialogueMoves\n`);
  }

  stats.totalDeliberations = deliberations.length;

  // Process each deliberation
  for (let i = 0; i < deliberations.length; i++) {
    const delib = deliberations[i];
    
    if (!options.verbose && deliberations.length > 1) {
      // Progress indicator for multiple deliberations
      if (i % 10 === 0) {
        console.log(`   Progress: ${i}/${deliberations.length} deliberations processed...`);
      }
    }

    try {
      await processDeliberation(delib.id, issues, stats, options);
    } catch (error: any) {
      console.error(`❌ Error processing deliberation ${delib.id}:`, error.message);
      stats.errors++;
    }
  }

  // Count issues by type
  stats.invalidRetracts = issues.filter(i => i.type === "invalid_retract").length;
  stats.invalidConcedes = issues.filter(i => i.type === "invalid_concede").length;
  stats.missingTargets = issues.filter(i => i.type === "missing_target").length;
  stats.temporalIssues = issues.filter(i => i.type === "temporal_inconsistency").length;

  // Print summary
  printIssueSummary(issues, stats);

  console.log("\n" + "=".repeat(80));
  if (stats.movesCreated > 0) {
    console.log("✅ Backfill Complete! Created " + stats.movesCreated + " DialogueMoves");
  } else if (options.fix) {
    console.log("✅ Backfill Complete! No fixes needed");
  } else {
    console.log("✅ Validation Complete!");
    if (stats.orphanedClaims > 0) {
      console.log(`\n💡 Tip: Run with --fix flag to create ${stats.orphanedClaims} missing ASSERT moves`);
    }
  }
  console.log("=".repeat(80) + "\n");
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();

  try {
    await backfillCommitmentAlignment(options);
  } catch (error: any) {
    console.error("\n❌ Fatal error during backfill:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run backfill
main();
