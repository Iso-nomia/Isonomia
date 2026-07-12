//components/map/Aifdiagramviewsemanticzoom.tsx
/**
 * Phase 3: AIF Diagram Viewer with Semantic Zoom
 * 
 * Enhances the interactive viewer with zoom-aware rendering
 */

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { AifSubgraph, AifNode, AifEdge } from '@/lib/arguments/diagram';
import { getNodeDimensions, getEdgeStyle } from './AifDiagramView';
import { ZoomAwareAifNode } from './Enhancedaifnodes';

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

export default function AifDiagramViewSemanticZoom({
  initialAif,
  rootArgumentId,
  className,
  enableExpansion = true,
  maxDepth = 3,
  onNodeClick,
}: {
  initialAif: AifSubgraph;
  rootArgumentId: string;
  className?: string;
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

  const [nodeSummaries, setNodeSummaries] = useState<Map<string, NeighborhoodSummary>>(new Map());
  const [currentDepth, setCurrentDepth] = useState(1);
  const [filters, setFilters] = useState({
    includeSupporting: true,
    includeOpposing: true,
    includePreferences: true,
  });

  // UI state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // SEMANTIC ZOOM STATE
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  

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

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.min(Math.max(zoom + delta, 0.2), 3);
    setZoom(newZoom);
  }, [zoom]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Expand node (same as before)
  const expandNode = useCallback(async (nodeId: string) => {
    if (!enableExpansion) return;
    if (expansionState.expandedNodes.has(nodeId)) return;
    if (currentDepth >= maxDepth) {
      alert(`Maximum depth (${maxDepth}) reached. Cannot expand further.`);
      return;
    }

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
  }, [aif, currentDepth, enableExpansion, filters, maxDepth, expansionState.expandedNodes]);

  // Fetch summaries
  useEffect(() => {
    async function fetchSummaries() {
      if (!aif?.nodes) return;
      
      const raNodes = aif.nodes.filter(n => n.kind === 'RA');
      
      for (const node of raNodes) {
        const match = node.id.match(/^RA:(.+)$/);
        if (!match) continue;
        const argId = match[1];

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
  }, [aif?.nodes, enableExpansion, expansionState.expandedNodes, nodeSummaries]);

  const handleNodeClick = useCallback((node: AifNode) => {
    onNodeClick?.(node);

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

  const maxX = Math.max(...layout.children.map((n: any) => n.x + n.width), 1000);
  const maxY = Math.max(...layout.children.map((n: any) => n.y + n.height), 1000);

  // Calculate viewBox with zoom and pan
  const viewBoxWidth = 1000 / zoom;
  const viewBoxHeight = 800 / zoom;
  const viewBoxX = -pan.x / zoom;
  const viewBoxY = -pan.y / zoom;

  return (
    <div className={`relative ${className}`}>
      {/* Top controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
        {/* Depth and zoom indicator */}
        <div className="bg-white/90 backdrop-blur border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-xs">
          <div className="font-semibold text-slate-700 mb-1">
            Depth: {currentDepth}/{maxDepth} · Zoom: {(zoom * 100).toFixed(0)}%
          </div>
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

        {/* View controls */}
        <div className="bg-white/90 backdrop-blur border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-xs">
          <button
            onClick={resetView}
            className="w-full px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 transition-colors"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full border border-slate-200 rounded-lg bg-slate-50 cursor-move"
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern id="grid-zoom" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>

          {Array.from(new Set(aif.edges.map(e => e.role))).map(role => {
            const style = getEdgeStyle(role);
            return (
              <marker
                key={role}
                id={`arrow-zoom-${role}`}
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

        <rect x={viewBoxX} y={viewBoxY} width={viewBoxWidth} height={viewBoxHeight} fill="url(#grid-zoom)" />

        {/* Edges */}
        <g className="edges">
          {layout.edges?.map((edge: any) => {
            const aifEdge = aif.edges.find(e => e.id === edge.id);
            if (!aifEdge) return null;

            const sourceNode = layout.children.find((n: any) => n.id === edge.sources[0]);
            const targetNode = layout.children.find((n: any) => n.id === edge.targets[0]);
            
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
                strokeWidth={style.strokeWidth * (zoom > 0.5 ? 1 : 0.7)}
                strokeDasharray={style.strokeDasharray}
                markerEnd={`url(#arrow-zoom-${aifEdge.role})`}
              />
            );
          })}
        </g>

        {/* Nodes with semantic zoom */}
        <g className="nodes">
          {layout.children?.map((node: any) => {
            const aifNode = aif.nodes.find(n => n.id === node.id);
            if (!aifNode) return null;

            const isExpanded = expansionState.expandedNodes.has(node.id);
            const isExpandable = aifNode.kind === 'RA' && !isExpanded;
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
                <ZoomAwareAifNode
                  node={aifNode}
                  width={node.width}
                  height={node.height}
                  isHovered={hoveredNode === node.id}
                  zoomLevel={zoom}
                />
                
                {/* Expansion indicator */}
                {enableExpansion && isExpandable && hasConnections && zoom > 0.5 && (
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
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur border border-slate-300 rounded-lg px-3 py-2 shadow-sm text-xs text-slate-600">
        <div className="font-semibold mb-1">Controls</div>
        <div>🖱️ Scroll: Zoom in/out</div>
        <div>⇧ + Drag: Pan view</div>
        {enableExpansion && <div>🖱️ Click RA: Expand</div>}
      </div>
    </div>
  );
}