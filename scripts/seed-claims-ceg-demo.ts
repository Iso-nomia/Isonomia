/**
 * Seed script for populating Claims with CEG (Critical Evaluation Graph) structure
 * 
 * Purpose: Generate a realistic claim argumentation graph with dialogical moves
 * Usage: tsx scripts/seed-claims-ceg-demo.ts <deliberationId>
 * 
 * Features:
 * - Creates interconnected claims with support/rebuttal relationships
 * - Generates realistic attack types (REBUTS, UNDERCUTS, UNDERMINES)
 * - Simulates dialogical moves and counter-arguments
 * - Creates temporal progression of argumentation
 * - Produces a rich CEG graph for visualization in CegMiniMap
 * 
 * Example:
 *   tsx scripts/seed-claims-ceg-demo.ts cmgy6c8vz0000c04w4l9khiux
 */

import { prisma } from "@/lib/prismaclient";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { recomputeGroundedForDelib } from "@/lib/ceg/grounded";
import { ClaimAttackType, ClaimEdgeType } from "@prisma/client";

// ============================================================
// CONFIGURATION
// ============================================================

interface SeedConfig {
  deliberationId: string;
  clearExisting: boolean;
  verbose: boolean;
}

// ============================================================
// MOCK DATA - Climate Policy Argumentation
// ============================================================

interface MockClaim {
  text: string;
  claimType?: string;
  /** Which claims this supports (by index) */
  supports?: number[];
  /** Which claims this rebuts (by index) */
  rebuts?: number[];
  /** Which claims this undercuts (by index, attacks inference) */
  undercuts?: number[];
  /** Which claims this undermines (by index, attacks premises) */
  undermines?: number[];
  /** Relative timestamp offset in hours from seed start */
  timeOffset?: number;
}

/**
 * A realistic climate policy deliberation with:
 * - Main policy proposals (positions)
 * - Supporting arguments (pro/con)
 * - Counter-arguments and rebuttals
 * - Meta-arguments about reasoning quality
 */
const MOCK_CLAIMS: MockClaim[] = [
  // ===== MAIN POSITIONS =====
  {
    text: "The city should mandate solar panels on all new construction to accelerate renewable energy adoption.",
    claimType: "Assertion",
    timeOffset: 0,
  },
  {
    text: "We should prioritize retrofitting existing buildings over regulating new construction.",
    claimType: "Assertion",
    timeOffset: 2,
  },
  {
    text: "Market incentives are more effective than mandates for driving sustainable building practices.",
    claimType: "Assertion",
    timeOffset: 4,
  },

  // ===== SUPPORTING ARGUMENTS FOR POSITION 0 (solar mandates) =====
  {
    text: "Solar mandates have successfully reduced carbon emissions by 30% in comparable cities.",
    claimType: "Assertion",
    supports: [0],
    timeOffset: 6,
  },
  {
    text: "The upfront cost of solar installation is offset by energy savings within 7 years.",
    claimType: "Assertion",
    supports: [0],
    timeOffset: 8,
  },
  {
    text: "Building codes already impose many requirements; adding solar is a logical extension.",
    claimType: "Assertion",
    supports: [0],
    timeOffset: 10,
  },

  // ===== REBUTTALS TO POSITION 0 =====
  {
    text: "Solar mandates will increase housing costs by 15-20%, pricing out first-time homebuyers.",
    claimType: "Assertion",
    rebuts: [0],
    timeOffset: 12,
  },
  {
    text: "Not all buildings are suitable for solar due to orientation, shading, or structural limitations.",
    claimType: "Assertion",
    rebuts: [0],
    timeOffset: 14,
  },
  {
    text: "Mandates create bureaucratic overhead and stifle innovation in alternative green technologies.",
    claimType: "Assertion",
    rebuts: [0],
    timeOffset: 16,
  },

  // ===== COUNTER-REBUTTALS (supporting position 0 by attacking rebuttals) =====
  {
    text: "Housing cost increases from solar are minimal compared to long-term energy savings and property value gains.",
    claimType: "Assertion",
    rebuts: [6],
    timeOffset: 18,
  },
  {
    text: "Building suitability assessments can be built into permitting, with exemptions for genuinely unsuitable structures.",
    claimType: "Assertion",
    rebuts: [7],
    timeOffset: 20,
  },

  // ===== SUPPORTING ARGUMENTS FOR POSITION 1 (retrofitting) =====
  {
    text: "Existing buildings account for 90% of the current building stock and 85% of energy consumption.",
    claimType: "Assertion",
    supports: [1],
    timeOffset: 22,
  },
  {
    text: "Retrofitting creates immediate impact, while new construction mandates take years to show results.",
    claimType: "Assertion",
    supports: [1],
    timeOffset: 24,
  },
  {
    text: "Many existing buildings are energy inefficient and represent low-hanging fruit for emissions reductions.",
    claimType: "Assertion",
    supports: [1],
    timeOffset: 26,
  },

  // ===== REBUTTALS TO POSITION 1 =====
  {
    text: "Retrofitting existing buildings is 3x more expensive per unit of carbon reduction than new construction standards.",
    claimType: "Assertion",
    rebuts: [1],
    timeOffset: 28,
  },
  {
    text: "Property owners lack incentives to retrofit, making enforcement of retrofit mandates politically infeasible.",
    claimType: "Assertion",
    rebuts: [1],
    timeOffset: 30,
  },

  // ===== SUPPORTING ARGUMENTS FOR POSITION 2 (market incentives) =====
  {
    text: "Tax credits for solar installation have driven 400% growth in voluntary adoption over the past decade.",
    claimType: "Assertion",
    supports: [2],
    timeOffset: 32,
  },
  {
    text: "Market-based approaches preserve consumer choice and avoid one-size-fits-all mandates.",
    claimType: "Assertion",
    supports: [2],
    timeOffset: 34,
  },
  {
    text: "Incentives can be targeted to communities and building types where they will be most effective.",
    claimType: "Assertion",
    supports: [2],
    timeOffset: 36,
  },

  // ===== REBUTTALS TO POSITION 2 =====
  {
    text: "Market incentives are insufficient; they have failed to achieve the scale and speed of emissions reductions required.",
    claimType: "Assertion",
    rebuts: [2],
    timeOffset: 38,
  },
  {
    text: "Tax incentives disproportionately benefit wealthy property owners who would install solar anyway.",
    claimType: "Assertion",
    rebuts: [2],
    timeOffset: 40,
  },
  {
    text: "Voluntary programs lack the predictability needed for solar manufacturers to scale production and reduce costs.",
    claimType: "Assertion",
    rebuts: [2],
    timeOffset: 42,
  },

  // ===== UNDERCUTS (attacking inference/reasoning) =====
  {
    text: "The cited study on emissions reductions did not control for concurrent policy changes, making causal claims unreliable.",
    claimType: "Assertion",
    undercuts: [3], // undercuts the inference from "comparable cities" to "will work here"
    timeOffset: 44,
  },
  {
    text: "The 7-year payback calculation assumes stable energy prices, which is unrealistic given market volatility.",
    claimType: "Assertion",
    undercuts: [4], // undercuts the economic reasoning
    timeOffset: 46,
  },
  {
    text: "Comparing solar mandates to existing building codes is a false equivalence; safety codes serve a fundamentally different purpose.",
    claimType: "Assertion",
    undercuts: [5], // undercuts the analogy
    timeOffset: 48,
  },

  // ===== UNDERMINES (attacking premises/data) =====
  {
    text: "The claim that existing buildings account for 90% of stock is outdated; recent development has been rapid in our region.",
    claimType: "Assertion",
    undermines: [11], // undermines the factual premise
    timeOffset: 50,
  },
  {
    text: "The 3x cost comparison fails to account for co-benefits of retrofitting like improved air quality and comfort.",
    claimType: "Assertion",
    undermines: [14], // undermines the cost comparison premise
    timeOffset: 52,
  },
  {
    text: "The 400% growth claim cherry-picks a favorable time period; growth has stagnated in recent years.",
    claimType: "Assertion",
    undermines: [16], // undermines the data premise
    timeOffset: 54,
  },

  // ===== COMPLEX DIALOGICAL MOVES =====
  {
    text: "Both mandates and incentives are needed; a hybrid approach addresses the limitations of each strategy.",
    claimType: "Assertion",
    supports: [0, 2], // supports multiple positions
    rebuts: [1], // while rebutting the third
    timeOffset: 56,
  },
  {
    text: "The entire debate assumes solar is the only solution, but emerging technologies may render this discussion obsolete.",
    claimType: "Assertion",
    rebuts: [0, 1, 2], // challenges all main positions
    timeOffset: 58,
  },
  {
    text: "We should conduct a pilot program to gather local data before committing to any citywide policy.",
    claimType: "Assertion",
    rebuts: [0, 1, 2], // suggests alternative to all positions
    timeOffset: 60,
  },

  // ===== META-ARGUMENTS (about the debate itself) =====
  {
    text: "This deliberation lacks input from low-income communities who will be most affected by housing cost changes.",
    claimType: "Assertion",
    undercuts: [6, 9], // undercuts arguments about housing costs by questioning the debate's legitimacy
    timeOffset: 62,
  },
  {
    text: "We're debating implementation details before establishing whether climate action is economically justified for our city.",
    claimType: "Assertion",
    undercuts: [0, 1, 2], // challenges the framing of all positions
    timeOffset: 64,
  },

  // ===== ADDITIONAL SUPPORTING CLAIMS =====
  {
    text: "Climate scientists overwhelmingly agree that immediate action on emissions is necessary to avoid catastrophic warming.",
    claimType: "Assertion",
    supports: [0, 1], // supports taking action (multiple approaches)
    timeOffset: 66,
  },
  {
    text: "Cities that delay climate action face higher adaptation costs later, making early investment fiscally prudent.",
    claimType: "Assertion",
    supports: [0, 1, 2], // supports all action-oriented positions
    timeOffset: 68,
  },
  {
    text: "Our city's solar resource potential is among the highest in the region, making solar particularly viable here.",
    claimType: "Assertion",
    supports: [0], // supports solar mandates specifically
    timeOffset: 70,
  },
  {
    text: "Public opinion polls show 73% support for city action on climate, with majority support across political affiliations.",
    claimType: "Assertion",
    supports: [0, 1, 2], // supports taking some action
    timeOffset: 72,
  },

  // ===== FINAL REBUTTALS & SYNTHESIS =====
  {
    text: "The hybrid approach sounds appealing but risks creating administrative complexity that undermines both strategies.",
    claimType: "Assertion",
    rebuts: [28], // rebuts the hybrid proposal
    timeOffset: 74,
  },
  {
    text: "Waiting for emerging technologies is a form of delay tactics; we must act on proven solutions now.",
    claimType: "Assertion",
    rebuts: [29], // rebuts the emerging tech argument
    timeOffset: 76,
  },
  {
    text: "Pilot programs are valuable for learning, but our climate timeline demands parallel action at scale.",
    claimType: "Assertion",
    rebuts: [30], // partial rebuttal to pilot proposal
    timeOffset: 78,
  },
];

// ============================================================
// MOCK USERS
// ============================================================

interface MockUser {
  name: string;
  username: string;
  auth_id: string;
  bio?: string;
}

const MOCK_USERS: MockUser[] = [
  {
    name: "Dr. Sarah Chen",
    username: "schen",
    auth_id: "demo-ceg-auth-schen",
    bio: "Urban sustainability researcher and policy analyst",
  },
  {
    name: "Marcus Rodriguez",
    username: "mrodriguez",
    auth_id: "demo-ceg-auth-mrodriguez",
    bio: "Local developer and housing advocate",
  },
  {
    name: "Aisha Thompson",
    username: "athompson",
    auth_id: "demo-ceg-auth-athompson",
    bio: "Climate scientist and community organizer",
  },
  {
    name: "James Park",
    username: "jpark",
    auth_id: "demo-ceg-auth-jpark",
    bio: "Economics professor specializing in environmental policy",
  },
  {
    name: "Elena Volkov",
    username: "evolkov",
    auth_id: "demo-ceg-auth-evolkov",
    bio: "Architect and green building consultant",
  },
  {
    name: "David Osei",
    username: "dosei",
    auth_id: "demo-ceg-auth-dosei",
    bio: "City council member and fiscal conservative",
  },
  {
    name: "Maya Patel",
    username: "mpatel",
    auth_id: "demo-ceg-auth-mpatel",
    bio: "Renewable energy engineer and entrepreneur",
  },
  {
    name: "Robert Kim",
    username: "rkim",
    auth_id: "demo-ceg-auth-rkim",
    bio: "Community representative from affordable housing coalition",
  },
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function log(message: string, verbose: boolean = true) {
  if (verbose) console.log(message);
}

function logSection(title: string, verbose: boolean = true) {
  if (verbose) {
    console.log("\n" + "=".repeat(60));
    console.log(title);
    console.log("=".repeat(60) + "\n");
  }
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// ============================================================
// SEEDING LOGIC
// ============================================================

async function validateDeliberation(deliberationId: string): Promise<void> {
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, title: true },
  });

  if (!delib) {
    throw new Error(`Deliberation ${deliberationId} not found`);
  }

  log(`✅ Found deliberation: ${delib.title || delib.id}`, true);
}

async function clearExistingClaims(deliberationId: string, config: SeedConfig) {
  if (!config.clearExisting) return;

  logSection("🗑️  CLEARING EXISTING CLAIMS", config.verbose);

  // Delete edges first (foreign key constraints)
  const deletedEdges = await prisma.claimEdge.deleteMany({
    where: { deliberationId },
  });
  log(`   Deleted ${deletedEdges.count} claim edges`, config.verbose);

  // Delete claims
  const deletedClaims = await prisma.claim.deleteMany({
    where: { deliberationId },
  });
  log(`   Deleted ${deletedClaims.count} claims`, config.verbose);

  log("✅ Cleared existing data\n", config.verbose);
}

async function ensureUsers(config: SeedConfig): Promise<Array<{ id: string; username: string }>> {
  log("👥 Ensuring users exist...", config.verbose);

  const users = [];

  for (const mockUser of MOCK_USERS) {
    let user = await prisma.user.findUnique({
      where: { auth_id: mockUser.auth_id },
      select: { id: true, username: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          auth_id: mockUser.auth_id,
          name: mockUser.name,
          username: mockUser.username,
          bio: mockUser.bio,
        },
        select: { id: true, username: true },
      });
      log(`   ✅ Created user: ${mockUser.name}`, config.verbose);
    } else {
      log(`   ℹ️  Using existing user: ${mockUser.username}`, config.verbose);
    }

    users.push({
      id: user.id.toString(),
      username: user.username,
    });
  }

  log(`✅ Ensured ${users.length} users\n`, config.verbose);
  return users;
}

async function seedClaims(
  deliberationId: string,
  users: Array<{ id: string; username: string }>,
  config: SeedConfig
): Promise<Array<{ id: string; index: number }>> {
  logSection("📝 SEEDING CLAIMS", config.verbose);

  const baseTime = new Date();
  const createdClaims: Array<{ id: string; index: number }> = [];

  for (let i = 0; i < MOCK_CLAIMS.length; i++) {
    const mockClaim = MOCK_CLAIMS[i];
    const author = randomChoice(users);
    
    // Calculate timestamp based on timeOffset
    const timestamp = new Date(baseTime.getTime() + (mockClaim.timeOffset || 0) * 60 * 60 * 1000);
    
    const moid = mintClaimMoid(mockClaim.text);

    const claim = await prisma.claim.create({
      data: {
        deliberationId,
        text: mockClaim.text,
        createdById: author.id,
        moid,
        claimType: mockClaim.claimType || null,
        createdAt: timestamp,
      },
    });

    createdClaims.push({ id: claim.id, index: i });

    log(`✅ Created claim ${i + 1}/${MOCK_CLAIMS.length}: ${author.username}`, config.verbose);
    log(`   "${mockClaim.text.substring(0, 70)}..."`, config.verbose);
  }

  log(`\n✅ Created ${createdClaims.length} claims\n`, config.verbose);
  return createdClaims;
}

async function seedClaimEdges(
  deliberationId: string,
  createdClaims: Array<{ id: string; index: number }>,
  config: SeedConfig
) {
  logSection("🔗 SEEDING CLAIM EDGES", config.verbose);

  let edgeCount = 0;

  for (const claim of createdClaims) {
    const mockClaim = MOCK_CLAIMS[claim.index];

    // Create support edges
    if (mockClaim.supports) {
      for (const targetIndex of mockClaim.supports) {
        const targetClaim = createdClaims.find(c => c.index === targetIndex);
        if (!targetClaim) {
          log(`⚠️  Warning: Support target ${targetIndex} not found for claim ${claim.index}`, config.verbose);
          continue;
        }

        await prisma.claimEdge.create({
          data: {
            deliberationId,
            fromClaimId: claim.id,
            toClaimId: targetClaim.id,
            type: ClaimEdgeType.supports,
            attackType: ClaimAttackType.SUPPORTS,
            targetScope: null,
          },
        });

        edgeCount++;
        log(`   ✅ Support: ${claim.index} → ${targetIndex}`, config.verbose);
      }
    }

    // Create rebuttal edges
    if (mockClaim.rebuts) {
      for (const targetIndex of mockClaim.rebuts) {
        const targetClaim = createdClaims.find(c => c.index === targetIndex);
        if (!targetClaim) {
          log(`⚠️  Warning: Rebuttal target ${targetIndex} not found for claim ${claim.index}`, config.verbose);
          continue;
        }

        await prisma.claimEdge.create({
          data: {
            deliberationId,
            fromClaimId: claim.id,
            toClaimId: targetClaim.id,
            type: ClaimEdgeType.rebuts,
            attackType: ClaimAttackType.REBUTS,
            targetScope: "conclusion",
          },
        });

        edgeCount++;
        log(`   ✅ Rebuts: ${claim.index} → ${targetIndex}`, config.verbose);
      }
    }

    // Create undercut edges
    if (mockClaim.undercuts) {
      for (const targetIndex of mockClaim.undercuts) {
        const targetClaim = createdClaims.find(c => c.index === targetIndex);
        if (!targetClaim) {
          log(`⚠️  Warning: Undercut target ${targetIndex} not found for claim ${claim.index}`, config.verbose);
          continue;
        }

        await prisma.claimEdge.create({
          data: {
            deliberationId,
            fromClaimId: claim.id,
            toClaimId: targetClaim.id,
            type: ClaimEdgeType.rebuts,
            attackType: ClaimAttackType.UNDERCUTS,
            targetScope: "inference",
          },
        });

        edgeCount++;
        log(`   ✅ Undercuts: ${claim.index} → ${targetIndex}`, config.verbose);
      }
    }

    // Create undermine edges
    if (mockClaim.undermines) {
      for (const targetIndex of mockClaim.undermines) {
        const targetClaim = createdClaims.find(c => c.index === targetIndex);
        if (!targetClaim) {
          log(`⚠️  Warning: Undermine target ${targetIndex} not found for claim ${claim.index}`, config.verbose);
          continue;
        }

        await prisma.claimEdge.create({
          data: {
            deliberationId,
            fromClaimId: claim.id,
            toClaimId: targetClaim.id,
            type: ClaimEdgeType.rebuts,
            attackType: ClaimAttackType.UNDERMINES,
            targetScope: "premise",
          },
        });

        edgeCount++;
        log(`   ✅ Undermines: ${claim.index} → ${targetIndex}`, config.verbose);
      }
    }
  }

  log(`\n✅ Created ${edgeCount} claim edges\n`, config.verbose);
}

async function computeGroundedSemantics(deliberationId: string, config: SeedConfig) {
  logSection("🧮 COMPUTING GROUNDED SEMANTICS", config.verbose);

  try {
    await recomputeGroundedForDelib(deliberationId);
    log("✅ Grounded semantics computed successfully\n", config.verbose);
  } catch (error: any) {
    log(`⚠️  Warning: Grounded semantics computation failed: ${error.message}`, config.verbose);
    log("   CEG visualization will still work but labels may be missing\n", config.verbose);
  }
}

async function printSummary(deliberationId: string, config: SeedConfig) {
  logSection("📊 SEEDING SUMMARY", config.verbose);

  const claimCount = await prisma.claim.count({
    where: { deliberationId },
  });

  const edgeCount = await prisma.claimEdge.count({
    where: { deliberationId },
  });

  const edgesByType = await prisma.claimEdge.groupBy({
    by: ["attackType"],
    where: { deliberationId },
    _count: true,
  });

  const labelCounts = await prisma.claimLabel.groupBy({
    by: ["label"],
    where: { deliberationId },
    _count: true,
  });

  log(`Deliberation ID: ${deliberationId}`, config.verbose);
  log(`Total Claims: ${claimCount}`, config.verbose);
  log(`Total Edges: ${edgeCount}`, config.verbose);
  log("", config.verbose);
  
  log("Edges by type:", config.verbose);
  for (const edge of edgesByType) {
    log(`  ${edge.attackType}: ${edge._count}`, config.verbose);
  }
  log("", config.verbose);

  if (labelCounts.length > 0) {
    log("Grounded labels:", config.verbose);
    for (const label of labelCounts) {
      log(`  ${label.label}: ${label._count}`, config.verbose);
    }
  }

  log("", config.verbose);
  log(`🔗 View in app: /deliberation/${deliberationId}/claims`, config.verbose);
  log(`📊 CEG API: /api/claims/ceg?deliberationId=${deliberationId}`, config.verbose);
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log("\n🌱 Starting CEG Claim Seeding Script\n");

  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ Error: deliberationId is required");
    console.error("\nUsage: tsx scripts/seed-claims-ceg-demo.ts <deliberationId> [--clear] [--quiet]");
    console.error("\nExample: tsx scripts/seed-claims-ceg-demo.ts cmgy6c8vz0000c04w4l9khiux --clear");
    process.exit(1);
  }

  const config: SeedConfig = {
    deliberationId: args[0],
    clearExisting: args.includes("--clear"),
    verbose: !args.includes("--quiet"),
  };

  try {
    // 1. Validate deliberation exists
    await validateDeliberation(config.deliberationId);

    // 2. Ensure users exist
    const users = await ensureUsers(config);

    // 3. Clear existing data if requested
    await clearExistingClaims(config.deliberationId, config);

    // 4. Seed claims
    const createdClaims = await seedClaims(config.deliberationId, users, config);

    // 5. Seed claim edges (relationships)
    await seedClaimEdges(config.deliberationId, createdClaims, config);

    // 6. Compute grounded semantics
    await computeGroundedSemantics(config.deliberationId, config);

    // 7. Print summary
    await printSummary(config.deliberationId, config);

    logSection("✅ SEEDING COMPLETE!", config.verbose);

  } catch (error: any) {
    console.error("\n❌ Error during seeding:", error.message);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main as seedClaimsCegDemo };
