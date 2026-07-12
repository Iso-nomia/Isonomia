// scripts/seed-discussion-advanced.ts
/**
 * Advanced Database Seeding Script for Discussion Demo
 * 
 * Features:
 * - Multiple discussion scenarios (basic, active, upgraded)
 * - Message threads with proper parent/child relationships
 * - Reactions on messages
 * - Facets (layered messages) support
 * - Drift/thread creation
 * - Propositions, Claims, and Arguments
 * 
 * Usage:
 *   tsx scripts/seed-discussion-advanced.ts --scenario=active
 *   
 * Scenarios:
 *   - basic: Simple discussion with messages
 *   - active: Discussion with threads and replies
 *   - upgraded: Deliberation with propositions and claims
 *   - full: Everything (for comprehensive demos)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================================
// CONFIGURATION
// ============================================================================

type Scenario = 'basic' | 'active' | 'upgraded' | 'full'

interface SeedConfig {
  scenario: Scenario
  verbose: boolean
  clearExisting: boolean
  
  // Quantities by scenario
  users: number
  messages: number
  propositions?: number
  claims?: number
  arguments?: number
}

const SCENARIO_CONFIGS: Record<Scenario, Partial<SeedConfig>> = {
  basic: {
    users: 3,
    messages: 6,
  },
  active: {
    users: 4,
    messages: 12,
  },
  upgraded: {
    users: 4,
    messages: 8,
    propositions: 5,
    claims: 10,
    arguments: 3,
  },
  full: {
    users: 5,
    messages: 15,
    propositions: 8,
    claims: 15,
    arguments: 6,
  },
}

// Parse command line arguments
const args = process.argv.slice(2)
const scenarioArg = args.find(arg => arg.startsWith('--scenario='))?.split('=')[1] as Scenario || 'active'
const verboseArg = args.includes('--verbose') || args.includes('-v')
const clearArg = args.includes('--clear')

const config: SeedConfig = {
  scenario: scenarioArg,
  verbose: verboseArg,
  clearExisting: clearArg,
  users: 4,
  messages: 8,
  ...SCENARIO_CONFIGS[scenarioArg],
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_USERS = [
  {
    name: 'Sarah Chen',
    auth_id: 'demo_auth_sarah_chen',
    username: 'sarahc',
    bio: 'Policy analyst specializing in electoral systems',
    image: null,
  },
  {
    name: 'Marcus Rodriguez',
    auth_id: 'demo_auth_marcus_rodriguez',
    username: 'mrodriguez',
    bio: 'Political science researcher',
    image: null,
  },
  {
    name: 'Aisha Patel',
    auth_id: 'demo_auth_aisha_patel',
    username: 'apatel',
    bio: 'Community organizer and civic tech advocate',
    image: null,
  },
  {
    name: 'James Kim',
    auth_id: 'demo_auth_james_kim',
    username: 'jkim',
    bio: 'Data scientist with focus on voting patterns',
    image: null,
  },
  {
    name: 'Elena Volkov',
    auth_id: 'demo_auth_elena_volkov',
    username: 'evolkov',
    bio: 'Election administrator and systems expert',
    image: null,
  },
]

interface MessageTemplate {
  text: string
  type: 'root' | 'reply'
  replyTo?: number
  hasReactions?: boolean
  reactions?: { emoji: string; count: number }[]
}
const FORUM_COMMENT_TEMPLATES = [
  {
    body: "I've been researching RCV implementations across different municipalities. The most compelling argument I've found is how it reduces negative campaigning since candidates need to appeal to a broader base for second-choice votes.",
    authorIndex: 0, // Sarah (current user)
    parentIndex: null, // Top-level
    score: 12,
    minutesAgo: 180, // 3 hours ago
  },
  {
    body: "That's a great point about reducing negative campaigning. I'd add that RCV also eliminates the 'spoiler effect' - voters can support third-party candidates without feeling like they're throwing their vote away.",
    authorIndex: 1, // Marcus
    parentIndex: 0, // Reply to comment 0
    score: 8,
    minutesAgo: 165,
  },
  {
    body: "Both good points, but we need to consider the practical challenges. Voter education is critical. In the 2018 Maine election, about 8% of ballots were exhausted (no valid ranking remained). While not terrible, it shows we need comprehensive education programs.",
    authorIndex: 2, // Aisha
    parentIndex: 0, // Also reply to comment 0
    score: 15,
    minutesAgo: 150,
  },
  {
    body: "The education piece is crucial. However, studies from Australia (which has used preferential voting since 1918) show that informal ballot rates drop significantly after the first election cycle. Voters adapt quickly.",
    authorIndex: 0, // Sarah (current user) replying to Aisha
    parentIndex: 2,
    score: 6,
    minutesAgo: 135,
  },
  {
    body: "What about the cost factor? I've heard concerns about the expense of new voting equipment and longer ballot counting times.",
    authorIndex: 3, // James
    parentIndex: null, // New top-level thread
    score: 10,
    minutesAgo: 120,
  },
  {
    body: "The FairVote analysis breaks down the costs pretty well:\n\n• Initial setup: $1-2M per jurisdiction for equipment and training\n• Ballot counting: Adds 30-60 minutes on average\n• Long-term savings: Eliminates runoff elections (saving $500K-$2M per cycle)\n\nMost jurisdictions see ROI within 2-3 election cycles.",
    authorIndex: 0, // Sarah (current user)
    parentIndex: 4,
    score: 18,
    minutesAgo: 105,
  },
  {
    body: "Those numbers are helpful. Do you have sources for the long-term savings estimates?",
    authorIndex: 3, // James
    parentIndex: 5,
    score: 3,
    minutesAgo: 90,
  },
  {
    body: "Sure! The primary source is FairVote's 2023 comprehensive cost-benefit analysis. They studied 24 jurisdictions over 10 years. I can share the full report link if that would help.",
    authorIndex: 0, // Sarah
    parentIndex: 6,
    score: 5,
    minutesAgo: 75,
  },
  {
    body: "I want to push back on the framing here. While RCV has benefits, we should also discuss its limitations. It doesn't solve everything - it can still produce non-monotonic results (where ranking a candidate higher can paradoxically hurt them).",
    authorIndex: 1, // Marcus
    parentIndex: null, // New top-level thread
    score: 14,
    minutesAgo: 60,
  },
  {
    body: "Marcus raises an important point. Non-monotonicity is a real concern in voting theory. However, empirical studies show it's extremely rare in practice - occurring in less than 1% of RCV elections.",
    authorIndex: 2, // Aisha
    parentIndex: 8,
    score: 7,
    minutesAgo: 45,
  },
  {
    body: "True, but 'rare' isn't the same as 'never.' If we're redesigning our electoral system, shouldn't we aim for theoretical perfection, not just practical improvement?",
    authorIndex: 1, // Marcus
    parentIndex: 9,
    score: 4,
    minutesAgo: 30,
  },
  {
    body: "Perfect is the enemy of good. No voting system satisfies all of Arrow's impossibility theorem criteria. RCV offers substantial practical benefits even if it's not theoretically perfect.",
    authorIndex: 0, // Sarah
    parentIndex: 10,
    score: 9,
    minutesAgo: 15,
  },
  {
    body: "Has anyone looked at the impact on minority representation? That's my main concern with any electoral reform.",
    authorIndex: 3, // James
    parentIndex: null, // New top-level thread
    score: 11,
    minutesAgo: 10,
  },
  {
    body: "Great question! The data is actually quite positive. Representational improvement is one of RCV's strongest empirical results, particularly for candidates of color and women. San Francisco saw a 40% increase in diverse candidate success after implementing RCV.",
    authorIndex: 2, // Aisha
    parentIndex: 12,
    score: 8,
    minutesAgo: 5,
  },
]

// Helper function to create TipTap-style body structure
function createForumBody(text: string): any {
  const paragraphs = text.split('\n\n').filter(p => p.trim())
  
  return {
    type: 'doc',
    content: paragraphs.map(p => {
      // Handle bullet points
      if (p.includes('•')) {
        const items = p.split('\n').filter(line => line.trim().startsWith('•'))
        return {
          type: 'bulletList',
          content: items.map(item => ({
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [{
                type: 'text',
                text: item.replace('•', '').trim()
              }]
            }]
          }))
        }
      }
      
      // Regular paragraph
      return {
        type: 'paragraph',
        content: [{
          type: 'text',
          text: p
        }]
      }
    })
  }
}


const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    text: "I think we should consider ranked-choice voting as it eliminates the spoiler effect and encourages more diverse candidates.",
    type: 'root',
    hasReactions: true,
    reactions: [
      { emoji: '👍', count: 3 },
      { emoji: '❤️', count: 2 },
    ],
  },
  {
    text: "That's an interesting point, but implementation costs could be significant. What's the evidence on voter confusion rates?",
    type: 'reply',
    replyTo: 0,
    hasReactions: true,
    reactions: [
      { emoji: '🤔', count: 2 },
    ],
  },
  {
    text: "Studies from Australia and Ireland show minimal confusion after the first election cycle. Maine has also had positive results.",
    type: 'reply',
    replyTo: 1,
    hasReactions: true,
    reactions: [
      { emoji: '📊', count: 4 },
      { emoji: '👍', count: 2 },
    ],
  },
  {
    text: "We'd need to factor in the cost of new voting machines and voter education campaigns. Has anyone done a cost-benefit analysis?",
    type: 'root',
  },
  {
    text: "The FairVote organization published a comprehensive report last year comparing different jurisdictions. I can share the link.",
    type: 'reply',
    replyTo: 3,
    hasReactions: true,
    reactions: [
      { emoji: '🔗', count: 5 },
    ],
  },
  {
    text: "Before we dive too deep into specifics, shouldn't we first agree on what problem we're trying to solve?",
    type: 'root',
    hasReactions: true,
    reactions: [
      { emoji: '💡', count: 3 },
    ],
  },
  {
    text: "Good point. Are we addressing voter turnout, representation, or something else?",
    type: 'reply',
    replyTo: 5,
  },
  {
    text: "I'd argue all three are interconnected. Better representation leads to higher trust and turnout.",
    type: 'reply',
    replyTo: 6,
    hasReactions: true,
    reactions: [
      { emoji: '✅', count: 2 },
    ],
  },
  {
    text: "Has anyone looked at the data from cities that have already implemented RCV? I'd be curious about actual turnout changes.",
    type: 'root',
  },
  {
    text: "Minneapolis and San Francisco have seen modest increases in turnout, especially in competitive races.",
    type: 'reply',
    replyTo: 8,
  },
  {
    text: "We should also consider the impact on third-party candidates. Does RCV actually lead to more viable alternatives?",
    type: 'root',
  },
  {
    text: "In jurisdictions with RCV, we've seen 30-50% more candidates running, particularly from underrepresented groups.",
    type: 'reply',
    replyTo: 10,
  },
  {
    text: "What about the timeline for implementation? If we decide to move forward, how long would the transition take?",
    type: 'root',
  },
  {
    text: "Typically 12-18 months for full implementation, including procurement, testing, and voter education.",
    type: 'reply',
    replyTo: 12,
  },
  {
    text: "We should probably form a working group to develop a detailed proposal with cost estimates and implementation plan.",
    type: 'root',
    hasReactions: true,
    reactions: [
      { emoji: '👍', count: 6 },
      { emoji: '💪', count: 3 },
    ],
  },
]

const PROPOSITION_TEMPLATES = [
  "Ranked-choice voting reduces the spoiler effect in elections",
  "Implementation costs are justified by long-term democratic benefits",
  "Voter education campaigns are essential for RCV success",
  "RCV increases diversity in candidate pools",
  "Third-party candidates benefit significantly from RCV",
  "Voter confusion decreases after first RCV election cycle",
  "RCV improves voter turnout in competitive races",
  "Cost-benefit analysis favors RCV implementation",
]

const CLAIM_TEMPLATES = [
  "Studies from Maine, Australia, and Ireland demonstrate minimal voter confusion",
  "RCV eliminates strategic voting and the spoiler effect",
  "Implementation requires 12-18 months including voter education",
  "Minneapolis and San Francisco saw modest turnout increases",
  "30-50% more candidates run in RCV jurisdictions",
  "Underrepresented groups particularly benefit from RCV",
  "FairVote's 2024 report provides comprehensive cost-benefit analysis",
  "New voting machines and education campaigns require significant investment",
  "Voter trust increases with better representation",
  "Third-party viability improves under RCV systems",
]

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message: string, level: 'info' | 'success' | 'error' | 'warning' = 'info') {
  if (!config.verbose && level === 'info') return
  
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
  }
  
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }
  
  console.log(`${colors[level]}${prefix[level]} ${message}\x1b[0m`)
}

function createTimestamp(baseTime: Date, offsetMinutes: number): Date {
  return new Date(baseTime.getTime() + offsetMinutes * 60 * 1000)
}

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

async function clearDemoData() {
  log('Clearing existing demo data...', 'warning')
  
  // Delete in reverse dependency order
  const userAuthIds = MOCK_USERS.map(u => u.auth_id)
  
  // First, find existing discussion by title to clear its forum comments AND the discussion itself
  const existingDiscussions = await prisma.discussion.findMany({
    where: { title: 'Ranked-Choice Voting Analysis' },
    include: { conversation: true }
  })
  
  if (existingDiscussions.length > 0) {
    log(`Found ${existingDiscussions.length} existing discussion(s) with title "Ranked-Choice Voting Analysis"`)
    for (const disc of existingDiscussions) {
      log(`  Clearing forum comments for discussion ${disc.id}...`)
      await prisma.forumComment.deleteMany({
        where: { discussionId: disc.id }
      })
      
      // Delete associated messages and conversation if it exists
      if (disc.conversationId) {
        log(`  Clearing messages from conversation ${disc.conversationId}...`)
        await prisma.message.deleteMany({
          where: { conversation_id: disc.conversationId }
        })
        
        log(`  Clearing conversation participants...`)
        await prisma.conversationParticipant.deleteMany({
          where: { conversation_id: disc.conversationId }
        })
        
        log(`  Deleting conversation ${disc.conversationId}...`)
        await prisma.conversation.delete({
          where: { id: disc.conversationId }
        }).catch(() => log('    (conversation already deleted)', 'info'))
      }
      
      log(`  Deleting discussion ${disc.id}...`)
      await prisma.discussion.delete({
        where: { id: disc.id }
      })
    }
  }
  
  // Arguments and claims (if they exist)
  if (config.scenario === 'upgraded' || config.scenario === 'full') {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Argument" 
      WHERE "authorId" IN (
        SELECT id FROM "users" WHERE auth_id = ANY($1)
      )
    `, userAuthIds).catch(() => {
      log('No arguments table found (skipping)', 'info')
    })
    
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Claim" 
      WHERE "authorId" IN (
        SELECT id FROM "users" WHERE auth_id = ANY($1)
      )
    `, userAuthIds).catch(() => {
      log('No claims table found (skipping)', 'info')
    })
    
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Proposition" 
      WHERE "authorId" IN (
        SELECT id FROM "users" WHERE auth_id = ANY($1)
      )
    `, userAuthIds).catch(() => {
      log('No propositions table found (skipping)', 'info')
    })
  }
  
  // Messages and related - must be deleted before conversations
  await prisma.message.deleteMany({
    where: { 
      sender: { 
        auth_id: { in: userAuthIds } 
      }
    }
  })
  
  // Conversation participants
  await prisma.conversationParticipant.deleteMany({
    where: {
      user: { auth_id: { in: userAuthIds } }
    }
  })
  
  // Conversations
  await prisma.conversation.deleteMany({
    where: {
      participants: {
        some: {
          user: { auth_id: { in: userAuthIds } }
        }
      }
    }
  })
  
  // Forum comments - use Prisma deleteMany for better reliability
  await prisma.$executeRawUnsafe(`
    DELETE FROM "ForumComment" 
    WHERE "discussionId" IN (
      SELECT id FROM "Discussion" 
      WHERE "createdById" IN (
        SELECT CAST(id AS TEXT) FROM "users" WHERE auth_id = ANY($1)
      )
    )
  `, userAuthIds).catch(() => {
    log('Error deleting forum comments (skipping)', 'info')
  })

  // Discussions - need to use raw SQL since createdById is just a string field
  await prisma.$executeRawUnsafe(`
    DELETE FROM "Discussion" 
    WHERE "createdById" IN (
      SELECT CAST(id AS TEXT) FROM "users" WHERE auth_id = ANY($1)
    )
  `, userAuthIds).catch(() => {
    log('Error deleting discussions (skipping)', 'info')
  })
  
  // Users
  await prisma.user.deleteMany({
    where: { auth_id: { in: userAuthIds } }
  })
  
  log('Existing demo data cleared', 'success')
}

async function seedUsers() {
  log('Seeding users...')
  
  const users = []
  
  for (const userData of MOCK_USERS.slice(0, config.users)) {
    const user = await prisma.user.upsert({
      where: { auth_id: userData.auth_id },
      update: userData,
      create: {
        ...userData,
      },
    })
    
    users.push(user)
    log(`  Created user: ${user.name} (${user.username})`)
  }
  
  log(`Created ${users.length} users`, 'success')
  return users
}

async function seedConversation(users: any[]) {
  log('Seeding conversation...')
  
  const conversation = await prisma.conversation.create({
    data: {
      is_group: true,
      participants: {
        create: users.map(user => ({
          user: {
            connect: { id: user.id }
          },
          joined_at: new Date(),
        })),
      },
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
    },
  })
  
  log(`Created conversation`, 'success')
  return conversation
}

async function seedMessages(conversation: any, users: any[]) {
  log('Seeding messages with threads...')
  
  const baseTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
  const messages: any[] = []
  const messageIdMap: Record<number, string> = {}
  
  const messageCount = Math.min(config.messages, MESSAGE_TEMPLATES.length)
  
  // 👉 Make the FIRST user (users[0]) send messages at indices 0, 2, 4, 6, 8... (every other one)
  // This way when the demo shows participants[0] as currentUser, those messages appear on the right
  for (let i = 0; i < messageCount; i++) {
    const template = MESSAGE_TEMPLATES[i]
    // Use first user for even indices, rotate through others for odd indices
    const user = i % 2 === 0 ? users[0] : users[(i % users.length)]
    const timestamp = createTimestamp(baseTime, i * 15) // 15 min intervals
    
    // Determine parent for replies
    let parentId: string | null = null
    if (template.type === 'reply' && template.replyTo !== undefined) {
      parentId = messageIdMap[template.replyTo] || null
    }
    
    const message = await prisma.message.create({
      data: {
        text: template.text,
        conversation_id: conversation.id,
        sender_id: user.id,
        created_at: timestamp,
        // Uncomment if your schema supports these:
        // parentId: parentId,
        // threadId: parentId ? messageIdMap[0] : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
          },
        },
      },
    })
    
    messages.push(message)
    messageIdMap[i] = message.id.toString()
    
    const indent = template.type === 'reply' ? '  ' : ''
    log(`${indent}Created message ${i + 1}: "${template.text.substring(0, 60)}..."`)
    
    // Add reactions if template specifies
    if (template.hasReactions && template.reactions && config.scenario !== 'basic') {
      for (const reaction of template.reactions) {
        // You might have a reactions table or store this differently
        // This is just an example structure
        log(`    Added reaction ${reaction.emoji} (×${reaction.count})`, 'info')
      }
    }
  }
  
  log(`Created ${messages.length} messages`, 'success')
  return messages
}

// Add this new function after seedDiscussion
async function seedForumComments(discussion: any, users: any[]) {
  log('Seeding forum comments...')
  
  const createdComments: any[] = []
  const baseTime = new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
  
  for (let i = 0; i < FORUM_COMMENT_TEMPLATES.length; i++) {
    const template = FORUM_COMMENT_TEMPLATES[i]
    const author = users[template.authorIndex]
    const createdAt = new Date(baseTime.getTime() + (180 - template.minutesAgo) * 60 * 1000)
    
    // Determine parent ID from previously created comments
    let parentId: bigint | null = null
    if (template.parentIndex !== null) {
      parentId = createdComments[template.parentIndex].id
    }

    const body = createForumBody(template.body)
    const bodyText = template.body

    const comment = await prisma.forumComment.create({
      data: {
        discussionId: discussion.id,
        authorId: author.id.toString(),
        parentId,
        body,
        bodyText,
        score: template.score,
        createdAt,
      }
    })

    createdComments.push(comment)
    
    // Log top-level vs replies differently
    if (template.parentIndex === null) {
      log(`  Created top-level comment ${createdComments.length}: "${bodyText.substring(0, 50)}..."`)
    } else {
      log(`    └─ Reply ${createdComments.length}`)
    }
  }

  // Update discussion metadata
  await prisma.discussion.update({
    where: { id: discussion.id },
    data: {
      replyCount: createdComments.length,
      lastActiveAt: new Date()
    }
  })

  const topLevelCount = FORUM_COMMENT_TEMPLATES.filter(c => c.parentIndex === null).length
  const replyCount = FORUM_COMMENT_TEMPLATES.filter(c => c.parentIndex !== null).length
  
  log(`Created ${createdComments.length} forum comments (${topLevelCount} threads, ${replyCount} replies)`, 'success')
  return createdComments
}

async function seedDiscussion(conversation: any, users: any[]) {
  log('Seeding discussion...')
  
  const discussion = await prisma.discussion.create({
    data: {
      title: 'Ranked-Choice Voting Analysis',
      description: 'A sample discussion on the topic of ranked-choice voting in local elections.',
      createdById: users[0].id.toString(),
      conversationId: conversation.id,
    },
  })
  
  log(`Created discussion: ${discussion.title}`, 'success')
  return discussion
}

async function seedDeliberation(discussion: any, users: any[]) {
  if (config.scenario !== 'upgraded' && config.scenario !== 'full') return null
  
  log('Seeding deliberation...')
  
  const deliberation = await prisma.deliberation.create({
    data: {
      title: discussion.title + ' - Deliberation',
      hostType: 'room_thread',
      hostId: discussion.id,
      createdById: users[0].id.toString(),
      upgradedFromDiscussionId: discussion.id,
    },
  })
  
  log(`Created deliberation: ${deliberation.title}`, 'success')
  return deliberation
}

async function seedPropositions(deliberation: any, users: any[]) {
  if (!deliberation) return []
  
  log('Seeding propositions...')
  
  // Check if proposition model is available in Prisma client
  if (!('proposition' in prisma)) {
    log('  Skipping propositions - model not available in Prisma client', 'warning')
    return []
  }
  
  const propositions = []
  const propCount = config.propositions || 5
  
  for (let i = 0; i < Math.min(propCount, PROPOSITION_TEMPLATES.length); i++) {
    const prop = await (prisma as any).proposition.create({
      data: {
        text: PROPOSITION_TEMPLATES[i],
        deliberationId: deliberation.id,
        authorId: users[i % users.length].id.toString(),
        createdAt: createTimestamp(new Date(), -60 + i * 10),
      },
    })
    
    propositions.push(prop)
    log(`  Created proposition: "${prop.text.substring(0, 60)}..."`)
  }
  
  log(`Created ${propositions.length} propositions`, 'success')
  return propositions
}


// model Claim {
//   id          String             @id @default(cuid())
//   text        String
//   createdById String
//   moid        String             @unique
//   createdAt   DateTime           @default(now())
//   cards       DeliberationCard[]
//   warrant     ClaimWarrant? // 👈 back-relation

//   deliberationId String?
//   deliberation   Deliberation? @relation(fields: [deliberationId], references: [id], onDelete: Cascade)

//   arguments Argument[] @relation("ArgumentClaim")

//   edgesFrom ClaimEdge[]     @relation("fromClaim")
//   edgesTo   ClaimEdge[]     @relation("toClaim")
//   citations ClaimCitation[]

//   claimType String? // "Agent" | "Assertion" | "Domain" | ...

//   urns        Urn[]        @relation("ClaimUrns")
//   ClaimLabel  ClaimLabel?
//   claimValues ClaimValue[] // <— opposite side for ClaimValue.claim

//   ClaimEvidence ClaimEvidence[]

//   sourceProposition Proposition? @relation("PropositionClaim")

//   IssueLink IssueLink[]

//   // NEW
//   canonicalClaimId String?
//   canonical        CanonicalClaim? @relation(fields: [canonicalClaimId], references: [id], onDelete: SetNull)

//   // NEW (optional negation link for DS pl later)
//   negatesClaimId String?
//   negates        Claim?  @relation("NegationClaims", fields: [negatesClaimId], references: [id], onDelete: SetNull)
//   negatedBy      Claim[] @relation("NegationClaims")

//   debateNodes  DebateNode[] @relation(name: "ClaimDebateNodes")
//   canonicalKey String?      @unique

//   asPremiseOf  ArgumentPremise[]
//   asConclusion Argument[]        @relation("Conclusion")

//   @@index([deliberationId, id], name: "claim_delib_id") // NEW
//   @@index([deliberationId, createdAt]) // claims by delib, time-sorted
//   @@index([canonicalClaimId])
//   @@index([negatesClaimId])
//   @@index([deliberationId])
//   @@index([deliberationId, createdById, createdAt])
// }

async function seedClaims(deliberation: any, users: any[]) {
  if (!deliberation) return []
  
  log('Seeding claims...')
  
  const claims = []
  const claimCount = config.claims || 8
  
  for (let i = 0; i < Math.min(claimCount, CLAIM_TEMPLATES.length); i++) {
    try {
      const claim = await prisma.claim.create({
        data: {
          text: CLAIM_TEMPLATES[i],
          moid: `claim-${deliberation.id}-${i}-${Date.now()}`,
          deliberationId: deliberation.id,
          createdById: users[i % users.length].id,
          createdAt: createTimestamp(new Date(), -50 + i * 8),
        },
      })
      
      claims.push(claim)
      log(`  Created claim: "${claim.text.substring(0, 60)}..."`)
    } catch (error) {
      log(`  Skipping claim (table may not exist)`, 'warning')
      break
    }
  }
  
  if (claims.length > 0) {
    log(`Created ${claims.length} claims`, 'success')
  }
  return claims
}

async function seedArguments(deliberation: any, claims: any[], users: any[]) {
  if (!deliberation || claims.length === 0) return []
  
  log('Seeding arguments...')
  
  const arguments_test: any[] = []
  const argCount = Math.min(config.arguments || 3, Math.floor(claims.length / 2))
  
  for (let i = 0; i < argCount; i++) {
    try {
      // Create a simple argument structure: premise → conclusion
      const premiseClaim = claims[i * 2]
      const conclusionClaim = claims[i * 2 + 1]
      
      const argument = await prisma.argument.create({
        data: {
          deliberationId: deliberation.id,
          authorId: users[i % users.length].id,
          conclusionClaimId: conclusionClaim.id,
          text: `Argument supporting: ${conclusionClaim.text.substring(0, 50)}...`,
          createdAt: createTimestamp(new Date(), -40 + i * 12),
        },
      })
      
      arguments_test.push(argument)
      log(`  Created argument ${i + 1}`)
    } catch (error) {
      log(`  Skipping arguments (table may not exist)`, 'warning')
      break
    }
  }

  if (arguments_test.length > 0) {
    log(`Created ${arguments_test.length} arguments`, 'success')
  }
  return arguments_test
}

// ============================================================================
// SUMMARY
// ============================================================================

async function printSummary(results: any) {
  console.log('\n' + '='.repeat(70))
  console.log(`📊 SEED SUMMARY - Scenario: ${config.scenario.toUpperCase()}`)
  console.log('='.repeat(70))
  
  console.log(`\n✅ Users: ${results.users.length}`)
  results.users.forEach((u: any) => 
    console.log(`   - ${u.name} (${u.username}) - ${u.email}`)
  )
  
  if (results.conversation) {
    console.log(`\n✅ Conversation: ${results.conversation.title}`)
    console.log(`   ID: ${results.conversation.id}`)
    console.log(`   Participants: ${results.conversation.participants.length}`)
  }
  
  if (results.messages.length > 0) {
    const rootCount = results.messages.filter((_: any, i: number) => 
      MESSAGE_TEMPLATES[i]?.type === 'root'
    ).length
    const replyCount = results.messages.length - rootCount
    
    console.log(`\n✅ Messages: ${results.messages.length}`)
    console.log(`   - Root messages: ${rootCount}`)
    console.log(`   - Replies: ${replyCount}`)
  }
  
  if (results.discussion) {
    console.log(`\n✅ Discussion: ${results.discussion.title}`)
    console.log(`   ID: ${results.discussion.id}`)
  }
  
  if (results.deliberation) {
    console.log(`\n✅ Deliberation: ${results.deliberation.title}`)
    console.log(`   ID: ${results.deliberation.id}`)
  }
  
  if (results.propositions?.length > 0) {
    console.log(`\n✅ Propositions: ${results.propositions.length}`)
  }
  
  if (results.claims?.length > 0) {
    console.log(`\n✅ Claims: ${results.claims.length}`)
  }
  
  if (results.arguments?.length > 0) {
    console.log(`\n✅ Arguments: ${results.arguments.length}`)
  }
  
  if (results.forumComments?.length > 0) {
    const topLevelCount = results.forumComments.filter((c: any) => !c.parentId).length
    const replyCount = results.forumComments.length - topLevelCount
    console.log(`\n✅ Forum Comments: ${results.forumComments.length}`)
    console.log(`   - Top-level: ${topLevelCount}`)
    console.log(`   - Replies: ${replyCount}`)
  }
  
  console.log('\n' + '='.repeat(70))
  console.log('🎉 SEEDING COMPLETE!')
  console.log('='.repeat(70))
  
  console.log('\n📝 Quick Access IDs:')
  console.log(`   export DEMO_CONVERSATION_ID="${results.conversation?.id}"`)
  console.log(`   export DEMO_DISCUSSION_ID="${results.discussion?.id}"`)
  if (results.deliberation) {
    console.log(`   export DEMO_DELIBERATION_ID="${results.deliberation?.id}"`)
  }
  
  console.log('\n🔍 View in Prisma Studio:')
  console.log('   npx prisma studio')
  
  console.log('\n')
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🌱 Advanced Discussion Seeding')
  console.log(`📦 Scenario: ${config.scenario}`)
  console.log(`👥 Users: ${config.users}`)
  console.log(`💬 Messages: ${config.messages}`)
  if (config.propositions) console.log(`💡 Propositions: ${config.propositions}`)
  if (config.claims) console.log(`📋 Claims: ${config.claims}`)
  if (config.arguments) console.log(`🎯 Arguments: ${config.arguments}`)
  console.log('')
  
  try {
    await clearDemoData()
    
    const users = await seedUsers()
    const conversation = await seedConversation(users)
    const messages = await seedMessages(conversation, users)
    const discussion = await seedDiscussion(conversation, users)
    const deliberation = await seedDeliberation(discussion, users)
    const propositions = await seedPropositions(deliberation, users)
    const claims = await seedClaims(deliberation, users)
    const arguments_test = await seedArguments(deliberation, claims, users)
    const forumComments = await seedForumComments(discussion, users)

    
    await printSummary({
      users,
      conversation,
      messages,
      discussion,
      deliberation,
      propositions,
      claims,
      arguments_test,
      forumComments,
    })
    
  } catch (error: any) {
    log(`Error during seeding: ${error.message}`, 'error')
    console.error(error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })