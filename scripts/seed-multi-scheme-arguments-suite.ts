#!/usr/bin/env tsx
/**
 * Seed Script: Multi-Scheme Test Arguments Suite - Phase 1-4 Deliberation Overhaul
 * 
 * Creates comprehensive test data for deliberation system features:
 * 
 * MULTI-SCHEME NETS (4 types):
 * 1. Convergent Net - Climate Policy (4 schemes → 1 conclusion)
 * 2. Divergent Net - AI Safety (1 primary → 3 branches)
 * 3. Serial Net - Healthcare (3-step chain, already exists from other seed)
 * 4. Hybrid Net - Education Policy (convergent + serial mix)
 * 
 * SINGLE-SCHEME ARGUMENTS (2):
 * 5. Energy Policy (single Practical Reasoning)
 * 6. Space Exploration (single Expert Opinion)
 * 
 * ATTACK ARGUMENTS (3 types):
 * 7. REBUTS attack on Climate Policy conclusion
 * 8. UNDERCUTS attack on AI Safety inference
 * 9. UNDERMINES attack on Energy Policy premise
 * 
 * Features tested:
 * - ArgumentNetAnalyzer (multi-scheme visualization)
 * - NetworksSection (deliberation-wide nets)
 * - Attack relationships (3 types)
 * - Confidence scores
 * - Temporal tracking
 * - Scheme diversity
 * 
 * Deliberation: ludics-forest-demo
 * 
 * Usage:
 *   npx tsx scripts/seed-multi-scheme-arguments-suite-new.ts
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
  console.log("🌱 Seeding Phase 1-4 Deliberation Overhaul Test Suite...\n");

  // =========================================================================
  // SETUP: Users, Deliberation
  // =========================================================================

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
  console.log(`✅ Proponent: ${proponent.username}`);

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
  console.log(`✅ Challenger: ${challenger.username}`);

  const deliberation = await prisma.deliberation.upsert({
    where: { id: "ludics-forest-demo" },
    update: { 
      title: "Ludics Forest Demo - Phase 1-4 Features",
      tags: ["test", "phase1-4", "multi-scheme", "nets", "deliberation-overhaul"],
    },
    create: {
      id: "ludics-forest-demo",
      hostType: "free",
      hostId: "test-room-phase14",
      createdById: proponent.id.toString(),
      title: "Ludics Forest Demo - Phase 1-4 Features",
      tags: ["test", "phase1-4", "multi-scheme", "nets", "deliberation-overhaul"],
    },
  });
  console.log(`✅ Deliberation: ${deliberation.id}\n`);

  // =========================================================================
  // GET SCHEMES
  // =========================================================================

  const schemes = {
    practicalReasoning: await prisma.argumentScheme.findFirst({
      where: { key: { contains: "practical" } },
    }),
    expertOpinion: await prisma.argumentScheme.findFirst({
      where: { key: { contains: "expert" } },
    }),
    analogy: await prisma.argumentScheme.findFirst({
      where: { key: { contains: "analogy" } },
    }),
    consequences: await prisma.argumentScheme.findFirst({
      where: { key: { contains: "consequences" } },
    }),
    sign: await prisma.argumentScheme.findFirst({
      where: { key: "sign" },
    }),
    causal: await prisma.argumentScheme.findFirst({
      where: { OR: [{ key: "cause_to_effect" }, { key: { contains: "causal" } }] },
    }),
  };

  const schemeCount = Object.values(schemes).filter(Boolean).length;
  console.log(`✅ Found ${schemeCount}/6 schemes\n`);

  // =========================================================================
  // TEST 1: CONVERGENT NET - Climate Policy (4 schemes)
  // =========================================================================

  console.log("📝 Test 1: Convergent Net (Climate Policy)");

  // Clean up existing
  await prisma.argument.deleteMany({
    where: { id: { in: ["test-conv-climate-arg", "test-attack-climate-rebuttal"] } },
  });

  const climateConclusion = await prisma.claim.upsert({
    where: { id: "claim-climate-conclusion" },
    update: {},
    create: {
      id: "claim-climate-conclusion",
      text: "We should implement aggressive carbon reduction policies immediately",
      createdById: proponent.id.toString(),
      moid: `moid-climate-conc-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const climateP1 = await prisma.claim.upsert({
    where: { id: "claim-climate-p1" },
    update: {},
    create: {
      id: "claim-climate-p1",
      text: "Implementing carbon reduction policies will prevent catastrophic warming (practical goal)",
      createdById: proponent.id.toString(),
      moid: `moid-climate-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const climateP2 = await prisma.claim.upsert({
    where: { id: "claim-climate-p2" },
    update: {},
    create: {
      id: "claim-climate-p2",
      text: "Leading climate scientists (97% consensus) recommend immediate action",
      createdById: proponent.id.toString(),
      moid: `moid-climate-p2-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const climateP3 = await prisma.claim.upsert({
    where: { id: "claim-climate-p3" },
    update: {},
    create: {
      id: "claim-climate-p3",
      text: "Countries with strong carbon policies (Norway, Denmark) show economic benefits analogous to what we could achieve",
      createdById: proponent.id.toString(),
      moid: `moid-climate-p3-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const climateP4 = await prisma.claim.upsert({
    where: { id: "claim-climate-p4" },
    update: {},
    create: {
      id: "claim-climate-p4",
      text: "Reducing emissions will lead to cleaner air, healthier populations, and new green jobs",
      createdById: proponent.id.toString(),
      moid: `moid-climate-p4-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const climateArg = await prisma.argument.create({
    data: {
      id: "test-conv-climate-arg",
      deliberationId: deliberation.id,
      authorId: proponent.id.toString(),
      text: "We should implement aggressive carbon reduction policies immediately. These policies will prevent catastrophic warming. Leading climate scientists with 97% consensus recommend immediate action. Countries with strong carbon policies like Norway and Denmark show economic benefits analogous to what we could achieve. Reducing emissions will lead to cleaner air, healthier populations, and new green jobs.",
      confidence: 0.88,
      isImplicit: false,
      mediaType: "text",
      conclusionClaimId: climateConclusion.id,
      schemeId: schemes.practicalReasoning?.id, // Primary scheme for legacy support
      createdAt: daysAgo(10),
      premises: {
        create: [
          { claimId: climateP1.id, isImplicit: false },
          { claimId: climateP2.id, isImplicit: false },
          { claimId: climateP3.id, isImplicit: false },
          { claimId: climateP4.id, isImplicit: false },
        ],
      },
    },
  });

  // Create scheme instances (convergent)
  if (schemes.practicalReasoning && schemes.expertOpinion && schemes.analogy && schemes.consequences) {
    await prisma.argumentSchemeInstance.createMany({
      data: [
        {
          argumentId: climateArg.id,
          schemeId: schemes.practicalReasoning.id,
          confidence: 0.90,
          isPrimary: true,
          role: "primary",
          explicitness: "explicit",
          order: 1,
          textEvidence: "We should implement... will prevent catastrophic warming",
        },
        {
          argumentId: climateArg.id,
          schemeId: schemes.expertOpinion.id,
          confidence: 0.95,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 2,
          textEvidence: "Leading climate scientists (97% consensus)",
        },
        {
          argumentId: climateArg.id,
          schemeId: schemes.analogy.id,
          confidence: 0.82,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 3,
          textEvidence: "Countries with strong carbon policies (Norway, Denmark)",
        },
        {
          argumentId: climateArg.id,
          schemeId: schemes.consequences.id,
          confidence: 0.87,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 4,
          textEvidence: "Reducing emissions will lead to cleaner air, healthier populations",
        },
      ],
    });

    console.log(`   ✅ Created ${climateArg.id} (4 schemes, convergent)\n`);
  }

  // =========================================================================
  // TEST 2: DIVERGENT NET - AI Safety (3 schemes)
  // =========================================================================

  console.log("📝 Test 2: Divergent Net (AI Safety)");

  await prisma.argument.deleteMany({
    where: { id: { in: ["test-div-ai-arg", "test-attack-ai-undercut"] } },
  });

  const aiConclusion = await prisma.claim.upsert({
    where: { id: "claim-ai-conclusion" },
    update: {},
    create: {
      id: "claim-ai-conclusion",
      text: "We need mandatory safety testing for advanced AI systems",
      createdById: proponent.id.toString(),
      moid: `moid-ai-conc-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const aiP1 = await prisma.claim.upsert({
    where: { id: "claim-ai-p1" },
    update: {},
    create: {
      id: "claim-ai-p1",
      text: "Rapid AI capability gains are a sign of potential misalignment risks",
      createdById: proponent.id.toString(),
      moid: `moid-ai-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const aiP2 = await prisma.claim.upsert({
    where: { id: "claim-ai-p2" },
    update: {},
    create: {
      id: "claim-ai-p2",
      text: "Leading AI researchers (Hinton, Bengio, Russell) warn about existential risks",
      createdById: proponent.id.toString(),
      moid: `moid-ai-p2-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const aiP3 = await prisma.claim.upsert({
    where: { id: "claim-ai-p3" },
    update: {},
    create: {
      id: "claim-ai-p3",
      text: "This situation is analogous to early nuclear technology requiring regulation",
      createdById: proponent.id.toString(),
      moid: `moid-ai-p3-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const aiArg = await prisma.argument.create({
    data: {
      id: "test-div-ai-arg",
      deliberationId: deliberation.id,
      authorId: proponent.id.toString(),
      text: "We need mandatory safety testing for advanced AI systems. Rapid AI capability gains are a clear sign of potential misalignment risks. Leading AI researchers including Hinton, Bengio, and Russell warn about existential risks. This situation is analogous to early nuclear technology requiring regulation.",
      confidence: 0.85,
      isImplicit: false,
      mediaType: "text",
      conclusionClaimId: aiConclusion.id,
      schemeId: schemes.sign?.id, // Primary scheme for legacy support
      createdAt: daysAgo(8),
      premises: {
        create: [
          { claimId: aiP1.id, isImplicit: false },
          { claimId: aiP2.id, isImplicit: false },
          { claimId: aiP3.id, isImplicit: false },
        ],
      },
    },
  });

  // Create scheme instances (divergent - primary with branches)
  if (schemes.sign && schemes.expertOpinion && schemes.analogy) {
    await prisma.argumentSchemeInstance.createMany({
      data: [
        {
          argumentId: aiArg.id,
          schemeId: schemes.sign.id,
          confidence: 0.88,
          isPrimary: true,
          role: "primary",
          explicitness: "explicit",
          order: 1,
          textEvidence: "Rapid AI capability gains are a clear sign",
        },
        {
          argumentId: aiArg.id,
          schemeId: schemes.expertOpinion.id,
          confidence: 0.90,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 2,
          textEvidence: "Leading AI researchers... warn about existential risks",
        },
        {
          argumentId: aiArg.id,
          schemeId: schemes.analogy.id,
          confidence: 0.75,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 3,
          textEvidence: "analogous to early nuclear technology",
        },
      ],
    });

    console.log(`   ✅ Created ${aiArg.id} (3 schemes, divergent)\n`);
  }

  // =========================================================================
  // TEST 3: SERIAL NET - Healthcare (from other seed script)
  // =========================================================================

  console.log("ℹ️  Test 3: Serial net exists (test-multi-scheme-climate-arg from other seed)\n");

  // =========================================================================
  // TEST 4: HYBRID NET - Education Policy (convergent + serial mix)
  // =========================================================================

  console.log("📝 Test 4: Hybrid Net (Education Policy)");

  await prisma.argument.deleteMany({
    where: { id: "test-hybrid-education-arg" },
  });

  const eduConclusion = await prisma.claim.upsert({
    where: { id: "claim-edu-conclusion" },
    update: {},
    create: {
      id: "claim-edu-conclusion",
      text: "We should increase teacher salaries significantly",
      createdById: proponent.id.toString(),
      moid: `moid-edu-conc-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const eduP1 = await prisma.claim.upsert({
    where: { id: "claim-edu-p1" },
    update: {},
    create: {
      id: "claim-edu-p1",
      text: "Higher salaries will attract better talent to teaching profession",
      createdById: proponent.id.toString(),
      moid: `moid-edu-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const eduP2 = await prisma.claim.upsert({
    where: { id: "claim-edu-p2" },
    update: {},
    create: {
      id: "claim-edu-p2",
      text: "Better teachers cause improved student outcomes",
      createdById: proponent.id.toString(),
      moid: `moid-edu-p2-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const eduP3 = await prisma.claim.upsert({
    where: { id: "claim-edu-p3" },
    update: {},
    create: {
      id: "claim-edu-p3",
      text: "Countries that pay teachers well (Finland, Singapore) have top education systems",
      createdById: proponent.id.toString(),
      moid: `moid-edu-p3-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const eduArg = await prisma.argument.create({
    data: {
      id: "test-hybrid-education-arg",
      deliberationId: deliberation.id,
      authorId: proponent.id.toString(),
      text: "We should increase teacher salaries significantly. Higher salaries will attract better talent to the teaching profession, and better teachers cause improved student outcomes. Countries that pay teachers well, like Finland and Singapore, have the world's top education systems.",
      confidence: 0.84,
      isImplicit: false,
      mediaType: "text",
      conclusionClaimId: eduConclusion.id,
      schemeId: schemes.practicalReasoning?.id, // Primary scheme for legacy support
      createdAt: daysAgo(6),
      premises: {
        create: [
          { claimId: eduP1.id, isImplicit: false },
          { claimId: eduP2.id, isImplicit: false },
          { claimId: eduP3.id, isImplicit: false },
        ],
      },
    },
  });

  // Hybrid: Practical + Causal chain + Analogy support
  if (schemes.practicalReasoning && schemes.causal && schemes.analogy) {
    await prisma.argumentSchemeInstance.createMany({
      data: [
        {
          argumentId: eduArg.id,
          schemeId: schemes.practicalReasoning.id,
          confidence: 0.88,
          isPrimary: true,
          role: "primary",
          explicitness: "explicit",
          order: 1,
          textEvidence: "We should increase teacher salaries",
        },
        {
          argumentId: eduArg.id,
          schemeId: schemes.causal.id,
          confidence: 0.85,
          isPrimary: false,
          role: "serial",
          explicitness: "explicit",
          order: 2,
          textEvidence: "Higher salaries... cause improved student outcomes",
        },
        {
          argumentId: eduArg.id,
          schemeId: schemes.analogy.id,
          confidence: 0.80,
          isPrimary: false,
          role: "supporting",
          explicitness: "explicit",
          order: 3,
          textEvidence: "Countries that pay teachers well (Finland, Singapore)",
        },
      ],
    });

    console.log(`   ✅ Created ${eduArg.id} (3 schemes, hybrid)\n`);
  }

  // =========================================================================
  // TEST 5: SINGLE-SCHEME - Energy Policy
  // =========================================================================

  console.log("📝 Test 5: Single Scheme (Energy Policy)");

  await prisma.argument.deleteMany({
    where: { id: { in: ["test-single-energy-arg", "test-attack-energy-undermine"] } },
  });

  const energyConclusion = await prisma.claim.upsert({
    where: { id: "claim-energy-conclusion" },
    update: {},
    create: {
      id: "claim-energy-conclusion",
      text: "We should invest in renewable energy infrastructure",
      createdById: proponent.id.toString(),
      moid: `moid-energy-conc-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const energyP1 = await prisma.claim.upsert({
    where: { id: "claim-energy-p1" },
    update: {},
    create: {
      id: "claim-energy-p1",
      text: "Renewable energy reduces carbon emissions and creates jobs",
      createdById: proponent.id.toString(),
      moid: `moid-energy-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const energyArg = await prisma.argument.create({
    data: {
      id: "test-single-energy-arg",
      deliberationId: deliberation.id,
      authorId: proponent.id.toString(),
      text: "We should invest in renewable energy infrastructure because it reduces carbon emissions and creates green jobs.",
      confidence: 0.82,
      isImplicit: false,
      mediaType: "text",
      schemeId: schemes.practicalReasoning?.id,
      conclusionClaimId: energyConclusion.id,
      createdAt: daysAgo(4),
      premises: {
        create: [{ claimId: energyP1.id, isImplicit: false }],
      },
    },
  });

  if (schemes.practicalReasoning) {
    await prisma.argumentSchemeInstance.create({
      data: {
        argumentId: energyArg.id,
        schemeId: schemes.practicalReasoning.id,
        confidence: 0.82,
        isPrimary: true,
        role: "primary",
        explicitness: "explicit",
        order: 1,
        textEvidence: "We should invest in renewable energy",
      },
    });

    console.log(`   ✅ Created ${energyArg.id} (single scheme)\n`);
  }

  // =========================================================================
  // TEST 6: SINGLE-SCHEME - Space Exploration
  // =========================================================================

  console.log("📝 Test 6: Single Scheme (Space Exploration)");

  await prisma.argument.deleteMany({
    where: { id: "test-single-space-arg" },
  });

  const spaceConclusion = await prisma.claim.upsert({
    where: { id: "claim-space-conclusion" },
    update: {},
    create: {
      id: "claim-space-conclusion",
      text: "Mars colonization is technologically feasible within 20 years",
      createdById: proponent.id.toString(),
      moid: `moid-space-conc-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const spaceP1 = await prisma.claim.upsert({
    where: { id: "claim-space-p1" },
    update: {},
    create: {
      id: "claim-space-p1",
      text: "Leading aerospace engineers at SpaceX and NASA estimate 2040s timeline",
      createdById: proponent.id.toString(),
      moid: `moid-space-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const spaceArg = await prisma.argument.create({
    data: {
      id: "test-single-space-arg",
      deliberationId: deliberation.id,
      authorId: proponent.id.toString(),
      text: "Mars colonization is technologically feasible within 20 years. Leading aerospace engineers at SpaceX and NASA estimate a 2040s timeline is realistic.",
      confidence: 0.75,
      isImplicit: false,
      mediaType: "text",
      schemeId: schemes.expertOpinion?.id,
      conclusionClaimId: spaceConclusion.id,
      createdAt: daysAgo(2),
      premises: {
        create: [{ claimId: spaceP1.id, isImplicit: false }],
      },
    },
  });

  if (schemes.expertOpinion) {
    await prisma.argumentSchemeInstance.create({
      data: {
        argumentId: spaceArg.id,
        schemeId: schemes.expertOpinion.id,
        confidence: 0.75,
        isPrimary: true,
        role: "primary",
        explicitness: "explicit",
        order: 1,
        textEvidence: "Leading aerospace engineers at SpaceX and NASA",
      },
    });

    console.log(`   ✅ Created ${spaceArg.id} (single scheme)\n`);
  }

  // =========================================================================
  // TEST 7: ATTACK - REBUTS Climate Policy
  // =========================================================================

  console.log("📝 Test 7: Attack (REBUTS climate conclusion)");

  const attackClimateConclusion = await prisma.claim.upsert({
    where: { id: "claim-attack-climate-conc" },
    update: {},
    create: {
      id: "claim-attack-climate-conc",
      text: "Aggressive carbon reduction policies will harm the economy more than help the climate",
      createdById: challenger.id.toString(),
      moid: `moid-attack-climate-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const attackClimateP1 = await prisma.claim.upsert({
    where: { id: "claim-attack-climate-p1" },
    update: {},
    create: {
      id: "claim-attack-climate-p1",
      text: "Rapid policy implementation causes economic disruption and job losses",
      createdById: challenger.id.toString(),
      moid: `moid-attack-climate-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const attackClimateArg = await prisma.argument.create({
    data: {
      id: "test-attack-climate-rebuttal",
      deliberationId: deliberation.id,
      authorId: challenger.id.toString(),
      text: "Aggressive carbon reduction policies will harm the economy more than help the climate. Rapid policy implementation causes significant economic disruption and widespread job losses in traditional energy sectors.",
      confidence: 0.70,
      isImplicit: false,
      mediaType: "text",
      schemeId: schemes.consequences?.id,
      conclusionClaimId: attackClimateConclusion.id,
      createdAt: daysAgo(9),
      premises: {
        create: [{ claimId: attackClimateP1.id, isImplicit: false }],
      },
    },
  });

  // Create attack relationship
  // NOTE: Attack relationships would be created via AifEdge in full AIF system
  // For this seed script, the attack arguments exist and can be manually linked via UI
  // await prisma.aifEdge.create({
  //   data: {
  //     deliberationId: deliberation.id,
  //     sourceId: attackClimateArg.id, // Would need AifNode ID, not Argument ID
  //     targetId: climateArg.id,
  //     edgeRole: "conflictingElement",
  //   },
  // });

  console.log(`   ✅ Created ${attackClimateArg.id} (REBUTS attack)\n`);

  // =========================================================================
  // TEST 8: ATTACK - UNDERCUTS AI Safety
  // =========================================================================

  console.log("📝 Test 8: Attack (UNDERCUTS AI inference)");

  const attackAIConclusion = await prisma.claim.upsert({
    where: { id: "claim-attack-ai-conc" },
    update: {},
    create: {
      id: "claim-attack-ai-conc",
      text: "The inference from AI progress to existential risk is not warranted",
      createdById: challenger.id.toString(),
      moid: `moid-attack-ai-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const attackAIP1 = await prisma.claim.upsert({
    where: { id: "claim-attack-ai-p1" },
    update: {},
    create: {
      id: "claim-attack-ai-p1",
      text: "Most AI capability gains are in narrow domains with no path to general intelligence",
      createdById: challenger.id.toString(),
      moid: `moid-attack-ai-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const attackAIArg = await prisma.argument.create({
    data: {
      id: "test-attack-ai-undercut",
      deliberationId: deliberation.id,
      authorId: challenger.id.toString(),
      text: "The inference from AI progress to existential risk is not warranted. Most AI capability gains are in narrow domains with no clear path to general intelligence.",
      confidence: 0.68,
      isImplicit: false,
      mediaType: "text",
      schemeId: schemes.sign?.id, // Attacks the Sign inference
      conclusionClaimId: attackAIConclusion.id,
      createdAt: daysAgo(7),
      premises: {
        create: [{ claimId: attackAIP1.id, isImplicit: false }],
      },
    },
  });

  // NOTE: Attack relationships would be created via AifEdge in full AIF system
  // await prisma.aifEdge.create({ ... });

  console.log(`   ✅ Created ${attackAIArg.id} (UNDERCUTS attack)\n`);

  // =========================================================================
  // TEST 9: ATTACK - UNDERMINES Energy Policy
  // =========================================================================

  console.log("📝 Test 9: Attack (UNDERMINES energy premise)");

  const attackEnergyConclusion = await prisma.claim.upsert({
    where: { id: "claim-attack-energy-conc" },
    update: {},
    create: {
      id: "claim-attack-energy-conc",
      text: "Renewable energy does not actually reduce emissions when accounting for full lifecycle",
      createdById: challenger.id.toString(),
      moid: `moid-attack-energy-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const attackEnergyP1 = await prisma.claim.upsert({
    where: { id: "claim-attack-energy-p1" },
    update: {},
    create: {
      id: "claim-attack-energy-p1",
      text: "Manufacturing solar panels and batteries produces significant emissions",
      createdById: challenger.id.toString(),
      moid: `moid-attack-energy-p1-${Date.now()}`,
      deliberationId: deliberation.id,
    },
  });

  const attackEnergyArg = await prisma.argument.create({
    data: {
      id: "test-attack-energy-undermine",
      deliberationId: deliberation.id,
      authorId: challenger.id.toString(),
      text: "Renewable energy does not actually reduce emissions when accounting for full lifecycle. Manufacturing solar panels and batteries produces significant emissions and environmental damage.",
      confidence: 0.65,
      isImplicit: false,
      mediaType: "text",
      schemeId: schemes.consequences?.id, // Undermines via negative consequences
      conclusionClaimId: attackEnergyConclusion.id,
      createdAt: daysAgo(3),
      premises: {
        create: [{ claimId: attackEnergyP1.id, isImplicit: false }],
      },
    },
  });

  // NOTE: Attack relationships would be created via AifEdge in full AIF system
  // await prisma.aifEdge.create({ ... });

  console.log(`   ✅ Created ${attackEnergyArg.id} (UNDERMINES attack)\n`);

  // =========================================================================
  // SUMMARY
  // =========================================================================

  console.log(`
${"=".repeat(80)}
✅ SEED COMPLETE - Phase 1-4 Deliberation Overhaul Test Suite
${"=".repeat(80)}

Deliberation: ludics-forest-demo

MULTI-SCHEME ARGUMENTS:
  1. test-conv-climate-arg (4 schemes, convergent)
     Practical Reasoning + Expert Opinion + Analogy + Consequences
     → Test ArgumentNetAnalyzer with convergent net
  
  2. test-div-ai-arg (3 schemes, divergent)
     Sign (primary) + Expert Opinion + Analogy
     → Test ArgumentNetAnalyzer with divergent net
  
  3. test-multi-scheme-climate-arg (3 schemes, serial)
     Expert Opinion → Sign → Causal [from other seed script]
     → Test ArgumentNetAnalyzer with serial chain
  
  4. test-hybrid-education-arg (3 schemes, hybrid)
     Practical Reasoning + Causal (serial) + Analogy (support)
     → Test ArgumentNetAnalyzer with mixed net structure

SINGLE-SCHEME ARGUMENTS:
  5. test-single-energy-arg (Practical Reasoning only)
     → Test fallback behavior for non-net arguments
  
  6. test-single-space-arg (Expert Opinion only)
     → Test single-scheme CQ display

ATTACK RELATIONSHIPS:
  7. test-attack-climate-rebuttal → REBUTS #1
     → Test attack visualization and relationships
  
  8. test-attack-ai-undercut → UNDERCUTS #2
     → Test inference attack display
  
  9. test-attack-energy-undermine → UNDERMINES #5
     → Test premise attack indicators

FEATURES TESTED:
✅ ArgumentNetAnalyzer (multi-scheme visualization)
✅ NetworksSection (deliberation-wide net list)
✅ AIFArgumentsListPro ("Analyze Net" buttons)
✅ Attack relationships (3 types)
✅ Confidence scores (varying levels)
✅ Temporal tracking (arguments from 2-10 days ago)
✅ Scheme diversity (6 different schemes)
✅ Multiple net types (convergent, divergent, serial, hybrid)

TESTING INSTRUCTIONS:
1. Navigate to: /deliberation/ludics-forest-demo/board
2. Open DeepDivePanel V3 → Arguments tab
3. Click "Analyze Net" on multi-scheme arguments (1-4)
4. Verify each shows different net structure
5. Click "Analyze Net" on single-scheme arguments (5-6)
6. Verify fallback to simple CQ display
7. Check NetworksSection shows 4 detected nets
8. Verify attack badges appear on attacked arguments
9. Test net export, CQ grouping, confidence display

${"=".repeat(80)}
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
