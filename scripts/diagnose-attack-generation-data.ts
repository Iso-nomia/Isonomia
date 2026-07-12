/**
 * Diagnostic Script: Attack Generation Data Check
 * 
 * Purpose: Verify what data exists for attack generation to work:
 * 1. Arguments with scheme relations (old vs new system)
 * 2. ArgumentSchemeInstance records (new multi-scheme system)
 * 3. Critical Questions for schemes
 * 4. CQ metadata (burdenOfProof, requiresEvidence, attackType)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface DiagnosticResult {
  section: string;
  status: "✅ GOOD" | "⚠️  WARNING" | "❌ ISSUE";
  details: string[];
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("Attack Generation Data Diagnostic");
  console.log("=".repeat(80) + "\n");

  const results: DiagnosticResult[] = [];

  // ========================================
  // 1. Check Arguments with Schemes
  // ========================================
  console.log("📊 Section 1: Argument-Scheme Relations\n");

  const totalArguments = await prisma.argument.count();
  const argumentsWithOldSchemeId = await prisma.argument.count({
    where: { schemeId: { not: null } },
  });
  const argumentsWithNewSchemeInstances = await prisma.argument.count({
    where: { argumentSchemes: { some: {} } },
  });
  const argumentsWithBoth = await prisma.argument.count({
    where: {
      AND: [
        { schemeId: { not: null } },
        { argumentSchemes: { some: {} } },
      ],
    },
  });
  const argumentsWithNeither = await prisma.argument.count({
    where: {
      AND: [
        { schemeId: null },
        { argumentSchemes: { none: {} } },
      ],
    },
  });

  console.log(`Total Arguments: ${totalArguments}`);
  console.log(`  - With old schemeId field: ${argumentsWithOldSchemeId}`);
  console.log(`  - With new ArgumentSchemeInstance: ${argumentsWithNewSchemeInstances}`);
  console.log(`  - With both: ${argumentsWithBoth}`);
  console.log(`  - With neither: ${argumentsWithNeither}`);

  let schemeStatus: DiagnosticResult["status"] = "✅ GOOD";
  const schemeDetails: string[] = [];

  if (argumentsWithNewSchemeInstances === 0 && argumentsWithOldSchemeId > 0) {
    schemeStatus = "❌ ISSUE";
    schemeDetails.push(`All arguments use OLD system (direct schemeId)`);
    schemeDetails.push(`NEW system (ArgumentSchemeInstance) has 0 records`);
    schemeDetails.push(`Attack generation requires ArgumentSchemeInstance records`);
  } else if (argumentsWithNewSchemeInstances > 0 && argumentsWithOldSchemeId > argumentsWithNewSchemeInstances) {
    schemeStatus = "⚠️  WARNING";
    schemeDetails.push(`Mixed system: ${argumentsWithOldSchemeId - argumentsWithNewSchemeInstances} arguments not migrated`);
  } else if (argumentsWithNewSchemeInstances > 0) {
    schemeStatus = "✅ GOOD";
    schemeDetails.push(`${argumentsWithNewSchemeInstances} arguments use new multi-scheme system`);
  }

  results.push({
    section: "Argument-Scheme Relations",
    status: schemeStatus,
    details: schemeDetails,
  });

  // ========================================
  // 2. Check Test Arguments Specifically
  // ========================================
  console.log("\n📊 Section 2: Test Arguments\n");

  const testArgumentIds = [
    "test-single-space-arg",
    "test-multi-scheme-climate-arg",
  ];

  for (const argId of testArgumentIds) {
    const arg = await prisma.argument.findUnique({
      where: { id: argId },
      include: {
        scheme: true,
        argumentSchemes: {
          include: {
            scheme: {
              include: {
                cqs: true,
              },
            },
          },
        },
      },
    });

    if (!arg) {
      console.log(`❌ Argument "${argId}" not found`);
      continue;
    }

    console.log(`\nArgument: ${argId}`);
    console.log(`  Old schemeId: ${arg.schemeId || "null"}`);
    console.log(`  Old scheme key: ${arg.scheme?.key || "N/A"}`);
    console.log(`  New scheme instances: ${arg.argumentSchemes.length}`);
    
    if (arg.argumentSchemes.length > 0) {
      arg.argumentSchemes.forEach((asi, idx) => {
        console.log(`    [${idx + 1}] ${asi.scheme.key} - ${asi.scheme.cqs.length} CQs`);
      });
    }

    if (arg.scheme && arg.argumentSchemes.length === 0) {
      console.log(`  ⚠️  Has old scheme but no ArgumentSchemeInstance`);
    }
  }

  // ========================================
  // 3. Check Critical Questions
  // ========================================
  console.log("\n📊 Section 3: Critical Questions\n");

  const totalSchemes = await prisma.argumentScheme.count();
  const schemesWithCQs = await prisma.argumentScheme.count({
    where: { cqs: { some: {} } },
  });
  const totalCQs = await prisma.criticalQuestion.count();

  console.log(`Total Schemes: ${totalSchemes}`);
  console.log(`Schemes with CQs: ${schemesWithCQs}`);
  console.log(`Total CQs: ${totalCQs}`);

  let cqStatus: DiagnosticResult["status"] = "✅ GOOD";
  const cqDetails: string[] = [];

  if (totalCQs === 0) {
    cqStatus = "❌ ISSUE";
    cqDetails.push("No Critical Questions in database");
    cqDetails.push("Attack generation requires CQs to suggest attacks");
  } else if (schemesWithCQs < totalSchemes / 2) {
    cqStatus = "⚠️  WARNING";
    cqDetails.push(`Only ${schemesWithCQs}/${totalSchemes} schemes have CQs`);
  } else {
    cqStatus = "✅ GOOD";
    cqDetails.push(`${schemesWithCQs}/${totalSchemes} schemes have CQs defined`);
  }

  results.push({
    section: "Critical Questions",
    status: cqStatus,
    details: cqDetails,
  });

  // ========================================
  // 4. Check CQ Metadata
  // ========================================
  console.log("\n📊 Section 4: CQ Metadata\n");

  // Get sample CQs to check metadata
  const sampleCQs = await prisma.criticalQuestion.findMany({
    take: 10,
    select: {
      id: true,
      cqKey: true,
      burdenOfProof: true,
      attackType: true,
      targetScope: true,
      requiresEvidence: true,
    },
  });

  const cqsWithBurden = sampleCQs.filter(cq => cq.burdenOfProof).length;
  const cqsWithAttackType = sampleCQs.filter(cq => cq.attackType).length;
  const cqsWithTargetScope = sampleCQs.filter(cq => cq.targetScope).length;
  const cqsFullyAnnotated = sampleCQs.filter(cq => 
    cq.burdenOfProof && cq.attackType && cq.targetScope
  ).length;

  console.log(`Sample CQs checked: ${sampleCQs.length}`);
  console.log(`CQs with burdenOfProof: ${cqsWithBurden}/${sampleCQs.length}`);
  console.log(`CQs with attackType: ${cqsWithAttackType}/${sampleCQs.length}`);
  console.log(`CQs with targetScope: ${cqsWithTargetScope}/${sampleCQs.length}`);
  console.log(`CQs fully annotated: ${cqsFullyAnnotated}/${sampleCQs.length}`);

  let metadataStatus: DiagnosticResult["status"] = "✅ GOOD";
  const metadataDetails: string[] = [];

  if (totalCQs > 0 && sampleCQs.length === 0) {
    metadataStatus = "⚠️  WARNING";
    metadataDetails.push("Could not fetch sample CQs to check metadata");
  } else if (cqsFullyAnnotated === 0 && sampleCQs.length > 0) {
    metadataStatus = "❌ ISSUE";
    metadataDetails.push("Sample shows NO CQs have required metadata (burdenOfProof, attackType, targetScope)");
    metadataDetails.push("Attack generation requires these fields to rank and categorize attacks");
  } else if (cqsFullyAnnotated < sampleCQs.length / 2) {
    metadataStatus = "⚠️  WARNING";
    metadataDetails.push(`Only ${cqsFullyAnnotated}/${sampleCQs.length} sample CQs have full metadata`);
  } else {
    metadataStatus = "✅ GOOD";
    metadataDetails.push(`${cqsFullyAnnotated}/${sampleCQs.length} sample CQs have required metadata`);
  }

  results.push({
    section: "CQ Metadata",
    status: metadataStatus,
    details: metadataDetails,
  });

  // ========================================
  // 5. Sample Schemes with CQs
  // ========================================
  console.log("\n📊 Section 5: Sample Schemes with CQs\n");

  const schemesWithCQsDetailed = await prisma.argumentScheme.findMany({
    where: { cqs: { some: {} } },
    include: {
      cqs: {
        select: {
          id: true,
          cqKey: true,
          burdenOfProof: true,
          attackType: true,
          targetScope: true,
          requiresEvidence: true,
        },
      },
    },
    take: 5,
  });

  console.log(`Top 5 schemes with CQs:\n`);
  for (const scheme of schemesWithCQsDetailed) {
    console.log(`${scheme.key} (${scheme.name || "unnamed"})`);
    console.log(`   CQs: ${scheme.cqs.length}`);
    
    const fullyCQs = scheme.cqs.filter((cq: any) => 
      cq.burdenOfProof && cq.attackType && cq.targetScope
    ).length;
    console.log(`   Fully annotated CQs: ${fullyCQs}/${scheme.cqs.length}`);
    
    if (scheme.cqs.length > 0) {
      const sample = scheme.cqs[0];
      console.log(`   Sample CQ: ${sample.cqKey}`);
      console.log(`     - Burden: ${sample.burdenOfProof || "MISSING"}`);
      console.log(`     - AttackType: ${sample.attackType || "MISSING"}`);
      console.log(`     - TargetScope: ${sample.targetScope || "MISSING"}`);
      console.log(`     - RequiresEvidence: ${sample.requiresEvidence}`);
    }
    console.log("");
  }

  // ========================================
  // 6. Check Deliberation Arguments
  // ========================================
  console.log("\n📊 Section 6: Deliberation Arguments\n");

  const ludicsForestArgs = await prisma.argument.findMany({
    where: { deliberationId: "ludics-forest-demo" },
    include: {
      scheme: true,
      argumentSchemes: {
        include: {
          scheme: {
            include: {
              cqs: true,
            },
          },
        },
      },
    },
    take: 5,
  });

  console.log(`Sample arguments from ludics-forest-demo:\n`);
  ludicsForestArgs.forEach((arg, idx) => {
    console.log(`${idx + 1}. ${arg.id.substring(0, 20)}...`);
    console.log(`   Old scheme: ${arg.scheme?.key || "none"}`);
    console.log(`   New schemes: ${arg.argumentSchemes.length}`);
    
    if (arg.argumentSchemes.length > 0) {
      arg.argumentSchemes.forEach((asi) => {
        console.log(`     - ${asi.scheme.key}: ${asi.scheme.cqs.length} CQs`);
      });
    }
    
    const totalCQs = arg.argumentSchemes.reduce((sum, asi) => sum + asi.scheme.cqs.length, 0);
    console.log(`   Total CQs available: ${totalCQs}`);
    console.log("");
  });

  // ========================================
  // Summary
  // ========================================
  console.log("\n" + "=".repeat(80));
  console.log("DIAGNOSTIC SUMMARY");
  console.log("=".repeat(80) + "\n");

  results.forEach((result) => {
    console.log(`${result.status} ${result.section}`);
    result.details.forEach((detail) => {
      console.log(`     ${detail}`);
    });
    console.log("");
  });

  // ========================================
  // Recommendations
  // ========================================
  console.log("=".repeat(80));
  console.log("RECOMMENDATIONS");
  console.log("=".repeat(80) + "\n");

  const hasIssues = results.some((r) => r.status === "❌ ISSUE");
  const hasWarnings = results.some((r) => r.status === "⚠️  WARNING");

  if (hasIssues) {
    console.log("❌ CRITICAL ISSUES FOUND - Attack generation will NOT work\n");
    
    if (argumentsWithNewSchemeInstances === 0 && argumentsWithOldSchemeId > 0) {
      console.log("1. Run migration script to create ArgumentSchemeInstance records:");
      console.log("   npx tsx scripts/migrate-argument-schemes.ts\n");
    }
    
    if (totalCQs === 0) {
      console.log("2. Seed Critical Questions for schemes:");
      console.log("   npx tsx scripts/seed-scheme-cqs.ts\n");
    }
    
    if (cqsFullyAnnotated === 0 && totalCQs > 0) {
      console.log("3. Annotate CQs with metadata:");
      console.log("   npx tsx scripts/annotate-cq-metadata.ts\n");
    }
  } else if (hasWarnings) {
    console.log("⚠️  WARNINGS FOUND - Attack generation will work partially\n");
    console.log("Consider running migration/seeding scripts to improve coverage.\n");
  } else {
    console.log("✅ ALL CHECKS PASSED - Attack generation should work!\n");
    console.log("If you're still seeing empty suggestions, check:");
    console.log("1. The specific argument ID you're testing");
    console.log("2. API logs for errors in ArgumentGenerationService");
    console.log("3. Browser console for network errors\n");
  }

  console.log("=".repeat(80) + "\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Diagnostic script error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
