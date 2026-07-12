"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * LudicsActionsToolbar — Action buttons for Ludics operations
 * 
 * Phase 2: Task 2.4
 * Extracted from LudicsPanel.tsx (lines ~830-920)
 * Updated Task 2.5: Using Tabs from @/components/ui
 */

interface LudicsActionsToolbarProps {
  onCompile: (phase?: string) => Promise<void>;
  onStep: () => Promise<void>;
  onAppendDaimon?: () => Promise<void>;
  onCheckOrthogonal: () => Promise<void>;
  onAnalyzeNLI?: () => Promise<void>;
  onCheckStable?: () => Promise<void>;
  busy?: string | null;
  showGuide?: boolean;
  onToggleGuide?: () => void;
  showAttach?: boolean;
  onToggleAttach?: () => void;
  phase?: string;
  onPhaseChange?: (phase: string) => void;
  viewMode?: string;
  onViewModeChange?: (mode: string) => void;
}

export function LudicsActionsToolbar({
  onCompile,
  onStep,
  onAppendDaimon,
  onCheckOrthogonal,
  onAnalyzeNLI,
  onCheckStable,
  busy = null,
  showGuide = false,
  onToggleGuide,
  showAttach = false,
  onToggleAttach,
  phase = "neutral",
  onPhaseChange,
  viewMode = "unified",
  onViewModeChange,
}: LudicsActionsToolbarProps) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* Phase selector */}
        {onPhaseChange && (
          <Tabs
            value={phase}
            onValueChange={(v) => {
              onPhaseChange(v);
              onCompile(v);
            }}
          >
            <TabsList>
              <TabsTrigger value="neutral">Neutral</TabsTrigger>
              <TabsTrigger value="focus-P">Focus P</TabsTrigger>
              <TabsTrigger value="focus-O">Focus O</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        {/* View mode selector */}
        {onViewModeChange && (
          <Tabs value={viewMode} onValueChange={onViewModeChange}>
            <TabsList>
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Primary actions */}
        <button
          className="btnv2"
          aria-label="Compile from moves (c)"
          onClick={() => onCompile("neutral")}
          disabled={!!busy}
          title="Keyboard: c"
        >
          {busy === "compile" ? "Compiling…" : "Compile"}
        </button>
        
        <button
          className="btnv2"
          aria-label="Step interaction (s)"
          onClick={onStep}
          disabled={!!busy}
          title="Keyboard: s"
        >
          {busy === "step" ? "Stepping…" : "Step"}
        </button>
        
        {onAppendDaimon && (
          <button
            className="btnv2"
            aria-label="Append daimon to next"
            onClick={onAppendDaimon}
            disabled={!!busy}
          >
            {busy === "append" ? "Working…" : "Append †"}
          </button>
        )}
        
        <button
          className="btnv2"
          aria-label="Check orthogonality (o)"
          onClick={onCheckOrthogonal}
          disabled={!!busy}
          title="Keyboard: o"
        >
          {busy === "orth" ? "Checking…" : "Orthogonality"}
        </button>
        
        {onAnalyzeNLI && (
          <button
            className="btnv2"
            aria-label="Analyze NLI (n)"
            onClick={onAnalyzeNLI}
            disabled={!!busy}
            title="Keyboard: n"
          >
            {busy === "nli" ? "Analyzing…" : "NLI"}
          </button>
        )}

        {/* Secondary actions */}
        {onToggleGuide && (
          <button
            className="btnv2 btnv2--ghost"
            aria-label="Toggle trace log (l)"
            onClick={onToggleGuide}
            title="Keyboard: l"
          >
            {showGuide ? "Hide log" : "Trace log"}
          </button>
        )}
        
        {onCheckStable && (
          <button
            className="btnv2 btnv2--ghost"
            aria-label="Stable sets"
            onClick={onCheckStable}
          >
            Stable sets
          </button>
        )}
        
        {onToggleAttach && (
          <button
            className="btnv2 btnv2--ghost"
            onClick={onToggleAttach}
            aria-expanded={showAttach}
          >
            {showAttach ? "Hide testers" : "Attach testers"}
          </button>
        )}
      </div>
      
      {/* Keyboard shortcuts hint */}
      <div className="mt-2 text-[10px] text-slate-500">
        Keyboard: <kbd>c</kbd> compile · <kbd>s</kbd> step · <kbd>o</kbd> orthogonality · <kbd>n</kbd> NLI · <kbd>l</kbd> log
      </div>
    </div>
  );
}
