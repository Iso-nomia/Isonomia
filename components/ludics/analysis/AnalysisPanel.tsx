"use client";

import * as React from "react";
import { ViewsExplorer } from "./ViewsExplorer";
import { ChroniclesExplorer } from "./ChroniclesExplorer";
import { AnalysisOverview } from "./AnalysisOverview";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { TypeSystemPanel } from "./TypeSystemPanel";
import { SaturationPanel } from "./SaturationPanel";
import { BehaviourPanel } from "./BehaviourPanel";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { StrategyInspector } from "../StrategyInspector";
import { CorrespondenceViewer } from "../CorrespondenceViewer";
import type { LudicsAnalysisState, AnalysisSection } from "./types";

type ExtendedAnalysisSection = AnalysisSection | "types" | "behaviours" | "performance";

function TabButton({
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
      className={`px-3 py-1.5 text-xs rounded font-medium transition ${
        active
          ? "bg-white text-slate-800 border border-slate-200 shadow-sm"
          : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

export function AnalysisPanel({
  designId,
  deliberationId,
  analysisState,
  onAnalysisUpdate,
}: {
  designId: string;
  deliberationId: string;
  analysisState: LudicsAnalysisState;
  onAnalysisUpdate: (update: Partial<LudicsAnalysisState>) => void;
}) {
  const [activeSection, setActiveSection] = React.useState<ExtendedAnalysisSection>("overview");

  return (
    <div className="analysis-panel h-full flex flex-col">
      {/* Section Selector */}
      <div className="section-tabs flex flex-wrap gap-2 border-b p-2 bg-slate-50">
        <TabButton
          active={activeSection === "overview"}
          onClick={() => setActiveSection("overview")}
        >
          📊 Overview
        </TabButton>
        <TabButton
          active={activeSection === "views"}
          onClick={() => setActiveSection("views")}
        >
          👁 Views
        </TabButton>
        <TabButton
          active={activeSection === "chronicles"}
          onClick={() => setActiveSection("chronicles")}
        >
          📜 Chronicles
        </TabButton>
        <TabButton
          active={activeSection === "strategy"}
          onClick={() => setActiveSection("strategy")}
        >
          ♟ Strategy
        </TabButton>
        <TabButton
          active={activeSection === "correspondence"}
          onClick={() => setActiveSection("correspondence")}
        >
          ≅ Correspondence
        </TabButton>
        {/* Phase 5 Tabs */}
        <TabButton
          active={activeSection === "types"}
          onClick={() => setActiveSection("types")}
        >
          τ Types
        </TabButton>
        <TabButton
          active={activeSection === "behaviours"}
          onClick={() => setActiveSection("behaviours")}
        >
          ⊥ Behaviours
        </TabButton>
        <TabButton
          active={activeSection === "performance"}
          onClick={() => setActiveSection("performance")}
        >
          📈 Perf
        </TabButton>
        <TabButton
          active={activeSection === "debugger"}
          onClick={() => setActiveSection("debugger")}
        >
          🔧 Debugger
        </TabButton>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeSection === "overview" && (
          <AnalysisOverview designId={designId} deliberationId={deliberationId} />
        )}

        {activeSection === "views" && (
          <ViewsExplorer
            deliberationId={deliberationId}
            designId={designId}
            selectedView={analysisState.selectedView}
            onSelectView={(view: any) => onAnalysisUpdate({ selectedView: view })}
          />
        )}

        {activeSection === "chronicles" && (
          <ChroniclesExplorer
            designId={designId}
            deliberationId={deliberationId}
            selectedChronicle={analysisState.selectedChronicle as any}
            onSelectChronicle={(chr: any) => onAnalysisUpdate({ selectedChronicle: chr })}
          />
        )}

        {activeSection === "strategy" && (
          <StrategyInspector designId={designId} />
        )}

        {activeSection === "correspondence" && (
          <CorrespondenceViewer
            designId={designId}
            deliberationId={deliberationId}
            strategyId={analysisState.correspondence.strategyId}
            onStrategyChange={(strategyId) =>
              onAnalysisUpdate({
                correspondence: { ...analysisState.correspondence, strategyId }
              })
            }
          />
        )}

        {/* Phase 5: Types */}
        {activeSection === "types" && (
          <div className="space-y-4">
            <TypeSystemPanel
              designId={designId}
              deliberationId={deliberationId}
              strategyId={analysisState.correspondence.strategyId}
            />
            <SaturationPanel
              designId={designId}
              deliberationId={deliberationId}
              strategyId={analysisState.correspondence.strategyId}
            />
          </div>
        )}

        {/* Phase 5: Behaviours */}
        {activeSection === "behaviours" && (
          <BehaviourPanel
            designId={designId}
            deliberationId={deliberationId}
            strategyId={analysisState.correspondence.strategyId}
            onStrategyChange={(strategyId) =>
              onAnalysisUpdate({
                correspondence: { ...analysisState.correspondence, strategyId }
              })
            }
          />
        )}

        {/* Phase 5: Performance */}
        {activeSection === "performance" && (
          <PerformanceMonitor
            designId={designId}
            sessionId={designId}
          />
        )}

        {activeSection === "debugger" && (
          <AnalysisDashboard designId={designId} />
        )}
      </div>
    </div>
  );
}
