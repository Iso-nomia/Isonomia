/**
 * Seed script for populating Propositions in a Deliberation
 * 
 * Purpose: Generate realistic proposition data for onboarding demonstrations
 * Usage: tsx scripts/seed-propositions-demo.ts [deliberationId]
 * 
 * Features:
 * - Creates varied propositions with realistic text
 * - Adds votes (up/down) to simulate community engagement
 * - Adds endorsements from multiple users
 * - Creates threaded replies/discussions
 * - Simulates different statuses (PUBLISHED, CLAIMED)
 * - Realistic timestamps with temporal distribution
 */

import { prisma } from "@/lib/prismaclient";

// ============================================================
// CONFIGURATION
// ============================================================

interface SeedConfig {
  deliberationId?: string;
  propositionCount: number;
  minVotesPerProposition: number;
  maxVotesPerProposition: number;
  minEndorsementsPerProposition: number;
  maxEndorsementsPerProposition: number;
  minRepliesPerProposition: number;
  maxRepliesPerProposition: number;
  promoteSomePropositions: boolean;
  promotionRate: number; // 0.0 to 1.0
  clearExisting: boolean;
  verbose: boolean;
}

const DEFAULT_CONFIG: SeedConfig = {
  propositionCount: 12,
  minVotesPerProposition: 3,
  maxVotesPerProposition: 25,
  minEndorsementsPerProposition: 0,
  maxEndorsementsPerProposition: 8,
  minRepliesPerProposition: 0,
  maxRepliesPerProposition: 5,
  promoteSomePropositions: true,
  promotionRate: 0.25, // 25% of propositions get promoted to claims
  clearExisting: false,
  verbose: true,
};

// ============================================================
// MOCK DATA - Realistic Propositions for Policy Discussion
// ============================================================

interface MockProposition {
  text: string;
  mediaType?: string;
  mediaUrl?: string;
  /** Weight for initial vote distribution (higher = more popular) */
  popularityWeight?: number;
  /** Tags for categorization */
  tags?: string[];
}

// Topic: Climate Change Policy & Urban Planning
const MOCK_PROPOSITIONS: MockProposition[] = [
  {
    text: "We should mandate that all new buildings include solar panels and green roofs to reduce urban heat islands and improve energy independence.",
    popularityWeight: 8,
    tags: ["sustainability", "infrastructure", "energy"],
  },
  {
    text: "Public transportation should be free for all residents, funded by congestion pricing in downtown areas during peak hours.",
    popularityWeight: 7,
    tags: ["transportation", "equity", "funding"],
  },
  {
    text: "Instead of banning cars downtown, we should create dedicated bike lanes and pedestrian zones while maintaining limited vehicle access for deliveries.",
    popularityWeight: 6,
    tags: ["transportation", "urban-design", "compromise"],
  },
  {
    text: "The city should purchase and convert vacant lots into community gardens and urban farms, with priority given to low-income neighborhoods.",
    popularityWeight: 9,
    tags: ["food-security", "community", "green-space"],
  },
  {
    text: "We need to eliminate single-use plastics in all city facilities and events within 18 months, providing reusable alternatives.",
    popularityWeight: 5,
    tags: ["waste-reduction", "policy", "timeline"],
  },
  {
    text: "Rather than top-down mandates, we should offer tax incentives for businesses and homeowners who voluntarily adopt green practices.",
    popularityWeight: 4,
    tags: ["incentives", "voluntary", "business"],
  },
  {
    text: "The city should establish a citizen climate assembly with randomly selected residents to develop binding recommendations on climate policy.",
    popularityWeight: 6,
    tags: ["governance", "participation", "democracy"],
  },
  {
    text: "We must invest in climate resilience infrastructure like flood barriers and storm water management before pursuing other green initiatives.",
    popularityWeight: 7,
    tags: ["resilience", "infrastructure", "priorities"],
  },
  {
    text: "All new construction should be required to achieve net-zero carbon emissions, even if it increases initial building costs by 15-20%.",
    popularityWeight: 5,
    tags: ["construction", "standards", "carbon"],
  },
  {
    text: "The focus should be on retrofitting existing buildings for energy efficiency rather than only regulating new construction, since 90% of our buildings already exist.",
    popularityWeight: 8,
    tags: ["retrofitting", "existing-stock", "pragmatic"],
  },
  {
    text: "We should create a municipal green bank that provides low-interest loans for renewable energy installations and energy efficiency upgrades.",
    popularityWeight: 6,
    tags: ["financing", "renewable-energy", "access"],
  },
  {
    text: "Climate education should be integrated into K-12 curriculum, teaching students about local environmental challenges and empowering them as change agents.",
    popularityWeight: 7,
    tags: ["education", "youth", "long-term"],
  },
];

// ============================================================
// MOCK USERS - Diverse Participants
// ============================================================

interface MockUser {
  name: string;
  username: string;
  auth_id: string;
  bio?: string;
  /** Voting behavior: progressive, moderate, or conservative */
  votingStyle?: 'progressive' | 'moderate' | 'conservative';
  /** Reply activity level: 0-1 */
  replyActivity?: number;
}

const MOCK_USERS: MockUser[] = [
  {
    name: "Sarah Chen",
    auth_id: "demo-auth-schen",
    username: "schen",
    bio: "Urban planner focused on sustainable development",
    votingStyle: "progressive",
    replyActivity: 0.8,
  },
  {
    name: "Marcus Washington",
    auth_id: "demo-auth-mwash",
    username: "mwash",
    bio: "Small business owner and community advocate",
    votingStyle: "moderate",
    replyActivity: 0.5,
  },
  {
    name: "Aisha Patel",
    auth_id: "demo-auth-apatel",
    username: "apatel",
    bio: "Environmental science teacher",
    votingStyle: "progressive",
    replyActivity: 0.9,
  },
  {
    name: "James Rodriguez",
    auth_id: "demo-auth-jrodriguez",
    username: "jrodriguez",
    bio: "Real estate developer and fiscal conservative",
    votingStyle: "conservative",
    replyActivity: 0.4,
  },
  {
    name: "Emma Nakamura",
    auth_id: "demo-auth-enakamura",
    username: "enakamura",
    bio: "Climate scientist and data analyst",
    votingStyle: "progressive",
    replyActivity: 0.7,
  },
  {
    name: "David Okonkwo",
    auth_id: "demo-auth-dokonkwo",
    username: "dokonkwo",
    bio: "Transportation engineer",
    votingStyle: "moderate",
    replyActivity: 0.6,
  },
  {
    name: "Lisa Thompson",
    auth_id: "demo-auth-lthompson",
    username: "lthompson",
    bio: "Retired teacher and neighborhood association president",
    votingStyle: "moderate",
    replyActivity: 0.5,
  },
  {
    name: "Raj Kumar",
    auth_id: "demo-auth-rkumar",
    username: "rkumar",
    bio: "Tech entrepreneur interested in civic innovation",
    votingStyle: "progressive",
    replyActivity: 0.4,
  },
];

// ============================================================
// MOCK REPLIES - Realistic Discussion Threads
// ============================================================

interface MockReply {
  text: string;
  /** Index of user who writes this (relative to proposition author) */
  authorOffset?: number;
}

const REPLY_TEMPLATES: MockReply[][] = [
  // Thread type 1: Supportive with refinement
  [
    {
      text: "This is a great starting point. Have you considered how we could phase this in over time to reduce the burden on smaller developers?",
      authorOffset: 1,
    },
    {
      text: "I'd support this if we included provisions for historic buildings that can't easily accommodate solar panels due to structural limitations.",
      authorOffset: 2,
    },
  ],
  // Thread type 2: Constructive criticism
  [
    {
      text: "I appreciate the intent here, but I'm concerned about the implementation costs. Do we have any estimates on the budget impact?",
      authorOffset: 1,
    },
    {
      text: "Good point. We should probably pilot this in one district first and measure the results before citywide rollout.",
      authorOffset: 3,
    },
    {
      text: "Agreed. A phased approach with evaluation metrics would help build public support and allow for adjustments.",
      authorOffset: 0,
    },
  ],
  // Thread type 3: Alternative proposal
  [
    {
      text: "Rather than this approach, what if we focused on X instead? It might achieve similar goals with fewer tradeoffs.",
      authorOffset: 2,
    },
    {
      text: "That's an interesting alternative. Both approaches have merit - maybe we could combine elements of each?",
      authorOffset: 1,
    },
  ],
  // Thread type 4: Clarification request
  [
    {
      text: "Could you clarify what you mean by this? I want to make sure I understand the proposal correctly before weighing in.",
      authorOffset: 1,
    },
  ],
  // Thread type 5: Data-driven support
  [
    {
      text: "The data supports this approach. Cities that have implemented similar policies have seen 30% reductions in relevant metrics.",
      authorOffset: 2,
    },
    {
      text: "Can you share your sources? I'd like to review the studies you're referencing.",
      authorOffset: 3,
    },
  ],
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomSample<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Generate realistic timestamp within the last 2 weeks
 * Earlier propositions get earlier timestamps
 */
function generateTimestamp(index: number, total: number): Date {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  // Distribute timestamps across 2 weeks, with slight randomness
  const fraction = index / total;
  const baseTime = twoWeeksAgo.getTime() + fraction * 14 * 24 * 60 * 60 * 1000;
  
  // Add random jitter (±3 hours)
  const jitter = randomInt(-3 * 60 * 60 * 1000, 3 * 60 * 60 * 1000);
  
  return new Date(baseTime + jitter);
}

/**
 * Calculate vote distribution based on popularity weight
 * Returns { upvotes, downvotes } counts
 */
function calculateVoteDistribution(
  popularityWeight: number,
  minVotes: number,
  maxVotes: number
): { upvotes: number; downvotes: number } {
  const totalVotes = randomInt(minVotes, maxVotes);
  
  // Convert popularity weight (1-10) to upvote ratio (0.3-0.9)
  const upvoteRatio = 0.3 + (popularityWeight / 10) * 0.6;
  
  const upvotes = Math.round(totalVotes * upvoteRatio);
  const downvotes = totalVotes - upvotes;
  
  return { upvotes, downvotes };
}

/**
 * Determine if a user would upvote, downvote, or abstain based on:
 * - Proposition popularity weight
 * - User voting style
 * - Randomness
 */
function getUserVote(
  popularityWeight: number,
  votingStyle: string
): -1 | 0 | 1 {
  const rand = Math.random();
  
  // Base probability from popularity weight
  let upvoteProbability = popularityWeight / 10;
  
  // Adjust based on voting style
  if (votingStyle === 'progressive') {
    upvoteProbability *= 1.1;
  } else if (votingStyle === 'conservative') {
    upvoteProbability *= 0.8;
  }
  
  // 20% chance to abstain
  if (rand < 0.2) return 0;
  
  // Otherwise vote based on adjusted probability
  return rand < (0.2 + upvoteProbability * 0.6) ? 1 : -1;
}

// ============================================================
// LOGGING UTILITIES
// ============================================================

function log(message: string, verbose: boolean = true) {
  if (verbose) console.log(message);
}

function logSection(title: string, verbose: boolean = true) {
  if (verbose) {
    console.log('\n' + '='.repeat(60));
    console.log(title);
    console.log('='.repeat(60) + '\n');
  }
}

// ============================================================
// MAIN SEEDING LOGIC
// ============================================================

async function ensureDeliberation(
  config: SeedConfig
): Promise<{ id: string; title: string }> {
  // If deliberationId provided via CLI or config, use it
  if (config.deliberationId) {
    const existing = await prisma.deliberation.findUnique({
      where: { id: config.deliberationId },
      select: { id: true, title: true },
    });
    
    if (existing) {
      log(`✅ Using existing deliberation: ${existing.title || existing.id}`, config.verbose);
      return { id: existing.id, title: existing.title || 'Untitled Deliberation' };
    }
    
    throw new Error(`Deliberation ${config.deliberationId} not found`);
  }
  
  // Create a new deliberation for demo purposes
  log('📋 Creating new deliberation for demo...', config.verbose);
  
  const deliberation = await prisma.deliberation.create({
    data: {
      hostType: 'site',
      hostId: 'demo-onboarding',
      rule: 'utilitarian',
      k: 3,
      createdById: 'system',
      title: 'Climate Action & Urban Sustainability Policy',
      tags: ['demo', 'climate', 'urban-planning', 'onboarding'],
      proofMode: 'symmetric',
    },
    select: { id: true, title: true },
  });
  
  log(`✅ Created deliberation: ${deliberation.title}`, config.verbose);
  log(`   ID: ${deliberation.id}`, config.verbose);
  
  return { id: deliberation.id, title: deliberation.title || 'Untitled' };
}

async function ensureUsers(config: SeedConfig): Promise<Array<{ id: string; username: string; votingStyle: string; replyActivity: number }>> {
  log('👥 Ensuring users exist...', config.verbose);
  
  const users = [];
  
  for (const mockUser of MOCK_USERS) {
    // Try to find existing user by auth_id
    let user = await prisma.user.findUnique({
      where: { auth_id: mockUser.auth_id },
      select: { id: true, username: true },
    });
    
    // If not found, create
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
      votingStyle: mockUser.votingStyle || 'moderate',
      replyActivity: mockUser.replyActivity || 0.5,
    });
  }
  
  log(`✅ Ensured ${users.length} users\n`, config.verbose);
  return users;
}

async function clearExistingPropositions(deliberationId: string, config: SeedConfig) {
  if (!config.clearExisting) return;
  
  log('🗑️  Clearing existing propositions...', config.verbose);
  
  const deleted = await prisma.proposition.deleteMany({
    where: { deliberationId },
  });
  
  log(`✅ Deleted ${deleted.count} existing propositions\n`, config.verbose);
}

async function seedPropositions(
  deliberationId: string,
  users: Array<{ id: string; username: string }>,
  config: SeedConfig
) {
  logSection('📝 SEEDING PROPOSITIONS', config.verbose);
  
  const propositions = [];
  const count = Math.min(config.propositionCount, MOCK_PROPOSITIONS.length);
  
  for (let i = 0; i < count; i++) {
    const mockProp = MOCK_PROPOSITIONS[i];
    const author = randomChoice(users);
    const timestamp = generateTimestamp(i, count);
    
    const proposition = await prisma.proposition.create({
      data: {
        deliberationId,
        authorId: author.id,
        text: mockProp.text,
        mediaType: mockProp.mediaType || 'text',
        mediaUrl: mockProp.mediaUrl || null,
        status: 'PUBLISHED',
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
    
    propositions.push({
      ...proposition,
      popularityWeight: mockProp.popularityWeight || 5,
      tags: mockProp.tags || [],
    });
    
    log(`✅ Created proposition ${i + 1}/${count}`, config.verbose);
    log(`   "${mockProp.text.substring(0, 60)}..."`, config.verbose);
    log(`   Author: ${author.username}`, config.verbose);
  }
  
  log(`\n✅ Created ${propositions.length} propositions\n`, config.verbose);
  return propositions;
}

async function seedVotes(
  propositions: Array<{ id: string; popularityWeight: number }>,
  users: Array<{ id: string; votingStyle: string }>,
  config: SeedConfig
) {
  logSection('👍 SEEDING VOTES', config.verbose);
  
  let totalVotes = 0;
  
  for (const prop of propositions) {
    // Determine how many users will vote
    const voteDistribution = calculateVoteDistribution(
      prop.popularityWeight,
      config.minVotesPerProposition,
      config.maxVotesPerProposition
    );
    
    const votersNeeded = voteDistribution.upvotes + voteDistribution.downvotes;
    const voters = randomSample(users, Math.min(votersNeeded, users.length));
    
    let upvoteCount = 0;
    let downvoteCount = 0;
    
    // Assign votes to users
    for (const voter of voters) {
      const vote = getUserVote(prop.popularityWeight, voter.votingStyle);
      
      if (vote === 0) continue;
      
      // Only create vote if we haven't exceeded our target distribution
      if (vote === 1 && upvoteCount < voteDistribution.upvotes) {
        await prisma.propositionVote.create({
          data: {
            propositionId: prop.id,
            userId: voter.id,
            value: 1,
          },
        });
        upvoteCount++;
        totalVotes++;
      } else if (vote === -1 && downvoteCount < voteDistribution.downvotes) {
        await prisma.propositionVote.create({
          data: {
            propositionId: prop.id,
            userId: voter.id,
            value: -1,
          },
        });
        downvoteCount++;
        totalVotes++;
      }
    }
    
    // Update proposition counters
    await prisma.proposition.update({
      where: { id: prop.id },
      data: {
        voteUpCount: upvoteCount,
        voteDownCount: downvoteCount,
      },
    });
    
    log(`✅ Added ${upvoteCount} upvotes, ${downvoteCount} downvotes to proposition`, config.verbose);
  }
  
  log(`\n✅ Created ${totalVotes} total votes\n`, config.verbose);
}

async function seedEndorsements(
  propositions: Array<{ id: string; popularityWeight: number }>,
  users: Array<{ id: string }>,
  config: SeedConfig
) {
  logSection('⭐ SEEDING ENDORSEMENTS', config.verbose);
  
  let totalEndorsements = 0;
  
  for (const prop of propositions) {
    // Higher popularity = more endorsements
    const endorsementCount = randomInt(
      config.minEndorsementsPerProposition,
      Math.min(
        config.maxEndorsementsPerProposition,
        Math.floor(prop.popularityWeight * config.maxEndorsementsPerProposition / 10)
      )
    );
    
    if (endorsementCount === 0) continue;
    
    const endorsers = randomSample(users, Math.min(endorsementCount, users.length));
    
    for (const endorser of endorsers) {
      await prisma.propositionEndorsement.create({
        data: {
          propositionId: prop.id,
          userId: endorser.id,
        },
      });
      totalEndorsements++;
    }
    
    // Update proposition counter
    await prisma.proposition.update({
      where: { id: prop.id },
      data: {
        endorseCount: endorsers.length,
      },
    });
    
    log(`✅ Added ${endorsers.length} endorsements to proposition`, config.verbose);
  }
  
  log(`\n✅ Created ${totalEndorsements} total endorsements\n`, config.verbose);
}

async function seedReplies(
  propositions: Array<{ id: string; authorId: string }>,
  users: Array<{ id: string; replyActivity: number }>,
  config: SeedConfig
) {
  logSection('💬 SEEDING REPLIES', config.verbose);
  
  let totalReplies = 0;
  
  for (const prop of propositions) {
    const replyCount = randomInt(
      config.minRepliesPerProposition,
      config.maxRepliesPerProposition
    );
    
    if (replyCount === 0) continue;
    
    // Choose a reply template
    const template = randomChoice(REPLY_TEMPLATES);
    const actualReplies = template.slice(0, replyCount);
    
    // Get potential repliers (active users)
    const activeUsers = users.filter(u => Math.random() < u.replyActivity);
    
    for (const replyTemplate of actualReplies) {
      const replier = randomChoice(activeUsers.length > 0 ? activeUsers : users);
      
      await prisma.propositionReply.create({
        data: {
          propositionId: prop.id,
          authorId: replier.id,
          text: replyTemplate.text,
        },
      });
      totalReplies++;
    }
    
    // Update proposition counter
    await prisma.proposition.update({
      where: { id: prop.id },
      data: {
        replyCount: actualReplies.length,
      },
    });
    
    log(`✅ Added ${actualReplies.length} replies to proposition`, config.verbose);
  }
  
  log(`\n✅ Created ${totalReplies} total replies\n`, config.verbose);
}

async function promotePropositionsToClaims(
  deliberationId: string,
  propositions: Array<{ id: string; text: string; authorId: string; popularityWeight: number }>,
  config: SeedConfig
) {
  if (!config.promoteSomePropositions) return;
  
  logSection('🎯 PROMOTING PROPOSITIONS TO CLAIMS', config.verbose);
  
  // Sort by popularity and promote top N%
  const sorted = [...propositions].sort((a, b) => b.popularityWeight - a.popularityWeight);
  const promoteCount = Math.ceil(sorted.length * config.promotionRate);
  const toPromote = sorted.slice(0, promoteCount);
  
  for (const prop of toPromote) {
    // Create claim
    const claim = await prisma.claim.create({
      data: {
        deliberationId,
        text: prop.text,
        createdById: prop.authorId,
        moid: `${deliberationId}:${prop.authorId}:${Date.now()}`,
      },
    });
    
    // Update proposition
    await prisma.proposition.update({
      where: { id: prop.id },
      data: {
        status: 'CLAIMED',
        promotedClaimId: claim.id,
        promotedAt: new Date(),
      },
    });
    
    log(`✅ Promoted proposition to claim: ${claim.id}`, config.verbose);
    log(`   "${prop.text.substring(0, 60)}..."`, config.verbose);
  }
  
  log(`\n✅ Promoted ${toPromote.length} propositions to claims\n`, config.verbose);
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('\n🌱 Starting Proposition Seeding Script\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  
  // Check for deliberationId as first positional argument
  if (args.length > 0 && !args[0].startsWith('--')) {
    config.deliberationId = args[0];
  }
  
  // Parse flags
  if (args.includes('--clear')) config.clearExisting = true;
  if (args.includes('--quiet')) config.verbose = false;
  if (args.includes('--no-promote')) config.promoteSomePropositions = false;
  
  try {
    // 1. Ensure deliberation exists
    const deliberation = await ensureDeliberation(config);
    
    // 2. Ensure users exist
    const users = await ensureUsers(config);
    
    // 3. Clear existing data if requested
    await clearExistingPropositions(deliberation.id, config);
    
    // 4. Seed propositions
    const propositions = await seedPropositions(deliberation.id, users, config);
    
    // 5. Seed votes
    await seedVotes(propositions, users, config);
    
    // 6. Seed endorsements
    await seedEndorsements(propositions, users, config);
    
    // 7. Seed replies
    await seedReplies(propositions, users, config);
    
    // 8. Promote some propositions to claims
    await promotePropositionsToClaims(deliberation.id, propositions, config);
    
    // 9. Summary
    logSection('📊 SEEDING SUMMARY', config.verbose);
    log(`Deliberation ID: ${deliberation.id}`, config.verbose);
    log(`Deliberation Title: ${deliberation.title}`, config.verbose);
    log(`Total Propositions: ${propositions.length}`, config.verbose);
    log(`Total Users: ${users.length}`, config.verbose);
    
    // Get final stats
    const stats = await prisma.proposition.aggregate({
      where: { deliberationId: deliberation.id },
      _sum: {
        voteUpCount: true,
        voteDownCount: true,
        endorseCount: true,
        replyCount: true,
      },
      _count: {
        promotedClaimId: true,
      },
    });
    
    log(`Total Upvotes: ${stats._sum.voteUpCount || 0}`, config.verbose);
    log(`Total Downvotes: ${stats._sum.voteDownCount || 0}`, config.verbose);
    log(`Total Endorsements: ${stats._sum.endorseCount || 0}`, config.verbose);
    log(`Total Replies: ${stats._sum.replyCount || 0}`, config.verbose);
    log(`Promoted to Claims: ${stats._count.promotedClaimId || 0}`, config.verbose);
    
    logSection('✅ SEEDING COMPLETE!', config.verbose);
    log(`\n🔗 Use this deliberation ID in your app: ${deliberation.id}\n`, config.verbose);
    log(`📝 API endpoint: /api/deliberations/${deliberation.id}/propositions\n`, config.verbose);
    
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { main as seedPropositionsDemo };