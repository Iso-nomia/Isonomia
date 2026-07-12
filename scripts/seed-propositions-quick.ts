/**
 * Quick Seed Script - Minimal Proposition Data
 * 
 * Purpose: Rapidly create minimal proposition data for testing
 * Usage: tsx scripts/seed-propositions-quick.ts [deliberationId]
 * 
 * This is a simplified version that:
 * - Creates fewer propositions (5 instead of 12)
 * - Less engagement data
 * - Faster execution (~5 seconds)
 * - Perfect for rapid iteration during development
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Minimal realistic propositions
const QUICK_PROPOSITIONS = [
  {
    text: "We should mandate solar panels on all new buildings to increase renewable energy adoption and reduce carbon emissions.",
    votes: { up: 18, down: 3 },
    endorsements: 5,
    replies: 2,
  },
  {
    text: "Public transportation should be free for all residents, funded through congestion pricing in downtown areas.",
    votes: { up: 15, down: 6 },
    endorsements: 4,
    replies: 3,
  },
  {
    text: "Instead of banning cars, create dedicated bike lanes and pedestrian zones while maintaining limited vehicle access.",
    votes: { up: 12, down: 4 },
    endorsements: 3,
    replies: 1,
  },
  {
    text: "Convert vacant lots into community gardens and urban farms, prioritizing low-income neighborhoods.",
    votes: { up: 20, down: 2 },
    endorsements: 6,
    replies: 2,
  },
  {
    text: "Establish a citizen climate assembly with randomly selected residents to develop binding policy recommendations.",
    votes: { up: 11, down: 5 },
    endorsements: 3,
    replies: 1,
  },
];

const QUICK_USERS = [
  { name: "Sarah Chen", email: "sarah@demo.local" },
  { name: "Marcus Rodriguez", email: "marcus@demo.local" },
  { name: "Aisha Patel", email: "aisha@demo.local" },
  { name: "James Kim", email: "james@demo.local" },
];

const QUICK_REPLIES = [
  "This is a great starting point. Have we considered implementation costs?",
  "I support this approach, but we should phase it in gradually.",
  "What about the impact on small businesses? We need to address that.",
  "Agreed. Similar policies in other cities have shown positive results.",
  "Can you clarify what you mean by this specifically?",
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function quickSeed() {
  console.log('\n⚡ Quick Proposition Seed\n');
  
  // Get or create deliberation
  const args = process.argv.slice(2);
  let deliberationId = args[0];
  
  if (!deliberationId) {
    console.log('📋 Creating new deliberation...');
    const delib = await prisma.deliberation.create({
      data: {
        hostType: 'GROUP',
        hostId: 'quick-demo',
        rule: 'utilitarian',
        k: 3,
        createdById: 'system',
        title: 'Climate Policy Discussion (Quick Demo)',
        tags: ['demo', 'quick-seed', 'climate'],
      },
    });
    deliberationId = delib.id;
    console.log(`✅ Created: ${delib.id}\n`);
  } else {
    console.log(`📋 Using deliberation: ${deliberationId}\n`);
  }
  
  // Ensure users
  console.log('👥 Ensuring users...');
  const users = [];
  for (const u of QUICK_USERS) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: u.email, name: u.name, username: u.email.split('@')[0] },
      });
    }
    users.push(user);
  }
  console.log(`✅ ${users.length} users ready\n`);
  
  // Create propositions
  console.log('📝 Creating propositions...');
  let count = 0;
  
  for (const prop of QUICK_PROPOSITIONS) {
    const author = randomChoice(users);
    
    // Create proposition
    const created = await prisma.proposition.create({
      data: {
        deliberationId,
        authorId: author.id,
        text: prop.text,
        status: 'PUBLISHED',
        voteUpCount: prop.votes.up,
        voteDownCount: prop.votes.down,
        endorseCount: prop.endorsements,
        replyCount: prop.replies,
      },
    });
    
    // Add votes
    const voters = users.slice(0, prop.votes.up + prop.votes.down);
    for (let i = 0; i < voters.length; i++) {
      const value = i < prop.votes.up ? 1 : -1;
      await prisma.propositionVote.create({
        data: {
          propositionId: created.id,
          userId: voters[i].id,
          value,
        },
      }).catch(() => {}); // Ignore duplicates
    }
    
    // Add endorsements
    for (let i = 0; i < prop.endorsements; i++) {
      await prisma.propositionEndorsement.create({
        data: {
          propositionId: created.id,
          userId: users[i % users.length].id,
        },
      }).catch(() => {});
    }
    
    // Add replies
    for (let i = 0; i < prop.replies; i++) {
      await prisma.propositionReply.create({
        data: {
          propositionId: created.id,
          authorId: randomChoice(users).id,
          text: randomChoice(QUICK_REPLIES),
        },
      });
    }
    
    count++;
    console.log(`  ✅ ${count}/${QUICK_PROPOSITIONS.length} - "${prop.text.substring(0, 50)}..."`);
  }
  
  console.log(`\n✅ Created ${count} propositions with full engagement data`);
  console.log(`\n🔗 Deliberation ID: ${deliberationId}`);
  console.log(`📝 API: /api/deliberations/${deliberationId}/propositions\n`);
}

quickSeed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());