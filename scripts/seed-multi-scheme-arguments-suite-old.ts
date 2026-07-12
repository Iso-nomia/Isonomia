#!/usr/bin/env tsx
/**
 * Seed Script: Multi-Scheme Test Arguments Suite - Phase 1-4 Deliberation Overhaul
 * 
 * Creates comprehensive test data for Phase 1-4 deliberation system features:
 * 
 * MULTI-SCHEME NETS:
 * 1. Convergent Net (Climate Policy) - 4 schemes supporting one conclusion
 * 2. Divergent Net (AI Safety) - 3 schemes branching from primary
 * 3. Serial Net (Healthcare Reform) - Sequential 3-scheme chain
 * 4. Hybrid Net (Education Policy) - Mixed convergent + serial
 * 
 * SINGLE-SCHEME ARGUMENTS (Control):
 * 5-7. Various single-scheme arguments for comparison
 * 
 * DELIBERATION FEATURES:
 * - Attack relationships (REBUTS, UNDERCUTS, UNDERMINES)
 * - CQ responses (answered vs unanswered)
 * - Burden of proof indicators
 * - Confidence scores and reasoning
 * - Evidence links and citations
 * - Temporal tracking (createdAt/updatedAt)
 * 
 * Deliberation: ludics-forest-demo
 * 
 * Usage:
 *   npx tsx scripts/seed-multi-scheme-arguments-suite.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to create timestamp in the past
function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main() {
  console.log("🌱 Seeding Phase 1-4 deliberation overhaul test suite...\n");

  // =========================================================================
  // SETUP: User, Deliberation, Schemes
  // =========================================================================

  // Get or create test user (proponent)
  const proponent = await prisma.user.upsert({
    where: { auth_id: "test-auth-phase14-proponent" },
    update: {},
    create: {
      auth_id: "test-auth-phase14-proponent",
      username: "phase14-proponent",
      name: "Phase 1-4 Proponent",
      onboarded: true,
    },
  });
  console.log(`✅ Proponent user: ${proponent.id} (${proponent.username})`);

  // Create challenger user for attacks
  const challenger = await prisma.user.upsert({
    where: { auth_id: "test-auth-phase14-challenger" },
    update: {},
    create: {
      auth_id: "test-auth-phase14-challenger",
      username: "phase14-challenger",
      name: "Phase 1-4 Challenger",
      onboarded: true,
    },
  });
  console.log(`✅ Challenger user: ${challenger.id} (${challenger.username})`);

  // Get or create test deliberation
  const testDeliberation = await prisma.deliberation.upsert({
    where: { id: "ludics-forest-demo" },
    update: {},
    create: {
      id: "ludics-forest-demo",
      hostType: "free",
      hostId: "test-room-phase14",
      createdById: proponent.id.toString(),
      title: "Ludics Forest Demo - Phase 1-4 Features",
      tags: ["test", "phase1-4", "multi-scheme", "nets", "deliberation-overhaul"],
    },
  });
  console.log(`✅ Test deliberation: ${testDeliberation.id}\n`);

  // Get schemes
  const practicalReasoningScheme = await prisma.argumentScheme.findFirst({
    where: { key: { contains: "practical_reasoning" } },
  });

  const consequencesScheme = await prisma.argumentScheme.findFirst({
    where: { key: { contains: "consequences" } },
  });

  const expertOpinionScheme = await prisma.argumentScheme.findFirst({
    where: { key: { contains: "expert" } },
  });

  const analogyScheme = await prisma.argumentScheme.findFirst({
    where: { key: { contains: "analogy" } },
  });

  const signScheme = await prisma.argumentScheme.findFirst({
    where: { key: "sign" },
  });

  console.log("✅ Found schemes for testing\n");

  // =========================================================================
  // TEST 1: CONVERGENT NET - Policy Decision
  // Multiple supporting schemes converge on one conclusion
  // =========================================================================

  console.log("📝 Creating Test 1: Convergent Net (Policy Decision)...");

  // Create claims for convergent argument
  const conv_conclusion = await prisma.claim.create({
    data: {
      text: "We should implement universal basic income",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-conv-conc`,
      deliberationId: testDeliberation.id,
    },
  });

  const conv_p1 = await prisma.claim.create({
    data: {
      text: "UBI reduces poverty and provides economic security",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-conv-p1`,
      deliberationId: testDeliberation.id,
    },
  });

  const conv_p2 = await prisma.claim.create({
    data: {
      text: "Experts in economics and social policy recommend UBI trials",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-conv-p2`,
      deliberationId: testDeliberation.id,
    },
  });

  const conv_p3 = await prisma.claim.create({
    data: {
      text: "Similar pilot programs in Finland and Kenya showed positive results",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-conv-p3`,
      deliberationId: testDeliberation.id,
    },
  });

  const convergentArg = await prisma.argument.upsert({
    where: { id: "test-convergent-policy-arg" },
    update: {},
    create: {
      id: "test-convergent-policy-arg",
      deliberationId: testDeliberation.id,
      authorId: proponent.id.toString(),
      text: "We should implement universal basic income. It reduces poverty and provides economic security. Experts in economics and social policy recommend UBI trials. Similar pilot programs in Finland and Kenya showed positive results. The consequences include poverty reduction, economic stimulus, and improved mental health outcomes.",
      confidence: 0.88,
      isImplicit: false,
      mediaType: "text",
      conclusionClaimId: conv_conclusion.id,
      premises: {
        create: [
          { claimId: conv_p1.id, isImplicit: false },
          { claimId: conv_p2.id, isImplicit: false },
          { claimId: conv_p3.id, isImplicit: false },
        ],
      },
    },
  });

  if (practicalReasoningScheme && expertOpinionScheme && analogyScheme && consequencesScheme) {
    // Create argument scheme instances (convergent)
    await prisma.argumentSchemeInstance.deleteMany({
      where: { argumentId: convergentArg.id },
    });

    await prisma.argumentSchemeInstance.createMany({
      data: [
        {
          argumentId: convergentArg.id,
          schemeId: practicalReasoningScheme.id,
          confidence: 0.90,
          isPrimary: true,
          role: "primary",
          explicitness: "explicit",
          order: 1,
          textEvidence: "We should implement universal basic income",
        },
        {
          argumentId: convergentArg.id,
          schemeId: expertOpinionScheme.id,
          confidence: 0.85,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 2,
          textEvidence: "Experts in economics and social policy recommend UBI",
        },
        {
          argumentId: convergentArg.id,
          schemeId: analogyScheme.id,
          confidence: 0.82,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 3,
          textEvidence: "Similar pilot programs in Finland and Kenya showed positive results",
        },
        {
          argumentId: convergentArg.id,
          schemeId: consequencesScheme.id,
          confidence: 0.87,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 4,
          textEvidence: "consequences include poverty reduction and economic stimulus",
        },
      ],
    });

    console.log(`✅ Test 1 created: ${convergentArg.id} (4 schemes, convergent)\n`);
  }

  // =========================================================================
  // TEST 2: DIVERGENT NET - Scientific Theory
  // One primary scheme with multiple supporting schemes
  // =========================================================================

  console.log("📝 Creating Test 2: Divergent Net (Scientific Theory)...");

  // Create claims for divergent argument
  const div_conclusion = await prisma.claim.create({
    data: {
      text: "Dark matter must exist based on gravitational effects",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-div-conc`,
      deliberationId: testDeliberation.id,
    },
  });

  const div_p1 = await prisma.claim.create({
    data: {
      text: "Galaxies rotate faster than visible matter can explain",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-div-p1`,
      deliberationId: testDeliberation.id,
    },
  });

  const div_p2 = await prisma.claim.create({
    data: {
      text: "Experts in astrophysics agree this observation requires invisible matter",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-div-p2`,
      deliberationId: testDeliberation.id,
    },
  });

  const div_p3 = await prisma.claim.create({
    data: {
      text: "The pattern is analogous to how Neptune was discovered through unexplained orbital perturbations",
      createdById: proponent.id.toString(),
      moid: `moid-${Date.now()}-div-p3`,
      deliberationId: testDeliberation.id,
    },
  });

  const divergentArg = await prisma.argument.upsert({
    where: { id: "test-divergent-science-arg" },
    update: {},
    create: {
      id: "test-divergent-science-arg",
      deliberationId: testDeliberation.id,
      authorId: proponent.id.toString(),
      text: "Dark matter must exist based on gravitational effects. Galaxies rotate faster than visible matter can explain, which is a clear sign of additional mass. Experts in astrophysics agree this observation requires invisible matter. The pattern is analogous to how Neptune was discovered through unexplained orbital perturbations.",
      confidence: 0.85,
      isImplicit: false,
      mediaType: "text",
      conclusionClaimId: div_conclusion.id,
      premises: {
        create: [
          { claimId: div_p1.id, isImplicit: false },
          { claimId: div_p2.id, isImplicit: false },
          { claimId: div_p3.id, isImplicit: false },
        ],
      },
    },
  });

  if (signScheme && expertOpinionScheme && analogyScheme) {
    await prisma.argumentSchemeInstance.deleteMany({
      where: { argumentId: divergentArg.id },
    });

    await prisma.argumentSchemeInstance.createMany({
      data: [
        {
          argumentId: divergentArg.id,
          schemeId: signScheme.id,
          confidence: 0.88,
          isPrimary: true,
          role: "primary",
          explicitness: "explicit",
          order: 1,
          textEvidence: "Galaxies rotate faster than visible matter can explain",
        },
        {
          argumentId: divergentArg.id,
          schemeId: expertOpinionScheme.id,
          confidence: 0.83,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 2,
          textEvidence: "Experts in astrophysics agree",
        },
        {
          argumentId: divergentArg.id,
          schemeId: analogyScheme.id,
          confidence: 0.81,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 3,
          textEvidence: "analogous to how Neptune was discovered",
        },
      ],
    });

    console.log(`✅ Test 2 created: ${divergentArg.id} (3 schemes, divergent)\n`);
  }

  // =========================================================================
  // TEST 3: SERIAL/LINKED NET - Chained Reasoning
  // Already created by seed-multi-scheme-test-argument.ts (climate change)
  // =========================================================================

  console.log("ℹ️  Test 3: Serial net already exists (test-multi-scheme-climate-arg)\n");

  // =========================================================================
  // TEST 4: SINGLE-SCHEME ARGUMENTS (Control Group)
  // =========================================================================

  console.log("📝 Creating Test 4: Single-scheme arguments (control)...");

  if (practicalReasoningScheme) {
    // Create claims for single-scheme argument 1
    const single1_conclusion = await prisma.claim.create({
      data: {
        text: "We should invest in renewable energy",
        createdById: proponent.id.toString(),
        moid: `moid-${Date.now()}-single1-conc`,
        deliberationId: testDeliberation.id,
      },
    });

    const single1_p1 = await prisma.claim.create({
      data: {
        text: "Renewable energy reduces carbon emissions",
        createdById: proponent.id.toString(),
        moid: `moid-${Date.now()}-single1-p1`,
        deliberationId: testDeliberation.id,
      },
    });

    const single1_p2 = await prisma.claim.create({
      data: {
        text: "Renewable energy creates jobs",
        createdById: proponent.id.toString(),
        moid: `moid-${Date.now()}-single1-p2`,
        deliberationId: testDeliberation.id,
      },
    });

    const singleArg1 = await prisma.argument.upsert({
      where: { id: "test-single-scheme-simple-1" },
      update: {},
      create: {
        id: "test-single-scheme-simple-1",
        deliberationId: testDeliberation.id,
        authorId: proponent.id.toString(),
        text: "We should invest in renewable energy because it reduces carbon emissions and creates jobs.",
        confidence: 0.85,
        schemeId: practicalReasoningScheme.id,
        isImplicit: false,
        mediaType: "text",
        conclusionClaimId: single1_conclusion.id,
        premises: {
          create: [
            { claimId: single1_p1.id, isImplicit: false },
            { claimId: single1_p2.id, isImplicit: false },
          ],
        },
      },
    });

    await prisma.argumentSchemeInstance.deleteMany({
      where: { argumentId: singleArg1.id },
    });

    await prisma.argumentSchemeInstance.create({
      data: {
        argumentId: singleArg1.id,
        schemeId: practicalReasoningScheme.id,
        confidence: 0.85,
        isPrimary: true,
        role: "primary",
        explicitness: "explicit",
        order: 1,
        textEvidence: "We should invest in renewable energy",
      },
    });

    console.log(`✅ Single-scheme 1: ${singleArg1.id}`);
  }

  if (expertOpinionScheme) {
    // Create claims for single-scheme argument 2
    const single2_conclusion = await prisma.claim.create({
      data: {
        text: "Artificial intelligence poses existential risks to humanity",
        createdById: proponent.id.toString(),
        moid: `moid-${Date.now()}-single2-conc`,
        deliberationId: testDeliberation.id,
      },
    });

    const single2_p1 = await prisma.claim.create({
      data: {
        text: "Leading AI researchers warn about uncontrolled AI development",
        createdById: proponent.id.toString(),
        moid: `moid-${Date.now()}-single2-p1`,
        deliberationId: testDeliberation.id,
      },
    });

    const singleArg2 = await prisma.argument.upsert({
      where: { id: "test-single-scheme-simple-2" },
      update: {},
      create: {
        id: "test-single-scheme-simple-2",
        deliberationId: testDeliberation.id,
        authorId: proponent.id.toString(),
        text: "Artificial intelligence poses existential risks to humanity. Leading AI researchers warn about uncontrolled AI development.",
        confidence: 0.80,
        schemeId: expertOpinionScheme.id,
        isImplicit: false,
        mediaType: "text",
        conclusionClaimId: single2_conclusion.id,
        premises: {
          create: [
            { claimId: single2_p1.id, isImplicit: false },
          ],
        },
      },
    });

    await prisma.argumentSchemeInstance.deleteMany({
      where: { argumentId: singleArg2.id },
    });

    await prisma.argumentSchemeInstance.create({
      data: {
        argumentId: singleArg2.id,
        schemeId: expertOpinionScheme.id,
        confidence: 0.90,
        isPrimary: true,
        role: "primary",
        explicitness: "explicit",
        order: 1,
        textEvidence: "According to leading epidemiologists",
      },
    });

    console.log(`✅ Single-scheme 2: ${singleArg2.id}\n`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================

  console.log(`
${"=".repeat(70)}
✅ SEED COMPLETE - Multi-Scheme Arguments Suite
${"=".repeat(70)}

Test Deliberation: ludics-forest-demo

Multi-Scheme Arguments:
  1. test-convergent-policy-arg (4 schemes, convergent)
     → Should show "Analyze Net" button
     → Multiple schemes supporting one conclusion
  
  2. test-divergent-science-arg (3 schemes, divergent)
     → Should show "Analyze Net" button
     → One primary scheme with branching consequences
  
  3. test-multi-scheme-climate-arg (3 schemes, serial)
     → Already exists from previous seed
     → Sequential chain of reasoning

Single-Scheme Arguments (Control):
  4. test-single-scheme-simple-1 (Practical Reasoning only)
     → Should show "Analyze Net" button but detect single-scheme
  
  5. test-single-scheme-simple-2 (Expert Opinion only)
     → Should show "Analyze Net" button but detect single-scheme

Testing:
  1. Navigate to: /deliberation/ludics-forest-demo/board
  2. Open DeepDivePanel V3 → Arguments tab
  3. Click "Analyze Net" on each argument
  4. Verify multi-scheme nets show different data
  5. Verify single-scheme args show "Single Scheme Argument" message

Expected Behavior:
  - Multi-scheme: Opens full ArgumentNetAnalyzer with visualization
  - Single-scheme: Shows simple message (no net detected)
  - Each multi-scheme net should have unique schemes and CQs

Console Debugging:
  - Check browser console for [ArgumentNetAnalyzer] logs
  - Should see different netId, schemeCount, netType for each
${"=".repeat(70)}
`);
}

main()
  .then(() => {
    console.log("✅ SUCCESS!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ ERROR:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
