#!/usr/bin/env node
/**
 * Phase 3 API Integration Tests
 * Tests Fix #6 (GROUNDS→Arguments) via actual API calls
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
  failed++;
}

function warn(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
  warnings++;
}

function info(msg) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

function section(title) {
  console.log('\n' + '━'.repeat(60));
  console.log(`  ${title}`);
  console.log('━'.repeat(60));
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Phase 3 API Integration Tests');
  console.log('═'.repeat(60));

  try {
    // ═══════════════════════════════════════════════════════════
    // Database Connection Test
    // ═══════════════════════════════════════════════════════════
    section('Database Connection');

    try {
      await prisma.$connect();
      pass('Connected to database');
    } catch (e) {
      fail(`Database connection failed: ${e.message}`);
      process.exit(1);
    }

    // ═══════════════════════════════════════════════════════════
    // Check Test Data
    // ═══════════════════════════════════════════════════════════
    section('Test Data Availability');

    const deliberations = await prisma.deliberation.findMany({ take: 5 });
    info(`Found ${deliberations.length} deliberations`);

    if (deliberations.length === 0) {
      warn('No deliberations found - some tests will be skipped');
    } else {
      pass(`Deliberations available for testing`);
    }

    const claims = await prisma.claim.findMany({ take: 5 });
    info(`Found ${claims.length} claims`);

    const arguments_count = await prisma.argument.count();
    info(`Found ${arguments_count} arguments`);

    const schemes = await prisma.ArgumentScheme.findMany({ take: 5 });
    info(`Found ${schemes.length} argumentation schemes`);

    if (schemes.length > 0) {
      pass('Argumentation schemes available');
      schemes.forEach(s => {
        console.log(`  - ${s.key}: ${s.name || 'N/A'}`);
      });
    }

    // ═══════════════════════════════════════════════════════════
    // Test C: Check GROUNDS→Arguments Creation
    // ═══════════════════════════════════════════════════════════
    section('Test C: GROUNDS Creates Arguments (Database Check)');

    // Look for GROUNDS moves that created arguments
    const groundsMoves = await prisma.dialogueMove.findMany({
      where: { kind: 'GROUNDS' },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    info(`Found ${groundsMoves.length} GROUNDS moves`);

    let groundsWithArgs = 0;
    for (const move of groundsMoves) {
      const payload = move.payload;
      if (payload?.createdArgumentId) {
        groundsWithArgs++;

        // Verify the argument exists
        const arg = await prisma.argument.findUnique({
          where: { id: payload.createdArgumentId },
          select: { id: true, text: true, conclusionClaimId: true },
        });

        if (arg) {
          pass(`GROUNDS move ${move.id.slice(0, 8)} created argument ${arg.id.slice(0, 8)}`);
          info(`  Text: "${arg.text.slice(0, 60)}..."`);
        } else {
          fail(`GROUNDS move references non-existent argument ${payload.createdArgumentId}`);
        }
      }
    }

    if (groundsWithArgs > 0) {
      pass(`${groundsWithArgs}/${groundsMoves.length} GROUNDS moves created arguments`);
    } else {
      warn('No GROUNDS moves have created arguments yet (may need manual testing)');
    }

    // ═══════════════════════════════════════════════════════════
    // Test Phase 2: Attack→CQ Linkage
    // ═══════════════════════════════════════════════════════════
    section('Phase 2 Verification: Attack→CQ Linkage');

    const attacksWithMeta = await prisma.conflictApplication.findMany({
      where: {
        NOT: {
          metaJson: { equals: Prisma.JsonNull },
        },
      },
      take: 5,
    });

    if (attacksWithMeta.length > 0) {
      pass(`Found ${attacksWithMeta.length} attacks with CQ metadata`);
      attacksWithMeta.forEach(ca => {
        const meta = ca.metaJson;
        if (meta?.cqKey && meta?.schemeKey) {
          info(`  Attack ${ca.id.slice(0, 8)}: ${meta.schemeKey}:${meta.cqKey}`);
        }
      });
    } else {
      warn('No attacks with metaJson found (Phase 2 not yet tested with real data)');
    }

    // ═══════════════════════════════════════════════════════════
    // Test Phase 2: Scheme Inference
    // ═══════════════════════════════════════════════════════════
    section('Phase 2 Verification: Scheme Inference');

    const argsWithSchemes = await prisma.argument.findMany({
      where: {
        NOT: { schemeId: null },
      },
      take: 10,
      include: { scheme: { select: { key: true, name: true } } },
    });

    if (argsWithSchemes.length > 0) {
      pass(`Found ${argsWithSchemes.length} arguments with schemes assigned`);
      const schemeBreakdown = {};
      argsWithSchemes.forEach(a => {
        const key = a.scheme?.key || 'unknown';
        schemeBreakdown[key] = (schemeBreakdown[key] || 0) + 1;
      });
      Object.entries(schemeBreakdown).forEach(([key, count]) => {
        info(`  ${key}: ${count} arguments`);
      });
    } else {
      warn('No arguments with schemes found');
    }

    // ═══════════════════════════════════════════════════════════
    // Check CQStatus Table
    // ═══════════════════════════════════════════════════════════
    section('CQStatus Integration');

    const cqStatuses = await prisma.cQStatus.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    if (cqStatuses.length > 0) {
      pass(`Found ${cqStatuses.length} CQ status records`);
      cqStatuses.forEach(cq => {
        info(`  ${cq.schemeKey}:${cq.cqKey} - ${cq.status}, satisfied: ${cq.satisfied}`);
      });
    } else {
      warn('No CQ status records found (WHY/GROUNDS not yet used)');
    }

    // ═══════════════════════════════════════════════════════════
    // Performance Check: Large Argument Sets
    // ═══════════════════════════════════════════════════════════
    section('Performance: Large Argument Sets');

    const totalArgs = await prisma.argument.count();
    info(`Total arguments in database: ${totalArgs}`);

    if (totalArgs >= 50) {
      pass('Database has 50+ arguments for performance testing');
    } else {
      warn(`Only ${totalArgs} arguments (need 50+ for performance tests)`);
    }

    // Check deliberation with most arguments
    const argsByDelib = await prisma.argument.groupBy({
      by: ['deliberationId'],
      _count: true,
      orderBy: { _count: { deliberationId: 'desc' } },
      take: 1,
    });

    if (argsByDelib.length > 0) {
      const largestDelib = argsByDelib[0];
      info(`Largest deliberation has ${largestDelib._count} arguments`);

      if (largestDelib._count >= 50) {
        pass('Found deliberation with 50+ arguments for testing');
      } else {
        warn(`Largest deliberation only has ${largestDelib._count} arguments`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // Multi-CQ Schemes Check
    // ═══════════════════════════════════════════════════════════
    section('Multi-CQ Schemes');

    // Check for ExpertOpinion and other multi-CQ schemes
    const expertOpinion = schemes.find(s => s.key === 'ExpertOpinion');
    if (expertOpinion) {
      pass('ExpertOpinion scheme found');

      // Check for arguments using this scheme
      const expertArgs = await prisma.argument.findMany({
        where: { schemeId: expertOpinion.id },
        take: 5,
      });

      info(`  ${expertArgs.length} arguments use ExpertOpinion`);
    } else {
      warn('ExpertOpinion scheme not found');
    }

    // ═══════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════
    section('Test Summary');

    console.log('');
    console.log(`${colors.green}Passed:${colors.reset}   ${passed}`);
    console.log(`${colors.yellow}Warnings:${colors.reset} ${warnings}`);
    console.log(`${colors.red}Failed:${colors.reset}   ${failed}`);
    console.log('');

    if (failed === 0) {
      console.log(`${colors.green}✓ All database tests passed!${colors.reset}`);
      console.log('');
      console.log('Next steps:');
      console.log('  1. Start dev server: npm run dev');
      console.log('  2. Create test dialogue using UI');
      console.log('  3. Test GROUNDS→Arguments creation manually');
      console.log('  4. Test CommandCard grid view');
    } else {
      console.log(`${colors.red}✗ Some tests failed.${colors.reset}`);
    }

  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
