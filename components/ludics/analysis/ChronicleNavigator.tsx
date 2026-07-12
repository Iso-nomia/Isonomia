"use client";

import * as React from "react";
import useSWR from "swr";
import type { ChronicleViewMode } from "./types";

// API-returned chronicle shape rendered by this navigator (distinct from the
// proof-theoretic dds Chronicle type).
type Chronicle = {
  id?: string;
  designId?: string;
  sequence?: any[];
  isMaximal?: boolean;
  length?: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ViewModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-[10px] rounded font-medium transition ${
        active
          ? "bg-violet-600 text-white"
          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-box border rounded p-2 bg-white text-center">
      <div className="text-[10px] text-slate-600">{label}</div>
      <div className="text-lg font-bold text-slate-800">{value}</div>
    </div>
  );
}

function ChronicleTreeView({ chronicle }: { chronicle: Chronicle }) {
  const sequence = chronicle.sequence || [];

  return (
    <div className="chronicle-tree space-y-3">
      <div className="text-xs font-semibold text-slate-800">Tree Structure</div>

      <div className="tree-visualization border rounded p-3 bg-slate-50">
        <div className="space-y-2">
          {sequence.map((action: any, idx: number) => (
            <div
              key={idx}
              className="tree-node flex items-center gap-2"
              style={{ marginLeft: `${idx * 12}px` }}
            >
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <div className="text-xs font-mono text-slate-700">
                {action.focus}
              </div>
              <div
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  action.polarity === "P"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {action.polarity}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chronicle metadata */}
      <div className="metadata border rounded p-3 bg-white">
        <div className="text-xs font-semibold text-slate-700 mb-2">Metadata</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Length:</span>
            <span className="text-slate-800 font-mono">
              {sequence.length || chronicle.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Maximal:</span>
            <span className="text-slate-800">
              {chronicle.isMaximal ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Design ID:</span>
            <span className="text-slate-800 font-mono text-[10px]">
              {chronicle.designId?.slice(0, 8)}...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChronicleListView({ chronicle }: { chronicle: Chronicle }) {
  const sequence = chronicle.sequence || [];

  return (
    <div className="chronicle-list space-y-3">
      <div className="text-xs font-semibold text-slate-800">
        Sequential Actions
      </div>

      <div className="actions-list space-y-2">
        {sequence.map((action: any, idx: number) => (
          <div key={idx} className="action-item border rounded p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-semibold text-slate-700">
                Action {idx + 1}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  action.polarity === "P"
                    ? "bg-sky-100 text-sky-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {action.polarity}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Focus:</span>
                <span className="font-mono text-slate-800">{action.focus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ramification:</span>
                <span className="font-mono text-slate-800">
                  [{action.ramification?.join(", ")}]
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChronicleGraphView({ chronicle }: { chronicle: Chronicle }) {
  const sequence = chronicle.sequence || [];

  return (
    <div className="chronicle-graph space-y-3">
      <div className="text-xs font-semibold text-slate-800">
        Graph Representation
      </div>

      <div className="graph-container border rounded p-4 bg-slate-50 h-64 flex items-center justify-center">
        <div className="text-xs text-slate-500 italic">
          Graph visualization would render here using D3.js or similar
        </div>
      </div>

      {/* Graph statistics */}
      <div className="graph-stats grid grid-cols-3 gap-2">
        <StatBox label="Nodes" value={sequence.length || chronicle.length || 0} />
        <StatBox label="Depth" value={sequence.length || chronicle.length || 0} />
        <StatBox label="Branches" value={1} />
      </div>
    </div>
  );
}

export function ChronicleNavigator({
  designId,
  strategyId,
}: {
  designId?: string;
  strategyId?: string;
}) {
  const [selectedChronicle, setSelectedChronicle] =
    React.useState<Chronicle | null>(null);
  const [viewMode, setViewMode] = React.useState<ChronicleViewMode>("tree");

  // Fetch chronicles
  const { data: chroniclesData } = useSWR(
    designId
      ? `/api/ludics/dds/chronicles?designId=${designId}`
      : strategyId
      ? `/api/ludics/dds/correspondence/ch?strategyId=${strategyId}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const chronicles = (chroniclesData?.chronicles || []) as Chronicle[];

  return (
    <div className="chronicle-navigator border rounded-lg bg-white">
      {/* Header */}
      <div className="navigator-header flex items-center justify-between p-3 border-b bg-slate-50">
        <h3 className="text-sm font-bold text-slate-800">Chronicle Navigator</h3>

        <div className="view-mode-selector flex gap-1">
          <ViewModeButton
            active={viewMode === "tree"}
            onClick={() => setViewMode("tree")}
          >
            🌳 Tree
          </ViewModeButton>
          <ViewModeButton
            active={viewMode === "list"}
            onClick={() => setViewMode("list")}
          >
            📋 List
          </ViewModeButton>
          <ViewModeButton
            active={viewMode === "graph"}
            onClick={() => setViewMode("graph")}
          >
            📊 Graph
          </ViewModeButton>
        </div>
      </div>

      <div className="navigator-content flex h-96">
        {/* Chronicles sidebar */}
        <div className="chronicles-sidebar w-64 border-r overflow-y-auto">
          <div className="p-2 border-b bg-slate-50">
            <div className="text-xs font-semibold text-slate-700">
              Chronicles ({chronicles.length})
            </div>
          </div>
          <div className="space-y-1 p-2">
            {chronicles.map((chronicle, idx) => (
              <button
                key={chronicle.id || idx}
                onClick={() => setSelectedChronicle(chronicle)}
                className={`w-full text-left p-2 rounded text-xs transition ${
                  selectedChronicle?.id === chronicle.id
                    ? "bg-violet-100 border border-violet-300 text-violet-800"
                    : "bg-slate-50 hover:bg-slate-100 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold">Chr {idx + 1}</span>
                  {chronicle.isMaximal && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">
                      MAX
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-600">
                  {chronicle.sequence?.length || chronicle.length || 0} actions
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main view area */}
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedChronicle ? (
            <>
              {viewMode === "tree" && (
                <ChronicleTreeView chronicle={selectedChronicle} />
              )}
              {viewMode === "list" && (
                <ChronicleListView chronicle={selectedChronicle} />
              )}
              {viewMode === "graph" && (
                <ChronicleGraphView chronicle={selectedChronicle} />
              )}
            </>
          ) : (
            <div className="text-xs text-slate-500 italic text-center py-16">
              Select a chronicle to navigate
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
