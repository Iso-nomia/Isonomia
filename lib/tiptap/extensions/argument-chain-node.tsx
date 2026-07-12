// lib/tiptap/extensions/argument-chain-node.tsx
//
// D4 Week 1–2 — Living Thesis × Argument Chain integration.
//
// TipTap atom-block node that embeds an ArgumentChain inside a thesis
// document. Mirrors `claim-node.tsx`:
//   • out-of-context (e.g. snapshot rendering) it falls back to the
//     attrs cached at insert time;
//   • inside `<ThesisLiveProvider>` it overlays live aggregate stats from
//     `useThesisLiveObject(chainId)` and routes click → `openInspector`.
//
// Heavy lifting (ReactFlow render, lazy node fetch, optional EnablerPanel
// toggle) lives in `components/thesis/ArgumentChainEmbedView.tsx` so the
// extension stays small and tree-shakable.

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import React from "react";
import { Network, Layers } from "lucide-react";
import { LiveBadgeStrip } from "@/lib/thesis/LiveBadgeStrip";
import {
  useOpenInspector,
  useThesisLiveObject,
} from "@/lib/thesis/ThesisLiveContext";
import { ArgumentChainEmbedView } from "@/components/thesis/ArgumentChainEmbedView";

export type ChainEmbedRole =
  | "MAIN"
  | "SUPPORTING"
  | "OBJECTION_TARGET"
  | "COMPARISON";

interface ChainNodeAttrs {
  chainId: string;
  chainName: string;
  caption?: string | null;
  role: ChainEmbedRole;
  /** Show the EnablerPanel toggle in the embed (optional). */
  showEnabler?: boolean;
  /** Optional list of node ids to highlight inside the embed. */
  highlightNodes?: string[];
}

const ROLE_LABEL: Record<ChainEmbedRole, string> = {
  MAIN: "Main reconstruction",
  SUPPORTING: "Supporting analysis",
  OBJECTION_TARGET: "Objection target",
  COMPARISON: "Comparison",
};

const ROLE_BADGE_CLASS: Record<ChainEmbedRole, string> = {
  MAIN: "bg-indigo-100 text-indigo-800",
  SUPPORTING: "bg-emerald-100 text-emerald-800",
  OBJECTION_TARGET: "bg-rose-100 text-rose-800",
  COMPARISON: "bg-amber-100 text-amber-800",
};

function ArgumentChainNodeView({ node }: NodeViewProps) {
  const attrs = node.attrs as ChainNodeAttrs;
  const { chainId, chainName, caption, role, showEnabler, highlightNodes } =
    attrs;

  const liveStats = useThesisLiveObject(chainId);
  const openInspector = useOpenInspector();

  const handleOpen = () => {
    if (!chainId) return;
    openInspector({ kind: "chain", id: chainId, tab: "overview" });
  };

  return (
    <NodeViewWrapper
      as="div"
      className="argument-chain-embed not-prose my-4"
      data-chain-id={chainId}
    >
      <div className="rounded-lg border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header (clickable → open inspector) */}
        <div
          className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpen();
            }
          }}
        >
          <Network className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Layers className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Argument Chain
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE_CLASS[role]}`}
                title={ROLE_LABEL[role]}
              >
                {ROLE_LABEL[role]}
              </span>
            </div>
            <p className="text-slate-900 font-semibold leading-snug truncate">
              {chainName || "Untitled chain"}
            </p>
            {caption && (
              <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                {caption}
              </p>
            )}
            <div
              className="mt-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <LiveBadgeStrip
                id={chainId}
                kind="chain"
                fallbackLabel={undefined}
                hideLabel
              />
              {liveStats && (
                <span className="ml-2 text-[10px] text-slate-500">
                  {liveStats.attackCount > 0
                    ? `${liveStats.undefendedAttackCount}/${liveStats.attackCount} undefended`
                    : "No attacks"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Readonly canvas (lazy-loaded) */}
        <ArgumentChainEmbedView
          chainId={chainId}
          showEnabler={!!showEnabler}
          highlightNodeIds={highlightNodes ?? []}
        />
      </div>
    </NodeViewWrapper>
  );
}

export const ArgumentChainNode = Node.create({
  name: "argumentChainNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chainId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-chain-id"),
        renderHTML: (attributes) => ({
          "data-chain-id": attributes.chainId,
        }),
      },
      chainName: { default: "" },
      caption: { default: null },
      role: { default: "MAIN" as ChainEmbedRole },
      showEnabler: { default: false },
      highlightNodes: { default: [] as string[] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="argument-chain-node"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "argument-chain-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArgumentChainNodeView);
  },
});
