/**
 * Seed Script: Create Test Argument Chain
 * 
 * Creates a clean argument chain with realistic arguments for testing
 * all output formats (prose, narrative, AIF, canvas, etc.)
 * 
 * Usage: npx tsx scripts/seed-test-chain.ts
 * 
 * Requirements:
 * - DATABASE_URL must be set in .env
 * - A deliberation must exist (uses "ludics-forest-demo" by default)
 * - A user must exist (uses userId "12" by default)
 */

import { PrismaClient } from "@prisma/client";
import { mintClaimMoid } from "@/lib/ids/mintMoid";

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  deliberationId: "ludics-forest-demo",
  userId: "12",
  chainName: "AI Governance Policy Chain",
  chainDescription: "A structured argument chain examining the case for AI safety regulation, including supporting evidence, practical considerations, and potential objections.",
  chainPurpose: "To analyze and evaluate arguments for and against mandatory AI safety testing requirements.",
};

// Scheme keys that should exist in the database
const SCHEME_KEYS = {
  practicalReasoning: "practical_reasoning",
  expertOpinion: "expert_opinion",
  analogy: "analogy",
  sign: "sign",
  negativeConsequences: "negative_consequences",
  causal: "causal",
  positionToKnow: "position_to_know",
};

interface ClaimData {
  id: string;
  text: string;
}

interface ArgumentData {
  id: string;
  conclusionText: string;
  premises: { text: string; isImplicit?: boolean }[];
  schemeKey: string;
  implicitWarrant?: string;
}

interface EdgeData {
  sourceArgId: string;
  targetArgId: string;
  edgeType: "SUPPORTS" | "REFUTES" | "ENABLES" | "PRESUPPOSES" | "QUALIFIES" | "EXEMPLIFIES" | "GENERALIZES";
  strength: number;
  description: string;
}

// Clean, realistic argument data
const ARGUMENTS: ArgumentData[] = [
  {
    id: "arg-ai-risk-evidence",
    conclusionText: "Advanced AI systems pose significant alignment and safety risks that are not adequately addressed by current industry self-regulation.",
    premises: [
      { text: "Recent AI capability gains have outpaced safety research by a factor of 10:1 in terms of published papers and funding." },
      { text: "Multiple frontier AI labs have reported near-miss incidents involving unintended model behaviors." },
      { text: "Current voluntary safety commitments lack enforcement mechanisms and measurable benchmarks." },
    ],
    schemeKey: SCHEME_KEYS.sign,
    implicitWarrant: "Observable indicators of risk without corresponding mitigation measures suggest inadequate safety protocols.",
  },
  {
    id: "arg-expert-consensus",
    conclusionText: "Leading AI researchers believe that without intervention, advanced AI development poses existential risks within the next two decades.",
    premises: [
      { text: "Geoffrey Hinton, Yoshua Bengio, and Stuart Russell—pioneers in deep learning—have publicly warned about AI existential risks." },
      { text: "A 2023 survey of NeurIPS researchers found 36% believe AI poses a ≥10% chance of human extinction." },
      { text: "The signatories of the AI safety statement represent over 50% of leading AI research institutions globally." },
    ],
    schemeKey: SCHEME_KEYS.expertOpinion,
  },
  {
    id: "arg-nuclear-analogy",
    conclusionText: "AI development requires regulatory oversight similar to what was established for nuclear technology.",
    premises: [
      { text: "Nuclear technology and advanced AI share characteristics: dual-use potential, catastrophic downside risks, and rapid capability scaling." },
      { text: "The nuclear industry successfully implemented safety regulations that enabled beneficial uses while preventing catastrophic misuse." },
      { text: "Both technologies involve complex systems where small errors can cascade into large-scale failures." },
    ],
    schemeKey: SCHEME_KEYS.analogy,
  },
  {
    id: "arg-practical-policy",
    conclusionText: "Governments should implement mandatory safety testing and certification requirements for AI systems above certain capability thresholds.",
    premises: [
      { text: "The goal is to enable beneficial AI development while preventing catastrophic risks." },
      { text: "Mandatory safety testing would create accountability and standardized benchmarks for AI safety." },
      { text: "This approach has successfully balanced innovation and safety in pharmaceuticals, aviation, and automotive industries." },
    ],
    schemeKey: SCHEME_KEYS.practicalReasoning,
    implicitWarrant: "If an action achieves a desirable goal without unacceptable costs, and no better alternative exists, then that action should be taken.",
  },
  {
    id: "arg-innovation-concern",
    conclusionText: "Premature AI regulation could stifle innovation and cede technological leadership to less safety-conscious jurisdictions.",
    premises: [
      { text: "Regulatory compliance costs disproportionately burden smaller AI companies and academic researchers." },
      { text: "Countries without AI safety regulations may gain competitive advantages in AI development speed." },
      { text: "Overly prescriptive rules may lock in current approaches and prevent novel safety solutions." },
    ],
    schemeKey: SCHEME_KEYS.negativeConsequences,
  },
  {
    id: "arg-rebuttal-innovation",
    conclusionText: "Well-designed AI safety regulation can promote rather than hinder innovation by creating clear standards and public trust.",
    premises: [
      { text: "The EU's GDPR, despite initial concerns, led to growth in privacy-tech companies and increased consumer trust." },
      { text: "Clear regulatory frameworks reduce uncertainty that currently chills investment in AI safety research." },
      { text: "International coordination through bodies like the OECD can prevent regulatory arbitrage." },
    ],
    schemeKey: SCHEME_KEYS.causal,
  },
  {
    id: "arg-implementation-proposal",
    conclusionText: "An effective AI safety regulatory framework should include tiered requirements based on capability assessments, mandatory incident reporting, and independent auditing.",
    premises: [
      { text: "Tiered regulation allows proportionate oversight—lighter for narrow AI, stricter for frontier systems." },
      { text: "Mandatory incident reporting enables collective learning from failures, as in aviation safety." },
      { text: "Independent auditing ensures accountability without requiring regulators to have cutting-edge AI expertise." },
    ],
    schemeKey: SCHEME_KEYS.practicalReasoning,
  },
];

// Edge relationships between arguments
const EDGES: EdgeData[] = [
  {
    sourceArgId: "arg-ai-risk-evidence",
    targetArgId: "arg-practical-policy",
    edgeType: "SUPPORTS",
    strength: 0.85,
    description: "Evidence of inadequate self-regulation supports the need for mandatory oversight.",
  },
  {
    sourceArgId: "arg-expert-consensus",
    targetArgId: "arg-practical-policy",
    edgeType: "SUPPORTS",
    strength: 0.80,
    description: "Expert warnings about existential risk support the urgency of regulatory action.",
  },
  {
    sourceArgId: "arg-nuclear-analogy",
    targetArgId: "arg-practical-policy",
    edgeType: "SUPPORTS",
    strength: 0.75,
    description: "The nuclear precedent demonstrates that safety regulation can coexist with technological progress.",
  },
  {
    sourceArgId: "arg-innovation-concern",
    targetArgId: "arg-practical-policy",
    edgeType: "REFUTES",
    strength: 0.65,
    description: "Concerns about innovation provide a counterargument to broad regulatory mandates.",
  },
  {
    sourceArgId: "arg-rebuttal-innovation",
    targetArgId: "arg-innovation-concern",
    edgeType: "REFUTES",
    strength: 0.70,
    description: "Evidence from GDPR and other regulations rebuts the claim that regulation necessarily harms innovation.",
  },
  {
    sourceArgId: "arg-practical-policy",
    targetArgId: "arg-implementation-proposal",
    edgeType: "ENABLES",
    strength: 0.90,
    description: "The general case for regulation enables discussion of specific implementation mechanisms.",
  },
  {
    sourceArgId: "arg-ai-risk-evidence",
    targetArgId: "arg-expert-consensus",
    edgeType: "PRESUPPOSES",
    strength: 0.70,
    description: "Observable risk indicators presuppose and validate expert assessments.",
  },
];

async function findOrCreateScheme(schemeKey: string): Promise<string | null> {
  const scheme = await prisma.argumentScheme.findFirst({
    where: { key: schemeKey },
  });
  
  if (scheme) {
    console.log(`  ✓ Found scheme: ${scheme.name} (${schemeKey})`);
    return scheme.id;
  }
  
  console.log(`  ⚠ Scheme not found: ${schemeKey}`);
  return null;
}

async function createClaim(text: string): Promise<ClaimData> {
  const moid = mintClaimMoid(text);
  
  // Check if claim already exists
  const existing = await prisma.claim.findUnique({ where: { moid } });
  if (existing) {
    console.log(`    (reusing existing claim: "${text.slice(0, 40)}...")`);
    return { id: existing.id, text: existing.text };
  }
  
  const claim = await prisma.claim.create({
    data: {
      text,
      moid,
      deliberationId: CONFIG.deliberationId,
      createdById: CONFIG.userId,
    },
  });
  return { id: claim.id, text: claim.text };
}

async function createArgument(argData: ArgumentData, schemeId: string | null): Promise<string> {
  // Create conclusion claim
  const conclusionClaim = await createClaim(argData.conclusionText);
  
  // Create premise claims
  const premiseClaims: ClaimData[] = [];
  for (const premise of argData.premises) {
    const claim = await createClaim(premise.text);
    premiseClaims.push(claim);
  }
  
  // Create argument
  const argument = await prisma.argument.create({
    data: {
      deliberationId: CONFIG.deliberationId,
      authorId: CONFIG.userId,
      text: "", // Using conclusion claim for display text
      conclusionClaimId: conclusionClaim.id,
      schemeId: schemeId,
      implicitWarrant: argData.implicitWarrant ? { text: argData.implicitWarrant } : undefined,
    },
  });
  
  // Link premises
  for (const premiseClaim of premiseClaims) {
    await prisma.argumentPremise.create({
      data: {
        argumentId: argument.id,
        claimId: premiseClaim.id,
        isImplicit: false,
      },
    });
  }
  
  // Create ArgumentSchemeInstance if scheme exists
  if (schemeId) {
    await prisma.argumentSchemeInstance.create({
      data: {
        argumentId: argument.id,
        schemeId: schemeId,
        confidence: 1.0,
        isPrimary: true,
        role: "primary",
        explicitness: "explicit",
        ruleType: "DEFEASIBLE",
      },
    });
  }
  
  console.log(`  ✓ Created argument: "${argData.conclusionText.slice(0, 60)}..."`);
  return argument.id;
}

async function main() {
  console.log("\n🌱 Seeding Test Argument Chain\n");
  console.log("=" .repeat(60));
  
  try {
    // Verify deliberation exists
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: CONFIG.deliberationId },
    });
    
    if (!deliberation) {
      throw new Error(`Deliberation not found: ${CONFIG.deliberationId}`);
    }
    console.log(`✓ Found deliberation: ${deliberation.title}\n`);
    
    // Find schemes
    console.log("📚 Looking up argumentation schemes...");
    const schemeMap: Record<string, string | null> = {};
    for (const [key, schemeKey] of Object.entries(SCHEME_KEYS)) {
      schemeMap[schemeKey] = await findOrCreateScheme(schemeKey);
    }
    console.log("");
    
    // Create arguments
    console.log("📝 Creating arguments...");
    const argumentIdMap: Record<string, string> = {};
    
    for (const argData of ARGUMENTS) {
      const schemeId = schemeMap[argData.schemeKey] || null;
      const argumentId = await createArgument(argData, schemeId);
      argumentIdMap[argData.id] = argumentId;
    }
    console.log("");
    
    // Create the chain
    console.log("🔗 Creating argument chain...");
    const chain = await prisma.argumentChain.create({
      data: {
        name: CONFIG.chainName,
        description: CONFIG.chainDescription,
        purpose: CONFIG.chainPurpose,
        deliberationId: CONFIG.deliberationId,
        createdBy: BigInt(CONFIG.userId),
        chainType: "CONVERGENT",
        isPublic: true,
      },
    });
    console.log(`  ✓ Created chain: ${chain.name} (${chain.id})\n`);
    
    // Create chain nodes
    console.log("📍 Creating chain nodes...");
    const nodeIdMap: Record<string, string> = {};
    let nodeOrder = 1;
    
    // Determine roles based on position in argument structure
    const roleMap: Record<string, "PREMISE" | "EVIDENCE" | "CONCLUSION" | "OBJECTION"> = {
      "arg-ai-risk-evidence": "EVIDENCE",
      "arg-expert-consensus": "EVIDENCE",
      "arg-nuclear-analogy": "EVIDENCE",
      "arg-practical-policy": "CONCLUSION",
      "arg-innovation-concern": "OBJECTION",
      "arg-rebuttal-innovation": "EVIDENCE",
      "arg-implementation-proposal": "CONCLUSION",
    };
    
    for (const argData of ARGUMENTS) {
      const node = await prisma.argumentChainNode.create({
        data: {
          chain: { connect: { id: chain.id } },
          argument: { connect: { id: argumentIdMap[argData.id] } },
          role: roleMap[argData.id] || "PREMISE",
          nodeOrder: nodeOrder++,
          contributor: { connect: { id: BigInt(CONFIG.userId) } },
          positionX: 0,
          positionY: 0,
        },
      });
      nodeIdMap[argData.id] = node.id;
      console.log(`  ✓ Created node ${nodeOrder - 1}: ${roleMap[argData.id] || "PREMISE"}`);
    }
    console.log("");
    
    // Create chain edges
    console.log("↔️  Creating chain edges...");
    for (const edgeData of EDGES) {
      const sourceNodeId = nodeIdMap[edgeData.sourceArgId];
      const targetNodeId = nodeIdMap[edgeData.targetArgId];
      
      if (!sourceNodeId || !targetNodeId) {
        console.log(`  ⚠ Skipping edge: missing node for ${edgeData.sourceArgId} -> ${edgeData.targetArgId}`);
        continue;
      }
      
      await prisma.argumentChainEdge.create({
        data: {
          chain: { connect: { id: chain.id } },
          sourceNode: { connect: { id: sourceNodeId } },
          targetNode: { connect: { id: targetNodeId } },
          edgeType: edgeData.edgeType,
          strength: edgeData.strength,
          description: edgeData.description,
        },
      });
      console.log(`  ✓ Created edge: ${edgeData.edgeType} (${edgeData.strength * 100}%)`);
    }
    
    console.log("\n" + "=" .repeat(60));
    console.log("✅ Seed complete!\n");
    console.log(`Chain ID: ${chain.id}`);
    console.log(`Chain Name: ${chain.name}`);
    console.log(`Arguments: ${ARGUMENTS.length}`);
    console.log(`Edges: ${EDGES.length}`);
    console.log(`\nView in app: /deliberation/${CONFIG.deliberationId}/chains/${chain.id}`);
    console.log("");
    
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
