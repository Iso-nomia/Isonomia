// app/onboarding/demos/ceg-explorer-real/ceg-explorer-real-data-client.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Network, 
  GitBranch, 
  Shield,
  X,
  Info,
  TrendingUp,
  AlertCircle,
  Database,
  Target,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import type { CegNode, CegEdge } from '@/components/graph/useCegData'
// import CegMiniMap from '@/components/graph/CegMiniMap'
import CegMiniMap from '@/components/deepdive/CegMiniMap'

/**
 * CEG Explorer Client Component - Real Data Version
 * 
 * This component receives real data from the server and provides
 * the same interactive experience as the demo, but with live data.
 * 
 * Key differences from demo version:
 * 1. Receives initialNodes/initialEdges from server
 * 2. Can refetch data on demand
 * 3. Shows loading/error states
 * 4. Displays real metadata (title, description)
 */

interface Props {
  deliberationId: string
  initialNodes: CegNode[]
  initialEdges: CegEdge[]
  metadata: {
    title: string
    description: string | null
    claimCount: number
    edgeCount: number
  }
}

export default function CegExplorerRealDataClient({
  deliberationId,
  initialNodes,
  initialEdges,
  metadata,
}: Props) {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [nodes] = useState<CegNode[]>(initialNodes)
  const [edges] = useState<CegEdge[]>(initialEdges)
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [cegViewMode, setCegViewMode] = useState<'graph' | 'clusters' | 'controversy' | 'flow'>('graph')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================
  const stats = useMemo(() => {
    const inCount = nodes.filter(n => n.label === 'IN').length
    const outCount = nodes.filter(n => n.label === 'OUT').length
    const undecCount = nodes.filter(n => n.label === 'UNDEC').length
    const controversialCount = nodes.filter(n => n.isControversial).length
    const avgConfidence = nodes.length > 0 
      ? nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length 
      : 0

    return {
      totalClaims: nodes.length,
      totalEdges: edges.length,
      inCount,
      outCount,
      undecCount,
      controversialCount,
      avgConfidence,
    }
  }, [nodes, edges])

  const selectedClaim = useMemo(() => {
    return nodes.find(n => n.id === selectedClaimId)
  }, [selectedClaimId, nodes])

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleClaimSelect = useCallback((claimId: string) => {
    setSelectedClaimId(claimId)
  }, [])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    // In a real implementation, you'd call an API route here
    // For now, just simulate a refresh
    await new Promise(resolve => setTimeout(resolve, 1000))
    window.location.reload()
  }, [])

  // =========================================================================
  // EMPTY STATE
  // =========================================================================
  if (nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-4">
            {/* <Network className="h-8 w-8 text-white" /> */}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            No Claims Yet
          </h2>
          <p className="text-slate-600 mb-4">
            This deliberation doesn't have any claims yet. Claims will appear here once 
            participants start contributing to the discussion.
          </p>
          <div className="text-sm text-slate-500">
            Deliberation ID: <code className="bg-slate-100 px-2 py-1 rounded">{deliberationId}</code>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================================
  // MAIN RENDER
  // =========================================================================
  return (
    <div className="min-h-screen  p-2 ">
      <div className="max-w-7xl mx-auto rounded-xl">
        {/* Page header */}
        <div className="mb-3">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Network className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {metadata.title}
                </h1>
                {metadata.description && (
                  <p className="text-slate-600 mt-1">
                    {metadata.description}
                  </p>
                )}
              </div>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-4 text-sm text-slate-600 bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm">
            <span className="flex items-center gap-1">
              <Database className="h-4 w-4" />
              <strong className="font-semibold text-slate-900">{stats.totalClaims}</strong> claims
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              <strong className="font-semibold text-slate-900">{stats.totalEdges}</strong> edges
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-green-600" />
              <strong className="font-semibold text-green-700">{stats.inCount}</strong> accepted
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <X className="h-4 w-4 text-red-600" />
              <strong className="font-semibold text-red-700">{stats.outCount}</strong> rejected
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <strong className="font-semibold text-orange-700">{stats.controversialCount}</strong> controversial
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="surfacev2 rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Controls */}
          <div className=" p-2 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Claim Evaluation Graph
              </h2>
              
              {/* View mode selector */}
              <div className="flex items-center gap-2">
                {['graph', 'clusters', 'controversy', 'flow'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCegViewMode(mode as any)}
                    className={`
                      px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                      ${cegViewMode === mode 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                      }
                    `}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Graph */}
          <div className="p-6">
            <CegMiniMap
              deliberationId={deliberationId}
              selectedClaimId={selectedClaimId}
              onSelectClaim={handleClaimSelect}
              width={800}
              height={500}
              viewMode={cegViewMode}
            />
          </div>

          {/* Selected claim details */}
          {selectedClaim && (
            <div className="border-t border-slate-200 bg-slate-50 p-6">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                    Selected Claim
                  </h3>
                  <button
                    onClick={() => setSelectedClaimId(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  {/* Claim text */}
                  <div className="mb-4">
                    <p className="text-base text-slate-800 leading-relaxed">
                      {selectedClaim.text}
                    </p>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-slate-600">Status:</span>
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-semibold
                      ${selectedClaim.label === 'IN' && 'bg-green-100 text-green-700'}
                      ${selectedClaim.label === 'OUT' && 'bg-red-100 text-red-700'}
                      ${selectedClaim.label === 'UNDEC' && 'bg-slate-100 text-slate-700'}
                    `}>
                      {selectedClaim.label}
                    </span>
                    {selectedClaim.isControversial && (
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700">
                        CONTROVERSIAL
                      </span>
                    )}
                    {selectedClaim.centrality >= 0.6 && (
                      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        HUB
                      </span>
                    )}
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Confidence</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${selectedClaim.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {(selectedClaim.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Support</div>
                      <div className="text-lg font-bold text-green-600">
                        {selectedClaim.supportStrength.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Attack</div>
                      <div className="text-lg font-bold text-red-600">
                        {selectedClaim.attackStrength.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Centrality</div>
                      <div className="text-lg font-bold text-purple-600">
                        {(selectedClaim.centrality * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Connection info */}
                  <div className="flex items-center gap-6 text-sm text-slate-600 pt-4 border-t border-slate-200">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {selectedClaim.approvals} approvals
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-4 w-4" />
                      {selectedClaim.inDegree} incoming
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-4 w-4 rotate-180" />
                      {selectedClaim.outDegree} outgoing
                    </span>
                  </div>

                  {/* ID (for debugging) */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="text-xs text-slate-400">
                      Claim ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{selectedClaim.id}</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info footer */}
        <div className="mt-8 p-6 bg-white/40 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                About This Graph
              </h3>
              <p className="text-sm text-slate-600">
                This Claim Evaluation Graph (CEG) shows the dialectical structure of the debate using 
                Dung's grounded semantics. Claims are labeled <strong>IN</strong> (accepted), <strong>OUT</strong> (rejected), 
                or <strong>UNDEC</strong> (undecided) based on their support and attack relationships. 
                Controversial claims (roughly balanced support/attack) represent key points of disagreement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}