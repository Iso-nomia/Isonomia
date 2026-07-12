"use client";
import * as React from "react";
import useSWR from "swr";
import { Activity, Link as LinkIcon, Tag, Swords, ChevronDown, Users, Maximize2 } from "lucide-react";
import { InlineCommitmentCount } from "@/components/aif/CommitmentBadge";
import { ClaimContraryManager } from "@/components/claims/ClaimContraryManager";
import { ContraryBadge } from "@/components/claims/contraryBadge/ContraryBadge";
import { AttackCreationModal } from "@/components/aspic/AttackCreationModal";
import CriticalQuestionsV3 from "@/components/claims/CriticalQuestionsV3";
import { mutate } from "swr";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { current } from "immer";
import { GroupedCitationList, EvidenceBalanceBar } from "@/components/citations/GroupedCitationList";
import { EvidencePanel } from "@/components/citations/EvidencePanel";
import { TypologyAxisStrip } from "@/components/typology/TypologyAxisStrip";
import { SuggestedRetractionsPanel } from "@/components/claims/SuggestedRetractionsPanel";

const fetcher = (url: string) => fetch(url).then(r => r.json());

type ClaimDetailPanelProps = {
  claimId: string;
  deliberationId: string;
  className?: string;
  claimText?: string; // Optional: Claim text for contraries manager
  createdById?: string; // Current user ID
  claimAuthorId?: string; // Author of the claim (who should answer CQs)
  currentUserId?: string; // Current logged-in user ID
};

/**
 * ClaimDetailPanel - Expandable panel showing rich metadata for a claim
 * Used in ArgumentCardV2 for premises and conclusion
 * 
 * Fetches data from:
 * - /api/deliberations/[id]/ceg/mini/[claimId] - CEG label, confidence, metrics (support/attack strength, controversial flag, hub status)
 * - /api/deliberations/[id]/moves?targetId=[claimId] - Dialogical activity (WHY, GROUNDS, CONCEDE, RETRACT)
 * - /api/claims/[id]/citations - Citations attached to the claim
 * - /api/cqs?targetType=claim&targetId=[claimId] - Critical Question completion status
 * 
 * Displays:
 * - CEG Labels (IN, OUT, UNDEC) with confidence
 * - CEG Metrics (Controversial, Hub with centrality score)
 * - Dialogical Activity (WHY, GROUNDS, Concessions, Retractions)
 * - Critical Question completion percentage
 * - Citations with links
 */
export function ClaimDetailPanel({ claimId, deliberationId, className = "", claimText, createdById, claimAuthorId, currentUserId }: ClaimDetailPanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [showAttackModal, setShowAttackModal] = React.useState(false); // Phase F: Attack creation modal
  const [cqOpenFor, setCqOpenFor] = React.useState<string | null>(null); // CQ modal state
  const [loadingSchemes, setLoadingSchemes] = React.useState(false); // Loading state for ensure-schemes
  const [showEvidencePanel, setShowEvidencePanel] = React.useState(false); // Phase 2.4: Full evidence panel

  // Handler to ensure schemes before opening CQ modal
  const handleOpenCQ = React.useCallback(async (claimId: string) => {
    setLoadingSchemes(true);
    try {
      await fetch(`/api/claims/${claimId}/ensure-schemes`, { method: "POST" });
      await new Promise(resolve => setTimeout(resolve, 200));
      setCqOpenFor(claimId);
    } catch (err) {
      console.error("Failed to ensure schemes:", err);
    } finally {
      setLoadingSchemes(false);
    }
  }, []);

  // Fetch CEG data for this specific claim (includes label, confidence, metrics)
  const { data: cegData } = useSWR(
    expanded ? `/api/deliberations/${deliberationId}/ceg/mini/${claimId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch dialogical moves
  const { data: movesData } = useSWR(
    expanded ? `/api/deliberations/${deliberationId}/moves?targetId=${claimId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch citations
  const { data: citationsData } = useSWR(
    expanded ? `/api/claims/${claimId}/citations` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch CQ status
  const { data: cqData } = useSWR(
    expanded ? `/api/cqs?targetType=claim&targetId=${claimId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch commitment data for this claim
  const { data: commitmentData } = useSWR(
    expanded && deliberationId ? `/api/aif/dialogue/${deliberationId}/commitments` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );

  const cegNode = cegData?.node;
  const citations = citationsData?.citations || [];
  const label = cegNode?.label || "UNDEC";
  const isControversial = cegNode?.isControversial || false;
  
  // Compute dialogical activity from moves
  const dialogicalActivity = React.useMemo(() => {
    const allMoves = movesData?.moves || [];
    const whyMoves = allMoves.filter((m: any) => m.kind === "WHY");
    const groundsMoves = allMoves.filter((m: any) => m.kind === "GROUNDS");
    const concessions = allMoves.filter((m: any) => m.kind === "CONCEDE");
    const retractions = allMoves.filter((m: any) => m.kind === "RETRACT");
    const openWhys = whyMoves.filter((m: any) => !m.resolved).length;
    
    return {
      whyCount: whyMoves.length,
      openWhys,
      groundsCount: groundsMoves.length,
      concedeCount: concessions.length,
      retractCount: retractions.length
    };
  }, [movesData]);

  // Compute CQ completion
  const cqCompletion = React.useMemo(() => {
    if (!cqData?.schemes) return null;
    let required = 0;
    let satisfied = 0;
    cqData.schemes.forEach((scheme: any) => {
      const cqs = scheme.cqs || [];
      required += cqs.length;
      satisfied += cqs.filter((cq: any) => cq.satisfied).length;
    });
    if (required === 0) return null;
    return { required, satisfied, percentage: Math.round((satisfied / required) * 100) };
  }, [cqData]);

  // Extract commitments for this specific claim
  const claimCommitments = React.useMemo(() => {
    if (!commitmentData || !Array.isArray(commitmentData)) return [];
    const commitments: Array<{ participantId: string; participantName: string; isActive: boolean; timestamp: string }> = [];
    
    for (const store of commitmentData) {
      for (const commitment of store.commitments || []) {
        if (commitment.claimId === claimId) {
          commitments.push({
            participantId: store.participantId,
            participantName: store.participantName || "Unknown",
            isActive: commitment.isActive,
            timestamp: commitment.timestamp,
          });
        }
      }
    }
    
    return commitments.sort((a, b) => {
      // Active commitments first, then by timestamp
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [commitmentData, claimId]);

  const hasActivity = dialogicalActivity.whyCount + dialogicalActivity.groundsCount + 
                      dialogicalActivity.concedeCount + dialogicalActivity.retractCount > 0;
  
  // Check if claim has any meaningful data to display
  const hasCegData = cegNode && (
    cegNode.inDegree > 0 || 
    cegNode.outDegree > 0 || 
    cegNode.isControversial ||
    cegNode.label !== "UNDEC"
  );
  
  const hasContent = hasActivity || citations.length > 0 || hasCegData || cqCompletion !== null || claimCommitments.length > 0;

  // Always show the expand button, even if no content yet
  return (
    <div className={`${className}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-2 bg-slate-100 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 
         transition-colors flex items-center justify-between group"
      >
        <span className="flex items-center gap-2">
          <span className={`transform transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
          <span>Claim Details</span>
          {!expanded && hasContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-full">
              {[
                hasActivity && "activity",
                citations.length > 0 && `${citations.length} cite`,
                claimCommitments.length > 0 && `${claimCommitments.length} committed`,
                isControversial && "controversial",
                label !== "UNDEC" && label
              ].filter(Boolean).join(", ")}
            </span>
          )}
          {!expanded && (
            <ContraryBadge
              deliberationId={deliberationId}
              claimId={claimId}
              claimText={claimText || cegNode?.text}
              size="xs"
            />
          )}
         
        </span>
      </button>

      {expanded && (
        <div className="px-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* B3.6: Tagged disagreement axis pills (claim-level) */}
          <TypologyAxisStrip
            deliberationId={deliberationId}
            targetType="CLAIM"
            targetId={claimId}
            className="px-3"
          />

          {/* Sprint D — Belief revision: suggested retractions when this claim is OUT (Ambler §4) */}
          {label === "OUT" && (
            <div className="px-3">
              <SuggestedRetractionsPanel claimId={claimId} />
            </div>
          )}

          {/* Show message if no content yet */}
          {!hasContent && (
            <div className="px-2 py-1 text-xs text-slate-500 italic bg-slate-50/50 rounded-lg border border-slate-200">
              No additional data yet. Check back after dialogical activity, citations, or CEG evaluation.
            </div>
          )}

          {/* Metrics Row */}
          {hasContent && (
            <div className="flex items-center gap-2 flex-wrap px-3">
             
              {label !== "UNDEC" && (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {label}
                </span>
              )}
              {isControversial && (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                  ⚖️ Controversial
                </span>
              )}
              {cegNode && cegNode.centrality > 4 && (
                <span className="text-[11px] px-2 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                  🔗 Hub ({cegNode.centrality})
                </span>
              )}
            </div>
          )}

          {/* CEG Graph Structure */}
          {cegNode && (cegNode.inDegree > 0 || cegNode.outDegree > 0) && (
            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Graph Position
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                {cegNode.inDegree > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Incoming edges:</span>
                    <span className="font-medium">{cegNode.inDegree}</span>
                  </div>
                )}
                {cegNode.outDegree > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Outgoing edges:</span>
                    <span className="font-medium">{cegNode.outDegree}</span>
                  </div>
                )}
                {cegNode.supportStrength > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-600">Support strength:</span>
                    <span className="font-medium text-emerald-700">{cegNode.supportStrength.toFixed(1)}</span>
                  </div>
                )}
                {cegNode.attackStrength > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-rose-600">Attack strength:</span>
                    <span className="font-medium text-rose-700">{cegNode.attackStrength.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dialogical Activity */}
          {hasActivity && (
            <div className="px-3 py-2 bg-amber-50/50 rounded-lg border border-amber-200">
              <div className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Dialogical Activity
              </div>
              <div className="space-y-1 text-xs text-slate-700">
                {dialogicalActivity.whyCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>WHY moves:</span>
                    <span className="font-medium">
                      {dialogicalActivity.whyCount}
                      {dialogicalActivity.openWhys > 0 && (
                        <span className="text-amber-700"> ({dialogicalActivity.openWhys} open)</span>
                      )}
                    </span>
                  </div>
                )}
                {dialogicalActivity.groundsCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>GROUNDS responses:</span>
                    <span className="font-medium">{dialogicalActivity.groundsCount}</span>
                  </div>
                )}
                {dialogicalActivity.concedeCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Concessions:</span>
                    <span className="font-medium">{dialogicalActivity.concedeCount}</span>
                  </div>
                )}
                {dialogicalActivity.retractCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Retractions:</span>
                    <span className="font-medium">{dialogicalActivity.retractCount}</span>
                  </div>
                )}
              </div>
              {dialogicalActivity.openWhys > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-300 text-amber-900 font-semibold text-xs flex items-center gap-2">
                  ⚠️ {dialogicalActivity.openWhys} open challenge{dialogicalActivity.openWhys > 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}

          {/* Contrary Claims (ASPIC+ Phase D-1) */}
          <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <ClaimContraryManager
              deliberationId={deliberationId}
              claimId={claimId}
              claimText={claimText || cegNode?.text || ""}
              currentUserId={currentUserId}
            />
          </div>
<div className="inline-flex w-full ">
          {/* Phase F: Direct Attack Creation */}
          <div className="px-3 py-2">
            <button
              onClick={() => setShowAttackModal(true)}
              className="w-fit flex items-center justify-center gap-2 px-4 py-2  
              btnv2 text-slate-700 text-xs font-medium rounded-xl "
            >
             
              Create ASPIC+ Attack
             
            </button>
            
          </div>

          {/* Critical Questions Button */}
          <div className="px-3 py-2">
            <button
              onClick={() => handleOpenCQ(claimId)}
              disabled={loadingSchemes}
              className="w-fit flex items-center justify-center gap-2 px-4 py-2 btnv2 text-slate-700 text-xs 
              font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSchemes ? "Loading..." : "View Critical Questions"}
            </button>
            {cqCompletion && (
              <p className="text-[10px] text-slate-500 text-center mt-1">
                {cqCompletion.satisfied}/{cqCompletion.required} questions answered ({cqCompletion.percentage}%)
              </p>
            )}
          </div>
</div>
          {/* Commitments - Social Proof */}
          {claimCommitments.length > 0 && (
            <div className="px-3 py-2 bg-sky-50/50 rounded-lg border border-sky-200">
              <div className="text-xs font-semibold text-sky-900 mb-2 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Commitments ({claimCommitments.length})
                {claimCommitments.filter(c => c.isActive).length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-sky-600 text-white rounded-full">
                    {claimCommitments.filter(c => c.isActive).length} active
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {claimCommitments.map((commitment, idx) => (
                  <div
                    key={`${commitment.participantId}-${idx}`}
                    className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg ${
                      commitment.isActive 
                        ? "bg-sky-100/70 border border-sky-300" 
                        : "bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span className={commitment.isActive ? "text-sky-900 font-medium" : "text-slate-600"}>
                      {commitment.participantName}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(commitment.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citations - Phase 2.3: Grouped by intent */}
          {citations.length > 0 && (
            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Evidence ({citations.length})
                </span>
                <button
                  onClick={() => setShowEvidencePanel(true)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  Manage
                </button>
              </div>
              <EvidenceBalanceBar citations={citations} className="mb-3" />
              <GroupedCitationList
                citations={citations}
                showGroups={citations.length > 1}
                showMissingEvidencePrompt
                compact
              />
            </div>
          )}

        
        </div>
      )}
      {/* CQ Modal */}
      {cqOpenFor && (
        <Dialog open onOpenChange={(o) => { if (!o) setCqOpenFor(null); }}>
          <DialogContent 
            className="!z-[60] bg-white/95 backdrop-blur-xl rounded-xl max-w-[90vw] w-full sm:max-w-[880px] max-h-[85vh] overflow-y-auto shadow-2xl"
            overlayClassName="!z-[60]"
          >
           
            
            <div className="relative z-10">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-sky-900 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                  Claim-level Critical Questions
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <CriticalQuestionsV3
                  targetType="claim"
                  targetId={cqOpenFor}
                  createdById={createdById}
                  currentUserId={currentUserId}
                  claimAuthorId={claimAuthorId}
                  deliberationId={deliberationId}
                  
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Phase F: Attack Creation Modal */}
      {showAttackModal && (
        <AttackCreationModal
          deliberationId={deliberationId}
          targetType="claim"
          targetId={claimId}
          targetText={claimText || cegNode?.text || "Unknown claim"}
          onClose={() => setShowAttackModal(false)}
          onCreated={() => {
            setShowAttackModal(false);
            // Invalidate SWR cache to refetch data
            mutate((key) => typeof key === 'string' && key.includes('/api/'));
          }}
        />
      )}
      {/* Phase 2.4: Full Evidence Panel Modal */}
      {showEvidencePanel && (
        <Dialog open onOpenChange={(o) => { if (!o) setShowEvidencePanel(false); }}>
          <DialogContent 
            className="!z-[60] bg-white rounded-xl max-w-[95vw] w-full sm:max-w-[900px] max-h-[85vh] overflow-y-auto shadow-2xl"
            overlayClassName="!z-[60]"
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Evidence Management
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              <EvidencePanel
                targetType="claim"
                targetId={claimId}
                canEdit={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
