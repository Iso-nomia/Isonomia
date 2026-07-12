// app/onboarding/_demos/discussion-view-demo-client.tsx
'use client'

import { useState, useMemo } from 'react'
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
  FerrisWheel
} from 'lucide-react'
import DiscussionView from '@/components/discussion/DiscussionViewGlass'
import type { DiscussionData } from './types'
import { AuthContext } from '@/lib/AuthContext'
import { PrivateChatProvider } from '@/contexts/PrivateChatManager'

/**
 * ARCHITECTURAL DECISIONS:
 * 
 * 1. CLIENT COMPONENT: Handles all interactive UI state (view modes, modals, upgrade flow)
 * 2. PROPS-BASED: Receives real data from server component parent
 * 3. TYPE SAFETY: All props match Prisma schema types
 * 4. REUSABLE: Can work with either real DB data or mock data for testing
 */

interface Message {
  id: string
  text: string | null
  createdAt: string
  senderId: string
  conversationId: string
  sender?: {
    name: string
    image: string | null
  }
    isCurrentUser?: boolean // ← Add this

  facets?: any[]
  defaultFacetId?: string | null
  isRedacted?: boolean
  mentionsMe?: boolean
}

interface Discussion {
  id: string
  title: string
  description: string | null
  createdById: string
  conversationId: string | null
  deliberations: any[]
}

interface Participant {
  id: string
  name: string
  username: string
  image: string | null
}

interface Props {
  discussion: Discussion
  messages: Message[]
  forumComments: any[] // 👈 NEW: Add forum comments
  participants: Participant[]
  conversationId: string
  currentUserId: string
  defaultTab?: "chat" | "forum" // 👈 NEW: Optional starting tab
}

export default function DiscussionViewDemoClient({
  discussion,
  messages,
  forumComments, // 👈 NEW: Receive forum comments
  participants,
  conversationId,
  currentUserId,
  defaultTab = "forum" // 👈 NEW: Default to forum
}: Props) {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [viewMode, setViewMode] = useState<'simplified' | 'real'>('real')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgraded, setUpgraded] = useState(discussion.deliberations.length > 0)

  // =========================================================================
  // COMPUTED VALUES (memoized for performance)
  // =========================================================================
  const stats = useMemo(() => {
    const uniqueParticipants = new Set(messages.map(m => m.senderId))
    
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
  }, [messages])

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleUpgrade = async () => {
    setIsUpgrading(true)
    
    try {
      // Call your actual upgrade API endpoint
      const response = await fetch(`/api/discussions/${discussion.id}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussionId: discussion.id,
          conversationId: conversationId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to upgrade discussion')
      }

      // Simulate upgrade process (remove if you have real API)
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setUpgraded(true)
      
      // Close modal after showing success
      setTimeout(() => {
        setShowUpgradeModal(false)
        setIsUpgrading(false)
      }, 2000)
    } catch (error) {
      console.error('Upgrade failed:', error)
      setIsUpgrading(false)
      // You might want to show an error toast here
    }
  }

  // =========================================================================
  // RENDER: SIMPLIFIED VIEW
  // =========================================================================
  const renderSimplifiedView = () => (
    <motion.div
      key="simplified"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-transparent rounded-xl shadow-lg border border-slate-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 border-b border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-5 w-5 text-indigo-600" />
              <span className="text-sm font-medium text-slate-600">Discussion Thread</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {discussion.title}
            </h2>
            {discussion.description && (
              <p className="text-sm text-slate-600">
                {discussion.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <span className="text-slate-700">
              <span className="font-semibold">{stats.participantCount}</span> participants
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-slate-500" />
            <span className="text-slate-700">
              <span className="font-semibold">{stats.messageCount}</span> messages
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-slate-700">
              <span className="font-semibold">{stats.duration}</span> duration
            </span>
          </div>
        </div>
      </div>

         {/* Messages with Left/Right Alignment */}
      <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
        {messages.slice(0, 5).map((msg) => {
          const isMe = msg.senderId === currentUserId || msg.isCurrentUser
          
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                isMe 
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-500' 
                  : 'bg-gradient-to-br from-slate-400 to-slate-500'
              }`}>
                {msg.sender?.name?.[0] || '?'}
              </div>

              {/* Message Bubble */}
              <div className={`flex-1 min-w-0 max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-sm font-medium text-slate-900">
                    {isMe ? 'You' : msg.sender?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                
                <div className={`rounded-lg px-4 py-2 ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-slate-100 text-slate-900 rounded-tl-sm'
                }`}>
                  <p className="text-sm leading-relaxed">
                    {msg.text}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        
        {messages.length > 5 && (
          <p className="text-xs text-center text-slate-500 italic pt-2">
            ... and {messages.length - 5} more messages
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-slate-50 border-t border-slate-200">
        <button
          onClick={() => setShowUpgradeModal(true)}
          disabled={upgraded}
          className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 group"
        >
          {upgraded ? (
            <>
              <CheckCircle2 className="h-5 w-5" />
              Already Upgraded to Deliberation
            </>
          ) : (
            <>
              <ArrowUp className="h-5 w-5 group-hover:translate-y-[-2px] transition-transform" />
              Upgrade to Deliberation
              <FerrisWheel className="h-4 w-4 group-hover:rotate-12 transition-transform" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  )

  // =========================================================================
  // MOCK AUTH USER FOR DEMO
  // =========================================================================
  const mockAuthUser = useMemo(() => ({
    user: {
      uid: participants[0]?.id || "demo-user-1",
      email: "demo@mesh.com",
      displayName: participants[0]?.name || "Demo User",
      photoURL: participants[0]?.image || null,
      emailVerified: true,
      customClaims: {},
      // 👉 CRITICAL: Use the actual participant ID as BigInt userId so it matches message senderId
      userId: participants[0]?.id ? BigInt(participants[0].id) : BigInt(1),
      onboarded: true,
      username: participants[0]?.username || "demo",
      bio: null,
      phoneNumber: null,
      providerId: "demo",
      isAnonymous: false,
      metadata: {} as any,
      providerData: [],
      refreshToken: "",
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => "",
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({})
    }
  }), [participants])

  // =========================================================================
  // RENDER: REAL COMPONENT VIEW
  // =========================================================================
  const renderRealComponentView = () => (
    <motion.div
      key="real"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-4 "
    >
        <div className='w-max-screen space-y-4 '>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-sky-200 rounded-lg p-4">
        <p className="text-sm text-slate-700 mb-2">
          <span className="font-semibold text-slate-900">
            Live Component
          </span>
        </p>
        <p className="text-xs text-slate-600 mb-2">
          This is the actual production
          <code className="text-xs bg-white px-1.5 py-0.5 rounded ml-1 border border-purple-200">
            @/components/discussion/DiscussionView
          </code>
        </p>
        <ul className="space-y-1 text-xs ml-4 list-disc text-slate-600">
          <li>Data fetched from your PostgreSQL/Supabase database</li>
          <li>All interactions are functional (tabs, composition, etc.)</li>
          <li>Working "Upgrade to Deliberation" button</li>
          <li>Real-time message display with proper user attribution</li>
          <li>Demo mode: mocked authentication for seamless viewing</li>
        </ul>
      </div>
      {/* Actual DiscussionView Component wrapped with mock auth and required providers */}
      <AuthContext.Provider value={mockAuthUser}>
        <PrivateChatProvider meId={participants[0]?.id || "demo-user-1"}>
          <DiscussionView
            discussion={discussion}
            conversationId={conversationId}
            initialMessages={messages}
            initialForumComments={forumComments}
            defaultTab={defaultTab}
          />
        </PrivateChatProvider>
      </AuthContext.Provider>
      </div>
    </motion.div>

  )

  // =========================================================================
  // RENDER: UPGRADE MODAL
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
            className="bg-transparent rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            {!upgraded ? (
              <>
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

                <div className="space-y-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Thread title:</span>
                      <span className="font-medium text-slate-900">
                        {discussion.title}
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
                  </div>

                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">What happens next:</span>
                      <br />
                      All messages will migrate to the new Deliberation. 
                      Participants gain access to structured argumentation tools.
                    </p>
                  </div>
                </div>

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
                  All participants can now access structured argumentation tools.
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
            : 'Full component with seeded data'
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