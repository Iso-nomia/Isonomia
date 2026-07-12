//components/map/AifDiagramView.tsx

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { AifSubgraph, AifNode, AifEdge, AifNodeKind, AifEdgeRole } from '@/lib/arguments/diagram';

// ---------------- Types ----------------
type LayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutEdge = {
  id: string;
  source: string;
  target: string;
  sections?: Array<{
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints?: Array<{ x: number; y: number }>;
  }>;
};

type ComputedLayout = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
};


// ---------------- ELK Configuration ----------------
const elk = new ELK();

const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.layered.spacing.edgeNodeBetweenLayers': '60',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.edgeRouting': 'ORTHOGONAL',
};

// ---------------- Node Dimensions ----------------
export function getNodeDimensions(kind: AifNodeKind): { width: number; height: number } {
  switch (kind) {
    case 'I':
      return { width: 180, height: 60 };
    case 'RA':
      return { width: 100, height: 50 };
    case 'CA':
      return { width: 80, height: 50 };
    case 'PA':
      return { width: 80, height: 50 };
    default:
      return { width: 120, height: 60 };
  }
}

// ---------------- Edge Styling ----------------
export function getEdgeStyle(role: AifEdgeRole): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  markerColor: string;
} {
  switch (role) {
    case 'premise':
      return { stroke: '#64748b', strokeWidth: 2, markerColor: '#64748b' };
    case 'conclusion':
      return { stroke: '#059669', strokeWidth: 2, markerColor: '#059669' };
    case 'conflictingElement':
      return { stroke: '#ef4444', strokeWidth: 2.5, markerColor: '#ef4444' };
    case 'conflictedElement':
      return { stroke: '#dc2626', strokeWidth: 2, markerColor: '#dc2626' };
    case 'preferredElement':
      return { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '8,4', markerColor: '#8b5cf6' };
    case 'dispreferredElement':
      return { stroke: '#6b7280', strokeWidth: 1.5, strokeDasharray: '6,3', markerColor: '#6b7280' };
    default:
      return { stroke: '#94a3b8', strokeWidth: 1.5, markerColor: '#94a3b8' };
  }
}

// ---------------- Main Component ----------------
export default function AifDiagramView({
  aif,
  className,
  onNodeClick,
  showMinimap = false,
}: {
  aif: AifSubgraph;
  className?: string;
  onNodeClick?: (node: AifNode) => void;
  showMinimap?: boolean;
}) {
  const [layout, setLayout] = useState<ComputedLayout | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan & Zoom state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1000, height: 1000 });
  const [isPanning, setIsPanning] = useState(false);
   const [isZooming, setIsZooming] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Compute layout with ELK
  useEffect(() => {
    async function computeLayout() {
      if (!aif.nodes.length) {
        setLayout(null);
        return;
      }
      const elkGraph = {
        id: 'root',
        layoutOptions: ELK_OPTIONS,
        children: aif.nodes.map(n => {
          const dims = getNodeDimensions(n.kind);
          return { id: n.id, width: dims.width, height: dims.height };
        }),
        edges: aif.edges.map(e => ({ id: e.id, sources: [e.from], targets: [e.to] })),
      };

      try {
        const laid = await elk.layout(elkGraph);
        const nodes: LayoutNode[] = (laid.children || []).map(n => ({
          id: n.id,
          x: n.x || 0,
          y: n.y || 0,
          width: n.width || 0,
          height: n.height || 0,
        }));
        const edges: LayoutEdge[] = (laid.edges || []).map((e: any) => ({
          id: e.id,
          source: e.sources[0],
          target: e.targets[0],
          sections: e.sections,
        }));

        const maxX = Math.max(...nodes.map(n => n.x + n.width), 0);
        const maxY = Math.max(...nodes.map(n => n.y + n.height), 0);
        const computedLayout = { nodes, edges, width: maxX + 80, height: maxY + 80 };
        setLayout(computedLayout);

        // **MODIFIED** Set a more zoomed-out initial view
        const baseWidth = computedLayout.width;
        const baseHeight = computedLayout.height;
        const zoomOutFactor = 2; // 20% more zoomed out

        const zoomedWidth = baseWidth * zoomOutFactor;
        const zoomedHeight = baseHeight * zoomOutFactor;

        const newX = -40 - (zoomedWidth - baseWidth) / 2;
        const newY = -40 - (zoomedHeight - baseHeight) / 2;
        setViewBox({ x: newX, y: newY, width: zoomedWidth, height: zoomedHeight });

      } catch (error) {
        console.error('ELK layout error:', error);
        setLayout(null);
      }
    }
    computeLayout();
  }, [aif]);

  // Pan handlers
     const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
     if (e.button !== 0) return; // Only for left click
 
     if (e.shiftKey) {
       setIsZooming(true);
     } else {
       setIsPanning(true);
     }
     setPanStart({ x: e.clientX, y: e.clientY });
     e.preventDefault();
   }, []);
 
   const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
     if (isPanning) {
       const dx = (panStart.x - e.clientX) * (viewBox.width / (containerRef.current?.clientWidth || 1));
       const dy = (panStart.y - e.clientY) * (viewBox.height / (containerRef.current?.clientHeight || 1));
       setViewBox(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
       setPanStart({ x: e.clientX, y: e.clientY });
     } else if (isZooming) {
       const dy = e.clientY - panStart.y;
       const scaleFactor = 1 + dy * 0.005; // Drag down to zoom out, up to zoom in
       const svg = svgRef.current;
       if (!svg) return;
       const pt = svg.createSVGPoint();
       pt.x = e.clientX;
       pt.y = e.clientY;
       const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
       setViewBox(prev => {
         const newWidth = prev.width * scaleFactor;
         const newHeight = prev.height * scaleFactor;
         const newX = svgP.x - (svgP.x - prev.x) * scaleFactor;
         const newY = svgP.y - (svgP.y - prev.y) * scaleFactor;
         return { x: newX, y: newY, width: newWidth, height: newHeight };
       });
       setPanStart({ x: e.clientX, y: e.clientY });
     }
  }, [isPanning, isZooming, panStart, viewBox]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsZooming(false);
  }, []);


  // Reset view to the zoomed-out default
  const resetView = useCallback(() => {
    if (layout) {
        const baseWidth = layout.width;
        const baseHeight = layout.height;
        const zoomOutFactor = 2;

        const zoomedWidth = baseWidth * zoomOutFactor;
        const zoomedHeight = baseHeight * zoomOutFactor;

        const newX = -40 - (zoomedWidth - baseWidth) / 2;
        const newY = -40 - (zoomedHeight - baseHeight) / 2;
        setViewBox({ x: newX, y: newY, width: zoomedWidth, height: zoomedHeight });
    }
  }, [layout]);

  if (!layout) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-64 text-sm text-slate-500">
          {aif.nodes.length === 0 ? 'No AIF graph data' : 'Computing layout...'}
        </div>
      </div>
    );
  }
  const nodeById = new Map(aif.nodes.map(n => [n.id, n]));
  const edgeById = new Map(aif.edges.map(e => [e.id, e]));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* **MODIFIED** Controls UI */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={resetView}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium hover:bg-slate-50 shadow-sm"
        >
          Reset View
        </button>
        <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 shadow-sm">
           Drag to pan • Shift+Drag to zoom
        </div>
      </div>

      {/* **MODIFIED** Main SVG */}
      <svg
        ref={svgRef}
        className="w-full h-full border border-slate-200 rounded-lg bg-slate-50"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : isZooming ? 'ns-resize' : 'grab' }}
      >
        {/* ... (The rest of your SVG content (defs, g.edges, g.nodes, etc.) remains the same) ... */}
         {/* Grid background */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
          </pattern>
          
          {/* Arrow markers for different edge types */}
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
          {layout.edges.map(edge => {
            const aifEdge = edgeById.get(edge.id);
            if (!aifEdge) return null;

            const sourceNode = layout.nodes.find(n => n.id === edge.source);
            const targetNode = layout.nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const style = getEdgeStyle(aifEdge.role);
            const isHovered = hoveredEdge === edge.id;

            // Use ELK's routing if available, otherwise straight line
            let pathD: string;
            if (edge.sections && edge.sections[0]) {
              const section = edge.sections[0];
              const bendPoints = section.bendPoints || [];
              pathD = `M ${section.startPoint.x} ${section.startPoint.y} ${
                bendPoints.map(p => `L ${p.x} ${p.y}`).join(' ')
              } L ${section.endPoint.x} ${section.endPoint.y}`;
            } else {
              const x1 = sourceNode.x + sourceNode.width / 2;
              const y1 = sourceNode.y + sourceNode.height;
              const x2 = targetNode.x + targetNode.width / 2;
              const y2 = targetNode.y;
              pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
            }

            return (
              <g key={edge.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={isHovered ? style.strokeWidth + 1 : style.strokeWidth}
                  strokeDasharray={style.strokeDasharray}
                  markerEnd={`url(#arrow-${aifEdge.role})`}
                  onMouseEnter={() => setHoveredEdge(edge.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  className="transition-all duration-150"
                  opacity={hoveredEdge && !isHovered ? 0.3 : 1}
                />
                
                {/* Edge label */}
                {isHovered && (
                  <text
                    x={(sourceNode.x + targetNode.x) / 2}
                    y={(sourceNode.y + targetNode.y) / 2}
                    className="text-xs font-medium pointer-events-none"
                    fill={style.stroke}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {aifEdge.role}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {layout.nodes.map(node => {
            const aifNode = nodeById.get(node.id);
            if (!aifNode) return null;

            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => onNodeClick?.(aifNode)}
                className="cursor-pointer"
                opacity={hoveredNode && !isHovered ? 0.5 : 1}
              >
                <AifNodeSvg
                  node={aifNode}
                  width={node.width}
                  height={node.height}
                  isHovered={isHovered}
                />
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* ... (Your Minimap and Legend JSX remain the same) ... */}
       {/* Minimap */}
      {showMinimap && layout && (
        <div className="absolute bottom-4 right-4 w-48 h-32 bg-white border-2 border-slate-300 rounded-lg shadow-lg overflow-hidden">
          <svg
            className="w-full h-full"
            viewBox={`-40 -40 ${layout.width} ${layout.height}`}
          >
            <rect x={-40} y={-40} width={layout.width} height={layout.height} fill="#f8fafc" />
            {layout.nodes.map(node => {
              const aifNode = nodeById.get(node.id);
              if (!aifNode) return null;
              return (
                <rect
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  fill={getNodeColor(aifNode.kind)}
                  opacity={0.7}
                />
              );
            })}
            {/* Viewport indicator */}
            <rect
              x={viewBox.x}
              y={viewBox.y}
              width={viewBox.width}
              height={viewBox.height}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
            />
          </svg>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
        <div className="font-semibold mb-2 text-slate-700">Node Types</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-[#3b82f6ff] bg-sky-50" />
            <span>I-Node (Statement)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-green-500 bg-green-50" />
            <span>RA-Node (Argument)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-red-500 bg-red-50" />
            <span>CA-Node (Conflict)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-purple-500 bg-purple-50" />
            <span>PA-Node (Preference)</span>
          </div>
        </div>
              {/* Edge Connections */}
<div className="mt-3">
  <div className="font-semibold mb-2 text-slate-700">Edge Connections</div>
  <div className="space-y-1">
    <LegendEdge color="#64748b" label="Premise (I → RA)" />
    <LegendEdge color="#059669" label="Conclusion (RA → I)" />
    <LegendEdge color="#ef4444" label="Conflicting element (attacker → CA)" />
    <LegendEdge color="#dc2626" label="Conflicted element (CA → target)" />
    <LegendEdge color="#8b5cf6" dash="8,4" label="Preferred element (preferred → PA)" />
    <LegendEdge color="#6b7280" dash="6,3" label="Dispreferred element (PA → dispreferred)" />
    <LegendEdge color="#94a3b8" label="Other / default" />
  </div>
</div>
      </div>


    </div>
  );
}

// ... (Your Node Rendering Components and getNodeColor helper function remain the same) ...
// ---------------- Node Rendering Components ----------------
export function AifNodeSvg({
  node,
  width,
  height,
  isHovered,
}: {
  node: AifNode;
  width: number;
  height: number;
  isHovered: boolean;
}) {
  const scale = isHovered ? 1 : 1;
  const shadowOpacity = isHovered ? 0.3 : 0.1;

  return (
    <g className="transition-transform duration-150" style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
      {/* Shadow */}
      <rect
        x={2}
        y={2}
        width={width}
        height={height}
        rx={node.kind === 'I' ? 8 : width / 2}
        fill="#000"
        opacity={shadowOpacity}
      />
      
      {node.kind === 'I' && <INodeContent node={node} width={width} height={height} />}
      {node.kind === 'RA' && <RANodeContent node={node} width={width} height={height} />}
      {node.kind === 'CA' && <CANodeContent node={node} width={width} height={height} />}
      {node.kind === 'PA' && <PANodeContent node={node} width={width} height={height} />}
    </g>
  );
}

function INodeContent({ node, width, height }: { node: AifNode; width: number; height: number }) {
  const label = node.label || node.id;
  const truncated = label.length > 40 ? label.slice(0, 37) + '...' : label;

  return (
    <>
      <rect width={width} height={height} rx="8" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
      <foreignObject x={8} y={8} width={width - 16} height={height - 16}>
        <div className="flex items-center justify-center h-full text-xs text-slate-800 text-center px-2">
          {truncated}
        </div>
      </foreignObject>
    </>
  );
}

function RANodeContent({ node, width, height }: { node: AifNode; width: number; height: number }) {
  const label = node.label || 'RA';
  const truncated = label.length > 20 ? label.slice(0, 17) + '...' : label;

  return (
    <>
      <ellipse cx={width / 2} cy={height / 2} rx={width / 2 + 20} ry={height / 2 + 10} fill="#f0fdf4" stroke="#10b981" strokeWidth="2.5" />
      <text
        x={width / 2}
        y={height / 2}
        className="text-xs font-semibold"
        fill="#064e3b"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {truncated}
      </text>
    </>
  );
}

function CANodeContent({ node, width, height }: { node: AifNode; width: number; height: number }) {
  return (
    <>
      <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="#fef2f2" stroke="#ef4444" strokeWidth="2.5" />
      <text
        x={width / 2}
        y={height / 2}
        className="text-xs font-bold"
        fill="#7f1d1d"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        CA
      </text>
      {node.schemeKey && (
        <text
          x={width / 2}
          y={height / 2 + 12}
          className="text-[9px]"
          fill="#991b1b"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {node.schemeKey}
        </text>
      )}
    </>
  );
}

function PANodeContent({ node, width, height }: { node: AifNode; width: number; height: number }) {
  return (
    <>
      <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill="#faf5ff" stroke="#8b5cf6" strokeWidth="2.5" />
      <text
        x={width / 2}
        y={height / 2}
        className="text-xs font-bold"
        fill="#4c1d95"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        PA
      </text>
      {node.schemeKey && (
        <text
          x={width / 2}
          y={height / 2 + 12}
          className="text-[9px]"
          fill="#5b21b6"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {node.schemeKey}
        </text>
      )}
    </>
  );
}

// Helper function for minimap colors
export function getNodeColor(kind: AifNodeKind): string {
  switch (kind) {
    case 'I': return '#3b82f6ff';
    case 'RA': return '#10b981';
    case 'CA': return '#ef4444';
    case 'PA': return '#8b5cf6';
    default: return '#64748b';
  }
}
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
        {/* line */}
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
        {/* simple arrowhead */}
        <path d="M44 6 L52 2 L52 10 Z" fill={color} />
      </svg>
      <span className="text-xs">{label}</span>
    </div>
  );
}