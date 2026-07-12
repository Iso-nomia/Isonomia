// components/dialogue/AnsweredAttacksPanel.tsx
"use client";
import * as React from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface Attack {
  attackId: string;
  attackerTitle: string;
  attackType: "rebut" | "undercut" | "concede";
  answered: boolean;
  responseId?: string;
  responseTitle?: string;
}

interface AnsweredAttacksPanelProps {
  deliberationId: string;
  argumentId: string;
}

/**
 * Displays a list of all attacks on an argument,
 * showing which have been answered (GROUNDS response exists).
 * 
 * Phase 3.1: Dialogue tracking visualization.
 */
export function AnsweredAttacksPanel({
  deliberationId,
  argumentId,
}: AnsweredAttacksPanelProps) {
  const [attacks, setAttacks] = React.useState<Attack[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchAttacks = async () => {
      try {
        const res = await fetch(
          `/api/deliberations/${deliberationId}/dialogue-state?argumentId=${argumentId}`
        );
        if (res.ok) {
          const data = await res.json();
          setAttacks(data.state.attacks || []);
        }
      } catch (err) {
        console.error("Failed to fetch attacks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttacks();
  }, [deliberationId, argumentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Clock className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (attacks.length === 0) {
    return (
      <div className="text-sm text-slate-500 p-4 text-center">
        No attacks on this argument.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-700">
        Attacks & Responses ({attacks.filter(a => a.answered).length}/{attacks.length} answered)
      </h4>

      <div className="space-y-1">
        {attacks.map((attack) => (
          <div
            key={attack.attackId}
            className={`flex items-start gap-2 p-2 rounded border ${
              attack.answered
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {attack.answered ? (
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">
                  {attack.attackType.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">
                  from &ldquo;{attack.attackerTitle}&rdquo;
                </span>
              </div>

              {attack.answered && attack.responseTitle && (
                <div className="text-xs text-slate-600 mt-1">
                  → Answered by &ldquo;{attack.responseTitle}&rdquo;
                </div>
              )}

              {!attack.answered && (
                <div className="text-xs text-slate-500 mt-1 italic">
                  No GROUNDS response yet
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
