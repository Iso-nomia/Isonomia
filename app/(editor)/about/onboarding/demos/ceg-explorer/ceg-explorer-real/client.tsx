// app/(editor)/about/onboarding/demos/ceg-explorer/ceg-explorer-real/client.tsx
"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Network,
  GitBranch,
  Shield,
  X,
  Info,
  AlertCircle,
  TrendingUp,
  Target,
  FerrisWheel,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import CegMiniMap from "@/components/deepdive/CegMiniMap";
import type { CegNode, CegEdge } from "@/components/graph/useCegData";

interface CegExplorerRealClientProps {
  deliberationId: string;
  initialData: {
    nodes: CegNode[];
    edges: CegEdge[];
    metadata: {
      title: string;
      description: string | null;
      claimCount: number;
      edgeCount: number;
    };
  };
}

export default function CegExplorerRealClient({
  deliberationId,
  initialData,
}: CegExplorerRealClientProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "clusters" | "controversy" | "flow">("graph");
  const [showStats, setShowStats] = useState(true);

  // Compute statistics from the data
  const stats = useMemo(() => {
    const inCount = initialData.nodes.filter((n) => n.label === "IN").length;
    const outCount = initialData.nodes.filter((n) => n.label === "OUT").length;
    const undecCount = initialData.nodes.filter((n) => n.label === "UNDEC").length;
    const controversialCount = initialData.nodes.filter((n) => n.isControversial).length;
    const avgConfidence =
      initialData.nodes.reduce((sum, n) => sum + n.confidence, 0) / initialData.nodes.length || 0;

    return {
      totalClaims: initialData.nodes.length,
      totalEdges: initialData.edges.length,
      inCount,
      outCount,
      undecCount,
      controversialCount,
      avgConfidence,
    };
  }, [initialData.nodes, initialData.edges.length]);

  const selectedClaim = useMemo(() => {
    return initialData.nodes.find((n) => n.id === selectedClaimId);
  }, [selectedClaimId, initialData.nodes]);

  const handleClaimSelect = (claimId: string) => {
    setSelectedClaimId(claimId);
  };

  return (
    <div className="min-h-screen  p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/about/onboarding/demos/ceg-explorer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors rounded-lg hover:bg-white/50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to demos
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {initialData.metadata.title}
              </h1>
              {initialData.metadata.description && (
                <p className="text-slate-600">{initialData.metadata.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Panel */}
        {showStats && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white rounded-xl shadow-lg border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Graph Statistics</h2>
              <button
                onClick={() => setShowStats(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Accepted</span>
                </div>
                <div className="text-2xl font-bold text-green-800">{stats.inCount}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center gap-2 mb-1">
                  <X className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-700 font-medium">Rejected</span>
                </div>
                <div className="text-2xl font-bold text-red-800">{stats.outCount}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-slate-600" />
                  <span className="text-sm text-slate-700 font-medium">Undecided</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{stats.undecCount}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm text-orange-700 font-medium">Controversial</span>
                </div>
                <div className="text-2xl font-bold text-orange-800">{stats.controversialCount}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Graph Container */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Controls */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 border-b border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-purple-600" />
                <h2 className="text-lg font-bold text-slate-900">Claim Evaluation Graph</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>{stats.totalClaims} claims</span>
                <span>•</span>
                <span>{stats.totalEdges} edges</span>
              </div>
            </div>

            {/* View mode selector */}
            <div className="flex items-center gap-2">
              {["graph", "clusters", "controversy", "flow"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode as any)}
                  className={`
                    px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                    ${
                      viewMode === mode
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }
                  `}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Graph Visualization */}
          <div className="p-6">
            <CegMiniMap
              deliberationId={deliberationId}
              selectedClaimId={selectedClaimId}
              onSelectClaim={handleClaimSelect}
              width={800}
              height={500}
              viewMode={viewMode}
            />
          </div>
        </div>

        {/* Selected Claim Details */}
        {selectedClaim && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-xl shadow-lg border border-slate-200 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                Selected Claim
              </h3>
              <button
                onClick={() => setSelectedClaimId(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Claim Text */}
            <div className="mb-4">
              <p className="text-base text-slate-800 leading-relaxed">{selectedClaim.text}</p>
            </div>

            {/* Status Badges */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-slate-600">Status:</span>
              <span
                className={`
                px-3 py-1 rounded-full text-sm font-semibold
                ${selectedClaim.label === "IN" && "bg-green-100 text-green-700"}
                ${selectedClaim.label === "OUT" && "bg-red-100 text-red-700"}
                ${selectedClaim.label === "UNDEC" && "bg-slate-100 text-slate-700"}
              `}
              >
                {selectedClaim.label}
              </span>
              {selectedClaim.isControversial && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700">
                  CONTROVERSIAL
                </span>
              )}
            </div>

            {/* Metrics Grid */}
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

            {/* Connection Info */}
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
          </motion.div>
        )}

        {/* Educational Footer */}
        <div className="mt-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Info className="h-5 w-5 text-indigo-600" />
            About Claim Evaluation Graphs
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <strong className="text-slate-900">CEG (Claim Evaluation Graph)</strong> implements
              Dung&apos;s abstract argumentation framework with grounded semantics. Each claim is
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
  );
}
