// components/graph/CegMiniMap.tsx
'use client';

import { useRef, useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useCegData } from '../graph/useCegData';
import type { CegNode, CegEdge } from '../graph/useCegData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CriticalQuestions from '@/components/claims/CriticalQuestionsV2';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface CegMiniMapProps {
  deliberationId: string;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  width?: number;
  height?: number;
  viewMode?: 'graph' | 'clusters' | 'controversy' | 'flow';
}

type LayoutMode = 'force' | 'hierarchical' | 'radial' | 'cluster';

// Enhanced force layout with clustering awareness
function useAdvancedForceLayout(
  nodes: CegNode[],
  edges: CegEdge[],
  width: number,
  height: number,
  layoutMode: LayoutMode
) {
  return useMemo(() => {
    if (nodes.length === 0) {
      return new Map<string, { x: number; y: number }>();
    }

    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    const centerX = width / 2;
    const centerY = height / 2;

    // Hierarchical layout: arrange by semantic label
    if (layoutMode === 'hierarchical') {
      const inNodes = nodes.filter(n => n.label === 'IN');
      const outNodes = nodes.filter(n => n.label === 'OUT');
      const undecNodes = nodes.filter(n => n.label === 'UNDEC');

      const layerHeight = height / 4;
      
      const placeLayer = (layerNodes: CegNode[], yPos: number) => {
        const spacing = Math.min(width / (layerNodes.length + 1), 40);
        layerNodes.forEach((node, i) => {
          const x = (i + 1) * spacing;
          positions.set(node.id, { x, y: yPos, vx: 0, vy: 0 });
        });
      };

      placeLayer(inNodes, layerHeight);
      placeLayer(undecNodes, 2 * layerHeight);
      placeLayer(outNodes, 3 * layerHeight);
      
      return new Map(
        Array.from(positions.entries()).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
      );
    }

    // Radial layout: controversial claims in center
    if (layoutMode === 'radial') {
      const controversial = nodes.filter(n => n.isControversial);
      const nonControversial = nodes.filter(n => !n.isControversial);

      controversial.forEach((node, i) => {
        const angle = (i / controversial.length) * 2 * Math.PI;
        const r = 30;
        positions.set(node.id, {
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle),
          vx: 0,
          vy: 0,
        });
      });

      nonControversial.forEach((node, i) => {
        const angle = (i / nonControversial.length) * 2 * Math.PI;
        const r = Math.min(width, height) * 0.35;
        positions.set(node.id, {
          x: centerX + r * Math.cos(angle),
          y: centerY + r * Math.sin(angle),
          vx: 0,
          vy: 0,
        });
      });

      return new Map(
        Array.from(positions.entries()).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
      );
    }

    // Cluster layout: group by cluster ID
    if (layoutMode === 'cluster') {
      const clusters = new Map<number, CegNode[]>();
      nodes.forEach(n => {
        const cid = n.clusterId ?? 0;
        if (!clusters.has(cid)) clusters.set(cid, []);
        clusters.get(cid)!.push(n);
      });

      const clusterCount = clusters.size;
      const clusterRadius = Math.min(width, height) * 0.3;

      Array.from(clusters.entries()).forEach(([cid, clusterNodes], clusterIdx) => {
        const clusterAngle = (clusterIdx / clusterCount) * 2 * Math.PI;
        const clusterCenterX = centerX + clusterRadius * Math.cos(clusterAngle);
        const clusterCenterY = centerY + clusterRadius * Math.sin(clusterAngle);
        
        // Dynamic inner radius based on cluster density
        // Base calculation: scale with canvas size, node count, and cluster count
        const baseRadius = Math.min(width, height) * 0.15; // 15% of canvas
        const nodeDensityFactor = Math.sqrt(clusterNodes.length) / 3; // Scale with sqrt to avoid explosive growth
        const clusterCountFactor = 1 / Math.sqrt(clusterCount); // More clusters = smaller inner radius
        const innerRadius = Math.max(
          30, // Minimum radius to prevent node overlap
          Math.min(
            baseRadius * nodeDensityFactor * clusterCountFactor,
            Math.min(width, height) * 0.25 // Cap at 25% of canvas
          )
        );

        clusterNodes.forEach((node, i) => {
          const nodeAngle = (i / clusterNodes.length) * 2 * Math.PI;
          positions.set(node.id, {
            x: clusterCenterX + innerRadius * Math.cos(nodeAngle),
            y: clusterCenterY + innerRadius * Math.sin(nodeAngle),
            vx: 0,
            vy: 0,
          });
        });
      });

      return new Map(
        Array.from(positions.entries()).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
      );
    }

    // Default: Force-directed with cluster attraction
    const radius = Math.min(width, height) * 3;
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    // Simulation parameters
    const iterations = 60;
    const repulsion = 120;
    const attraction = 0.012;
    const clusterAttraction = 0.03;
    const damping = 0.7;

    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

      // Repulsion between all nodes
      nodes.forEach(nodeA => {
        const posA = positions.get(nodeA.id)!;
        
        nodes.forEach(nodeB => {
          if (nodeA.id === nodeB.id) return;
          const posB = positions.get(nodeB.id)!;
          
          const dx = posA.x - posB.x;
          const dy = posA.y - posB.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq > 0) {
            const force = (repulsion * alpha) / Math.max(distSq, 1);
            const dist = Math.sqrt(distSq);
            posA.vx += (dx / dist) * force;
            posA.vy += (dy / dist) * force;
          }
        });

        // Cluster cohesion
        nodes.forEach(nodeB => {
          if (nodeA.id === nodeB.id) return;
          if (nodeA.clusterId === nodeB.clusterId && nodeA.clusterId !== undefined) {
            const posB = positions.get(nodeB.id)!;
            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
              const force = clusterAttraction * alpha;
              posA.vx += (dx / dist) * force;
              posA.vy += (dy / dist) * force;
            }
          }
        });
      });

      // Attraction along edges
      edges.forEach(edge => {
        const posA = positions.get(edge.source);
        const posB = positions.get(edge.target);
        if (!posA || !posB) return;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          const force = dist * attraction * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          posA.vx += fx;
          posA.vy += fy;
          posB.vx -= fx;
          posB.vy -= fy;
        }
      });

      // Update positions with damping
      positions.forEach(pos => {
        pos.vx *= damping;
        pos.vy *= damping;
        pos.x += pos.vx;
        pos.y += pos.vy;

        // Keep in bounds
        const padding = 5;
        pos.x = Math.max(padding, Math.min(width - padding, pos.x));
        pos.y = Math.max(padding, Math.min(height - padding, pos.y));
      });
    }

    return new Map(
      Array.from(positions.entries()).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
    );
  }, [nodes, edges, width, height, layoutMode]);
}

function getNodeColor(node: CegNode, viewMode: string): string {
  if (viewMode === 'controversy' && node.isControversial) {
    return '#ea580c'; // Orange for controversial
  }
  
  switch (node.label) {
    case 'IN': return '#16a34a';
    case 'OUT': return '#dc2626';
    case 'UNDEC': return '#64748b';
    default: return '#94a3b8';
  }
}

function getNodeRadius(node: CegNode, viewMode: string): number {
  const base = 5;
  
  if (viewMode === 'controversy') {
    return base + (node.isControversial ? 3 : 0);
  }
  
  // Size by centrality
  return base + node.centrality * 4;
}

function getEdgeStyle(edge: CegEdge, viewMode: string): { 
  stroke: string; 
  strokeDasharray?: string;
  opacity: number;
} {
  const baseOpacity = viewMode === 'flow' ? 0.6 : 0.4;
  
  if (edge.type === 'supports') {
    return { 
      stroke: '#16a34a',
      opacity: baseOpacity,
    };
  }
  
  // Attacks
  switch (edge.attackType) {
    case 'UNDERCUTS':
      return { 
        stroke: '#a16207', 
        strokeDasharray: '4 2',
        opacity: baseOpacity,
      };
    case 'UNDERMINES':
      return { 
        stroke: '#dc2626', 
        strokeDasharray: '2 2',
        opacity: baseOpacity,
      };
    case 'REBUTS':
      return { 
        stroke: '#dc2626',
        opacity: baseOpacity,
      };
    default:
      return { 
        stroke: '#ef4444',
        opacity: baseOpacity,
      };
  }
}

export default function CegMiniMap({
  deliberationId,
  selectedClaimId,
  onSelectClaim,
  width = 320,
  height = 280,
  viewMode = 'graph',
}: CegMiniMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const [showClusters, setShowClusters] = useState(false);
  const [filterLabel, setFilterLabel] = useState<'all' | 'IN' | 'OUT' | 'UNDEC'>('all');
  const [cqDialogOpen, setCqDialogOpen] = useState(false);
  const [selectedClaimForCQ, setSelectedClaimForCQ] = useState<string | null>(null);

  const { nodes, edges, stats, loading, error } = useCegData(deliberationId);

  // Fetch CQ data for all claims in the deliberation
  const { data: cqData } = useSWR(
    deliberationId ? `/api/deliberations/${deliberationId}/cqs` : null,
    fetcher
  );

  // Fetch dialogical moves for WHY/GROUNDS counts
  const { data: movesData } = useSWR(
    deliberationId ? `/api/deliberations/${deliberationId}/moves` : null,
    fetcher
  );

  // Enrich nodes with CQ and dialogical move data
  const enrichedNodes = useMemo(() => {
    return nodes.map(node => {
      // CQ status - find data for this claim
      const claimData = cqData?.items?.find((item: any) => item.targetId === node.id);
      let required = 0;
      let satisfied = 0;
      
      if (claimData?.schemes) {
        for (const scheme of claimData.schemes) {
          for (const cq of scheme.cqs || []) {
            required++;
            if (cq.satisfied) satisfied++;
          }
        }
      }
      
      const cqPercentage = required > 0 ? Math.round((satisfied / required) * 100) : 0;

      // Dialogical moves (WHY/GROUNDS) - handle different API response formats
      const movesArray = Array.isArray(movesData) ? movesData : (movesData?.items || movesData?.moves || []);
      const moves = movesArray.filter((m: any) => m.targetId === node.id);
      const whyMoves = moves.filter((m: any) => m.kind === 'WHY');
      const groundsMoves = moves.filter((m: any) => m.kind === 'GROUNDS');
      
      // Count open WHYs (WHY without matching GROUNDS)
      const openWhys = whyMoves.filter((w: any) =>
        !groundsMoves.some((g: any) =>
          g.payload?.cqId === w.payload?.cqId &&
          new Date(g.createdAt) > new Date(w.createdAt)
        )
      ).length;

      const groundsCount = groundsMoves.length;

      return {
        ...node,
        cqStatus: { required, satisfied, percentage: cqPercentage },
        dialogicalStatus: { openWhys, groundsCount },
      };
    });
  }, [nodes, cqData, movesData]);

  // Filter nodes based on current filter
  const filteredNodes = useMemo(() => {
    if (filterLabel === 'all') return enrichedNodes;
    return enrichedNodes.filter(n => n.label === filterLabel);
  }, [enrichedNodes, filterLabel]);

  // Filter edges to only include visible nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [edges, filteredNodes]);

  const nodePositions = useAdvancedForceLayout(
    filteredNodes,
    filteredEdges,
    width,
    height,
    layoutMode
  );

  // Compute clusters for visualization
  const clusterBounds = useMemo(() => {
    if (!showClusters) return [];
    
    const clusters = new Map<number, { minX: number; maxX: number; minY: number; maxY: number; nodes: CegNode[] }>();
    
    filteredNodes.forEach(node => {
      const cid = node.clusterId ?? 0;
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      if (!clusters.has(cid)) {
        clusters.set(cid, {
          minX: pos.x,
          maxX: pos.x,
          minY: pos.y,
          maxY: pos.y,
          nodes: [],
        });
      }

      const cluster = clusters.get(cid)!;
      cluster.minX = Math.min(cluster.minX, pos.x);
      cluster.maxX = Math.max(cluster.maxX, pos.x);
      cluster.minY = Math.min(cluster.minY, pos.y);
      cluster.maxY = Math.max(cluster.maxY, pos.y);
      cluster.nodes.push(node);
    });

    return Array.from(clusters.values()).map(c => ({
      x: c.minX - 10,
      y: c.minY - 10,
      width: c.maxX - c.minX + 20,
      height: c.maxY - c.minY + 20,
      nodeCount: c.nodes.length,
    }));
  }, [showClusters, filteredNodes, nodePositions]);

  const getConnectedNodes = useCallback((nodeId: string): Set<string> => {
    const connected = new Set<string>([nodeId]);
    filteredEdges.forEach(e => {
      if (e.source === nodeId) connected.add(e.target);
      if (e.target === nodeId) connected.add(e.source);
    });
    return connected;
  }, [filteredEdges]);

  const connectedNodes = hoveredId ? getConnectedNodes(hoveredId) : new Set<string>();

  // Handle node click - open CQ dialog if CQs exist, otherwise just select
  const handleNodeClick = useCallback((nodeId: string) => {
    const node = enrichedNodes.find(n => n.id === nodeId);
    if (node && node.cqStatus && node.cqStatus.required > 0) {
      setSelectedClaimForCQ(nodeId);
      setCqDialogOpen(true);
    }
    onSelectClaim?.(nodeId);
  }, [enrichedNodes, onSelectClaim]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-48 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="text-sm text-rose-700">Failed to load graph</div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        <div className="text-sm text-slate-500">No claims yet</div>
        <div className="text-xs text-slate-400 mt-1">
          Add claims to see the argument structure
        </div>
      </div>
    );
  }

  const controversialNodes = nodes.filter(n => n.isControversial);
  const hubNodes = nodes.filter(n => n.centrality >= 0.6);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Enhanced Header */}
      <div className="px-3 py-2.5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-slate-800">Argument Map</h4>
          <div className="flex items-center gap-1.5">
            {/* Layout mode selector */}
            <button
              onClick={() => setLayoutMode(m => 
                m === 'force' ? 'hierarchical' : 
                m === 'hierarchical' ? 'radial' :
                m === 'radial' ? 'cluster' : 'force'
              )}
              className="px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
              title="Change layout"
            >
              {layoutMode === 'force' ? '🔀' : 
               layoutMode === 'hierarchical' ? '📊' :
               layoutMode === 'radial' ? '⭕' : '🗂️'}
            </button>
            
            {/* Cluster visibility */}
            <button
              onClick={() => setShowClusters(!showClusters)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                showClusters 
                  ? 'bg-sky-100 text-sky-700' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Toggle cluster boundaries"
            >
              🗂️
            </button>

            <span className="text-[10px] text-slate-500 ml-1">
              {filteredNodes.length} claims
            </span>
          </div>
        </div>

        {/* Quick stats with insights */}
        {stats && (
          <div className="space-y-2">
            {/* Support vs Counter */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 rounded-lg p-1.5">
                <div className="text-[9px] text-green-700 font-medium mb-0.5">Support</div>
                <div className="text-lg font-bold text-green-800">
                  {Math.round(stats.supportPct * 100)}%
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-1.5">
                <div className="text-[9px] text-red-700 font-medium mb-0.5">Counter</div>
                <div className="text-lg font-bold text-red-800">
                  {Math.round(stats.counterPct * 100)}%
                </div>
              </div>
            </div>

            {/* Semantic labels filter */}
            <div className="flex items-center gap-1">
              {(['all', 'IN', 'OUT', 'UNDEC'] as const).map(label => {
                const count = label === 'all' ? nodes.length :
                  label === 'IN' ? stats.inClaims :
                  label === 'OUT' ? stats.outClaims :
                  stats.undecClaims;
                
                const color = label === 'IN' ? 'green' :
                  label === 'OUT' ? 'red' :
                  label === 'UNDEC' ? 'slate' : 'sky';

                return (
                  <button
                    key={label}
                    onClick={() => setFilterLabel(label)}
                    className={`flex-1 px-2 py-1 text-[10px] font-semibold rounded transition-all ${
                      filterLabel === label
                        ? `bg-${color}-100 text-${color}-800 ring-1 ring-${color}-300`
                        : `text-slate-600 hover:bg-slate-50`
                    }`}
                  >
                    {label === 'all' ? 'All' : label}
                    <span className="ml-1 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Insights */}
            <div className="flex flex-wrap gap-1.5 text-[9px]">
              {controversialNodes.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full">
                  <span>⚠️</span>
                  <span className="font-medium">{controversialNodes.length} controversial</span>
                </div>
              )}
              {hubNodes.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                  <span>🟠</span>
                  <span className="font-medium">{hubNodes.length} hubs</span>
                </div>
              )}
              {stats.clusterCount > 1 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full">
                  <span>🌐</span>
                  <span className="font-medium">{stats.clusterCount} clusters</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Graph Visualization */}
      <div className="relative flex p-3 justify-center items-center mx-auto w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg"
        >
          <defs>
            {/* Gradient backgrounds for clusters */}
            <radialGradient id="cluster-gradient">
              <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#e0e7ff" stopOpacity="0" />
            </radialGradient>

            {/* Arrow markers */}
            <marker
              id="arrow-support"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#16a34a" />
            </marker>
            <marker
              id="arrow-attack"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#dc2626" />
            </marker>
            <marker
              id="arrow-undercut"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 7 3.5, 0 7" fill="#a16207" />
            </marker>

            {/* Glow effect for selected node */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Cluster boundaries */}
          {showClusters && clusterBounds.map((cluster, idx) => (
            <g key={idx}>
              <rect
                x={cluster.x}
                y={cluster.y}
                width={cluster.width}
                height={cluster.height}
                rx="8"
                fill="url(#cluster-gradient)"
                stroke="#a5b4fc"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.5"
              />
              <text
                x={cluster.x + 4}
                y={cluster.y + 10}
                fontSize="8"
                fill="#6366f1"
                fontWeight="600"
              >
                Cluster {idx + 1} ({cluster.nodeCount})
              </text>
            </g>
          ))}

          {/* Edges */}
          <g className="edges">
            {filteredEdges.map(edge => {
              const from = nodePositions.get(edge.source);
              const to = nodePositions.get(edge.target);
              if (!from || !to) return null;

              const style = getEdgeStyle(edge, viewMode);
              const isHighlighted = hoveredId && (
                connectedNodes.has(edge.source) && connectedNodes.has(edge.target)
              );

              const markerId = 
                edge.attackType === 'UNDERCUTS' ? 'arrow-undercut' :
                edge.type === 'rebuts' ? 'arrow-attack' :
                'arrow-support';

              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={style.stroke}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={style.strokeDasharray}
                  strokeOpacity={isHighlighted ? 0.9 : style.opacity}
                  markerEnd={`url(#${markerId})`}
                  className="transition-all duration-200"
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {filteredNodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const isSelected = node.id === selectedClaimId;
              const isHovered = node.id === hoveredId;
              const isConnected = connectedNodes.has(node.id);
              const radius = getNodeRadius(node, viewMode);
              const scaledRadius = isSelected ? radius + 2 : isHovered ? radius + 1 : radius;
              const opacity = hoveredId && !isConnected ? 0.25 : 1;

              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  opacity={opacity}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="transition-all duration-200"
                  filter={isSelected ? 'url(#glow)' : undefined}
                >
                  {/* Selection ring */}
                  {isSelected && (
                    <>
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={scaledRadius + 4}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        className="animate-pulse"
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={scaledRadius + 7}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={1}
                        opacity={0.3}
                      />
                    </>
                  )}

                  {/* Controversial indicator ring */}
                  {node.isControversial && !isSelected && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={scaledRadius + 3}
                      fill="none"
                      stroke="#ea580c"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      opacity={0.6}
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={scaledRadius}
                    fill={getNodeColor(node, viewMode)}
                    stroke="#fff"
                    strokeWidth={isHovered ? 2.5 : 1.5}
                  />

                  {/* Centrality indicator (inner dot for hubs) */}
                  {node.centrality >= 0.6 && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={2}
                      fill="#fff"
                      opacity={0.9}
                    />
                  )}

                  {/* Approval count */}
                  {node.approvals > 0 && (
                    <text
                      x={pos.x}
                      y={pos.y + scaledRadius + 9}
                      fontSize="7"
                      fill="#16a34a"
                      textAnchor="middle"
                      fontWeight="700"
                    >
                      +{node.approvals}
                    </text>
                  )}

                  {/* CQ Status Badge */}
                  {(node as any).cqStatus && (node as any).cqStatus.required > 0 && (
                    <text
                      x={pos.x}
                      y={pos.y + scaledRadius + (node.approvals > 0 ? 17 : 9)}
                      fontSize="6"
                      fill="#6366f1"
                      textAnchor="middle"
                      fontWeight="700"
                    >
                      CQ {(node as any).cqStatus.percentage}%
                    </text>
                  )}

                  {/* Open WHY count (if any) */}
                  {(node as any).dialogicalStatus && (node as any).dialogicalStatus.openWhys > 0 && (
                    <text
                      x={pos.x + scaledRadius + 10}
                      y={pos.y - scaledRadius - 2}
                      fontSize="7"
                      fill="#f59e0b"
                      fontWeight="700"
                    >
                      ?{(node as any).dialogicalStatus.openWhys}
                    </text>
                  )}

                  {/* GROUNDS count (if any) */}
                  {(node as any).dialogicalStatus && (node as any).dialogicalStatus.groundsCount > 0 && (
                    <text
                      x={pos.x - scaledRadius - 10}
                      y={pos.y - scaledRadius - 2}
                      fontSize="7"
                      fill="#10b981"
                      textAnchor="end"
                      fontWeight="700"
                    >
                      G:{(node as any).dialogicalStatus.groundsCount}
                    </text>
                  )}

                  {/* Degree indicators (small badges) */}
                  {(isHovered || isSelected) && (node.inDegree > 0 || node.outDegree > 0) && (
                    <>
                      {node.inDegree > 0 && (
                        <text
                          x={pos.x - scaledRadius - 6}
                          y={pos.y + 2}
                          fontSize="6"
                          fill="#64748b"
                          fontWeight="600"
                        >
                          ←{node.inDegree}
                        </text>
                      )}
                      {node.outDegree > 0 && (
                        <text
                          x={pos.x + scaledRadius + 6}
                          y={pos.y + 2}
                          fontSize="6"
                          fill="#64748b"
                          fontWeight="600"
                          textAnchor="start"
                        >
                          {node.outDegree}→
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Enhanced Tooltip */}
        {hoveredId && (() => {
          const node = nodes.find(n => n.id === hoveredId);
          const pos = nodePositions.get(hoveredId);
          if (!node || !pos) return null;

          return (
            <div
              className="fixed right-[100px] top-[300px]   z-50 bg-slate-200/55 backdrop-blur-lg text-slate-900 text-[11px] px-2 py-2 rounded-lg shadow-xl pointer-events-none max-w-[270px] border-2 border-orange-500"
              style={{
                left: Math.min(pos.x + 15, width - 120),
                top: Math.max(pos.y - 50, 10),
              }}
            >
              {/* Label badge */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`px-1.5 py-0.5 text-[8px] text-white font-bold rounded ${
                  node.label === 'IN' ? 'bg-green-600' :
                  node.label === 'OUT' ? 'bg-red-600' :
                  'bg-slate-600'
                }`}>
                  {node.label}
                </span>
                {node.isControversial && (
                  <span className="px-1.5 py-0.5 text-[8px] text-white font-bold rounded bg-orange-600">
                    CONTROVERSIAL
                  </span>
                )}
                {node.centrality >= 0.6 && (
                  <span className="px-1.5 py-0.5 text-[8px] text-white font-bold rounded bg-purple-600">
                    HUB
                  </span>
                )}
              </div>

              {/* Claim text */}
              <div className="font-medium mb-1.5 leading-tight">
                {node.text.substring(0, 120)}
                {node.text.length > 120 && '...'}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-bold text-[10px] opacity-90 border-t border-slate-700 pt-1.5">
                <div>
                  <span className="text-slate-900">Support:</span>{' '}
                  <span className="text-green-700 font-bold">
                    {node.supportStrength.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-900">Attack:</span>{' '}
                  <span className="text-red-800 font-bold">
                    {node.attackStrength.toFixed(1)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-900">In:</span>{' '}
                  <span className="font-bold">{node.inDegree}</span>
                </div>
                <div>
                  <span className="text-slate-900">Out:</span>{' '}
                  <span className="font-bold">{node.outDegree}</span>
                </div>
              </div>

              {node.approvals > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-emerald-400 font-semibold">
                  ✓ {node.approvals} approval{node.approvals !== 1 ? 's' : ''}
                </div>
              )}

              {/* CQ Status */}
              {(node as any).cqStatus && (node as any).cqStatus.required > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-900">Critical Questions:</span>
                    <span className="font-bold text-indigo-400">
                      {(node as any).cqStatus.satisfied}/{(node as any).cqStatus.required} ({(node as any).cqStatus.percentage}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Dialogical Status */}
              {(node as any).dialogicalStatus && ((node as any).dialogicalStatus.openWhys > 0 || (node as any).dialogicalStatus.groundsCount > 0) && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700">
                  <div className="grid grid-cols-2 gap-x-3 text-[10px]">
                    {(node as any).dialogicalStatus.openWhys > 0 && (
                      <div>
                        <span className="text-slate-900">Open WHY:</span>{' '}
                        <span className="font-bold text-amber-400">{(node as any).dialogicalStatus.openWhys}</span>
                      </div>
                    )}
                    {(node as any).dialogicalStatus.groundsCount > 0 && (
                      <div>
                        <span className="text-slate-900">GROUNDS:</span>{' '}
                        <span className="font-bold text-emerald-400">{(node as any).dialogicalStatus.groundsCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Click hint for CQs */}
              {(node as any).cqStatus && (node as any).cqStatus.required > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-700 text-[9px] text-indigo-300 italic">
                  Click to view critical questions →
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Enhanced Legend & Insights */}
      <div className="px-3 py-2.5 border-t border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold text-slate-700">Legend</div>
          <div className="text-[9px] text-slate-500">
            Layout: <span className="font-medium text-slate-700">
              {layoutMode === 'force' ? 'Force-directed' :
               layoutMode === 'hierarchical' ? 'Hierarchical' :
               layoutMode === 'radial' ? 'Radial' : 'Clustered'}
            </span>
          </div>
        </div>
        
        {/* Edge types */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[9px] text-slate-600">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="2">
              <line x1="0" y1="1" x2="16" y2="1" stroke="#16a34a" strokeWidth="2" />
            </svg>
            Support
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="2">
              <line x1="0" y1="1" x2="16" y2="1" stroke="#dc2626" strokeWidth="2" />
            </svg>
            Rebut
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="2">
              <line x1="0" y1="1" x2="16" y2="1" stroke="#a16207" strokeWidth="2" strokeDasharray="3 2" />
            </svg>
            Undercut
          </span>
        </div>

        {/* Node indicators */}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[9px] text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
            IN
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
            OUT
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#64748b]" />
            UNDEC
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ea580c] ring-1 ring-[#ea580c] ring-offset-1" />
            Controversial
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#9333ea]" />
            Hub
          </span>
        </div>

        {/* Quick insights */}
        {stats && (stats.isolatedCount > 0 || controversialNodes.length > 0) && (
          <div className="pt-2 border-t border-slate-200">
            <div className="text-[9px] text-slate-600 space-y-1">
              {stats.isolatedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-600">⚠️</span>
                  <span>
                    <span className="font-semibold">{stats.isolatedCount}</span> isolated claim{stats.isolatedCount !== 1 ? 's' : ''} (no connections)
                  </span>
                </div>
              )}
              {controversialNodes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-600">𓏃</span>
                  <span>
                    <span className="font-semibold">{controversialNodes.length}</span> controversial claim{controversialNodes.length !== 1 ? 's' : ''} (balanced attacks/supports)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CQ Dialog */}
      {/* <Dialog open={cqDialogOpen} onOpenChange={setCqDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Critical Questions</DialogTitle>
          </DialogHeader>
          {selectedClaimForCQ && (
            <CriticalQuestions
              targetType="claim"
              targetId={selectedClaimForCQ}
              deliberationId={deliberationId}
            />
          )}
        </DialogContent>
      </Dialog> */}
    </div>
  );
}