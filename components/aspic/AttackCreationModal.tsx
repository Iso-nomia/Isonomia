// components/aspic/AttackCreationModal.tsx
"use client";

import * as React from "react";
import { X, Swords, Info } from "lucide-react";

interface AttackCreationModalProps {
  deliberationId: string;
  targetType: "claim" | "argument";
  targetId: string;
  targetText: string;
  onClose: () => void;
  onCreated?: () => void;
}

type AttackType = "UNDERMINES" | "REBUTS" | "UNDERCUTS";

/**
 * AttackCreationModal
 * 
 * Phase F: Direct attack creation UI for ASPIC+ attacks
 * Allows users to create undermining, rebutting, or undercutting attacks
 * without going through the CQ flow.
 */
export function AttackCreationModal({
  deliberationId,
  targetType,
  targetId,
  targetText,
  onClose,
  onCreated,
}: AttackCreationModalProps) {
  const [attackType, setAttackType] = React.useState<AttackType>("UNDERMINES");
  const [attackerType, setAttackerType] = React.useState<"claim" | "argument">("claim");
  const [selectedAttackerId, setSelectedAttackerId] = React.useState<string>("");
  const [availableAttackers, setAvailableAttackers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadingAttackers, setLoadingAttackers] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch available attackers (claims or arguments)
  React.useEffect(() => {
    const fetchAttackers = async () => {
      setLoadingAttackers(true);
      try {
        const endpoint = attackerType === "claim"
          ? `/api/deliberations/${deliberationId}/claims`
          : `/api/arguments?deliberationId=${deliberationId}`;
        
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error("Failed to fetch attackers");
        
        const data = await res.json();
        // Both endpoints return { items: [...] } or array directly
        setAvailableAttackers(data.items || data || []);
      } catch (err: any) {
        console.error("Failed to fetch attackers:", err);
        setError(err.message);
      } finally {
        setLoadingAttackers(false);
      }
    };

    fetchAttackers();
  }, [deliberationId, attackerType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAttackerId) {
      setError("Please select an attacker");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create ConflictApplication via /api/ca
      const payload: any = {
        deliberationId,
        legacyAttackType: attackType,
        legacyTargetScope: attackType === "UNDERMINES" ? "premise" : attackType === "UNDERCUTS" ? "inference" : "conclusion",
        metaJson: {
          createdVia: "attack-creation-ui",
          attackType,
        },
      };

      // Set attacker
      if (attackerType === "claim") {
        payload.conflictingClaimId = selectedAttackerId;
      } else {
        payload.conflictingArgumentId = selectedAttackerId;
      }

      // Set target
      if (targetType === "claim") {
        payload.conflictedClaimId = targetId;
      } else {
        payload.conflictedArgumentId = targetId;
      }

      const res = await fetch("/api/ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create attack");
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error("Failed to create attack:", err);
      setError(err.message || "Failed to create attack");
    } finally {
      setLoading(false);
    }
  };

  const attackTypeInfo = {
    UNDERMINES: {
      label: "Undermining Attack",
      description: "Attack an ordinary premise (K_p) or assumption (K_a)",
      color: "purple",
      icon: "🎯",
      targetScope: "premise",
      example: "Challenge the foundation of the argument",
    },
    REBUTS: {
      label: "Rebutting Attack",
      description: "Attack a defeasible conclusion",
      color: "red",
      icon: "⚔️",
      targetScope: "conclusion",
      example: "Provide a contradictory conclusion",
    },
    UNDERCUTS: {
      label: "Undercutting Attack",
      description: "Attack the applicability of a defeasible rule",
      color: "orange",
      icon: "🔪",
      targetScope: "inference",
      example: "Challenge the reasoning itself",
    },
  };

  const currentAttackInfo = attackTypeInfo[attackType];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Create ASPIC+ Attack
              </h2>
              <p className="text-xs text-slate-600">
                Phase F: Direct attack specification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target Info */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-600 mb-1">
                Attack Target ({targetType}):
              </div>
              <div className="text-sm text-slate-900 font-medium">
                {targetText}
              </div>
            </div>

            {/* Attack Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Attack Type
              </label>
              <div className="space-y-2">
                {(Object.keys(attackTypeInfo) as AttackType[]).map((type) => {
                  const info = attackTypeInfo[type];
                  const isSelected = attackType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAttackType(type)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? `border-${info.color}-500 bg-${info.color}-50`
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{info.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-slate-900 mb-1">
                            {info.label}
                          </div>
                          <div className="text-xs text-slate-600 mb-1">
                            {info.description}
                          </div>
                          <div className="text-xs text-slate-500 italic">
                            {info.example}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Attacker Type Toggle */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Attacker Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAttackerType("claim");
                    setSelectedAttackerId("");
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    attackerType === "claim"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Claim
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttackerType("argument");
                    setSelectedAttackerId("");
                  }}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    attackerType === "argument"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Argument
                </button>
              </div>
            </div>

            {/* Attacker Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Attacker {attackerType === "claim" ? "Claim" : "Argument"}
              </label>
              {loadingAttackers ? (
                <div className="p-4 text-center text-sm text-slate-600">
                  Loading {attackerType}s...
                </div>
              ) : (
                <select
                  value={selectedAttackerId}
                  onChange={(e) => setSelectedAttackerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Select {attackerType} --</option>
                  {availableAttackers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.text || item.conclusion?.text || `${attackerType} ${item.id}`}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Choose the {attackerType} that will attack the target
              </p>
            </div>

            {/* ASPIC+ Info */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-xs text-amber-900">
                  <strong>ASPIC+ Semantics:</strong> This attack will be evaluated in the ASPIC+ framework.
                  {attackType === "UNDERMINES" && " Undermining attacks on assumptions (K_a) always succeed, while attacks on ordinary premises (K_p) depend on preferences."}
                  {attackType === "REBUTS" && " Rebutting attacks on defeasible conclusions depend on rule preferences."}
                  {attackType === "UNDERCUTS" && " Undercutting attacks on defeasible rules always succeed."}
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={loading || !selectedAttackerId}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Creating Attack..." : "Create Attack"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
