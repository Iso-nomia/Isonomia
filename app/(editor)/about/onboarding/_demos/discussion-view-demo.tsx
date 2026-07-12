// app/onboarding/_demos/discussion-view-demo.tsx
'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MessageCircle, 
  ArrowUp, 
  Users, 
  Clock,
  CheckCircle2,
  X,
  Code,
  Eye,
  Sparkles
} from 'lucide-react'
import DiscussionView from '@/components/discussion/DiscussionView'
import DiscussionViewDemoClient from './discussion-view-demo-client'
import type { DiscussionData } from './types'
/**
 * ARCHITECTURAL DECISIONS & RATIONALE
 * ====================================
 * 
 * 1. TYPE SAFETY: All mock data uses proper TypeScript interfaces matching your Prisma schema
 * 2. DATA STRUCTURE: Mock data mirrors the exact shape that DiscussionView expects from the server
 * 3. SEPARATION OF CONCERNS: Mock data generation is separate from UI rendering
 * 4. REUSABILITY: Mock data factory can be used in tests and other demos
 * 5. CLIENT-SIDE ONLY: Demo component is client-side to avoid SSR hydration issues
 * 6. REALISTIC DEMO: Uses actual component with real data structure, not simplified UI
 */

// ============================================================================
// TYPE DEFINITIONS (matching your Prisma schema & component expectations)
// ============================================================================

interface MockUser {
  id: string
  name: string
  username: string
  image: string | null
}

interface MockMessage {
  id: string
  text: string | null
  createdAt: string
  senderId: string
  sender?: {
    name: string
    image: string | null
  }
  // Additional fields that your Message type might have
  conversationId?: string
  facets?: any[]
  defaultFacetId?: string | null
  isRedacted?: boolean
  mentionsMe?: boolean
}

interface MockDiscussion {
  id: string
  title: string
  description: string | null
  createdById: string
  conversationId: string | null
  deliberations: any[] // Will be empty for basic discussions
}

interface MockDeliberation {
  id: string
  title: string
  description: string | null
  createdAt: string
  updatedAt: string
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
}

// ============================================================================
// MOCK DATA FACTORY (centralized, reusable, type-safe)
// ============================================================================

class OnboardingMockDataFactory {
  private static instance: OnboardingMockDataFactory
  
  private mockUsers: MockUser[] = [
    {
      id: 'user-1',
      name: 'Sarah Chen',
      username: 'sarahc',
      image: null
    },
    {
      id: 'user-2',
      name: 'Marcus Rodriguez',
      username: 'mrodriguez',
      image: null
    },
    {
      id: 'user-3',
      name: 'Aisha Patel',
      username: 'apatel',
      image: null
    },
    {
      id: 'user-4',
      name: 'James Kim',
      username: 'jkim',
      image: null
    }
  ]

  private mockMessageTexts: string[] = [
    "I think we should consider ranked-choice voting as it eliminates the spoiler effect and encourages more diverse candidates.",
    "That's an interesting point, but implementation costs could be significant. What's the evidence on voter confusion rates?",
    "Studies from Australia and Ireland show minimal confusion after the first election cycle. Maine has also had positive results.",
    "We'd need to factor in the cost of new voting machines and voter education campaigns. Has anyone done a cost-benefit analysis?",
    "The FairVote organization published a comprehensive report last year comparing different jurisdictions. I can share the link.",
    "Before we dive too deep into specifics, shouldn't we first agree on what problem we're trying to solve?",
    "Good point. Are we addressing voter turnout, representation, or something else?",
    "I'd argue all three are interconnected. Better representation leads to higher trust and turnout."
  ]

  static getInstance(): OnboardingMockDataFactory {
    if (!OnboardingMockDataFactory.instance) {
      OnboardingMockDataFactory.instance = new OnboardingMockDataFactory()
    }
    return OnboardingMockDataFactory.instance
  }

  /**
   * Generate mock messages for a conversation
   * @param count Number of messages to generate
   * @param conversationId The conversation ID these messages belong to
   */
  generateMessages(count: number, conversationId: string): MockMessage[] {
    const now = new Date()
    return Array.from({ length: count }, (_, i) => {
      const user = this.mockUsers[i % this.mockUsers.length]
      const messageTime = new Date(now.getTime() - (count - i) * 15 * 60 * 1000) // 15 min intervals
      
      return {
        id: `msg-${conversationId}-${i + 1}`,
        text: this.mockMessageTexts[i % this.mockMessageTexts.length],
        createdAt: messageTime.toISOString(),
        senderId: user.id,
        conversationId,
        sender: {
          name: user.name,
          image: user.image
        }
      }
    })
  }

  /**
   * Generate a mock discussion object
   */
  generateDiscussion(options: {
    id: string
    title: string
    description?: string
    conversationId: string
    hasDeliberation?: boolean
  }): MockDiscussion {
    return {
      id: options.id,
      title: options.title,
      description: options.description || null,
      createdById: this.mockUsers[0].id,
      conversationId: options.conversationId,
      deliberations: options.hasDeliberation ? [this.generateDeliberation(options.id)] : []
    }
  }

  /**
   * Generate a mock deliberation (for when discussion is upgraded)
   */
  private generateDeliberation(discussionId: string): MockDeliberation {
    const now = new Date()
    return {
      id: `delib-${discussionId}`,
      title: 'Ranked-Choice Voting Analysis',
      description: 'Structured deliberation on voting system reform',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: 'ACTIVE'
    }
  }

  /**
   * Get mock users for display purposes
   */
  getUsers(): MockUser[] {
    return this.mockUsers
  }

  /**
   * Calculate mock statistics
   */
  calculateStats(messages: MockMessage[]): {
    participantCount: number
    messageCount: number
    duration: string
  } {
    const uniqueParticipants = new Set(messages.map(m => m.senderId))
    
    // Calculate duration from first to last message
    if (messages.length === 0) {
      return { participantCount: 0, messageCount: 0, duration: '0m' }
    }

    const first = new Date(messages[0].createdAt)
    const last = new Date(messages[messages.length - 1].createdAt)
    const diffMs = last.getTime() - first.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    return {
      participantCount: uniqueParticipants.size,
      messageCount: messages.length,
      duration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
    }
  }
}

// ============================================================================
// MAIN DEMO COMPONENT
// ============================================================================

export function DiscussionViewDemoLegacy() {
  const factory = OnboardingMockDataFactory.getInstance()
  
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [viewMode, setViewMode] = useState<'simplified' | 'real'>('real')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgraded, setUpgraded] = useState(false)

  // =========================================================================
  // MOCK DATA GENERATION (memoized for performance)
  // =========================================================================
  const conversationId = 'demo-conversation-onboarding'
  const discussionId = 'demo-discussion-onboarding'

  const mockMessages = useMemo(
    () => factory.generateMessages(6, conversationId),
    [conversationId]
  )

  const mockDiscussion = useMemo(
    () => factory.generateDiscussion({
      id: discussionId,
      title: 'Ranked-Choice Voting Discussion',
      description: 'Exploring the feasibility and benefits of implementing ranked-choice voting in local elections',
      conversationId: conversationId,
      hasDeliberation: upgraded
    }),
    [discussionId, conversationId, upgraded]
  )

  const stats = useMemo(
    () => factory.calculateStats(mockMessages),
    [mockMessages]
  )

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================
  const handleUpgrade = () => {
    setIsUpgrading(true)
    
    // Simulate realistic API call delay
    setTimeout(() => {
      setIsUpgrading(false)
      setUpgraded(true)
      
      // Auto-close modal after showing success
      setTimeout(() => setShowUpgradeModal(false), 1500)
    }, 1500)
  }

  // =========================================================================
  // RENDER: SIMPLIFIED VIEW (for pedagogical purposes)
  // =========================================================================
  const renderSimplifiedView = () => (
    <motion.div
      key="simplified"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Thread Header */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users className="h-4 w-4" />
            <span className="font-medium">{stats.participantCount}</span>
            <span className="text-slate-400">participants</span>
          </div>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium">{stats.messageCount}</span>
            <span className="text-slate-400">messages</span>
          </div>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4" />
            <span className="text-slate-400">{stats.duration}</span>
          </div>
        </div>

        {/* Upgrade Button */}
        {!upgraded && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <ArrowUp className="h-4 w-4" />
            Upgrade to Deliberation
          </button>
        )}

        {upgraded && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">Upgraded to Deliberation</span>
          </div>
        )}
      </div>

      {/* Message Thread */}
      <div className="space-y-3 bg-white rounded-lg border border-slate-200 p-4 max-h-96 overflow-y-auto">
        {mockMessages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                {msg.sender?.name.charAt(0) || '?'}
              </div>
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-slate-900 text-sm">
                  {msg.sender?.name}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(msg.createdAt).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {msg.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info Box */}
      <div className="text-sm text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="font-medium text-slate-900 mb-2">
          <Sparkles className="inline h-4 w-4 mr-1 text-blue-600" />
          Simplified Demo View
        </p>
        <p>
          This is a <strong>pedagogical visualization</strong> showing the core concept 
          of discussion upgrades. The "Real Component" tab shows the actual production component.
        </p>
      </div>
    </motion.div>
  )

  // =========================================================================
  // RENDER: REAL COMPONENT VIEW
  // =========================================================================
  const renderRealComponentView = () => (
    <motion.div
      key="real"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Real Component Container */}
      <div className="border-2 border-purple-200 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50">
        {/* Component Header */}
        <div className="p-3 bg-purple-100 border-b border-purple-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-purple-900">
              Live Component
            </span>
            <code className="text-xs bg-white/50 px-2 py-0.5 rounded border border-purple-200">
              DiscussionView.tsx
            </code>
          </div>
          <span className="text-xs text-purple-600">
            Using production code
          </span>
        </div>
        
        {/* Actual DiscussionView Component */}
        <div className="bg-white">
          <DiscussionView
            discussion={mockDiscussion as any}
            conversationId={conversationId}
            initialMessages={mockMessages as any}
          />
        </div>
      </div>

      {/* Real Component Info */}
      <div className="text-sm text-slate-600 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="font-medium text-slate-900 mb-2 flex items-center gap-2">
          <Code className="h-4 w-4 text-purple-600" />
          About this view:
        </p>
        <p className="mb-2">
          This renders the <strong>actual production DiscussionView component</strong> from 
          <code className="text-xs bg-white px-1.5 py-0.5 rounded ml-1 border border-purple-200">
            @/components/discussion/DiscussionView
          </code>
        </p>
        <ul className="space-y-1 text-xs ml-4 list-disc text-slate-600">
          <li>Full component functionality (Chat/Forum tabs, real-time features)</li>
          <li>Working "Upgrade to Deliberation" button</li>
          <li>Type-safe mock data matching Prisma schema</li>
          <li>All interactions functional (tab switching, message composition)</li>
        </ul>
      </div>
    </motion.div>
  )

  // =========================================================================
  // RENDER: UPGRADE MODAL (shared between both views)
  // =========================================================================
  const renderUpgradeModal = () => (
    <AnimatePresence>
      {showUpgradeModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => !isUpgrading && !upgraded && setShowUpgradeModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            {!upgraded ? (
              <>
                {/* Modal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      Upgrade to Deliberation
                    </h3>
                    <p className="text-sm text-slate-600">
                      Transform this conversation into a structured deliberation space
                    </p>
                  </div>
                  {!isUpgrading && (
                    <button
                      onClick={() => setShowUpgradeModal(false)}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>

                {/* Upgrade Info */}
                <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Thread title:</span>
                      <span className="font-medium text-slate-900">
                        {mockDiscussion.title}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Participants:</span>
                      <span className="font-medium text-slate-900">
                        {stats.participantCount} members
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Messages:</span>
                      <span className="font-medium text-slate-900">
                        {stats.messageCount} messages
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Duration:</span>
                      <span className="font-medium text-slate-900">
                        {stats.duration}
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">What happens next:</span>
                      <br />
                      All messages will migrate to the new Deliberation. 
                      Participants gain access to structured argumentation tools: 
                      propositions, claims, and formal arguments.
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">⚠️ Note:</span>
                      <br />
                      The original thread will become read-only with a forwarding link.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    disabled={isUpgrading}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUpgrading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Upgrading...
                      </>
                    ) : (
                      <>
                        <ArrowUp className="h-4 w-4" />
                        Confirm Upgrade
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Success State */
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 mb-4"
                >
                  <CheckCircle2 className="h-8 w-8" />
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Deliberation Created!
                </h3>
                <p className="text-sm text-slate-600">
                  All participants have been notified and can now access 
                  structured argumentation tools.
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // =========================================================================
  // MAIN RENDER
  // =========================================================================
  return (
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Demo View:</span>
          <div className="flex gap-1 p-1 bg-white rounded-md border border-slate-200">
            <button
              onClick={() => setViewMode('simplified')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${viewMode === 'simplified' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-50'
                }
              `}
            >
              <Eye className="h-3.5 w-3.5" />
              Simplified
            </button>
            <button
              onClick={() => setViewMode('real')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${viewMode === 'real' 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-600 hover:bg-slate-50'
                }
              `}
            >
              <Code className="h-3.5 w-3.5" />
              Real Component
            </button>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {viewMode === 'simplified' 
            ? 'Focused demo showing upgrade flow' 
            : 'Full production DiscussionView component'
          }
        </div>
      </div>

      {/* Content Views */}
      <AnimatePresence mode="wait">
        {viewMode === 'simplified' ? renderSimplifiedView() : renderRealComponentView()}
      </AnimatePresence>

      {/* Upgrade Modal */}
      {renderUpgradeModal()}
    </div>
  )
}



export  function DiscussionViewDemo({ defaultTab = "forum" }: { defaultTab?: "chat" | "forum" }) {
  const [data, setData] = useState<DiscussionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/onboarding/discussion')
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('NO_DATA')
          }
          throw new Error('Failed to fetch')
        }
        return res.json()
      })
      .then(setData)
      .catch((err) => {
        setError(err.message === 'NO_DATA' ? 'NO_DATA' : 'ERROR')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 bg-slate-50 border border-slate-200 rounded-lg animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-slate-200 rounded w-2/3"></div>
      </div>
    )
  }

  if (error === 'NO_DATA') {
    return (
      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">
          ⚠️ No Seeded Data Found
        </h3>
        <p className="text-sm text-yellow-800 mb-4">
          Please run the seeding script to populate demo data:
        </p>
        <code className="block bg-yellow-100 px-4 py-2 rounded text-sm font-mono">
          npm run seed:discussion
        </code>
        <p className="text-xs text-yellow-700 mt-3">
          After seeding, refresh this page to see the demo.
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold text-red-900 mb-2">
          ❌ Error Loading Demo
        </h3>
        <p className="text-sm text-red-800">
          Failed to load discussion data. Please try refreshing the page.
        </p>
      </div>
    )
  }

  return <DiscussionViewDemoClient {...data} defaultTab={defaultTab} />
}

export default DiscussionViewDemo