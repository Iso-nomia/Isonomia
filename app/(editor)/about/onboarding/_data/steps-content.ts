// app/onboarding/_data/steps-content.ts
import { DiscussionViewDemo } from '../_demos/discussion-view-demo'

import { 
  MessageSquare,
  Lightbulb,
  Vote,
  FileCheck,
  Map,
  GitBranch,
  List,
  Swords,
  Layout,
  BookOpen,
  Share2,
  type LucideIcon
} from 'lucide-react'


/* ======================== TYPE DEFINITIONS ======================== */

export interface Annotation {
  id: string
  x: number          // Percentage (0-100)
  y: number          // Percentage (0-100)
  label: string      // "1", "2", "3"
  title: string      // Short heading
  description: string // Detailed explanation
}

export interface Screenshot {
  src: string
  alt: string
  annotations: Annotation[]
}

export interface SchemaField {
  name: string
  type: string
  description: string
  optional?: boolean
  defaultValue?: string
}

export interface SchemaRelation {
  name: string
  target: string
  cardinality: '1:1' | '1:N' | 'N:M'
  description: string
}

export interface SchemaReference {
  model: string
  fields: SchemaField[]
  relations?: SchemaRelation[]
}

export interface StepContent {
  what: string       // Technical description
  why: string        // Design rationale
  userAction: string // Concrete user behavior
}

export interface OnboardingStep {
  id: string
  number: number
  title: string
  shortTitle: string  // For mobile nav
  icon: LucideIcon
  summary: string     // 1-2 sentence overview
  content: StepContent
  screenshot: Screenshot
  demo?: string       // Path to demo component (optional)
  schema: SchemaReference
  transition?: string // Bridge text to next step
}

/* ======================== STEP 1: JOIN DISCUSSION ======================== */

const STEP_1: OnboardingStep = {
  id: 'join-discussion',
  number: 1,
  title: 'Join Discussion → Deliberation',
  shortTitle: 'Join',
  icon: MessageSquare,
  summary: 'Transform a casual conversation into a structured deliberation space with enhanced reasoning tools.',
  
  content: {
    what: `When a conversation thread in a Room demonstrates sustained engagement (typically 10+ messages with multiple participants), any member can upgrade it to a Deliberation. This transformation migrates all existing messages into a new workspace equipped with structured argumentation tools while preserving the original conversational context. The system automatically creates a Deliberation entity, links it to the parent Room, and initializes the deliberative protocol layer.`,
    
    why: `Not all conversations require formal structure. Most casual exchanges—greetings, status updates, clarifications—function perfectly well as unstructured messages. Imposing deliberative protocols prematurely creates friction without benefit. The upgrade threshold ensures structure activates only when complexity warrants it. This design follows the principle of progressive disclosure: simple tools for simple tasks, powerful tools available on-demand when complexity increases. The migration of existing messages preserves continuity, avoiding the disruptive "start over" pattern common in other platforms.`,
    
    userAction: `Navigate to any active conversation thread in a Room. When the thread shows sustained engagement (system suggests upgrade after 8+ messages with 3+ participants), click the "Upgrade to Deliberation" button in the thread header. The system displays a confirmation modal showing: thread title (auto-generated from first message or manually specified), participant count, message count, and estimated migration time. Confirm upgrade. The system creates the Deliberation, migrates messages, and redirects all participants to the new deliberative workspace. Original Room thread becomes read-only with a forwarding link.`
  },

  screenshot: {
    src: '/screenshots/onboarding/step-01-join-discussion.png',
    alt: 'Room interface showing an active conversation thread with the "Upgrade to Deliberation" button highlighted',
    annotations: [
      {
        id: 'thread-messages',
        x: 25,
        y: 35,
        label: '1',
        title: 'Active Thread',
        description: 'Conversation thread with 12 messages from 4 participants discussing ranked-choice voting implementation. Thread shows natural engagement pattern suggesting deliberative potential.'
      },
      {
        id: 'participant-count',
        x: 25,
        y: 20,
        label: '2',
        title: 'Engagement Indicators',
        description: 'Header displays participant count (4), message count (12), and thread duration (2h 34m). These metrics help users assess whether upgrade is warranted.'
      },
      {
        id: 'upgrade-button',
        x: 75,
        y: 20,
        label: '3',
        title: 'Upgrade to Deliberation',
        description: 'Primary action button becomes available when thread meets engagement threshold. Button includes icon (↑) and tooltip explaining the transformation process.'
      },
      {
        id: 'thread-context',
        x: 50,
        y: 60,
        label: '4',
        title: 'Message Context',
        description: 'Individual messages show author, timestamp, and basic reactions. This informal structure works well for exploration but lacks support for formal argumentation—the reason for upgrading.'
      }
    ]
  },

  demo: 'discussion-upgrade', // Interactive demo showing thread → deliberation upgrade
  

  schema: {
    model: 'Deliberation',
    fields: [
      { 
        name: 'id', 
        type: 'String', 
        description: 'Unique identifier (UUID format)' 
      },
      { 
        name: 'title', 
        type: 'String', 
        description: 'Discussion topic (max 200 chars)' 
      },
      { 
        name: 'status', 
        type: 'ACTIVE | PAUSED | ARCHIVED | CONCLUDED', 
        description: 'Current lifecycle state' 
      },
      { 
        name: 'createdAt', 
        type: 'DateTime', 
        description: 'Timestamp of deliberation creation' 
      },
      { 
        name: 'createdById', 
        type: 'String', 
        description: 'User who initiated the upgrade' 
      },
      { 
        name: 'roomId', 
        type: 'String', 
        description: 'Foreign key to parent Room' 
      },
      {
        name: 'sourceThreadId',
        type: 'String',
        description: 'Reference to original Room thread',
        optional: true
      },
      {
        name: 'participantCount',
        type: 'Int',
        description: 'Cached count of active participants',
        defaultValue: '0'
      }
    ],
    relations: [
      { 
        name: 'room', 
        target: 'Room', 
        cardinality: '1:1', 
        description: 'Parent room where thread originated' 
      },
      { 
        name: 'propositions', 
        target: 'Proposition', 
        cardinality: '1:N', 
        description: 'Structured contributions from participants' 
      },
      { 
        name: 'participants', 
        target: 'User', 
        cardinality: 'N:M', 
        description: 'Users engaged in deliberation (via join table)' 
      },
      {
        name: 'claims',
        target: 'Claim',
        cardinality: '1:N',
        description: 'Promoted propositions that become arguable claims'
      }
    ]
  },

  transition: `Once elevated to a Deliberation, participants shift from informal messaging to structured Propositions—contributions designed to be evaluated, endorsed, and potentially promoted to arguable Claims...`
}


/* ======================== STEP 1.5: DISCUSSION CHAT/FORUM TABS ======================== */

const STEP_1_5: OnboardingStep = {
  id: 'live-chat',
  number: 1.5,
  title: 'Switch Between Chat and Forum Modes',
  shortTitle: 'Chat Tabs',
  icon: MessageSquare,
  summary: 'Toggle between real-time chat for quick exchanges and threaded forum for structured discussions—all within a single Discussion.',
  
  content: {
    what: `Within any Discussion, participants can switch between two distinct interaction modes via header tabs: (1) Chat mode—a live messaging interface with real-time updates, optimized for quick back-and-forth exchanges and informal conversation, and (2) Forum mode—a threaded discussion view where contributions are organized as top-level posts with nested replies, supporting structured exploration of ideas. Both modes share the same underlying Discussion entity and can reference content across contexts. The system maintains separate data stores (Conversation for chat, ForumComment for forum posts) but presents them through a unified interface.`,
    
    why: `Different types of discourse require different interaction patterns. Chat excels for rapid clarification, brainstorming, and building social cohesion—the informal "hallway conversation" that lubricates collaboration. Forum threads excel for developing complex ideas that require careful reading, citation, and asynchronous participation across time zones. Forcing all discourse into a single mode creates friction: chat becomes overwhelming for complex topics, while forums feel sluggish for simple questions. By unifying both modes in a single Discussion, Mesh preserves context—users can reference forum arguments in chat, or promote chat insights into forum threads—while letting participants choose the interaction style that fits their current need. This design follows the principle of contextual adaptation: the tool adapts to the discourse, not vice versa.`,
    
    userAction: `Within any active Discussion, locate the mode selector in the header (typically center-right, after the discussion title and description). Click "Chat" to enter real-time messaging mode, where you can compose and send messages instantly, see typing indicators, and receive live notifications. Click "Forum" to switch to threaded discussion mode, where you can create top-level posts with titles and nested replies. The system preserves your scroll position and draft content when switching modes. To reference content across modes: in Forum, click "Quote in Chat" on any post to copy it into the chat composer; in Chat, use /forum [keyword] commands to link to relevant forum threads. Both modes respect the same Discussion-level permissions and participant list.`
  },

  screenshot: {
    src: '/screenshots/onboarding/step-1.5-chat-discussion.png',
    alt: 'Discussion interface showing Chat and Forum tabs in the header with both modes visible',
    annotations: [
      {
        id: 'mode-tabs',
        x: 65,
        y: 15,
        label: '1',
        title: 'Chat/Forum Toggle',
        description: 'Tab buttons in the Discussion header let you switch between live chat and threaded forum modes. Active tab is highlighted with distinct background color.'
      },
      {
        id: 'chat-interface',
        x: 30,
        y: 50,
        label: '2',
        title: 'Chat Mode',
        description: 'Real-time messaging interface with message composer at bottom, live updates, typing indicators, and chronological message flow. Optimized for quick exchanges.'
      },
      {
        id: 'forum-interface',
        x: 70,
        y: 50,
        label: '3',
        title: 'Forum Mode',
        description: 'Threaded discussion view with top-level posts, nested replies, post titles, and rich formatting. Better for structured, asynchronous discourse.'
      },
      {
        id: 'cross-reference',
        x: 50,
        y: 75,
        label: '4',
        title: 'Cross-Mode References',
        description: 'Context menu shows "Quote in Chat" option on forum posts, and chat supports /forum commands to link to threads. Content can be referenced across both modes.'
      }
    ]
  },

  demo: 'live-chat', // Interactive demo showing chat/forum tab switching
  
  schema: {
    model: 'Discussion',
    fields: [
      { 
        name: 'id', 
        type: 'String', 
        description: 'Unique identifier (UUID format)' 
      },
      { 
        name: 'title', 
        type: 'String', 
        description: 'Discussion topic (max 200 chars)' 
      },
      { 
        name: 'description', 
        type: 'Text', 
        description: 'Optional extended description',
        optional: true
      },
      { 
        name: 'conversationId', 
        type: 'String', 
        description: 'FK to Conversation (chat mode data)',
        optional: true
      },
      { 
        name: 'createdAt', 
        type: 'DateTime', 
        description: 'Timestamp of creation' 
      },
      { 
        name: 'createdById', 
        type: 'String', 
        description: 'User who created the discussion' 
      },
      { 
        name: 'roomId', 
        type: 'String', 
        description: 'Foreign key to parent Room',
        optional: true
      }
    ],
    relations: [
      { 
        name: 'conversation', 
        target: 'Conversation', 
        cardinality: '1:1', 
        description: 'Chat mode messages (real-time messaging) - optional'
      },
      { 
        name: 'forumComments', 
        target: 'ForumComment', 
        cardinality: '1:N', 
        description: 'Forum mode posts and replies (threaded discussion)' 
      },
      { 
        name: 'room', 
        target: 'Room', 
        cardinality: '1:1', 
        description: 'Parent room context - optional'
      },
      {
        name: 'deliberations',
        target: 'Deliberation',
        cardinality: '1:N',
        description: 'Promoted structured deliberations from this discussion'
      }
    ]
  },

  transition: `With both chat and forum modes available, participants can choose the interaction style that fits their needs. For more structured reasoning, the Discussion can be upgraded to a formal Deliberation...`
}

/* ======================== STEP 2: COMPOSE PROPOSITION ======================== */

const STEP_2: OnboardingStep = {
  id: 'compose-proposition',
  number: 2,
  title: 'Compose Proposition',
  shortTitle: 'Compose',
  icon: Lightbulb,
  summary: 'Submit a structured contribution to the deliberation with explicit context and supporting rationale.',

  content: {
    what: `Within a Deliberation, participants create Propositions instead of freeform messages. Each Proposition contains: (1) a claim statement (the actual proposal), (2) optional supporting rationale (explanatory text), (3) optional source citations (links to evidence), and (4) metadata (author, timestamp, status). The Proposition Composer is a dedicated form with three input fields plus submission controls. Upon submission, the system validates the proposition text (minimum 10 characters, maximum 1000 characters), assigns a unique identifier, sets status to DRAFT, and adds it to the Deliberation's proposition list.`,

    why: `Propositions differ from chat messages in three critical ways: (1) they are individually addressable—each has a stable URI enabling precise reference in later arguments, (2) they support structured workflows—voting, endorsement, promotion to Claim—that would be nonsensical for chat messages, and (3) they carry semantic weight—the system treats them as candidate positions that require collective evaluation. The dedicated composer interface signals this shift from "having a conversation" to "making a proposal." Required fields (claim text) and optional fields (rationale, sources) give users flexibility while maintaining minimum quality standards. The character limits prevent both trivial inputs and overwhelming walls of text.`,

    userAction: `Inside a Deliberation, locate the Proposition Composer (typically pinned at bottom of screen or accessible via floating action button). Click into the "Claim" text area and type your core proposition (e.g., "This committee should adopt ranked-choice voting for all internal decisions"). Optionally, click "Add Rationale" to expand a second text area and provide supporting explanation (e.g., "Ranked-choice voting eliminates strategic voting and ensures majority support"). Optionally, click "Add Source" to attach URLs to external evidence. When ready, click "Submit Proposition." The system validates input, creates the Proposition entity with status=DRAFT, and displays it in the deliberation feed. Other participants can now see, vote on, and respond to your proposition.`
  },

  screenshot: {
    src: '/screenshots/onboarding/step-02-proposition-composer.png',
    alt: 'Proposition Composer interface showing text fields for claim, rationale, and sources with submission button',
    annotations: [
      {
        id: 'claim-field',
        x: 50,
        y: 30,
        label: '1',
        title: 'Claim Text Field',
        description: 'Primary input for the proposition statement. Required field. Character counter shows 45/1000. Placeholder text guides users toward clear, declarative claims.'
      },
      {
        id: 'rationale-field',
        x: 50,
        y: 50,
        label: '2',
        title: 'Rationale (Optional)',
        description: 'Collapsible section for explanatory context. Users can expand via "Add Rationale" button. Supports markdown formatting for structured explanations.'
      },
      {
        id: 'sources-field',
        x: 50,
        y: 65,
        label: '3',
        title: 'Sources (Optional)',
        description: 'Multiple URL inputs for citing evidence. Each source includes URL field + optional description field. System validates URLs and fetches metadata (title, favicon) on blur.'
      },
      {
        id: 'submit-button',
        x: 80,
        y: 80,
        label: '4',
        title: 'Submit Proposition',
        description: 'Creates Proposition entity with status=DRAFT. Button disabled until minimum requirements met (claim text ≥ 10 chars). Keyboard shortcut: Cmd/Ctrl+Enter.'
      },
      {
        id: 'validation-feedback',
        x: 20,
        y: 80,
        label: '5',
        title: 'Validation Feedback',
        description: 'Real-time indicators show input validity: character count, URL validation status, and any error messages. Green checkmarks indicate valid fields.'
      }
    ]
  },

  schema: {
    model: 'Proposition',
    fields: [
      { 
        name: 'id', 
        type: 'String', 
        description: 'Unique identifier (UUID format)' 
      },
      { 
        name: 'claimText', 
        type: 'String', 
        description: 'Core proposition statement (10-1000 chars)' 
      },
      { 
        name: 'rationale', 
        type: 'Text', 
        description: 'Optional supporting explanation',
        optional: true
      },
      { 
        name: 'status', 
        type: 'DRAFT | PUBLISHED | CLAIMED | ARCHIVED', 
        description: 'Current lifecycle state',
        defaultValue: 'DRAFT'
      },
      { 
        name: 'createdAt', 
        type: 'DateTime', 
        description: 'Timestamp of creation' 
      },
      { 
        name: 'authorId', 
        type: 'String', 
        description: 'Foreign key to User who created proposition' 
      },
      { 
        name: 'deliberationId', 
        type: 'String', 
        description: 'Foreign key to parent Deliberation' 
      },
      {
        name: 'voteCount',
        type: 'Int',
        description: 'Cached sum of upvotes (denormalized for performance)',
        defaultValue: '0'
      },
      {
        name: 'endorsementCount',
        type: 'Int',
        description: 'Cached count of explicit endorsements',
        defaultValue: '0'
      },
      {
        name: 'promotedClaimId',
        type: 'String',
        description: 'Reference to Claim if proposition was promoted',
        optional: true
      }
    ],
    relations: [
      { 
        name: 'author', 
        target: 'User', 
        cardinality: '1:1', 
        description: 'User who authored the proposition' 
      },
      { 
        name: 'deliberation', 
        target: 'Deliberation', 
        cardinality: '1:1', 
        description: 'Parent deliberation context' 
      },
      { 
        name: 'votes', 
        target: 'Vote', 
        cardinality: '1:N', 
        description: 'Individual vote records from participants' 
      },
      {
        name: 'endorsements',
        target: 'Endorsement',
        cardinality: '1:N',
        description: 'Explicit endorsement records (stronger than votes)'
      },
      {
        name: 'replies',
        target: 'Reply',
        cardinality: '1:N',
        description: 'Direct responses to this proposition'
      },
      {
        name: 'sources',
        target: 'Source',
        cardinality: '1:N',
        description: 'Citations and evidence links'
      },
      {
        name: 'promotedClaim',
        target: 'Claim',
        cardinality: '1:1',
        description: 'Claim entity if proposition was promoted (optional)'
      }
    ]
  },

  transition: `After submitting a Proposition, it enters a workshop phase where other participants can vote, endorse, or reply to refine and validate the idea before it becomes a formal Claim...`
}

/* ======================== STEP 3: WORKSHOP (VOTE, ENDORSE, REPLY) ======================== */

const STEP_3: OnboardingStep = {
  id: 'workshop',
  number: 3,
  title: 'Workshop (Vote, Endorse, Reply)',
  shortTitle: 'Workshop',
  icon: Vote,
  summary: 'Collectively evaluate propositions through voting, endorsements, and constructive replies to refine ideas before promotion.',

  content: {
    what: `Within the PropositionsList view, participants engage with each Proposition through three graduated interaction mechanisms: (1) Voting—binary approval signals (upvote/downvote) that aggregate into a net score displayed prominently on each proposition card, (2) Endorsements—explicit markers of support that carry more weight than votes and signal readiness for promotion (tracked via PropositionEndorsement records), and (3) Replies—threaded text responses that provide constructive feedback, questions, or refinements (stored as PropositionReply entities). Each interaction updates cached counters (voteUpCount, voteDownCount, endorseCount, replyCount) on the Proposition model for performant rendering. The system tracks viewer-specific state (viewerVote, viewerEndorsed) to show personalized button states. All interactions are scoped to authenticated users and support optimistic UI updates with rollback on failure.`,
    
    why: `Not all engagement requires equal cognitive investment. The three-tier interaction model respects different participation styles and time constraints: (1) Voting enables quick, low-friction feedback—participants can signal agreement/disagreement in under a second, allowing rapid collective evaluation of many propositions. This is essential for busy contributors who want to stay engaged without deep time commitment. (2) Endorsements sit between voting and full argumentation—they signal "I vouch for this idea and think it deserves formal consideration," creating a quality filter before promotion. The explicit endorsement action (vs. just upvoting) adds deliberative friction that reduces noise. (3) Replies enable deep engagement—asking clarifying questions, proposing refinements, or identifying weaknesses. This threaded discussion lets propositions evolve iteratively before crystallizing into Claims. The graduated model follows the principle of progressive engagement: make it easy to participate lightly, but provide pathways for deeper involvement. Cached counters (voteUpCount, etc.) avoid expensive aggregation queries on every render, enabling real-time list performance with hundreds of propositions. Optimistic updates provide instant feedback while background sync maintains consistency.`,
    
    userAction: `Within any Deliberation, scroll through the PropositionsList interface. Each proposition card displays: (1) Vote column (left side)—two buttons with arrows: click the up arrow to upvote (toggles if already upvoted), click the down arrow to downvote (toggles if already downvoted). The net score (upvotes minus downvotes) updates instantly and uses color coding: green for positive, red for negative, gray for neutral. (2) Action bar (bottom)—click "Endorse" to formally support the proposition (button turns highlighted state when endorsed; click again to un-endorse). Click "Respond" to expand an inline text area where you can type a reply (3-row textarea; hit "Post Reply" to submit, "Cancel" to close). Click "View Replies" to open a modal showing all threaded responses to the proposition with author names and timestamps. (3) Engagement badges (top-right corner)—small pill-shaped badges show endorsement count (sky blue with check icon) and reply count (indigo with message icon). Hover over badges for tooltips. The system immediately reflects your actions: vote buttons highlight, endorsement count increments, replies appear in the modal. All state persists across page refreshes via API sync. If a proposition has been promoted to a Claim, its left edge shows a green indicator bar and the action bar displays "View Claim" instead of "Promote."`
  },

  screenshot: {
    src: '/screenshots/onboarding/step-03-workshop.png',
    alt: 'PropositionsList interface showing multiple proposition cards with vote controls, endorsement badges, reply interactions, and net scores',
    annotations: [
      {
        id: 'vote-column',
        x: 10,
        y: 40,
        label: '1',
        title: 'Vote Controls',
        description: 'Upvote/downvote buttons with real-time net score display. Score uses color coding: +7 shown in green (positive), negative scores in red, neutral in gray. Click arrows to toggle votes—second click removes your vote.'
      },
      {
        id: 'proposition-text',
        x: 40,
        y: 35,
        label: '2',
        title: 'Proposition Content',
        description: 'Main proposition text in a gradient card with "Read more" expansion for long content (auto-truncates at 4 lines). Header shows timestamp and status badge (e.g., "Claim" badge with checkmark for promoted propositions).'
      },
      {
        id: 'engagement-badges',
        x: 75,
        y: 28,
        label: '3',
        title: 'Engagement Metrics',
        description: 'Pill-shaped badges show endorsement count (5) and reply count (3). Badges use color coding: sky blue for endorsements, indigo for replies. Active state (viewer has endorsed) shows darker background.'
      },
      {
        id: 'action-buttons',
        x: 35,
        y: 58,
        label: '4',
        title: 'Interaction Actions',
        description: 'Button row provides: Endorse (highlighted when endorsed), Respond (opens inline reply textarea), Share (copies proposition permalink), View Replies (opens modal with threaded discussion), and Promote to Claim (appears when promotion criteria met).'
      },
      {
        id: 'reply-interface',
        x: 40,
        y: 70,
        label: '5',
        title: 'Reply Composer',
        description: 'Inline reply interface appears when Respond clicked. 3-row textarea with character counter, Cancel and Post Reply buttons. Replies increment the reply count and appear in the View Replies modal.'
      },
      {
        id: 'status-indicator',
        x: 5,
        y: 35,
        label: '6',
        title: 'Status Bar',
        description: 'Green vertical bar on left edge indicates proposition has been promoted to Claim. Status also shown in header badge. Non-promoted propositions have no left bar.'
      },
      {
        id: 'filters-header',
        x: 70,
        y: 10,
        label: '7',
        title: 'List Filters',
        description: 'Header controls include search input (filter by text), status dropdown (All/Unclaimed/Claimed), and filter toggle button showing active filter count. Filters update list in real-time using SWR.'
      }
    ]
  },

  schema: {
    model: 'Proposition',
    fields: [
      { 
        name: 'id', 
        type: 'String', 
        description: 'Unique identifier (UUID format)' 
      },
      { 
        name: 'text', 
        type: 'String', 
        description: 'Proposition statement (from composer)' 
      },
      { 
        name: 'status', 
        type: 'DRAFT | PUBLISHED | CLAIMED | ARCHIVED', 
        description: 'Lifecycle state (CLAIMED when promoted)',
        defaultValue: 'PUBLISHED'
      },
      { 
        name: 'voteUpCount', 
        type: 'Int', 
        description: 'Cached count of upvotes (denormalized for performance)',
        defaultValue: '0'
      },
      { 
        name: 'voteDownCount', 
        type: 'Int', 
        description: 'Cached count of downvotes',
        defaultValue: '0'
      },
      { 
        name: 'endorseCount', 
        type: 'Int', 
        description: 'Cached count of explicit endorsements',
        defaultValue: '0'
      },
      { 
        name: 'replyCount', 
        type: 'Int', 
        description: 'Cached count of replies (for performance)',
        defaultValue: '0'
      },
      {
        name: 'promotedClaimId',
        type: 'String',
        description: 'Foreign key to Claim if promoted (nullable)',
        optional: true
      },
      {
        name: 'promotedAt',
        type: 'DateTime',
        description: 'Timestamp when proposition was promoted',
        optional: true
      },
      {
        name: 'mediaType',
        type: 'text | image | video | audio',
        description: 'Content type of proposition',
        defaultValue: 'text'
      },
      {
        name: 'mediaUrl',
        type: 'String',
        description: 'URL for media content (if not text)',
        optional: true
      }
    ],
    relations: [
      { 
        name: 'votes', 
        target: 'PropositionVote', 
        cardinality: '1:N', 
        description: 'Individual vote records (each user can cast one vote: -1, 0, or +1)' 
      },
      { 
        name: 'endorsements', 
        target: 'PropositionEndorsement', 
        cardinality: '1:N', 
        description: 'Explicit endorsement records (unique per user, no reasoning text—just boolean flag)' 
      },
      { 
        name: 'replies', 
        target: 'PropositionReply', 
        cardinality: '1:N', 
        description: 'Threaded text responses with author, timestamp, and reply text' 
      },
      {
        name: 'tags',
        target: 'PropositionTag',
        cardinality: '1:N',
        description: 'Optional tags for categorization (e.g., "topic:education")'
      },
      {
        name: 'promotedClaim',
        target: 'Claim',
        cardinality: '1:1',
        description: 'Reference to Claim entity after promotion (optional, one-to-one)'
      }
    ]
  },

  transition: `Once a Proposition accumulates sufficient support (vote threshold + endorsements), any participant can promote it to a Claim, elevating it into the formal argument graph where it becomes subject to structured argumentation...`
}
/* ======================== STEP 4: CLAIMS (PROMOTE & EXPLORE) ======================== */

const STEP_4: OnboardingStep = {
  id: 'claims',
  number: 4,
  title: 'Promote & Explore Claims',
  shortTitle: 'Claims',
  icon: Map,
  summary: 'Elevate validated propositions to Claims and navigate the emerging argument graph through interactive visual maps.',

  content: {
    what: `When a Proposition demonstrates collective validation (typically high net vote score plus endorsements), any participant can promote it to a Claim via the "Promote to Claim" button in the proposition card action bar. This single-click action creates a new Claim entity, sets the Proposition's status to CLAIMED, links the two via promotedClaimId, and timestamps the promotion. The newly created Claim becomes immediately visible in the Graph Explorer—a modal component that displays the complete argument structure as an interactive network graph. The Graph Explorer shows all claims as nodes positioned using multiple layout algorithms (force-directed, hierarchical, radial, or clustered), with edges representing support/attack relationships. Each node displays grounded semantics labels (IN/OUT/UNDEC as colored circles—green for warranted, red for defeated, gray for undecided), and the graph provides real-time insights including controversy detection, hub identification, and dialectical health metrics. Claims can be filtered by semantic status, and the graph supports multiple layout modes for different analytical tasks.`,
    
    why: `The promotion threshold serves a critical filtering function: not every proposition deserves entry into the formal argument graph. By requiring collective validation (votes + endorsements), the system ensures only ideas with demonstrated support consume the deliberative bandwidth required for formal argumentation. This prevents argument graph bloat and maintains focus on substantive positions. The Graph Explorer transforms the abstract argument structure into spatial reasoning—humans excel at recognizing patterns visually that would be impossible to detect in linear lists. The hierarchical layout (shown in screenshot) stratifies claims by dialectical status: IN claims (warranted) appear at top, UNDEC (undecided) in middle, OUT (defeated) at bottom—providing instant visual assessment of debate health. The support/counter percentage bars (39% support vs 61% counter in example) reveal aggregate dialectical balance. Controversy detection (yellow badges) highlights contested claims with balanced attacks/supports, directing participants' attention to productive engagement opportunities. Hub detection (purple badges) identifies architecturally critical claims that many arguments depend on. Edge styling (solid green for support, solid red for rebut, dashed orange for undercut) communicates relationship types at a glance. The layout selector enables task-specific views: hierarchical for status overview, force-directed for natural clustering, radial for controversy analysis, clustered for sub-debate detection. Interactive node selection (dark tooltip in screenshot) provides rich contextual data: support/attack strengths, in/out degree counts, grounded semantics label, enabling quantitative backing for visual patterns.`,
    
    userAction: `Within the PropositionsList, locate a proposition with high engagement (strong positive net score, multiple endorsements—these are typically displayed with visual prominence). Click the "Promote to Claim" button in the action bar. The system immediately creates the Claim and updates the proposition status. Click the "Graph Explorer" button (map icon, typically in sidebar or deliberation header) to open the interactive graph modal. The Graph Explorer displays the complete argument structure with multiple components visible: (1) At the top, "Argument Map" header shows total claim count (e.g., "40 claims") with chart and filter icons. (2) Support/Counter bars show aggregate balance (green "39%" vs red "61%"). (3) Filter buttons ("All (40)", "IN (25)", "OUT (15)", "UNDEC (0)") let you show only claims with specific grounded semantics labels. (4) Insight badges ("3 controversial", "3 hubs") highlight pattern detections. (5) The main graph canvas displays nodes as colored circles (green=IN, red=OUT, gray=UNDEC) connected by styled edges (solid green=support, solid red=rebut, dashed orange=undercut). (6) Current layout mode shown bottom-right ("Layout: Hierarchical")—click to cycle through force/hierarchical/radial/cluster views. (7) Click any node to select it—a dark tooltip appears showing claim text, status badges (OUT/CONTROVERSIAL/HUB), support/attack metrics, and in/out degree counts. (8) The selected claim details appear in "SELECTED CLAIM" panel below graph showing full text and claim ID. (9) Legend at bottom explains visual encoding: edge types (support/rebut/undercut lines), node colors (IN/OUT/UNDEC/Controversial/Hub circles), and controversy metric definition. Hover over nodes to see connections highlighted. Switch layout modes to reveal different structural patterns: hierarchical shows dialectical status stratification, force shows natural argument clusters, radial centers on controversial claims, clustered reveals independent sub-debates. Filter by semantic status to focus attention: click "IN" to see only warranted claims, "OUT" for defeated claims. The graph auto-refreshes when new claims or arguments are added, maintaining live deliberation state.`
  },

  screenshot: {
    src: '/screenshots/onboarding/step-04-claims-graph.png',
    alt: 'Graph Explorer modal showing hierarchical layout of 40 claims with grounded semantics coloring, support/counter metrics, controversy/hub detection, and interactive node selection with detailed tooltip',
    annotations: [
      {
        id: 'graph-explorer-header',
        x: 15,
        y: 5,
        label: '1',
        title: 'Graph Explorer Modal Header',
        description: 'Modal title "Graph Explorer" with subtitle "Navigate argument structure". Contains close button (X) in top-right. Opens when user clicks map icon in deliberation interface.'
      },
      {
        id: 'argument-map-header',
        x: 20,
        y: 12,
        label: '2',
        title: 'Argument Map Title & Claim Count',
        description: 'Shows "Argument Map" with total claim count ("40 claims"). Includes chart icon (layout selector) and info icon. Provides context for graph scale.'
      },
      {
        id: 'support-counter-bars',
        x: 30,
        y: 17,
        label: '3',
        title: 'Support vs Counter Balance Bars',
        description: 'Large percentage bars showing aggregate dialectical balance. Green "Support 39%" vs Red "Counter 61%". Provides instant assessment of whether support or attacks dominate the deliberation.'
      },
      {
        id: 'semantic-filter-buttons',
        x: 40,
        y: 22,
        label: '4',
        title: 'Grounded Semantics Filter Buttons',
        description: 'Four filter buttons: "All (40)", "IN (25)", "OUT (15)", "UNDEC (0)". Click to show only claims with specific grounded semantics labels. Counts update dynamically as graph structure changes.'
      },
      {
        id: 'insight-badges',
        x: 15,
        y: 25,
        label: '5',
        title: 'Controversy & Hub Insight Badges',
        description: 'Yellow badge "⚠ 3 controversial" and purple badge "3 hubs". Automatically computed patterns directing attention to contested claims and architectural keystones. Click to filter graph to these subsets.'
      },
      {
        id: 'graph-canvas',
        x: 50,
        y: 45,
        label: '6',
        title: 'Interactive Graph Canvas',
        description: 'Main visualization area showing nodes as colored circles connected by styled edges. Current view: hierarchical layout with three strata—IN claims (green) top row, UNDEC (gray) middle (none in this example), OUT claims (red) bottom row. Supports panning and node dragging.'
      },
      {
        id: 'node-colors',
        x: 35,
        y: 35,
        label: '7',
        title: 'Grounded Semantics Node Colors',
        description: 'Green circles = IN (warranted/accepted), Red circles = OUT (defeated/rejected), Gray circles = UNDEC (undecided). Size varies by centrality—larger nodes are hubs with high connection counts. Controversial nodes have orange rings.'
      },
      {
        id: 'edge-styles',
        x: 40,
        y: 40,
        label: '8',
        title: 'Edge Type Styling',
        description: 'Solid green lines = Support relationships, Solid red lines = Rebut (direct attack), Dashed orange lines = Undercut (attack inference), Dotted red lines = Undermines (attack premises). Line thickness and opacity vary based on confidence and hover state.'
      },
      {
        id: 'selected-node-tooltip',
        x: 25,
        y: 48,
        label: '9',
        title: 'Selected Node Tooltip',
        description: 'Dark overlay tooltip appearing on node click. Shows: status badges (OUT/CONTROVERSIAL/HUB), truncated claim text, support/attack strength metrics ("Support: 4.2", "Attack: 4.2"), and degree counts ("In: 12", "Out: 0"). Provides quantitative context for visual patterns.'
      },
      {
        id: 'layout-indicator',
        x: 55,
        y: 62,
        label: '10',
        title: 'Layout Mode Indicator',
        description: 'Bottom-right text "Layout: Hierarchical" shows current layout algorithm. Click layout selector icon (top-right of graph) to cycle through: force-directed (natural clustering), hierarchical (status stratification), radial (controversy-focused), clustered (sub-debate isolation).'
      },
      {
        id: 'legend',
        x: 30,
        y: 70,
        label: '11',
        title: 'Visual Encoding Legend',
        description: 'Bottom legend explains graph symbols: edge types (Support/Rebut/Undercut lines), node colors (IN/OUT/UNDEC/Controversial/Hub circles), and metrics (controversy = balanced attacks/supports). Essential reference for interpretation.'
      },
      {
        id: 'selected-claim-panel',
        x: 25,
        y: 85,
        label: '12',
        title: 'Selected Claim Details Panel',
        description: 'Below-graph panel showing "SELECTED CLAIM" header, full claim text ("We should prioritize retrofitting existing buildings..."), and claim ID ("ID: ceey82ijax00..."). Updates when node clicked. Provides complete context without cluttering graph.'
      },
      {
        id: 'controversy-detection',
        x: 15,
        y: 74,
        label: '13',
        title: 'Controversy Metric Explanation',
        description: 'Legend note "⚠ 3 controversial claims (balanced attacks/supports)" explains the algorithm: claims with roughly equal support and attack strength (<40% imbalance) are flagged as contested. Directs participants to productive debate opportunities.'
      }
    ]
  },

  schema: {
    model: 'Claim',
    fields: [
      { 
        name: 'id', 
        type: 'String', 
        description: 'Unique identifier (cuid)' 
      },
      { 
        name: 'text', 
        type: 'String', 
        description: 'Claim statement (copied from proposition text on promotion)' 
      },
      { 
        name: 'moid', 
        type: 'String', 
        description: 'Unique MOID (Mesh Object ID) for cross-reference',
      },
      {
        name: 'deliberationId',
        type: 'String',
        description: 'Foreign key to parent Deliberation',
        optional: true
      },
      {
        name: 'createdById',
        type: 'String',
        description: 'User who promoted the proposition to claim'
      },
      {
        name: 'createdAt',
        type: 'DateTime',
        description: 'Timestamp of claim creation',
        defaultValue: 'now()'
      },
      {
        name: 'claimType',
        type: 'String',
        description: 'AIF node type (e.g., "Assertion", "Agent", "Domain")',
        optional: true
      },
      {
        name: 'canonicalClaimId',
        type: 'String',
        description: 'Link to canonical claim for deduplication',
        optional: true
      },
      {
        name: 'negatesClaimId',
        type: 'String',
        description: 'Reference to claim this negates (for dialectical structure)',
        optional: true
      }
    ],
    relations: [
      {
        name: 'deliberation',
        target: 'Deliberation',
        cardinality: '1:1',
        description: 'Parent deliberation context (optional)'
      },
      {
        name: 'sourceProposition',
        target: 'Proposition',
        cardinality: '1:1',
        description: 'Back-reference to the proposition that was promoted (optional, one-to-one)'
      },
      {
        name: 'edgesFrom',
        target: 'ClaimEdge',
        cardinality: '1:N',
        description: 'Outgoing edges (this claim attacking/supporting others)'
      },
      {
        name: 'edgesTo',
        target: 'ClaimEdge',
        cardinality: '1:N',
        description: 'Incoming edges (other claims attacking/supporting this one)'
      },
      {
        name: 'arguments',
        target: 'Argument',
        cardinality: '1:N',
        description: 'Formal arguments referencing this claim (as premise or conclusion)'
      },
      {
        name: 'ClaimLabel',
        target: 'ClaimLabel',
        cardinality: '1:1',
        description: 'Grounded semantics label (IN/OUT/UNDEC) computed from argument graph (optional)'
      },
      {
        name: 'ClaimEvidence',
        target: 'ClaimEvidence',
        cardinality: '1:N',
        description: 'Supporting evidence links and citations'
      },
      {
        name: 'warrant',
        target: 'ClaimWarrant',
        cardinality: '1:1',
        description: 'Warrant (backing/reasoning) for the claim (optional)'
      }
    ]
  },

  transition: `With Claims now visible in the Graph Explorer and navigable through multiple layout perspectives, the next phase is constructing formal Arguments—structured reasoning that supports or attacks claims using argumentation schemes. The graph automatically updates to reflect new argument structures, providing real-time feedback on dialectical health...`
}
/* ======================== REMAINING STEPS (RENUMBERED) ======================== */

const STEP_5: OnboardingStep = {
  id: 'compose-argument',
  number: 5,
  title: 'Compose Argument (Scheme Composer)',
  shortTitle: 'Argument',
  icon: GitBranch,
  summary: 'Build formal arguments using argumentation schemes.',
  content: {
    what: '[To be detailed]',
    why: '[To be detailed]',
    userAction: '[To be detailed]'
  },
  screenshot: { src: '', alt: '', annotations: [] },
  schema: { model: 'Argument', fields: [] }
}

const STEP_6: OnboardingStep = {
  id: 'view-arguments',
  number: 6,
  title: 'View Arguments (AIF Arguments List)',
  shortTitle: 'Arguments',
  icon: List,
  summary: 'Browse the structured argument graph.',
  content: {
    what: '[To be detailed]',
    why: '[To be detailed]',
    userAction: '[To be detailed]'
  },
  screenshot: { src: '', alt: '', annotations: [] },
  schema: { model: 'ArgumentNode', fields: [] }
}

const STEP_7: OnboardingStep = {
  id: 'dialogue-move',
  number: 7,
  title: 'Dialogue Move (Attack Menu: Rebut / Undercut)',
  shortTitle: 'Attack',
  icon: Swords,
  summary: 'Challenge arguments through formal dialogue moves.',
  content: {
    what: '[To be detailed]',
    why: '[To be detailed]',
    userAction: '[To be detailed]'
  },
  screenshot: { src: '', alt: '', annotations: [] },
  schema: { model: 'DialogueMove', fields: [] }
}

const STEP_8: OnboardingStep = {
  id: 'debate-sheet',
  number: 8,
  title: 'Navigate Debate Sheet',
  shortTitle: 'Debate',
  icon: Layout,
  summary: 'Track obligations and commitments in structured dialogue.',
  content: {
    what: '[To be detailed]',
    why: '[To be detailed]',
    userAction: '[To be detailed]'
  },
  screenshot: { src: '', alt: '', annotations: [] },
  schema: { model: 'DebateSheet', fields: [] }
}

const STEP_9: OnboardingStep = {
  id: 'publish-kb',
  number: 9,
  title: 'Publish to Knowledge Base',
  shortTitle: 'Publish',
  icon: BookOpen,
  summary: 'Transform concluded deliberations into persistent knowledge artifacts.',
  content: {
    what: '[To be detailed]',
    why: '[To be detailed]',
    userAction: '[To be detailed]'
  },
  screenshot: { src: '', alt: '', annotations: [] },
  schema: { model: 'KBPage', fields: [] }
}

const STEP_10: OnboardingStep = {
  id: 'explore-network',
  number: 10,
  title: 'Explore Network (Plexus / Cross-Room Graph)',
  shortTitle: 'Network',
  icon: Share2,
  summary: 'Discover connections across deliberations and knowledge domains.',
  content: {
    what: '[To be detailed]',
    why: '[To be detailed]',
    userAction: '[To be detailed]'
  },
  screenshot: { src: '', alt: '', annotations: [] },
  schema: { model: 'KnowledgeGraph', fields: [] }
}

/* ======================== EXPORT ALL STEPS ======================== */

export const ONBOARDING_STEPS: OnboardingStep[] = [
  STEP_1,
  STEP_1_5,  // Chat/Forum tab switching
  STEP_2,
  STEP_3,
  STEP_4,    // Combined: Promote & Explore Claims (previously steps 4 and 5)
  STEP_5,
  STEP_6,
  STEP_7,
  STEP_8,
  STEP_9,
  STEP_10
]

/* ======================== UTILITY EXPORTS ======================== */

export const getStepById = (id: string): OnboardingStep | undefined => {
  return ONBOARDING_STEPS.find(step => step.id === id)
}

export const getStepByNumber = (number: number): OnboardingStep | undefined => {
  return ONBOARDING_STEPS.find(step => step.number === number)
}

export const getTotalSteps = (): number => {
  return ONBOARDING_STEPS.length
}

export const getStepProgress = (currentStepNumber: number): number => {
  return Math.round((currentStepNumber / getTotalSteps()) * 100)
}