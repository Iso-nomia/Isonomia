"use client";

import * as React from "react";
import type { Action, View } from "@/packages/ludics-core/dds/types";

interface ViewInspectorProps {
  view: View | Action[];
  player: "P" | "O";
  showExpressions?: boolean;
  showTimestamps?: boolean;
  className?: string;
  onActionClick?: (action: Action, index: number) => void;
}

/**
 * ViewInspector - Displays a player's view of the interaction
 * 
 * A view shows what actions are "visible" to a player at a given point
 * in the dispute. This is key to understanding innocence (same view → same response).
 */
export function ViewInspector({
  view,
  player,
  showExpressions = true,
  showTimestamps = false,
  className = "",
  onActionClick,
}: ViewInspectorProps) {
  const sequence = Array.isArray(view) ? view : view.sequence;

  const playerColors = {
    P: {
      bg: "bg-sky-100",
      text: "text-sky-700",
      border: "border-sky-200",
      badge: "bg-sky-600 text-white",
    },
    O: {
      bg: "bg-rose-100",
      text: "text-rose-700",
      border: "border-rose-200",
      badge: "bg-rose-600 text-white",
    },
  };

  const colors = playerColors[player];

  return (
    <div
      className={`view-inspector border rounded-lg p-3 ${colors.border} bg-white/70 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${colors.badge}`}
        >
          {player === "P" ? "Proponent" : "Opponent"} View
        </span>
        <span className="text-xs text-slate-600">
          {sequence.length} action{sequence.length !== 1 ? "s" : ""} visible
        </span>
      </div>

      {/* Action list */}
      <div className="space-y-1.5">
        {sequence.length === 0 ? (
          <div className="text-xs text-slate-500 italic">Empty view</div>
        ) : (
          sequence.map((action, idx) => (
            <ActionItem
              key={idx}
              action={action}
              index={idx}
              viewerPlayer={player}
              showExpression={showExpressions}
              showTimestamp={showTimestamps}
              onClick={onActionClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ActionItemProps {
  action: Action;
  index: number;
  viewerPlayer: "P" | "O";
  showExpression?: boolean;
  showTimestamp?: boolean;
  onClick?: (action: Action, index: number) => void;
}

function ActionItem({
  action,
  index,
  viewerPlayer,
  showExpression,
  showTimestamp,
  onClick,
}: ActionItemProps) {
  const isOwnAction = action.polarity === viewerPlayer;

  return (
    <button
      className={`w-full text-left text-xs font-mono p-2 rounded transition-colors ${
        isOwnAction
          ? "bg-slate-50 hover:bg-slate-100"
          : "bg-white hover:bg-slate-50"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
      onClick={() => onClick?.(action, index)}
      disabled={!onClick}
    >
      <div className="flex items-center gap-2">
        {/* Index */}
        <span className="text-slate-400 w-4">{index + 1}.</span>

        {/* Polarity badge */}
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            action.polarity === "P"
              ? "bg-sky-100 text-sky-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {action.polarity}
        </span>

        {/* Focus (address) */}
        <code className="text-slate-700">{action.focus}</code>

        {/* Ramification */}
        {action.ramification.length > 0 && (
          <span className="text-slate-500">
            → [{action.ramification.join(", ")}]
          </span>
        )}

        {/* Timestamp */}
        {showTimestamp && action.ts !== undefined && (
          <span className="text-slate-400 text-[10px] ml-auto">
            t={action.ts}
          </span>
        )}
      </div>

      {/* Expression */}
      {showExpression && action.expression && (
        <div className="mt-1 ml-6 text-slate-600 text-[11px] truncate">
          "{action.expression}"
        </div>
      )}
    </button>
  );
}

/**
 * DualViewInspector - Shows both P and O views side by side
 */
interface DualViewInspectorProps {
  proponentView: Action[];
  opponentView: Action[];
  className?: string;
}

export function DualViewInspector({
  proponentView,
  opponentView,
  className = "",
}: DualViewInspectorProps) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <ViewInspector view={proponentView} player="P" />
      <ViewInspector view={opponentView} player="O" />
    </div>
  );
}

export default ViewInspector;
