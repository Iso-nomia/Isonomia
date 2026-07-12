/**
 * Seed script for testing Scoped Ludics Forest with AIF-compliant arguments
 * Creates a deliberation with claims, arguments (via DialogueMoves), and dialogue interactions
 * to demonstrate how scoped designs work with real AIF data.
 * 
 * Key Architecture Points (from analysis):
 * - Arguments are structured with conclusion Claims and premise Claims
 * - Arguments connect to Claims via conclusionClaimId and ArgumentPremise records
 * - DialogueMoves (ASSERT, WHY, GROUNDS) create and update arguments
 * - Ludics compilation reads from DialogueMoves, not raw Arguments
 * - Schemes are optional and inferred/assigned via ArgumentScheme
 * 
 * Run with: npx tsx scripts/seed-ludics-forest-demo.ts
 */

import { prisma } from "@/lib/prismaclient";
import { compileFromMoves } from "@/packages/ludics-engine/compileFromMoves";
import { computeDialogueMoveSignature } from "@/lib/dialogue/signature";
import "dotenv/config";

const DEMO_DELIB_ID = "ludics-forest-demo";

async function main() {
  console.log("🌱 Seeding AIF-compliant Ludics Forest Demo");
  console.log("=".repeat(70));

  // 1. Create or find demo user
  let demoUser = await prisma.user.findFirst({
    where: { username: "ludics-demo" },
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        auth_id: `demo-${Date.now()}`,
        username: "ludics-demo",
        name: "Ludics Forest Demo",
      },
    });
    console.log("✅ Created demo user:", demoUser.id);
  } else {
    console.log("✅ Using existing demo user:", demoUser.id);
  }

  const userId = String(demoUser.id);

  // 2. Clean up any existing demo deliberation
  const existing = await prisma.deliberation.findUnique({
    where: { id: DEMO_DELIB_ID },
  });

  if (existing) {
    console.log("\\n🗑️  Cleaning up existing demo deliberation...");
    
    // Delete in order due to foreign keys
    await prisma.dialogueMove.deleteMany({ where: { deliberationId: DEMO_DELIB_ID } });
    await prisma.ludicChronicle.deleteMany({ where: { design: { deliberationId: DEMO_DELIB_ID } } });
    await prisma.ludicAct.deleteMany({ where: { design: { deliberationId: DEMO_DELIB_ID } } });
    await prisma.ludicTrace.deleteMany({ where: { deliberationId: DEMO_DELIB_ID } });
    await prisma.ludicDesign.deleteMany({ where: { deliberationId: DEMO_DELIB_ID } });
    await prisma.ludicLocus.deleteMany({ where: { dialogueId: DEMO_DELIB_ID } });
    await prisma.argumentEdge.deleteMany({ where: { deliberationId: DEMO_DELIB_ID } });
    await prisma.argumentPremise.deleteMany({
      where: { argument: { deliberationId: DEMO_DELIB_ID } },
    });
    await prisma.argument.deleteMany({ where: { deliberationId: DEMO_DELIB_ID } });
    await prisma.claim.deleteMany({ where: { deliberationId: DEMO_DELIB_ID } });
    await prisma.deliberation.delete({ where: { id: DEMO_DELIB_ID } });
    
    console.log("✅ Cleaned up old data");
  }

  // 3. Create deliberation
  const deliberation = await prisma.deliberation.create({
    data: {
      id: DEMO_DELIB_ID,
      title: "Climate Policy: Carbon Tax vs Cap-and-Trade",
      hostType: "article",
      hostId: "demo-article",
      createdById: userId,
      rule: "utilitarian",
      proofMode: "symmetric",
    },
  });

  console.log("\\n📋 Created Deliberation:", deliberation.id);
  console.log("   Title:", deliberation.title);

  // 4. Define actors for dialogue
  const actors = {
    alice: { id: "actor-alice", name: "Alice (Economist)" },
    bob: { id: "actor-bob", name: "Bob (Environmentalist)" },
    charlie: { id: "actor-charlie", name: "Charlie (Policy Analyst)" },
    dana: { id: "actor-dana", name: "Dana (Industry Rep)" },
  };

  console.log("\\n👥 Actors:");
  Object.values(actors).forEach(a => console.log(`   - ${a.name}`));

  // 5. Create Claims (following AIF architecture: Claims are the atomic propositions)
  console.log("\\n\\n📝 Creating Claims...");

  const claims: Record<string, any> = {};

  // Topic 1: Carbon Tax Effectiveness
  claims.carbonTaxEfficient = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Carbon taxes are more economically efficient than cap-and-trade",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-carbon-tax-efficient`,
    },
  });

  claims.priceCertainty = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Price certainty is important for business planning",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-price-certainty`,
    },
  });

  claims.investmentData = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Carbon taxes lead to 30% higher investment in clean tech",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-investment-data`,
    },
  });

  claims.regressiveImpact = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Carbon taxes have regressive impact on low-income households",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-regressive-impact`,
    },
  });

  claims.revenueRecycling = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Revenue recycling through tax rebates makes carbon taxes progressive",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-revenue-recycling`,
    },
  });

  // Topic 2: Environmental Effectiveness
  claims.capTradeGuarantee = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Cap-and-trade guarantees emissions reductions",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-cap-trade-guarantee`,
    },
  });

  claims.hardCap = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Hard emissions caps ensure climate targets are met",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-hard-cap`,
    },
  });

  claims.euEtsData = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "EU ETS reduced emissions by 35% in covered sectors",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-eu-ets-data`,
    },
  });

  // Topic 3: Political Feasibility  
  claims.politicalViability = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Carbon taxes face less political resistance than cap-and-trade",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-political-viability`,
    },
  });

  claims.simplicity = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Carbon taxes are simpler and more transparent",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-simplicity`,
    },
  });

  claims.referendumFailures = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Carbon taxes have been rejected in multiple referendums",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-referendum-failures`,
    },
  });

  claims.designMatters = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Well-designed carbon taxes with revenue recycling gain public support",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-design-matters`,
    },
  });

  // Topic 4: International Coordination
  claims.internationalMarkets = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Cap-and-trade systems enable international carbon markets",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-international-markets`,
    },
  });

  claims.marketLinkage = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Linking cap-and-trade systems creates unified carbon markets",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-market-linkage`,
    },
  });

  claims.sovereigntyTopic = await prisma.claim.create({
    data: {
      deliberationId: DEMO_DELIB_ID,
      text: "Tax coordination requires fiscal sovereignty transfers that nations resist",
      createdById: userId,
      moid: `${DEMO_DELIB_ID}-sovereignty-topic`,
    },
  });

  console.log(`✅ Created ${Object.keys(claims).length} claims`);

  // 6. Create DialogueMoves (this is how Ludics compilation works!)
  console.log("\\n\\n💬 Creating Dialogue Moves...");
  console.log("   (These will be compiled into Ludics designs)");

  const moves: Array<{
    targetType: string;
    targetId: string;
    kind: string;
    actorId: string;
    payload: any;
  }> = [];

  // topic 1 Thread: Carbon Tax Efficiency
  console.log("\\n🎯 topic 1: Carbon Tax Effectiveness");
  
  moves.push({
    targetType: "claim",
    targetId: claims.carbonTaxEfficient.id,
    kind: "ASSERT",
    actorId: actors.alice.id,
    payload: {
      text: "A carbon tax provides price certainty and reduces administrative complexity",
      premiseClaimIds: [claims.priceCertainty.id, claims.investmentData.id],
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.carbonTaxEfficient.id,
    kind: "WHY",
    actorId: actors.bob.id,
    payload: {
      text: "Why is price certainty better than emissions certainty?",
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.carbonTaxEfficient.id,
    kind: "GROUNDS",
    actorId: actors.alice.id,
    payload: {
      text: "Businesses need predictable costs for long-term planning",
      claimId: claims.investmentData.id,
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.carbonTaxEfficient.id,
    kind: "WHY",
    actorId: actors.dana.id,
    payload: {
      text: "What about the regressive impact on low-income households?",
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.regressiveImpact.id,
    kind: "GROUNDS",
    actorId: actors.charlie.id,
    payload: {
      text: "Revenue recycling solves this - BC model shows net benefits for low-income",
      claimId: claims.revenueRecycling.id,
    },
  });

  // topic 2 Thread: Environmental Effectiveness
  console.log("🎯 topic 2: Environmental Effectiveness");
  
  moves.push({
    targetType: "claim",
    targetId: claims.capTradeGuarantee.id,
    kind: "ASSERT",
    actorId: actors.bob.id,
    payload: {
      text: "Setting a hard cap ensures we meet climate targets",
      premiseClaimIds: [claims.hardCap.id, claims.euEtsData.id],
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.capTradeGuarantee.id,
    kind: "WHY",
    actorId: actors.alice.id,
    payload: {
      text: "Don't carbon taxes also reduce emissions through price signals?",
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.capTradeGuarantee.id,
    kind: "GROUNDS",
    actorId: actors.bob.id,
    payload: {
      text: "Yes, but cap-and-trade provides certainty - see EU ETS data",
      claimId: claims.euEtsData.id,
    },
  });

  // topic 3 Thread: Political Feasibility
  console.log("🎯 topic 3: Political Feasibility");
  
  moves.push({
    targetType: "claim",
    targetId: claims.politicalViability.id,
    kind: "ASSERT",
    actorId: actors.charlie.id,
    payload: {
      text: "Simpler to explain and harder to manipulate",
      premiseClaimIds: [claims.simplicity.id],
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.politicalViability.id,
    kind: "WHY",
    actorId: actors.dana.id,
    payload: {
      text: "But haven't carbon taxes been rejected in multiple referendums?",
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.referendumFailures.id,
    kind: "GROUNDS",
    actorId: actors.charlie.id,
    payload: {
      text: "Failures due to poor design - Switzerland's CO2 levy works well",
      claimId: claims.designMatters.id,
    },
  });

  // topic 4 Thread: International Coordination
  console.log("🎯 topic 4: International Coordination");
  
  moves.push({
    targetType: "claim",
    targetId: claims.internationalMarkets.id,
    kind: "ASSERT",
    actorId: actors.dana.id,
    payload: {
      text: "Linking systems creates unified markets",
      premiseClaimIds: [claims.marketLinkage.id],
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.internationalMarkets.id,
    kind: "WHY",
    actorId: actors.charlie.id,
    payload: {
      text: "Why can't carbon taxes be coordinated internationally?",
    },
  });

  moves.push({
    targetType: "claim",
    targetId: claims.internationalMarkets.id,
    kind: "GROUNDS",
    actorId: actors.dana.id,
    payload: {
      text: "Tax coordination requires sovereignty transfers - cap-and-trade only needs technical alignment",
      claimId: claims.sovereigntyTopic.id,
    },
  });

  // Add signatures and create moves
  const movesWithSignatures = moves.map(m => ({
    deliberationId: DEMO_DELIB_ID,
    targetType: m.targetType as any,
    targetId: m.targetId,
    kind: m.kind as any,
    actorId: m.actorId,
    payload: m.payload,
    signature: computeDialogueMoveSignature({
      deliberationId: DEMO_DELIB_ID,
      targetType: m.targetType as any,
      targetId: m.targetId,
      kind: m.kind as any,
      payload: m.payload,
    }),
  }));

  await prisma.dialogueMove.createMany({
    data: movesWithSignatures,
    skipDuplicates: true,
  });

  console.log(`✅ Created ${moves.length} dialogue moves`);
  console.log("   - ASSERT moves create arguments");
  console.log("   - WHY moves challenge arguments");
  console.log("   - GROUNDS moves defend arguments");

  // 7. Compile Ludics Designs from DialogueMoves
  console.log("\\n\\n🔄 Compiling Ludics Designs from Dialogue Moves...");
  console.log("=".repeat(70));

  // Try each scoping strategy
  const strategies = [
    { key: "legacy", name: "Legacy (Global)" },
    { key: "topic", name: "Topic-Based" },
    { key: "argument", name: "Argument-Thread" },
  ] as const;

  for (const strategy of strategies) {
    console.log(`\\n📊 Strategy: ${strategy.name}`);
    console.log("-".repeat(70));

    const result = await compileFromMoves(DEMO_DELIB_ID, {
      scopingStrategy: strategy.key,
      forceRecompile: true,
    });

    const designs = await prisma.ludicDesign.findMany({
      where: { 
        deliberationId: DEMO_DELIB_ID,
        ...(strategy.key === "legacy" ? { scope: null } : { scope: { not: null } }),
      },
      include: { acts: true },
    });

    if (strategy.key === "legacy") {
      console.log(`✅ Created ${designs.length} designs (1 global scope × 2 polarities)`);
    } else {
      // Group by scope
      const scopeGroups = new Map<string, typeof designs>();
      for (const design of designs) {
        const scopeKey = (design as any).scope ?? "legacy";
        if (!scopeGroups.has(scopeKey)) {
          scopeGroups.set(scopeKey, []);
        }
        scopeGroups.get(scopeKey)!.push(design);
      }

      console.log(`✅ Created ${designs.length} designs (${scopeGroups.size} scopes × 2 polarities)`);
      
      let scopeNum = 1;
      for (const [scopeKey, scopeDesigns] of scopeGroups.entries()) {
        const metadata = (scopeDesigns[0] as any).scopeMetadata;
        const proponent = scopeDesigns.find(d => d.participantId === "Proponent");
        const opponent = scopeDesigns.find(d => d.participantId === "Opponent");

        console.log(`\\n   Scope ${scopeNum}: ${metadata?.label || scopeKey}`);
        console.log(`   ├─ Key: ${scopeKey}`);
        console.log(`   ├─ Moves: ${metadata?.moveCount || 0}`);
        console.log(`   ├─ Actors: ${metadata?.actors?.all?.length || 0}`);
        console.log(`   └─ Acts: P=${proponent?.acts.length || 0}, O=${opponent?.acts.length || 0}`);

        scopeNum++;
      }
    }
  }

  // Keep Topic-based as default
  await compileFromMoves(DEMO_DELIB_ID, {
    scopingStrategy: "topic",
    forceRecompile: true,
  });

  // Final summary
  console.log("\\n\\n" + "=".repeat(70));
  console.log("✅ Seeding Complete!");
  console.log("=".repeat(70));

  const finalCounts = {
    claims: await prisma.claim.count({ where: { deliberationId: DEMO_DELIB_ID } }),
    moves: await prisma.dialogueMove.count({ where: { deliberationId: DEMO_DELIB_ID } }),
    designs: await prisma.ludicDesign.count({ where: { deliberationId: DEMO_DELIB_ID } }),
  };

  console.log(`\\n📊 Final Counts:`);
  console.log(`   Claims: ${finalCounts.claims}`);
  console.log(`   Dialogue Moves: ${finalCounts.moves}`);
  console.log(`   Ludics Designs: ${finalCounts.designs}`);

  console.log("\\n\\n🎨 View in UI:");
  console.log("=".repeat(70));
  console.log(`1. Start dev server: npm run dev`);
  console.log(`2. Navigate to: /deliberation/${DEMO_DELIB_ID}`);
  console.log(`3. Open Ludics Panel`);
  console.log(`4. Click "🌲 Forest" view`);
  console.log(`5. Use scoping strategy dropdown to compare:`);
  console.log(`   - Topic-Based: Separate scope per Topic/argument`);
  console.log(`   - Argument-Thread: Same as Topic in this case`);
  console.log(`   - Legacy: All moves in one global scope`);

  console.log("\\n\\n💡 What to Look For:");
  console.log("=".repeat(70));
  console.log(`✓ Each scope card shows the argument/Topic label`);
  console.log(`✓ Move counts and actor counts per scope`);
  console.log(`✓ P/O design pairs within each scope`);
  console.log(`✓ Acts compiled from dialogue moves (ASSERT/WHY/GROUNDS)`);
  console.log(`✓ Rich metadata: labels, move counts, actors`);
  console.log(`✓ Recompile button to switch strategies live`);
  console.log(`✓ Compare how different scoping affects design structure`);

  console.log("\\n\\n🔬 Architecture Notes:");
  console.log("=".repeat(70));
  console.log(`• Claims are atomic propositions (AIF I-nodes)`);
  console.log(`• Arguments connect claims (AIF RA-nodes)`);
  console.log(`• DialogueMoves create/update arguments dynamically`);
  console.log(`• Ludics compilation reads from DialogueMoves`);
  console.log(`• Scoping groups moves by Topic/argument/actor-pair`);
  console.log(`• Each scope gets P/O design pair (game semantics)`);

  console.log("\\n");
}

main()
  .catch((error) => {
    console.error("\\n❌ Error seeding:", error);
    console.error(error.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
