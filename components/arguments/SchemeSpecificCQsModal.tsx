//components/arguments/SchemeSpecificCQsModal.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Target,
  Shield,
  ShieldX,
  ShieldAlert,
  Sparkles,
  Zap,
  MessageSquare,
  MessageCircle,
  Activity,
  Send,
} from "lucide-react";
import { ClaimPicker } from "@/components/claims/ClaimPicker";
import { askCQ, getArgumentCQsWithProvenance } from "@/lib/client/aifApi";
import { CqInsightChips } from "@/components/schemes/CqInsightChips";
import CQResponseForm from "@/components/claims/CQResponseForm";
import CQResponsesList from "@/components/claims/CQResponsesList";
import CQActivityFeed from "@/components/claims/CQActivityFeed";
import CQEndorseModal from "@/components/claims/CQEndorseModal";

type CQItem = {
  id?: string; // CQStatus ID for Phase 3 community responses
  cqKey: string;
  text: string;
  status: "open" | "answered";
  attackType: string;
  targetScope: string;
  premiseType?: string | null; // Carneades premise type (ASSUMPTION auto-waives)
  inherited?: boolean; // Phase 6: Whether this CQ comes from a parent scheme
  sourceSchemeId?: string; // Phase 6: Parent scheme ID
  sourceSchemeName?: string; // Phase 6: Parent scheme name
  sourceSchemeKey?: string; // Phase 6: Parent scheme key
  whyCount?: number; // Phase 8: WHY dialogue move count
  groundsCount?: number; // Phase 8: GROUNDS dialogue move count
};

type AifMeta = {
  scheme?: { id: string; key: string; name: string } | null;
  conclusion?: { id: string; text: string } | null;
  premises?: Array<{ id: string; text: string; isImplicit?: boolean }> | null;
};

export function SchemeSpecificCQsModal({
  argumentId,
  deliberationId,
  authorId,
  currentUserId,
  cqs,
  meta,
  onRefresh,
  triggerButton,
  open: controlledOpen,
  onOpenChange,
}: {
  argumentId: string;
  deliberationId: string;
  authorId: string;
  currentUserId?: string;
  cqs: CQItem[];
  meta?: AifMeta;
  onRefresh: () => void;
  triggerButton?: React.ReactNode;
  // Optional controlled mode: when `open` is provided, the parent owns the
  // open state and no internal trigger is rendered (use a separate button).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  // Role detection: is the current user the argument author?
  // Convert both to strings to ensure type compatibility
  const isAuthor = currentUserId && authorId && String(currentUserId) === String(authorId);
  
  // Debug logging
  // console.log('[SchemeSpecificCQsModal] Role detection:', {
  //   currentUserId,
  //   authorId,
  //   isAuthor,
  //   currentUserIdType: typeof currentUserId,
  //   authorIdType: typeof authorId,
  //   stringComparison: String(currentUserId) === String(authorId),
  // });
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );
  const [expandedCQ, setExpandedCQ] = React.useState<string | null>(null);
  const [localCqs, setLocalCqs] = React.useState<CQItem[]>(cqs);
  const [posting, setPosting] = React.useState<string | null>(null);

  // Phase 6: Provenance data
  const [provenanceData, setProvenanceData] = React.useState<{
    ownCQs: CQItem[];
    inheritedCQs: CQItem[];
    allCQs: CQItem[];
    totalCount: number;
    ownCount: number;
    inheritedCount: number;
    inheritancePath: Array<{ id: string; name: string; key: string }>;
  } | null>(null);
  const [loadingProvenance, setLoadingProvenance] = React.useState(false);

  // Phase 3 modal states
  const [responseFormOpen, setResponseFormOpen] = React.useState(false);
  const [selectedCQForResponse, setSelectedCQForResponse] = React.useState<CQItem | null>(null);
  const [selectedResponseForEndorse, setSelectedResponseForEndorse] = React.useState<string | null>(null);
  const [endorseModalOpen, setEndorseModalOpen] = React.useState(false);

  // Objection form states per CQ
  const [rebutClaim, setRebutClaim] = React.useState<Record<string, { id: string; text: string } | null>>({});
  const [undercutText, setUndercutText] = React.useState<Record<string, string>>({});
  const [underminePremise, setUnderminePremise] = React.useState<Record<string, string>>({});
  const [undermineClaim, setUndermineClaim] = React.useState<Record<string, { id: string; text: string } | null>>({});
  
  // Claim picker state for REBUTS and UNDERMINES
  const [rebutClaimPickerOpen, setRebutClaimPickerOpen] = React.useState<string | null>(null);
  const [undermineClaimPickerOpen, setUndermineClaimPickerOpen] = React.useState<string | null>(null);

  // Sync local CQs when prop changes
  React.useEffect(() => {
    setLocalCqs(cqs);
  }, [cqs]);

  // Phase 6: Fetch provenance data when modal opens
  React.useEffect(() => {
    if (open && !provenanceData && !loadingProvenance) {
      setLoadingProvenance(true);
      getArgumentCQsWithProvenance(argumentId)
        .then((data) => {
          setProvenanceData(data);
          // Merge provenance data into localCqs
          const mergedCqs = cqs.map((cq) => {
            const provenanceCQ = data.allCQs.find((p: CQItem) => p.cqKey === cq.cqKey);
            if (provenanceCQ) {
              return {
                ...cq,
                inherited: provenanceCQ.inherited,
                sourceSchemeId: provenanceCQ.sourceSchemeId,
                sourceSchemeName: provenanceCQ.sourceSchemeName,
                sourceSchemeKey: provenanceCQ.sourceSchemeKey,
              };
            }
            return cq;
          });
          setLocalCqs(mergedCqs);
        })
        .catch((err) => {
          console.error("[SchemeSpecificCQsModal] Failed to load provenance:", err);
        })
        .finally(() => {
          setLoadingProvenance(false);
        });
    }
  }, [open, argumentId, cqs, provenanceData, loadingProvenance]);

  const handleAskCQ = async (cqKey: string) => {
    // Author-only permission guard
    if (!isAuthor) {
      alert("Only the argument author can mark CQs as asked. Use the Community Responses feature to participate in the discussion.");
      return;
    }

    try {
      // Create WHY DialogueMove before updating CQStatus (Option A: Generic dialogue move)
      if (deliberationId && authorId) {
        const moveRes = await fetch("/api/dialogue/move", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType: "argument",
            targetId: argumentId,
            kind: "WHY",
            payload: { cqKey, locusPath: "0" },
          }),
        });
        if (!moveRes.ok) {
          const errorData = await moveRes.json().catch(() => ({}));
          console.warn("[SchemeSpecificCQsModal] Failed to create WHY move:", moveRes.status, errorData);
        }
      }

      await askCQ(argumentId, cqKey, { authorId, deliberationId });
      setLocalCqs((prev) =>
        prev.map((c) => (c.cqKey === cqKey ? { ...c, status: "open" } : c))
      );

      // Phase 5: Fire dialogue moves refresh event
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh", { detail: { deliberationId } } as any));
    } catch (err) {
      console.error("[SchemeSpecificCQsModal] Failed to ask CQ:", err);
    }
  };

  const postObjection = async (cq: CQItem) => {
    // Author-only permission guard
    if (!isAuthor) {
      alert("Only the argument author can post objections as canonical answers. Use the Community Responses feature to contribute to the discussion.");
      return;
    }

    if (posting) return;

    const cqKey = cq.cqKey;
    setPosting(cqKey);

    try {
      if (cq.attackType === "REBUTS") {
        const claim = rebutClaim[cqKey];
        if (!claim) {
          alert("Please select a counter-claim");
          return;
        }

        // Note: We don't create a GROUNDS DialogueMove here because this is proactively
        // creating an attack, not answering a WHY move. The ConflictApplication captures
        // the objection sufficiently.

        await fetch("/api/ca", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            conflictingClaimId: claim.id,
            conflictedClaimId: meta?.conclusion?.id ?? "",
            legacyAttackType: "REBUTS",
            legacyTargetScope: "conclusion",
            metaJson: {
              schemeKey: meta?.scheme?.key,
              cqKey,
              cqText: cq.text,
              source: "scheme-specific-cqs-modal-rebut",
            },
          }),
        });

        // Clear form
        setRebutClaim((prev) => ({ ...prev, [cqKey]: null }));
      } else if (cq.attackType === "UNDERCUTS") {
        const text = undercutText[cqKey]?.trim();
        if (!text) {
          alert("Please enter an exception or rule-defeater");
          return;
        }

        // Note: We don't create a GROUNDS DialogueMove here because this is proactively
        // creating an attack, not answering a WHY move. The ConflictApplication captures
        // the objection sufficiently.

        // Create exception claim
        const r = await fetch("/api/claims", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            authorId,
            text,
          }),
        });
        const j = await r.json();
        const exceptionClaimId = j.claim?.id || j.id;

        // Post undercut
        await fetch("/api/ca", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            conflictingClaimId: exceptionClaimId,
            conflictedArgumentId: argumentId,
            legacyAttackType: "UNDERCUTS",
            legacyTargetScope: "inference",
            metaJson: {
              schemeKey: meta?.scheme?.key,
              cqKey,
              cqText: cq.text,
              source: "scheme-specific-cqs-modal-undercut",
            },
          }),
        });

        // Clear form
        setUndercutText((prev) => ({ ...prev, [cqKey]: "" }));
      } else if (cq.attackType === "UNDERMINES") {
        const premiseId = underminePremise[cqKey] || meta?.premises?.[0]?.id;
        const claim = undermineClaim[cqKey];

        if (!premiseId) {
          alert("Please select a premise to undermine");
          return;
        }
        if (!claim) {
          alert("Please select a contradicting claim");
          return;
        }

        // Note: We don't create a GROUNDS DialogueMove here because this is proactively
        // creating an attack, not answering a WHY move. The ConflictApplication captures
        // the objection sufficiently.

        await fetch("/api/ca", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            conflictingClaimId: claim.id,
            conflictedClaimId: premiseId,
            legacyAttackType: "UNDERMINES",
            legacyTargetScope: "premise",
            metaJson: {
              schemeKey: meta?.scheme?.key,
              cqKey,
              cqText: cq.text,
              source: "scheme-specific-cqs-modal-undermine",
            },
          }),
        });

        // Clear form
        setUndermineClaim((prev) => ({ ...prev, [cqKey]: null }));
        setUnderminePremise((prev) => ({ ...prev, [cqKey]: "" }));
      }

      // Success: fire events and refresh
      window.dispatchEvent(new CustomEvent("claims:changed", { detail: { deliberationId } } as any));
      window.dispatchEvent(new CustomEvent("arguments:changed", { detail: { deliberationId } } as any));
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh", { detail: { deliberationId } } as any));
      
      setExpandedCQ(null);
      onRefresh();
    } catch (err) {
      console.error("[SchemeSpecificCQsModal] Failed to post objection:", err);
      alert("Failed to post objection. Please try again.");
    } finally {
      setPosting(null);
    }
  };

  const answeredCount = localCqs.filter((c) => c.status === "answered").length;
  const totalCount = localCqs.length;

  const defaultTrigger = (
    <button
      className="
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
        bg-indigo-50 text-indigo-700 border border-indigo-200
        hover:bg-indigo-100 hover:border-indigo-300
        transition-all duration-200 shadow-sm hover:shadow
      "
    >
      <HelpCircle className="w-4 h-4" />
      Critical Questions
      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-bold">
        {answeredCount}/{totalCount}
      </span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {triggerButton || defaultTrigger}
        </DialogTrigger>
      )}

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 custom-scrollbar">
        <DialogHeader className="space-y-2 pb-4 border-b border-slate-200">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200">
              <HelpCircle className="w-6 h-6 text-indigo-700" />
            </div>
            Critical Questions
          </DialogTitle>
          <p className="text-sm text-slate-600 leading-relaxed">
            These questions test the strength of the argument scheme. Answer them as objections to challenge the argument.
          </p>

          {/* Contextual Help Banner with Role-Based Guidance */}
          <div className="mt-4 p-4 bg-gradient-to-br from-sky-50 to-indigo-50 rounded-xl border-2 border-sky-200">
            <div className="flex items-start gap-3 mb-3">
              <div className="p-2 rounded-lg bg-sky-100">
                <HelpCircle className="w-5 h-5 text-sky-700" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-sky-900 mb-1">
                  What are Critical Questions?
                </div>
                <div className="text-xs text-sky-800 leading-relaxed">
                  CQs test the strength of an argument by identifying potential weaknesses in the reasoning scheme. 
                  They challenge assumptions, premises, and inferences.
                </div>
              </div>
            </div>

            {/* Role-specific guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {isAuthor ? (
                <div className="col-span-full p-3 bg-sky-50 rounded-lg border border-sky-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 bg-sky-200 text-sky-900 rounded-full font-bold">
                      AUTHOR
                    </span>
                    <span className="text-xs font-semibold text-sky-900">Your Role</span>
                  </div>
                  <p className="text-xs text-sky-800 leading-relaxed">
                    <strong>Answer CQs</strong> by providing objections (rebuts, undercuts, undermines). 
                    Mark questions as "asked" to enable community discussion. Your answers demonstrate the robustness of your argument.
                  </p>
                </div>
              ) : (
                <div className="col-span-full p-3 bg-amber-50 rounded-lg border border-amber-300">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-bold">
                      COMMUNITY
                    </span>
                    <span className="text-xs font-semibold text-amber-900">Your Role</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Participate in discussion</strong> via Community Responses. 
                    You can view how the author addresses each CQ and contribute your own perspective through responses and endorsements.
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scheme info */}
        {meta?.scheme && (
          <div className="p-4 bg-white rounded-xl border-2 border-indigo-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Target className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">
                  Argument Scheme
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {meta.scheme.name}
                </div>
                {/* Phase 5: Dialogue move tracking indicator */}
                {deliberationId && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <MessageSquare className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-purple-700">
                      Dialogue moves tracked
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 mb-1">Progress</div>
                <div className="text-sm font-bold text-indigo-600">
                  {answeredCount}/{totalCount}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 6: Provenance Summary */}
        {provenanceData && provenanceData.inheritedCount > 0 && (
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border-2 border-emerald-200 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-200">
                <Sparkles className="w-5 h-5 text-emerald-700" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                  CQ Inheritance
                </div>
                <div className="text-sm text-emerald-900">
                  <span className="font-bold">{provenanceData.ownCount} own</span>
                  {" + "}
                  <span className="font-bold">{provenanceData.inheritedCount} inherited</span>
                  {" = "}
                  <span className="font-bold">{provenanceData.totalCount} total</span>
                </div>
                {provenanceData.inheritancePath.length > 0 && (
                  <div className="mt-2 text-xs text-emerald-800">
                    Inherited from: {provenanceData.inheritancePath.map((p) => p.name).join(" → ")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CQ List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
          {localCqs.length === 0 ? (
            <div className="p-6 bg-white rounded-xl border-2 border-slate-200 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                <HelpCircle className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No critical questions</p>
              <p className="text-xs text-slate-500 mt-1">
                This argument scheme has no defined critical questions yet.
              </p>
            </div>
          ) : (
            localCqs.map((cq) => {
              const isExpanded = expandedCQ === cq.cqKey;
              const isPosting = posting === cq.cqKey;

              // Icon and theme based on attack type
              const AttackIcon =
                cq.attackType === "REBUTS"
                  ? ShieldX
                  : cq.attackType === "UNDERCUTS"
                  ? ShieldAlert
                  : Shield;

              const theme =
                cq.attackType === "REBUTS"
                  ? "rose"
                  : cq.attackType === "UNDERCUTS"
                  ? "amber"
                  : "slate";

              const themeClasses = {
                rose: {
                  border: "border-rose-200",
                  bg: "bg-gradient-to-br from-rose-50 to-rose-100",
                  badge: "bg-rose-100 text-rose-700 border-rose-200",
                  button: "bg-rose-600 hover:bg-rose-700 text-white",
                },
                amber: {
                  border: "border-amber-200",
                  bg: "bg-gradient-to-br from-amber-50 to-amber-100",
                  badge: "bg-amber-100 text-amber-700 border-amber-200",
                  button: "bg-amber-600 hover:bg-amber-700 text-white",
                },
                slate: {
                  border: "border-slate-300",
                  bg: "bg-gradient-to-br from-slate-50 to-slate-100",
                  badge: "bg-slate-200 text-slate-700 border-slate-300",
                  button: "bg-slate-700 hover:bg-slate-800 text-white",
                },
              };

              const t = themeClasses[theme];

              return (
                <div
                  key={cq.cqKey}
                  className={`
                    rounded-xl border-2 transition-all duration-300
                    ${
                      cq.status === "answered"
                        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100"
                        : `${t.border} ${t.bg}`
                    }
                  `}
                >
                  <div className="p-4">
                    <button
                      onClick={() => setExpandedCQ(isExpanded ? null : cq.cqKey)}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <div className="mt-0.5 shrink-0">
                        {cq.status === "answered" ? (
                          <div className="p-1 rounded-full bg-emerald-200">
                            <CheckCircle2 className="w-5 h-5 text-emerald-700" strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div className="p-1 rounded-full bg-amber-100">
                            <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-2 flex-wrap">
                          <span
                            className={`
                              inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                              text-[10px] font-bold uppercase tracking-wide border
                              ${t.badge}
                            `}
                          >
                            <AttackIcon className="w-3 h-3" />
                            {cq.attackType}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                            {cq.targetScope}
                          </span>
                          {/* Phase 6: Provenance badge */}
                          {cq.inherited && cq.sourceSchemeName && (
                            <span
                              className="
                                inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                text-[10px] font-semibold tracking-wide border
                                bg-emerald-100 text-emerald-700 border-emerald-300
                              "
                              title={`Inherited from ${cq.sourceSchemeName} (${cq.sourceSchemeKey})`}
                            >
                              <Sparkles className="w-3 h-3" />
                              Inherited from {cq.sourceSchemeName}
                            </span>
                          )}
                        </div>

                        <p
                          className={`text-sm font-medium leading-relaxed ${
                            cq.status === "answered" ? "text-emerald-900" : "text-slate-800"
                          }`}
                        >
                          {cq.text}
                        </p>

                        {/* Session 11b items 2/4/5 — shared insight chips
                            (divergence type, CQ→scheme cross-references,
                            presumption hint). Same component as the claim-level
                            CriticalQuestionsV3 surface. */}
                        <CqInsightChips
                          schemeKey={meta?.scheme?.key ?? ""}
                          cqKey={cq.cqKey}
                          premiseType={cq.premiseType}
                          satisfied={cq.status === "answered"}
                        />

                        {/* Phase 8: Dialogue Move count badges */}
                        {((cq.whyCount ?? 0) > 0 || (cq.groundsCount ?? 0) > 0) && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <MessageCircle className="w-4 h-4 text-purple-500" />
                            <div className="flex gap-1.5">
                              {(cq.whyCount ?? 0) > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                                  {cq.whyCount} WHY
                                </span>
                              )}
                              {(cq.groundsCount ?? 0) > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                                  {cq.groundsCount} GROUNDS
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className={`transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        <ChevronDown
                          className={`w-5 h-5 ${
                            cq.status === "answered" ? "text-emerald-600" : "text-slate-400"
                          }`}
                        />
                      </div>
                    </button>

                    {/* Mark as asked button - AUTHOR ONLY */}
                    {cq.status === "open" && !isExpanded && isAuthor && (
                      <div className="w-full pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAskCQ(cq.cqKey);
                          }}
                          className="w-fit border py-1 px-1 bg-white rounded-xl text-xs text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                        >
                          Mark as asked
                        </button>
                      </div>
                    )}

                    {/* Community hint - shown when not author */}
                    {cq.status === "open" && !isExpanded && !isAuthor && (
                      <div className="w-full pt-2 px-2">
                        <div className="text-xs text-slate-500 italic">
                          Author can mark this CQ as asked. You can participate via Community Responses below.
                        </div>
                      </div>
                    )}

                    {/* Expanded objection form */}
                    {isExpanded && (
                      <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300 pt-4 border-t border-slate-200">
                        {/* AUTHOR SECTION: Answer CQ with Objection */}
                        {isAuthor && (
                          <div className="p-4 bg-sky-50 rounded-xl border-2 border-sky-300 space-y-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs px-2 py-0.5 bg-sky-200 text-sky-900 rounded-full font-bold">
                                AUTHOR
                              </span>
                              <span className="text-sm font-bold text-sky-900">
                                Answer This Question
                              </span>
                            </div>

                            <div className="p-3 bg-white/70 rounded-lg border border-sky-200">
                              <p className="text-xs text-sky-800 leading-relaxed">
                                <strong>How to answer:</strong> Provide an objection that addresses this question.
                                Your answer will be posted as a {cq.attackType.toLowerCase()} attacking the{" "}
                                {cq.targetScope}.
                              </p>
                            </div>

                            {/* REBUTS form */}
                            {cq.attackType === "REBUTS" && (
                              <div className="space-y-3">
                                <label className="block text-sm font-semibold text-sky-900">
                                  Select or Create Counter-Claim
                                </label>
                                <p className="text-xs text-sky-700">
                                  Choose a claim that contradicts the conclusion to demonstrate this weakness
                                </p>
                                <button
                                  onClick={() => setRebutClaimPickerOpen(cq.cqKey)}
                                  className="w-full text-sm btnv2 w-fit px-4 py-2 text-center rounded-lg bg-white border-2 border-sky-200 hover:bg-sky-50 transition-colors"
                                >
                                  {rebutClaim[cq.cqKey]?.text || "Select or create counter-claim..."}
                                </button>
                                <ClaimPicker
                                  deliberationId={deliberationId}
                                  open={rebutClaimPickerOpen === cq.cqKey}
                                  onClose={() => setRebutClaimPickerOpen(null)}
                                  onPick={(claim) => {
                                    setRebutClaim((prev) => ({ ...prev, [cq.cqKey]: claim }));
                                    setRebutClaimPickerOpen(null);
                                  }}
                                  allowCreate={true}
                                />
                                {meta?.conclusion && (
                                  <div className="p-3 bg-sky-100/50 rounded-lg border border-sky-200">
                                    <div className="text-xs font-semibold text-sky-800 mb-1">
                                      Target Conclusion
                                    </div>
                                    <div className="text-xs text-sky-700">{meta.conclusion.text}</div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* UNDERCUTS form */}
                            {cq.attackType === "UNDERCUTS" && (
                              <div className="space-y-3">
                                <label className="block text-sm font-semibold text-sky-900">
                                  Exception or Rule-Defeater
                                </label>
                                <p className="text-xs text-sky-700">
                                  Explain why the inference doesn't hold in this case
                                </p>
                                <textarea
                                  value={undercutText[cq.cqKey] || ""}
                                  onChange={(e) =>
                                    setUndercutText((prev) => ({ ...prev, [cq.cqKey]: e.target.value }))
                                  }
                                  placeholder="Explain why the inference doesn't hold in this case..."
                                  className="
                                    w-full px-3 py-2 rounded-lg border-2 border-sky-300 bg-white
                                    focus:border-sky-400 focus:ring-2 focus:ring-sky-100
                                    transition-all duration-200 text-sm resize-none
                                  "
                                  rows={3}
                                />
                                <div className="text-xs text-sky-600">
                                  {(undercutText[cq.cqKey] || "").length} characters
                                </div>
                              </div>
                            )}

                            {/* UNDERMINES form */}
                            {cq.attackType === "UNDERMINES" && (
                              <div className="space-y-3">
                                <label className="block text-sm font-semibold text-sky-900">
                                  Select Premise to Undermine
                                </label>
                                <p className="text-xs text-sky-700">
                                  Choose which premise you want to challenge
                                </p>
                                <select
                                  value={underminePremise[cq.cqKey] || meta?.premises?.[0]?.id || ""}
                                  onChange={(e) =>
                                    setUnderminePremise((prev) => ({ ...prev, [cq.cqKey]: e.target.value }))
                                  }
                                  className="
                                    w-full px-3 py-2 rounded-lg border-2 border-sky-300 bg-white
                                    focus:border-sky-400 focus:ring-2 focus:ring-sky-100
                                    transition-all duration-200 text-sm
                                  "
                                >
                                  {(meta?.premises || []).map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.text}
                                    </option>
                                  ))}
                                </select>

                                <label className="block text-sm font-semibold text-sky-900 mt-3">
                                  Select Contradicting Claim
                                </label>
                                <p className="text-xs text-sky-700">
                                  Choose a claim that contradicts the selected premise
                                </p>
                                <button
                                  onClick={() => setUndermineClaimPickerOpen(cq.cqKey)}
                                  className="w-full text-sm btnv2 w-fit px-4 py-2 text-center rounded-lg bg-white border-2 border-sky-200 hover:bg-sky-50 transition-colors"
                                >
                                  {undermineClaim[cq.cqKey]?.text || "Select or create contradicting claim..."}
                                </button>
                                <ClaimPicker
                                  deliberationId={deliberationId}
                                  open={undermineClaimPickerOpen === cq.cqKey}
                                  onClose={() => setUndermineClaimPickerOpen(null)}
                                  onPick={(claim) => {
                                    setUndermineClaim((prev) => ({ ...prev, [cq.cqKey]: claim }));
                                    setUndermineClaimPickerOpen(null);
                                  }}
                                  allowCreate={true}
                                />
                              </div>
                            )}

                            {/* Submit button */}
                            <button
                              className="
                                w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                                text-sm font-bold shadow-md hover:shadow-lg
                                disabled:opacity-50 disabled:cursor-not-allowed
                                transition-all duration-200 active:scale-95
                                bg-sky-600 hover:bg-sky-700 text-white
                              "
                              disabled={
                                isPosting ||
                                (cq.attackType === "REBUTS" && !rebutClaim[cq.cqKey]) ||
                                (cq.attackType === "UNDERCUTS" && !undercutText[cq.cqKey]?.trim()) ||
                                (cq.attackType === "UNDERMINES" &&
                                  (!undermineClaim[cq.cqKey] || !underminePremise[cq.cqKey]))
                              }
                              onClick={() => postObjection(cq)}
                            >
                              {isPosting ? (
                                <>
                                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                  Posting answer...
                                </>
                              ) : (
                                <>
                                  Submit Answer & Post {cq.attackType}
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* COMMUNITY SECTION: View Only + Participate via Responses */}
                        {!isAuthor && (
                          <div className="p-4 bg-amber-50 rounded-xl border-2 border-amber-300 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-bold">
                                COMMUNITY
                              </span>
                              <span className="text-sm font-bold text-amber-900">
                                Viewing CQ Details
                              </span>
                            </div>

                            <div className="p-3 bg-white/70 rounded-lg border border-amber-200">
                              <p className="text-xs text-amber-800 leading-relaxed">
                                <strong>Author's responsibility:</strong> The argument author addresses this CQ by posting {cq.attackType.toLowerCase()} objections.
                                You can participate by submitting responses, endorsing answers, and contributing to the discussion below.
                              </p>
                            </div>

                            <div className="p-3 bg-amber-100/50 rounded-lg border border-amber-200">
                              <div className="text-xs font-semibold text-amber-800 mb-1">
                                Attack Type: {cq.attackType}
                              </div>
                              <div className="text-xs text-amber-700">
                                Target: {cq.targetScope}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Phase 3 Community Response System */}
                        {cq.id && (
                          <div className="mt-6 space-y-4 pt-4 border-t-2 border-sky-200">
                            {/* Section Header */}
                            <div className="flex items-center gap-2 mb-3">
                              <MessageSquare className="w-5 h-5 text-sky-600" />
                              <h4 className="text-sm font-bold text-sky-900">
                                Community Responses
                              </h4>
                            </div>

                            {/* Response Form Button */}
                            <button
                              onClick={() => {
                                setSelectedCQForResponse(cq);
                                setResponseFormOpen(true);
                              }}
                              className="
                                w-full inline-flex items-center justify-center gap-2 px-4 py-3
                                bg-gradient-to-br from-sky-500 to-cyan-600
                                text-white rounded-xl font-semibold text-sm
                                hover:from-sky-600 hover:to-cyan-700
                                shadow-md hover:shadow-lg
                                transition-all duration-200 active:scale-95
                              "
                            >
                              <Send className="w-4 h-4" />
                              Submit Your Response
                            </button>

                            {/* Responses List */}
                            <div className="bg-white rounded-xl border border-slate-200 overflow-y-auto">
                              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                                <Activity className="w-4 h-4 text-slate-600" />
                                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                  All Responses
                                </h5>
                              </div>
                              <CQResponsesList
                                cqStatusId={cq.id}
                                currentUserId={currentUserId ?? authorId}
                                canModerate={false}
                                onEndorse={(responseId: string) => {
                                  setSelectedResponseForEndorse(responseId);
                                  setEndorseModalOpen(true);
                                }}
                              />
                            </div>

                            {/* Activity Timeline */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-100/50 border-b border-indigo-200">
                                <Activity className="w-4 h-4 text-indigo-600" />
                                <h5 className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                                  Recent Activity
                                </h5>
                              </div>
                              <CQActivityFeed cqStatusId={cq.id} limit={5} />
                            </div>
                          </div>
                        )}

                        {/* Legacy Objection Notice */}
                        {!cq.id && cq.status === "open" && (
                          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <p className="text-xs text-amber-800">
                              <strong>Note:</strong> Mark this question as "asked" to enable community responses.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>

      {/* Phase 3 CQ Response Form Modal */}
      {selectedCQForResponse && selectedCQForResponse.id && (
        <CQResponseForm
          open={responseFormOpen}
          onOpenChange={setResponseFormOpen}
          cqStatusId={selectedCQForResponse.id}
          cqText={selectedCQForResponse.text}
          onSuccess={() => {
            setResponseFormOpen(false);
            onRefresh(); // Refresh CQs to show updated counts
          }}
        />
      )}

      {/* Phase 3 Endorse Modal */}
      {selectedResponseForEndorse && selectedCQForResponse && selectedCQForResponse.id && (
        <CQEndorseModal
          open={endorseModalOpen}
          onOpenChange={setEndorseModalOpen}
          responseId={selectedResponseForEndorse}
          cqStatusId={selectedCQForResponse.id}
          onSuccess={() => {
            setEndorseModalOpen(false);
            setSelectedResponseForEndorse(null);
            onRefresh();
          }}
        />
      )}
    </Dialog>
  );
}
