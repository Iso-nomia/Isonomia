"use client";

/**
 * DDS Phase 2: Plays List Component
 * 
 * Displays plays from a strategy with selection support.
 */

import * as React from "react";

type Action = {
  focus: string;
  ramification: number[];
  polarity: "P" | "O";
  actId?: string;
};

type Play = {
  id: string;
  sequence: Action[];
  length: number;
  isPositive: boolean;
};

export function PlaysList({
  plays,
  selectedPlayId,
  onSelectPlay,
  maxHeight = "16rem",
}: {
  plays: Play[];
  selectedPlayId?: string;
  onSelectPlay?: (play: Play) => void;
  maxHeight?: string;
}) {
  if (plays.length === 0) {
    return (
      <div className="text-xs text-slate-500 p-4 text-center">
        No plays in strategy
      </div>
    );
  }

  return (
    <div className="plays-list space-y-2">
      <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
        <span>Plays in Strategy</span>
        <span className="font-normal text-slate-500">({plays.length})</span>
      </div>

      <div
        className="space-y-1 overflow-y-auto"
        style={{ maxHeight }}
      >
        {plays.map((play, idx) => (
          <PlayItem
            key={play.id}
            play={play}
            index={idx}
            isSelected={play.id === selectedPlayId}
            onSelect={() => onSelectPlay?.(play)}
          />
        ))}
      </div>
    </div>
  );
}

function PlayItem({
  play,
  index,
  isSelected,
  onSelect,
}: {
  play: Play;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2 rounded border transition text-xs ${
        isSelected
          ? "bg-sky-50 border-sky-300 ring-1 ring-sky-300"
          : "bg-white hover:bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-slate-700">Play {index + 1}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            play.isPositive
              ? "bg-sky-100 text-sky-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {play.isPositive ? "+" : "−"}
        </span>
      </div>
      <div className="text-[10px] text-slate-500">
        Length: {play.length} action{play.length !== 1 ? "s" : ""}
      </div>
      {play.sequence.length > 0 && (
        <div className="mt-1 text-[10px] font-mono text-slate-400 truncate">
          {play.sequence.map((a) => a.focus).join(" → ")}
        </div>
      )}
    </button>
  );
}

/**
 * Compact play badge for inline display
 */
export function PlayBadge({
  play,
  onClick,
}: {
  play: Play;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs transition ${
        play.isPositive
          ? "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
          : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
      }`}
    >
      <span className="font-medium">{play.isPositive ? "+" : "−"}</span>
      <span className="font-mono">{play.length}</span>
    </button>
  );
}

/**
 * Play detail view with full action sequence
 */
export function PlayDetail({
  play,
  onClose,
}: {
  play: Play;
  onClose?: () => void;
}) {
  return (
    <div className="play-detail border rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-800">
          Play Detail
          <span
            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
              play.isPositive
                ? "bg-sky-100 text-sky-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {play.isPositive ? "Positive" : "Negative"}
          </span>
        </h4>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            ✕
          </button>
        )}
      </div>

      <div className="text-xs text-slate-600 mb-2">
        Length: {play.length} action{play.length !== 1 ? "s" : ""}
      </div>

      <div className="space-y-1">
        {play.sequence.map((action, idx) => (
          <ActionItem key={idx} action={action} index={idx} />
        ))}
      </div>
    </div>
  );
}

function ActionItem({ action, index }: { action: Action; index: number }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-slate-50 text-xs">
      <span className="text-slate-400 w-4">{index + 1}</span>
      <span
        className={`px-1.5 py-0.5 rounded font-bold ${
          action.polarity === "P"
            ? "bg-sky-100 text-sky-700"
            : "bg-rose-100 text-rose-700"
        }`}
      >
        {action.polarity}
      </span>
      <code className="font-mono text-slate-700">{action.focus}</code>
      {action.ramification.length > 0 && (
        <span className="text-slate-500">
          → [{action.ramification.join(", ")}]
        </span>
      )}
    </div>
  );
}

/**
 * Statistics about plays in a strategy
 */
export function PlaysStats({
  plays,
}: {
  plays: Play[];
}) {
  if (plays.length === 0) {
    return null;
  }

  const lengths = plays.map((p) => p.length);
  const maxLength = Math.max(...lengths);
  const minLength = Math.min(...lengths);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const positiveCount = plays.filter((p) => p.isPositive).length;

  return (
    <div className="plays-stats grid grid-cols-4 gap-2 text-center">
      <StatCard label="Total" value={plays.length} />
      <StatCard label="Positive" value={positiveCount} color="sky" />
      <StatCard
        label="Negative"
        value={plays.length - positiveCount}
        color="rose"
      />
      <StatCard label="Avg Length" value={avgLength.toFixed(1)} />
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: "sky" | "rose";
}) {
  const colorClass = color
    ? color === "sky"
      ? "text-sky-700"
      : "text-rose-700"
    : "text-slate-700";

  return (
    <div className="p-2 rounded bg-slate-50 border border-slate-200">
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

export default PlaysList;
