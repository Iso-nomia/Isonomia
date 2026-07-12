////This is a legacy, obselete file kept for reference. Please do not edit or use this file.

// components/arguments/ArgumentCard.tsx
"use client";
import * as React from "react";
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import useSWR from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AttackMenuPro } from "./AttackMenuPro";
import CriticalQuestions from "@/components/claims/CriticalQuestionsV2";
import { ArgumentCriticalQuestionsModal } from "./ArgumentCriticalQuestionsModal";
import { CommunityResponseBadge } from "@/components/agora/CommunityResponseBadge";
import { DialogueStateBadge } from "@/components/dialogue/DialogueStateBadge";

const fetcher = (url: string) => fetch(url).then(r => r.json());

type Prem = { id: string; text: string };

interface ArgumentCardProps {
  deliberationId: string;
  authorId: string;
  id: string;
  conclusion: { id: string; text: string };
  premises: Prem[];
  onAnyChange?: () => void;
  schemeKey?: string | null;
  schemeName?: string | null;
  lastUpdatedAt?: Date | string; // Phase 2.2: Temporal decay
}

export function ArgumentCard({
  deliberationId,
  authorId,
  id,
  conclusion,
  premises,
  onAnyChange,
  schemeKey,
  schemeName,
  lastUpdatedAt,
}: ArgumentCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [attacks, setAttacks] = React.useState<any[]>([]);
  const [cqDialogOpen, setCqDialogOpen] = React.useState(false);
  const [argCqDialogOpen, setArgCqDialogOpen] = React.useState(false);

  // Phase 2.2: Check if argument is stale (> 30 days old)
  const isStale = React.useMemo(() => {
    if (!lastUpdatedAt) return false;
    const date = typeof lastUpdatedAt === "string" ? new Date(lastUpdatedAt) : lastUpdatedAt;
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 30;
  }, [lastUpdatedAt]);

  const staleDays = React.useMemo(() => {
    if (!lastUpdatedAt) return 0;
    const date = typeof lastUpdatedAt === "string" ? new Date(lastUpdatedAt) : lastUpdatedAt;
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }, [lastUpdatedAt]);

  // Fetch CQ data for the conclusion claim (claim-level CQs)
  const { data: cqData } = useSWR(
    conclusion?.id ? `/api/cqs?targetType=claim&targetId=${conclusion.id}` : null,
    fetcher
  );

  // Fetch CQ data for the argument itself (argument-level CQs)
  const { data: argCqData } = useSWR(
    id ? `/api/cqs?targetType=argument&targetId=${id}` : null,
    fetcher
  );

  // Compute CQ status for claim
  const cqStatus = React.useMemo(() => {
    if (!cqData) return null;
    // Handle different API response formats
    const cqArray = Array.isArray(cqData) ? cqData : (cqData?.items || cqData?.cqs || []);
    if (cqArray.length === 0) return null;
    const required = cqArray.length;
    const satisfied = cqArray.filter((cq: any) => cq.satisfied).length;
    const percentage = required > 0 ? Math.round((satisfied / required) * 100) : 0;
    return { required, satisfied, percentage };
  }, [cqData]);

  // Compute CQ status for argument
  const argCqStatus = React.useMemo(() => {
    if (!argCqData) return null;
    const schemes = argCqData.schemes || [];
    if (schemes.length === 0) return null;
    
    let required = 0;
    let satisfied = 0;
    schemes.forEach((scheme: any) => {
      const cqs = scheme.cqs || [];
      required += cqs.length;
      satisfied += cqs.filter((cq: any) => cq.satisfied).length;
    });
    
    if (required === 0) return null;
    const percentage = Math.round((satisfied / required) * 100);
    return { required, satisfied, percentage };
  }, [argCqData]);

  // Fetch attacks when expanded - from both ArgumentEdge and ConflictApplication
  // We need both sources because:
  // - ArgumentEdge: Created when both attacking and target are Arguments
  // - ConflictApplication: Created when attacking with a Claim (e.g., undercuts with exception text)
  React.useEffect(() => {
    if (!expanded) return;
    
    const fetchAttacks = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch from both sources in parallel
        const [edgesRes, caRes] = await Promise.all([
          fetch(`/api/arguments/${id}/attacks`, { cache: "no-store" }),
          fetch(`/api/ca?targetArgumentId=${id}`, { cache: "no-store" })
        ]);

        const edgesData = edgesRes.ok ? await edgesRes.json() : { items: [] };
        const caData = caRes.ok ? await caRes.json() : { items: [] };

        // Combine ArgumentEdge items
        const edgeAttacks = (edgesData.items || []).map((edge: any) => ({
          id: edge.id,
          attackType: edge.attackType,
          targetScope: edge.targetScope,
          fromArgumentId: edge.fromArgumentId,
          source: "edge"
        }));

        // Convert ConflictApplications to attack format
        const caAttacks = (caData.items || [])
          .filter((ca: any) => ca.conflictedArgumentId === id && ca.legacyAttackType)
          .map((ca: any) => ({
            id: ca.id,
            attackType: ca.legacyAttackType,
            targetScope: ca.legacyTargetScope,
            fromArgumentId: ca.conflictingArgumentId,
            fromClaimId: ca.conflictingClaimId,
            source: "ca"
          }));

        // Merge both sources
        const allAttacks = [...edgeAttacks, ...caAttacks];
        setAttacks(allAttacks);
      } catch (err) {
        console.error("Failed to fetch attacks:", err);
        setError("Failed to load attacks");
      } finally {
        setLoading(false);
      }
    };

    fetchAttacks();
  }, [expanded, id]);

  const handleRefresh = React.useCallback(() => {
    // Refresh local attack list from both sources
    if (expanded) {
      Promise.all([
        fetch(`/api/arguments/${id}/attacks`, { cache: "no-store" }),
        fetch(`/api/ca?targetArgumentId=${id}`, { cache: "no-store" })
      ]).then(async ([edgesRes, caRes]) => {
        const edgesData = edgesRes.ok ? await edgesRes.json() : { items: [] };
        const caData = caRes.ok ? await caRes.json() : { items: [] };

        const edgeAttacks = (edgesData.items || []).map((edge: any) => ({
          id: edge.id,
          attackType: edge.attackType,
          targetScope: edge.targetScope,
          fromArgumentId: edge.fromArgumentId,
          source: "edge"
        }));

        const caAttacks = (caData.items || [])
          .filter((ca: any) => ca.conflictedArgumentId === id && ca.legacyAttackType)
          .map((ca: any) => ({
            id: ca.id,
            attackType: ca.legacyAttackType,
            targetScope: ca.legacyTargetScope,
            fromArgumentId: ca.conflictingArgumentId,
            fromClaimId: ca.conflictingClaimId,
            source: "ca"
          }));

        setAttacks([...edgeAttacks, ...caAttacks]);
      }).catch(console.error);
    }
    // Notify parent
    onAnyChange?.();
  }, [expanded, id, onAnyChange]);

  const rebutAttacks = attacks.filter(a => a.attackType === "REBUTS");
  const undercutAttacks = attacks.filter(a => a.attackType === "UNDERCUTS");
  const undermineAttacks = attacks.filter(a => a.attackType === "UNDERMINES");

  return (
    <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white w-full shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 ">
        <div className="flex-1 w-full min-w-0">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                {conclusion.text}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {schemeName && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200">
                    <div className="text-[10px] font-medium text-indigo-700 uppercase tracking-wide">
                      {schemeName}
                    </div>
                  </div>
                )}
                {cqStatus && cqStatus.required > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                    <div className="text-[10px] font-medium text-amber-700">
                      Claim CQ {cqStatus.percentage}%
                    </div>
                  </div>
                )}
                {argCqStatus && argCqStatus.required > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200">
                    <div className="text-[10px] font-medium text-purple-700">
                      Arg CQ {argCqStatus.percentage}%
                    </div>
                  </div>
                )}
                {/* Stale Indicator (Phase 2.2) */}
                {isStale && (
                  <div 
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300"
                    title={`This argument hasn't been updated in ${staleDays} days. Confidence may have decayed due to age.`}
                  >
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <div className="text-[10px] font-medium text-amber-700">
                      Stale ({staleDays}d)
                    </div>
                  </div>
                )}
                {/* Dialogue State Badge (Phase 3.1) */}
                <DialogueStateBadge
                  deliberationId={deliberationId}
                  argumentId={id}
                />
                {/* Community Response Badge */}
                <CommunityResponseBadge
                  targetId={id}
                  targetType="argument"
                  variant="compact"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Claim CQs button */}
          {cqStatus && cqStatus.required > 0 && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors duration-200"
              onClick={() => setCqDialogOpen(true)}
              aria-label="View critical questions for the conclusion claim"
              title="Critical questions about the claim"
            >
              Claim CQs
            </button>
          )}
          {/* Argument CQs button */}
          
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors duration-200"
              onClick={() => setArgCqDialogOpen(true)}
              aria-label="View critical questions for the argument scheme"
              title="Critical questions about the reasoning"
            >
              Arg CQs
            </button>

          {/* Add to Thesis button */}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors duration-200"
            onClick={() => {
              // Navigate to thesis builder with this argument pre-selected
              window.location.href = `/deliberations/${deliberationId}/thesis?addArgumentId=${id}`;
            }}
            aria-label="Add this argument to a thesis"
            title="Add to a thesis document"
          >
            Add to Thesis
          </button>

          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors duration-200 shrink-0"
            onClick={() => setExpanded(x => !x)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse argument" : "Expand argument"}
          >
            {expanded ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Collapse
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                Expand
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview when collapsed */}
      {!expanded && premises.length > 0 && (
        <div className="text-xs text-slate-600 leading-relaxed border-l-2 border-slate-200 pl-3">
          <span className="font-medium text-slate-700">Premises:</span>{" "}
          {premises.map(p => p.text).join(" • ")}
        </div>
      )}

      {/* Expanded view */}
      {expanded && (
        <div className="space-y-4 pt-2 border-t border-slate-200">
          {/* Premises section */}
          {premises.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Premises
                </h4>
                {undermineAttacks.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[10px] font-medium text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    {undermineAttacks.length} challenge{undermineAttacks.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {premises.map(p => (
                  <li
                    key={p.id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                    <span className="text-xs text-slate-700 leading-relaxed flex-1">
                      {p.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <strong>No premises found.</strong> This argument may be a bare assertion.
                </div>
              </div>
            </div>
          )}

          {/* Inference/Reasoning section */}
          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                Inference
              </h4>
              {undercutAttacks.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-300 text-[10px] font-medium text-amber-700">
                  <AlertCircle className="w-3 h-3" />
                  {undercutAttacks.length} exception{undercutAttacks.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed">
              The reasoning that connects the premises to the conclusion.
              {schemeKey && (
                <span className="block mt-1 font-medium">
                  Using scheme: {schemeName || schemeKey}
                </span>
              )}
            </p>
          </div>

          {/* Attacks summary */}
          {(loading || attacks.length > 0) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Active Challenges
              </h4>
              {loading ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                  <span className="text-xs text-slate-600">Loading challenges...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {rebutAttacks.length > 0 && (
                    <div className="space-y-1">
                      {rebutAttacks.map((attack: any) => (
                        <div 
                          key={attack.id}
                          className={`p-2 rounded-lg border ${
                            attack.dialogueStatus === 'answered' 
                              ? 'bg-emerald-50 border-emerald-300' 
                              : attack.dialogueStatus === 'challenged'
                              ? 'bg-rose-50 border-rose-300'
                              : 'bg-rose-50 border-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${
                              attack.dialogueStatus === 'answered'
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                            }`}>
                              Rebuttal (challenging conclusion)
                            </span>
                            {attack.dialogueStatus === 'answered' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-medium">
                                ✓ Answered
                              </span>
                            )}
                            {attack.dialogueStatus === 'challenged' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-600 text-white font-medium">
                                ⚠ Challenged
                              </span>
                            )}
                          </div>
                          {attack.dialogueStatus !== 'neutral' && (
                            <div className="text-[10px] text-slate-600 mt-1">
                              {attack.whyCount > 0 && `${attack.whyCount} WHY`}
                              {attack.whyCount > 0 && attack.groundsCount > 0 && ' • '}
                              {attack.groundsCount > 0 && `${attack.groundsCount} GROUNDS`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {undercutAttacks.length > 0 && (
                    <div className="space-y-1">
                      {undercutAttacks.map((attack: any) => (
                        <div 
                          key={attack.id}
                          className={`p-2 rounded-lg border ${
                            attack.dialogueStatus === 'answered' 
                              ? 'bg-emerald-50 border-emerald-300' 
                              : attack.dialogueStatus === 'challenged'
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-amber-50 border-amber-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${
                              attack.dialogueStatus === 'answered'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}>
                              Undercut (challenging reasoning)
                            </span>
                            {attack.dialogueStatus === 'answered' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-medium">
                                ✓ Answered
                              </span>
                            )}
                            {attack.dialogueStatus === 'challenged' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-medium">
                                ⚠ Challenged
                              </span>
                            )}
                          </div>
                          {attack.dialogueStatus !== 'neutral' && (
                            <div className="text-[10px] text-slate-600 mt-1">
                              {attack.whyCount > 0 && `${attack.whyCount} WHY`}
                              {attack.whyCount > 0 && attack.groundsCount > 0 && ' • '}
                              {attack.groundsCount > 0 && `${attack.groundsCount} GROUNDS`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {undermineAttacks.length > 0 && (
                    <div className="space-y-1">
                      {undermineAttacks.map((attack: any) => (
                        <div 
                          key={attack.id}
                          className={`p-2 rounded-lg border ${
                            attack.dialogueStatus === 'answered' 
                              ? 'bg-emerald-50 border-emerald-300' 
                              : attack.dialogueStatus === 'challenged'
                              ? 'bg-orange-50 border-orange-300'
                              : 'bg-orange-50 border-orange-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-medium ${
                              attack.dialogueStatus === 'answered'
                                ? 'text-emerald-700'
                                : 'text-orange-700'
                            }`}>
                              Undermine (challenging premises)
                            </span>
                            {attack.dialogueStatus === 'answered' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-medium">
                                ✓ Answered
                              </span>
                            )}
                            {attack.dialogueStatus === 'challenged' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-600 text-white font-medium">
                                ⚠ Challenged
                              </span>
                            )}
                          </div>
                          {attack.dialogueStatus !== 'neutral' && (
                            <div className="text-[10px] text-slate-600 mt-1">
                              {attack.whyCount > 0 && `${attack.whyCount} WHY`}
                              {attack.whyCount > 0 && attack.groundsCount > 0 && ' • '}
                              {attack.groundsCount > 0 && `${attack.groundsCount} GROUNDS`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div className="text-xs text-red-800">{error}</div>
              </div>
            </div>
          )}

          {/* Attack menu */}
          <div className="pt-2 border-t border-slate-200">
            <AttackMenuPro
              deliberationId={deliberationId}
              authorId={authorId}
              target={{ id, conclusion, premises }}
              onDone={handleRefresh}
            />
          </div>
        </div>
      )}

      {/* CQ Dialog */}
      <Dialog open={cqDialogOpen} onOpenChange={setCqDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Critical Questions</DialogTitle>
          </DialogHeader>
          {conclusion?.id && (
            <CriticalQuestions
              targetType="claim"
              targetId={conclusion.id}
              deliberationId={deliberationId}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Argument CQ Dialog */}
      <ArgumentCriticalQuestionsModal
        open={argCqDialogOpen}
        onOpenChange={setArgCqDialogOpen}
        argumentId={id}
        deliberationId={deliberationId}
      />
    </div>
  );
}
