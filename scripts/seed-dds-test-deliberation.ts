/**
 * Seed DDS Test Deliberation
 * 
 * Creates a well-structured deliberation with designs that properly exercise
 * all four Faggian-Hyland (2002) isomorphisms:
 * 
 * 1. Plays(Views(S)) = S  - Strategy ↔ Views roundtrip
 * 2. Views(Plays(V)) = V  - Views ↔ Plays roundtrip
 * 3. Disp(Ch(S)) = S      - Strategy ↔ Chronicles via Disputes roundtrip
 * 4. Ch(Disp(D)) = D      - Disputes ↔ Chronicles roundtrip
 * 
 * The seeded deliberation creates:
 * - A dialogue with root locus "0"
 * - Tree-structured loci: 0 → 0.1, 0.2 → 0.1.1, 0.1.2, 0.2.1 → etc.
 * - Multiple designs (P and O positions) with proper acts at each locus
 * - Orthogonal counter-designs to generate meaningful disputes
 */

import { prisma } from "../lib/prisma-cli";

const TEST_DIALOGUE_ID = "dds-test-dialogue-001";
const TEST_DELIBERATION_ID = "dds-test-deliberation-001";

interface LocusSpec {
  path: string;
  depth: number;
  expectedPolarity: "P" | "O";
}

// Define the tree structure for testing
// Depth determines polarity: odd = P, even = O
const LOCUS_TREE: LocusSpec[] = [
  { path: "0", depth: 1, expectedPolarity: "P" },
  { path: "0.1", depth: 2, expectedPolarity: "O" },
  { path: "0.2", depth: 2, expectedPolarity: "O" },
  { path: "0.1.1", depth: 3, expectedPolarity: "P" },
  { path: "0.1.2", depth: 3, expectedPolarity: "P" },
  { path: "0.2.1", depth: 3, expectedPolarity: "P" },
  { path: "0.1.1.1", depth: 4, expectedPolarity: "O" },
  { path: "0.1.1.2", depth: 4, expectedPolarity: "O" },
  { path: "0.1.2.1", depth: 4, expectedPolarity: "O" },
  { path: "0.1.1.1.1", depth: 5, expectedPolarity: "P" },
];

interface DesignSpec {
  name: string;
  participantId: string;
  // Which locus paths this design covers
  locusPaths: string[];
  // Expression at each locus
  expressions: Record<string, string>;
}

// Define test designs - each covering different parts of the tree
const DESIGN_SPECS: DesignSpec[] = [
  {
    name: "P-Full-Left",
    participantId: "Proponent",
    locusPaths: ["0", "0.1", "0.1.1", "0.1.1.1", "0.1.1.1.1"],
    expressions: {
      "0": "Initial claim: The proposal should be accepted",
      "0.1": "Response: Addressing concern A",
      "0.1.1": "Elaboration: Evidence for claim",
      "0.1.1.1": "Counter-response: Refuting objection",
      "0.1.1.1.1": "Final justification",
    },
  },
  {
    name: "P-Full-Right",
    participantId: "Proponent",
    locusPaths: ["0", "0.2", "0.2.1"],
    expressions: {
      "0": "Initial claim: The proposal should be accepted",
      "0.2": "Response: Addressing concern B",
      "0.2.1": "Elaboration: Alternative evidence",
    },
  },
  {
    name: "O-Counter-Left",
    participantId: "Opponent",
    locusPaths: ["0.1", "0.1.1", "0.1.1.1", "0.1.1.2"],
    expressions: {
      "0.1": "Challenge: Questioning premise A",
      "0.1.1": "P's defense of premise",
      "0.1.1.1": "O's further objection",
      "0.1.1.2": "Alternative objection path",
    },
  },
  {
    name: "O-Counter-Branch",
    participantId: "Opponent",
    locusPaths: ["0.1", "0.1.2", "0.1.2.1"],
    expressions: {
      "0.1": "Challenge: Different angle on premise A",
      "0.1.2": "P's alternative response",
      "0.1.2.1": "O's final challenge",
    },
  },
  {
    name: "P-Mixed",
    participantId: "Proponent",
    locusPaths: ["0", "0.1", "0.1.1", "0.1.2", "0.2"],
    expressions: {
      "0": "Initial claim variant",
      "0.1": "Addressing multiple concerns",
      "0.1.1": "Evidence path A",
      "0.1.2": "Evidence path B",
      "0.2": "Secondary argument",
    },
  },
];

async function cleanup() {
  console.log("Cleaning up existing test data...");
  
  // Find existing test deliberation designs
  const existingDesigns = await prisma.ludicDesign.findMany({
    where: { deliberationId: TEST_DELIBERATION_ID },
    select: { id: true },
  });
  
  if (existingDesigns.length > 0) {
    for (const design of existingDesigns) {
      // Delete strategy plays first
      const strategies = await prisma.ludicStrategy.findMany({
        where: { designId: design.id },
        select: { id: true },
      });
      
      for (const strat of strategies) {
        await prisma.ludicPlay.deleteMany({ where: { strategyId: strat.id } });
      }
      await prisma.ludicStrategy.deleteMany({ where: { designId: design.id } });
      
      // Delete disputes (actionPairs is JSON, not separate table)
      await prisma.ludicDispute.deleteMany({
        where: { OR: [{ posDesignId: design.id }, { negDesignId: design.id }] },
      });
      
      // Delete chronicles (must be before acts - chronicles reference acts)
      await prisma.ludicChronicle.deleteMany({ where: { designId: design.id } });
      
      // Delete views (must be before acts)
      await prisma.ludicView.deleteMany({ where: { designId: design.id } });
      
      // Delete acts
      await prisma.ludicAct.deleteMany({ where: { designId: design.id } });
    }
    
    // Delete traces that reference these designs
    await prisma.ludicTrace.deleteMany({
      where: {
        OR: existingDesigns.map(d => ({ OR: [{ posDesignId: d.id }, { negDesignId: d.id }] }))
      }
    });
    
    // Delete designs
    await prisma.ludicDesign.deleteMany({ where: { deliberationId: TEST_DELIBERATION_ID } });
    
    console.log(`  Cleaned up ${existingDesigns.length} designs`);
  }
  
  // Delete loci
  const deletedLoci = await prisma.ludicLocus.deleteMany({ 
    where: { dialogueId: TEST_DIALOGUE_ID } 
  });
  if (deletedLoci.count > 0) {
    console.log(`  Deleted ${deletedLoci.count} loci`);
  }
  
  // Check if deliberation exists and note it
  const delib = await prisma.deliberation.findUnique({
    where: { id: TEST_DELIBERATION_ID },
  });
  
  if (!delib) {
    console.log("  No existing test deliberation");
  } else {
    console.log("  Will reuse existing deliberation:", TEST_DELIBERATION_ID);
  }
}

async function createDeliberation() {
  console.log("Creating/finding test deliberation...");
  
  // Check if deliberation already exists
  let deliberation = await prisma.deliberation.findUnique({
    where: { id: TEST_DELIBERATION_ID },
  });
  
  if (deliberation) {
    console.log("  Using existing deliberation:", deliberation.id);
    return deliberation;
  }
  
  // Need to find an existing deliberation to copy hostType pattern from
  const sampleDelib = await prisma.deliberation.findFirst();
  if (!sampleDelib) {
    throw new Error("No existing deliberations found to model test after");
  }
  
  // Create deliberation with same host pattern
  deliberation = await prisma.deliberation.create({
    data: {
      id: TEST_DELIBERATION_ID,
      hostType: sampleDelib.hostType,
      hostId: "dds-test-host-001",
      createdById: sampleDelib.createdById,
      title: "DDS Isomorphism Test Deliberation",
    },
  });
  
  console.log("  Created deliberation:", deliberation.id);
  return deliberation;
}

async function createLoci() {
  console.log("Creating locus tree...");
  
  const lociMap = new Map<string, string>(); // path -> id
  
  // Create loci in depth order (parents first)
  const sortedLoci = [...LOCUS_TREE].sort((a, b) => a.depth - b.depth);
  
  for (const spec of sortedLoci) {
    // Find parent
    const parentPath = spec.path.includes(".") 
      ? spec.path.split(".").slice(0, -1).join(".")
      : null;
    
    const parentId = parentPath ? lociMap.get(parentPath) : null;
    
    const locus = await prisma.ludicLocus.create({
      data: {
        dialogueId: TEST_DIALOGUE_ID,
        path: spec.path,
        parentId,
      },
    });
    
    lociMap.set(spec.path, locus.id);
    console.log(`  Created locus: ${spec.path} (depth ${spec.depth}, ${spec.expectedPolarity})`);
  }
  
  return lociMap;
}

async function createDesigns(lociMap: Map<string, string>) {
  console.log("Creating designs...");
  
  const designs: { id: string; spec: DesignSpec }[] = [];
  
  for (const spec of DESIGN_SPECS) {
    // Get root locus for this design
    const rootPath = spec.locusPaths[0];
    const rootLocusId = lociMap.get(rootPath);
    
    if (!rootLocusId) {
      console.error(`  ERROR: Root locus ${rootPath} not found for design ${spec.name}`);
      continue;
    }
    
    const design = await prisma.ludicDesign.create({
      data: {
        deliberationId: TEST_DELIBERATION_ID,
        participantId: spec.participantId,
        rootLocusId,
      },
    });
    
    console.log(`  Created design: ${spec.name} (${design.id.substring(0, 8)})`);
    
    // Create acts for each locus
    let order = 0;
    for (const locusPath of spec.locusPaths) {
      const locusId = lociMap.get(locusPath);
      if (!locusId) {
        console.error(`    ERROR: Locus ${locusPath} not found`);
        continue;
      }
      
      const locusSpec = LOCUS_TREE.find(l => l.path === locusPath);
      const polarity = locusSpec?.expectedPolarity || "P";
      
      // Compute ramification: what child indices are available from this locus
      const childIndices = spec.locusPaths
        .filter(p => p.startsWith(locusPath + ".") && p.split(".").length === locusPath.split(".").length + 1)
        .map(p => p.split(".").pop()!)
        .filter(Boolean);
      
      await prisma.ludicAct.create({
        data: {
          designId: design.id,
          locusId,
          kind: "PROPER",
          polarity,
          ramification: childIndices,
          expression: spec.expressions[locusPath] || `Act at ${locusPath}`,
          orderInDesign: order++,
        },
      });
      
      console.log(`    Created act at ${locusPath} (${polarity}, ramification: [${childIndices.join(", ")}])`);
    }
    
    designs.push({ id: design.id, spec });
  }
  
  return designs;
}

async function main() {
  console.log("\n=== Seeding DDS Test Deliberation ===\n");
  
  try {
    // 1. Cleanup
    await cleanup();
    
    // 2. Create deliberation
    await createDeliberation();
    
    // 3. Create locus tree
    const lociMap = await createLoci();
    
    // 4. Create designs
    const designs = await createDesigns(lociMap);
    
    // Summary
    console.log("\n=== Seed Complete ===");
    console.log(`Deliberation ID: ${TEST_DELIBERATION_ID}`);
    console.log(`Dialogue ID: ${TEST_DIALOGUE_ID}`);
    console.log(`Loci created: ${lociMap.size}`);
    console.log(`Designs created: ${designs.length}`);
    console.log("\nDesign IDs for testing:");
    for (const d of designs) {
      console.log(`  ${d.spec.name}: ${d.id}`);
    }
    
    console.log("\n=== Tree Structure ===");
    console.log("0 (P)");
    console.log("├── 0.1 (O)");
    console.log("│   ├── 0.1.1 (P)");
    console.log("│   │   ├── 0.1.1.1 (O)");
    console.log("│   │   │   └── 0.1.1.1.1 (P)");
    console.log("│   │   └── 0.1.1.2 (O)");
    console.log("│   └── 0.1.2 (P)");
    console.log("│       └── 0.1.2.1 (O)");
    console.log("└── 0.2 (O)");
    console.log("    └── 0.2.1 (P)");
    
  } catch (error) {
    console.error("Error seeding:", error);
    throw error;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
