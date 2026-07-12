//components/arguments/AttackMenuProV2.tsx
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ShieldX,
  ShieldAlert,
  Shield,
  Target,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Swords,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
  CheckCircle2,
  Crosshair,
  Plus,
} from "lucide-react";
import { SchemeComposerPicker } from "../SchemeComposerPicker";
import { PropositionComposerPro } from "../propositions/PropositionComposerPro";
type ClaimRef = { id: string; text: string };
type Prem = { id: string; text: string };

export function AttackMenuProV2({
  deliberationId,
  authorId,
  target,
  onDone,
}: {
  deliberationId: string;
  authorId: string;
  target: { id: string; conclusion: ClaimRef; premises: Prem[] };
  onDone?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const titleRef = React.useRef<HTMLDivElement | null>(null);

  const handleOpenChange = React.useCallback((v: boolean) => {
    setOpen(v);
    if (v) {
      requestAnimationFrame(() => setMounted(true));
    }
  }, []);

  const handleDone = React.useCallback(() => {
    setOpen(false);
    onDone?.();
  }, [onDone]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="
            inline-flex btnv2--sunset items-center gap-2 px-2 py-2 rounded-lg text-xs  rounded-lg 
          "
        >
          <Swords className="w-3 h-3" />
          Challenge Argument
        </button>
      </DialogTrigger>

      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto  custom-scrollbar backdrop-blur-xl
         bg-gradient-to-br from-rose-200/50 to-orange-200/70 panel-edge"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader className="space-y-0 ">
          <DialogTitle
            ref={titleRef as any}
            tabIndex={-1}
            className="outline-none text-2xl font-bold text-slate-800 flex items-center gap-3"
          >
            {/* <div className="p-2 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100 ">
              <Swords className="w-5 h-5 text-rose-700" />
            </div> */}
            <div className="tracking-wide mb-1">
            Challenge This Argument
            </div>
          </DialogTitle>
          <p className="text-xs px-1 text-slate-700 leading-tight">
            Respond to this argument with a specific attack type.
          </p>
        </DialogHeader>

        {/* Phase 6: Deprecation Warning Banner */}
        <div className="px-4 py-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border-2 border-amber-300 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Tip: Use Critical Questions for Scheme-Based Attacks
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                For arguments with defined argumentation schemes, we recommend using the{" "}
                <strong>Critical Questions system</strong> instead. It provides scheme-specific guidance 
                and creates properly structured dialogue moves with full ASPIC+ metadata.
              </p>
              <div className="mt-2 px-3 py-2 bg-white/60 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-900">
                  <strong>💡 How to access:</strong> Close this menu and look for the{" "}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 border border-indigo-300 text-indigo-700 font-semibold">
                    <HelpCircle className="w-3 h-3 inline" />
                    Critical Questions
                  </span>{" "}
                  button on the argument card.
                </p>
              </div>
              <p className="text-xs text-amber-700 mt-2 italic">
                This direct attack menu is best for ad-hoc challenges or arguments without schemes.
              </p>
            </div>
          </div>
        </div>

        {/* Target summary card */}
        <div className="px-4 py-3 bg-white rounded-xl border-2 border-indigo-300 shadow-md gap-4">
          <div className="flex items-start gap-3">
                            <div className="flex items-start gap-2">
                                <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="p-0 rounded-lg ">
                  <Target className="w-5 h-5 text-indigo-600" />
            </div>
                      
                    <div className="flex gap-2 flex-wrap items-center">
                    <div className="text-sm items-center font-bold text-indigo-700 uppercase tracking-wide ">
                      Target Argument ⦂
                    </div>
                   
                    <div className="text-sm font-medium text-indigo-800 tracking-wide">
                      {target.conclusion.text}
                      </div>
                    </div>
                    </div>
                     <div className="flex items-center gap-2 text-sm justify-center text-indigo-900">
                         <span className="font-medium"> ⸻</span>
                <span className="font-medium">{target.premises.length} premise ⦂{target.premises.length !== 1 ? 's' : ''}</span>
                <span className="font-light">{target.premises.map(p => p.text).join(", ")}</span>
                <span className="text-slate-600">{target.premises.length !== 1 ? '•' : ''}</span>
                {/* <span>ID: {target.id.slice(0, 20)}...</span> */}
              </div>
              </div>
                </div>
                </div>
               
             
            </div>
  
        {/* Attack menu content */}
        <hr className="my-.5 border border-white/80 " />
        <div className="flex-1 overflow-y-auto  ">
          {mounted ? (
            <AttackMenuContent
              deliberationId={deliberationId}
              authorId={authorId}
              target={target}
              onDone={handleDone}
            />
          ) : (
            <div className="space-y-4">
              <div className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse" />
              <div className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse" />
              <div className="h-32 rounded-xl border border-slate-200 bg-white animate-pulse" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttackMenuContent({
  deliberationId,
  authorId,
  target,
  onDone,
}: {
  deliberationId: string;
  authorId: string;
  target: { id: string; conclusion: ClaimRef; premises: Prem[] };
  onDone?: () => void;
}) {
  const [busy, setBusy] = React.useState<null | "REBUTS" | "UNDERCUTS" | "UNDERMINES">(null);
  const [expandedCard, setExpandedCard] = React.useState<string | null>(null);

  // Attack-specific states
  const [rebut, setRebut] = React.useState<ClaimRef | null>(null);
  const [undercutText, setUndercutText] = React.useState("");
  const [premiseId, setPremiseId] = React.useState(target.premises[0]?.id ?? "");
  const [undermine, setUndermine] = React.useState<ClaimRef | null>(null);

  // Picker modals
  const [pickerRebutOpen, setPickerRebutOpen] = React.useState(false);
  const [pickerUndermineOpen, setPickerUndermineOpen] = React.useState(false);

  // Create counter-claim modals
  const [createRebutModalOpen, setCreateRebutModalOpen] = React.useState(false);
  const [createUndermineModalOpen, setCreateUndermineModalOpen] = React.useState(false);

  React.useEffect(() => {
    setPremiseId(target.premises[0]?.id ?? "");
  }, [target.premises]);

  const createClaim = React.useCallback(
    async (text: string, signal?: AbortSignal) => {
      const r = await fetch("/api/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliberationId, authorId, text }),
        signal,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
      return (j.claim?.id || j.id) as string;
    },
    [authorId, deliberationId]
  );

  const postAssumption = React.useCallback(
    async (
      argumentId: string,
      assumptionClaimId: string,
      role: "exception" | "presumption",
      meta?: any,
      signal?: AbortSignal
    ) => {
      const r = await fetch(`/api/arguments/${argumentId}/assumptions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          items: [{ assumptionId: assumptionClaimId, role, metaJson: meta ?? null }],
        }),
        signal,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
    },
    [deliberationId]
  );

  const postCA = React.useCallback(async (body: any, signal?: AbortSignal) => {
    const r = await fetch("/api/ca", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j?.error || `HTTP ${r.status}`);
    }
  }, []);

  // Handler for creating counter-claim from proposition
  const handlePropositionCreated = React.useCallback(
    async (proposition: any, isForRebut: boolean) => {
      try {
        // Auto-promote proposition to claim
        const res = await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            text: proposition.text,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to promote to claim");

        const claimId = data?.claim?.id ?? data?.claimId;
        if (!claimId) throw new Error("No claim ID returned");

        // Dispatch event for claim lists to update
        window.dispatchEvent(
          new CustomEvent("claims:changed", { detail: { claimId } })
        );

        // Set the claim in the appropriate state
        const claimRef = { id: claimId, text: proposition.text };
        if (isForRebut) {
          setRebut(claimRef);
          setCreateRebutModalOpen(false);
        } else {
          setUndermine(claimRef);
          setCreateUndermineModalOpen(false);
        }
      } catch (err) {
        console.error("[AttackMenuProV2] Failed to promote proposition:", err);
        alert(`Failed to create counter-claim: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [deliberationId]
  );

  const fire = React.useCallback(
    async (kind: "REBUTS" | "UNDERCUTS" | "UNDERMINES") => {
      if (busy) return;
      setBusy(kind);
      const ctrl = new AbortController();
      try {
        if (kind === "REBUTS") {
          if (!rebut || !rebut.id) return;

          // Try to detect CQ context
          let cqMetadata: any = {};
          try {
            const cqRes = await fetch(
              `/api/cqs?targetType=claim&targetId=${target.conclusion.id}`,
              { cache: "no-store", signal: ctrl.signal }
            );
            if (cqRes.ok) {
              const cqData = await cqRes.json();
              const schemes = cqData.schemes || [];
              for (const scheme of schemes) {
                for (const cq of scheme.cqs || []) {
                  if (!cq.satisfied && cq.key) {
                    cqMetadata = {
                      cqId: cq.key,
                      schemeKey: scheme.key,
                      cqText: cq.text,
                      cqContext: `Attacking: ${cq.text}`,
                    };
                    break;
                  }
                }
                if (cqMetadata.cqId) break;
              }
            }
          } catch (err) {
            console.warn("[AttackMenuProV2] Could not fetch CQs:", err);
          }

          await postCA(
            {
              deliberationId,
              conflictingClaimId: rebut.id,
              conflictedClaimId: target.conclusion.id,
              legacyAttackType: "REBUTS",
              legacyTargetScope: "conclusion",
              metaJson: cqMetadata,
            },
            ctrl.signal
          );
        } else if (kind === "UNDERCUTS") {
          const txt = undercutText.trim();
          if (!txt) return;
          const exceptionClaimId = await createClaim(txt, ctrl.signal);

          let cqMetadata: any = { descriptorKey: "exception" };
          const schemeKey = (target as any)?.schemeKey ?? null;
          if (schemeKey) {
            cqMetadata.schemeKey = schemeKey;
            try {
              const cqRes = await fetch(
                `/api/cqs?targetType=argument&targetId=${target.id}`,
                { cache: "no-store", signal: ctrl.signal }
              );
              if (cqRes.ok) {
                const cqData = await cqRes.json();
                const schemes = cqData.schemes || [];
                for (const scheme of schemes) {
                  for (const cq of scheme.cqs || []) {
                    if (
                      !cq.satisfied &&
                      cq.text &&
                      (cq.text.toLowerCase().includes("inference") ||
                        cq.text.toLowerCase().includes("reasoning") ||
                        cq.text.toLowerCase().includes("warrant"))
                    ) {
                      cqMetadata.cqId = cq.key;
                      cqMetadata.cqText = cq.text;
                      cqMetadata.cqContext = `Exception: ${cq.text}`;
                      break;
                    }
                  }
                  if (cqMetadata.cqId) break;
                }
              }
            } catch (err) {
              console.warn("[AttackMenuProV2] Could not fetch CQs for undercut:", err);
            }
          }

          await postCA(
            {
              deliberationId,
              conflictingClaimId: exceptionClaimId,
              conflictedArgumentId: target.id,
              legacyAttackType: "UNDERCUTS",
              legacyTargetScope: "inference",
              metaJson: cqMetadata,
            },
            ctrl.signal
          );

          await postAssumption(target.id, exceptionClaimId, "exception", cqMetadata, ctrl.signal);
        } else {
          if (!premiseId || !undermine || !undermine.id) return;

          let cqMetadata: any = {};
          try {
            const cqRes = await fetch(`/api/cqs?targetType=claim&targetId=${premiseId}`, {
              cache: "no-store",
              signal: ctrl.signal,
            });
            if (cqRes.ok) {
              const cqData = await cqRes.json();
              const schemes = cqData.schemes || [];
              for (const scheme of schemes) {
                for (const cq of scheme.cqs || []) {
                  if (!cq.satisfied && cq.key) {
                    cqMetadata = {
                      cqId: cq.key,
                      schemeKey: scheme.key,
                      cqText: cq.text,
                      cqContext: `Undermining premise: ${cq.text}`,
                    };
                    break;
                  }
                }
                if (cqMetadata.cqId) break;
              }
            }
          } catch (err) {
            console.warn("[AttackMenuProV2] Could not fetch CQs for undermine:", err);
          }

          await postCA(
            {
              deliberationId,
              conflictingClaimId: undermine.id,
              conflictedClaimId: premiseId,
              legacyAttackType: "UNDERMINES",
              legacyTargetScope: "premise",
              metaJson: cqMetadata,
            },
            ctrl.signal
          );
        }

        // Success notification
        window.dispatchEvent(new CustomEvent("claims:changed"));
        window.dispatchEvent(new CustomEvent("arguments:changed"));

        setRebut(null);
        setUndercutText("");
        setUndermine(null);
        onDone?.();
      } catch (err) {
        console.error(`[AttackMenuProV2] Failed to execute ${kind}:`, err);
        alert(`Failed to post attack: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(null);
        ctrl.abort();
      }
    },
    [
      busy,
      rebut,
      undercutText,
      premiseId,
      undermine,
      postCA,
      createClaim,
      postAssumption,
      deliberationId,
      target,
      onDone,
    ]
  );

  const isExpanded = (card: string) => expandedCard === card;
  const toggleExpand = (card: string) => setExpandedCard(isExpanded(card) ? null : card);

  return (
    <div className="space-y-4">
      {/* REBUT Card */}
      <div className="group relative rounded-xl  border-2 border-rose-200 hover:border-rose-400 bg-gradient-to-br from-rose-50 to-rose-100 overflow-hidden 
      transition-all duration-300 ">
        <div className="px-4 py-4">
          <button
            onClick={() => toggleExpand("rebut")}
            className="w-full flex items-start justify-between gap-4 text-left"
          >
            <div className="flex items-start gap-3  flex-1">
              <div className="p-0 rounded-xl mt-2 bg-transparent shadow-none">
                <Crosshair className="w-6 h-6  text-rose-600" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col flex-1 ">
                <h3 className="text-lg font-bold text-rose-900  flex items-center gap-2">
                  Rebut
                  {rebut && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </h3>
                <p className="text-sm text-rose-700 leading-tight">
                  Directly contradict the <span className="font-semibold">conclusion</span>
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                                      <span className="text-rose-600">Attacks the core claim • </span>

                  <span className="px-1 py-.5 rounded-md border bg-rose-200/50 border-rose-400 text-rose-800 font-medium">
                    Direct
                  </span>
                </div>
              </div>
            </div>
            <div className={`transition-transform duration-300 ${isExpanded("rebut") ? "rotate-180" : ""}`}>
              <ChevronDown className="w-5 h-5 text-rose-600" />
            </div>
          </button>

          {isExpanded("rebut") && (
            <div className="mt-2 space-y-2 px-3 animate-in slide-in-from-top-2 duration-300">
              <div className="px-2 py-2 bg-white/80 border-rose-300 mt-3 rounded-lg border border-rose-100 shadow-md">
                <div className="flex items-start gap-2">
                
                    <div className="flex items-center gap-2">
                      
                  <Target className="w-4 h-4 text-rose-500  " />
                    <div className="flex gap-2 flex-wrap items-center">
                    <div className="text-sm items-center font-semibold text-rose-700 uppercase tracking-wide ">
                      Target Conclusion ⦂
                    </div>
                   
                    <div className="text-sm text-rose-900 ">
                      {target.conclusion.text}
                      </div>
                    </div>
                    </div>
                </div>
              </div>

              <div className="space-y-4 ">
                <div className="space-y-2">
                <label className=" text-sm px-1 font-medium text-rose-900">
                  Your Counter-Claim ⦂
                </label>
                <div className="flex gap-2">
                  <button
                    className="flex-1  px-3 py-2 btnv2--rose rounded-lg border-2 border-rose-300 bg-white text-sm 
                    text-left hover:border-rose-400  transition-all duration-200 shadow-sm"
                    onClick={() => setPickerRebutOpen(true)}
                  >
                    {rebut ? (
                      <div className="flex items-start gap-2">
                        <span className="text-slate-900">{rebut.text}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">Select existing claim...</span>
                    )}
                  </button>
                  <button
                    className="
                      inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-rose-300
                      bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-semibold
                      hover:from-rose-600 hover:to-rose-700 
                      transition-all duration-200 shadow-sm hover:shadow-md
                    "
                    onClick={() => setCreateRebutModalOpen(true)}
                    title="Create a new counter-claim"
                  >
                    <Plus className="w-4 h-4" />
                    Create
                  </button>
                </div>
</div>
                <button
                  className="
                    w-fit  btnv2--rose inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                    text-sm font-bold bg-gradient-to-r from-rose-500 to-rose-600 text-white
                    hover:from-rose-600 hover:to-rose-700
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    transition-all duration-200 shadow-md hover:shadow-lg active:scale-95
                  "
                  disabled={!rebut || !rebut.id || !!busy}
                  onClick={() => fire("REBUTS")}
                  aria-busy={busy === "REBUTS"}
                >
                  {busy === "REBUTS" ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      Posting rebuttal...
                    </>
                  ) : (
                    <>
                      {/* <Zap className="w-5 h-5" /> */}
                      <Crosshair className="w-5 h-5" />
                      Post Rebuttal
                      <ChevronRight className="w-5 h-5 " />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
 {/* UNDERCUT Card */}
      <div className="group relative rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 
      to-amber-100 overflow-hidden transition-all duration-300 hover:border-amber-400">
        <div className="px-4 py-4">
          <button
            onClick={() => toggleExpand("undercut")}
            className="w-full flex items-start justify-between gap-4 text-left"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="p-0 rounded-xl mt-2 bg-transparent shadow-none">
                <ShieldAlert className="w-6 h-6 text-amber-600" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col flex-1">
                <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                  Undercut
                  {undercutText && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </h3>
                <p className="text-sm text-amber-700 leading-tight">
                  Show that the <span className="font-semibold">inference is defective</span>
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-amber-600">Challenges reasoning • </span>
                  <span className="px-1 py-.5 rounded-md border bg-amber-200/50 border-amber-400 text-amber-800 font-medium">
                    Structural
                  </span>
                </div>
              </div>
            </div>
            <div className={`transition-transform duration-300 ${isExpanded("undercut") ? "rotate-180" : ""}`}>
              <ChevronDown className="w-5 h-5 text-amber-600" />
            </div>
          </button>

          {isExpanded("undercut") && (
            <div className="mt-0 space-y-2 px-3 animate-in slide-in-from-top-2 duration-300">
              <div className="px-2 py-2 bg-white/80 border-amber-300 mt-3 rounded-lg border border-amber-100 shadow-md">
                <p className="text-sm text-amber-800 leading-relaxed">
                  Explain why the premises don&apos;t necessarily lead to the conclusion.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2 p-0">
                  <label className="text-sm px-1 font-medium text-amber-900">
                    Exception or Rule-Defeater ⦂
                  </label>
                  <textarea
                    value={undercutText}
                    onChange={(e) => setUndercutText(e.target.value)}
                    placeholder="E.g., 'However, the expert's opinion was given before key evidence emerged...'"
                    className="
                      w-full px-3 py-2 rounded-lg border-2 border-amber-300 bg-white
                      focus:border-amber-400 focus:ring-2 focus:ring-amber-100 focus:outline-none
                      transition-all duration-200 resize-none text-sm leading-relaxed
                      placeholder:text-slate-400
                    "
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-0 px-2 text-xs">
                    <span className="text-slate-500">{undercutText.length} characters</span>
                    {undercutText.trim() && (
                      <div className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Ready to post
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="
                    w-fit btnv2--sunset inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                    text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-white
                    hover:from-amber-600 hover:to-amber-700
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    transition-all duration-200 shadow-md hover:shadow-lg active:scale-95
                  "
                  disabled={!undercutText.trim() || !!busy}
                  onClick={() => fire("UNDERCUTS")}
                  aria-busy={busy === "UNDERCUTS"}
                >
                  {busy === "UNDERCUTS" ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      Posting undercut...
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-5 h-5" />
                      Post Undercut
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* UNDERMINE Card */}
      <div className="group relative rounded-xl border-2 border-slate-200 bg-gradient-to-br 
      from-slate-50 to-slate-100 overflow-hidden  hover:border-slate-400 transition-all duration-300">
        <div className="px-4 py-4 ">
          <button
            onClick={() => toggleExpand("undermine")}
            className="w-full flex items-start justify-between gap-4 text-left"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="p-0 rounded-xl mt-2 bg-transparent shadow-none">
                <Shield className="w-6 h-6 text-slate-600" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col flex-1">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  Undermine
                  {undermine && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </h3>
                <p className="text-sm text-slate-700 leading-tight">
                  Contradict a specific <span className="font-semibold">premise</span>
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-slate-600">Attacks foundational claims • </span>
                  <span className="px-1 py-.5 rounded-md border bg-slate-200/50 border-slate-400 text-slate-800 font-medium">
                    Targeted
                  </span>
                </div>
              </div>
            </div>
            <div className={`transition-transform duration-300 ${isExpanded("undermine") ? "rotate-180" : ""}`}>
              <ChevronDown className="w-5 h-5 text-slate-600" />
            </div>
          </button>

          {isExpanded("undermine") && (
            <div className="mt-2 space-y-2 px-3 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm px-1 font-medium text-slate-900">
                    Select Target Premise ⦂
                  </label>
                  <select
                    className="
                      w-full px-3 py-2 rounded-lg border-2 border-slate-300 bg-white
                      focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none
                      transition-all duration-200 text-sm font-medium
                    "
                    value={premiseId}
                    onChange={(e) => setPremiseId(e.target.value)}
                  >
                    {target.premises.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.text}
                      </option>
                    ))}
                  </select>
                </div>

                {premiseId && (
                  <div className="px-2 py-2 bg-white/80 border-slate-300 rounded-lg border border-slate-100 shadow-md">
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-slate-500" />
                        <div className="flex gap-2 flex-wrap items-center">
                          <div className="text-sm items-center font-semibold text-slate-700 uppercase tracking-wide">
                            Target Premise ⦂
                          </div>
                          <div className="text-sm text-slate-900">
                            {target.premises.find((p) => p.id === premiseId)?.text}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm px-1 font-medium text-slate-900">
                    Your Contradicting Claim ⦂
                  </label>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-2 btnv2--slate rounded-lg border-2 border-slate-300 bg-white text-sm text-left hover:border-slate-400 transition-all duration-200 shadow-sm"
                      onClick={() => setPickerUndermineOpen(true)}
                    >
                      {undermine ? (
                        <div className="flex items-start gap-2">
                          <span className="text-slate-900">{undermine.text}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Select existing claim...</span>
                      )}
                    </button>
                    <button
                      className="
                        inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-300
                        bg-gradient-to-r from-slate-600 to-slate-700 text-white text-sm font-semibold
                        hover:from-slate-700 hover:to-slate-800 
                        transition-all duration-200 shadow-sm hover:shadow-md
                      "
                      onClick={() => setCreateUndermineModalOpen(true)}
                      title="Create a new contradicting claim"
                    >
                      <Plus className="w-4 h-4" />
                      Create
                    </button>
                  </div>
                </div>

                <button
                  className="
                    w-fit btnv2 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                    text-sm font-bold bg-gradient-to-r from-slate-600 to-slate-700 text-white
                    hover:from-slate-700 hover:to-slate-800
                    disabled:opacity-50 disabled:cursor-not-allowed 
                    transition-all duration-200 shadow-md hover:shadow-lg active:scale-95
                  "
                  disabled={!premiseId || !undermine || !undermine.id || !!busy}
                  onClick={() => fire("UNDERMINES")}
                  aria-busy={busy === "UNDERMINES"}
                >
                  {busy === "UNDERMINES" ? (
                    <>
                      <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      Posting undermine...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Post Undermine
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Picker Modals */}
      <SchemeComposerPicker
        kind="claim"
        open={pickerRebutOpen}
        onClose={() => setPickerRebutOpen(false)}
        onPick={(it) => {
          setRebut({ id: it.id, text: it.label });
          setPickerRebutOpen(false);
        }}
      />
      <SchemeComposerPicker
        kind="claim"
        open={pickerUndermineOpen}
        onClose={() => setPickerUndermineOpen(false)}
        onPick={(it) => {
          setUndermine({ id: it.id, text: it.label });
          setPickerUndermineOpen(false);
        }}
      />

      {/* Create Counter-Claim Modals */}
      <Dialog open={createRebutModalOpen} onOpenChange={setCreateRebutModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-rose-50 to-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-rose-900">
              Create Counter-Claim for Rebuttal
            </DialogTitle>
            <p className="text-sm text-rose-700">
              Write your counter-claim that contradicts: <span className="font-semibold">{target.conclusion.text}</span>
            </p>
          </DialogHeader>
          <div className="mt-4">
            <PropositionComposerPro
              deliberationId={deliberationId}
              onCreated={(prop) => handlePropositionCreated(prop, true)}
              onPosted={() => setCreateRebutModalOpen(false)}
              placeholder="State your counter-claim that rebuts the conclusion..."
              className="border-2 border-rose-200"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createUndermineModalOpen} onOpenChange={setCreateUndermineModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Create Contradicting Claim for Undermine
            </DialogTitle>
            <p className="text-sm text-slate-700">
              Write your contradicting claim for the premise: <span className="font-semibold">
                {target.premises.find((p) => p.id === premiseId)?.text}
              </span>
            </p>
          </DialogHeader>
          <div className="mt-4">
            <PropositionComposerPro
              deliberationId={deliberationId}
              onCreated={(prop) => handlePropositionCreated(prop, false)}
              onPosted={() => setCreateUndermineModalOpen(false)}
              placeholder="State your claim that contradicts the premise..."
              className="border-2 border-slate-200"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
