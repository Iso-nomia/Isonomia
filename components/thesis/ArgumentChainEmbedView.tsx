// components/thesis/ArgumentChainEmbedView.tsx
//
// D4 Week 1–2 — readonly ArgumentChain visualization embedded inside a
// Living Thesis document.
//
// Renders a compact ReactFlow canvas that lazy-loads its data from
// /api/argument-chains/[chainId]/nodes. Click a node → opens the thesis
// inspector drawer (when mounted under <ThesisLiveProvider>) at the
// argument tab; otherwise no-ops gracefully.
//
// Intentionally NOT reusing `ArgumentChainCanvas` because that component
// mutates the global Zustand chain-editor store, which would conflict if
// multiple chains are embedded inside one thesis.

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  type Node as RFNode,
  type Edge as RFEdge,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, AlertCircle } from "lucide-react";
import { useOpenInspector } from "@/lib/thesis/ThesisLiveContext";

interface RawChainNode {
  id: string;
  argumentId: string;
  nodeOrder: number;
  role: string | null;
  positionX: number | null;
  positionY: number | null;
  argument: {
    id: string;
    text?: string | null;
    conclusion?: { id: string; text: string } | null;
  };
}

interface RawChainEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  strength: number;
  description: string | null;
}

interface NodeData extends Record<string, unknown> {
  label: string;
  role: string | null;
  argumentId: string;
  highlighted: boolean;
  onOpen: (argumentId: string) => void;
}

const ROLE_COLOR: Record<string, string> = {
  PREMISE: "border-sky-300 bg-sky-50",
  EVIDENCE: "border-emerald-300 bg-emerald-50",
  CONCLUSION: "border-indigo-300 bg-indigo-50",
  OBJECTION: "border-rose-300 bg-rose-50",
  REBUTTAL: "border-amber-300 bg-amber-50",
  QUALIFIER: "border-violet-300 bg-violet-50",
  COMMENT: "border-slate-300 bg-slate-50",
};

const EDGE_TYPE_LABEL: Record<string, string> = {
  SUPPORTS: "supports",
  ATTACKS: "attacks",
  REBUTS: "rebuts",
  UNDERMINES: "undermines",
  UNDERCUTS: "undercuts",
  PRESUPPOSES: "presupposes",
  ELABORATES: "elaborates",
  CONCLUDES: "concludes",
  EXEMPLIFIES: "exemplifies",
  QUALIFIES: "qualifies",
};

function EmbedArgumentNode({ data }: NodeProps) {
  const d = data as NodeData;
  const palette = (d.role && ROLE_COLOR[d.role]) || ROLE_COLOR.COMMENT;
  return (
    <div
      className={`rounded-md border-2 ${palette} px-2.5 py-1.5 shadow-sm cursor-pointer hover:shadow transition-shadow ${
        d.highlighted ? "ring-2 ring-amber-400" : ""
      }`}
      style={{ maxWidth: 220, minWidth: 120 }}
      onClick={(e) => {
        e.stopPropagation();
        d.onOpen(d.argumentId);
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {d.role && (
        <div className="text-[9px] uppercase tracking-wider font-semibold text-slate-500 mb-0.5">
          {d.role}
        </div>
      )}
      <div className="text-[11px] text-slate-900 leading-snug line-clamp-3">
        {d.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const NODE_TYPES = { argumentNode: EmbedArgumentNode };

export interface ArgumentChainEmbedViewProps {
  chainId: string;
  showEnabler?: boolean;
  highlightNodeIds?: string[];
  /** Fixed canvas height; defaults to 280px which fits a couple rows of nodes. */
  height?: number;
}

interface FetchState {
  status: "idle" | "loading" | "ok" | "error";
  nodes: RawChainNode[];
  edges: RawChainEdge[];
  error?: string;
}

function ArgumentChainEmbedViewInner({
  chainId,
  highlightNodeIds = [],
  height = 280,
}: ArgumentChainEmbedViewProps) {
  const [state, setState] = useState<FetchState>({
    status: "idle",
    nodes: [],
    edges: [],
  });
  const openInspector = useOpenInspector();

  useEffect(() => {
    if (!chainId) return;
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    fetch(`/api/argument-chains/${chainId}/nodes`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || "Failed to load chain");
        if (cancelled) return;
        setState({
          status: "ok",
          nodes: (json.nodes ?? []) as RawChainNode[],
          edges: (json.edges ?? []) as RawChainEdge[],
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          nodes: [],
          edges: [],
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [chainId]);

  const highlightSet = useMemo(
    () => new Set(highlightNodeIds),
    [highlightNodeIds],
  );

  const handleOpen = (argumentId: string) =>
    openInspector({ kind: "argument", id: argumentId, tab: "overview" });

  const rfNodes: RFNode<NodeData>[] = useMemo(() => {
    return state.nodes.map((n, idx) => {
      const x = typeof n.positionX === "number" ? n.positionX : (idx % 4) * 240;
      const y = typeof n.positionY === "number" ? n.positionY : Math.floor(idx / 4) * 110;
      const text =
        n.argument?.text?.trim() ||
        n.argument?.conclusion?.text?.trim() ||
        "(no text)";
      return {
        id: n.id,
        type: "argumentNode",
        position: { x, y },
        data: {
          label: text,
          role: n.role,
          argumentId: n.argumentId,
          highlighted: highlightSet.has(n.id),
          onOpen: handleOpen,
        },
        draggable: false,
        selectable: false,
        connectable: false,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nodes, highlightSet]);

  const rfEdges: RFEdge[] = useMemo(() => {
    return state.edges.map((e) => {
      const isAttack = ["ATTACKS", "REBUTS", "UNDERMINES", "UNDERCUTS"].includes(
        e.edgeType,
      );
      return {
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        label: EDGE_TYPE_LABEL[e.edgeType] ?? e.edgeType.toLowerCase(),
        type: "default",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke: isAttack ? "#e11d48" : "#64748b",
          strokeWidth: 1.5,
        },
        labelStyle: { fontSize: 10, fill: "#475569" },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.85 },
      };
    });
  }, [state.edges]);

  return (
    <div
      className="relative w-full bg-slate-50/40"
      style={{ height }}
      // Stop TipTap from intercepting pointer events on the canvas.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {state.status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading chain…
        </div>
      )}
      {state.status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-600 gap-2">
          <AlertCircle className="w-4 h-4" /> {state.error || "Failed to load"}
        </div>
      )}
      {state.status === "ok" && rfNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          (Chain has no nodes yet.)
        </div>
      )}
      {state.status === "ok" && rfNodes.length > 0 && (
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      )}
    </div>
  );
}

export function ArgumentChainEmbedView(props: ArgumentChainEmbedViewProps) {
  return (
    <ReactFlowProvider>
      <ArgumentChainEmbedViewInner {...props} />
    </ReactFlowProvider>
  );
}

export default ArgumentChainEmbedView;
