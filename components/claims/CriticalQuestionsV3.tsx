//components/claims/CriticalQuestionsV3.tsx
"use client";

import * as React from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { suggestionForCQ } from "@/lib/argumentation/cqSuggestions";
import { LegalMoveChips } from "@/components/dialogue/LegalMoveChips";
import { useBusEffect } from "@/lib/client/useBusEffect";
import { SchemeComposerPicker } from "@/components/SchemeComposerPicker";
import CQResponseForm from "./CQResponseForm";
import CQResponsesList from "./CQResponsesList";
import CQAuthorDashboard from "./CQAuthorDashboard";
import CQStatusBadge from "./CQStatusBadge";
import CQActivityFeed from "./CQActivityFeed";
import CQEndorseModal from "./CQEndorseModal";
// Phase 4 mount — latent obligations panel (collapsed by default).
import { LatentObligationsForTarget } from "@/components/room/LatentObligationsForTarget";
// Phase 0.1: Burden of Proof helpers
import {
  getBurdenBadgeText,
  getBurdenBadgeColor,
  getCQBurdenExplanation,
  getCQEvidenceGuidance,
  getPremiseTypeDisplay,
} from "@/lib/utils/cq-burden-helpers";
// Session 11b items 2 + 5 — CQ→scheme cross-references and the divergence-type
// read-model, rendered via the shared CqInsightChips component.
import { CqInsightChips } from "@/components/schemes/CqInsightChips";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Sparkles,
  Target,
  Link2,
  AlertCircle,
  Search,
  Send,
  Lightbulb,
  MessageCircle,
  Plus,
  MessageSquarePlus,
  List,
  Activity,
} from "lucide-react";
import { TargetType } from "@prisma/client";

type RebutScope = "premise" | "inference" | "conclusion";
type Suggestion = {
  type: "undercut" | "rebut";
  scope?: RebutScope;
  options?: Array<{
    key: string;
    label: string;
    template: string;
    shape?: string;
  }>;
} | null;

type CQ = {
  id?: string; // CQStatus ID from database
  key: string;
  text: string;
  satisfied: boolean;
  groundsText?: string;
  suggestion?: Suggestion;
  whyCount?: number; // Phase 8: Dialogue move counts
  groundsCount?: number; // Phase 8: Dialogue move counts
  // Phase 0.1: Burden of Proof metadata
  burdenOfProof?: string;
  requiresEvidence?: boolean;
  premiseType?: string | null;
};

type Scheme = {
  key: string;
  title: string;
  cqs: CQ[];
};

type CQsResponse = {
  targetType: "claim" | "argument";
  targetId: string;
  schemes: Scheme[];
};

const fetcher = (u: string) =>
  fetch(u, { cache: "no-store" }).then((r) => r.json());

const CQS_KEY = (type: "claim" | "argument", id: string, scheme?: string) =>
  `/api/cqs?targetType=${type}&targetId=${id}${
    scheme ? `&scheme=${scheme}` : ""
  }`;
const TOULMIN_KEY = (id: string) => `/api/claims/${id}/toulmin`;
const GRAPH_KEY = (roomId: string, lens: string, audienceId?: string) =>
  `graph:${roomId}:${lens}:${audienceId ?? "none"}`;
const ATTACH_KEY = (type: "claim" | "argument", id: string) =>
  `/api/cqs/attachments?targetType=${type}&targetId=${id}`;
const MOVES_KEY = (deliberationId: string) =>
  `/api/deliberations/${deliberationId}/moves?limit=500`;
const EDGES_KEY = (deliberationId: string) =>
  `/api/claims/edges?deliberationId=${deliberationId}`;

async function trySearchClaims(
  q: string
): Promise<Array<{ id: string; text: string }>> {
  try {
    const r = await fetch(`/api/claims/search?q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.items) ? j.items.slice(0, 10) : [];
  } catch {
    return [];
  }
}

// Session 11b item 5 — divergence-type chip styling now lives in the shared
// CqInsightChips component (rendered on both CQ surfaces).

export default function CriticalQuestionsV3({
  targetType,
  targetId,
  createdById,
  claimAuthorId, // NEW: The actual author of the claim/argument being questioned
  deliberationId,
  currentUserId,
  roomId,
  currentLens,
  currentAudienceId,
  selectedAttackerClaimId,
  prefilterKeys,
}: {
  targetType: "claim" | "argument";
  targetId: string;
  createdById?: string; // Current user ID
  claimAuthorId?: string; // NEW: Author of the claim/argument (who should answer CQs)
  deliberationId?: string;
  currentUserId?: string;
  roomId?: string;
  currentLens?: string;
  currentAudienceId?: string;
  selectedAttackerClaimId?: string;
  prefilterKeys?: string[];
}) {
  // Determine if current user is the author
  const isAuthor = currentUserId && (
    currentUserId === claimAuthorId || 
    (!claimAuthorId && currentUserId === createdById)
  );
  
  // UI State
  const [expandedCQ, setExpandedCQ] = useState<string | null>(null);
  const [expandedMoves, setExpandedMoves] = useState<string | null>(null);
  const [composingCQ, setComposingCQ] = useState<string | null>(null);
  const [groundsInput, setGroundsInput] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<
    Record<string, Array<{ id: string; text: string }>>
  >({});
  const [searchLoading, setSearchLoading] = useState<string | null>(null);
  const [quickDialogOpen, setQuickDialogOpen] = useState(false);
  const [quickCQKey, setQuickCQKey] = useState<string | null>(null);
  const [quickText, setQuickText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCQKey, setPickerCQKey] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // New CQ Response System UI State
  const [responseFormOpen, setResponseFormOpen] = useState(false);
  const [selectedCQForResponse, setSelectedCQForResponse] = useState<{ id: string; text: string } | null>(null);
  const [responsesListOpen, setResponsesListOpen] = useState(false);
  const [selectedCQForList, setSelectedCQForList] = useState<{ id: string; text: string } | null>(null);
  const [activityFeedOpen, setActivityFeedOpen] = useState(false);
  const [selectedCQForActivity, setSelectedCQForActivity] = useState<string | null>(null);
  const [endorseModalOpen, setEndorseModalOpen] = useState(false);
  const [selectedResponseForEndorse, setSelectedResponseForEndorse] = useState<string | null>(null);

  // Data fetching
  const cqsKey = CQS_KEY(targetType, targetId);
  const { data: cqData, error: cqError } = useSWR<CQsResponse>(
    cqsKey,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const attachKey = ATTACH_KEY(targetType, targetId);
  const { data: attachData } = useSWR<any>(attachKey, fetcher, {
    revalidateOnFocus: false,
  });

  const movesKey = deliberationId ? MOVES_KEY(deliberationId) : null;
  const { data: movesData } = useSWR(movesKey, fetcher, {
    revalidateOnFocus: false,
  });

  const edgesKey = deliberationId ? EDGES_KEY(deliberationId) : null;
  const { data: edgesData } = useSWR(edgesKey, fetcher, {
    revalidateOnFocus: false,
  });

  // Event-driven cache invalidation
  useBusEffect(
    [
      "cqs:changed",
      "dialogue:moves:refresh",
      "arguments:changed",
      "claims:changed",
      "claims:edges:changed",
    ] as any,
    () => {
      globalMutate(cqsKey);
      globalMutate(attachKey);
      if (deliberationId) {
        globalMutate(MOVES_KEY(deliberationId));
        globalMutate(EDGES_KEY(deliberationId));
      }
      if (roomId && currentLens) {
        globalMutate(GRAPH_KEY(roomId, currentLens, currentAudienceId));
      }
    },
    { retry: true }
  );

  // Legacy event listeners for backwards compatibility
  React.useEffect(() => {
    const h = () => {
      globalMutate(cqsKey);
      globalMutate(attachKey);
      if (deliberationId) {
        globalMutate(MOVES_KEY(deliberationId));
        globalMutate(EDGES_KEY(deliberationId));
      }
    };
    window.addEventListener("claims:changed", h);
    window.addEventListener("arguments:changed", h);
    return () => {
      window.removeEventListener("claims:changed", h);
      window.removeEventListener("arguments:changed", h);
    };
  }, [cqsKey, attachKey, deliberationId]);

  // Helpers
  const toggleCQ = async (
    schemeKey: string,
    cqKey: string,
    satisfied: boolean
  ) => {
    const oldData = cqData;

    // Optimistic update
    const updatedSchemes = oldData?.schemes.map((s) => {
      if (s.key !== schemeKey) return s;
      return {
        ...s,
        cqs: s.cqs.map((c) =>
          c.key === cqKey
            ? {
                ...c,
                satisfied,
                groundsText: satisfied ? c.groundsText : undefined,
              }
            : c
        ),
      };
    });

    globalMutate(cqsKey, { ...oldData, schemes: updatedSchemes }, false);

    try {
      // Create WHY DialogueMove when marking as unsatisfied (Option A: Generic dialogue move)
      if (!satisfied && deliberationId) {
        const moveRes = await fetch("/api/dialogue/move", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType,
            targetId,
            kind: "WHY",
            payload: {
              cqKey,
              cqText: `Critical question: ${cqKey}`,
              locusPath: "0",
            },
          }),
        });
        
        if (!moveRes.ok) {
          const errorData = await moveRes.json().catch(() => ({}));
          console.warn("[CriticalQuestionsV3] Failed to create WHY move:", moveRes.status, errorData);
          // Continue anyway to update CQStatus
        }
      }

      // Update CQStatus
      const r = await fetch("/api/cqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey,
          satisfied,
          groundsText: satisfied ? groundsInput[cqKey] || "" : undefined,
          deliberationId, // Include for potential move creation
        }),
      });
      
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        if (r.status === 403) {
          alert(errorData.error || "You must be the claim author to mark CQs satisfied. Use the Community Responses feature instead.");
          throw new Error("Permission denied");
        }
        throw new Error(`HTTP ${r.status}`);
      }
      
      await globalMutate(cqsKey);
      window.dispatchEvent(new CustomEvent("cqs:changed"));
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
    } catch (err) {
      console.error("[CriticalQuestionsV3] toggleCQ error:", err);
      globalMutate(cqsKey, oldData, false);
    }
  };

  const resolveViaGrounds = async (
    schemeKey: string,
    cqKey: string,
    grounds: string
  ) => {
    if (!grounds.trim()) return;

    const oldData = cqData;

    const updatedSchemes = oldData?.schemes.map((s) => {
      if (s.key !== schemeKey) return s;
      return {
        ...s,
        cqs: s.cqs.map((c) =>
          c.key === cqKey ? { ...c, satisfied: true, groundsText: grounds } : c
        ),
      };
    });

    globalMutate(cqsKey, { ...oldData, schemes: updatedSchemes }, false);

    try {
      // Note: We do NOT create GROUNDS DialogueMoves for claim-level CQs.
      // Reason: GROUNDS moves require a prior WHY move (R2_NO_OPEN_CQ validation rule).
      // Claim-level CQs are answered directly by the author without formal WHY challenges.
      // CQStatus is the canonical storage for claim-level CQ answers.
      // 
      // For argument-level dialogue, GROUNDS moves are created when responding to specific
      // WHY challenges within the dialectical exchange. That flow is handled separately
      // in the dialogue panel components.

      // Update CQStatus (canonical storage for claim-level CQ answers)
      const r = await fetch("/api/cqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey,
          satisfied: true,
          groundsText: grounds,
          deliberationId, // Include for potential move creation
        }),
      });
      
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        if (r.status === 403) {
          alert(errorData.error || "You must be the claim author to provide canonical answers. Use the Community Responses feature instead.");
          throw new Error("Permission denied");
        }
        throw new Error(`HTTP ${r.status}`);
      }
      
      await globalMutate(cqsKey);
      window.dispatchEvent(new CustomEvent("cqs:changed"));
      window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
      
      setGroundsInput((prev) => ({ ...prev, [cqKey]: "" }));
      setExpandedCQ(null);
    } catch (err) {
      console.error("[CriticalQuestionsV3] resolveViaGrounds error:", err);
      globalMutate(cqsKey, oldData, false);
    }
  };

  const attachWithAttacker = async (
    schemeKey: string,
    cqKey: string,
    attackerClaimId: string
  ) => {
    setPosting(true);
    try {
      const r = await fetch("/api/cqs/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          schemeKey,
          cqKey,
          satisfied: false,
          attachSuggestion: true,
          attackerClaimId,
          deliberationId,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await globalMutate(cqsKey);
      await globalMutate(attachKey);
      window.dispatchEvent(new CustomEvent("cqs:changed"));
      window.dispatchEvent(new CustomEvent("claims:changed"));
      setExpandedCQ(null);
      setSearchQuery((prev) => ({ ...prev, [cqKey]: "" }));
      setSearchResults((prev) => ({ ...prev, [cqKey]: [] }));
    } catch (err) {
      console.error("[CriticalQuestionsV3] attach error:", err);
      alert("Failed to attach claim. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleSearch = async (cqKey: string, query: string) => {
    setSearchQuery((prev) => ({ ...prev, [cqKey]: query }));
    if (query.length < 2) {
      setSearchResults((prev) => ({ ...prev, [cqKey]: [] }));
      return;
    }

    setSearchLoading(cqKey);
    const results = await trySearchClaims(query);
    setSearchResults((prev) => ({ ...prev, [cqKey]: results }));
    setSearchLoading(null);
  };

  const openQuickCompose = (schemeKey: string, cqKey: string) => {
    setQuickCQKey(cqKey);
    setQuickDialogOpen(true);
    setQuickText("");
  };

  const handleQuickSubmit = async () => {
    if (!quickText.trim() || !quickCQKey || !deliberationId) return;

    setPosting(true);
    try {
      const r = await fetch("/api/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          authorId: createdById || "",
          text: quickText.trim(),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const newId = j.claim?.id || j.id;

      const schemeKey = cqData?.schemes.find((s) =>
        s.cqs.some((c) => c.key === quickCQKey)
      )?.key;
      if (!schemeKey) throw new Error("Scheme not found");

      await attachWithAttacker(schemeKey, quickCQKey, newId);
      setQuickDialogOpen(false);
      setQuickText("");
      setQuickCQKey(null);
    } catch (err) {
      console.error("[CriticalQuestionsV3] quick compose error:", err);
      alert("Failed to create claim. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const openPicker = (cqKey: string) => {
    setPickerCQKey(cqKey);
    setPickerOpen(true);
  };

  const handlePickerSelect = async (item: { id: string }) => {
    if (!pickerCQKey) return;
    const schemeKey = cqData?.schemes.find((s) =>
      s.cqs.some((c) => c.key === pickerCQKey)
    )?.key;
    if (!schemeKey) return;

    await attachWithAttacker(schemeKey, pickerCQKey, item.id);
    setPickerOpen(false);
    setPickerCQKey(null);
  };

  // Filtering
  const filteredSchemes = useMemo(() => {
    if (!cqData?.schemes) return [];
    let schemes = cqData.schemes;

    if (prefilterKeys && prefilterKeys.length > 0) {
      schemes = schemes
        .map((s) => ({
          ...s,
          cqs: s.cqs.filter((c) => prefilterKeys.includes(c.key)),
        }))
        .filter((s) => s.cqs.length > 0);
    }

    return schemes;
  }, [cqData, prefilterKeys]);

  const attachedMap = useMemo(() => {
    const map: Record<string, { id: string; text: string; count: number }[]> =
      {};
    if (!attachData?.attachments) return map;

    for (const att of attachData.attachments) {
      const key = att.cqKey;
      if (!map[key]) map[key] = [];
      map[key].push({
        id: att.attackerClaim?.id || "",
        text: att.attackerClaim?.text || "",
        count: att._count?.attackerClaim || 0,
      });
    }
    return map;
  }, [attachData]);

  if (cqError) {
    return (
      <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Failed to Load Critical Questions
            </p>
            <p className="text-xs text-red-700 mt-1">
              {cqError?.message || "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!cqData) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (filteredSchemes.length === 0) {
    return (
      <div className="p-6 bg-slate-50 border-2 border-slate-200 rounded-xl text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 mb-3">
          <HelpCircle className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          No Critical Questions
        </p>
        <p className="text-xs text-slate-500 mt-1">
          There are no critical questions defined for this scheme.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto px-3 py-2 custom-scrollbar">
      {/* Phase 4 — latent obligations panel(s) for this target.
          Renders one collapsed-by-default panel per open SchemeInstance
          attached to (targetType, targetId). Only mounted for claims —
          arguments don't carry SchemeInstance protocol state. */}
      {targetType === "claim" && deliberationId && currentUserId ? (
        <LatentObligationsForTarget
          targetType="claim"
          targetId={targetId}
          deliberationId={deliberationId}
          currentUserId={currentUserId}
          isProponent={!!isAuthor}
        />
      ) : null}

      {/* Contextual Help Banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 shrink-0">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-indigo-900">What are Critical Questions?</h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              Critical Questions (CQs) test the strength of a claim by identifying potential weaknesses or missing information.
            </p>
            <div className="flex items-start gap-4 mt-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 bg-sky-200 text-sky-900 rounded-full font-semibold">AUTHOR</span>
                  <span className="text-xs font-semibold text-slate-700">Your Role</span>
                </div>
                <p className="text-xs text-slate-600">
                  {isAuthor 
                    ? "Answer CQs by providing grounds, then mark them satisfied once addressed."
                    : "You are viewing this claim. Authors answer CQs; you can challenge via community responses."}
                </p>
              </div>
              {!isAuthor && (
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-semibold">COMMUNITY</span>
                    <span className="text-xs font-semibold text-slate-700">Challenge</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Attach contradicting claims to challenge assertions via WHY moves.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {filteredSchemes.map((scheme) => (
        <div key={scheme.key} className="space-y-2 border border-slate-200 p-2 rounded-xl">
          <div className="flex items-center gap-3 ">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Target className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-slate-900">
                {scheme.title}
              </h4>
              <p className="text-xs text-slate-600">
                {scheme.cqs.filter((c) => c.satisfied).length} /{" "}
                {scheme.cqs.length} satisfied
              </p>
            </div>
          </div>

          <div className="space-y-2  ">
            {scheme.cqs.map((cq) => {
              const isExpanded = expandedCQ === cq.key;
              const attached = attachedMap[cq.key] || [];
              const suggestion = suggestionForCQ(cq.key, cq.text);

              return (
                <div
                  key={cq.key}
                  className={`
                    rounded-xl border-2 transition-all duration-300 p-1
                    ${
                      cq.satisfied
                        ? "border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-emerald-100/50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                    }
                  `}
                >
                  <div className="px-3 py-2">
                    <button
                      onClick={() => setExpandedCQ(isExpanded ? null : cq.key)}
                      className="w-full flex items-start gap-3 text-left"
                    >
                      <div className="mt-0.5 shrink-0">
                        {cq.satisfied ? (
                          <div className="p-0 rounded-full bg-emerald-200">
                            <CheckCircle2
                              className="w-5 h-5 text-emerald-700"
                              strokeWidth={2.5}
                            />
                          </div>
                        ) : (
                          <div className="p-0 rounded-full bg-slate-100">
                            <Circle
                              className="w-5 h-5 text-slate-400"
                              strokeWidth={2}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium leading-relaxed ${
                            cq.satisfied ? "text-emerald-900" : "text-slate-800"
                          }`}
                        >
                          {cq.text}
                        </p>
                        
                        {/* Phase 0.1: Burden of Proof indicator */}
                        {cq.burdenOfProof && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBurdenBadgeColor(cq.burdenOfProof as any)}`}>
                              {getBurdenBadgeText(cq.burdenOfProof as any)}
                            </span>
                            {cq.requiresEvidence && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                                Evidence required
                              </span>
                            )}
                            {cq.premiseType && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                {getPremiseTypeDisplay(cq.premiseType as any)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Session 11b items 2/4/5 — divergence type, CQ→scheme
                            cross-references, and the presumption hint (shared
                            component; renders independently of the burden block). */}
                        <CqInsightChips
                          schemeKey={scheme.key}
                          cqKey={cq.key}
                          premiseType={cq.premiseType}
                          satisfied={cq.satisfied}
                        />

                        {cq.satisfied && cq.groundsText && (
                          <div className="mt-2 p-3 bg-white rounded-lg border border-emerald-200">
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {cq.groundsText}
                              </p>
                            </div>
                          </div>
                        )}
                        {attached.length > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <Link2 className="w-4 h-4 text-indigo-500" />
                            <span className="font-medium text-indigo-700">
                              {attached.length} counter-claim
                              {attached.length !== 1 ? "s" : ""} attached
                            </span>
                          </div>
                        )}
                        {/* Phase 8: Dialogue Move count badges */}
                        {deliberationId && ((cq.whyCount ?? 0) > 0 || (cq.groundsCount ?? 0) > 0) && (
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
                            cq.satisfied ? "text-emerald-600" : "text-slate-400"
                          }`}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 animate-in slide-in-from-top-0 duration-400">
                        {/* Author-Only: Mark Satisfied + Provide Grounds */}
                        {isAuthor && (
                          <>
                            {/* Quick Satisfaction Toggle (Author Only) */}
                            <div className="flex items-center justify-between px-3 py-1.5 bg-sky-50 rounded-lg border border-sky-300">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 bg-sky-200 text-sky-900 rounded-full font-semibold">AUTHOR</span>
                                <span className="text-sm font-medium text-slate-700">
                                  Mark as {cq.satisfied ? "unsatisfied" : "satisfied"}
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  toggleCQ(scheme.key, cq.key, !cq.satisfied)
                                }
                                className={
                                  cq.satisfied
                                    ? "btnv2--ghost rounded-lg px-2 py-1 border-slate-300 bg-slate-100 text-slate-800 text-xs hover:bg-slate-200"
                                    : "btnv2--ghost rounded-lg px-2 py-1 text-xs bg-sky-600 text-white hover:bg-sky-700"
                                }
                              >
                                {cq.satisfied ? "Unmark" : "Mark Satisfied"}
                              </button>
                            </div>

                            {/* Answer This Question (Grounds Input - Author Only) */}
                            {!cq.satisfied && (
                              <div className="space-y-3 bg-sky-50/50 p-3 rounded-lg border border-sky-200">
                                <div className="flex items-center gap-2">
                                  <MessageCircle className="w-4 h-4 text-sky-600" />
                                  <label className="text-sm font-semibold text-sky-900">
                                    Answer This Question
                                  </label>
                                  <span className="text-xs text-sky-700 ml-auto">
                                    Explain how your claim satisfies this CQ
                                  </span>
                                </div>
                                <Textarea
                                  placeholder="Your answer..."
                                  value={groundsInput[cq.key] || ""}
                                  onChange={(e) =>
                                    setGroundsInput((prev) => ({
                                      ...prev,
                                      [cq.key]: e.target.value,
                                    }))
                                  }
                                  className="text-sm articlesearchfield resize-none"
                                  rows={3}
                                />
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-500">
                                    {(groundsInput[cq.key] || "").length} characters
                                  </span>
                                  <button
                                   
                                    onClick={() =>
                                      resolveViaGrounds(
                                        scheme.key,
                                        cq.key,
                                        groundsInput[cq.key] || ""
                                      )
                                    }
                                    disabled={!(groundsInput[cq.key] || "").trim()}
                                    className="flex btnv2 py-2 px-3 text-xs rounded-full items-center gap-2 bg-sky-300 "
                                  >
                                    <Send className="w-3 h-3" />
                                    Submit Answer & Mark as Satisfied
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Community: Challenge With Evidence */}
                        {!isAuthor && (
                          <div className="space-y-2 pt-2 border-t border-amber-400/40 bg-amber-50/30 p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full font-semibold">COMMUNITY</span>
                              <Link2 className="w-4 h-4 text-amber-600" />
                              <label className="text-sm font-semibold text-amber-900">
                                Challenge With Evidence
                              </label>
                            </div>
                            <p className="text-xs text-amber-800">
                              Attach a contradicting claim to question this assertion via WHY move
                            </p>

                            {attached.length > 0 && (
                              <div className="space-y-2 mt-2">
                                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                                  Currently Attached
                                </p>
                                {attached.map((a) => (
                                  <div
                                    key={a.id}
                                    className="p-3 bg-amber-100 border border-amber-300 rounded-lg"
                                  >
                                    <p className="text-sm text-amber-900">
                                      {a.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() =>
                                  openQuickCompose(scheme.key, cq.key)
                                }
                                className="flex flex-1 btnv2--ghost bg-white
                                rounded-lg px-3 py-2 text-sm border-amber-300 hover:bg-amber-50"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Create New Counter-Claim
                              </button>
                              <button
                                onClick={() => openPicker(cq.key)}
                                className="flex flex-1 btnv2--ghost bg-white
                                rounded-lg px-3 py-2 text-sm border-amber-300 hover:bg-amber-50"
                              >
                                <Search className="w-4 h-4 mr-2" />
                                Find Existing
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Shared: Community Responses (Visible to All) */}
                        <div className="space-y-2 pt-2 border-t border-slate-400/40">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquarePlus className="w-4 h-4 text-sky-600" />
                            <label className="text-sm font-semibold text-slate-900">
                              Community Responses
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                if (!cq.id) {
                                  console.warn("CQ has no ID - cannot submit response");
                                  return;
                                }
                                setSelectedCQForResponse({ id: cq.id, text: cq.text });
                                setResponseFormOpen(true);
                              }}
                              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-sky-500/20 to-cyan-500/20 hover:from-sky-500/30 hover:to-cyan-500/30 border border-sky-400/30 transition-all text-sm font-semibold text-sky-900"
                            >
                              <MessageSquarePlus className="w-4 h-4" />
                              Submit Response
                            </button>

                            <button
                              onClick={() => {
                                if (!cq.id) {
                                  console.warn("CQ has no ID - cannot view responses");
                                  return;
                                }
                                setSelectedCQForList({ id: cq.id, text: cq.text });
                                setResponsesListOpen(true);
                              }}
                              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 border border-slate-900/10 transition-all text-sm font-semibold text-slate-700"
                            >
                              <List className="w-4 h-4" />
                              View Responses
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              if (cq.id) {
                                setSelectedCQForActivity(cq.id);
                                setActivityFeedOpen(true);
                              } else {
                                console.warn("CQ has no ID - cannot load activity feed");
                              }
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 border border-slate-900/10 transition-all text-sm font-semibold text-slate-700"
                          >
                            <Activity className="w-4 h-4" />
                            Activity Timeline
                          </button>
                        </div>

                        {/* Legal Moves (Advanced - Collapsed by default) */}
                        {deliberationId && movesData && (
                          <div className="pt-3 border-t border-slate-200">
                            <button
                              onClick={() =>
                                setExpandedMoves(
                                  expandedMoves === cq.key ? null : cq.key
                                )
                              }
                              className="w-full flex items-center justify-between text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span>Legal Moves</span>
                                <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-semibold">ADVANCED</span>
                              </div>
                              {expandedMoves === cq.key ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                            {expandedMoves === cq.key && (
                              <div className="mt-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <p className="text-xs text-slate-600 mb-2">
                                  Ludics dialogue protocol moves for structured debate
                                </p>
                                <LegalMoveChips
                                  deliberationId={deliberationId}
                                  targetType={targetType as TargetType}
                                  targetId={targetId}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Quick Compose Dialog */}
      <Dialog open={quickDialogOpen} onOpenChange={setQuickDialogOpen}>
        <DialogContent 
          className="!z-[70] max-w-2xl bg-sky-200/70 backdrop-blur-lg"
          overlayClassName="!z-[70]"
        >
          <DialogHeader>
            <DialogTitle>Create Counter-Claim</DialogTitle>
            <DialogDescription>
              Write a new claim that addresses this critical question.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your counter-claim..."
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            className="articlesearchfield min-h-[120px]"
            autoFocus
          />
          <DialogFooter className="gap-2">
            <button className="btnv2--ghost px-2 py-1 bg-slate-200 text-sm rounded-lg" onClick={() => setQuickDialogOpen(false)}>
              Cancel
            </button>
            <button
            className="btnv2--ghost px-2 py-1 text-sm bg-white hover:bg-slate-100 rounded-lg"
              onClick={handleQuickSubmit}
              disabled={!quickText.trim() || posting}
            >
              {posting ? "Creating..." : "Create & Attach"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheme Picker */}
      <SchemeComposerPicker
        kind="claim"
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickerSelect}
      />

      {/* CQ Response Form */}
      {selectedCQForResponse && (
        <CQResponseForm
          open={responseFormOpen}
          onOpenChange={setResponseFormOpen}
          cqStatusId={selectedCQForResponse.id}
          cqText={selectedCQForResponse.text}
          onSuccess={() => {
            globalMutate(cqsKey);
            window.dispatchEvent(new CustomEvent("cqs:changed"));
          }}
        />
      )}

      {/* CQ Responses List Dialog */}
      <Dialog open={responsesListOpen} onOpenChange={setResponsesListOpen}>
        <DialogContent 
          className="!z-[70] max-w-4xl max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl p-6 panel-edge"
          overlayClassName="!z-[70]"
        >
          

          <div className="relative z-10 overflow-y-auto max-h-[85vh] custom-scrollbar-light px-2">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold text-transparent bg-gradient-to-r from-sky-700 via-cyan-700 to-sky-700 bg-clip-text">
                Community Responses
              </DialogTitle>
              {selectedCQForList && (
                <DialogDescription className="text-slate-600 leading-relaxed">
                  {selectedCQForList.text}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Author Dashboard (if user can moderate) */}
            {selectedCQForList && createdById && (
              <div className="mb-4">
                <CQAuthorDashboard
                  cqStatusId={selectedCQForList.id}
                  currentUserId={currentUserId}
                  canModerate={true}
                  onApprove={async (responseId, setAsCanonical) => {
                    // Handled by CQResponseCard/CQAuthorDashboard
                  }}
                  onReject={async (responseId, reason) => {
                    // Handled by CQResponseCard/CQAuthorDashboard
                  }}
                />
              </div>
            )}

            {/* Responses List */}
            {selectedCQForList && (
              <CQResponsesList
                cqStatusId={selectedCQForList.id}
                currentUserId={currentUserId}
                canModerate={true}
                onEndorse={(responseId) => {
                  setSelectedResponseForEndorse(responseId);
                  setEndorseModalOpen(true);
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Feed Dialog */}
      <Dialog open={activityFeedOpen} onOpenChange={setActivityFeedOpen}>
        <DialogContent 
          className="!z-[70] max-w-2xl max-h-[90vh] overflow-hidden bg-white/95 backdrop-blur-xl shadow-2xl p-6 panel-edge"
          overlayClassName="!z-[70]"
        >
         

          <div className="relative z-10 overflow-y-auto max-h-[85vh] custom-scrollbar-light px-2">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold text-transparent bg-gradient-to-r from-sky-700 via-cyan-700 to-sky-700 bg-clip-text">
                Activity Timeline
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Recent activity for this critical question
              </DialogDescription>
            </DialogHeader>

            {selectedCQForActivity && (
              <CQActivityFeed cqStatusId={selectedCQForActivity} limit={20} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Endorse Modal */}
      {selectedResponseForEndorse && selectedCQForList && (
        <CQEndorseModal
          open={endorseModalOpen}
          onOpenChange={setEndorseModalOpen}
          responseId={selectedResponseForEndorse}
          cqStatusId={selectedCQForList.id}
          onSuccess={() => {
            globalMutate(cqsKey);
            window.dispatchEvent(new CustomEvent("cqs:changed"));
          }}
        />
      )}
    </div>
  );
}
