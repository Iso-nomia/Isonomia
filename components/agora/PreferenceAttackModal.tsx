// components/agora/PreferenceAttackModal.tsx
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, Triangle, Target, Sparkles, CheckCircle2, AlertCircle, FileText, Loader2, GitBranch, FerrisWheel, ChevronDown, Settings } from "lucide-react";
import { EntityPicker } from "@/components/kb/EntityPicker";

import "./deliberation-styles.css";

type PreferenceType = "prefer" | "disprefer";
type EntityKind = "argument" | "scheme";
type SelectionMode = "single" | "bulk";

interface FullArgument {
  id: string;
  conclusion: { id: string; text: string };
  premises: Array<{ id: string; text: string }>;
  schemeKey?: string;
}

interface FullScheme {
  id: string;
  name: string;
  key: string;
  slotHints?: any;
}

interface ExistingPreference {
  id: string;
  preferredArgumentId?: string;
  dispreferredArgumentId?: string;
  preferredSchemeId?: string;
  dispreferredSchemeId?: string;
  justification?: string;
  createdAt: string;
}

interface PreferenceAttackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliberationId: string;
  sourceArgumentId: string;
  onSuccess?: () => void;
}

export function PreferenceAttackModal({
  open,
  onOpenChange,
  deliberationId,
  sourceArgumentId,
  onSuccess,
}: PreferenceAttackModalProps) {
  const [preferenceType, setPreferenceType] = React.useState<PreferenceType | null>(null);
  const [entityKind, setEntityKind] = React.useState<EntityKind>("argument");
  const [selectionMode, setSelectionMode] = React.useState<SelectionMode>("single");
  const [selectedTarget, setSelectedTarget] = React.useState<{ id: string; label: string } | null>(null);
  const [selectedTargets, setSelectedTargets] = React.useState<Array<{ id: string; label: string }>>([]);
  const [showPicker, setShowPicker] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [bulkProgress, setBulkProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [justification, setJustification] = React.useState("");
  const [orderingPolicy, setOrderingPolicy] = React.useState<"last-link" | "weakest-link" | null>(null);
  const [setComparison, setSetComparison] = React.useState<"elitist" | "democratic" | null>(null);
  const [sourceArgument, setSourceArgument] = React.useState<FullArgument | null>(null);
  const [targetArgument, setTargetArgument] = React.useState<FullArgument | null>(null);
  const [targetScheme, setTargetScheme] = React.useState<FullScheme | null>(null);
  const [existingPreferences, setExistingPreferences] = React.useState<ExistingPreference[]>([]);
  const [loadingSource, setLoadingSource] = React.useState(false);
  const [loadingTarget, setLoadingTarget] = React.useState(false);
  const [loadingPreferences, setLoadingPreferences] = React.useState(false);
  const titleRef = React.useRef<HTMLDivElement | null>(null);

  // Fetch source argument when modal opens
  React.useEffect(() => {
    if (open && !sourceArgument) {
      setLoadingSource(true);
      fetch(`/api/arguments/${sourceArgumentId}/aif`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.argument) {
            setSourceArgument({
              id: data.argument.id,
              conclusion: data.argument.conclusion,
              premises: data.argument.premises || [],
              schemeKey: data.argument.schemeKey,
            });
          }
        })
        .catch(err => console.error("Failed to fetch source argument:", err))
        .finally(() => setLoadingSource(false));
    }
  }, [open, sourceArgumentId, sourceArgument]);

  // Fetch existing preferences for source argument
  React.useEffect(() => {
    if (open && sourceArgumentId) {
      setLoadingPreferences(true);
      fetch(`/api/arguments/${sourceArgumentId}/preferences`)
        .then(r => r.ok ? r.json() : { preferences: [] })
        .then(data => {
          setExistingPreferences(data.preferences || []);
        })
        .catch(err => console.error("Failed to fetch preferences:", err))
        .finally(() => setLoadingPreferences(false));
    }
  }, [open, sourceArgumentId]);

  // Fetch target argument or scheme details when selected
  React.useEffect(() => {
    if (!selectedTarget) return;
    
    if (entityKind === "argument" && !targetArgument) {
      setLoadingTarget(true);
      fetch(`/api/arguments/${selectedTarget.id}/aif`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.argument) {
            setTargetArgument({
              id: data.argument.id,
              conclusion: data.argument.conclusion,
              premises: data.argument.premises || [],
              schemeKey: data.argument.schemeKey,
            });
          }
        })
        .catch(err => console.error("Failed to fetch target argument:", err))
        .finally(() => setLoadingTarget(false));
    } else if (entityKind === "scheme" && !targetScheme) {
      setLoadingTarget(true);
      fetch(`/api/aif/schemes`)
        .then(r => r.ok ? r.json() : { items: [] })
        .then(data => {
          const scheme = data.items?.find((s: any) => s.id === selectedTarget.id);
          if (scheme) {
            setTargetScheme({
              id: scheme.id,
              name: scheme.name,
              key: scheme.key,
              slotHints: scheme.slotHints,
            });
          }
        })
        .catch(err => console.error("Failed to fetch target scheme:", err))
        .finally(() => setLoadingTarget(false));
    }
  }, [selectedTarget, entityKind, targetArgument, targetScheme]);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPreferenceType(null);
        setEntityKind("argument");
        setSelectionMode("single");
        setSelectedTarget(null);
        setSelectedTargets([]);
        setTargetArgument(null);
        setTargetScheme(null);
        setError(null);
        setSuccess(false);
        setBulkProgress(null);
        setJustification("");
        setOrderingPolicy(null);
        setSetComparison(null);
        setExistingPreferences([]);
      }, 200);
    }
  }, [open]);

  const handleSubmit = React.useCallback(async () => {
    if (!preferenceType || busy) return;
    
    const targetsToProcess = selectionMode === "bulk" ? selectedTargets : (selectedTarget ? [selectedTarget] : []);
    if (targetsToProcess.length === 0) return;
    
    setBusy(true);
    setError(null);
    setBulkProgress(selectionMode === "bulk" ? { current: 0, total: targetsToProcess.length } : null);

    try {
      let successCount = 0;
      let errors: string[] = [];

      for (let i = 0; i < targetsToProcess.length; i++) {
        const target = targetsToProcess[i];
        
        // Update progress for bulk mode
        if (selectionMode === "bulk") {
          setBulkProgress({ current: i + 1, total: targetsToProcess.length });
        }

        let body: any = {
          deliberationId,
        };

        // Build request based on entity kind and preference type
        if (entityKind === "argument") {
          if (preferenceType === "prefer") {
            body.preferredArgumentId = sourceArgumentId;
            body.dispreferredArgumentId = target.id;
          } else {
            body.preferredArgumentId = target.id;
            body.dispreferredArgumentId = sourceArgumentId;
          }
        } else if (entityKind === "scheme") {
          if (preferenceType === "prefer") {
            body.preferredArgumentId = sourceArgumentId;
            body.dispreferredSchemeId = target.id;
          } else {
            body.preferredSchemeId = target.id;
            body.dispreferredArgumentId = sourceArgumentId;
          }
        }

        // Add optional fields
        if (justification.trim()) {
          body.justification = justification.trim();
        }
        if (orderingPolicy) {
          body.orderingPolicy = orderingPolicy;
        }
        if (setComparison) {
          body.setComparison = setComparison;
        }

        try {
          const r = await fetch("/api/pa", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });

          const j = await r.json().catch(() => ({}));
          
          if (!r.ok || j?.ok === false) {
            errors.push(`${target.label}: ${j?.error || `HTTP ${r.status}`}`);
          } else {
            successCount++;
          }
        } catch (e) {
          errors.push(`${target.label}: ${e instanceof Error ? e.message : "Failed"}`);
        }

        // Small delay between requests in bulk mode to avoid overwhelming the server
        if (selectionMode === "bulk" && i < targetsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (errors.length > 0) {
        setError(`Created ${successCount}/${targetsToProcess.length} preferences. Errors: ${errors.slice(0, 3).join("; ")}`);
      } else {
        setSuccess(true);
      }
      
      // Close modal after brief success display
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, selectionMode === "bulk" ? 2000 : 1500);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to create preference attack");
    } finally {
      setBusy(false);
      setBulkProgress(null);
    }
  }, [preferenceType, selectedTarget, selectedTargets, selectionMode, busy, deliberationId, sourceArgumentId, entityKind, justification, orderingPolicy, setComparison, onOpenChange, onSuccess]);

  const canSubmit = preferenceType && (selectionMode === "single" ? selectedTarget !== null : selectedTargets.length > 0) && !busy;

  // Check if a preference already exists between source and target
  const existingRelationship = React.useMemo(() => {
    if (!selectedTarget || !existingPreferences.length) return null;
    
    if (entityKind === "argument") {
      return existingPreferences.find(
        p =>
          (p.preferredArgumentId === sourceArgumentId && p.dispreferredArgumentId === selectedTarget.id) ||
          (p.preferredArgumentId === selectedTarget.id && p.dispreferredArgumentId === sourceArgumentId)
      );
    } else if (entityKind === "scheme") {
      return existingPreferences.find(
        p =>
          (p.preferredArgumentId === sourceArgumentId && p.dispreferredSchemeId === selectedTarget.id) ||
          (p.preferredSchemeId === selectedTarget.id && p.dispreferredArgumentId === sourceArgumentId)
      );
    }
    
    return null;
  }, [selectedTarget, existingPreferences, sourceArgumentId, entityKind]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[80%] custom-scrollbar overflow-y-auto rounded-2xl border-2 border-purple-500/50
           
          backdrop-blur-xl bg-purple-200/30 shadow-2xl px-6 py-8"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >
        {/* Glass morphism overlays
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/5 via-transparent to-slate-900/10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(139,92,246,0.08),transparent_50%)] pointer-events-none" /> */}
        
        {/* Water droplet decorations - light mode */}
        <div className="absolute top-10 right-20 w-32 h-32 bg-violet-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 left-10 w-40 h-40 bg-indigo-400/8 rounded-full blur-3xl animate-pulse delay-1000" />

        <DialogHeader className="space-y-2 pb-4 border-b border-white/80">
          <DialogTitle
            ref={titleRef as any}
            tabIndex={-1}
            className="text-3xl font-bold text-slate-900 flex items-center gap-3 drop-shadow-sm"
          >
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100">
              <Triangle className="w-5 h-5 text-violet-700" />
            </div>
            <span className="tracking-wide bg-gradient-to-r from-violet-900 via-purple-900 to-violet-900 bg-clip-text text-transparent text-3xl">
              Create Preference Attack
            </span>
          </DialogTitle>
          <span className="ml-1 font-medium bg-gradient-to-r from-violet-800 via-purple-700 to-violet-800 bg-clip-text text-transparent text-sm">
            Express a preference relationship between arguments and/or schemes using AIF Preference Attacks (PA)
          </span>
        </DialogHeader>

        {/* Bulk progress indicator */}
        {bulkProgress && (
          <div className="flex items-center gap-3 p-4 bg-cyan-100/50 backdrop-blur-xl rounded-xl border border-cyan-300/50 animate-in fade-in duration-300">
            <Loader2 className="w-5 h-5 text-cyan-700 animate-spin" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-cyan-900">Creating Preferences...</div>
              <div className="text-xs text-cyan-700">
                Processing {bulkProgress.current} of {bulkProgress.total}
              </div>
              <div className="mt-2 w-full bg-cyan-200/50 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-cyan-600 transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Success state */}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-100/50 backdrop-blur-xl rounded-xl border border-emerald-300/50 animate-in fade-in slide-in-from-top duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-emerald-900">
                {selectionMode === "bulk" ? "Preference Attacks Created!" : "Preference Attack Created!"}
              </div>
              <div className="text-xs text-emerald-700">
                {selectionMode === "bulk" 
                  ? `${selectedTargets.length} preference relationship${selectedTargets.length !== 1 ? "s" : ""} have been recorded.`
                  : "The preference relationship has been recorded."
                }
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-100/50 backdrop-blur-xl rounded-xl border border-rose-300/50 animate-in fade-in slide-in-from-top duration-300">
            <AlertCircle className="w-5 h-5 text-rose-700" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-rose-900">Error</div>
              <div className="text-xs text-rose-700">{error}</div>
            </div>
          </div>
        )}

        {!success && (
          <>
            {/* Source argument display */}
            {loadingSource ? (
              <div className="py-8 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : sourceArgument ? (
              <div className="py-3 px-4 backdrop-blur-xl bg-white/70 rounded-xl shadow-md border border-slate-200/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-sky-100">
                    <Target className="w-4 h-4 text-indigo-700" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                      Source Argument {sourceArgument.schemeKey && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          {sourceArgument.schemeKey}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-800 font-medium">
                      {sourceArgument.conclusion.text}
                    </div>
                    {sourceArgument.premises && sourceArgument.premises.length > 0 && (
                      <div className="space-y-1 pl-3 ml-2 border-l-2 border-indigo-200">
                        {sourceArgument.premises.map((p) => (
                          <div key={p.id} className="text-xs text-slate-600">
                            • {p.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Existing preferences visualization */}
            {existingPreferences.length > 0 && !loadingPreferences && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  <GitBranch className="w-3 h-3 text-violet-600" />
                  Existing Preferences ({existingPreferences.length})
                </div>
                <div className="max-h-32 overflow-y-auto space-y-2">
                  {existingPreferences.map((pref) => {
                    const isSourcePreferred = pref.preferredArgumentId === sourceArgumentId;
                    const targetId = isSourcePreferred 
                      ? (pref.dispreferredArgumentId || pref.dispreferredSchemeId || "unknown")
                      : (pref.preferredArgumentId || pref.preferredSchemeId || "unknown");
                    
                    return (
                    <div
                      key={pref.id}
                      className="text-xs px-3 py-2 bg-violet-50/50 border border-violet-200/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        {isSourcePreferred ? (
                          <>
                            <span className="font-mono text-emerald-700">This</span>
                            <ArrowUp className="w-3 h-3 text-emerald-600" />
                            <span className="font-mono text-rose-700">
                              {targetId.slice(0, 8)}...
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-rose-700">This</span>
                            <ArrowDown className="w-3 h-3 text-rose-600" />
                            <span className="font-mono text-emerald-700">
                              {targetId.slice(0, 8)}...
                            </span>
                          </>
                        )}
                      </div>
                      {pref.justification && (
                        <div className="mt-1 text-[11px] text-slate-600 italic">
                          {pref.justification}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              </div>
            )}

            {/* Entity kind selection (argument vs scheme) */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Select Target Entity Type
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setEntityKind("argument");
                    setSelectedTarget(null);
                    setTargetArgument(null);
                    setTargetScheme(null);
                  }}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200
                    ${
                      entityKind === "argument"
                        ? "bg-indigo-100/70 border-indigo-400 shadow-md"
                        : "bg-white/50 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm font-bold text-slate-900">Argument</div>
                    <div className="text-xs text-slate-600">Compare with another argument</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setEntityKind("scheme");
                    setSelectedTarget(null);
                    setTargetArgument(null);
                    setTargetScheme(null);
                  }}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200
                    ${
                      entityKind === "scheme"
                        ? "bg-indigo-100/70 border-indigo-400 shadow-md"
                        : "bg-white/50 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm font-bold text-slate-900">Scheme</div>
                    <div className="text-xs text-slate-600">Compare with argumentation scheme</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Selection mode toggle (single vs bulk) */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-cyan-600" />
                Selection Mode
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setSelectionMode("single");
                    setSelectedTargets([]);
                  }}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200
                    ${
                      selectionMode === "single"
                        ? "bg-cyan-100/70 border-cyan-400 shadow-md"
                        : "bg-white/50 border-slate-200 hover:bg-cyan-50/50 hover:border-cyan-300"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm font-bold text-slate-900">Single Target</div>
                    <div className="text-xs text-slate-600">Create one preference</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setSelectionMode("bulk");
                    setSelectedTarget(null);
                  }}
                  className={`
                    p-3 rounded-lg border-2 transition-all duration-200
                    ${
                      selectionMode === "bulk"
                        ? "bg-cyan-100/70 border-cyan-400 shadow-md"
                        : "bg-white/50 border-slate-200 hover:bg-cyan-50/50 hover:border-cyan-300"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm font-bold text-slate-900">Bulk Mode</div>
                    <div className="text-xs text-slate-600">Create multiple preferences</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Preference type selection */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FerrisWheel className="w-4 h-4 text-violet-600" />
                Select Preference Type
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Prefer button */}
                <button
                  onClick={() => setPreferenceType("prefer")}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-200
                    ${
                      preferenceType === "prefer"
                        ? "bg-emerald-100/70 border-emerald-400 shadow-md"
                        : "bg-white/50 border-slate-200 hover:bg-emerald-50/50 hover:border-emerald-300"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`p-3 rounded-lg ${
                        preferenceType === "prefer"
                          ? "bg-emerald-200"
                          : "bg-emerald-100"
                      }`}
                    >
                      <ArrowUp className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">Prefer Over</div>
                    <div className="text-xs text-slate-600 text-center">
                      This argument is <span className="font-semibold text-emerald-700">preferred</span> to the target
                    </div>
                  </div>
                </button>

                {/* Disprefer button */}
                <button
                  onClick={() => setPreferenceType("disprefer")}
                  className={`
                    p-4 rounded-xl border-2 transition-all duration-200
                    ${
                      preferenceType === "disprefer"
                        ? "bg-rose-100/70 border-rose-400 shadow-md"
                        : "bg-white/50 border-slate-200 hover:bg-rose-50/50 hover:border-rose-300"
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`p-3 rounded-lg ${
                        preferenceType === "disprefer"
                          ? "bg-rose-200"
                          : "bg-rose-100"
                      }`}
                    >
                      <ArrowDown className="w-5 h-5 text-rose-700" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">Disprefer To</div>
                    <div className="text-xs text-slate-600 text-center">
                      This argument is <span className="font-semibold text-rose-700">dispreferred</span> to the target
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Target selection */}
            {preferenceType && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top duration-300">
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Triangle className="w-4 h-4 text-violet-600" />
                  Select Target{selectionMode === "bulk" ? "s" : ""} {entityKind === "argument" ? "Argument" : "Scheme"}{selectionMode === "bulk" ? "s" : ""}
                </div>
                
                {selectionMode === "single" ? (
                  <button
                    onClick={() => setShowPicker(true)}
                    className="w-full p-4 rounded-xl border-2 border-dashed bg-white/50 
                      hover:bg-violet-50/50 hover:border-violet-300 border-slate-300
                      transition-all duration-200 group"
                  >
                    {selectedTarget ? (
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-100 group-hover:bg-violet-200 transition-colors">
                          <Target className="w-4 h-4 text-violet-700" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
                            Selected Target
                          </div>
                          <div className="text-sm text-slate-800 font-medium mt-1">
                            {selectedTarget.label}
                          </div>
                        </div>
                        <div className="text-xs text-violet-600 font-medium">
                          Click to change
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-violet-100 transition-colors">
                          <Target className="w-5 h-5 text-slate-500 group-hover:text-violet-600 transition-colors" />
                        </div>
                        <div className="text-sm font-medium text-slate-600 group-hover:text-violet-700 transition-colors">
                          Click to select target {entityKind === "argument" ? "argument" : "scheme"}
                        </div>
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowPicker(true)}
                      className="w-full p-3 rounded-lg border-2 border-dashed bg-white/50 
                        hover:bg-violet-50/50 hover:border-violet-300 border-slate-300
                        transition-all duration-200 text-sm font-medium text-violet-700 hover:text-violet-800"
                    >
                      + Add Target {entityKind === "argument" ? "Argument" : "Scheme"}
                    </button>
                    
                    {selectedTargets.length > 0 && (
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {selectedTargets.map((target, idx) => (
                          <div key={target.id} className="flex items-center gap-2 p-2 bg-violet-50/50 rounded-lg border border-violet-200/50">
                            <div className="flex-1 text-sm text-slate-800 truncate">{target.label}</div>
                            <button
                              onClick={() => setSelectedTargets(prev => prev.filter((_, i) => i !== idx))}
                              className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedTargets.length > 0 && (
                      <div className="text-xs text-slate-600 bg-cyan-50/50 px-3 py-2 rounded-lg border border-cyan-200/50">
                        <span className="font-semibold text-cyan-900">{selectedTargets.length}</span> target{selectedTargets.length !== 1 ? "s" : ""} selected. {selectedTargets.length} preference{selectedTargets.length !== 1 ? "s" : ""} will be created.
                      </div>
                    )}
                  </div>
                )}

                <EntityPicker
                  kind={entityKind}
                  open={showPicker}
                  onClose={() => setShowPicker(false)}
                  onPick={(item: { id: string; label: string }) => {
                    if (selectionMode === "single") {
                      setSelectedTarget(item);
                    } else {
                      setSelectedTargets(prev => {
                        if (prev.some(t => t.id === item.id)) return prev;
                        return [...prev, item];
                      });
                    }
                    setShowPicker(false);
                  }}
                />

                {/* Existing relationship warning */}
                {existingRelationship && (
                  <div className="flex items-start gap-3 p-3 bg-amber-100/50 backdrop-blur-sm rounded-lg border border-amber-300/50 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-amber-900">
                        Existing Preference Detected
                      </div>
                      <div className="text-xs text-amber-700 mt-1">
                        A preference relationship already exists between these arguments. Creating a new one may create conflicts.
                      </div>
                    </div>
                  </div>
                )}

                {/* Target argument details */}
                {loadingTarget && (
                  <div className="py-4 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
                  </div>
                )}
                
                {targetArgument && entityKind === "argument" && !loadingTarget && (
                  <div className="py-3 px-4 backdrop-blur-xl bg-violet-50/30 rounded-xl border border-violet-200/50 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-violet-100">
                        <Target className="w-4 h-4 text-violet-700" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
                          Target Argument {targetArgument.schemeKey && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-violet-100 text-violet-700">
                              {targetArgument.schemeKey}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-800 font-medium">
                          {targetArgument.conclusion.text}
                        </div>
                        {targetArgument.premises && targetArgument.premises.length > 0 && (
                          <div className="space-y-1 pl-3 ml-2 border-l-2 border-violet-200">
                            {targetArgument.premises.map((p) => (
                              <div key={p.id} className="text-xs text-slate-600">
                                • {p.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {targetScheme && entityKind === "scheme" && !loadingTarget && (
                  <div className="py-3 px-4 backdrop-blur-xl bg-violet-50/30 rounded-xl border border-violet-200/50 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-violet-100">
                        <Sparkles className="w-4 h-4 text-violet-700" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="text-xs font-semibold text-violet-900 uppercase tracking-wide">
                          Target Scheme
                        </div>
                        <div className="text-sm text-slate-800 font-medium">
                          {targetScheme.name}
                        </div>
                        <div className="text-xs text-slate-600 font-mono bg-violet-100/50 px-2 py-1 rounded">
                          {targetScheme.key}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preference explanation */}
                {selectedTarget && (
                  <div className="p-3 bg-violet-50/50 backdrop-blur-sm rounded-lg border border-violet-200/50 animate-in fade-in duration-200">
                    <div className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-semibold text-violet-900">Preference Attack (PA):</span>{" "}
                      {preferenceType === "prefer" ? (
                        <>
                          The source argument will be marked as{" "}
                          <span className="font-semibold text-emerald-700">preferred</span> and{" "}
                          <span className="font-mono text-xs bg-emerald-100 px-1 py-0.5 rounded">
                            {selectedTarget.label.slice(0, 40)}...
                          </span>{" "}
                          as <span className="font-semibold text-rose-700">dispreferred</span>.
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-xs bg-emerald-100 px-1 py-0.5 rounded">
                            {selectedTarget.label.slice(0, 40)}...
                          </span>{" "}
                          will be marked as{" "}
                          <span className="font-semibold text-emerald-700">preferred</span> and the
                          source argument as <span className="font-semibold text-rose-700">dispreferred</span>.
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Justification field */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-600" />
                    Justification <span className="text-xs text-slate-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explain why you prefer one argument over the other..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 
                      bg-white/70 backdrop-blur-sm
                      text-sm text-slate-800 placeholder:text-slate-400
                      focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent
                      transition-all duration-200"
                  />
                </div>

                {/* Advanced Options - Ordering Policies */}
                <Collapsible className="space-y-3">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-300
                        bg-white/50 hover:bg-slate-50/70 transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Settings className="w-4 h-4 text-indigo-600" />
                        Advanced Options
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 p-4 border border-slate-200 rounded-lg bg-white/30 backdrop-blur-sm">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-900">
                        Ordering Policy
                      </Label>
                      <Select 
                        value={orderingPolicy ?? "default"} 
                        onValueChange={(v) => setOrderingPolicy(v === "default" ? null : v as "last-link" | "weakest-link")}
                      >
                        <SelectTrigger className="w-full bg-white/70 border-slate-300">
                          <SelectValue placeholder="Use default ordering" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Use default</span>
                              <span className="text-xs text-slate-500">System default ordering</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="last-link">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Last-link</span>
                              <span className="text-xs text-slate-500">Legal/normative contexts</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="weakest-link">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Weakest-link</span>
                              <span className="text-xs text-slate-500">Epistemic reasoning</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-600">
                        How argument strength is computed from rule and premise preferences
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-900">
                        Set Comparison
                      </Label>
                      <Select 
                        value={setComparison ?? "default"} 
                        onValueChange={(v) => setSetComparison(v === "default" ? null : v as "elitist" | "democratic")}
                      >
                        <SelectTrigger className="w-full bg-white/70 border-slate-300">
                          <SelectValue placeholder="Use default (elitist)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Use default (elitist)</span>
                              <span className="text-xs text-slate-500">Standard comparison</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="elitist">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Elitist</span>
                              <span className="text-xs text-slate-500">Strongest link comparison</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="democratic">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Democratic</span>
                              <span className="text-xs text-slate-500">All links matter</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-600">
                        How to compare sets of rules or premises
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200/50">
              <button
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm 
                  menuv2--lite bg-slate-200/60 text-slate-700 border border-slate-700
                  
                  transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm btnv2--violet
                 
                  text-purple-800 
                  transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating PA...
                  </>
                ) : (
                  <>
                    <Triangle className="w-4 h-4" />
                    Create Preference Attack
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
