/**
 * Phase 3.4.1: Knowledge Graph Explorer Component
 * 
 * Interactive D3-based visualization of the knowledge graph.
 * Supports zooming, panning, node selection, and filtering.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
// `d3` is the runtime umbrella package. `@types/d3` is not installed in this
// workspace (only individual `@types/d3-*` sub-packages are), so the import is
// untyped here and the callback parameters below are annotated explicitly to
// retain type-safety at every D3 call site.
// @ts-ignore -- no bundled types for the `d3` umbrella package
import * as d3 from "d3";
import type { D3ZoomEvent } from "d3-zoom";
import { useRouter } from "next/navigation";
import {
  Search, 
  Filter, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw,
  Loader2,
  Info 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Minimal local typing for the d3-force simulation surface used here. The
// `@types/d3-force` package is not installed in this workspace, so we describe
// only the methods this component calls.
interface D3Simulation {
  alphaTarget(target: number): D3Simulation;
  restart(): D3Simulation;
  stop(): D3Simulation;
}

// Node type colors
const NODE_COLORS: Record<string, string> = {
  source: "#3b82f6",       // Blue
  topic: "#10b981",        // Green
  deliberation: "#8b5cf6", // Purple
  claim: "#f59e0b",        // Amber
  argument: "#ef4444",     // Red
  author: "#6366f1",       // Indigo
  institution: "#ec4899",  // Pink
};

// Node type labels
const NODE_LABELS: Record<string, string> = {
  source: "Sources",
  topic: "Topics",
  deliberation: "Deliberations",
  claim: "Claims",
  argument: "Arguments",
  author: "Authors",
  institution: "Institutions",
};

// All available node types
const ALL_NODE_TYPES = [
  "source",
  "topic",
  "deliberation",
  "claim",
  "argument",
  "author",
  "institution",
] as const;

interface GraphNode {
  id: string;
  type: string;
  label: string;
  weight: number;
  referenceId: string;
  description?: string | null;
  depth: number;
  connectionCount: number;
  // D3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  weight: number;
}

interface KnowledgeGraphExplorerProps {
  initialNodeType?: string;
  initialNodeId?: string;
  height?: number;
  className?: string;
}

export function KnowledgeGraphExplorer({
  initialNodeType,
  initialNodeId,
  height = 600,
  className,
}: KnowledgeGraphExplorerProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<D3Simulation | null>(null);

  // State
  const [centerNode, setCenterNode] = useState<{ type: string; id: string } | null>(
    initialNodeType && initialNodeId
      ? { type: initialNodeType, id: initialNodeId }
      : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleNodeTypes, setVisibleNodeTypes] = useState<string[]>([
    "source",
    "topic",
    "deliberation",
  ]);
  const [depth, setDepth] = useState(2);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Fetch graph data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["knowledge-graph", centerNode, depth, visibleNodeTypes],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (centerNode) {
        params.set("centerType", centerNode.type);
        params.set("centerId", centerNode.id);
      }
      params.set("depth", String(depth));
      params.set("nodeTypes", visibleNodeTypes.join(","));
      params.set("maxNodes", "150");
      
      const res = await fetch(`/api/knowledge-graph?${params}`);
      if (!res.ok) throw new Error("Failed to fetch graph");
      return res.json();
    },
    staleTime: 60000,
  });

  // Search nodes
  const { data: searchResults } = useQuery({
    queryKey: ["knowledge-graph-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;
      const params = new URLSearchParams();
      params.set("search", searchQuery);
      params.set("limit", "10");
      
      const res = await fetch(`/api/knowledge-graph?${params}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length > 1,
  });

  // Handle node type filter toggle
  const toggleNodeType = useCallback((type: string) => {
    setVisibleNodeTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  // Handle node click - navigate to entity
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    
    // Navigate based on node type
    switch (node.type) {
      case "source":
        router.push(`/sources/${node.referenceId}`);
        break;
      case "deliberation":
        router.push(`/deliberations/${node.referenceId}`);
        break;
      case "topic":
        // Center on this topic in the graph
        setCenterNode({ type: "topic", id: node.referenceId });
        break;
      case "argument":
        router.push(`/arguments/${node.referenceId}`);
        break;
      default:
        // Center on this node
        setCenterNode({ type: node.type, id: node.referenceId });
    }
  }, [router]);

  // Handle node double-click - center on node
  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    setCenterNode({ type: node.type, id: node.referenceId });
  }, []);

  // Handle search result click
  const handleSearchResultClick = useCallback((node: GraphNode) => {
    setCenterNode({ type: node.type, id: node.referenceId });
    setSearchQuery("");
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setCenterNode(null);
    setSelectedNode(null);
    setDepth(2);
  }, []);

  // D3 visualization
  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;
    if (!data.nodes || data.nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const svgHeight = height;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
      });

    svg.call(zoom);

    const g = svg.append("g");

    // Create arrow markers for edges
    svg.append("defs").selectAll("marker")
      .data(["arrow"])
      .enter().append("marker")
      .attr("id", (d: string) => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#94a3b8")
      .attr("d", "M0,-5L10,0L0,5");

    // Prepare data
    const nodes: GraphNode[] = data.nodes.map((n: GraphNode) => ({ ...n }));
    const edges: GraphEdge[] = data.edges.map((e: GraphEdge) => ({ ...e }));

    // Create simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3.forceLink<GraphNode, GraphEdge>(edges)
          .id((d: GraphNode) => d.id)
          .distance(100)
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, svgHeight / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d: GraphNode) =>
        Math.max(15, d.weight * 8 + 10)
      ));

    simulationRef.current = simulation;

    // Draw edges
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(edges)
      .enter().append("line")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", (d: GraphEdge) => Math.max(1, d.weight * 0.5))
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrow)");

    // Draw nodes
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .call(drag(simulation) as any);

    // Node circles
    node.append("circle")
      .attr("r", (d: GraphNode) => Math.max(8, d.weight * 5 + 5))
      .attr("fill", (d: GraphNode) => NODE_COLORS[d.type] || "#6b7280")
      .attr("stroke", (d: GraphNode) =>
        d.depth === 0 ? "#000" :
        selectedNode?.id === d.id ? "#000" : "#fff"
      )
      .attr("stroke-width", (d: GraphNode) => d.depth === 0 ? 3 : 2);

    // Node labels
    node.append("text")
      .text((d: GraphNode) => truncateLabel(d.label, 20))
      .attr("x", 0)
      .attr("y", (d: GraphNode) => Math.max(8, d.weight * 5 + 5) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#374151")
      .attr("pointer-events", "none");

    // Node interactions
    node
      .on("mouseover", function(this: SVGGElement, event: MouseEvent, d: GraphNode) {
        setHoveredNode(d);
        d3.select<SVGGElement, GraphNode>(this).select("circle")
          .attr("stroke", "#000")
          .attr("stroke-width", 3);
      })
      .on("mouseout", function(this: SVGGElement, event: MouseEvent, d: GraphNode) {
        setHoveredNode(null);
        d3.select<SVGGElement, GraphNode>(this).select("circle")
          .attr("stroke", d.depth === 0 ? "#000" : selectedNode?.id === d.id ? "#000" : "#fff")
          .attr("stroke-width", d.depth === 0 ? 3 : 2);
      })
      .on("click", (event: MouseEvent, d: GraphNode) => {
        event.stopPropagation();
        handleNodeClick(d);
      })
      .on("dblclick", (event: MouseEvent, d: GraphNode) => {
        event.stopPropagation();
        handleNodeDoubleClick(d);
      });

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: GraphNode) => `translate(${d.x},${d.y})`);
    });

    // Zoom to fit after layout stabilizes
    simulation.on("end", () => {
      const bounds = g.node()?.getBBox();
      if (bounds) {
        const dx = bounds.width;
        const dy = bounds.height;
        const x = bounds.x + dx / 2;
        const y = bounds.y + dy / 2;
        const scale = Math.min(0.9 / Math.max(dx / width, dy / svgHeight), 2);
        const translate: [number, number] = [width / 2 - scale * x, svgHeight / 2 - scale * y];

        svg.transition()
          .duration(750)
          .call(
            zoom.transform as any,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
          );
      }
    });

    return () => {
      simulation.stop();
    };
  }, [data, height, selectedNode, handleNodeClick, handleNodeDoubleClick]);

  // Drag behavior
  function drag(simulation: D3Simulation) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag<SVGGElement, GraphNode>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div className={cn("relative border rounded-lg bg-white", className)}>
      {/* Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 w-48 bg-white/90 backdrop-blur"
          />
          
          {/* Search results dropdown */}
          {searchResults?.nodes && searchResults.nodes.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto z-20">
              {searchResults.nodes.map((node: GraphNode) => (
                <button
                  key={node.id}
                  onClick={() => handleSearchResultClick(node)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: NODE_COLORS[node.type] }}
                  />
                  <span className="text-sm truncate">{node.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {NODE_LABELS[node.type]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Node type filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-white/90 backdrop-blur">
              <Filter className="h-4 w-4 mr-1" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="start">
            <div className="space-y-2 p-2">
              <p className="text-sm font-medium">Node Types</p>
              {ALL_NODE_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`filter-${type}`}
                    checked={visibleNodeTypes.includes(type)}
                    onCheckedChange={() => toggleNodeType(type)}
                  />
                  <Label
                    htmlFor={`filter-${type}`}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: NODE_COLORS[type] }}
                    />
                    {NODE_LABELS[type]}
                  </Label>
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Depth control */}
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur rounded-md border px-2 py-1">
          <span className="text-xs text-gray-500">Depth:</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setDepth((d) => Math.max(1, d - 1))}
            disabled={depth <= 1}
          >
            -
          </Button>
          <span className="text-sm w-4 text-center">{depth}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setDepth((d) => Math.min(5, d + 1))}
            disabled={depth >= 5}
          >
            +
          </Button>
        </div>

        {/* Reset */}
        {centerNode && (
          <Button
            variant="outline"
            size="sm"
            onClick={resetView}
            className="bg-white/90 backdrop-blur"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 ml-auto" />
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2 bg-white/90 backdrop-blur rounded-md border px-2 py-1">
        {visibleNodeTypes.map((type) => (
          <div key={type} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: NODE_COLORS[type] }}
            />
            <span className="text-xs text-gray-600">{NODE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      {data?.stats && (
        <div className="absolute bottom-3 right-3 z-10 text-xs text-gray-500 bg-white/90 backdrop-blur rounded-md border px-2 py-1">
          {data.stats.totalNodes} nodes · {data.stats.totalEdges} edges
        </div>
      )}

      {/* Hovered node tooltip */}
      {hoveredNode && (
        <div className="absolute top-16 right-3 z-10 w-64 bg-white border rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: NODE_COLORS[hoveredNode.type] }}
            />
            <span className="font-medium text-sm">{NODE_LABELS[hoveredNode.type]}</span>
          </div>
          <p className="text-sm font-medium mb-1">{hoveredNode.label}</p>
          {hoveredNode.description && (
            <p className="text-xs text-gray-500 line-clamp-3 mb-2">
              {hoveredNode.description}
            </p>
          )}
          <p className="text-xs text-gray-400">
            {hoveredNode.connectionCount} connections
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Click to view · Double-click to center
          </p>
        </div>
      )}

      {/* SVG canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        className="rounded-lg"
      />

      {/* Empty state */}
      {!isLoading && (!data?.nodes || data.nodes.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-6">
            <Info className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No graph data available</p>
            <p className="text-xs text-gray-400 mt-1">
              Try adjusting filters or building the graph
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Truncate label to max length
 */
function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) return label;
  return label.slice(0, maxLength - 1) + "…";
}

export default KnowledgeGraphExplorer;
