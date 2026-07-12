// app/onboarding/_data/mock-data.ts

/**
 * Centralized mock data for interactive onboarding demos
 * 
 * All demos should import from this file to ensure:
 * - Consistency across different steps
 * - Realistic but fake data
 * - Proper TypeScript typing
 * - Easy updates in one place
 */

/* ======================== MOCK USERS ======================== */

export interface MockUser {
  id: string
  name: string
  avatar: string
  role: 'moderator' | 'participant' | 'observer'
  joinedAt: Date
}

export const MOCK_USERS: Record<string, MockUser> = {
  alex: {
    id: 'user_001',
    name: 'Alex Chen',
    avatar: '/avatars/avatar-1.png',
    role: 'participant',
    joinedAt: new Date('2025-10-01T09:00:00Z')
  },
  jordan: {
    id: 'user_002',
    name: 'Jordan Rivera',
    avatar: '/avatars/avatar-2.png',
    role: 'moderator',
    joinedAt: new Date('2025-10-01T09:15:00Z')
  },
  sam: {
    id: 'user_003',
    name: 'Sam Okafor',
    avatar: '/avatars/avatar-3.png',
    role: 'participant',
    joinedAt: new Date('2025-10-01T10:30:00Z')
  },
  taylor: {
    id: 'user_004',
    name: 'Taylor Kim',
    avatar: '/avatars/avatar-4.png',
    role: 'participant',
    joinedAt: new Date('2025-10-01T11:00:00Z')
  },
  morgan: {
    id: 'user_005',
    name: 'Morgan Patel',
    avatar: '/avatars/avatar-5.png',
    role: 'observer',
    joinedAt: new Date('2025-10-01T13:00:00Z')
  }
}

/* ======================== MOCK DELIBERATION ======================== */

export interface MockDeliberation {
  id: string
  title: string
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'CONCLUDED'
  createdAt: Date
  participantCount: number
  propositionCount: number
  claimCount: number
}

export const MOCK_DELIBERATION: MockDeliberation = {
  id: 'delib_001',
  title: 'Improving Committee Decision-Making Processes',
  status: 'ACTIVE',
  createdAt: new Date('2025-10-01T09:00:00Z'),
  participantCount: 5,
  propositionCount: 8,
  claimCount: 3
}

/* ======================== MOCK PROPOSITIONS ======================== */

export interface MockProposition {
  id: string
  claimText: string
  rationale?: string
  authorId: string
  authorName: string
  authorAvatar: string
  status: 'DRAFT' | 'PUBLISHED' | 'CLAIMED' | 'ARCHIVED'
  createdAt: Date
  voteCount: number
  endorsementCount: number
  replyCount: number
  sources?: { url: string; title: string }[]
  promotedClaimId?: string
}

export const MOCK_PROPOSITIONS: MockProposition[] = [
  {
    id: 'prop_001',
    claimText: 'This committee should adopt ranked-choice voting for all internal decisions',
    rationale: 'Ranked-choice voting eliminates strategic voting behavior and ensures decisions have genuine majority support. It also reduces the need for runoff votes, saving time.',
    authorId: MOCK_USERS.alex.id,
    authorName: MOCK_USERS.alex.name,
    authorAvatar: MOCK_USERS.alex.avatar,
    status: 'PUBLISHED',
    createdAt: new Date('2025-10-01T14:30:00Z'),
    voteCount: 8,
    endorsementCount: 3,
    replyCount: 5,
    sources: [
      { 
        url: 'https://fairvote.org/resources/data-on-rcv/', 
        title: 'FairVote: Research on Ranked Choice Voting' 
      }
    ]
  },
  {
    id: 'prop_002',
    claimText: 'Meeting minutes should be published within 24 hours of each session',
    rationale: 'Delayed minutes reduce accountability and make it harder for absent members to stay informed. A 24-hour deadline is feasible with our current staffing.',
    authorId: MOCK_USERS.jordan.id,
    authorName: MOCK_USERS.jordan.name,
    authorAvatar: MOCK_USERS.jordan.avatar,
    status: 'PUBLISHED',
    createdAt: new Date('2025-10-01T15:15:00Z'),
    voteCount: 12,
    endorsementCount: 5,
    replyCount: 3,
    sources: []
  },
  {
    id: 'prop_003',
    claimText: 'We should create a standing subcommittee for technology policy',
    rationale: 'Technology issues arise frequently but lack dedicated oversight. A subcommittee would develop specialized expertise.',
    authorId: MOCK_USERS.sam.id,
    authorName: MOCK_USERS.sam.name,
    authorAvatar: MOCK_USERS.sam.avatar,
    status: 'PUBLISHED',
    createdAt: new Date('2025-10-01T16:00:00Z'),
    voteCount: 6,
    endorsementCount: 2,
    replyCount: 7,
    sources: []
  },
  {
    id: 'prop_004',
    claimText: 'Quorum requirements should be reduced from 75% to 60% attendance',
    authorId: MOCK_USERS.taylor.id,
    authorName: MOCK_USERS.taylor.name,
    authorAvatar: MOCK_USERS.taylor.avatar,
    status: 'DRAFT',
    createdAt: new Date('2025-10-01T16:45:00Z'),
    voteCount: 2,
    endorsementCount: 0,
    replyCount: 1,
    sources: []
  }
]

/* ======================== MOCK VOTES ======================== */

export interface MockVote {
  id: string
  propositionId: string
  userId: string
  userName: string
  value: number // +1 for upvote, -1 for downvote
  createdAt: Date
}

export const MOCK_VOTES: MockVote[] = [
  { id: 'vote_001', propositionId: 'prop_001', userId: MOCK_USERS.jordan.id, userName: MOCK_USERS.jordan.name, value: 1, createdAt: new Date('2025-10-01T14:35:00Z') },
  { id: 'vote_002', propositionId: 'prop_001', userId: MOCK_USERS.sam.id, userName: MOCK_USERS.sam.name, value: 1, createdAt: new Date('2025-10-01T14:40:00Z') },
  { id: 'vote_003', propositionId: 'prop_001', userId: MOCK_USERS.taylor.id, userName: MOCK_USERS.taylor.name, value: 1, createdAt: new Date('2025-10-01T14:50:00Z') },
  { id: 'vote_004', propositionId: 'prop_002', userId: MOCK_USERS.alex.id, userName: MOCK_USERS.alex.name, value: 1, createdAt: new Date('2025-10-01T15:20:00Z') },
  { id: 'vote_005', propositionId: 'prop_002', userId: MOCK_USERS.sam.id, userName: MOCK_USERS.sam.name, value: 1, createdAt: new Date('2025-10-01T15:25:00Z') }
]

/* ======================== MOCK ENDORSEMENTS ======================== */

export interface MockEndorsement {
  id: string
  propositionId: string
  userId: string
  userName: string
  userAvatar: string
  reasoning?: string
  createdAt: Date
}

export const MOCK_ENDORSEMENTS: MockEndorsement[] = [
  {
    id: 'endorse_001',
    propositionId: 'prop_001',
    userId: MOCK_USERS.jordan.id,
    userName: MOCK_USERS.jordan.name,
    userAvatar: MOCK_USERS.jordan.avatar,
    reasoning: 'I have experience implementing RCV in another organization and saw immediate improvements in decision quality.',
    createdAt: new Date('2025-10-01T14:35:00Z')
  },
  {
    id: 'endorse_002',
    propositionId: 'prop_001',
    userId: MOCK_USERS.sam.id,
    userName: MOCK_USERS.sam.name,
    userAvatar: MOCK_USERS.sam.avatar,
    createdAt: new Date('2025-10-01T15:00:00Z')
  },
  {
    id: 'endorse_003',
    propositionId: 'prop_002',
    userId: MOCK_USERS.alex.id,
    userName: MOCK_USERS.alex.name,
    userAvatar: MOCK_USERS.alex.avatar,
    reasoning: 'Transparency is essential for trust. This timeline is achievable and necessary.',
    createdAt: new Date('2025-10-01T15:30:00Z')
  }
]

/* ======================== MOCK REPLIES ======================== */

export interface MockReply {
  id: string
  propositionId: string
  userId: string
  userName: string
  userAvatar: string
  text: string
  createdAt: Date
}

export const MOCK_REPLIES: MockReply[] = [
  {
    id: 'reply_001',
    propositionId: 'prop_001',
    userId: MOCK_USERS.taylor.id,
    userName: MOCK_USERS.taylor.name,
    userAvatar: MOCK_USERS.taylor.avatar,
    text: 'What about the learning curve? Would we need training for all members?',
    createdAt: new Date('2025-10-01T14:45:00Z')
  },
  {
    id: 'reply_002',
    propositionId: 'prop_001',
    userId: MOCK_USERS.alex.id,
    userName: MOCK_USERS.alex.name,
    userAvatar: MOCK_USERS.alex.avatar,
    text: 'Good question. RCV is intuitive—just rank candidates in order of preference. We could do a 10-minute demo session.',
    createdAt: new Date('2025-10-01T14:50:00Z')
  },
  {
    id: 'reply_003',
    propositionId: 'prop_002',
    userId: MOCK_USERS.taylor.id,
    userName: MOCK_USERS.taylor.name,
    userAvatar: MOCK_USERS.taylor.avatar,
    text: 'Would this apply to all meetings or just main committee sessions?',
    createdAt: new Date('2025-10-01T15:35:00Z')
  }
]

/* ======================== MOCK CLAIMS ======================== */

export interface MockClaim {
  id: string
  text: string
  sourcePropositionId: string
  status: 'ACTIVE' | 'ACCEPTED' | 'REJECTED' | 'CONTESTED'
  supportLevel: number // 0-1 (percentage of support)
  supportingArgumentCount: number
  attackingArgumentCount: number
  createdAt: Date
}

export const MOCK_CLAIMS: MockClaim[] = [
  {
    id: 'claim_001',
    text: 'Ranked-choice voting reduces strategic voting behavior',
    sourcePropositionId: 'prop_001',
    status: 'ACTIVE',
    supportLevel: 0.75,
    supportingArgumentCount: 4,
    attackingArgumentCount: 1,
    createdAt: new Date('2025-10-02T09:00:00Z')
  },
  {
    id: 'claim_002',
    text: 'Timely publication of minutes increases organizational transparency',
    sourcePropositionId: 'prop_002',
    status: 'ACTIVE',
    supportLevel: 0.85,
    supportingArgumentCount: 6,
    attackingArgumentCount: 0,
    createdAt: new Date('2025-10-02T10:00:00Z')
  },
  {
    id: 'claim_003',
    text: 'Specialized subcommittees improve policy expertise',
    sourcePropositionId: 'prop_003',
    status: 'CONTESTED',
    supportLevel: 0.60,
    supportingArgumentCount: 3,
    attackingArgumentCount: 3,
    createdAt: new Date('2025-10-02T11:00:00Z')
  }
]

/* ======================== MOCK ARGUMENTS ======================== */

export interface MockArgument {
  id: string
  claimId: string
  schemeType: 'from-expert' | 'from-example' | 'from-cause' | 'from-consequence'
  schemeName: string
  premises: string[]
  conclusion: string
  authorId: string
  authorName: string
  strength: number // 0-1
  createdAt: Date
}

export const MOCK_ARGUMENTS: MockArgument[] = [
  {
    id: 'arg_001',
    claimId: 'claim_001',
    schemeType: 'from-expert',
    schemeName: 'Argument from Expert Opinion',
    premises: [
      'FairVote (electoral reform experts) states that RCV eliminates vote-splitting',
      'FairVote has studied RCV implementations across 50+ jurisdictions',
      'FairVote is a credible authority on voting systems'
    ],
    conclusion: 'Ranked-choice voting reduces strategic voting behavior',
    authorId: MOCK_USERS.alex.id,
    authorName: MOCK_USERS.alex.name,
    strength: 0.8,
    createdAt: new Date('2025-10-02T09:30:00Z')
  },
  {
    id: 'arg_002',
    claimId: 'claim_001',
    schemeType: 'from-example',
    schemeName: 'Argument from Example',
    premises: [
      'Maine adopted RCV in 2016',
      'Maine saw a 15% decrease in spoiler candidates',
      'Maine is similar to our committee context'
    ],
    conclusion: 'Ranked-choice voting reduces strategic voting behavior',
    authorId: MOCK_USERS.jordan.id,
    authorName: MOCK_USERS.jordan.name,
    strength: 0.7,
    createdAt: new Date('2025-10-02T10:00:00Z')
  }
]

/* ======================== MOCK ATTACKS (DIALOGUE MOVES) ======================== */

export interface MockAttack {
  id: string
  argumentId: string
  attackType: 'rebut' | 'undercut' | 'undermine'
  targetPremiseIndex?: number // Which premise is attacked (for rebuts)
  attackText: string
  authorId: string
  authorName: string
  createdAt: Date
}

export const MOCK_ATTACKS: MockAttack[] = [
  {
    id: 'attack_001',
    argumentId: 'arg_001',
    attackType: 'undercut',
    attackText: 'FairVote is a partisan organization that advocates for voting system changes, which may bias their research.',
    authorId: MOCK_USERS.taylor.id,
    authorName: MOCK_USERS.taylor.name,
    createdAt: new Date('2025-10-02T11:00:00Z')
  },
  {
    id: 'attack_002',
    argumentId: 'arg_002',
    attackType: 'rebut',
    targetPremiseIndex: 2,
    attackText: 'Maine operates at state level with thousands of voters, while our committee has 12 members. The contexts are not comparable.',
    authorId: MOCK_USERS.sam.id,
    authorName: MOCK_USERS.sam.name,
    createdAt: new Date('2025-10-02T11:30:00Z')
  }
]

/* ======================== MOCK ROOM MESSAGES (PRE-DELIBERATION) ======================== */

export interface MockMessage {
  id: string
  threadId: string
  authorId: string
  authorName: string
  authorAvatar: string
  text: string
  createdAt: Date
}

export const MOCK_ROOM_MESSAGES: MockMessage[] = [
  {
    id: 'msg_001',
    threadId: 'thread_001',
    authorId: MOCK_USERS.alex.id,
    authorName: MOCK_USERS.alex.name,
    authorAvatar: MOCK_USERS.alex.avatar,
    text: 'Has anyone else noticed that our voting process creates a lot of strategic behavior?',
    createdAt: new Date('2025-10-01T12:00:00Z')
  },
  {
    id: 'msg_002',
    threadId: 'thread_001',
    authorId: MOCK_USERS.jordan.id,
    authorName: MOCK_USERS.jordan.name,
    authorAvatar: MOCK_USERS.jordan.avatar,
    text: 'Definitely. I often vote for my second choice to prevent my least favorite from winning.',
    createdAt: new Date('2025-10-01T12:05:00Z')
  },
  {
    id: 'msg_003',
    threadId: 'thread_001',
    authorId: MOCK_USERS.sam.id,
    authorName: MOCK_USERS.sam.name,
    authorAvatar: MOCK_USERS.sam.avatar,
    text: 'Same here. What if we tried ranked-choice voting?',
    createdAt: new Date('2025-10-01T12:10:00Z')
  },
  {
    id: 'msg_004',
    threadId: 'thread_001',
    authorId: MOCK_USERS.taylor.id,
    authorName: MOCK_USERS.taylor.name,
    authorAvatar: MOCK_USERS.taylor.avatar,
    text: 'I like that idea. We used it in my previous organization and it worked well.',
    createdAt: new Date('2025-10-01T12:15:00Z')
  }
]

/* ======================== UTILITY FUNCTIONS ======================== */

export const getPropositionById = (id: string): MockProposition | undefined => {
  return MOCK_PROPOSITIONS.find(p => p.id === id)
}

export const getVotesForProposition = (propositionId: string): MockVote[] => {
  return MOCK_VOTES.filter(v => v.propositionId === propositionId)
}

export const getEndorsementsForProposition = (propositionId: string): MockEndorsement[] => {
  return MOCK_ENDORSEMENTS.filter(e => e.propositionId === propositionId)
}

export const getRepliesForProposition = (propositionId: string): MockReply[] => {
  return MOCK_REPLIES.filter(r => r.propositionId === propositionId)
}

export const getArgumentsForClaim = (claimId: string): MockArgument[] => {
  return MOCK_ARGUMENTS.filter(a => a.claimId === claimId)
}

export const getAttacksForArgument = (argumentId: string): MockAttack[] => {
  return MOCK_ATTACKS.filter(a => a.argumentId === argumentId)
}

/* ======================== PROMOTION CRITERIA ======================== */

export interface PromotionCriteria {
  minimumVotes: number
  minimumEndorsements: number
  minimumVoteRatio: number // votes / participants
}

export const DEFAULT_PROMOTION_CRITERIA: PromotionCriteria = {
  minimumVotes: 5,
  minimumEndorsements: 2,
  minimumVoteRatio: 0.4 // 40% of participants
}

export const canPromoteToClaim = (
  proposition: MockProposition,
  criteria: PromotionCriteria = DEFAULT_PROMOTION_CRITERIA
): boolean => {
  const meetsVotes = proposition.voteCount >= criteria.minimumVotes
  const meetsEndorsements = proposition.endorsementCount >= criteria.minimumEndorsements
  const meetsRatio = proposition.voteCount / MOCK_DELIBERATION.participantCount >= criteria.minimumVoteRatio
  
  return meetsVotes && meetsEndorsements && meetsRatio
}