// scripts/seed-discussion-demo.ts
/**
 * Database Seeding Script for Discussion Demo
 * 
 * This script seeds your database with:
 * - Users (mock participants)
 * - Conversations
 * - Messages (including replies and threads)
 * - Discussions
 * - Optional: Deliberations (upgraded discussions)
 * 
 * Usage:
 *   tsx scripts/seed-discussion-demo.ts
 *   
 * Or add to package.json:
 *   "scripts": {
 *     "seed:discussion": "tsx scripts/seed-discussion-demo.ts"
 *   }
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// SEED DATA CONFIGURATION
// ============================================================================

const SEED_CONFIG = {
  // Control what gets seeded
  createUsers: true,
  createConversation: true,
  createMessages: true,
  createDiscussion: true,
  createDeliberation: false, // Set to true to create upgraded discussion
  
  // Data quantities
  userCount: 4,
  messageCount: 8,
  
  // Options
  clearExisting: false, // Set to true to delete existing demo data first
  verbose: true, // Set to false for less console output
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_USERS = [
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    username: 'sarahc',
    image: null,
  },
  {
    name: 'Marcus Rodriguez',
    email: 'marcus.rodriguez@example.com',
    username: 'mrodriguez',
    image: null,
  },
  {
    name: 'Aisha Patel',
    email: 'aisha.patel@example.com',
    username: 'apatel',
    image: null,
  },
  {
    name: 'James Kim',
    email: 'james.kim@example.com',
    username: 'jkim',
    image: null,
  },
]

const MOCK_MESSAGES = [
  {
    text: "I think we should consider ranked-choice voting as it eliminates the spoiler effect and encourages more diverse candidates.",
    type: 'root' as const,
  },
  {
    text: "That's an interesting point, but implementation costs could be significant. What's the evidence on voter confusion rates?",
    type: 'reply' as const,
    replyTo: 0, // Reply to first message
  },
  {
    text: "Studies from Australia and Ireland show minimal confusion after the first election cycle. Maine has also had positive results.",
    type: 'reply' as const,
    replyTo: 1,
  },
  {
    text: "We'd need to factor in the cost of new voting machines and voter education campaigns. Has anyone done a cost-benefit analysis?",
    type: 'root' as const,
  },
  {
    text: "The FairVote organization published a comprehensive report last year comparing different jurisdictions. I can share the link.",
    type: 'reply' as const,
    replyTo: 3,
  },
  {
    text: "Before we dive too deep into specifics, shouldn't we first agree on what problem we're trying to solve?",
    type: 'root' as const,
  },
  {
    text: "Good point. Are we addressing voter turnout, representation, or something else?",
    type: 'reply' as const,
    replyTo: 5,
  },
  {
    text: "I'd argue all three are interconnected. Better representation leads to higher trust and turnout.",
    type: 'reply' as const,
    replyTo: 6,
  },
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message: string, level: 'info' | 'success' | 'error' = 'info') {
  if (!SEED_CONFIG.verbose && level === 'info') return
  
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
  }[level]
  
  console.log(`${prefix} ${message}`)
}

function createTimestamp(baseTime: Date, offsetMinutes: number): Date {
  return new Date(baseTime.getTime() + offsetMinutes * 60 * 1000)
}

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

/**
 * Clear existing demo data (optional)
 */
async function clearDemoData() {
  if (!SEED_CONFIG.clearExisting) return
  
  log('Clearing existing demo data...')
  
  // Delete in correct order (respecting foreign keys)
  await prisma.message.deleteMany({
    where: { 
      sender: { 
        email: { in: MOCK_USERS.map(u => u.email) } 
      }
    }
  })
  
  await prisma.conversationParticipant.deleteMany({
    where: {
      user: {
        email: { in: MOCK_USERS.map(u => u.email) }
      }
    }
  })
  
  await prisma.conversation.deleteMany({
    where: {
      participants: {
        some: {
          user: {
            email: { in: MOCK_USERS.map(u => u.email) }
          }
        }
      }
    }
  })
  
  await prisma.discussion.deleteMany({
    where: {
      createdBy: {
        email: { in: MOCK_USERS.map(u => u.email) }
      }
    }
  })
  
  await prisma.user.deleteMany({
    where: {
      email: { in: MOCK_USERS.map(u => u.email) }
    }
  })
  
  log('Existing demo data cleared', 'success')
}

/**
 * Seed users
 */
async function seedUsers() {
  if (!SEED_CONFIG.createUsers) return []
  
  log('Seeding users...')
  
  const users = []
  
  for (const userData of MOCK_USERS.slice(0, SEED_CONFIG.userCount)) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: userData,
      create: {
        ...userData,
        password: 'demo-password-hash', // In real app, use proper hashing
      },
    })
    
    users.push(user)
    log(`  Created user: ${user.name}`)
  }
  
  log(`Created ${users.length} users`, 'success')
  return users
}

/**
 * Seed conversation
 */
async function seedConversation(users: any[]) {
  if (!SEED_CONFIG.createConversation) return null
  
  log('Seeding conversation...')
  
  const conversation = await prisma.conversation.create({
    data: {
      title: 'Ranked-Choice Voting Discussion',
      isGroup: true,
      participants: {
        create: users.map(user => ({
          userId: user.id,
        })),
      },
    },
    include: {
      participants: true,
    },
  })
  
  log(`Created conversation: ${conversation.title}`, 'success')
  return conversation
}

/**
 * Seed messages with replies
 */
async function seedMessages(conversation: any, users: any[]) {
  if (!SEED_CONFIG.createMessages) return []
  
  log('Seeding messages with replies...')
  
  const baseTime = new Date()
  const messages: any[] = []
  
  // Keep track of message IDs for replies
  const messageIdMap: Record<number, string> = {}
  
  for (let i = 0; i < MOCK_MESSAGES.slice(0, SEED_CONFIG.messageCount).length; i++) {
    const messageData = MOCK_MESSAGES[i]
    const user = users[i % users.length]
    const timestamp = createTimestamp(baseTime, i * 15) // 15 min intervals
    
    // Determine parent message ID if this is a reply
    let replyToId: string | null = null
    if (messageData.type === 'reply' && messageData.replyTo !== undefined) {
      replyToId = messageIdMap[messageData.replyTo] || null
    }
    
    const message = await prisma.message.create({
      data: {
        text: messageData.text,
        conversationId: conversation.id,
        senderId: user.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        // If your schema has reply/thread support:
        // parentId: replyToId,
        // threadId: replyToId ? messages[0].id : null, // First message is thread root
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })
    
    messages.push(message)
    messageIdMap[i] = message.id
    
    const replyIndicator = messageData.type === 'reply' ? ' (reply)' : ''
    log(`  Created message ${i + 1}${replyIndicator}: "${messageData.text.substring(0, 50)}..."`)
  }
  
  log(`Created ${messages.length} messages`, 'success')
  return messages
}

/**
 * Seed discussion
 */
async function seedDiscussion(conversation: any, users: any[]) {
  if (!SEED_CONFIG.createDiscussion) return null
  
  log('Seeding discussion...')
  
  const discussion = await prisma.discussion.create({
    data: {
      title: 'Ranked-Choice Voting Analysis',
      description: 'Exploring the feasibility and benefits of implementing ranked-choice voting in local elections',
      createdById: users[0].id,
      conversationId: conversation.id,
      status: 'ACTIVE',
    },
  })
  
  log(`Created discussion: ${discussion.title}`, 'success')
  return discussion
}

/**
 * Seed deliberation (upgraded discussion)
 */
async function seedDeliberation(discussion: any, users: any[]) {
  if (!SEED_CONFIG.createDeliberation) return null
  
  log('Seeding deliberation (upgraded discussion)...')
  
  const deliberation = await prisma.deliberation.create({
    data: {
      title: discussion.title + ' - Deliberation',
      description: 'Structured deliberation on voting system reform',
      status: 'ACTIVE',
      // Link to discussion if your schema supports it:
      // discussions: {
      //   create: {
      //     discussionId: discussion.id,
      //   }
      // }
    },
  })
  
  // Optionally create some initial propositions
  const propositions = [
    "Ranked-choice voting reduces the spoiler effect",
    "Implementation costs are justified by long-term benefits",
    "Voter education campaigns are essential for success",
  ]
  
  for (const propText of propositions) {
    await prisma.proposition.create({
      data: {
        text: propText,
        deliberationId: deliberation.id,
        authorId: users[0].id,
      },
    })
    log(`  Created proposition: "${propText}"`)
  }
  
  log(`Created deliberation with ${propositions.length} propositions`, 'success')
  return deliberation
}

/**
 * Print summary
 */
async function printSummary(results: {
  users: any[]
  conversation: any
  messages: any[]
  discussion: any
  deliberation: any
}) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 SEED SUMMARY')
  console.log('='.repeat(60))
  
  console.log(`\n✅ Users: ${results.users.length}`)
  results.users.forEach(u => console.log(`   - ${u.name} (${u.email})`))
  
  if (results.conversation) {
    console.log(`\n✅ Conversation: ${results.conversation.title}`)
    console.log(`   ID: ${results.conversation.id}`)
    console.log(`   Participants: ${results.conversation.participants.length}`)
  }
  
  if (results.messages.length > 0) {
    console.log(`\n✅ Messages: ${results.messages.length}`)
    const rootMessages = results.messages.filter(m => MOCK_MESSAGES.find((_, i) => i < results.messages.length && MOCK_MESSAGES[i].type === 'root'))
    const replyMessages = results.messages.length - rootMessages.length
    console.log(`   - Root messages: ${rootMessages.length}`)
    console.log(`   - Replies: ${replyMessages}`)
  }
  
  if (results.discussion) {
    console.log(`\n✅ Discussion: ${results.discussion.title}`)
    console.log(`   ID: ${results.discussion.id}`)
    console.log(`   Status: ${results.discussion.status}`)
  }
  
  if (results.deliberation) {
    console.log(`\n✅ Deliberation: ${results.deliberation.title}`)
    console.log(`   ID: ${results.deliberation.id}`)
    
    const propCount = await prisma.proposition.count({
      where: { deliberationId: results.deliberation.id }
    })
    console.log(`   Propositions: ${propCount}`)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('🎉 SEEDING COMPLETE!')
  console.log('='.repeat(60))
  
  // Usage instructions
  console.log('\n📝 Usage in your app:')
  console.log(`   Conversation ID: ${results.conversation?.id}`)
  console.log(`   Discussion ID: ${results.discussion?.id}`)
  
  console.log('\n🔍 View in database:')
  console.log('   npx prisma studio')
  
  console.log('\n')
}

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================

async function main() {
  console.log('\n🌱 Starting database seeding...\n')
  
  try {
    // Clear existing data (if configured)
    await clearDemoData()
    
    // Seed in order (respecting foreign keys)
    const users = await seedUsers()
    const conversation = await seedConversation(users)
    const messages = await seedMessages(conversation, users)
    const discussion = await seedDiscussion(conversation, users)
    const deliberation = await seedDeliberation(discussion, users)
    
    // Print summary
    await printSummary({
      users,
      conversation,
      messages,
      discussion,
      deliberation,
    })
    
  } catch (error) {
    console.error('❌ Error during seeding:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// ============================================================================
// EXECUTE
// ============================================================================

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })