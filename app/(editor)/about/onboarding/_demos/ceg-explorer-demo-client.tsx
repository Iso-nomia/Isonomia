// app/onboarding/_demos/ceg-explorer-demo-client.tsx
'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Network, 
  GitBranch, 
  Shield,
  X,
  Info,
  Eye,
  Code,
  FerrisWheel,
  Target,
  Zap,
  TrendingUp,
  AlertCircle,
  Database,
  ChevronDown,
  ExternalLink
} from 'lucide-react'
import CegMiniMap from '@/components/deepdive/CegMiniMap'
import type { CegNode, CegEdge } from '@/components/graph/useCegData'

/**
 * ARCHITECTURAL DECISIONS:
 * 
 * 1. CLIENT COMPONENT: Handles all interactive UI state (view modes, annotations, modals)
 * 2. MOCK DATA: Self-contained demo data that showcases CEG capabilities
 * 3. TYPE SAFETY: All props match CEG data types from useCegData hook
 * 4. EDUCATIONAL: Annotations explain key concepts (grounded semantics, controversy, centrality)
 */

interface Props {
  // Optional: could accept real data from server component for hybrid approach
  mockDeliberationId?: string
  initialViewMode?: 'graph' | 'clusters' | 'controversy' | 'flow'
}

// =========================================================================
// MOCK DATA - Rich example showing CEG features
// =========================================================================
const MOCK_NODES: CegNode[] = [
  {
    id: 'claim-1',
    text: 'Universal healthcare should be implemented nationwide',
    label: 'IN',
    confidence: 0.85,
    supportStrength: 12.5,
    attackStrength: 4.2,
    inDegree: 3,
    outDegree: 2,
    approvals: 8,
    centrality: 0.82,
    isControversial: false,
    type: 'claim',
    netStrength: 0,
    clusterId: 0,
  },
  {
    id: 'claim-2',
    text: 'Current healthcare costs are unsustainable for most families',
    label: 'IN',
    confidence: 0.92,
    supportStrength: 15.8,
    attackStrength: 2.1,
    inDegree: 1,
    outDegree: 1,
    approvals: 12,
    centrality: 0.65,
    isControversial: false,
    type: 'claim',
    netStrength: 0,
    clusterId: 0,
  },
  {
    id: 'claim-3',
    text: 'Government-run programs lead to inefficiency and waste',
    label: 'OUT',
    confidence: 0.35,
    supportStrength: 5.2,
    attackStrength: 14.6,
    inDegree: 4,
    outDegree: 1,
    approvals: 2,
    centrality: 0.58,
    isControversial: false,
    type: 'claim',
    netStrength: 0,
    clusterId: 1,
  },
  {
    id: 'claim-4',
    text: 'A mixed public-private model balances coverage and efficiency',
    label: 'UNDEC',
    confidence: 0.5,
    supportStrength: 8.5,
    attackStrength: 8.2,
    inDegree: 3,
    outDegree: 3,
    approvals: 6,
    centrality: 0.75,
    isControversial: true,
    type: 'claim',
    netStrength: 0,
    clusterId: 2,
  },
  {
    id: 'claim-5',
    text: 'Healthcare is a fundamental human right',
    label: 'IN',
    confidence: 0.78,
    supportStrength: 11.2,
    attackStrength: 5.5,
    inDegree: 2,
    outDegree: 2,
    approvals: 9,
    centrality: 0.71,
    isControversial: false,
    type: 'claim',
    netStrength: 0,
    clusterId: 0,
  },
  {
    id: 'claim-6',
    text: 'Private insurance provides better quality care',
    label: 'OUT',
    confidence: 0.42,
    supportStrength: 6.8,
    attackStrength: 11.3,
    inDegree: 3,
    outDegree: 1,
    approvals: 3,
    centrality: 0.52,
    isControversial: false,
    type: 'claim',
    netStrength: 0,
    clusterId: 1,
  },
  {
    id: 'claim-7',
    text: 'Preventive care reduces overall healthcare costs',
    label: 'IN',
    confidence: 0.88,
    supportStrength: 13.1,
    attackStrength: 3.4,
    inDegree: 1,
    outDegree: 1,
    approvals: 10,
    centrality: 0.48,
    isControversial: false,
    type: 'claim',
    netStrength: 0,
    clusterId: 0,
  },
  {
    id: 'claim-8',
    text: 'Individual mandate is necessary for system viability',
    label: 'UNDEC',
    confidence: 0.55,
    supportStrength: 7.9,
    attackStrength: 7.6,
    inDegree: 2,
    outDegree: 2,
    approvals: 4,
    centrality: 0.62,
    isControversial: true,
    type: 'claim',
    netStrength: 0,
    clusterId: 2,
  },
]

const MOCK_EDGES: CegEdge[] = [
  { id: 'e1', source: 'claim-2', target: 'claim-1', type: 'supports', confidence: 1 },
  { id: 'e2', source: 'claim-5', target: 'claim-1', type: 'supports', confidence: 1 },
  { id: 'e3', source: 'claim-7', target: 'claim-1', type: 'supports', confidence: 1 },
  { id: 'e4', source: 'claim-3', target: 'claim-1', type: 'rebuts', confidence: 1 },
  { id: 'e5', source: 'claim-6', target: 'claim-2', type: 'rebuts', confidence: 1 },
  { id: 'e6', source: 'claim-4', target: 'claim-3', type: 'undercuts', confidence: 1 },
  { id: 'e7', source: 'claim-8', target: 'claim-4', type: 'supports', confidence: 1 },
  { id: 'e8', source: 'claim-1', target: 'claim-8', type: 'supports', confidence: 1 },
  { id: 'e9', source: 'claim-4', target: 'claim-6', type: 'rebuts', confidence: 1 },
  { id: 'e10', source: 'claim-5', target: 'claim-6', type: 'rebuts', confidence: 1 },
]

// =========================================================================
// ANNOTATION DATA - Educational markers
// =========================================================================
interface Annotation {
  id: string
  label: string
  title: string
  description: string
  x: number // percentage
  y: number // percentage
  claimId?: string
}

const ANNOTATIONS: Annotation[] = [
  {
    id: 'ann-1',
    label: '1',
    title: 'Grounded Semantics',
    description: 'Claims are labeled IN, OUT, or UNDEC based on the attack/support structure. This implements Dung\'s grounded semantics.',
    x: 15,
    y: 20,
    claimId: 'claim-1',
  },
  {
    id: 'ann-2',
    label: '2',
    title: 'Controversial Claims',
    description: 'Claims with roughly equal attack and support strength are marked as controversial - these are dialectical hotspots.',
    x: 50,
    y: 50,
    claimId: 'claim-4',
  },
  {
    id: 'ann-3',
    label: '3',
    title: 'Centrality Metrics',
    description: 'High-centrality claims (hubs) are structurally important in the argument graph. They connect multiple clusters of reasoning.',
    x: 25,
    y: 35,
    claimId: 'claim-1',
  },
  {
    id: 'ann-4',
    label: '4',
    title: 'Edge Types',
    description: 'Support (green), rebut (red), and undercut (orange dashed) edges represent different dialectical relationships.',
    x: 70,
    y: 30,
  },
  {
    id: 'ann-5',
    label: '5',
    title: 'Cluster Analysis',
    description: 'The graph automatically identifies thematic clusters - groups of related claims that form coherent positions.',
    x: 85,
    y: 65,
  },
]

export default function CegExplorerDemoClient({
  mockDeliberationId = 'demo-delib-001',
  initialViewMode = 'graph',
}: Props) {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [viewMode, setViewMode] = useState<'simplified' | 'real'>('real')
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null)
  const [cegViewMode, setCegViewMode] = useState<'graph' | 'clusters' | 'controversy' | 'flow'>(initialViewMode)
  const [showLegend, setShowLegend] = useState(true)
  const [showStats, setShowStats] = useState(true)

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================
  const stats = useMemo(() => {
    const inCount = MOCK_NODES.filter(n => n.label === 'IN').length
    const outCount = MOCK_NODES.filter(n => n.label === 'OUT').length
    const undecCount = MOCK_NODES.filter(n => n.label === 'UNDEC').length
    const controversialCount = MOCK_NODES.filter(n => n.isControversial).length
    const avgConfidence = MOCK_NODES.reduce((sum, n) => sum + n.confidence, 0) / MOCK_NODES.length

    return {
      totalClaims: MOCK_NODES.length,
      totalEdges: MOCK_EDGES.length,
      inCount,
      outCount,
      undecCount,
      controversialCount,
      avgConfidence,
    }
  }, [])

  const selectedClaim = useMemo(() => {
    return MOCK_NODES.find(n => n.id === selectedClaimId)
  }, [selectedClaimId])

  const activeAnnotation = useMemo(() => {
    return ANNOTATIONS.find(a => a.id === activeAnnotationId)
  }, [activeAnnotationId])

  // =========================================================================
  // HANDLERS
  // =========================================================================
  const handleClaimSelect = useCallback((claimId: string) => {
    setSelectedClaimId(claimId)
  }, [])

  const handleAnnotationClick = useCallback((annotationId: string) => {
    const annotation = ANNOTATIONS.find(a => a.id === annotationId)
    setActiveAnnotationId(annotationId)
    if (annotation?.claimId) {
      setSelectedClaimId(annotation.claimId)
    }
  }, [])

  // =========================================================================
  // RENDER: SIMPLIFIED VIEW
  // =========================================================================
  const renderSimplifiedView = () => (
    <motion.div
      key="simplified"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 border-b border-slate-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-slate-600">Claim Evaluation Graph</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Healthcare Policy Debate
            </h2>
            <p className="text-sm text-slate-600">
              Visualizing argument structure with grounded semantics
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-slate-600">Accepted</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{stats.inCount}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <X className="h-4 w-4 text-red-600" />
              <span className="text-slate-600">Rejected</span>
            </div>
            <div className="text-2xl font-bold text-red-700">{stats.outCount}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-slate-600" />
              <span className="text-slate-600">Undecided</span>
            </div>
            <div className="text-2xl font-bold text-slate-700">{stats.undecCount}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <span className="text-slate-600">Controversial</span>
            </div>
            <div className="text-2xl font-bold text-orange-700">{stats.controversialCount}</div>
          </div>
        </div>
      </div>

      {/* Simple claim list */}
      <div className="p-6">
        <div className="space-y-3">
          {MOCK_NODES.slice(0, 5).map((node) => (
            <div
              key={node.id}
              className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer"
              onClick={() => setSelectedClaimId(node.id)}
            >
              <div className="flex items-start gap-3">
                <span className={`
                  px-2 py-1 rounded text-xs font-bold flex-shrink-0
                  ${node.label === 'IN' && 'bg-green-100 text-green-700'}
                  ${node.label === 'OUT' && 'bg-red-100 text-red-700'}
                  ${node.label === 'UNDEC' && 'bg-slate-100 text-slate-700'}
                `}>
                  {node.label}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 mb-2">{node.text}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {node.approvals} approvals
                    </span>
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {node.inDegree + node.outDegree} connections
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {(node.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade prompt */}
        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FerrisWheel className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-indigo-900 mb-1">
                Interactive Graph View Available
              </h3>
              <p className="text-sm text-indigo-700 mb-3">
                Switch to the full interactive graph to explore dialectical relationships, 
                view clusters, and analyze controversy patterns.
              </p>
              <button
                onClick={() => setViewMode('real')}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Open Graph Explorer
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )

  // =========================================================================
  // RENDER: REAL VIEW (Interactive CEG)
  // =========================================================================
  const renderRealView = () => (
    <motion.div
      key="real"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
    >
      {/* Header with controls */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Claim Evaluation Graph (CEG)
            </h2>
          </div>
          <button
            onClick={() => setViewMode('simplified')}
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back to simple view
          </button>
        </div>

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

      {/* Main graph area with annotations */}
      <div className="relative">
        {/* Interactive annotations overlay */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {ANNOTATIONS.map((ann) => (
            <button
              key={ann.id}
              onClick={() => handleAnnotationClick(ann.id)}
              className={`
                absolute flex h-7 w-7 items-center justify-center rounded-full
                border-2 border-purple-700 shadow-lg transition-all hover:scale-110
                font-bold text-xs pointer-events-auto
                ${activeAnnotationId === ann.id 
                  ? 'bg-slate-900 text-white scale-110 ring-4 ring-slate-700/40' 
                  : 'bg-purple-300/50 backdrop-blur-md text-slate-900 hover:bg-purple-400'
                }
              `}
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              aria-label={`Annotation ${ann.label}: ${ann.title}`}
            >
              {ann.label}
            </button>
          ))}
        </div>

        {/* Annotation details panel */}
        <AnimatePresence>
          {activeAnnotation && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="absolute top-4 right-4 w-80 rounded-lg border border-slate-300 bg-white/95 backdrop-blur-lg p-4 shadow-xl z-20"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold flex-shrink-0">
                  {activeAnnotation.label}
                </span>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 mb-1">
                    {activeAnnotation.title}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {activeAnnotation.description}
                  </p>
                </div>
                <button
                  onClick={() => setActiveAnnotationId(null)}
                  className="text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CEG Component */}
        <div className="p-6">
          <CegMiniMap
            deliberationId={mockDeliberationId}
            selectedClaimId={selectedClaimId}
            onSelectClaim={handleClaimSelect}
            width={800}
            height={500}
            viewMode={cegViewMode}
          />
        </div>

        {/* Annotation legend */}
        <div className="px-6 pb-6">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="h-3.5 w-3.5" />
            <span>Click numbered markers to learn about CEG features</span>
          </div>
        </div>
      </div>

      {/* Selected claim details */}
      {selectedClaim && (
        <div className="border-t border-slate-200 bg-slate-50 p-6">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">
              Selected Claim
            </h3>
            
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              {/* Claim text */}
              <div className="mb-4">
                <p className="text-base text-slate-800 leading-relaxed">
                  {selectedClaim.text}
                </p>
              </div>

              {/* Status badge */}
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
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Confidence</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full"
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
                {selectedClaim.centrality >= 0.6 && (
                  <span className="flex items-center gap-1 text-purple-600 font-medium">
                    <FerrisWheel className="h-4 w-4" />
                    Hub node
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )

  // =========================================================================
  // MAIN RENDER
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Claim Evaluation Graph Explorer
              </h1>
              <p className="text-slate-600">
                Interactive visualization of dialectical structure with grounded semantics
              </p>
            </div>
          </div>
        </div>

        {/* View toggle */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'simplified' ? 'real' : 'simplified')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            {viewMode === 'simplified' ? (
              <>
                <Eye className="h-4 w-4" />
                Show Interactive Graph
              </>
            ) : (
              <>
                <Code className="h-4 w-4" />
                Show Simple View
              </>
            )}
          </button>

          <div className="flex-1" />

          {/* Stats summary */}
          <div className="flex items-center gap-4 text-sm text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <span className="flex items-center gap-1">
              <Database className="h-4 w-4" />
              {stats.totalClaims} claims
            </span>
            <span className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              {stats.totalEdges} edges
            </span>
            <span className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              {(stats.avgConfidence * 100).toFixed(0)}% avg confidence
            </span>
          </div>
        </div>

        {/* Main content */}
        <AnimatePresence mode="wait">
          {viewMode === 'simplified' ? renderSimplifiedView() : renderRealView()}
        </AnimatePresence>

        {/* Educational footer */}
        <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Info className="h-5 w-5 text-indigo-600" />
            About Claim Evaluation Graphs
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <strong className="text-slate-900">CEG (Claim Evaluation Graph)</strong> implements 
              Dungs abstract argumentation framework with grounded semantics. Each claim is 
              evaluated based on its dialectical relationships:
            </p>
            <ul className="space-y-2 ml-6 list-disc">
              <li>
                <strong className="text-slate-900">IN claims</strong> are accepted - they have 
                stronger support than attack
              </li>
              <li>
                <strong className="text-slate-900">OUT claims</strong> are rejected - they are 
                successfully attacked
              </li>
              <li>
                <strong className="text-slate-900">UNDEC claims</strong> are undecided - roughly 
                balanced support and attack
              </li>
              <li>
                <strong className="text-slate-900">Controversial claims</strong> show high 
                dialectical tension - important negotiation points
              </li>
            </ul>
            <p>
              The graph structure reveals hidden patterns: hubs are structurally important claims, 
              clusters show thematic groupings, and edge types (support, rebut, undercut) capture 
              different forms of dialectical relationship.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}