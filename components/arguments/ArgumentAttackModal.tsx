// components/arguments/ArgumentAttackModal.tsx
"use client";

import * as React from "react";
import { X, Swords, Info, ChevronDown, PlusCircle } from "lucide-react";

interface ArgumentAttackModalProps {
  deliberationId: string;
  argumentId: string;
  conclusion: { id: string; text: string };
  premises: Array<{ id: string; text: string }>;
  schemeKey?: string | null;
  schemeName?: string | null;
  onClose: () => void;
  onCreated?: () => void;
}

type AttackType = "REBUTS" | "UNDERMINES" | "UNDERCUTS";

/**
 * ArgumentAttackModal
 * 
 * Unified attack creation modal at ArgumentCardV2 header level.
 * Provides full argument context for ASPIC+ attacks:
 * 
 * - REBUTS: Auto-targets the conclusion claim
 * - UNDERMINES: Dropdown to select specific premise claim
 * - UNDERCUTS: Targets the argument's inference/scheme
 * 
 * This replaces individual ClaimDetailPanel attack buttons with a single
 * argument-level entry point that has full structural awareness.
 */
export function ArgumentAttackModal({
  deliberationId,
  argumentId,
  conclusion,
  premises,
  schemeKey,
  schemeName,
  onClose,
  onCreated,
}: ArgumentAttackModalProps) {
  const [attackType, setAttackType] = React.useState<AttackType>("REBUTS");
  const [selectedPremiseId, setSelectedPremiseId] = React.useState<string>(premises[0]?.id || "");
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

    if (attackType === "UNDERMINES" && !selectedPremiseId) {
      setError("Please select a premise to undermine");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Determine target based on attack type
      let targetClaimId: string;
      let targetScope: string;

      if (attackType === "REBUTS") {
        // Target the conclusion claim
        targetClaimId = conclusion.id;
        targetScope = "conclusion";
      } else if (attackType === "UNDERMINES") {
        // Target the selected premise claim
        targetClaimId = selectedPremiseId;
        targetScope = "premise";
      } else {
        // UNDERCUTS - target the argument itself (no specific claim)
        targetClaimId = ""; // Will use conflictedArgumentId instead
        targetScope = "inference";
      }

      // Create ConflictApplication via /api/ca
      const payload: any = {
        deliberationId,
        legacyAttackType: attackType,
        legacyTargetScope: targetScope,
        metaJson: {
          createdVia: "argument-attack-modal",
          attackType,
          targetArgumentId: argumentId,
          schemeKey: schemeKey || null,
          schemeName: schemeName || null,
        },
      };

      // Set attacker
      if (attackerType === "claim") {
        payload.conflictingClaimId = selectedAttackerId;
      } else {
        payload.conflictingArgumentId = selectedAttackerId;
      }

      // Set target
      if (attackType === "UNDERCUTS") {
        // Undercuts target the argument's inference
        payload.conflictedArgumentId = argumentId;
      } else {
        // Rebuts/Undermines target specific claims
        payload.conflictedClaimId = targetClaimId;
        payload.conflictedArgumentId = argumentId; // Include for context
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

      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent("argument:attacked", { 
        detail: { argumentId, attackType } 
      }));

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
    REBUTS: {
      label: "Rebut",
      description: "Challenge the conclusion claim",
      color: "red",
      bgClass: "bg-rose-50",
      borderClass: "border-rose-200",
      textClass: "text-rose-700",
      hoverClass: "hover:bg-rose-100",
      icon: "⚔️",
      targetScope: "conclusion",
      example: "Provide a contradictory conclusion claim",
    },
    UNDERMINES: {
      label: "Undermine",
      description: "Challenge a premise claim",
      color: "purple",
      bgClass: "bg-purple-50",
      borderClass: "border-purple-200",
      textClass: "text-purple-700",
      hoverClass: "hover:bg-purple-100",
      icon: "🎯",
      targetScope: "premise",
      example: "Attack the foundation of the argument",
    },
    UNDERCUTS: {
      label: "Undercut",
      description: "Challenge the inference/scheme",
      color: "orange",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-200",
      textClass: "text-amber-700",
      hoverClass: "hover:bg-amber-100",
      icon: "🔪",
      targetScope: "inference",
      example: "Block the reasoning step itself",
    },
  };

  const currentInfo = attackTypeInfo[attackType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-lg">
      <div className="bg-white border-indigo-300 border-2 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <PlusCircle className="w-6 h-6 text-indigo-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Create ASPIC+ Attack
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  Challenge this argument with formal attack
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Argument Context Card */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Target Argument
            </div>
            
            {/* Conclusion */}
            <div className="mb-3">
              <div className="text-xs font-medium text-emerald-700 mb-1">Conclusion:</div>
              <div className="text-sm text-slate-900 font-medium">{conclusion.text}</div>
            </div>

            {/* Premises */}
            {premises.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-blue-700 mb-1">
                  {premises.length === 1 ? "Premise:" : "Premises:"}
                </div>
                <ul className="space-y-1">
                  {premises.map((p, idx) => (
                    <li key={p.id} className="text-sm text-slate-700">
                      {premises.length > 1 && <span className="font-medium">{idx + 1}.</span>} {p.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scheme */}
            {schemeName && (
              <div className="pt-2 border-t border-slate-200">
                <div className="text-xs font-medium text-indigo-700 mb-1">Inference Scheme:</div>
                <div className="text-sm text-slate-700">{schemeName}</div>
              </div>
            )}
          </div>

          {/* Attack Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              1. Select Attack Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(attackTypeInfo) as AttackType[]).map((type) => {
                const info = attackTypeInfo[type];
                const isSelected = attackType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAttackType(type)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${isSelected 
                        ? `${info.borderClass} ${info.bgClass}` 
                        : "border-slate-200 bg-white hover:border-slate-300"
                      }
                    `}
                  >
                    <div className={`text-sm font-semibold ${isSelected ? info.textClass : "text-slate-700"}`}>
                      {info.label}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      {info.description}
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Attack Type Info Box */}
            <div className={`mt-3 p-3 rounded-lg border ${currentInfo.borderClass} ${currentInfo.bgClass}`}>
              <div className="flex gap-2">
                <Info className={`w-4 h-4 ${currentInfo.textClass} shrink-0 mt-0.5`} />
                <div>
                  <div className={`text-xs font-semibold ${currentInfo.textClass} mb-1`}>
                    {currentInfo.label} targets: {currentInfo.targetScope}
                  </div>
                  <div className="text-xs text-slate-700">
                    {currentInfo.example}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Premise Selection (only for UNDERMINES) */}
          {attackType === "UNDERMINES" && premises.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                2. Select Premise to Undermine
              </label>
              <select
                value={selectedPremiseId}
                onChange={(e) => setSelectedPremiseId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
              >
                {premises.map((p, idx) => (
                  <option key={p.id} value={p.id}>
                    Premise {idx + 1}: {p.text.slice(0, 80)}{p.text.length > 80 ? "..." : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Display (for REBUTS/UNDERMINES) */}
          {attackType !== "UNDERCUTS" && (
            <div className={`p-3 rounded-lg border ${currentInfo.borderClass} ${currentInfo.bgClass}`}>
              <div className="text-xs font-semibold text-slate-600 mb-1">
                Target {attackType === "REBUTS" ? "Conclusion" : "Premise"}:
              </div>
              <div className="text-sm text-slate-900 font-medium">
                {attackType === "REBUTS" 
                  ? conclusion.text 
                  : premises.find(p => p.id === selectedPremiseId)?.text || premises[0]?.text
                }
              </div>
            </div>
          )}

          {/* Attacker Type Toggle */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {attackType === "UNDERCUTS" ? "2" : "3"}. Select Attacker Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAttackerType("claim")}
                className={`
                  flex-1 px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all
                  ${attackerType === "claim"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }
                `}
              >
                Claim
              </button>
              <button
                type="button"
                onClick={() => setAttackerType("argument")}
                className={`
                  flex-1 px-4 py-2 rounded-lg border-2 font-medium text-sm transition-all
                  ${attackerType === "argument"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }
                `}
              >
                Argument
              </button>
            </div>
          </div>

          {/* Attacker Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {attackType === "UNDERCUTS" ? "3" : "4"}. Select Attacker {attackerType === "claim" ? "Claim" : "Argument"}
            </label>
            {loadingAttackers ? (
              <div className="text-sm text-slate-500 py-4">Loading...</div>
            ) : (
              <select
                value={selectedAttackerId}
                onChange={(e) => setSelectedAttackerId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                required
              >
                <option value="">-- Select {attackerType === "claim" ? "claim" : "argument"} --</option>
                {availableAttackers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.text?.slice(0, 100) || item.conclusion?.text?.slice(0, 100) || item.id}
                    {(item.text?.length > 100 || item.conclusion?.text?.length > 100) ? "..." : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedAttackerId}
              className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating..." : `Create ${currentInfo.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
