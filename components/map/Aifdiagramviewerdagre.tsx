// components/map/Aifdiagramviewerdagre.tsx
/**
 * AIF Diagram Viewer - Complete with Dagre Layout
 * All features integrated + hierarchical layout + edge styling + legend
 */

'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import type { AifSubgraph, AifEdgeRole } from '@/lib/arguments/diagram';
import { AifDiagramMinimap } from './Aifdiagramminimap';
import { AifPathHighlighter, usePathHighlight, type ArgumentPath } from './Aifpathhighlighter';
import { AifDiagramSearch, useGraphSearch } from './Aifdiagramsearch';
import { AifDiagramExportMenu } from './Aifdiagramexport';
import { ZoomAwareAifNode } from './Enhancedaifnodes';
import { useDagreLayout, LAYOUT_PRESETS } from './Aifdagrelayout';
import { useDeliberationContraries } from '@/components/claims/contraryBadge/useDeliberationContraries';

// ---------------- Edge Styling ----------------
function getEdgeStyle(role: AifEdgeRole): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  markerColor: string;
} {
  switch (role) {
    case 'premise':
      return { stroke: '#64748b', strokeWidth: 1, markerColor: '#64748b' };
    case 'conclusion':
      return { stroke: '#059669', strokeWidth: 1, markerColor: '#059669' };
    case 'conflictingElement':
      return { stroke: '#ef4444', strokeWidth: 1, markerColor: '#ef4444' };
    case 'conflictedElement':
      return { stroke: '#dc2626', strokeWidth: 1, markerColor: '#dc2626' };
    case 'preferredElement':
      return { stroke: '#8b5cf6', strokeWidth: 1 , strokeDasharray: '8,4', markerColor: '#8b5cf6' };
    case 'dispreferredElement':
      return { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '6,3', markerColor: '#6b7280' };
    default:
      return { stroke: '#94a3b8', strokeWidth: 1, markerColor: '#94a3b8' };
  }
}

// ---------------- Legend Edge Component ----------------
function LegendEdge({
  color,
  dash,
  label,
}: {
  color: string;
  dash?: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="24" height="12" viewBox="0 0 54 12" aria-hidden="true">
        <line
          x1="2"
          y1="6"
          x2="42"
          y2="6"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={dash || undefined}
          strokeLinecap="round"
        />
        <path d="M44 6 L52 2 L52 10 Z" fill={color} />
      </svg>
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function AifDiagramViewerDagre({
  initialGraph,
  onNodeClick,
  layoutPreset = 'standard',
  className = '',
  deliberationId, // Phase 3.1.4: For fetching dialogue state
  initialSelectedNodeId, // Auto-select this node on mount
}: {
  initialGraph: AifSubgraph;
  onNodeClick?: (nodeId: string) => void;
  layoutPreset?: keyof typeof LAYOUT_PRESETS;
  className?: string;
  deliberationId?: string; // Phase 3.1.4: Optional deliberation ID
  initialSelectedNodeId?: string; // Node to auto-select on mount
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Graph state
  const [graph, setGraph] = useState(initialGraph);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(initialSelectedNodeId);
  
  // Phase 3.1.4: Dialogue state filter
  const [dialogueFilter, setDialogueFilter] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [dialogueStates, setDialogueStates] = useState<Record<string, { moveComplete: boolean }>>({});
  
  // Phase 3.1.4: Filter nodes based on dialogue state
  const filteredGraph = useMemo(() => {
    if (dialogueFilter === 'all' || !deliberationId) return graph;
    
    const filteredNodes = graph.nodes.filter(node => {
      // Only filter RA (argument) nodes
      if (node.kind !== 'RA') return true;
      
      const state = dialogueStates[node.id];
      if (!state) return true; // Include if state not loaded yet
      
      if (dialogueFilter === 'complete') return state.moveComplete;
      if (dialogueFilter === 'incomplete') return !state.moveComplete;
      return true;
    });
    
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filter edges to only include those between visible nodes
    const filteredEdges = graph.edges.filter(
      edge => filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
    );
    
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [graph, dialogueFilter, dialogueStates, deliberationId]);
  
  // Layout calculation with Dagre - use filtered graph
  const { nodePositions, graphBounds } = useDagreLayout(
    filteredGraph,
    LAYOUT_PRESETS[layoutPreset]
  );
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(.5);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // State for drag-to-zoom
  const [isZooming, setIsZooming] = useState(false);
  const [zoomStart, setZoomStart] = useState({ y: 0, initialZoom: 1 });
  
  // Focus state for scroll-to-pan control
  const [isFocused, setIsFocused] = useState(false);

  // Feature states
  const [activePath, setActivePath] = useState<ArgumentPath | null>(null);
  const { highlightedNodes, highlightedEdges } = usePathHighlight(activePath);
  const { searchResults, selectedResult, highlightedNodeIds, onSearchChange, onResultSelect } = 
    useGraphSearch(graph);
  
  // Legend state
  const [showLegend, setShowLegend] = useState(true);
  
  // Phase 3.1.4: Fetch dialogue states for all argument nodes (BATCH OPTIMIZED)
  useEffect(() => {
    if (!deliberationId) return;
    
    const fetchDialogueStates = async () => {
      // Filter for inference nodes (RA = regular argument)
      const argumentNodes = graph.nodes.filter(n => n.kind === 'RA');
      if (argumentNodes.length === 0) return;
      
      // Extract argument IDs from node.id (format: "RA:argumentId")
      const argumentIds = argumentNodes
        .map(node => node.id.split(':')[1])
        .filter(Boolean);
      
      if (argumentIds.length === 0) return;
      
      try {
        // Single batch request instead of N parallel requests
        const res = await fetch(
          `/api/deliberations/${deliberationId}/dialogue-state/batch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ argumentIds }),
          }
        );
        
        if (res.ok) {
          const data = await res.json();
          const states: Record<string, { moveComplete: boolean }> = {};
          
          // Map back to node IDs
          for (const node of argumentNodes) {
            const argumentId = node.id.split(':')[1];
            if (argumentId && data.states?.[argumentId]) {
              states[node.id] = { moveComplete: data.states[argumentId].moveComplete };
            }
          }
          
          setDialogueStates(states);
        }
      } catch (err) {
        console.error('Failed to fetch dialogue states:', err);
      }
    };
    
    fetchDialogueStates();
  }, [deliberationId, graph.nodes]);
  
  // Mouse down handler to differentiate between pan and zoom
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    
    // Set focus when clicking on the graph
    setIsFocused(true);
    
    if (e.shiftKey) {
      setIsZooming(true);
      setZoomStart({ y: e.clientY, initialZoom: zoom });
    } else {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }
  
  // Mouse move handler for both pan and zoom
  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (isZooming) {
      const deltaY = e.clientY - zoomStart.y;
      const newZoom = zoomStart.initialZoom - deltaY * 0.005; 
      setZoom(Math.max(0.2, Math.min(3, newZoom)));
    }
  }
  
  // Mouse up handler to reset both states
  function handleMouseUp() {
    setIsPanning(false);
    setIsZooming(false);
  }
  
  // Wheel handler for scroll-to-pan (only when focused)
  function handleWheel(e: React.WheelEvent) {
    if (!isFocused) return; // Allow parent scroll if not focused
    
    e.preventDefault();
    e.stopPropagation();
    
    // Scroll to pan: use deltaX and deltaY
    setPan(prev => ({
      x: prev.x - e.deltaX,
      y: prev.y - e.deltaY,
    }));
  }
  
  // Node click handler
  function handleNodeClickInternal(nodeId: string) {
    setSelectedNodeId(nodeId);
    onNodeClick?.(nodeId);
  }
  
  // Search result navigation
  function handleSearchResultSelect(result: any) {
    onResultSelect(result);
    setSelectedNodeId(result.node.id);
    
    const pos = nodePositions.get(result.node.id);
    if (pos) {
      setPan({
        x: -pos.x * zoom + (containerRef.current?.clientWidth || 800) / 2,
        y: -pos.y * zoom + (containerRef.current?.clientHeight || 600) / 2,
      });
    }
  }
  
  // Minimap navigation
  function handleMinimapNavigate(x: number, y: number) {
    setPan({
      x: -x * zoom + (containerRef.current?.clientWidth || 800) / 2,
      y: -y * zoom + (containerRef.current?.clientHeight || 600) / 2,
    });
  }
  
  // Calculate viewBox for minimap
  const viewBox = {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    width: (containerRef.current?.clientWidth || 800) / zoom,
    height: (containerRef.current?.clientHeight || 600) / zoom,
  };
  
  // Auto-center on mount - prioritize selected node, otherwise center on graph
  useEffect(() => {
    if (containerRef.current && nodePositions.size > 0) {
      // If there's an initially selected node, center on it
      if (initialSelectedNodeId) {
        const selectedPos = nodePositions.get(initialSelectedNodeId);
        if (selectedPos) {
          setPan({
            x: -selectedPos.x + containerRef.current.clientWidth / 2,
            y: -selectedPos.y + containerRef.current.clientHeight / 2,
          });
          return;
        }
      }
      
      // Otherwise, center on the entire graph
      const centerX = (graphBounds.minX + graphBounds.maxX) / 2;
      const centerY = (graphBounds.minY + graphBounds.maxY) / 2;
      
      setPan({
        x: -centerX + containerRef.current.clientWidth / 2,
        y: -centerY + containerRef.current.clientHeight / 2,
      });
    }
  }, [graphBounds, nodePositions.size, initialSelectedNodeId, nodePositions]);
  
  // Get unique edge roles for markers
  const uniqueEdgeRoles = Array.from(new Set(filteredGraph.edges.map(e => e.role)));
  
  // Click outside handler to unfocus
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div 
      className={`relative w-full h-full border-2 ${isFocused ? 'border-indigo-600 shadow-lg' : 'border-indigo-500'} bg-gray-50 transition-all ${className}`} 
      ref={containerRef}
    >
      {/* Focus indicator overlay */}
      {isFocused && (
        <div className="absolute top-2 right-2 z-50 bg-indigo-600 text-white text-xs px-2 py-1 rounded-md shadow-md flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Scroll active
        </div>
      )}
      
      {/* Top Controls */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
        <div className="w-80">
          <AifDiagramSearch
            graph={graph}
            onResultSelect={handleSearchResultSelect}
            onSearchChange={onSearchChange}
          />
        </div>
        
        <AifDiagramExportMenu svgRef={svgRef} graph={graph} />
        
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))}
            className="text-gray-600 hover:text-gray-900"
            title="Zoom out"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          
          <span className="text-sm font-medium text-gray-700 min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          
          <button
            onClick={() => setZoom((z) => Math.min(3, z * 1.25))}
            className="text-gray-600 hover:text-gray-900"
            title="Zoom in"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="ml-2 text-xs text-gray-500 hover:text-gray-700"
            title="Reset view"
          >
            Reset
          </button>
        </div>
        
        {/* Phase 3.1.4: Dialogue State Filter */}
        {deliberationId && (
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
            <label className="text-xs font-medium text-gray-700">
              Dialogue:
            </label>
            <select
              value={dialogueFilter}
              onChange={(e) => setDialogueFilter(e.target.value as 'all' | 'complete' | 'incomplete')}
              className="text-xs border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              title="Filter arguments by dialogue completion status"
            >
              <option value="all">All Arguments</option>
              <option value="complete">Complete (all attacks answered)</option>
              <option value="incomplete">Incomplete (pending attacks)</option>
            </select>
          </div>
        )}
      </div>
      
      {selectedNodeId && (
        <div className="absolute left-4 top-[120px] z-20">
          <AifPathHighlighter
            graph={graph}
            selectedNodeId={selectedNodeId}
            onPathSelect={setActivePath}
          />
        </div>
      )}
      
      {/* Main SVG */}
      <svg
        ref={svgRef}
        className="relative rounded-xl w-full h-full cursor-move select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <defs>
          {/* Create markers for each edge role */}
          {uniqueEdgeRoles.map(role => {
            const style = getEdgeStyle(role);
            return (
              <marker
                key={role}
                id={`arrow-${role}`}
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill={style.markerColor} />
              </marker>
            );
          })}
          
          {/* Highlighted marker */}
          <marker
            id="arrowhead-highlighted"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
          </marker>
        </defs>
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges with role-based styling */}
          {/* Old single-pass edge rendering - now using split rendering below for CA node layering */}
          
          {/* Edges NOT connected to CA nodes - render first (under everything) */}
          {filteredGraph.edges
            .filter(edge => {
              const fromNode = filteredGraph.nodes.find(n => n.id === edge.from);
              const toNode = filteredGraph.nodes.find(n => n.id === edge.to);
              return fromNode?.kind !== 'CA' && toNode?.kind !== 'CA';
            })
            .map((edge) => {
              const from = nodePositions.get(edge.from);
              const to = nodePositions.get(edge.to);
              if (!from || !to) return null;
              
              const isHighlighted = highlightedEdges.has(edge.id);
              const opacity = activePath && !isHighlighted ? 0.2 : 1;
              const style = getEdgeStyle(edge.role);
              
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;

              const commonLineProps = {
                stroke: isHighlighted ? '#3b82f6' : style.stroke,
                strokeWidth: isHighlighted ? style.strokeWidth + 1 : style.strokeWidth,
                strokeDasharray: isHighlighted ? undefined : style.strokeDasharray,
                strokeOpacity: opacity,
                className: 'transition-all',
              };
              
              return (
                <g key={edge.id}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={midX}
                    y2={midY}
                    markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : `url(#arrow-${edge.role})`}
                    {...commonLineProps}
                  />
                  <line
                    x1={midX}
                    y1={midY}
                    x2={to.x}
                    y2={to.y}
                    {...commonLineProps}
                  />
                </g>
              );
            })}
          
          
          
          {/* Edges connected TO CA nodes (conflictingElement) - render before CA nodes */}
          {filteredGraph.edges
            .filter(edge => {
              const toNode = filteredGraph.nodes.find(n => n.id === edge.to);
              return toNode?.kind === 'CA' && (edge.role === 'conflictingElement' || edge.role === 'conflictedElement');
            })
            .map((edge) => {
              const from = nodePositions.get(edge.from);
              const to = nodePositions.get(edge.to);
              if (!from || !to) return null;
              
              const isHighlighted = highlightedEdges.has(edge.id);
              const opacity = activePath && !isHighlighted ? 0.2 : 1;
              const style = getEdgeStyle(edge.role);
              
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;

              const commonLineProps = {
                stroke: isHighlighted ? '#3b82f6' : style.stroke,
                strokeWidth: isHighlighted ? style.strokeWidth + 1 : style.strokeWidth,
                strokeDasharray: isHighlighted ? undefined : style.strokeDasharray,
                strokeOpacity: opacity,
                className: 'transition-all',
              };
              
              return (
                <g key={edge.id}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={midX}
                    y2={midY}
                    markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : `url(#arrow-${edge.role})`}
                    {...commonLineProps}
                  />
                  <line
                    x1={midX}
                    y1={midY}
                    x2={to.x}
                    y2={to.y}
                    {...commonLineProps}
                  />
                </g>
              );
            })}
          
      
          
          {/* Edges FROM CA nodes (conflictedElement) - render after CA nodes */}
          {filteredGraph.edges
            .filter(edge => {
              const fromNode = filteredGraph.nodes.find(n => n.id === edge.from);
              return fromNode?.kind === 'CA' && (edge.role === 'conflictingElement' || edge.role === 'conflictedElement');
            })
            .map((edge) => {
              const from = nodePositions.get(edge.from);
              const to = nodePositions.get(edge.to);
              if (!from || !to) return null;
              
              const isHighlighted = highlightedEdges.has(edge.id);
              const opacity = activePath && !isHighlighted ? 0.2 : 1;
              const style = getEdgeStyle(edge.role);
              
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;

              const commonLineProps = {
                stroke: isHighlighted ? '#3b82f6' : style.stroke,
                strokeWidth: isHighlighted ? style.strokeWidth + 1 : style.strokeWidth,
                strokeDasharray: isHighlighted ? undefined : style.strokeDasharray,
                strokeOpacity: opacity,
                className: 'transition-all z-[10]',
              };
              
              return (
                <g key={edge.id}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={midX}
                    y2={midY}
                    markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : `url(#arrow-${edge.role})`}
                    {...commonLineProps}
                  />
                  <line
                    x1={midX}
                    y1={midY}
                    x2={to.x}
                    y2={to.y}
                    {...commonLineProps}
                  />
                </g>
              );
            })}
            {/* Phase D-1: Contrary overlay edges (rose, dashed) — only when both endpoints are visible. */}
            <ContraryOverlayEdges
              deliberationId={deliberationId}
              nodePositions={nodePositions}
            />
            {/* Nodes - render non-CA nodes first, then CA nodes so CA appears on top */}
          {filteredGraph.nodes
            .filter(node => node.kind !== 'CA') // Render RA, I, PA nodes first
            .map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            
            const isSelected = selectedNodeId === node.id;
            const isHighlighted = highlightedNodes.has(node.id);
            const isSearchMatch = highlightedNodeIds.has(node.id);
            const isSearchSelected = selectedResult?.node.id === node.id;
            const opacity = activePath && !isHighlighted ? 0.3 : 1;
            
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - pos.width / 2}, ${pos.y - pos.height / 2})`}
                opacity={opacity}
                onClick={() => handleNodeClickInternal(node.id)}
                className="cursor-pointer transition-all"
              >
                {(isSelected || isSearchSelected) && (
                  <rect
                    x={-4} y={-4}
                    width={pos.width + 8}
                    height={pos.height + 8}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    rx={6}
                    className="animate-pulse"
                  />
                )}
                
                {isSearchMatch && !isSearchSelected && (
                  <rect
                    x={-2} y={-2}
                    width={pos.width + 4}
                    height={pos.height + 4}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth={2}
                    rx={6}
                  />
                )}
                
                <ZoomAwareAifNode
                  node={node}
                  width={pos.width}
                  height={pos.height}
                  isHovered={isSelected}
                  zoomLevel={zoom}
                />
              </g>
            );
          })}
                {/* CA Nodes - render after incoming edges, before outgoing edges */}
          {filteredGraph.nodes
            .filter(node => node.kind === 'CA')
            .map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            
            const isSelected = selectedNodeId === node.id;
            const isHighlighted = highlightedNodes.has(node.id);
            const isSearchMatch = highlightedNodeIds.has(node.id);
            const isSearchSelected = selectedResult?.node.id === node.id;
            const opacity = activePath && !isHighlighted ? 0.3 : 1;
            
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - pos.width / 2}, ${pos.y - pos.height / 2})`}
                opacity={opacity}
                onClick={() => handleNodeClickInternal(node.id)}
                className="cursor-pointer transition-all"
              >
                {(isSelected || isSearchSelected) && (
                  <rect
                    x={-4} y={-4}
                    width={pos.width + 8}
                    height={pos.height + 8}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    rx={6}
                    className="animate-pulse z-[1000]"
                  />
                )}
                
                {isSearchMatch && !isSearchSelected && (
                  <rect
                    x={-2} y={-2}
                    width={pos.width + 4}
                    height={pos.height + 4}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth={2}
                    className='z-[1000]'
                    rx={6}
                  />
                )}
                
                <ZoomAwareAifNode
                  node={node}
                  width={pos.width}
                  height={pos.height}
                  isHovered={isSelected}
                  zoomLevel={zoom}
                />
              </g>
            );
          })}
        </g>
      </svg>
      
      <AifDiagramMinimap
        graph={graph}
        viewBox={viewBox}
        graphBounds={graphBounds}
        onNavigate={handleMinimapNavigate}
      />
      
      {/* Collapsible Legend */}
<div className='absolute bottom-4 left-[200px] '>     {/* Controls info */}
      <div className=" bg-white/35 border border-indigo-300 rounded-lg px-3 py-2 text-xs backdrop-blur-md text-gray-600">
        <div className="font-semibold mb-1">Controls:</div>
        <div>• Click graph to focus</div>
        <div>• Drag to pan</div>
        <div>• Scroll to pan (when focused)</div>
        <div>• Shift + Drag to zoom</div>
        <div>• Click node to select</div>
      </div>
      </div>
      <div className="absolute bottom-4 left-4 bg-white/35 backdrop-blur-lg border border-indigo-500 rounded-lg shadow-lg text-xs max-w-xs">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 rounded-t-lg transition-colors"
        >
          <span className="font-semibold text-slate-700">Legend</span>
          <svg
            className={`w-4 h-4 text-slate-600 transition-transform ${showLegend ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showLegend && (
          <div className="px-3 pb-3 space-y-3 rounded-xl">
            {/* Node Types */}
            <div>
              <div className="font-semibold mb-2 text-slate-700">Node Types</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border-2 border-amber-500 bg-amber-50" />
                  <span>I-Node (Statement)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-sky-500 bg-sky-50" />
                  <span>RA-Node (Argument)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-red-50" />
                  <span>CA-Node (Conflict)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-green-500 bg-green-50" />
                  <span>PA-Node (Preference)</span>
                </div>
              </div>
            </div>

            {/* Edge Connections */}
            <div className="pt-2 border-t border-slate-200">
              <div className="font-semibold mb-2 text-slate-700">Edge Connections</div>
              <div className="space-y-1">
                <LegendEdge color="#64748b" label="Premise (I → RA)" />
                <LegendEdge color="#059669" label="Conclusion (RA → I)" />
                <LegendEdge color="#ef4444" label="Conflicting element" />
                <LegendEdge color="#dc2626" label="Conflicted element" />
                <LegendEdge color="#8b5cf6" dash="8,4" label="Preferred element" />
                <LegendEdge color="#6b7280" dash="6,3" label="Dispreferred element" />
                <LegendEdge color="#94a3b8" label="Other / default" />
              </div>
            </div>
          </div>
        )}
        
      </div>
      
 {/* Stats */}
      <div className="absolute top-24 right-2 bg-white/50 backdrop-blur-md border border-gray-300 rounded-lg px-4 py-2 text-xs">
        <div className="font-semibold text-gray-900">{filteredGraph.nodes.length} nodes</div>
        <div className="text-gray-500">{filteredGraph.edges.length} edges</div>
        {dialogueFilter !== 'all' && (
          <div className="text-indigo-600 mt-1">Filtered: {dialogueFilter}</div>
        )}
        <div className="text-blue-600 mt-1">Dagre layout</div>
      </div>
      
     
    </div>
  );
}

// ---------------- Contrary Overlay Edges (Phase D-1) ----------------
/**
 * Renders dashed rose lines between every pair of I-nodes that are explicit
 * contraries within the current deliberation, when both endpoints are present
 * in the layout. Symmetric pairs render with double arrows (markerStart +
 * markerEnd); asymmetric pairs render with a single arrow (claim → contrary).
 *
 * Note: kept deliberately simple (per-pair straight line, no routing). The
 * Dagre layout does not place these in the graph; they are a pure visual
 * overlay on top of the existing AIF wiring.
 */
function ContraryOverlayEdges({
  deliberationId,
  nodePositions,
}: {
  deliberationId?: string;
  nodePositions: Map<string, { x: number; y: number; width: number; height: number }>;
}) {
  const { pairs } = useDeliberationContraries(deliberationId, !!deliberationId);
  if (!deliberationId || pairs.length === 0) return null;

  const ROSE = '#e11d48';

  return (
    <g data-layer="contrary-overlay" pointerEvents="none">
      <defs>
        <marker
          id="contrary-arrow-end"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ROSE} />
        </marker>
      </defs>
      {pairs.map((p) => {
        const fromId = `I:${p.claimId}`;
        const toId = `I:${p.contraryId}`;
        const from = nodePositions.get(fromId);
        const to = nodePositions.get(toId);
        if (!from || !to) return null;
        return (
          <g key={`contrary:${p.id}`}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={ROSE}
              strokeWidth={1.5}
              strokeDasharray="6,4"
              strokeOpacity={0.7}
              markerEnd="url(#contrary-arrow-end)"
              markerStart={p.isSymmetric ? 'url(#contrary-arrow-end)' : undefined}
            >
              <title>
                {p.isSymmetric ? 'Symmetric contrary (mutual)' : 'One-way contrary'}
                {p.reason ? ` — ${p.reason}` : ''}
              </title>
            </line>
          </g>
        );
      })}
    </g>
  );
}