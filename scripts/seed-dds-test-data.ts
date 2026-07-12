/**
 * Seed Script: DDS Test Data for Phases 1-5
 * 
 * Creates comprehensive test data for the DDS (Designs, Disputes, Strategies)
 * features implemented in Phases 1-5.
 * 
 * Run with: npx tsx scripts/seed-dds-test-data.ts
 * 
 * Target deliberation: cmgn1qrf00004pwnjqtbebhdg
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DELIBERATION_ID = "cmgn1qrf00004pwnjqtbebhdg";

interface SeededData {
  loci: string[];
  designs: string[];
  acts: string[];
  views: string[];
  disputes: string[];
  positions: string[];
  strategies: string[];
  plays: string[];
  correspondences: string[];
  traces: string[];
}

async function main() {
  console.log("🌱 Starting DDS Test Data Seed...");
  console.log(`📍 Target Deliberation: ${DELIBERATION_ID}`);

  const seeded: SeededData = {
    loci: [],
    designs: [],
    acts: [],
    views: [],
    disputes: [],
    positions: [],
    strategies: [],
    plays: [],
    correspondences: [],
    traces: [],
  };

  try {
    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: DELIBERATION_ID },
    });

    if (!deliberation) {
      console.error(`❌ Deliberation ${DELIBERATION_ID} not found!`);
      process.exit(1);
    }

    console.log(`✅ Found deliberation: "${deliberation.title}"`);

    // =========================================================================
    // PHASE 1: Create Loci Structure
    // =========================================================================
    console.log("\n📂 Creating loci structure...");

    // Root locus
    const rootLocus = await prisma.ludicLocus.upsert({
      where: { dialogueId_path: { dialogueId: DELIBERATION_ID, path: "0" } },
      update: {},
      create: {
        dialogueId: DELIBERATION_ID,
        path: "0",
        extJson: { label: "Root" },
      },
    });
    seeded.loci.push(rootLocus.id);

    // Create child loci for a branching argument structure
    const lociPaths = [
      { path: "0.1", label: "Main Claim" },
      { path: "0.1.1", label: "Supporting Evidence 1" },
      { path: "0.1.2", label: "Supporting Evidence 2" },
      { path: "0.1.1.1", label: "Counter-argument to E1" },
      { path: "0.1.1.2", label: "Rebut counter to E1" },
      { path: "0.2", label: "Alternative Claim" },
      { path: "0.2.1", label: "Alt Evidence 1" },
      { path: "0.3", label: "Concession Branch" },
    ];

    const lociMap: Record<string, string> = { "0": rootLocus.id };

    for (const lp of lociPaths) {
      const parentPath = lp.path.split(".").slice(0, -1).join(".") || "0";
      const locus = await prisma.ludicLocus.upsert({
        where: { dialogueId_path: { dialogueId: DELIBERATION_ID, path: lp.path } },
        update: {},
        create: {
          dialogueId: DELIBERATION_ID,
          path: lp.path,
          parentId: lociMap[parentPath],
          extJson: { label: lp.label },
        },
      });
      lociMap[lp.path] = locus.id;
      seeded.loci.push(locus.id);
    }

    console.log(`   ✅ Created ${seeded.loci.length} loci`);

    // =========================================================================
    // PHASE 1: Create Designs (Proponent & Opponent)
    // =========================================================================
    console.log("\n🎨 Creating designs...");

    // Main scope designs
    const proponentDesign = await prisma.ludicDesign.create({
      data: {
        deliberationId: DELIBERATION_ID,
        participantId: "Proponent",
        rootLocusId: rootLocus.id,
        semantics: "ludics-v1",
        hasDaimon: false,
        scope: "topic:main-thesis",
        scopeType: "topic",
        scopeMetadata: {
          label: "Main Thesis Discussion",
          topicId: "main-thesis",
          moveCount: 5,
        },
        extJson: { description: "Proponent's main argument structure" },
      },
    });
    seeded.designs.push(proponentDesign.id);

    const opponentDesign = await prisma.ludicDesign.create({
      data: {
        deliberationId: DELIBERATION_ID,
        participantId: "Opponent",
        rootLocusId: rootLocus.id,
        semantics: "ludics-v1",
        hasDaimon: true, // Has daimon (concession point)
        scope: "topic:main-thesis",
        scopeType: "topic",
        scopeMetadata: {
          label: "Main Thesis Discussion",
          topicId: "main-thesis",
          moveCount: 4,
        },
        extJson: { description: "Opponent's counter-argument structure" },
      },
    });
    seeded.designs.push(opponentDesign.id);

    // Alternative scope designs
    const proponentAltDesign = await prisma.ludicDesign.create({
      data: {
        deliberationId: DELIBERATION_ID,
        participantId: "Proponent",
        rootLocusId: lociMap["0.2"],
        semantics: "ludics-v1",
        hasDaimon: false,
        scope: "topic:alternative",
        scopeType: "topic",
        scopeMetadata: {
          label: "Alternative Argument",
          topicId: "alternative",
          moveCount: 2,
        },
      },
    });
    seeded.designs.push(proponentAltDesign.id);

    const opponentAltDesign = await prisma.ludicDesign.create({
      data: {
        deliberationId: DELIBERATION_ID,
        participantId: "Opponent",
        rootLocusId: lociMap["0.2"],
        semantics: "ludics-v1",
        hasDaimon: false,
        scope: "topic:alternative",
        scopeType: "topic",
        scopeMetadata: {
          label: "Alternative Argument",
          topicId: "alternative",
          moveCount: 2,
        },
      },
    });
    seeded.designs.push(opponentAltDesign.id);

    console.log(`   ✅ Created ${seeded.designs.length} designs`);

    // =========================================================================
    // PHASE 1: Create Acts
    // =========================================================================
    console.log("\n🎭 Creating acts...");

    // Proponent acts (main design)
    const proponentActs = [
      {
        kind: "PROPER" as const,
        polarity: "P" as const,
        locusId: rootLocus.id,
        expression: "Climate change requires immediate policy action",
        ramification: ["0.1"],
        orderInDesign: 0,
      },
      {
        kind: "PROPER" as const,
        polarity: "P" as const,
        locusId: lociMap["0.1"],
        expression: "Scientific consensus supports anthropogenic causes",
        ramification: ["0.1.1", "0.1.2"],
        orderInDesign: 1,
      },
      {
        kind: "PROPER" as const,
        polarity: "P" as const,
        locusId: lociMap["0.1.1"],
        expression: "97% of climate scientists agree on human causes",
        ramification: ["0.1.1.1"],
        orderInDesign: 2,
      },
      {
        kind: "PROPER" as const,
        polarity: "P" as const,
        locusId: lociMap["0.1.2"],
        expression: "Observable temperature trends confirm models",
        ramification: [],
        orderInDesign: 3,
      },
      {
        kind: "PROPER" as const,
        polarity: "P" as const,
        locusId: lociMap["0.1.1.2"],
        expression: "Consensus methodology is robust and peer-reviewed",
        ramification: [],
        orderInDesign: 4,
      },
    ];

    for (const actData of proponentActs) {
      const act = await prisma.ludicAct.create({
        data: {
          designId: proponentDesign.id,
          kind: actData.kind,
          polarity: actData.polarity,
          locusId: actData.locusId,
          expression: actData.expression,
          ramification: actData.ramification,
          orderInDesign: actData.orderInDesign,
          metaJson: { source: "seed-script" },
        },
      });
      seeded.acts.push(act.id);
    }

    // Opponent acts (main design)
    const opponentActs = [
      {
        kind: "PROPER" as const,
        polarity: "O" as const,
        locusId: rootLocus.id,
        expression: "WHY: What evidence supports immediate action?",
        ramification: ["0.1"],
        orderInDesign: 0,
      },
      {
        kind: "PROPER" as const,
        polarity: "O" as const,
        locusId: lociMap["0.1"],
        expression: "WHY: How reliable is the scientific consensus?",
        ramification: ["0.1.1"],
        orderInDesign: 1,
      },
      {
        kind: "PROPER" as const,
        polarity: "O" as const,
        locusId: lociMap["0.1.1.1"],
        expression: "Consensus studies have methodological issues",
        ramification: ["0.1.1.2"],
        orderInDesign: 2,
      },
      {
        kind: "DAIMON" as const,
        polarity: "O" as const,
        locusId: lociMap["0.3"],
        expression: "† (concedes alternative interpretation)",
        ramification: [],
        orderInDesign: 3,
      },
    ];

    for (const actData of opponentActs) {
      const act = await prisma.ludicAct.create({
        data: {
          designId: opponentDesign.id,
          kind: actData.kind,
          polarity: actData.polarity,
          locusId: actData.locusId,
          expression: actData.expression,
          ramification: actData.ramification,
          orderInDesign: actData.orderInDesign,
          metaJson: { source: "seed-script" },
        },
      });
      seeded.acts.push(act.id);
    }

    // Alt design acts
    const altProponentAct = await prisma.ludicAct.create({
      data: {
        designId: proponentAltDesign.id,
        kind: "PROPER",
        polarity: "P",
        locusId: lociMap["0.2"],
        expression: "Economic benefits outweigh transition costs",
        ramification: ["0.2.1"],
        orderInDesign: 0,
      },
    });
    seeded.acts.push(altProponentAct.id);

    const altOpponentAct = await prisma.ludicAct.create({
      data: {
        designId: opponentAltDesign.id,
        kind: "PROPER",
        polarity: "O",
        locusId: lociMap["0.2"],
        expression: "WHY: What cost-benefit analysis supports this?",
        ramification: ["0.2.1"],
        orderInDesign: 0,
      },
    });
    seeded.acts.push(altOpponentAct.id);

    console.log(`   ✅ Created ${seeded.acts.length} acts`);

    // =========================================================================
    // PHASE 1: Create Disputes
    // =========================================================================
    console.log("\n⚔️ Creating disputes...");

    const mainDispute = await prisma.ludicDispute.create({
      data: {
        deliberationId: DELIBERATION_ID,
        posDesignId: proponentDesign.id,
        negDesignId: opponentDesign.id,
        actionPairs: [
          { posActId: seeded.acts[0], negActId: seeded.acts[5], locusPath: "0", ts: 1 },
          { posActId: seeded.acts[1], negActId: seeded.acts[6], locusPath: "0.1", ts: 2 },
          { posActId: seeded.acts[2], negActId: seeded.acts[7], locusPath: "0.1.1.1", ts: 3 },
        ],
        status: "CONVERGENT",
        length: 3,
        isLegal: true,
        legalityLog: { linearOk: true, parityOk: true, justifiedOk: true },
        extJson: { label: "Main thesis dispute" },
      },
    });
    seeded.disputes.push(mainDispute.id);

    const altDispute = await prisma.ludicDispute.create({
      data: {
        deliberationId: DELIBERATION_ID,
        posDesignId: proponentAltDesign.id,
        negDesignId: opponentAltDesign.id,
        actionPairs: [
          { posActId: seeded.acts[9], negActId: seeded.acts[10], locusPath: "0.2", ts: 1 },
        ],
        status: "ONGOING",
        length: 1,
        isLegal: true,
        extJson: { label: "Alternative argument dispute" },
      },
    });
    seeded.disputes.push(altDispute.id);

    console.log(`   ✅ Created ${seeded.disputes.length} disputes`);

    // =========================================================================
    // PHASE 1: Create Views
    // =========================================================================
    console.log("\n👁️ Creating views...");

    // Proponent view from main dispute
    const proponentView = await prisma.ludicView.create({
      data: {
        designId: proponentDesign.id,
        player: "P",
        viewSequence: [
          { focus: "0", ramification: ["0.1"], polarity: "P", actId: seeded.acts[0] },
          { focus: "0.1", ramification: ["0.1.1", "0.1.2"], polarity: "P", actId: seeded.acts[1] },
          { focus: "0.1.1", ramification: ["0.1.1.1"], polarity: "P", actId: seeded.acts[2] },
        ],
        parentDisputeId: mainDispute.id,
        extJson: { extractedFrom: "main-dispute" },
      },
    });
    seeded.views.push(proponentView.id);

    // Opponent view from main dispute
    const opponentView = await prisma.ludicView.create({
      data: {
        designId: opponentDesign.id,
        player: "O",
        viewSequence: [
          { focus: "0", ramification: ["0.1"], polarity: "O", actId: seeded.acts[5] },
          { focus: "0.1", ramification: ["0.1.1"], polarity: "O", actId: seeded.acts[6] },
          { focus: "0.1.1.1", ramification: ["0.1.1.2"], polarity: "O", actId: seeded.acts[7] },
        ],
        parentDisputeId: mainDispute.id,
        extJson: { extractedFrom: "main-dispute" },
      },
    });
    seeded.views.push(opponentView.id);

    console.log(`   ✅ Created ${seeded.views.length} views`);

    // =========================================================================
    // PHASE 1: Create Positions
    // =========================================================================
    console.log("\n📍 Creating positions...");

    const mainPosition = await prisma.ludicPosition.create({
      data: {
        disputeId: mainDispute.id,
        sequence: [
          { focus: "0", polarity: "P" },
          { focus: "0", polarity: "O" },
          { focus: "0.1", polarity: "P" },
          { focus: "0.1", polarity: "O" },
          { focus: "0.1.1", polarity: "P" },
          { focus: "0.1.1.1", polarity: "O" },
        ],
        isLinear: true,
        isParity: true,
        isJustified: true,
        isVisible: true,
        isLegal: true,
        player: "P",
        validationLog: {
          linearCheck: "passed",
          parityCheck: "passed",
          justificationCheck: "passed",
        },
      },
    });
    seeded.positions.push(mainPosition.id);

    console.log(`   ✅ Created ${seeded.positions.length} positions`);

    // =========================================================================
    // PHASE 2: Create Strategies
    // =========================================================================
    console.log("\n♟️ Creating strategies...");

    const proponentStrategy = await prisma.ludicStrategy.create({
      data: {
        designId: proponentDesign.id,
        player: "P",
        isInnocent: true,
        satisfiesPropagation: true,
        playCount: 3,
        extJson: {
          determinismMap: {
            "view:0": "move:0.1",
            "view:0.1": "move:0.1.1",
          },
          saturationInfo: { isSaturated: true },
        },
      },
    });
    seeded.strategies.push(proponentStrategy.id);

    const opponentStrategy = await prisma.ludicStrategy.create({
      data: {
        designId: opponentDesign.id,
        player: "O",
        isInnocent: true,
        satisfiesPropagation: true,
        playCount: 2,
        extJson: {
          determinismMap: {
            "view:0": "move:0",
            "view:0.1": "move:0.1.1.1",
          },
        },
      },
    });
    seeded.strategies.push(opponentStrategy.id);

    console.log(`   ✅ Created ${seeded.strategies.length} strategies`);

    // =========================================================================
    // PHASE 2: Create Plays
    // =========================================================================
    console.log("\n🎮 Creating plays...");

    const play1 = await prisma.ludicPlay.create({
      data: {
        strategyId: proponentStrategy.id,
        sequence: [
          { focus: "0", ramification: ["0.1"], polarity: "P" },
          { focus: "0.1", ramification: ["0.1.1", "0.1.2"], polarity: "P" },
          { focus: "0.1.1", ramification: ["0.1.1.1"], polarity: "P" },
        ],
        length: 3,
        isPositive: true,
        extJson: { label: "Main argument play" },
      },
    });
    seeded.plays.push(play1.id);

    const play2 = await prisma.ludicPlay.create({
      data: {
        strategyId: proponentStrategy.id,
        sequence: [
          { focus: "0", ramification: ["0.1"], polarity: "P" },
          { focus: "0.1.2", ramification: [], polarity: "P" },
        ],
        length: 2,
        isPositive: true,
        extJson: { label: "Alternative evidence play" },
      },
    });
    seeded.plays.push(play2.id);

    const play3 = await prisma.ludicPlay.create({
      data: {
        strategyId: opponentStrategy.id,
        sequence: [
          { focus: "0", ramification: ["0.1"], polarity: "O" },
          { focus: "0.1.1.1", ramification: ["0.1.1.2"], polarity: "O" },
        ],
        length: 2,
        isPositive: false,
        extJson: { label: "Challenge play" },
      },
    });
    seeded.plays.push(play3.id);

    console.log(`   ✅ Created ${seeded.plays.length} plays`);

    // =========================================================================
    // PHASE 2: Create Innocence & Propagation Checks
    // =========================================================================
    console.log("\n🔍 Creating innocence and propagation checks...");

    await prisma.ludicInnocenceCheck.create({
      data: {
        strategyId: proponentStrategy.id,
        isInnocent: true,
        isDeterministic: true,
        isViewStable: true,
        violationLog: null,
      },
    });

    await prisma.ludicInnocenceCheck.create({
      data: {
        strategyId: opponentStrategy.id,
        isInnocent: true,
        isDeterministic: true,
        isViewStable: true,
        violationLog: null,
      },
    });

    await prisma.ludicPropagationCheck.create({
      data: {
        strategyId: proponentStrategy.id,
        satisfiesProp: true,
        violations: null,
      },
    });

    await prisma.ludicPropagationCheck.create({
      data: {
        strategyId: opponentStrategy.id,
        satisfiesProp: true,
        violations: null,
      },
    });

    console.log(`   ✅ Created innocence and propagation checks`);

    // =========================================================================
    // PHASE 2: Create Strategy Views
    // =========================================================================
    console.log("\n👀 Creating strategy views...");

    await prisma.ludicStrategyView.create({
      data: {
        strategyId: proponentStrategy.id,
        viewSequence: [{ focus: "0", polarity: "P" }],
        determinedMove: { focus: "0.1", ramification: ["0.1.1", "0.1.2"], polarity: "P" },
        playCount: 2,
      },
    });

    await prisma.ludicStrategyView.create({
      data: {
        strategyId: proponentStrategy.id,
        viewSequence: [
          { focus: "0", polarity: "P" },
          { focus: "0.1", polarity: "P" },
        ],
        determinedMove: { focus: "0.1.1", ramification: ["0.1.1.1"], polarity: "P" },
        playCount: 1,
      },
    });

    console.log(`   ✅ Created strategy views`);

    // =========================================================================
    // PHASE 3: Create Correspondences
    // =========================================================================
    console.log("\n🔗 Creating correspondences...");

    const correspondence = await prisma.ludicCorrespondence.create({
      data: {
        designId: proponentDesign.id,
        strategyId: proponentStrategy.id,
        correspondenceType: "design-to-strategy",
        isVerified: true,
        isomorphisms: {
          playsViews: true,
          viewsPlays: true,
          dispCh: true,
          chDisp: true,
        },
      },
    });
    seeded.correspondences.push(correspondence.id);

    // Create isomorphism checks
    const isoTypes = ["plays-views", "views-plays", "disp-ch", "ch-disp"];
    for (const isoType of isoTypes) {
      await prisma.ludicIsomorphismCheck.create({
        data: {
          correspondenceId: correspondence.id,
          isomorphismType: isoType,
          holds: true,
          evidence: { verified: true, method: "structural-comparison" },
        },
      });
    }

    console.log(`   ✅ Created ${seeded.correspondences.length} correspondences with isomorphism checks`);

    // =========================================================================
    // PHASE 3: Create Caches (may not be migrated yet)
    // =========================================================================
    console.log("\n💾 Creating caches...");

    try {
      await prisma.ludicDisputeCache.create({
        data: {
          designId: proponentDesign.id,
          allDisputes: [mainDispute.id, altDispute.id],
          disputeCount: 2,
        },
      });

      await prisma.ludicChronicleCache.create({
        data: {
          strategyId: proponentStrategy.id,
          allChronicles: [
            { sequence: [{ focus: "0" }, { focus: "0.1" }, { focus: "0.1.1" }], length: 3, isMaximal: true },
            { sequence: [{ focus: "0" }, { focus: "0.1.2" }], length: 2, isMaximal: false },
          ],
          chronicleCount: 2,
        },
      });

      console.log(`   ✅ Created caches`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist") || msg.includes("Foreign key constraint")) {
        console.log(`   ⚠️ Skipping caches (table not yet migrated or FK issue)`);
      } else throw e;
    }

    // =========================================================================
    // PHASE 5: Create Orthogonality Checks
    // =========================================================================
    console.log("\n⊥ Creating orthogonality checks...");

    try {
      await prisma.ludicOrthogonalityCheck.create({
        data: {
          strategyAId: proponentStrategy.id,
          strategyBId: opponentStrategy.id,
          isOrthogonal: true,
          reason: "All disputes converge (one ends with daimon)",
          counterDesigns: null,
        },
      });
      console.log(`   ✅ Created orthogonality checks`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist")) {
        console.log(`   ⚠️ Skipping orthogonality checks (table not yet migrated)`);
      } else throw e;
    }

    // =========================================================================
    // PHASE 5: Create Biorthogonal Closure
    // =========================================================================
    console.log("\n🔄 Creating biorthogonal closure...");

    try {
      await prisma.ludicBiorthogonalClosure.create({
        data: {
          deliberationId: DELIBERATION_ID,
          inputDesignIds: [proponentDesign.id, opponentDesign.id],
          closureIds: [proponentDesign.id, opponentDesign.id, proponentAltDesign.id, opponentAltDesign.id],
          iterations: 2,
          reachedFixpoint: true,
        },
      });
      console.log(`   ✅ Created biorthogonal closure`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist")) {
        console.log(`   ⚠️ Skipping biorthogonal closure (table not yet migrated)`);
      } else throw e;
    }

    // =========================================================================
    // PHASE 5: Create Game
    // =========================================================================
    console.log("\n🎲 Creating game...");

    try {
      await prisma.ludicGame.create({
        data: {
          deliberationId: DELIBERATION_ID,
          name: "Climate Policy Debate Game",
          positiveBehaviourId: proponentStrategy.id,
          negativeBehaviourId: opponentStrategy.id,
          arenaJson: {
            Gamma: ["0", "0.1", "0.1.1", "0.1.2", "0.1.1.1", "0.2"],
            Lambda: ["P", "O"],
            lambda: {
              "0": "P",
              "0.1": "P",
              "0.1.1": "P",
              "0.1.2": "P",
              "0.1.1.1": "O",
              "0.2": "P",
            },
          },
          positionsJson: [
            { sequence: ["0", "0.1", "0.1.1"], isLegal: true },
            { sequence: ["0", "0.1", "0.1.2"], isLegal: true },
            { sequence: ["0", "0.2"], isLegal: true },
          ],
        },
      });
      console.log(`   ✅ Created game`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist")) {
        console.log(`   ⚠️ Skipping game (table not yet migrated)`);
      } else throw e;
    }

    // =========================================================================
    // Create Chronicles (via LudicChronicle model)
    // =========================================================================
    console.log("\n📜 Creating chronicles...");

    // Get all proponent acts
    const pActs = await prisma.ludicAct.findMany({
      where: { designId: proponentDesign.id },
      orderBy: { orderInDesign: "asc" },
    });

    for (let i = 0; i < pActs.length; i++) {
      await prisma.ludicChronicle.create({
        data: {
          designId: proponentDesign.id,
          order: i,
          actId: pActs[i].id,
        },
      });
    }

    console.log(`   ✅ Created chronicles`);

    // =========================================================================
    // Create Trace
    // =========================================================================
    console.log("\n🔀 Creating trace...");

    try {
      const trace = await prisma.ludicTrace.create({
        data: {
          deliberationId: DELIBERATION_ID,
          posDesignId: proponentDesign.id,
          negDesignId: opponentDesign.id,
          steps: {
            pairs: [
              { posActId: seeded.acts[0], negActId: seeded.acts[5], locusPath: "0", ts: 1 },
              { posActId: seeded.acts[1], negActId: seeded.acts[6], locusPath: "0.1", ts: 2 },
              { posActId: seeded.acts[2], negActId: seeded.acts[7], locusPath: "0.1.1.1", ts: 3 },
            ],
          },
          status: "CONVERGENT",
          endedAtDaimonForParticipantId: "Opponent",
          extJson: {
            decisiveIndices: [2],
            usedAdditive: {},
          },
        },
      });
      seeded.traces.push(trace.id);
      console.log(`   ✅ Created ${seeded.traces.length} traces`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist")) {
        console.log(`   ⚠️ Skipping trace (table not yet migrated)`);
      } else throw e;
    }

    // =========================================================================
    // Summary
    // =========================================================================
    console.log("\n" + "=".repeat(60));
    console.log("✅ SEED COMPLETE!");
    console.log("=".repeat(60));
    console.log(`
📊 Summary:
   - Loci:            ${seeded.loci.length}
   - Designs:         ${seeded.designs.length}
   - Acts:            ${seeded.acts.length}
   - Views:           ${seeded.views.length}
   - Disputes:        ${seeded.disputes.length}
   - Positions:       ${seeded.positions.length}
   - Strategies:      ${seeded.strategies.length}
   - Plays:           ${seeded.plays.length}
   - Correspondences: ${seeded.correspondences.length}
   - Traces:          ${seeded.traces.length}

🎯 Test these features:
   1. Overview tab - should show stats grid
   2. Views tab - should list 2 views (P & O)
   3. Chronicles tab - should show chronicle sequence
   4. Strategy tab - should show innocence/propagation status
   5. Correspondence tab - should show verified isomorphisms
   6. Types tab - should infer types from designs
   7. Behaviours tab - should show orthogonality status
   8. Perf tab - should track computation metrics

🔗 Design IDs:
   - Proponent (main): ${proponentDesign.id}
   - Opponent (main):  ${opponentDesign.id}
   - Proponent (alt):  ${proponentAltDesign.id}
   - Opponent (alt):   ${opponentAltDesign.id}
`);

  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
