/**
 * Seed Script: Create Test Argument Chain with Epistemic Scopes
 * 
 * Creates an argument chain demonstrating Phase 4 features:
 * - Hypothetical scopes (e.g., "Suppose X...")
 * - Counterfactual scopes (e.g., "Had X been the case...")
 * - Conditional scopes (e.g., "If X, then...")
 * - Epistemic status on nodes (HYPOTHETICAL, COUNTERFACTUAL, etc.)
 * - Arguments with different dialectical roles
 * 
 * Usage: npx tsx scripts/seed-test-chain-scopes.ts
 * 
 * Prerequisites:
 * 1. Run `npx prisma db push` to apply the Phase 4 schema (EpistemicStatus, ScopeType, ArgumentScope)
 * 2. Run `npx prisma generate` to regenerate the Prisma client
 * 3. Set DATABASE_URL in .env
 * 4. A deliberation must exist (uses "ludics-forest-demo" by default)
 * 5. A user must exist (uses userId "12" by default)
 */

import { PrismaClient } from "@prisma/client";

// Type definitions for Phase 4 enums (use string literals for compatibility)
type EpistemicStatus = "ASSERTED" | "HYPOTHETICAL" | "COUNTERFACTUAL" | "CONDITIONAL" | "QUESTIONED" | "DENIED" | "SUSPENDED";
type ScopeType = "HYPOTHETICAL" | "COUNTERFACTUAL" | "CONDITIONAL" | "OPPONENT" | "MODAL";
type DialecticalRole = "PROPONENT" | "OPPONENT" | "MEDIATOR" | "CRITIC" | "THESIS" | "ANTITHESIS" | "SYNTHESIS" | "OBJECTION" | "RESPONSE";
import { mintClaimMoid } from "@/lib/ids/mintMoid";

const prisma = new PrismaClient();

// Configuration
const CONFIG = {
  deliberationId: "ludics-forest-demo",
  userId: "12",
  chainName: "Carbon Tax Policy Analysis (with Scopes)",
  chainDescription: "A structured argument chain examining carbon tax policy with hypothetical and counterfactual reasoning.",
  chainPurpose: "To explore the implications of different carbon tax policy scenarios using epistemic scopes.",
};

// Scheme keys
const SCHEME_KEYS = {
  practicalReasoning: "practical_reasoning",
  causal: "causal",
  expertOpinion: "expert_opinion",
  negativeConsequences: "negative_consequences",
  analogy: "analogy",
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
  // Phase 4 fields
  epistemicStatus?: EpistemicStatus;
  scopeRef?: string; // Reference to scope by our local ID
  dialecticalRole?: DialecticalRole;
}

interface ScopeData {
  id: string;
  scopeType: ScopeType;
  assumption: string;
  description?: string;
  color?: string;
}

interface EdgeData {
  sourceArgId: string;
  targetArgId: string;
  edgeType: "SUPPORTS" | "REFUTES" | "ENABLES" | "PRESUPPOSES" | "QUALIFIES";
  strength: number;
  description: string;
}

// Define scopes for hypothetical reasoning
const SCOPES: ScopeData[] = [
  {
    id: "scope-carbon-tax-passes",
    scopeType: "HYPOTHETICAL",
    assumption: "Suppose a $50/ton carbon tax is enacted in 2025",
    description: "Exploring the consequences of a moderate carbon pricing policy",
    color: "#f59e0b", // Amber
  },
  {
    id: "scope-high-carbon-tax",
    scopeType: "COUNTERFACTUAL",
    assumption: "Had a $150/ton carbon tax been enacted in 2015",
    description: "Examining what would have happened with aggressive early action",
    color: "#8b5cf6", // Purple
  },
  {
    id: "scope-industry-resistance",
    scopeType: "CONDITIONAL",
    assumption: "If industry mounts significant legal challenges",
    description: "Conditional on political/legal opposition",
    color: "#3b82f6", // Blue
  },
];

// Main chain arguments (ASSERTED - in the "actual world")
const MAIN_ARGUMENTS: ArgumentData[] = [
  {
    id: "arg-climate-urgency",
    conclusionText: "Climate change requires immediate policy action to reduce carbon emissions.",
    premises: [
      { text: "Global temperatures have risen 1.1°C above pre-industrial levels." },
      { text: "The IPCC projects 1.5°C warming by 2030 without intervention." },
      { text: "Each degree of warming increases extreme weather events by 30%." },
    ],
    schemeKey: SCHEME_KEYS.expertOpinion,
    epistemicStatus: "ASSERTED",
    dialecticalRole: "THESIS",
  },
  {
    id: "arg-carbon-pricing-effective",
    conclusionText: "Carbon pricing is the most economically efficient mechanism for reducing emissions.",
    premises: [
      { text: "Carbon taxes create market incentives for clean energy investment." },
      { text: "The EU ETS has reduced covered emissions by 35% since 2005." },
      { text: "Economic models show carbon pricing achieves reductions at 60% lower cost than regulations." },
    ],
    schemeKey: SCHEME_KEYS.causal,
    epistemicStatus: "ASSERTED",
    dialecticalRole: "THESIS",
  },
  {
    id: "arg-economic-concern",
    conclusionText: "Carbon taxes risk harming economic competitiveness and low-income households.",
    premises: [
      { text: "Energy costs would increase 15-25% under a $50/ton carbon tax." },
      { text: "Energy-intensive industries may relocate to jurisdictions without carbon pricing." },
      { text: "Low-income households spend a larger share of income on energy." },
    ],
    schemeKey: SCHEME_KEYS.negativeConsequences,
    epistemicStatus: "ASSERTED",
    dialecticalRole: "ANTITHESIS",
  },
];

// Arguments within the "Carbon Tax Passes" hypothetical scope
const HYPOTHETICAL_ARGUMENTS: ArgumentData[] = [
  {
    id: "arg-hypo-emission-reduction",
    conclusionText: "Under a $50/ton carbon tax, US emissions would decline 15-20% by 2030.",
    premises: [
      { text: "Modeling by Resources for the Future projects 15-20% reduction." },
      { text: "BC's carbon tax achieved 5-15% reduction at $30/ton." },
      { text: "Higher prices would accelerate renewable energy adoption by 40%." },
    ],
    schemeKey: SCHEME_KEYS.causal,
    epistemicStatus: "HYPOTHETICAL",
    scopeRef: "scope-carbon-tax-passes",
    dialecticalRole: "THESIS",
  },
  {
    id: "arg-hypo-revenue-dividend",
    conclusionText: "Carbon tax revenue could fund a $2,000/year dividend to offset household costs.",
    premises: [
      { text: "A $50/ton tax would generate approximately $300 billion annually." },
      { text: "Distributing revenue equally would give each household ~$2,000/year." },
      { text: "Canada's carbon dividend program shows this is administratively feasible." },
    ],
    schemeKey: SCHEME_KEYS.practicalReasoning,
    epistemicStatus: "HYPOTHETICAL",
    scopeRef: "scope-carbon-tax-passes",
    dialecticalRole: "RESPONSE",
  },
  {
    id: "arg-hypo-job-transition",
    conclusionText: "The carbon tax would create 500,000 clean energy jobs while displacing 200,000 fossil fuel jobs.",
    premises: [
      { text: "Clean energy sectors already employ more workers than fossil fuels." },
      { text: "Investment shifts would accelerate job growth in solar, wind, and efficiency." },
      { text: "Transition support programs would need $50 billion over 10 years." },
    ],
    schemeKey: SCHEME_KEYS.causal,
    epistemicStatus: "HYPOTHETICAL",
    scopeRef: "scope-carbon-tax-passes",
    dialecticalRole: "SYNTHESIS",
  },
];

// Arguments within the "High Carbon Tax in 2015" counterfactual scope
const COUNTERFACTUAL_ARGUMENTS: ArgumentData[] = [
  {
    id: "arg-counter-early-action",
    conclusionText: "Had aggressive carbon pricing started in 2015, we would have 40% lower emissions today.",
    premises: [
      { text: "Ten additional years of high carbon prices would have shifted investment earlier." },
      { text: "Compound effects of early clean energy deployment are significant." },
      { text: "Models show early action is 3x more effective than delayed action." },
    ],
    schemeKey: SCHEME_KEYS.causal,
    epistemicStatus: "COUNTERFACTUAL",
    scopeRef: "scope-high-carbon-tax",
    dialecticalRole: "THESIS",
  },
  {
    id: "arg-counter-missed-opportunity",
    conclusionText: "The decade of delay has locked in $2 trillion of high-carbon infrastructure.",
    premises: [
      { text: "Gas plants, pipelines, and inefficient buildings built 2015-2025 will operate for decades." },
      { text: "This infrastructure represents stranded asset risk of $500 billion." },
      { text: "Early action would have avoided these sunk costs." },
    ],
    schemeKey: SCHEME_KEYS.negativeConsequences,
    epistemicStatus: "COUNTERFACTUAL",
    scopeRef: "scope-high-carbon-tax",
    dialecticalRole: "OBJECTION",
  },
];

// Arguments within the "Industry Resistance" conditional scope
const CONDITIONAL_ARGUMENTS: ArgumentData[] = [
  {
    id: "arg-cond-legal-delay",
    conclusionText: "Legal challenges could delay carbon tax implementation by 3-5 years.",
    premises: [
      { text: "Industry groups have signaled intent to challenge carbon pricing authority." },
      { text: "Similar challenges to EPA regulations took 4 years to resolve." },
      { text: "State-level opposition would add additional legal complexity." },
    ],
    schemeKey: SCHEME_KEYS.analogy,
    epistemicStatus: "CONDITIONAL",
    scopeRef: "scope-industry-resistance",
    dialecticalRole: "OBJECTION",
  },
  {
    id: "arg-cond-political-backlash",
    conclusionText: "Visible price increases could trigger political backlash and policy reversal.",
    premises: [
      { text: "France's yellow vest protests forced carbon tax suspension." },
      { text: "Australian carbon tax was repealed after one election cycle." },
      { text: "Public support drops 20 points when gas prices rise visibly." },
    ],
    schemeKey: SCHEME_KEYS.analogy,
    epistemicStatus: "CONDITIONAL",
    scopeRef: "scope-industry-resistance",
    dialecticalRole: "OBJECTION",
  },
];

// Combine all arguments
const ALL_ARGUMENTS = [
  ...MAIN_ARGUMENTS,
  ...HYPOTHETICAL_ARGUMENTS,
  ...COUNTERFACTUAL_ARGUMENTS,
  ...CONDITIONAL_ARGUMENTS,
];

// Edge relationships
const EDGES: EdgeData[] = [
  // Main chain edges
  {
    sourceArgId: "arg-climate-urgency",
    targetArgId: "arg-carbon-pricing-effective",
    edgeType: "ENABLES",
    strength: 0.85,
    description: "Climate urgency establishes the need that carbon pricing addresses.",
  },
  {
    sourceArgId: "arg-economic-concern",
    targetArgId: "arg-carbon-pricing-effective",
    edgeType: "REFUTES",
    strength: 0.60,
    description: "Economic concerns challenge the desirability of carbon pricing.",
  },
  // Hypothetical scope edges
  {
    sourceArgId: "arg-hypo-emission-reduction",
    targetArgId: "arg-carbon-pricing-effective",
    edgeType: "SUPPORTS",
    strength: 0.80,
    description: "Projected emission reductions support the effectiveness claim.",
  },
  {
    sourceArgId: "arg-hypo-revenue-dividend",
    targetArgId: "arg-economic-concern",
    edgeType: "REFUTES",
    strength: 0.75,
    description: "Dividend mechanism addresses the household cost concern.",
  },
  {
    sourceArgId: "arg-hypo-job-transition",
    targetArgId: "arg-hypo-emission-reduction",
    edgeType: "QUALIFIES",
    strength: 0.70,
    description: "Job transition effects qualify the emission reduction projections.",
  },
  // Counterfactual scope edges
  {
    sourceArgId: "arg-counter-early-action",
    targetArgId: "arg-climate-urgency",
    edgeType: "SUPPORTS",
    strength: 0.85,
    description: "Counterfactual analysis supports the urgency argument.",
  },
  {
    sourceArgId: "arg-counter-missed-opportunity",
    targetArgId: "arg-counter-early-action",
    edgeType: "SUPPORTS",
    strength: 0.80,
    description: "Missed opportunities reinforce the value of early action.",
  },
  // Conditional scope edges
  {
    sourceArgId: "arg-cond-legal-delay",
    targetArgId: "arg-carbon-pricing-effective",
    edgeType: "REFUTES",
    strength: 0.55,
    description: "Implementation delays undermine near-term effectiveness.",
  },
  {
    sourceArgId: "arg-cond-political-backlash",
    targetArgId: "arg-cond-legal-delay",
    edgeType: "SUPPORTS",
    strength: 0.65,
    description: "Political backlash compounds legal delay concerns.",
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
  const conclusionClaim = await createClaim(argData.conclusionText);
  
  const premiseClaims: ClaimData[] = [];
  for (const premise of argData.premises) {
    const claim = await createClaim(premise.text);
    premiseClaims.push(claim);
  }
  
  const argument = await prisma.argument.create({
    data: {
      deliberationId: CONFIG.deliberationId,
      authorId: CONFIG.userId,
      text: "",
      conclusionClaimId: conclusionClaim.id,
      schemeId: schemeId,
      implicitWarrant: argData.implicitWarrant ? { text: argData.implicitWarrant } : undefined,
    },
  });
  
  for (const premiseClaim of premiseClaims) {
    await prisma.argumentPremise.create({
      data: {
        argumentId: argument.id,
        claimId: premiseClaim.id,
        isImplicit: false,
      },
    });
  }
  
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
  
  const statusLabel = argData.epistemicStatus || "ASSERTED";
  const scopeLabel = argData.scopeRef ? ` [${argData.scopeRef}]` : "";
  console.log(`  ✓ Created argument (${statusLabel}${scopeLabel}): "${argData.conclusionText.slice(0, 50)}..."`);
  return argument.id;
}

async function main() {
  console.log("\n🌱 Seeding Test Argument Chain with Epistemic Scopes\n");
  console.log("=".repeat(70));
  
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
    
    for (const argData of ALL_ARGUMENTS) {
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
    
    // Create scopes
    console.log("🔮 Creating epistemic scopes...");
    const scopeIdMap: Record<string, string> = {};
    
    // Check if ArgumentScope table exists (Phase 4 schema)
    let scopesSupported = true;
    try {
      await prisma.argumentScope.findFirst();
    } catch {
      scopesSupported = false;
      console.log("  ⚠ ArgumentScope table not found - run `npx prisma db push` to apply Phase 4 schema");
      console.log("  ⚠ Skipping scope creation, nodes will be created without scope assignments\n");
    }
    
    if (scopesSupported) {
      for (const scopeData of SCOPES) {
        const scope = await prisma.argumentScope.create({
          data: {
            chainId: chain.id,
            scopeType: scopeData.scopeType,
            assumption: scopeData.assumption,
            description: scopeData.description,
            color: scopeData.color,
            depth: 0,
            createdBy: BigInt(CONFIG.userId),
          },
        });
        scopeIdMap[scopeData.id] = scope.id;
        console.log(`  ✓ Created scope (${scopeData.scopeType}): "${scopeData.assumption.slice(0, 50)}..."`);
      }
      console.log("");
    }
    
    // Create chain nodes with epistemic status and scope assignments
    console.log("📍 Creating chain nodes with epistemic status...");
    const nodeIdMap: Record<string, string> = {};
    let nodeOrder = 1;
    
    // Layout positions for visual organization
    const positions: Record<string, { x: number; y: number }> = {
      // Main chain (center column)
      "arg-climate-urgency": { x: 400, y: 50 },
      "arg-carbon-pricing-effective": { x: 400, y: 200 },
      "arg-economic-concern": { x: 700, y: 200 },
      // Hypothetical scope (left side)
      "arg-hypo-emission-reduction": { x: 100, y: 350 },
      "arg-hypo-revenue-dividend": { x: 100, y: 500 },
      "arg-hypo-job-transition": { x: 100, y: 650 },
      // Counterfactual scope (center-right)
      "arg-counter-early-action": { x: 400, y: 400 },
      "arg-counter-missed-opportunity": { x: 400, y: 550 },
      // Conditional scope (right side)
      "arg-cond-legal-delay": { x: 700, y: 400 },
      "arg-cond-political-backlash": { x: 700, y: 550 },
    };
    
    // Role mapping
    const roleMap: Record<string, "PREMISE" | "EVIDENCE" | "CONCLUSION" | "OBJECTION" | "REBUTTAL" | "QUALIFIER"> = {
      "arg-climate-urgency": "PREMISE",
      "arg-carbon-pricing-effective": "CONCLUSION",
      "arg-economic-concern": "OBJECTION",
      "arg-hypo-emission-reduction": "EVIDENCE",
      "arg-hypo-revenue-dividend": "REBUTTAL",
      "arg-hypo-job-transition": "QUALIFIER",
      "arg-counter-early-action": "EVIDENCE",
      "arg-counter-missed-opportunity": "EVIDENCE",
      "arg-cond-legal-delay": "OBJECTION",
      "arg-cond-political-backlash": "OBJECTION",
    };
    
    for (const argData of ALL_ARGUMENTS) {
      const scopeId = (scopesSupported && argData.scopeRef) ? scopeIdMap[argData.scopeRef] : null;
      const position = positions[argData.id] || { x: 0, y: nodeOrder * 150 };
      
      // Base node data (always supported)
      const nodeData: Record<string, unknown> = {
        chain: { connect: { id: chain.id } },
        argument: { connect: { id: argumentIdMap[argData.id] } },
        role: roleMap[argData.id] || "PREMISE",
        nodeOrder: nodeOrder++,
        contributor: { connect: { id: BigInt(CONFIG.userId) } },
        positionX: position.x,
        positionY: position.y,
      };
      
      // Add Phase 4 fields if scopes are supported (schema has been migrated)
      if (scopesSupported) {
        nodeData.epistemicStatus = argData.epistemicStatus || "ASSERTED";
        if (scopeId) {
          nodeData.scope = { connect: { id: scopeId } };
        }
        if (argData.dialecticalRole) {
          nodeData.dialecticalRole = argData.dialecticalRole;
        }
      }
      
      // @ts-expect-error - Dynamic data object for compatibility
      const node = await prisma.argumentChainNode.create({ data: nodeData });
      nodeIdMap[argData.id] = node.id;
      
      const statusLabel = argData.epistemicStatus || "ASSERTED";
      const statusEmojiMap: Record<string, string> = {
        ASSERTED: "✓",
        HYPOTHETICAL: "💡",
        COUNTERFACTUAL: "🔮",
        CONDITIONAL: "❓",
      };
      const statusEmoji = statusEmojiMap[statusLabel] || "✓";
      
      console.log(`  ${statusEmoji} Node ${nodeOrder - 1}: ${roleMap[argData.id] || "PREMISE"} (${argData.epistemicStatus || "ASSERTED"})`);
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
      console.log(`  ✓ Created edge: ${edgeData.edgeType} (${Math.round(edgeData.strength * 100)}%)`);
    }
    
    // Summary
    console.log("\n" + "=".repeat(70));
    console.log("✅ Seed complete!\n");
    console.log(`Chain ID: ${chain.id}`);
    console.log(`Chain Name: ${chain.name}`);
    console.log("");
    console.log("📊 Summary:");
    console.log(`  • Total Arguments: ${ALL_ARGUMENTS.length}`);
    console.log(`  • Scopes: ${scopesSupported ? SCOPES.length : "0 (schema not migrated)"}`);
    console.log(`    - Hypothetical: ${HYPOTHETICAL_ARGUMENTS.length} arguments`);
    console.log(`    - Counterfactual: ${COUNTERFACTUAL_ARGUMENTS.length} arguments`);
    console.log(`    - Conditional: ${CONDITIONAL_ARGUMENTS.length} arguments`);
    console.log(`  • Main Chain (Asserted): ${MAIN_ARGUMENTS.length} arguments`);
    console.log(`  • Edges: ${EDGES.length}`);
    console.log("");
    if (scopesSupported) {
      console.log("🔮 Epistemic Scopes Created:");
      const scopeEmojiMap: Record<string, string> = { HYPOTHETICAL: "💡", COUNTERFACTUAL: "🔮", CONDITIONAL: "❓" };
      for (const scope of SCOPES) {
        const emoji = scopeEmojiMap[scope.scopeType] || "📦";
        console.log(`  ${emoji} ${scope.scopeType}: "${scope.assumption}"`);
      }
    } else {
      console.log("⚠️  Scopes NOT created - run `npx prisma db push` then re-run this script.");
    }
    console.log(`\n🔗 View in app: /deliberation/${CONFIG.deliberationId}/chains/${chain.id}`);
    console.log("");
    
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
