//components/map/AifDiagramViewInteractive.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { AifSubgraph, AifNode, AifEdge, AifNodeKind, AifEdgeRole } from '@/lib/arguments/diagram';

// Import base component utilities from Phase 1
import { 
  getNodeDimensions, 
  getEdgeStyle, 
  AifNodeSvg, 
  getNodeColor 
} from './AifDiagramView';

// ---------------- Enhanced Types  ----------------
type ExpansionState = {
  expandedNodes: Set<string>;
  isExpanding: boolean;
  expandingNodeId: string | null;
};

type NeighborhoodSummary = {
  supportCount: number;
  conflictCount: number;
  preferenceCount: number;
  totalConnections: number;
};

// ---------------- Main Component ----------------
export default function AifDiagramViewInteractive({
  initialAif,
  rootArgumentId,
  className,
  showMinimap = false,
  enableExpansion = true,
  maxDepth = 3,
  onNodeClick,
}: {
  initialAif: AifSubgraph;
  rootArgumentId: string;
  className?: string;
  showMinimap?: boolean;
  enableExpansion?: boolean;
  maxDepth?: number;
  onNodeClick?: (node: AifNode) => void;
}) {
  // Graph state
  const [aif, setAif] = useState<AifSubgraph>(initialAif);
  const [layout, setLayout] = useState<any>(null);
  
  // Expansion state
  const [expansionState, setExpansionState] = useState<ExpansionState>({
    expandedNodes: new Set([rootArgumentId]),
    isExpanding: false,
    expandingNodeId: null,
  });

  // Node summaries (how many connections each node has)
  const [nodeSummaries, setNodeSummaries] = useState<Map<string, NeighborhoodSummary>>(new Map());

  // View controls
  const [currentDepth, setCurrentDepth] = useState(1);
  const [filters, setFilters] = useState({
    includeSupporting: true,
    includeOpposing: true,
    includePreferences: true,
  });

  // UI state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 1000 });

  const svgRef = useRef<SVGSVGElement>(null);
  const elk = useMemo(() => new ELK(), []);

  // Compute layout whenever AIF changes
  useEffect(() => {
    async function computeLayout() {
      if (!aif?.nodes?.length) return;

      const elkGraph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'DOWN',
          'elk.spacing.nodeNode': '80',
          'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        },
        children: aif.nodes.map(n => {
          const dims = getNodeDimensions(n.kind);
          return {
            id: n.id,
            width: dims.width,
            height: dims.height,
          };
        }),
        edges: aif.edges.map(e => ({
          id: e.id,
          sources: [e.from],
          targets: [e.to],
        })),
      };

      try {
        const laid = await elk.layout(elkGraph);
        setLayout(laid);
      } catch (error) {
        console.error('Layout error:', error);
      }
    }

    computeLayout();
  }, [aif, elk]);

  // Expand a node's neighborhood
  const expandNode = useCallback(async (nodeId: string) => {
    if (!enableExpansion) return;
    if (expansionState.expandedNodes.has(nodeId)) return;
    if (currentDepth >= maxDepth) {
      alert(`Maximum depth (${maxDepth}) reached. Cannot expand further.`);
      return;
    }

    // Extract argument ID from node ID (format: "RA:argId")
    const match = nodeId.match(/^RA:(.+)$/);
    if (!match) return;
    const argId = match[1];

    setExpansionState(prev => ({
      ...prev,
      isExpanding: true,
      expandingNodeId: nodeId,
    }));

    try {
      const response = await fetch(
        `/api/arguments/${argId}/aif-neighborhood?depth=1&includeSupporting=${filters.includeSupporting}&includeOpposing=${filters.includeOpposing}&includePreferences=${filters.includePreferences}`
      );
      
      const data = await response.json();

      if (!data.ok || !data.aif) {
        throw new Error(data.error || 'Failed to fetch neighborhood');
      }

      // Merge new nodes and edges into existing graph
      const newNodes = data.aif.nodes.filter(
        (n: AifNode) => !aif.nodes.some(existing => existing.id === n.id)
      );
      const newEdges = data.aif.edges.filter(
        (e: AifEdge) => !aif.edges.some(existing => existing.id === e.id)
      );

      setAif(prev => ({
        nodes: [...prev.nodes, ...newNodes],
        edges: [...prev.edges, ...newEdges],
      }));

      setExpansionState(prev => ({
        ...prev,
        expandedNodes: new Set([...prev.expandedNodes, nodeId]),
        isExpanding: false,
        expandingNodeId: null,
      }));

      // Optionally increase depth
      setCurrentDepth(prev => Math.min(prev + 1, maxDepth));

    } catch (error) {
      console.error('Expansion error:', error);
      alert('Failed to expand node. See console for details.');
      setExpansionState(prev => ({
        ...prev,
        isExpanding: false,
        expandingNodeId: null,
      }));
    }
  }, [aif, currentDepth, enableExpansion, filters, maxDepth]);

  // Fetch summaries for all RA-nodes
  useEffect(() => {
    async function fetchSummaries() {
      // FIX #1: Add null check before accessing aif.nodes
      if (!aif?.nodes) return;
      
      const raNodes = aif.nodes.filter(n => n.kind === 'RA');
      
      for (const node of raNodes) {
        const match = node.id.match(/^RA:(.+)$/);
        if (!match) continue;
        const argId = match[1];

        // Skip if already fetched or currently expanded
        if (nodeSummaries.has(node.id) || expansionState.expandedNodes.has(node.id)) {
          continue;
        }

        try {
          const response = await fetch(
            `/api/arguments/${argId}/aif-neighborhood?summaryOnly=true`
          );
          const data = await response.json();
          
          if (data.ok && data.summary) {
            setNodeSummaries(prev => new Map(prev).set(node.id, data.summary));
          }
        } catch (error) {
          console.error('Failed to fetch summary for', node.id, error);
        }
      }
    }

    if (enableExpansion) {
      fetchSummaries();
    }
  }, [aif?.nodes, enableExpansion, expansionState.expandedNodes, nodeSummaries]); // Use optional chaining in dependency

  // Handle node click
  const handleNodeClick = useCallback((node: AifNode) => {
    // Call custom handler if provided
    onNodeClick?.(node);

    // If it's an RA-node and expansion is enabled, expand it
    if (enableExpansion && node.kind === 'RA' && !expansionState.isExpanding) {
      expandNode(node.id);
    }
  }, [enableExpansion, expansionState.isExpanding, expandNode, onNodeClick]);

  if (!layout) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-64 text-sm text-slate-500">
          Computing layout...
        </div>
      </div>
    );
  }

  const maxX = Math.max(...layout.children.map((n: any) => n.x + n.width), 0);
  const maxY = Math.max(...layout.children.map((n: any) => n.y + n.height), 0);

  return (
    <div className={`relative ${className}`}>
      {/* Top controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
        {/* Depth indicator */}
        <div className="bg-white/90 backdrop-blur border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-xs">
          <div className="font-semibold text-slate-700 mb-1">Depth: {currentDepth}/{maxDepth}</div>
          <div className="text-slate-600">
            {aif.nodes.length} nodes · {aif.edges.length} edges
          </div>
        </div>

        {/* Filter controls */}
        {enableExpansion && (
          <div className="bg-white/90 backdrop-blur border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-xs">
            <div className="font-semibold text-slate-700 mb-2">Expansion Filters</div>
            <label className="flex items-center gap-2 mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeSupporting}
                onChange={(e) => setFilters(f => ({ ...f, includeSupporting: e.target.checked }))}
                className="w-3 h-3"
              />
              <span className="text-slate-600">Supporting</span>
            </label>
            <label className="flex items-center gap-2 mb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includeOpposing}
                onChange={(e) => setFilters(f => ({ ...f, includeOpposing: e.target.checked }))}
                className="w-3 h-3"
              />
              <span className="text-slate-600">Conflicts</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.includePreferences}
                onChange={(e) => setFilters(f => ({ ...f, includePreferences: e.target.checked }))}
                className="w-3 h-3"
              />
              <span className="text-slate-600">Preferences</span>
            </label>
          </div>
        )}

        {/* Expansion status */}
        {expansionState.isExpanding && (
          <div className="bg-indigo-50 border border-indigo-300 rounded-lg px-3 py-2 shadow-sm text-xs">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600" />
              <span className="text-indigo-900 font-medium">Expanding...</span>
            </div>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full border border-slate-200 rounded-lg bg-slate-50"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      >
        {/* Grid background */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>

          {/* Arrow markers */}
          {Array.from(new Set(aif.edges.map(e => e.role))).map(role => {
            const style = getEdgeStyle(role);
            return (
              <marker
                key={role}
                id={`arrow-${role}`}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="5"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={style.markerColor} />
              </marker>
            );
          })}
        </defs>

        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid)" />

        {/* Edges */}
        <g className="edges">
          {layout.edges?.map((edge: any) => {
            const aifEdge = aif.edges.find(e => e.id === edge.id);
            if (!aifEdge) return null;

            const sourceNode = layout.children.find((n: any) => n.id === edge.sources[0]);
            const targetNode = layout.children.find((n: any) => n.id === edge.targets[0]);
            
            // FIX #2: Corrected logic - should be !sourceNode || !targetNode
            if (!sourceNode || !targetNode) {
              return null;
            }
            
            const style = getEdgeStyle(aifEdge.role);
            
            const x1 = sourceNode.x + sourceNode.width / 2;
            const y1 = sourceNode.y + sourceNode.height;
            const x2 = targetNode.x + targetNode.width / 2;
            const y2 = targetNode.y;
            
            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                fill="none"
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                markerEnd={`url(#arrow-${aifEdge.role})`}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {layout.children?.map((node: any) => {
            const aifNode = aif.nodes.find(n => n.id === node.id);
            if (!aifNode) return null;

            const isExpanded = expansionState.expandedNodes.has(node.id);
            const isExpandable = aifNode.kind === 'RA' && !isExpanded;
            const isExpanding = expansionState.isExpanding && expansionState.expandingNodeId === node.id;
            const summary = nodeSummaries.get(node.id);
            const hasConnections = summary && summary.totalConnections > 0;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleNodeClick(aifNode)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <AifNodeSvg
                  node={aifNode}
                  width={node.width}
                  height={node.height}
                  isHovered={hoveredNode === node.id}
                />
                
                {/* Loading overlay during expansion */}
                {isExpanding && (
                  <g>
                    <rect
                      x="0"
                      y="0"
                      width={node.width}
                      height={node.height}
                      fill="white"
                      opacity="0.85"
                      rx="4"
                    />
                    <circle
                      cx={node.width / 2}
                      cy={node.height / 2}
                      r="8"
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2"
                      strokeDasharray="12 4"
                      className="animate-spin"
                      style={{ transformOrigin: `${node.width / 2}px ${node.height / 2}px` }}
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${node.width / 2} ${node.height / 2}`}
                        to={`360 ${node.width / 2} ${node.height / 2}`}
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  </g>
                )}
                
                {/* Expansion indicator */}
                {enableExpansion && isExpandable && hasConnections && !isExpanding && (
                  <g>
                    <circle
                      cx={node.width - 8}
                      cy={8}
                      r="10"
                      fill="#3b82f6"
                      className="animate-pulse"
                    />
                    <text
                      x={node.width - 8}
                      y={8}
                      className="text-[10px] font-bold fill-white"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {summary?.totalConnections}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Help text */}
      {enableExpansion && (
        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-xs text-slate-600">
          💡 Click RA-nodes to expand their neighborhoods
        </div>
      )}
    </div>
  );
}