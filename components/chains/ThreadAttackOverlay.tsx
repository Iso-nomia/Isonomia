/**
 * ThreadAttackOverlay Component
 * Displays attack relationships as visual overlays on thread view
 * 
 * Task 1.9: Handle attack overlays in thread view
 */

"use client";

import React, { useMemo } from "react";
import { Swords, Target, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ===== Types =====

export type AttackType = "REBUTS" | "UNDERCUTS" | "UNDERMINES";

export interface AttackRelation {
  id: string;
  sourceArgumentId: string;
  targetArgumentId: string;
  attackType: AttackType;
  sourceNodeId?: string;
  targetNodeId?: string;
}

export interface ThreadAttackOverlayProps {
  /** List of attack relations to display */
  attacks: AttackRelation[];
  
  /** Map of argument IDs to their DOM element refs or positions */
  argumentPositions?: Map<string, { top: number; bottom: number }>;
  
  /** Currently highlighted attack ID */
  highlightedAttackId?: string;
  
  /** Callback when user clicks on an attack line */
  onAttackClick?: (attack: AttackRelation) => void;
  
  /** Show attack labels */
  showLabels?: boolean;
  
  /** Compact mode */
  compact?: boolean;
}

// ===== Attack Type Config =====

const attackTypeConfig: Record<AttackType, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}> = {
  REBUTS: {
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: <Swords className="w-3 h-3" />,
    label: "Rebuts",
    description: "Attacks the conclusion directly",
  },
  UNDERCUTS: {
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: <Target className="w-3 h-3" />,
    label: "Undercuts",
    description: "Attacks the inference/reasoning",
  },
  UNDERMINES: {
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "Undermines",
    description: "Attacks a premise",
  },
};

// ===== Attack Badge Component =====

interface AttackBadgeProps {
  attack: AttackRelation;
  onClick?: () => void;
  highlighted?: boolean;
  compact?: boolean;
}

export function AttackBadge({ attack, onClick, highlighted, compact }: AttackBadgeProps) {
  const config = attackTypeConfig[attack.attackType];

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border transition-all duration-150",
        config.bgColor,
        config.borderColor,
        config.color,
        highlighted ? "ring-2 ring-offset-1 ring-red-400 shadow-md" : "hover:shadow-sm",
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"
      )}
      title={config.description}
    >
      {config.icon}
      <span className="font-medium">{config.label}</span>
    </button>
  );
}

// ===== Attack Indicator (for inline display) =====

interface AttackIndicatorProps {
  attackType: AttackType;
  count?: number;
  onClick?: () => void;
  compact?: boolean;
}

export function AttackIndicator({ attackType, count = 1, onClick, compact }: AttackIndicatorProps) {
  const config = attackTypeConfig[attackType];

  return (
    <div
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded border cursor-pointer",
        "transition-all duration-150 hover:shadow-sm",
        config.bgColor,
        config.borderColor,
        config.color,
        compact ? "px-1 py-0.5 text-[8px]" : "px-1.5 py-0.5 text-[9px]"
      )}
      title={`${count} ${config.label.toLowerCase()} attack${count !== 1 ? "s" : ""}`}
    >
      {config.icon}
      {count > 1 && <span className="font-bold">{count}</span>}
    </div>
  );
}

// ===== Attack Line (SVG connector) =====

interface AttackLineProps {
  startY: number;
  endY: number;
  attackType: AttackType;
  highlighted?: boolean;
  onClick?: () => void;
}

export function AttackLine({ startY, endY, attackType, highlighted, onClick }: AttackLineProps) {
  const config = attackTypeConfig[attackType];
  const lineColor = attackType === "REBUTS" ? "#dc2626" : attackType === "UNDERCUTS" ? "#d97706" : "#475569";
  const midY = (startY + endY) / 2;

  return (
    <g onClick={onClick} className="cursor-pointer">
      {/* Connector line */}
      <path
        d={`M 0 ${startY} Q -20 ${midY} 0 ${endY}`}
        fill="none"
        stroke={lineColor}
        strokeWidth={highlighted ? 3 : 2}
        strokeDasharray={attackType === "UNDERCUTS" ? "4,2" : undefined}
        className="transition-all duration-150"
        opacity={highlighted ? 1 : 0.6}
      />
      
      {/* Arrow head */}
      <polygon
        points={`0,${endY} -6,${endY - 4} -6,${endY + 4}`}
        fill={lineColor}
        opacity={highlighted ? 1 : 0.6}
      />
      
      {/* Attack type icon at midpoint */}
      <foreignObject x={-30} y={midY - 10} width={20} height={20}>
        <div className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center",
          config.bgColor,
          "border",
          config.borderColor
        )}>
          {config.icon}
        </div>
      </foreignObject>
    </g>
  );
}

// ===== Attack Summary Panel =====

interface AttackSummaryProps {
  attacks: AttackRelation[];
  onAttackClick?: (attack: AttackRelation) => void;
}

export function AttackSummary({ attacks, onAttackClick }: AttackSummaryProps) {
  const grouped = useMemo(() => {
    const result: Record<AttackType, AttackRelation[]> = {
      REBUTS: [],
      UNDERCUTS: [],
      UNDERMINES: [],
    };
    attacks.forEach((a) => {
      if (result[a.attackType]) {
        result[a.attackType].push(a);
      }
    });
    return result;
  }, [attacks]);

  if (attacks.length === 0) return null;

  return (
    <div className="p-2 bg-red-50/50 border border-red-100 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Swords className="w-4 h-4 text-red-500" />
        <span className="text-xs font-medium text-red-700">
          {attacks.length} Attack{attacks.length !== 1 ? "s" : ""} in Chain
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {Object.entries(grouped).map(([type, list]) => {
          if (list.length === 0) return null;
          return (
            <AttackIndicator
              key={type}
              attackType={type as AttackType}
              count={list.length}
              onClick={() => list[0] && onAttackClick?.(list[0])}
            />
          );
        })}
      </div>
    </div>
  );
}

// ===== Main Overlay Component =====

export function ThreadAttackOverlay({
  attacks,
  argumentPositions,
  highlightedAttackId,
  onAttackClick,
  showLabels = true,
  compact = false,
}: ThreadAttackOverlayProps) {
  // Group attacks by target for inline display
  const attacksByTarget = useMemo(() => {
    const map = new Map<string, AttackRelation[]>();
    attacks.forEach((attack) => {
      const existing = map.get(attack.targetArgumentId) || [];
      existing.push(attack);
      map.set(attack.targetArgumentId, existing);
    });
    return map;
  }, [attacks]);

  // If no positions provided, render as summary
  if (!argumentPositions || argumentPositions.size === 0) {
    return <AttackSummary attacks={attacks} onAttackClick={onAttackClick} />;
  }

  // Calculate SVG dimensions
  const positions = Array.from(argumentPositions.values());
  const maxY = Math.max(...positions.map((p) => p.bottom), 0);

  return (
    <div className="relative">
      {/* SVG overlay for attack lines */}
      <svg
        className="absolute left-0 top-0 pointer-events-none"
        width={40}
        height={maxY}
        style={{ overflow: "visible" }}
      >
        {attacks.map((attack) => {
          const sourcePos = argumentPositions.get(attack.sourceArgumentId);
          const targetPos = argumentPositions.get(attack.targetArgumentId);
          
          if (!sourcePos || !targetPos) return null;
          
          return (
            <AttackLine
              key={attack.id}
              startY={sourcePos.top + (sourcePos.bottom - sourcePos.top) / 2}
              endY={targetPos.top + (targetPos.bottom - targetPos.top) / 2}
              attackType={attack.attackType}
              highlighted={attack.id === highlightedAttackId}
              onClick={() => onAttackClick?.(attack)}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ===== Inline Attack Markers (for ThreadNode) =====

interface InlineAttackMarkersProps {
  argumentId: string;
  attacks: AttackRelation[];
  position: "incoming" | "outgoing";
  onAttackClick?: (attack: AttackRelation) => void;
  compact?: boolean;
}

export function InlineAttackMarkers({
  argumentId,
  attacks,
  position,
  onAttackClick,
  compact,
}: InlineAttackMarkersProps) {
  const relevantAttacks = attacks.filter((a) =>
    position === "incoming"
      ? a.targetArgumentId === argumentId
      : a.sourceArgumentId === argumentId
  );

  if (relevantAttacks.length === 0) return null;

  return (
    <div className={cn(
      "flex items-center gap-1 flex-wrap",
      position === "incoming" ? "justify-start" : "justify-end"
    )}>
      {position === "incoming" && (
        <span className="text-[9px] text-red-500 font-medium mr-1">
          Attacked by:
        </span>
      )}
      {relevantAttacks.map((attack) => (
        <AttackBadge
          key={attack.id}
          attack={attack}
          onClick={() => onAttackClick?.(attack)}
          compact={compact}
        />
      ))}
      {position === "outgoing" && (
        <span className="text-[9px] text-slate-500 font-medium ml-1">
          <ArrowRight className="w-3 h-3 inline" /> attacks
        </span>
      )}
    </div>
  );
}

export default ThreadAttackOverlay;
