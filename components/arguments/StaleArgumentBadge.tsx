// components/arguments/StaleArgumentBadge.tsx
"use client";
import * as React from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { daysSinceUpdate, calculateDecayFactor } from "@/lib/confidence/decayConfidence";

interface StaleArgumentBadgeProps {
  lastUpdatedAt: Date | string;
  decayConfig?: {
    halfLife: number;
    minConfidence: number;
  };
}

/**
 * Enhanced stale argument indicator with decay factor display.
 * Phase 3.2: Temporal decay visualization.
 */
export function StaleArgumentBadge({
  lastUpdatedAt,
  decayConfig = { halfLife: 90, minConfidence: 0.1 },
}: StaleArgumentBadgeProps) {
  const date = typeof lastUpdatedAt === "string" ? new Date(lastUpdatedAt) : lastUpdatedAt;
  const days = daysSinceUpdate(date);
  const decayFactor = calculateDecayFactor(days, decayConfig);
  
  // Severity levels
  const severity =
    days > 90 ? "critical" : days > 30 ? "warning" : "normal";

  if (days <= 7) return null; // Don't show for recent arguments

  const severityStyles = {
    critical: {
      icon: AlertTriangle,
      color: "text-red-600 bg-red-50 border-red-200",
      label: "Critically Stale",
    },
    warning: {
      icon: Clock,
      color: "text-yellow-600 bg-yellow-50 border-yellow-200",
      label: "Stale",
    },
    normal: {
      icon: Clock,
      color: "text-slate-600 bg-slate-50 border-slate-200",
      label: "Aging",
    },
  };

  const style = severityStyles[severity];
  const Icon = style.icon;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${style.color}`}
      title={`Last updated ${days} days ago. Decay factor: ${decayFactor.toFixed(2)}× (half-life: ${decayConfig.halfLife} days)`}
    >
      <Icon className="w-3 h-3" />
      <span>{days}d old</span>
      <span className="text-[10px] opacity-75">
        ({(decayFactor * 100).toFixed(0)}%)
      </span>
    </div>
  );
}
