"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  Connection,
  ConnectionMode,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import type { ChainNodeData, ChainEdgeData } from "@/lib/types/argumentChain";
import "@xyflow/react/dist/style.css";
import { ChevronLeft, ChevronRight, Layers, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useChainEditorStore } from "@/lib/stores/chainEditorStore";
import ArgumentChainNode from "./ArgumentChainNode";
import ArgumentChainEdge from "./ArgumentChainEdge";
import ScopeBoundary, { type ScopeBoundaryData } from "./ScopeBoundary";
import { getLayoutedElements } from "@/lib/utils/chainLayoutUtils";
import { ChainAnalysisPanel } from "./ChainAnalysisPanel";
import { EnablerPanel } from "./EnablerPanel";
import AddNodeButton from "./AddNodeButton";
import ConnectionEditor from "./ConnectionEditor";
import ChainMetadataPanel from "./ChainMetadataPanel";
import ChainExportButton from "./ChainExportButton";
import ChainArgumentComposer, { ChainComposerContext } from "./ChainArgumentComposer";
import { CreateScopeDialog, EditScopeDialog } from "./ScopeDialogs";
import { ScopesPanel } from "./ScopesPanel";
import { SCOPE_TYPE_CONFIG, type ScopeType } from "@/lib/types/argumentChain";

const nodeTypes: NodeTypes = {
  argumentNode: ArgumentChainNode as NodeTypes[string],
  scopeBoundary: ScopeBoundary as NodeTypes[string],
};

const edgeTypes: EdgeTypes = {
  chainEdge: ArgumentChainEdge as EdgeTypes[string],
};

interface ArgumentChainCanvasProps {
  chainId: string; // Required for analysis
  deliberationId: string; // Required for AddNodeButton
  currentUserId?: string | null; // Required for creating new arguments
  isEditable?: boolean;
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

const ArgumentChainCanvasInner: React.FC<ArgumentChainCanvasProps> = ({
  chainId,
  deliberationId,
  currentUserId,
  isEditable = true,
  onNodeClick,
  onEdgeClick,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [edgeAttacks, setEdgeAttacks] = useState<Record<string, number>>({});
  
  // Composer dialog state
  const [showComposer, setShowComposer] = useState(false);
  const [composerContext, setComposerContext] = useState<ChainComposerContext | null>(null);

  // Scope management state
  const [scopes, setScopes] = useState<any[]>([]);
  const [showCreateScope, setShowCreateScope] = useState(false);
  const [isCreatingScope, setIsCreatingScope] = useState(false);
  const [showScopesPanel, setShowScopesPanel] = useState(false);
  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [editingScope, setEditingScope] = useState<any | null>(null);
  const [showScopeBoundaries, setShowScopeBoundaries] = useState(true);
  
  // Hypothetical Mode state - for focused composition within a scope
  const [hypotheticalMode, setHypotheticalMode] = useState<{
    scopeId: string;
    scopeType: string;
    assumption: string;
    color?: string;
  } | null>(null);
  
  // Drag state for scope drop detection
  const [dragOverScope, setDragOverScope] = useState<string | null>(null);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setSelectedNode,
    setSelectedEdge,
    openConnectionEditor,
    setNodes,
    setEdges,
    setChainMetadata,
    edgeAttackMode,
    targetedEdgeId,
    enterEdgeAttackMode,
    exitEdgeAttackMode,
    setTargetedEdge,
  } = useChainEditorStore();

  // Initialize chain metadata in store
  useEffect(() => {
    setChainMetadata({ chainId });
  }, [chainId, setChainMetadata]);

  // Fetch and load chain data (including metadata)
  useEffect(() => {
    const loadChain = async () => {
      setIsLoading(true);
      try {
        // Load chain metadata first
        const chainResponse = await fetch(`/api/argument-chains/${chainId}`);
        if (chainResponse.ok) {
          const { chain } = await chainResponse.json();
          // Populate store with chain metadata for ChainMetadataPanel
          setChainMetadata({
            chainId,
            chainName: chain.name || "",
            chainType: chain.chainType || "SERIAL",
            isPublic: chain.isPublic || false,
          });
        }

        // Load nodes and edges
        const response = await fetch(`/api/argument-chains/${chainId}/nodes`);
        if (response.ok) {
          const data = await response.json();
          
          // Transform nodes to ReactFlow format, including epistemic status
          const loadedNodes = (data.nodes || []).map((node: any) => ({
            id: node.id,
            type: "argumentNode",
            position: { 
              x: node.positionX ?? Math.random() * 500, 
              y: node.positionY ?? Math.random() * 500 
            },
            data: {
              argument: node.argument,
              role: node.role,
              nodeOrder: node.nodeOrder,
              addedBy: node.contributor,
              // Epistemic status fields (Phase 4)
              epistemicStatus: node.epistemicStatus || "ASSERTED",
              scopeId: node.scopeId,
              dialecticalRole: node.dialecticalRole,
              scope: node.scope,
            },
          }));

          // Transform edges to ReactFlow format
          const loadedEdges = (data.edges || []).map((edge: any) => ({
            id: edge.id,
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
            type: "chainEdge",
            data: {
              edgeType: edge.edgeType,
              strength: edge.strength,
              description: edge.description,
              slotMapping: edge.slotMapping,
            },
          }));

          setNodes(loadedNodes);
          setEdges(loadedEdges);

          // Count attacks per edge
          const attackCounts: Record<string, number> = {};
          loadedNodes.forEach((node: any) => {
            if (node.data.targetType === "EDGE" && node.data.targetEdgeId) {
              attackCounts[node.data.targetEdgeId] = (attackCounts[node.data.targetEdgeId] || 0) + 1;
            }
          });
          setEdgeAttacks(attackCounts);

          // Auto-layout if nodes don't have positions
          if (loadedNodes.length > 0 && loadedNodes.every((n: any) => !n.data.positionX)) {
            setTimeout(() => {
              const layouted = getLayoutedElements(loadedNodes, loadedEdges, "TB");
              setNodes(layouted.nodes as Node<ChainNodeData>[]);
              setEdges(layouted.edges as Edge<ChainEdgeData>[]);
              fitView({ padding: 0.2, duration: 400 });
            }, 100);
          } else if (loadedNodes.length > 0) {
            setTimeout(() => {
              fitView({ padding: 0.2, duration: 400 });
            }, 100);
          }
        }

        // Load scopes for this chain
        const scopesResponse = await fetch(`/api/argument-chains/${chainId}/scopes`);
        if (scopesResponse.ok) {
          const scopesData = await scopesResponse.json();
          setScopes(scopesData);
        }
      } catch (error) {
        console.error("Failed to load chain:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]); // Only reload when chainId changes

  // Handle node selection
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      setSelectedNode(node.id);
      if (onNodeClick) {
        onNodeClick(node.id);
      }
    },
    [setSelectedNode, onNodeClick]
  );

  // Handle edge selection
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: any) => {
      if (edgeAttackMode) {
        // In attack mode, selecting an edge targets it
        setTargetedEdge(edge.id);
      } else {
        // Normal mode, just select the edge
        setSelectedEdge(edge.id);
      }
      
      if (onEdgeClick) {
        onEdgeClick(edge.id);
      }
    },
    [setSelectedEdge, onEdgeClick, edgeAttackMode, setTargetedEdge]
  );

  // Handle connection start
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      
      // Open connection editor modal to define edge type and strength
      openConnectionEditor(connection.source, connection.target);
    },
    [openConnectionEditor]
  );

  // Helper: Check if a point is inside a scope boundary
  const getScopeAtPosition = useCallback((x: number, y: number): string | null => {
    const PADDING = 40;
    const HEADER_HEIGHT = 50;
    const NODE_WIDTH = 280;
    const NODE_HEIGHT = 120;

    for (const scope of scopes) {
      const scopeNodes = nodes.filter((n) => n.data.scopeId === scope.id);
      
      if (scopeNodes.length === 0) continue;
      
      // Calculate scope bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      scopeNodes.forEach((node) => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
      });

      // Expand bounds by padding
      const scopeLeft = minX - PADDING;
      const scopeTop = minY - PADDING - HEADER_HEIGHT;
      const scopeRight = maxX + PADDING;
      const scopeBottom = maxY + PADDING;

      // Check if point is inside
      if (x >= scopeLeft && x <= scopeRight && y >= scopeTop && y <= scopeBottom) {
        return scope.id;
      }
    }
    return null;
  }, [scopes, nodes]);

  // Handle node drag - detect when dragging over a scope
  const handleNodeDrag = useCallback((_event: React.MouseEvent, node: any) => {
    if (!showScopeBoundaries || node.type === "scopeBoundary") return;
    
    const nodeCenter = {
      x: node.position.x + 140, // Half of NODE_WIDTH
      y: node.position.y + 60,  // Half of NODE_HEIGHT
    };
    
    const overScope = getScopeAtPosition(nodeCenter.x, nodeCenter.y);
    
    // Only update if the node isn't already in this scope
    if (overScope !== node.data.scopeId) {
      setDragOverScope(overScope);
    } else {
      setDragOverScope(null);
    }
  }, [showScopeBoundaries, getScopeAtPosition]);

  // Assign a node to a scope (must be defined before handleNodeDragStop)
  const handleAssignNodeToScope = useCallback(async (nodeId: string, scopeId: string | null, epistemicStatus?: string) => {
    try {
      const response = await fetch(`/api/argument-chains/${chainId}/nodes/${nodeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeId,
          epistemicStatus: epistemicStatus || (scopeId ? "HYPOTHETICAL" : "ASSERTED"),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to assign node to scope");
      }

      const data = await response.json();
      const updatedNode = data.node;
      
      // Find the scope details if assigning to a scope
      const scopeDetails = scopeId ? scopes.find((s) => s.id === scopeId) : null;

      // Update node in state
      const updatedNodes = nodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              scopeId: updatedNode.scopeId,
              epistemicStatus: updatedNode.epistemicStatus,
              scope: scopeDetails ? {
                id: scopeDetails.id,
                scopeType: scopeDetails.scopeType,
                assumption: scopeDetails.assumption,
                color: scopeDetails.color,
              } : null,
            },
          };
        }
        return node;
      });
      setNodes(updatedNodes);

      // Update scope node counts
      const currentNode = nodes.find((n) => n.id === nodeId);
      const previousScopeId = currentNode?.data.scopeId;
      
      setScopes((prevScopes) =>
        prevScopes.map((scope) => {
          // Increment count for new scope
          if (scope.id === scopeId) {
            return { ...scope, nodeCount: (scope.nodeCount || 0) + 1 };
          }
          // Decrement count for previous scope
          if (scope.id === previousScopeId) {
            return { ...scope, nodeCount: Math.max(0, (scope.nodeCount || 1) - 1) };
          }
          return scope;
        })
      );
    } catch (error) {
      console.error("Failed to assign node to scope:", error);
    }
  }, [chainId, scopes, nodes, setNodes]);

  // Handle node drag stop - assign to scope if dropped inside
  const handleNodeDragStop = useCallback(async (_event: React.MouseEvent, node: any) => {
    if (!showScopeBoundaries || node.type === "scopeBoundary") {
      setDragOverScope(null);
      return;
    }

    const nodeCenter = {
      x: node.position.x + 140,
      y: node.position.y + 60,
    };
    
    const targetScopeId = getScopeAtPosition(nodeCenter.x, nodeCenter.y);
    const currentScopeId = node.data.scopeId;
    
    // Clear drag state
    setDragOverScope(null);
    
    // If dropped in a different scope (or out of any scope), update assignment
    if (targetScopeId !== currentScopeId) {
      // Assign to new scope or remove from scope
      await handleAssignNodeToScope(
        node.id, 
        targetScopeId, 
        targetScopeId ? "HYPOTHETICAL" : "ASSERTED"
      );
    }
  }, [showScopeBoundaries, getScopeAtPosition, handleAssignNodeToScope]);

  // Helper to get epistemic scope context for composer
  const getEpistemicScopeContext = useCallback(() => {
    if (!hypotheticalMode) return undefined;
    return {
      scopeId: hypotheticalMode.scopeId,
      scopeType: hypotheticalMode.scopeType as any,
      assumption: hypotheticalMode.assumption,
      color: hypotheticalMode.color,
    };
  }, [hypotheticalMode]);

  // Open composer for supporting an argument
  const handleSupportNode = useCallback((nodeId: string, argumentId: string, conclusionText?: string) => {
    setComposerContext({
      mode: "support",
      targetNode: {
        nodeId,
        argumentId,
        conclusionText,
      },
      suggestedRole: "PREMISE",
      suggestedScheme: "SUPPORTS",
      epistemicScope: getEpistemicScopeContext(),
    });
    setShowComposer(true);
  }, [getEpistemicScopeContext]);

  // Open composer for attacking an argument (REBUTS)
  const handleAttackNode = useCallback((
    nodeId: string, 
    argumentId: string, 
    conclusionId?: string,
    conclusionText?: string,
    attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES" = "REBUTS"
  ) => {
    setComposerContext({
      mode: "attack",
      attackType,
      targetNode: {
        nodeId,
        argumentId,
        conclusionId,
        conclusionText,
      },
      suggestedRole: "OBJECTION",
      epistemicScope: getEpistemicScopeContext(),
    });
    setShowComposer(true);
  }, [getEpistemicScopeContext]);

  // Open composer for attacking an edge (UNDERCUTS)
  const handleAttackEdge = useCallback((edgeId: string, sourceNodeId: string, targetNodeId: string) => {
    setComposerContext({
      mode: "attack",
      attackType: "UNDERCUTS",
      targetEdge: {
        edgeId,
        sourceNodeId,
        targetNodeId,
      },
      suggestedRole: "OBJECTION",
      epistemicScope: getEpistemicScopeContext(),
    });
    setShowComposer(true);
  }, [getEpistemicScopeContext]);

  // === Scope Management Handlers ===
  
  // Create a new scope
  const handleCreateScope = useCallback(async (data: {
    scopeType: ScopeType;
    assumption: string;
    color?: string;
  }) => {
    setIsCreatingScope(true);
    try {
      const response = await fetch(`/api/argument-chains/${chainId}/scopes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create scope");
      }

      const newScope = await response.json();
      setScopes((prev) => [...prev, newScope]);
      setShowCreateScope(false);
    } catch (error) {
      console.error("Failed to create scope:", error);
      throw error;
    } finally {
      setIsCreatingScope(false);
    }
  }, [chainId]);

  // Delete a scope
  const handleDeleteScope = useCallback(async (scopeId: string) => {
    try {
      const response = await fetch(`/api/argument-chains/${chainId}/scopes/${scopeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete scope");
      }

      // Remove scope from state
      setScopes((prev) => prev.filter((s) => s.id !== scopeId));

      // Update nodes that were in this scope to remove scope reference
      const updatedNodes = nodes.map((node) => {
        if (node.data.scopeId === scopeId) {
          return {
            ...node,
            data: {
              ...node.data,
              scopeId: null,
              scope: null,
              epistemicStatus: "ASSERTED" as const,
            },
          };
        }
        return node;
      });
      setNodes(updatedNodes);
    } catch (error) {
      console.error("Failed to delete scope:", error);
    }
  }, [chainId, nodes, setNodes]);

  // Toggle scope collapse
  const handleToggleScopeCollapse = useCallback((scopeId: string) => {
    setCollapsedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(scopeId)) {
        newSet.delete(scopeId);
      } else {
        newSet.add(scopeId);
      }
      return newSet;
    });
  }, []);

  // Update scope (for editing)
  const handleUpdateScope = useCallback(async (scopeId: string, data: {
    assumption?: string;
    color?: string;
    description?: string;
  }) => {
    try {
      const response = await fetch(`/api/argument-chains/${chainId}/scopes/${scopeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update scope");
      }

      const updatedScope = await response.json();
      setScopes((prev) => prev.map((s) => s.id === scopeId ? updatedScope : s));
      
      // Update nodes that reference this scope
      const updatedNodes = nodes.map((node) => {
        if (node.data.scopeId === scopeId) {
          return {
            ...node,
            data: {
              ...node.data,
              scope: {
                id: updatedScope.id,
                scopeType: updatedScope.scopeType,
                assumption: updatedScope.assumption,
                color: updatedScope.color,
              },
            },
          };
        }
        return node;
      });
      setNodes(updatedNodes);
      setEditingScope(null);
    } catch (error) {
      console.error("Failed to update scope:", error);
      throw error;
    }
  }, [chainId, nodes, setNodes]);

  // Enter hypothetical mode for focused composition within a scope
  const enterHypotheticalMode = useCallback((scope: any) => {
    setHypotheticalMode({
      scopeId: scope.id,
      scopeType: scope.scopeType,
      assumption: scope.assumption,
      color: scope.color,
    });
    // Auto-show scopes panel when entering hypothetical mode
    setShowScopesPanel(true);
  }, []);

  // Exit hypothetical mode
  const exitHypotheticalMode = useCallback(() => {
    setHypotheticalMode(null);
  }, []);

  // Generate scope boundary nodes from scopes and node positions
  const generateScopeBoundaryNodes = useCallback(() => {
    if (!showScopeBoundaries || scopes.length === 0) return [];

    const PADDING = 40;
    const HEADER_HEIGHT = 50;
    const MIN_WIDTH = 320;
    const MIN_HEIGHT = 200;

    return scopes.map((scope) => {
      const isCollapsed = collapsedScopes.has(scope.id);
      
      // Find all nodes that belong to this scope
      const scopeNodes = nodes.filter((node) => 
        node.data.scopeId === scope.id && node.type === "argumentNode"
      );

      let boundingBox = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
      };

      // Calculate bounding box from node positions
      if (scopeNodes.length > 0) {
        scopeNodes.forEach((node) => {
          const nodeWidth = 280; // Approximate node width
          const nodeHeight = 120; // Approximate node height
          
          boundingBox.minX = Math.min(boundingBox.minX, node.position.x);
          boundingBox.minY = Math.min(boundingBox.minY, node.position.y);
          boundingBox.maxX = Math.max(boundingBox.maxX, node.position.x + nodeWidth);
          boundingBox.maxY = Math.max(boundingBox.maxY, node.position.y + nodeHeight);
        });
      } else {
        // Default position when scope has no nodes
        const existingScopeBounds = scopes
          .filter((s) => s.id !== scope.id)
          .map((s) => {
            const sNodes = nodes.filter((n) => n.data.scopeId === s.id);
            if (sNodes.length === 0) return null;
            return {
              x: Math.min(...sNodes.map((n) => n.position.x)),
              y: Math.min(...sNodes.map((n) => n.position.y)),
            };
          })
          .filter(Boolean);

        const baseX = existingScopeBounds.length > 0 
          ? Math.max(...existingScopeBounds.map((b) => b!.x)) + MIN_WIDTH + 100
          : 100;
        const baseY = 100;
        
        boundingBox = {
          minX: baseX,
          minY: baseY,
          maxX: baseX + MIN_WIDTH,
          maxY: baseY + MIN_HEIGHT,
        };
      }

      // Add padding around nodes
      const width = Math.max(MIN_WIDTH, boundingBox.maxX - boundingBox.minX + PADDING * 2);
      const height = isCollapsed 
        ? 60 
        : Math.max(MIN_HEIGHT, boundingBox.maxY - boundingBox.minY + PADDING * 2 + HEADER_HEIGHT);

      const scopeData: ScopeBoundaryData = {
        id: scope.id,
        scopeType: scope.scopeType,
        assumption: scope.assumption,
        description: scope.description,
        color: scope.color,
        collapsed: isCollapsed,
        nodeCount: scopeNodes.length,
        depth: scope.depth || 0,
        parentScopeId: scope.parentScopeId,
        // Visual state
        isDragOver: dragOverScope === scope.id,
        isHypotheticalMode: hypotheticalMode?.scopeId === scope.id,
        // Actions
        onEdit: (id) => setEditingScope(scopes.find((s) => s.id === id) || null),
        onDelete: handleDeleteScope,
        onAddNode: (id) => {
          // This could open a dialog to select nodes to add to scope
          setShowScopesPanel(true);
        },
        onToggleCollapse: handleToggleScopeCollapse,
        onEnterMode: (id) => {
          const scopeToEnter = scopes.find((s) => s.id === id);
          if (scopeToEnter) enterHypotheticalMode(scopeToEnter);
        },
      };

      return {
        id: `scope-${scope.id}`,
        type: "scopeBoundary",
        position: {
          x: boundingBox.minX - PADDING,
          y: boundingBox.minY - PADDING - HEADER_HEIGHT,
        },
        data: scopeData,
        style: {
          width,
          height,
          zIndex: -1, // Render behind argument nodes
        },
        selectable: true,
        draggable: false, // Scopes don't drag (nodes inside do)
      };
    });
  }, [scopes, nodes, collapsedScopes, showScopeBoundaries, dragOverScope, hypotheticalMode, handleDeleteScope, handleToggleScopeCollapse, enterHypotheticalMode]);

  // Handle argument created from composer
  const handleComposerCreated = useCallback(async (argument: any) => {
    // Add the new argument as a node
    try {
      // Build request body, including scope if in hypothetical mode
      const requestBody: any = {
        argumentId: argument.id,
        role: composerContext?.suggestedRole || "PREMISE",
      };
      
      // If in hypothetical mode, auto-assign to the active scope
      if (hypotheticalMode) {
        requestBody.scopeId = hypotheticalMode.scopeId;
        requestBody.epistemicStatus = "HYPOTHETICAL";
      }
      
      const response = await fetch(`/api/argument-chains/${chainId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const newNode = await response.json();
        
        // Add to ReactFlow - position within scope if in hypothetical mode
        let nodePosition = { 
          x: Math.random() * 300, 
          y: Math.random() * 300 
        };
        
        // If in hypothetical mode, position near other nodes in the scope
        if (hypotheticalMode) {
          const scopeNodes = nodes.filter((n) => n.data.scopeId === hypotheticalMode.scopeId);
          if (scopeNodes.length > 0) {
            const lastNode = scopeNodes[scopeNodes.length - 1];
            nodePosition = {
              x: lastNode.position.x + 50,
              y: lastNode.position.y + 150,
            };
          }
        }
        
        setNodes([
          ...nodes,
          {
            id: newNode.id,
            type: "argumentNode",
            position: nodePosition,
            data: {
              argument: argument,
              role: newNode.role,
              nodeOrder: newNode.nodeOrder,
              addedBy: newNode.contributor || null,
              // Include scope info if in hypothetical mode
              ...(hypotheticalMode && {
                scopeId: hypotheticalMode.scopeId,
                epistemicStatus: "HYPOTHETICAL" as const,
                scope: {
                  id: hypotheticalMode.scopeId,
                  scopeType: hypotheticalMode.scopeType as ScopeType,
                  assumption: hypotheticalMode.assumption,
                  color: hypotheticalMode.color ?? undefined,
                },
              }),
            },
          },
        ]);

        // Auto-create edge if we have a target
        if (composerContext?.targetNode?.nodeId) {
          const edgeType = composerContext.mode === "support" ? "SUPPORTS" : 
            composerContext.attackType || "REBUTS";
          
          const edgeResponse = await fetch(`/api/argument-chains/${chainId}/edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceNodeId: newNode.id,
              targetNodeId: composerContext.targetNode.nodeId,
              edgeType,
              strength: 1.0,
            }),
          });

          if (edgeResponse.ok) {
            const newEdge = await edgeResponse.json();
            setEdges([
              ...edges,
              {
                id: newEdge.id,
                source: newNode.id,
                target: composerContext.targetNode.nodeId,
                type: "chainEdge",
                data: {
                  edgeType: newEdge.edgeType,
                  strength: newEdge.strength,
                },
              },
            ]);
          }
        } else if (composerContext?.targetEdge?.edgeId) {
          // For edge attacks (undercuts), we need different handling
          // The new node attacks an edge, which requires special edge representation
          // For now, we'll create a node-to-target-node edge as UNDERCUTS
          const targetNodeId = composerContext.targetEdge.targetNodeId;
          
          const edgeResponse = await fetch(`/api/argument-chains/${chainId}/edges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceNodeId: newNode.id,
              targetNodeId: targetNodeId,
              edgeType: "UNDERCUTS",
              strength: 1.0,
              description: `Challenges inference in edge ${composerContext.targetEdge.edgeId}`,
            }),
          });

          if (edgeResponse.ok) {
            const newEdge = await edgeResponse.json();
            setEdges([
              ...edges,
              {
                id: newEdge.id,
                source: newNode.id,
                target: targetNodeId,
                type: "chainEdge",
                data: {
                  edgeType: newEdge.edgeType,
                  strength: newEdge.strength,
                  description: newEdge.description,
                },
              },
            ]);
          }
        }

        // Auto-layout after adding
        setTimeout(() => {
          const layouted = getLayoutedElements(
            [...nodes, { 
              id: newNode.id, 
              type: "argumentNode", 
              position: nodePosition, 
              data: { 
                argument, 
                role: newNode.role,
                nodeOrder: newNode.nodeOrder,
                addedBy: newNode.contributor || null,
              } 
            }],
            edges,
            "TB"
          );
          setNodes(layouted.nodes as Node<ChainNodeData>[]);
          setEdges(layouted.edges as Edge<ChainEdgeData>[]);
          fitView({ padding: 0.2, duration: 400 });
        }, 100);
      }
    } catch (error) {
      console.error("Failed to add node to chain:", error);
    }

    setShowComposer(false);
    setComposerContext(null);
  }, [chainId, composerContext, hypotheticalMode, nodes, edges, setNodes, setEdges, fitView]);

  // Auto-layout handler
  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(nodes, edges, "TB");
    setNodes(layouted.nodes as Node<ChainNodeData>[]);
    setEdges(layouted.edges as Edge<ChainEdgeData>[]);
    
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 400 });
    }, 50);
  }, [nodes, edges, setNodes, setEdges, fitView]);

  // Handle node highlighting from analysis panel
  const handleHighlightNodes = useCallback((nodeIds: string[]) => {
    setHighlightedNodes(nodeIds);
    
    // Clear highlights after 3 seconds
    setTimeout(() => {
      setHighlightedNodes([]);
    }, 3000);
    
    // Fit view to highlighted nodes if any exist
    if (nodeIds.length > 0) {
      const nodesToFit = nodes.filter((n) => nodeIds.includes(n.id));
      if (nodesToFit.length > 0) {
        fitView({ 
          nodes: nodesToFit,
          padding: 0.3,
          duration: 400,
        });
      }
    }
  }, [nodes, fitView]);

  // Show loading state
  if (isLoading) {
    return (
      <div ref={reactFlowWrapper} className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chain...</p>
        </div>
      </div>
    );
  }

  // Generate scope boundary nodes
  const scopeBoundaryNodes = generateScopeBoundaryNodes();

  // Combine argument nodes and scope boundary nodes
  const allNodes = [
    // Scope boundaries first (rendered behind)
    ...scopeBoundaryNodes,
    // Then argument nodes (with enhanced data)
    ...nodes.map((node) => ({
      ...node,
      // Add highlight styling and action handlers to node data
      data: {
        ...node.data,
        isHighlighted: highlightedNodes.includes(node.id),
        isEditable,
        onSupport: handleSupportNode,
        onAttack: handleAttackNode,
      },
      // Set parentNode if in a collapsed scope (hides it)
      ...(node.data.scopeId && collapsedScopes.has(node.data.scopeId) && { hidden: true }),
    })),
  ];

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative flex">
      {/* Main Canvas */}
      <div className={`flex-1 transition-all duration-300 ${showAnalysisPanel ? 'mr-96' : ''}`}>
        <ReactFlow
          nodes={allNodes as Node[]}
          edges={edges.map((edge) => ({
            ...edge,
            // Add targeted styling to edge data
            data: {
              ...edge.data,
              isTargeted: targetedEdgeId === edge.id,
              attackCount: edgeAttacks[edge.id] || 0,
              isEditable,
              onAttackEdge: handleAttackEdge,
            },
            // Update edge styling when targeted
            ...(targetedEdgeId === edge.id && {
              animated: true,
              style: { stroke: "#ef4444", strokeWidth: 3 },
            }),
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={isEditable}
          nodesConnectable={isEditable}
          elementsSelectable={true}
          defaultEdgeOptions={{
            type: "chainEdge",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: "#6b7280",
            },
            animated: false,
          }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background           variant={BackgroundVariant.Lines}
           color="#e5e7eb" gap={20} />

          <Controls showInteractive={isEditable} />
          <MiniMap
            nodeColor={(node) => {
              // Scope boundaries get their scope color
              if (node.type === "scopeBoundary") {
                const scopeData = node.data as unknown as ScopeBoundaryData;
                return scopeData.color || SCOPE_TYPE_CONFIG[scopeData.scopeType]?.color || "#f59e0b";
              }
              
              // Color minimap nodes by role
              const roleColors: Record<string, string> = {
                PREMISE: "#3b82f6",
                EVIDENCE: "#14b8a6",
                CONCLUSION: "#10b981",
                OBJECTION: "#ef4444",
                REBUTTAL: "#f97316",
                QUALIFIER: "#a855f7",
              };
              const role = (node.data as any)?.role || "PREMISE";
              return roleColors[role] || "#6b7280";
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            position="bottom-right"
          />
          
          {/* Control Panel */}
          {isEditable && (
            <Panel position="top-right" className="space-y-2">
              <div className="bg-white p-3 rounded-lg shadow-md space-y-2">
                {/* Hypothetical Mode Indicator */}
                {hypotheticalMode && (
                  <div
                    className="rounded-lg p-3 border-2"
                    style={{
                      backgroundColor: `${hypotheticalMode.color || "#f59e0b"}15`,
                      borderColor: hypotheticalMode.color || "#f59e0b",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor: hypotheticalMode.color || "#f59e0b",
                          color: "white",
                        }}
                      >
                        HYPOTHETICAL MODE
                      </span>
                      <button
                        onClick={exitHypotheticalMode}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Exit
                      </button>
                    </div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: hypotheticalMode.color || "#f59e0b" }}
                    >
                      {hypotheticalMode.assumption}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      New arguments will be added to this scope with hypothetical status.
                    </p>
                  </div>
                )}
                
                {/* Edge Attack Mode Toggle */}
                {edgeAttackMode ? (
                  <div className="bg-red-50 border border-red-200 rounded p-2">
                    <p className="text-xs text-red-700 font-medium mb-2">
                      🎯 Attack Mode: Click an edge to target it
                    </p>
                    <button
                      onClick={exitEdgeAttackMode}
                      className="w-full px-3 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
                    >
                      Exit Attack Mode
                    </button>
                    {targetedEdgeId && (
                      <p className="text-xs text-red-600 mt-2">
                        Edge targeted. Add argument to attack this inference.
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={enterEdgeAttackMode}
                    className="w-full px-3 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                  >
                    🎯 Attack Edge
                  </button>
                )}
                
                <AddNodeButton deliberationId={deliberationId} userId={currentUserId || undefined} />
                <ChainMetadataPanel />
                <ChainExportButton chainName={nodes.length > 0 ? "argument-chain" : undefined} />
                <button
                  onClick={handleAutoLayout}
                  className="w-full px-3 py-2 text-sm font-medium text-white bg-sky-600 rounded hover:bg-sky-700 transition-colors"
                >
                  Auto Layout
                </button>
                
                {/* Scopes Section */}
                <div className="border-t border-gray-200 pt-2 space-y-1.5">
                  <button
                    onClick={() => setShowScopesPanel(!showScopesPanel)}
                    className="w-full px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Layers className="h-4 w-4" />
                    {showScopesPanel ? "Hide Scopes" : `Scopes (${scopes.length})`}
                  </button>
                  
                  {scopes.length > 0 && (
                    <button
                      onClick={() => setShowScopeBoundaries(!showScopeBoundaries)}
                      className={`w-full px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 ${
                        showScopeBoundaries 
                          ? "text-amber-600 bg-amber-50 border border-amber-200 hover:bg-amber-100"
                          : "text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {showScopeBoundaries ? (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Boundaries Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Boundaries Hidden
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                <button
                  onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  {showAnalysisPanel ? (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      Hide Analysis
                    </>
                  ) : (
                    <>
                      <ChevronLeft className="h-4 w-4" />
                      Show Analysis
                    </>
                  )}
                </button>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Analysis Panel Sidebar */}
      {showAnalysisPanel && (
        <div className="absolute top-0 right-0 w-96 h-full bg-white border-l border-gray-200 shadow-xl overflow-y-auto z-10">
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="enablers">Enablers</TabsTrigger>
            </TabsList>
            
            <TabsContent value="analysis" className="mt-0">
              <ChainAnalysisPanel
                chainId={chainId}
                onHighlightNodes={handleHighlightNodes}
              />
            </TabsContent>
            
            <TabsContent value="enablers" className="mt-0 p-4">
              <EnablerPanel
                nodes={nodes}
                chainId={chainId}
                onHighlightNode={(nodeId) => handleHighlightNodes([nodeId])}
                onChallengeEnabler={(nodeId, schemeName, enablerText) => {
                  // Select the node to highlight it
                  setSelectedNode(nodeId);
                  handleHighlightNodes([nodeId]);
                  
                  // Show informational alert about challenging
                  alert(
                    `Challenging Inference Assumption\n\n` +
                    `Node: ${nodeId}\n` +
                    `Scheme: ${schemeName}\n\n` +
                    `Assumption to challenge:\n"${enablerText}"\n\n` +
                    `To challenge this assumption, you would create an UNDERCUTS attack ` +
                    `that targets the inference rule itself rather than the premises or conclusion.\n\n` +
                    `This feature will be fully integrated with recursive attack support in the next phase.`
                  );
                }}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Scopes Panel Sidebar */}
      {showScopesPanel && (
        <div className="absolute top-0 left-0 w-80 h-full bg-white border-r border-gray-200 shadow-xl overflow-y-auto z-10">
          <ScopesPanel
            scopes={scopes}
            nodes={nodes}
            activeScope={hypotheticalMode?.scopeId}
            onCreateScope={() => setShowCreateScope(true)}
            onEditScope={(scope: { id: string; scopeType: ScopeType; assumption: string; description?: string; color?: string; nodeCount: number; }) => setEditingScope(scope)}
            onDeleteScope={handleDeleteScope}
            onAssignNodeToScope={handleAssignNodeToScope}
            onEnterMode={enterHypotheticalMode}
            onExitMode={exitHypotheticalMode}
            onHighlightNode={(nodeId: string) => handleHighlightNodes([nodeId])}
            onClose={() => setShowScopesPanel(false)}
          />
        </div>
      )}

      {/* Connection Editor Modal */}
      <ConnectionEditor />

      {/* Create Scope Dialog */}
      <CreateScopeDialog
        open={showCreateScope}
        onOpenChange={setShowCreateScope}
        onSubmit={handleCreateScope}
        isLoading={isCreatingScope}
      />

      {/* Edit Scope Dialog */}
      {editingScope && (
        <EditScopeDialog
          open={!!editingScope}
          onOpenChange={(open) => !open && setEditingScope(null)}
          scope={editingScope}
          onSubmit={(data) => handleUpdateScope(editingScope.id, data)}
        />
      )}

      {/* Chain Argument Composer for contextual argument creation */}
      {currentUserId && deliberationId && (
        <ChainArgumentComposer
          open={showComposer}
          onOpenChange={(open) => {
            setShowComposer(open);
            if (!open) setComposerContext(null);
          }}
          context={composerContext || undefined}
          deliberationId={deliberationId}
          userId={currentUserId}
          chainId={chainId}
          onCreated={handleComposerCreated}
        />
      )}
    </div>
  );
};

const ArgumentChainCanvas: React.FC<ArgumentChainCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ArgumentChainCanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default ArgumentChainCanvas;
