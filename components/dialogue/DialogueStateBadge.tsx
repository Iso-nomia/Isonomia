// components/dialogue/DialogueStateBadge.tsx
"use client";
import * as React from "react";
import { Check, X, Clock, AlertCircle } from "lucide-react";

interface DialogueStateBadgeProps {
  deliberationId: string;
  argumentId: string;
  // Optional: Pre-fetched state (avoids API call)
  initialState?: {
    totalAttacks: number;
    answeredAttacks: number;
    moveComplete: boolean;
    lastResponseAt?: string;
  };
}

/**
 * Displays dialogue state for an argument:
 * - Green check: All attacks answered (moveComplete = true)
 * - Yellow clock: Some attacks answered (partial)
 * - Red X: No attacks answered
 * - Tooltip shows details (X/Y attacks answered)
 * 
 * Phase 3.1: Dialogue tracking visualization.
 */
export function DialogueStateBadge({
  deliberationId,
  argumentId,
  initialState,
}: DialogueStateBadgeProps) {
  const [state, setState] = React.useState(initialState);
  const [loading, setLoading] = React.useState(!initialState);

  React.useEffect(() => {
    if (initialState) return; // Use pre-fetched data

    const fetchState = async () => {
      try {
        const res = await fetch(
          `/api/deliberations/${deliberationId}/dialogue-state?argumentId=${argumentId}`
        );
        if (res.ok) {
          const data = await res.json();
          setState(data.state);
        }
      } catch (err) {
        console.error("Failed to fetch dialogue state:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchState();
  }, [deliberationId, argumentId, initialState]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Clock className="w-3 h-3 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!state) return null;

  const { totalAttacks, answeredAttacks, moveComplete } = state;

  // Hide badge if no attacks exist (nothing to track)
  if (totalAttacks === 0) return null;

  // Determine badge color and icon
  const badge = moveComplete
    ? { icon: Check, color: "text-green-600 bg-green-50 border-green-200", label: "Complete" }
    : answeredAttacks > 0
    ? { icon: Clock, color: "text-yellow-600 bg-yellow-50 border-yellow-200", label: "Partial" }
    : { icon: X, color: "text-red-600 bg-red-50 border-red-200", label: "Pending" };

  const Icon = badge.icon;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${badge.color}`}
      title={`${answeredAttacks}/${totalAttacks} attacks answered`}
    >
      <Icon className="w-3 h-3" />
      <span>{answeredAttacks}/{totalAttacks}</span>
    </div>
  );
}
