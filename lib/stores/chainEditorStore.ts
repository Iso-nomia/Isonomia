import { create } from "zustand";
import { Node, Edge, OnNodesChange, OnEdgesChange, applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import { ChainNodeData, ChainEdgeData } from "@/lib/types/argumentChain";

interface ChainEditorState {
  // Canvas state
  nodes: Node<ChainNodeData>[];
  edges: Edge<ChainEdgeData>[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  
  // Recursive attack mode
  edgeAttackMode: boolean;
  targetedEdgeId: string | null;
  
  // UI state
  showConnectionEditor: boolean;
  pendingConnection: {
    sourceNodeId: string;
    targetNodeId: string;
  } | null;
  
  // Metadata
  chainId: string | null;
  chainName: string;
  chainType: "SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH";
  isPublic: boolean;
  isEditable: boolean;
  
  // Actions
  setNodes: (nodes: Node<ChainNodeData>[]) => void;
  setEdges: (edges: Edge<ChainEdgeData>[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  
  addNode: (node: Node<ChainNodeData>) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<ChainNodeData>) => void;
  
  addEdge: (edge: Edge<ChainEdgeData>) => void;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, data: Partial<ChainEdgeData>) => void;
  
  setSelectedNode: (nodeId: string | null) => void;
  setSelectedEdge: (edgeId: string | null) => void;
  
  // Recursive attack mode actions
  enterEdgeAttackMode: () => void;
  exitEdgeAttackMode: () => void;
  setTargetedEdge: (edgeId: string | null) => void;
  
  openConnectionEditor: (sourceId: string, targetId: string) => void;
  closeConnectionEditor: () => void;
  
  setChainMetadata: (metadata: {
    chainId?: string;
    chainName?: string;
    chainType?: "SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH";
    isPublic?: boolean;
    isEditable?: boolean;
  }) => void;
  
  reset: () => void;
}

const initialState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  edgeAttackMode: false,
  targetedEdgeId: null,
  showConnectionEditor: false,
  pendingConnection: null,
  chainId: null,
  chainName: "",
  chainType: "SERIAL" as const,
  isPublic: false,
  isEditable: false,
};

export const useChainEditorStore = create<ChainEditorState>((set, get) => ({
  ...initialState,
  
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as Node<ChainNodeData>[],
    });
  },
  
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges) as Edge<ChainEdgeData>[],
    });
  },
  
  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },
  
  removeNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },
  
  updateNode: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      ),
    }));
  },
  
  addEdge: (edge) => {
    set((state) => ({
      edges: [...state.edges, edge],
    }));
  },
  
  removeEdge: (edgeId) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
      selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
    }));
  },
  
  updateEdge: (edgeId, data) => {
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...data } as ChainEdgeData } : e
      ),
    }));
  },
  
  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId, selectedEdgeId: null });
  },
  
  setSelectedEdge: (edgeId) => {
    set({ selectedEdgeId: edgeId, selectedNodeId: null });
  },
  
  enterEdgeAttackMode: () => {
    set({ edgeAttackMode: true, targetedEdgeId: null });
  },
  
  exitEdgeAttackMode: () => {
    set({ edgeAttackMode: false, targetedEdgeId: null });
  },
  
  setTargetedEdge: (edgeId) => {
    set({ targetedEdgeId: edgeId });
  },
  
  openConnectionEditor: (sourceId, targetId) => {
    set({
      showConnectionEditor: true,
      pendingConnection: { sourceNodeId: sourceId, targetNodeId: targetId },
    });
  },
  
  closeConnectionEditor: () => {
    set({
      showConnectionEditor: false,
      pendingConnection: null,
    });
  },
  
  setChainMetadata: (metadata) => {
    set(metadata);
  },
  
  reset: () => set(initialState),
}));
