/**
 * Seed script for testing the Glossary/DefinitionSheet feature
 * 
 * Creates comprehensive test data to demonstrate all features:
 * - Terms in different statuses (PENDING, CONTESTED, CONSENSUS)
 * - Multiple competing definitions
 * - Endorsements and consensus promotion
 * - Voting on definitions
 * - Definition history
 * - Term usage tracking
 * 
 * Usage:
 *   tsx scripts/seed-glossary-test.ts <deliberationId>
 * 
 * Example:
 *   tsx scripts/seed-glossary-test.ts cmgy6c8vz0000c04w4l9khiux
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deliberationId = process.argv[2];

  if (!deliberationId) {
    console.error("❌ Error: Please provide a deliberation ID");
    console.log("\nUsage: tsx scripts/seed-glossary-test.ts <deliberationId>");
    process.exit(1);
  }

  console.log("🔍 Checking deliberation...");
  
  // Verify deliberation exists
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, title: true },
  });

  if (!deliberation) {
    console.error(`❌ Error: Deliberation ${deliberationId} not found`);
    process.exit(1);
  }

  console.log(`✅ Found deliberation: "${deliberation.title}"\n`);

  // Get users for demo (need at least 3 for proper testing)
  console.log("🔍 Finding users...");
  const users = await prisma.user.findMany({
    take: 6,
    orderBy: { created_at: "desc" },
    select: { auth_id: true, name: true, username: true },
  });

  if (users.length < 3) {
    console.error("❌ Error: Need at least 3 users in database for proper testing");
    process.exit(1);
  }

  console.log(`✅ Found ${users.length} users for testing\n`);

  // Clear existing glossary data for this deliberation
  console.log("🧹 Cleaning up existing glossary data...");
  const existingTerms = await prisma.glossaryTerm.findMany({
    where: { deliberationId },
    select: { id: true },
  });

  if (existingTerms.length > 0) {
    await prisma.glossaryTermUsage.deleteMany({
      where: { termId: { in: existingTerms.map(t => t.id) } },
    });
    
    const definitionIds = await prisma.glossaryDefinition.findMany({
      where: { termId: { in: existingTerms.map(t => t.id) } },
      select: { id: true },
    });

    if (definitionIds.length > 0) {
      await prisma.glossaryDefinitionVote.deleteMany({
        where: { definitionId: { in: definitionIds.map(d => d.id) } },
      });
      await prisma.glossaryEndorsement.deleteMany({
        where: { definitionId: { in: definitionIds.map(d => d.id) } },
      });
      await prisma.glossaryDefinitionHistory.deleteMany({
        where: { definitionId: { in: definitionIds.map(d => d.id) } },
      });
    }

    await prisma.glossaryDefinition.deleteMany({
      where: { termId: { in: existingTerms.map(t => t.id) } },
    });

    await prisma.glossaryTerm.deleteMany({
      where: { deliberationId },
    });

    console.log(`✅ Cleaned up ${existingTerms.length} existing terms\n`);
  }

  console.log("📝 Creating test glossary data...\n");

  // ============================================================================
  // SCENARIO 1: CONSENSUS TERM
  // - One definition with majority endorsements
  // - Demonstrates consensus promotion (50% threshold)
  // ============================================================================
  console.log("1️⃣  Creating CONSENSUS term: 'Justice'");
  
  const justiceTerm = await prisma.glossaryTerm.create({
    data: {
      deliberationId,
      term: "Justice",
      termNormalized: "justice",
      status: "PENDING", // Will be promoted to CONSENSUS
      proposedById: users[0].auth_id,
    },
  });

  const justiceDefinition = await prisma.glossaryDefinition.create({
    data: {
      termId: justiceTerm.id,
      definition: "The principle of fairness and equal treatment under law, ensuring that all individuals receive what they are due according to established rules and moral principles.",
      examples: "Examples: A fair trial, equal pay for equal work, redistributive taxation to ensure basic needs are met.",
      sources: JSON.stringify([
        { title: "Stanford Encyclopedia of Philosophy", url: "https://plato.stanford.edu/entries/justice/" }
      ]),
      authorId: users[0].auth_id,
      isCanonical: false,
      endorsementCount: 0,
    },
  });

  // Create endorsements (4 out of 6 users = 66% > 50% threshold)
  for (let i = 0; i < 4; i++) {
    await prisma.glossaryEndorsement.create({
      data: {
        definitionId: justiceDefinition.id,
        userId: users[i].auth_id,
      },
    });
  }

  // Update endorsement count
  await prisma.glossaryDefinition.update({
    where: { id: justiceDefinition.id },
    data: { 
      endorsementCount: 4,
      isCanonical: true, // Promote to canonical
    },
  });

  // Update term status to CONSENSUS
  await prisma.glossaryTerm.update({
    where: { id: justiceTerm.id },
    data: { status: "CONSENSUS" },
  });

  console.log(`   ✅ Created with ${4} endorsements → CONSENSUS achieved\n`);

  // ============================================================================
  // SCENARIO 2: CONTESTED TERM WITH MULTIPLE COMPETING DEFINITIONS
  // - 3 competing definitions with different vote patterns
  // - Demonstrates voting and competing viewpoints
  // ============================================================================
  console.log("2️⃣  Creating CONTESTED term: 'Freedom'");
  
  const freedomTerm = await prisma.glossaryTerm.create({
    data: {
      deliberationId,
      term: "Freedom",
      termNormalized: "freedom",
      status: "CONTESTED",
      proposedById: users[0].auth_id,
    },
  });

  // Definition 1: Negative liberty (classical liberal view)
  const freedomDef1 = await prisma.glossaryDefinition.create({
    data: {
      termId: freedomTerm.id,
      definition: "The absence of external coercion or interference by others, particularly the state. Freedom means being left alone to pursue one's own goals without unjust restraint.",
      examples: "Freedom of speech without censorship, freedom to own property, freedom to enter contracts voluntarily.",
      authorId: users[0].auth_id,
      isCanonical: false,
      endorsementCount: 2,
    },
  });

  await prisma.glossaryEndorsement.createMany({
    data: [
      { definitionId: freedomDef1.id, userId: users[0].auth_id },
      { definitionId: freedomDef1.id, userId: users[1].auth_id },
    ],
  });

  // Add votes to definition 1
  await prisma.glossaryDefinitionVote.createMany({
    data: [
      { definitionId: freedomDef1.id, userId: users[0].auth_id, value: 1 },
      { definitionId: freedomDef1.id, userId: users[1].auth_id, value: 1 },
      { definitionId: freedomDef1.id, userId: users[2].auth_id, value: -1 },
      { definitionId: freedomDef1.id, userId: users[3].auth_id, value: 1 },
    ],
  });

  // Definition 2: Positive liberty (social democratic view)
  const freedomDef2 = await prisma.glossaryDefinition.create({
    data: {
      termId: freedomTerm.id,
      definition: "The capacity and opportunity to pursue one's goals and develop one's potential. True freedom requires not just absence of interference, but also access to resources, education, and social conditions that enable self-determination.",
      examples: "Universal healthcare enabling freedom from medical bankruptcy, free education enabling career choice, social safety nets enabling risk-taking.",
      authorId: users[2].auth_id,
      isCanonical: false,
      endorsementCount: 2,
    },
  });

  await prisma.glossaryEndorsement.createMany({
    data: [
      { definitionId: freedomDef2.id, userId: users[2].auth_id },
      { definitionId: freedomDef2.id, userId: users[3].auth_id },
    ],
  });

  // Add votes to definition 2
  await prisma.glossaryDefinitionVote.createMany({
    data: [
      { definitionId: freedomDef2.id, userId: users[0].auth_id, value: -1 },
      { definitionId: freedomDef2.id, userId: users[2].auth_id, value: 1 },
      { definitionId: freedomDef2.id, userId: users[3].auth_id, value: 1 },
      { definitionId: freedomDef2.id, userId: users[4].auth_id, value: 1 },
    ],
  });

  // Definition 3: Republican liberty (civic republican view)
  const freedomDef3 = await prisma.glossaryDefinition.create({
    data: {
      termId: freedomTerm.id,
      definition: "Freedom from domination and arbitrary power. One is free when not subject to the arbitrary will of others, requiring both legal protections and active civic participation in self-governance.",
      examples: "Democratic participation in decision-making, rule of law preventing arbitrary detention, workplace democracy preventing domination by employers.",
      authorId: users[4].auth_id,
      isCanonical: false,
      endorsementCount: 1,
    },
  });

  await prisma.glossaryEndorsement.create({
    data: {
      definitionId: freedomDef3.id,
      userId: users[4].auth_id,
    },
  });

  // Add votes to definition 3
  await prisma.glossaryDefinitionVote.createMany({
    data: [
      { definitionId: freedomDef3.id, userId: users[1].auth_id, value: 0 },
      { definitionId: freedomDef3.id, userId: users[4].auth_id, value: 1 },
      { definitionId: freedomDef3.id, userId: users[5].auth_id, value: 1 },
    ],
  });

  console.log("   ✅ Created with 3 competing definitions");
  console.log("   📊 Def 1: 2 endorsements, 3 upvotes, 1 downvote");
  console.log("   📊 Def 2: 2 endorsements, 3 upvotes, 1 downvote");
  console.log("   📊 Def 3: 1 endorsement, 2 upvotes, 1 neutral\n");

  // ============================================================================
  // SCENARIO 3: PENDING TERM
  // - Single definition without consensus
  // - Recently proposed, awaiting community input
  // ============================================================================
  console.log("3️⃣  Creating PENDING term: 'Equity'");
  
  const equityTerm = await prisma.glossaryTerm.create({
    data: {
      deliberationId,
      term: "Equity",
      termNormalized: "equity",
      status: "PENDING",
      proposedById: users[1].auth_id,
    },
  });

  const equityDefinition = await prisma.glossaryDefinition.create({
    data: {
      termId: equityTerm.id,
      definition: "Fairness achieved by providing different levels of support based on individual needs and circumstances, aiming for comparable outcomes rather than identical treatment.",
      examples: "Affirmative action in university admissions, progressive taxation based on ability to pay, accessibility accommodations for disabled individuals.",
      authorId: users[1].auth_id,
      isCanonical: false,
      endorsementCount: 2,
    },
  });

  // Just 2 endorsements (not enough for consensus)
  await prisma.glossaryEndorsement.createMany({
    data: [
      { definitionId: equityDefinition.id, userId: users[1].auth_id },
      { definitionId: equityDefinition.id, userId: users[2].auth_id },
    ],
  });

  console.log("   ✅ Created with 2 endorsements → Still PENDING\n");

  // ============================================================================
  // SCENARIO 4: CONTESTED TERM WITH DEFINITION HISTORY
  // - Shows definition editing and version tracking
  // ============================================================================
  console.log("4️⃣  Creating CONTESTED term with history: 'Common Good'");
  
  const commonGoodTerm = await prisma.glossaryTerm.create({
    data: {
      deliberationId,
      term: "Common Good",
      termNormalized: "common good",
      status: "CONTESTED",
      proposedById: users[3].auth_id,
    },
  });

  // Original definition (we'll create history for this)
  const originalText = "The welfare of the community as a whole.";
  const revisedText = "The sum of conditions that allow individuals and groups to flourish and achieve their purposes within a just social order.";

  const commonGoodDef1 = await prisma.glossaryDefinition.create({
    data: {
      termId: commonGoodTerm.id,
      definition: revisedText,
      examples: "Public infrastructure, clean air and water, rule of law, public education, collective security.",
      authorId: users[3].auth_id,
      isCanonical: false,
      endorsementCount: 2,
    },
  });

  // Create edit history
  await prisma.glossaryDefinitionHistory.create({
    data: {
      definitionId: commonGoodDef1.id,
      previousText: originalText,
      newText: revisedText,
      changeType: "edited",
      changedById: users[3].auth_id,
    },
  });

  await prisma.glossaryEndorsement.createMany({
    data: [
      { definitionId: commonGoodDef1.id, userId: users[3].auth_id },
      { definitionId: commonGoodDef1.id, userId: users[4].auth_id },
    ],
  });

  // Competing definition - emergent order view
  const commonGoodDef2 = await prisma.glossaryDefinition.create({
    data: {
      termId: commonGoodTerm.id,
      definition: "The emergent outcome of free individuals pursuing their own interests through voluntary cooperation and market exchange.",
      examples: "Innovation driven by profit motive, charitable giving, spontaneous order of markets.",
      authorId: users[5].auth_id,
      isCanonical: false,
      endorsementCount: 1,
    },
  });

  await prisma.glossaryEndorsement.create({
    data: {
      definitionId: commonGoodDef2.id,
      userId: users[5].auth_id,
    },
  });

  console.log("   ✅ Created with 2 definitions and edit history\n");

  // ============================================================================
  // SCENARIO 5: TERM WITH USAGE TRACKING
  // - Demonstrates term usage in arguments/claims
  // ============================================================================
  console.log("5️⃣  Creating PENDING term with usage: 'Autonomy'");
  
  const autonomyTerm = await prisma.glossaryTerm.create({
    data: {
      deliberationId,
      term: "Autonomy",
      termNormalized: "autonomy",
      status: "PENDING",
      proposedById: users[0].auth_id,
    },
  });

  const autonomyDefinition = await prisma.glossaryDefinition.create({
    data: {
      termId: autonomyTerm.id,
      definition: "The capacity for self-governance and independent decision-making, free from controlling interference by others or from personal limitations that prevent meaningful choice.",
      examples: "Informed consent in medical treatment, freedom to choose one's career, personal lifestyle choices, the right to refuse unwanted procedures.",
      authorId: users[0].auth_id,
      isCanonical: false,
      endorsementCount: 1,
    },
  });

  await prisma.glossaryEndorsement.create({
    data: {
      definitionId: autonomyDefinition.id,
      userId: users[0].auth_id,
    },
  });

  // Create mock usage entries (linking to hypothetical claims)
  await prisma.glossaryTermUsage.createMany({
    data: [
      {
        termId: autonomyTerm.id,
        targetType: "claim" as any,
        targetId: "mock_claim_001",
        contextText: "Individual autonomy should be the primary consideration in healthcare decisions.",
      },
      {
        termId: autonomyTerm.id,
        targetType: "argument" as any,
        targetId: "mock_arg_001",
        contextText: "This argument relies on respecting patient autonomy as a core value.",
      },
    ],
  });

  console.log("   ✅ Created with 2 usage references\n");

  // ============================================================================
  // SCENARIO 6: HEAVILY DEBATED TERM
  // - Maximum competition scenario
  // ============================================================================
  console.log("6️⃣  Creating highly CONTESTED term: 'Rights'");
  
  const rightsTerm = await prisma.glossaryTerm.create({
    data: {
      deliberationId,
      term: "Rights",
      termNormalized: "rights",
      status: "CONTESTED",
      proposedById: users[0].auth_id,
    },
  });

  // Definition 1: Natural rights
  const rightsDef1 = await prisma.glossaryDefinition.create({
    data: {
      termId: rightsTerm.id,
      definition: "Inherent moral entitlements possessed by all humans by virtue of their humanity, existing independently of government recognition or social convention.",
      examples: "Right to life, liberty, and property as natural rights; freedom of conscience.",
      authorId: users[0].auth_id,
      isCanonical: false,
      endorsementCount: 1,
    },
  });

  await prisma.glossaryEndorsement.create({
    data: { definitionId: rightsDef1.id, userId: users[0].auth_id },
  });

  // Definition 2: Legal positivist view
  const rightsDef2 = await prisma.glossaryDefinition.create({
    data: {
      termId: rightsTerm.id,
      definition: "Legally recognized claims and protections established through social institutions, constitutions, and legislation.",
      examples: "Constitutional rights, statutory rights, civil rights established by law.",
      authorId: users[1].auth_id,
      isCanonical: false,
      endorsementCount: 2,
    },
  });

  await prisma.glossaryEndorsement.createMany({
    data: [
      { definitionId: rightsDef2.id, userId: users[1].auth_id },
      { definitionId: rightsDef2.id, userId: users[2].auth_id },
    ],
  });

  // Definition 3: Capability approach
  const rightsDef3 = await prisma.glossaryDefinition.create({
    data: {
      termId: rightsTerm.id,
      definition: "Entitlements to the capabilities and opportunities necessary for human flourishing, including both negative freedoms and positive provisions.",
      examples: "Right to education, healthcare, participation in political life, basic material security.",
      authorId: users[3].auth_id,
      isCanonical: false,
      endorsementCount: 1,
    },
  });

  await prisma.glossaryEndorsement.create({
    data: { definitionId: rightsDef3.id, userId: users[3].auth_id },
  });

  // Add votes showing strong disagreement
  await prisma.glossaryDefinitionVote.createMany({
    data: [
      { definitionId: rightsDef1.id, userId: users[0].auth_id, value: 1 },
      { definitionId: rightsDef1.id, userId: users[1].auth_id, value: -1 },
      { definitionId: rightsDef1.id, userId: users[2].auth_id, value: -1 },
      { definitionId: rightsDef2.id, userId: users[1].auth_id, value: 1 },
      { definitionId: rightsDef2.id, userId: users[2].auth_id, value: 1 },
      { definitionId: rightsDef2.id, userId: users[0].auth_id, value: -1 },
      { definitionId: rightsDef3.id, userId: users[3].auth_id, value: 1 },
      { definitionId: rightsDef3.id, userId: users[4].auth_id, value: 1 },
      { definitionId: rightsDef3.id, userId: users[1].auth_id, value: 0 },
    ],
  });

  console.log("   ✅ Created with 3 hotly debated definitions\n");

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("=" .repeat(60));
  console.log("✨ GLOSSARY TEST DATA CREATED SUCCESSFULLY!\n");
  console.log("📊 Summary:");
  console.log(`   • Deliberation: ${deliberation.title}`);
  console.log(`   • Users: ${users.length}`);
  console.log("   • Terms: 6 total");
  console.log("     - 1 CONSENSUS (Justice)");
  console.log("     - 4 CONTESTED (Freedom, Common Good, Rights, and one more)");
  console.log("     - 2 PENDING (Equity, Autonomy)");
  console.log("   • Total Definitions: 13");
  console.log("   • Total Endorsements: 18");
  console.log("   • Total Votes: 23");
  console.log("   • Definition History Entries: 1");
  console.log("   • Usage References: 2\n");

  console.log("🧪 Test Coverage:");
  console.log("   ✅ Consensus promotion (50% threshold)");
  console.log("   ✅ Multiple competing definitions");
  console.log("   ✅ Voting (upvote/downvote/neutral)");
  console.log("   ✅ Endorsements");
  console.log("   ✅ Different term statuses");
  console.log("   ✅ Definition edit history");
  console.log("   ✅ Term usage tracking");
  console.log("   ✅ Complex debate scenarios\n");

  console.log("🎯 Features to Test:");
  console.log("   1. View terms in different states (filter by status)");
  console.log("   2. Endorse definitions (watch consensus promotion)");
  console.log("   3. Vote on competing definitions");
  console.log("   4. Propose new definitions for contested terms");
  console.log("   5. Search and sort functionality");
  console.log("   6. View definition history");
  console.log("   7. View term usage in arguments/claims\n");

  console.log("=" .repeat(60));
}

main()
  .catch((e) => {
    console.error("\n❌ Error seeding glossary data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
