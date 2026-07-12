"use client";

import * as React from "react";
import { ViewDebugger } from "./ViewDebugger";
import { DisputeTraceViewer } from "./DisputeTraceViewer";
import { ChronicleNavigator } from "./ChronicleNavigator";
import type { AnalysisTool } from "./types";

function ToolCard({
  icon,
  title,
  description,
  active,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`tool-card text-left p-4 rounded-lg border-2 transition ${
        active
          ? "border-indigo-500 bg-indigo-50"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm font-bold text-slate-800 mb-1">{title}</div>
      <div className="text-xs text-slate-600">{description}</div>
    </button>
  );
}

export function AnalysisDashboard({ designId }: { designId: string }) {
  const [activeTool, setActiveTool] = React.useState<AnalysisTool>(null);

  return (
    <div className="analysis-dashboard space-y-4">
      {/* Tool selector */}
      <div className="tool-selector grid grid-cols-3 gap-3">
        <ToolCard
          icon="🔍"
          title="View Debugger"
          description="Step through views and analyze positions"
          active={activeTool === "view-debugger"}
          onClick={() => setActiveTool("view-debugger")}
        />
        <ToolCard
          icon="🎬"
          title="Dispute Trace"
          description="Playback disputes step-by-step"
          active={activeTool === "dispute-trace"}
          onClick={() => setActiveTool("dispute-trace")}
        />
        <ToolCard
          icon="🧭"
          title="Chronicle Navigator"
          description="Explore chronicles and branches"
          active={activeTool === "chronicle-nav"}
          onClick={() => setActiveTool("chronicle-nav")}
        />
      </div>

      {/* Active tool */}
      <div className="active-tool">
        {activeTool === "view-debugger" && (
          <ViewDebugger designId={designId} />
        )}
        {activeTool === "dispute-trace" && (
          <DisputeTraceViewer designId={designId} />
        )}
        {activeTool === "chronicle-nav" && (
          <ChronicleNavigator designId={designId} />
        )}
        {!activeTool && (
          <div className="empty-state border rounded-lg p-12 text-center bg-slate-50">
            <div className="text-4xl mb-3">🛠</div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              Select a debugging tool
            </div>
            <div className="text-xs text-slate-600">
              Choose from view debugger, dispute trace, or chronicle navigator
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
