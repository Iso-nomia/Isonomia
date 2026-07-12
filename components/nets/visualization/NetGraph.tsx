"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { SchemeNode } from "./nodes/SchemeNode";
import { DependencyEdge } from "./edges/DependencyEdge";
import { NetLayoutEngine } from "./layout/NetLayoutEngine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface NetGraphProps {
  net: {
    id: string;
    netType: string;
    complexity: number;
    confidence: number;
    schemes: Array<{
      schemeId: string;
      schemeName: string;
      schemeCategory: string;
      confidence: number;
      role: string;
      premises: any[];
      conclusion: string;
    }>;
    relationships: Array<{
      sourceScheme: string;
      targetScheme: string;
      type: string;
      strength: number;
    }>;
  };
  dependencyGraph: {
    nodes: Array<{
      schemeId: string;
      schemeName: string;
      role: string;
      depth: number;
    }>;
    edges: Array<{
      sourceSchemeId: string;
      targetSchemeId: string;
      type: string;
      strength: number;
      criticality: string;
      explanation: string;
    }>;
    cycles: string[][];
    criticalPath: string[];
  };
  explicitnessAnalysis: {
    overallExplicitness: string;
    confidence: number;
    schemeExplicitness: Array<{
      schemeId: string;
      level: string;
      confidence: number;
    }>;
    relationshipExplicitness: Array<{
      sourceScheme: string;
      targetScheme: string;
      level: string;
      confidence: number;
    }>;
  };
  layout?: "hierarchical" | "force" | "circular" | "tree";
  onNodeClick?: (schemeId: string) => void;
  onEdgeClick?: (sourceId: string, targetId: string) => void;
}

// ============================================================================
// Custom Node and Edge Types
// ============================================================================

const nodeTypes: NodeTypes = {
  schemeNode: SchemeNode,
};

const edgeTypes: EdgeTypes = {
  dependencyEdge: DependencyEdge,
};

// ============================================================================
// Main Component
// ============================================================================

export function NetGraph({
  net,
  dependencyGraph,
  explicitnessAnalysis,
  layout = "hierarchical",
  onNodeClick,
  onEdgeClick,
}: NetGraphProps) {
  const layoutEngine = useMemo(() => new NetLayoutEngine(), []);

  // Transform net data to React Flow format
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return transformNetToGraph(
      net,
      dependencyGraph,
      explicitnessAnalysis,
      layoutEngine,
      layout
    );
  }, [net, dependencyGraph, explicitnessAnalysis, layout, layoutEngine]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle node clicks
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [onNodeClick]
  );

  // Handle edge clicks
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge.source, edge.target);
      }
    },
    [onEdgeClick]
  );

  // Export/Debug: Log complete graph structure
  const handleExport = useCallback(() => {
    const graphData = {
      metadata: {
        netId: net.id,
        netType: net.netType,
        complexity: net.complexity,
        confidence: net.confidence,
        overallExplicitness: explicitnessAnalysis.overallExplicitness,
        schemeCount: net.schemes.length,
        edgeCount: dependencyGraph.edges.length,
        cycleCount: dependencyGraph.cycles.length,
        criticalPathLength: dependencyGraph.criticalPath.length,
      },
      schemes: net.schemes.map((scheme) => ({
        schemeId: scheme.schemeId,
        schemeName: scheme.schemeName,
        schemeCategory: scheme.schemeCategory,
        confidence: scheme.confidence,
        role: scheme.role,
        explicitness: explicitnessAnalysis.schemeExplicitness.find(
          (e) => e.schemeId === scheme.schemeId
        ),
      })),
      dependencies: dependencyGraph.edges.map((edge) => ({
        source: edge.sourceSchemeId,
        target: edge.targetSchemeId,
        type: edge.type,
        strength: edge.strength,
        criticality: edge.criticality,
        explanation: edge.explanation,
        explicitness: explicitnessAnalysis.relationshipExplicitness.find(
          (e) => e.sourceScheme === edge.sourceSchemeId && e.targetScheme === edge.targetSchemeId
        ),
      })),
      graph: {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          animated: edge.animated,
          data: edge.data,
        })),
      },
      analysis: {
        criticalPath: dependencyGraph.criticalPath,
        cycles: dependencyGraph.cycles,
        relationships: net.relationships,
      },
    };

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║           ARGUMENT NET GRAPH - COMPLETE STRUCTURE            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("\n📊 METADATA:");
    console.table(graphData.metadata);
    console.log("\n🔷 SCHEMES:");
    console.table(graphData.schemes);
    console.log("\n➡️  DEPENDENCIES:");
    console.table(graphData.dependencies);
    console.log("\n📈 GRAPH STRUCTURE:");
    console.log("Nodes:", graphData.graph.nodes);
    console.log("Edges:", graphData.graph.edges);
    console.log("\n🔍 ANALYSIS:");
    console.log("Critical Path:", graphData.analysis.criticalPath);
    console.log("Cycles:", graphData.analysis.cycles);
    console.log("Relationships:", graphData.analysis.relationships);
    console.log("\n📋 FULL DATA (copy-paste for export):");
    console.log(JSON.stringify(graphData, null, 2));
    console.log("\n✅ Graph data logged to console!");
  }, [net, dependencyGraph, explicitnessAnalysis, nodes, edges]);

  // Highlight critical path
  const highlightCriticalPath = useCallback(() => {
    const criticalNodeIds = new Set(dependencyGraph.criticalPath);
    
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isOnCriticalPath: criticalNodeIds.has(node.id),
        },
      }))
    );

    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          isOnCriticalPath:
            criticalNodeIds.has(edge.source) && criticalNodeIds.has(edge.target),
        },
      }))
    );
  }, [dependencyGraph.criticalPath, setNodes, setEdges]);

  // Highlight cycles
  const highlightCycles = useCallback(() => {
    const cycleNodeIds = new Set(dependencyGraph.cycles.flat());
    
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isInCycle: cycleNodeIds.has(node.id),
        },
      }))
    );
  }, [dependencyGraph.cycles, setNodes]);

  return (
    <Card className="w-full h-[600px] relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Strict}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{
            backgroundColor: "#f8f9fa",
          }}
        />

        {/* Control Panel */}
        <Panel position="top-right" className="space-y-2">
          <div className="bg-white rounded-lg shadow-lg p-2 space-y-1">
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={highlightCriticalPath}
            >
              Show Critical Path
            </Button>
            {dependencyGraph.cycles.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={highlightCycles}
              >
                Show Cycles
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </Panel>

        {/* Info Panel */}
        <Panel position="top-left">
          <div className="bg-white rounded-lg shadow-lg p-3">
            <div className="text-xs space-y-1">
              <div>
                <span className="font-medium">Net Type:</span> {net.netType}
              </div>
              <div>
                <span className="font-medium">Schemes:</span> {net.schemes.length}
              </div>
              <div>
                <span className="font-medium">Dependencies:</span> {dependencyGraph.edges.length}
              </div>
              <div>
                <span className="font-medium">Complexity:</span> {net.complexity}/100
              </div>
              {dependencyGraph.cycles.length > 0 && (
                <div className="text-red-600">
                  <span className="font-medium">⚠️ Cycles:</span> {dependencyGraph.cycles.length}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </Card>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function transformNetToGraph(
  net: any,
  dependencyGraph: any,
  explicitnessAnalysis: any,
  layoutEngine: NetLayoutEngine,
  layout: string
): { nodes: Node[]; edges: Edge[] } {
  // Create nodes from schemes
  const nodes: Node[] = net.schemes.map((scheme: any) => {
    const depNode = dependencyGraph.nodes.find(
      (n: any) => n.schemeId === scheme.schemeId
    );
    const explicitness = explicitnessAnalysis.schemeExplicitness.find(
      (e: any) => e.schemeId === scheme.schemeId
    );

    return {
      id: scheme.schemeId,
      type: "schemeNode",
      position: { x: 0, y: 0 }, // Will be set by layout engine
      data: {
        scheme,
        depth: depNode?.depth || 0,
        role: scheme.role,
        explicitness: explicitness?.level || "implicit",
        confidence: scheme.confidence,
        isOnCriticalPath: false,
        isInCycle: false,
      },
    };
  });

  // Create edges from dependencies
  const edges: Edge[] = dependencyGraph.edges.map((edge: any) => {
    const explicitness = explicitnessAnalysis.relationshipExplicitness.find(
      (e: any) =>
        e.sourceScheme === edge.sourceSchemeId && e.targetScheme === edge.targetSchemeId
    );

    return {
      id: `${edge.sourceSchemeId}-${edge.targetSchemeId}`,
      source: edge.sourceSchemeId,
      target: edge.targetSchemeId,
      type: "dependencyEdge",
      animated: edge.criticality === "critical",
      data: {
        dependency: edge,
        explicitness: explicitness?.level || "implicit",
        isOnCriticalPath: false,
      },
    };
  });

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = layoutEngine.applyLayout(
    nodes,
    edges,
    layout,
    net.netType
  );

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
