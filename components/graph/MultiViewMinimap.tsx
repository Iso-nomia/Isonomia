// components/graph/MultiViewMinimap.tsx
'use client';

import { useState, useMemo, useRef } from 'react';
import { useCegData } from './useCegData';
import type { CegNode, CegEdge } from './useCegData';
import type { ViewMode, VisualEncoding } from '@/lib/client/graph/visualDesignSystem';
import { VisualScales, ColorPalettes } from '@/lib/client/graph/visualDesignSystem';

// Layout algorithms for different views
import { 
  useHierarchicalLayout,
  usePolarizedLayout,
  useGroundedLayout,
  useTemporalLayout,
  useFocusLayout,
} from '@/components/graph/layouts';


interface MultiViewMinimapProps {
  deliberationId: string;
  selectedClaimId?: string | null;
  onSelectClaim?: (claimId: string) => void;
  width?: number;
  height?: number;
  defaultView?: ViewMode;
}

export function MultiViewMinimap({
  deliberationId,
  selectedClaimId,
  onSelectClaim,
  width = 320,
  height = 280,
  defaultView = 'structural',
}: MultiViewMinimapProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [visualEncoding, setVisualEncoding] = useState<VisualEncoding>({
    nodeSize: 'byApprovals',
    nodeColor: 'byStatus',
    nodeShape: 'circle',
    edgeThickness: 'byConfidence',
    edgeStyle: 'curved',
    edgeEmphasis: 'all',
    spacing: 'comfortable',
    grouping: true,
    showLabels: 'hover',
  });

  const { nodes, edges, stats, loading } = useCegData(deliberationId);

  // Calculate node degrees (connections)
  const nodeDegrees = useMemo(() => {
    const degrees = new Map<string, number>();
    nodes.forEach(n => degrees.set(n.id, 0));
    edges.forEach(e => {
      degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
      degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
    });
    return degrees;
  }, [nodes, edges]);

  // Select appropriate layout based on view mode
  const layoutProps = useMemo(() => ({
    nodes,
    edges,
    width,
    height,
    selectedId: selectedClaimId,
    spacing: visualEncoding.spacing,
  }), [nodes, edges, width, height, selectedClaimId, visualEncoding.spacing]);

  const structuralLayout = useHierarchicalLayout(layoutProps);
  const polarizedLayout = usePolarizedLayout(layoutProps);
  const groundedLayout = useGroundedLayout(layoutProps);
  const temporalLayout = useTemporalLayout(layoutProps);
  const focusLayout = useFocusLayout({ ...layoutProps, focusId: selectedClaimId });

  const nodePositions = useMemo(() => {
    switch (viewMode) {
      case 'structural': return structuralLayout;
      case 'conflict': return polarizedLayout;
      case 'grounded': return groundedLayout;
      case 'temporal': return temporalLayout;
      case 'focus': return focusLayout;
      default: return structuralLayout;
    }
  }, [viewMode, structuralLayout, polarizedLayout, groundedLayout, temporalLayout, focusLayout]);

  // Visual property calculators
  const getNodeSize = (node: CegNode) => {
    switch (visualEncoding.nodeSize) {
      case 'byApprovals':
        return VisualScales.nodeSizeByApprovals(node.approvals || 0);
      case 'byConnections':
        return VisualScales.nodeSizeByConnections(nodeDegrees.get(node.id) || 0);
      case 'byConfidence':
        return VisualScales.nodeSizeByApprovals(node.confidence || 0.5);
      default:
        return 6;
    }
  };

  const getNodeColor = (node: CegNode) => {
    switch (visualEncoding.nodeColor) {
      case 'byStatus':
        return ColorPalettes.status[node.label || 'UNDEC'];
      case 'byAge':
        const ageInDays = node.createdAt 
          ? (Date.now() - new Date(node.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          : 0;
        return ageInDays < 1 
          ? ColorPalettes.temporal.new
          : ageInDays < 7
          ? ColorPalettes.temporal.recent
          : ColorPalettes.temporal.old;
      default:
        return ColorPalettes.status[node.label || 'UNDEC'];
    }
  };

  const getEdgeThickness = (edge: CegEdge) => {
    if (visualEncoding.edgeThickness === 'byConfidence') {
      return VisualScales.edgeThicknessByConfidence(edge.confidence || 0.7);
    }
    return 1.5;
  };

  const getEdgeColor = (edge: CegEdge) => {
    if (edge.attackType === 'UNDERCUTS') return ColorPalettes.edges.undercut;
    if (edge.attackType === 'UNDERMINES') return ColorPalettes.edges.undermine;
    if (edge.type === 'rebuts') return ColorPalettes.edges.rebut;
    return ColorPalettes.edges.support;
  };

  const shouldShowEdge = (edge: CegEdge) => {
    if (visualEncoding.edgeEmphasis === 'attacks-only') {
      return edge.type === 'rebuts';
    }
    if (visualEncoding.edgeEmphasis === 'supports-only') {
      return edge.type === 'supports';
    }
    return true;
  };

  if (loading) {
    return <LoadingSkeleton width={width} height={height} />;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* View Mode Selector */}
      <ViewModeSelector
        currentMode={viewMode}
        onModeChange={setViewMode}
        stats={stats}
      />

      {/* Main Graph */}
      <div className="relative p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="bg-slate-50 rounded-lg"
        >
          <defs>
            <MarkerDefinitions />
            
            {/* Glow effect for selected node */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background grid (subtle) */}
          <GridPattern width={width} height={height} />

          {/* Grouping regions (if enabled) */}
          {visualEncoding.grouping && viewMode === 'grounded' && (
            <GroupingRegions
              nodePositions={nodePositions}
              nodes={nodes}
              width={width}
              height={height}
            />
          )}

          {/* Edges Layer */}
          <g className="edges">
            {edges.filter(shouldShowEdge).map(edge => {
              const from = nodePositions.get(edge.source);
              const to = nodePositions.get(edge.target);
              if (!from || !to) return null;

              const thickness = getEdgeThickness(edge);
              const color = getEdgeColor(edge);
              
              // Curved edges for better readability
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const offset = 15;
              const controlX = midX - dy * offset / Math.sqrt(dx*dx + dy*dy);
              const controlY = midY + dx * offset / Math.sqrt(dx*dx + dy*dy);

              const isHighlighted = hoveredId === edge.source || hoveredId === edge.target;

              return (
                <g key={edge.id}>
                  {visualEncoding.edgeStyle === 'curved' ? (
                    <path
                      d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={isHighlighted ? thickness * 1.5 : thickness}
                      strokeOpacity={isHighlighted ? 0.9 : 0.4}
                      markerEnd={`url(#arrow-${edge.type})`}
                      className="transition-all duration-200"
                    />
                  ) : (
                    <line
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={color}
                      strokeWidth={isHighlighted ? thickness * 1.5 : thickness}
                      strokeOpacity={isHighlighted ? 0.9 : 0.4}
                      markerEnd={`url(#arrow-${edge.type})`}
                      className="transition-all duration-200"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Nodes Layer */}
          <g className="nodes">
            {nodes.map(node => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;

              const size = getNodeSize(node);
              const color = getNodeColor(node);
              const isSelected = node.id === selectedClaimId;
              const isHovered = node.id === hoveredId;
              
              return (
                <NodeVisualization
                  key={node.id}
                  node={node}
                  x={pos.x}
                  y={pos.y}
                  size={size}
                  color={color}
                  isSelected={isSelected}
                  isHovered={isHovered}
                  shape={visualEncoding.nodeShape}
                  showLabel={visualEncoding.showLabels === 'all' || 
                    (visualEncoding.showLabels === 'selected' && isSelected) ||
                    (visualEncoding.showLabels === 'hover' && isHovered)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onSelectClaim?.(node.id)}
                />
              );
            })}
          </g>
        </svg>

        {/* Visual Encoding Legend */}
        <VisualLegend
          encoding={visualEncoding}
          viewMode={viewMode}
          stats={stats}
        />
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <VisualSettingsPanel
          encoding={visualEncoding}
          onChange={setVisualEncoding}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Settings Toggle Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 hover:bg-white border border-slate-200 shadow-sm"
        title="Visual settings"
      >
        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  );
}

// View Mode Selector Component
function ViewModeSelector({
  currentMode,
  onModeChange,
  stats,
}: {
  currentMode: ViewMode;
  stats: any;
  onModeChange: (mode: ViewMode) => void;
}) {
  const modes: Array<{ id: ViewMode; label: string; icon: string; description: string }> = [
    {
      id: 'structural',
      label: 'Flow',
      icon: '⇊',
      description: 'Shows argument chains from premises to conclusions',
    },
    {
      id: 'conflict',
      label: 'Conflict',
      icon: '⚔',
      description: 'Separates supporting and attacking claims',
    },
    {
      id: 'grounded',
      label: 'Status',
      icon: '◉',
      description: 'Groups by IN/OUT/UNDEC status',
    },
    {
      id: 'temporal',
      label: 'Time',
      icon: '⟳',
      description: 'Shows how the debate evolved over time',
    },
    {
      id: 'focus',
      label: 'Focus',
      icon: '◎',
      description: 'Ego network around selected claim',
    },
  ];

  return (
    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-700">View Mode</h4>
        {stats && (
          <span className="text-[10px] text-slate-500">
            {stats.totalClaims} claims • {stats.supportCount + stats.counterCount} edges
          </span>
        )}
      </div>
      
      <div className="flex gap-1">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            title={mode.description}
            className={`
              flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium
              transition-all duration-200
              ${currentMode === mode.id
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }
            `}
          >
            <div className="text-sm mb-0.5">{mode.icon}</div>
            <div>{mode.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Node Visualization Component
function NodeVisualization({
  node,
  x,
  y,
  size,
  color,
  isSelected,
  isHovered,
  shape,
  showLabel,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  node: CegNode;
  x: number;
  y: number;
  size: number;
  color: string;
  isSelected: boolean;
  isHovered: boolean;
  shape: 'circle' | 'rounded-rect' | 'icon';
  showLabel: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className="cursor-pointer transition-all duration-200"
      style={{ 
        filter: isSelected ? 'url(#glow)' : undefined,
      }}
    >
      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={x}
          cy={y}
          r={size + 4}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          className="animate-pulse"
        />
      )}

      {/* Node shape */}
      {shape === 'circle' ? (
        <circle
          cx={x}
          cy={y}
          r={size}
          fill={color}
          stroke="white"
          strokeWidth={isHovered ? 2 : 1}
          opacity={isHovered ? 1 : 0.9}
        />
      ) : shape === 'rounded-rect' ? (
        <rect
          x={x - size}
          y={y - size}
          width={size * 2}
          height={size * 2}
          rx={size * 0.3}
          fill={color}
          stroke="white"
          strokeWidth={isHovered ? 2 : 1}
          opacity={isHovered ? 1 : 0.9}
        />
      ) : null}

      {/* Approval count badge */}
      {node.approvals > 0 && (
        <g>
          <circle
            cx={x + size * 0.6}
            cy={y - size * 0.6}
            r={size * 0.5}
            fill="#16a34a"
            stroke="white"
            strokeWidth={1}
          />
          <text
            x={x + size * 0.6}
            y={y - size * 0.6}
            fontSize={size * 0.6}
            fill="white"
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="bold"
          >
            {node.approvals}
          </text>
        </g>
      )}

      {/* Label */}
      {showLabel && (
        <text
          x={x}
          y={y + size + 10}
          fontSize="8"
          fill="#1e293b"
          textAnchor="middle"
          className="pointer-events-none"
        >
          <tspan className="font-semibold">
            {node.text.substring(0, 20)}
            {node.text.length > 20 ? '...' : ''}
          </tspan>
        </text>
      )}
    </g>
  );
}

// Visual Legend Component
function VisualLegend({
  encoding,
  viewMode,
  stats,
}: {
  encoding: VisualEncoding;
  viewMode: ViewMode;
  stats: any;
}) {
  return (
    <div className="mt-2 p-2 bg-white/80 backdrop-blur rounded-lg border border-slate-200 text-[9px]">
      <div className="grid grid-cols-2 gap-2">
        {/* Node size meaning */}
        <div>
          <div className="font-semibold text-slate-700 mb-1">Node Size</div>
          <div className="text-slate-600">
            {encoding.nodeSize === 'byApprovals' && '= Approvals'}
            {encoding.nodeSize === 'byConnections' && '= Connections'}
            {encoding.nodeSize === 'byConfidence' && '= Confidence'}
            {encoding.nodeSize === 'uniform' && '= Uniform'}
          </div>
        </div>

        {/* Node color meaning */}
        <div>
          <div className="font-semibold text-slate-700 mb-1">Node Color</div>
          <div className="flex gap-1 flex-wrap">
            {encoding.nodeColor === 'byStatus' && (
              <>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#16a34a]" />
                  <span>IN</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#dc2626]" />
                  <span>OUT</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#64748b]" />
                  <span>UNDEC</span>
                </div>
              </>
            )}
            {encoding.nodeColor === 'byAge' && (
              <>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
                  <span>New</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                  <span>Recent</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edge types */}
        <div className="col-span-2">
          <div className="font-semibold text-slate-700 mb-1">Edges</div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#64748b" strokeWidth="1.5" /></svg>
              <span>Support</span>
            </div>
            <div className="flex items-center gap-1">
              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#dc2626" strokeWidth="1.5" /></svg>
              <span>Rebut</span>
            </div>
            <div className="flex items-center gap-1">
              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" /></svg>
              <span>Undercut</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function LoadingSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 p-4 animate-pulse">
      <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
      <div className="bg-slate-100 rounded-lg" style={{ width, height }} />
    </div>
  );
}

function MarkerDefinitions() {
  return (
    <>
      <marker id="arrow-supports" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <polygon points="0 0, 6 3, 0 6" fill="#64748b" />
      </marker>
      <marker id="arrow-rebuts" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <polygon points="0 0, 6 3, 0 6" fill="#dc2626" />
      </marker>
    </>
  );
}

function GridPattern({ width, height }: { width: number; height: number }) {
  return (
    <g opacity="0.1">
      {Array.from({ length: Math.floor(width / 20) }).map((_, i) => (
        <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={height} stroke="#cbd5e1" strokeWidth={0.5} />
      ))}
      {Array.from({ length: Math.floor(height / 20) }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 20} x2={width} y2={i * 20} stroke="#cbd5e1" strokeWidth={0.5} />
      ))}
    </g>
  );
}

function GroupingRegions({
  nodePositions,
  nodes,
  width,
  height,
}: {
  nodePositions: Map<string, { x: number; y: number }>;
  nodes: CegNode[];
  width: number;
  height: number;
}) {
  const groups = {
    IN: nodes.filter(n => n.label === 'IN'),
    OUT: nodes.filter(n => n.label === 'OUT'),
    UNDEC: nodes.filter(n => n.label === 'UNDEC'),
  };

  return (
    <g className="grouping-regions" opacity="0.1">
      {Object.entries(groups).map(([label, groupNodes]) => {
        if (groupNodes.length === 0) return null;
        
        const positions = groupNodes
          .map(n => nodePositions.get(n.id))
          .filter(Boolean) as Array<{ x: number; y: number }>;
        
        if (positions.length === 0) return null;

        const xs = positions.map(p => p.x);
        const ys = positions.map(p => p.y);
        const minX = Math.min(...xs) - 20;
        const maxX = Math.max(...xs) + 20;
        const minY = Math.min(...ys) - 20;
        const maxY = Math.max(...ys) + 20;

        const color = ColorPalettes.status[label as 'IN' | 'OUT' | 'UNDEC'];

        return (
          <rect
            key={label}
            x={minX}
            y={minY}
            width={maxX - minX}
            height={maxY - minY}
            fill={color}
            rx={8}
          />
        );
      })}
    </g>
  );
}

function VisualSettingsPanel({
  encoding,
  onChange,
  onClose,
}: {
  encoding: VisualEncoding;
  onChange: (encoding: VisualEncoding) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-10 right-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700">Visual Settings</h4>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label className="block text-slate-600 font-medium mb-1">Node Size</label>
          <select
            value={encoding.nodeSize}
            onChange={(e) => onChange({ ...encoding, nodeSize: e.target.value as any })}
            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
          >
            <option value="uniform">Uniform</option>
            <option value="byApprovals">By Approvals</option>
            <option value="byConnections">By Connections</option>
            <option value="byConfidence">By Confidence</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Node Color</label>
          <select
            value={encoding.nodeColor}
            onChange={(e) => onChange({ ...encoding, nodeColor: e.target.value as any })}
            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
          >
            <option value="byStatus">By Status (IN/OUT/UNDEC)</option>
            <option value="byAge">By Age</option>
            <option value="byCluster">By Cluster</option>
            <option value="byAuthor">By Author</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Edge Style</label>
          <select
            value={encoding.edgeStyle}
            onChange={(e) => onChange({ ...encoding, edgeStyle: e.target.value as any })}
            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
          >
            <option value="straight">Straight</option>
            <option value="curved">Curved</option>
            <option value="orthogonal">Orthogonal</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Show Labels</label>
          <select
            value={encoding.showLabels}
            onChange={(e) => onChange({ ...encoding, showLabels: e.target.value as any })}
            className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
          >
            <option value="none">None</option>
            <option value="hover">On Hover</option>
            <option value="selected">Selected Only</option>
            <option value="all">All</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={encoding.grouping}
              onChange={(e) => onChange({ ...encoding, grouping: e.target.checked })}
              className="rounded"
            />
            <span className="text-slate-600">Show Grouping Regions</span>
          </label>
        </div>
      </div>
    </div>
  );
}