/**
 * AIF Diagram Viewer - Complete with All Features
 * 
 * Integrates:
 * - Semantic zoom
 * - Minimap
 * - Path highlighting
 * - Search
 * - Export (SVG/PNG)
 * - Neighborhood expansion
 */

'use client';

import { useRef, useState } from 'react';
import type { AifSubgraph } from '@/lib/arguments/diagram';
import { AifDiagramMinimap, useGraphBounds } from './Aifdiagramminimap';
import { AifPathHighlighter, usePathHighlight, type ArgumentPath } from './Aifpathhighlighter';
import { AifDiagramSearch, useGraphSearch } from './Aifdiagramsearch';
import { AifDiagramExportMenu } from './Aifdiagramexport';
import { ZoomAwareAifNode } from './Enhancedaifnodes';

export function AifDiagramViewerComplete({
  initialGraph,
  onNodeClick,
  className = '',
}: {
  initialGraph: AifSubgraph;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Graph state
  const [graph, setGraph] = useState(initialGraph);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Feature states
  const [activePath, setActivePath] = useState<ArgumentPath | null>(null);
  const { highlightedNodes, highlightedEdges } = usePathHighlight(activePath);
  const { searchResults, selectedResult, highlightedNodeIds, onSearchChange, onResultSelect } = 
    useGraphSearch(graph);
  
  // Layout (simple grid for demo - replace with proper layout)
  const nodePositions = new Map<string, { x: number; y: number }>();
  graph.nodes.forEach((node, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    nodePositions.set(node.id, {
      x: col * 200 + 100,
      y: row * 150 + 100,
    });
  });
  
  const graphBounds = useGraphBounds(graph, nodePositions);
  
  // Zoom handlers
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.max(0.2, Math.min(3, prev * delta)));
  }
  
  // Pan handlers
  function handleMouseDown(e: React.MouseEvent) {
    if (e.button === 0 && e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }
  
  function handleMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }
  
  function handleMouseUp() {
    setIsPanning(false);
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
    
    // Pan to node
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
  
  return (
    <div className={`relative  ${className}`} ref={containerRef}>
      {/* Top Controls Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
     
        {/* Search */}
        <div className="w-80">
          <AifDiagramSearch
            graph={graph}
            onResultSelect={handleSearchResultSelect}
            onSearchChange={onSearchChange}
          />
        </div>
        
        {/* Export */}
        <AifDiagramExportMenu svgRef={svgRef} graph={graph} />
        
        {/* Zoom Controls */}
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
      </div>
      
      {/* Path Highlighter */}
      {selectedNodeId && (
        <AifPathHighlighter
          graph={graph}
          selectedNodeId={selectedNodeId}
          onPathSelect={setActivePath}
        />
      )}
      
      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          {/* Arrow markers for edges */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
          </marker>
        </defs>
        
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {graph.edges.map((edge) => {
            const from = nodePositions.get(edge.from);
            const to = nodePositions.get(edge.to);
            if (!from || !to) return null;
            
            const isHighlighted = highlightedEdges.has(edge.id);
            const isSearchMatch = false; // Could add edge search
            const opacity = activePath && !isHighlighted ? 0.2 : 1;
            
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={isHighlighted ? '#3b82f6' : '#64748b'}
                strokeWidth={isHighlighted ? 3 : 2}
                strokeOpacity={opacity}
                markerEnd="url(#arrowhead)"
                className="transition-all"
              />
            );
          })}
          
          {/* Nodes */}
          {graph.nodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            
            const isSelected = selectedNodeId === node.id;
            const isHighlighted = highlightedNodes.has(node.id);
            const isSearchMatch = highlightedNodeIds.has(node.id);
            const isSearchSelected = selectedResult?.node.id === node.id;
            
            const opacity = activePath && !isHighlighted ? 0.3 : 1;
            
            // Node dimensions
            const width = node.kind === 'I' ? 180 : 100;
            const height = node.kind === 'I' ? 60 : 50;
            
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - width / 2}, ${pos.y - height / 2})`}
                opacity={opacity}
                onClick={() => handleNodeClickInternal(node.id)}
                className="cursor-pointer transition-all"
              >
                {/* Selection ring */}
                {(isSelected || isSearchSelected) && (
                  <rect
                    x={-4}
                    y={-4}
                    width={width + 8}
                    height={height + 8}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    rx={node.kind === 'I' ? 6 : width / 2}
                    className="animate-pulse"
                  />
                )}
                
                {/* Search match ring */}
                {isSearchMatch && !isSearchSelected && (
                  <rect
                    x={-2}
                    y={-2}
                    width={width + 4}
                    height={height + 4}
                    fill="none"
                    stroke="#eab308"
                    strokeWidth={2}
                    rx={node.kind === 'I' ? 6 : width / 2}
                  />
                )}
                
                {/* Node content */}
                <ZoomAwareAifNode
                  node={node}
                  width={width}
                  height={height}
                  isHovered={isSelected}
                  zoomLevel={zoom}
                />
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* Minimap */}
      <AifDiagramMinimap
        graph={graph}
        viewBox={viewBox}
        graphBounds={graphBounds}
        onNavigate={handleMinimapNavigate}
      />
      
      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-600 max-w-xs">
        <div className="font-semibold mb-1">Controls:</div>
        <div>• Scroll to zoom</div>
        <div>• Shift + drag to pan</div>
        <div>• Click node to select</div>
        <div>• Search to find nodes</div>
      </div>
      
      {/* Stats */}
      <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-lg px-4 py-2 text-xs text-gray-600">
        <div className="font-semibold">{graph.nodes.length} nodes</div>
        <div className="text-gray-500">{graph.edges.length} edges</div>
        {searchResults.length > 0 && (
          <div className="text-blue-600 mt-1">
            {searchResults.length} matches
          </div>
        )}
      </div>
    </div>
  );
}