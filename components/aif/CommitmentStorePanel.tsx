// components/aif/CommitmentStorePanel.tsx
"use client";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent, TabsListDropdown } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, User, History, ArrowRight, Link2, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PromoteToLudicsModal } from "./PromoteToLudicsModal";
import type { PromoteCommitmentResponse } from "@/lib/aif/commitment-ludics-types";
import { detectContradictions, getContradictionsForClaim, getContradictingClaim, type Contradiction } from "@/lib/aif/dialogue-contradictions";

/**
 * CommitmentStorePanel Component
 * 
 * Displays per-participant commitment tracking in dialogue visualizations.
 * Shows which claims each participant has asserted, conceded, or retracted.
 * 
 * Commitment Store Semantics (Formal Dialogue Games):
 * - ASSERT: Adds claim to participant's commitment store
 * - CONCEDE: Adds opponent's claim to participant's commitment store
 * - RETRACT: Removes claim from participant's commitment store
 * 
 * Visual Features:
 * - Per-participant tabs for easy navigation
 * - Color-coded claims (active vs retracted)
 * - Timeline view showing commitment evolution
 * - Diff mode highlighting changes between participants
 * 
 * References:
 * - Prakken, H. (2006). Formal systems for persuasion dialogue.
 * - Walton, D. & Krabbe, E. (1995). Commitment in Dialogue.
 */

export interface CommitmentRecord {
  claimId: string;
  claimText: string;
  moveId: string;
  moveKind: "ASSERT" | "CONCEDE" | "RETRACT";
  timestamp: string | Date;
  isActive: boolean; // false if retracted
  isPromoted?: boolean; // promoted to Ludics
  promotedAt?: string;
  ludicOwnerId?: string;
  ludicPolarity?: string;
}

export interface CommitmentStore {
  participantId: string;
  participantName: string;
  commitments: CommitmentRecord[];
}

interface CommitmentStorePanelProps {
  /** Commitment stores for all participants */
  stores: CommitmentStore[];
  
  /** Deliberation ID for promotion */
  deliberationId?: string;
  
  /** Callback when claim is clicked */
  onClaimClick?: (claimId: string) => void;
  
  /** Callback when commitments are refreshed */
  onRefresh?: () => void;
  
  /** Show timeline view */
  showTimeline?: boolean;
  
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a single commitment record with visual indicators
 */
function CommitmentItem({
  record,
  onClick,
  onPromote,
  deliberationId,
  participantId,
  contradictions = [],
  allContradictions = []
}: {
  record: CommitmentRecord;
  onClick?: () => void;
  onPromote?: (commitment: { participantId: string; proposition: string; claimId: string; claimText: string }) => void;
  deliberationId?: string;
  participantId?: string;
  contradictions?: Contradiction[];
  allContradictions?: Contradiction[];
}) {
  const moveIcons = {
    ASSERT: <CheckCircle2 className="h-3 w-3 text-sky-600" />,
    CONCEDE: <CheckCircle2 className="h-3 w-3 text-green-600" />,
    RETRACT: <XCircle className="h-3 w-3 text-red-600" />
  };

  const formattedTime = new Date(record.timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  const canPromote = record.isActive && !record.isPromoted && deliberationId && participantId && onPromote;
  const hasContradiction = contradictions.length > 0;
  
  // Get contradicting claims for tooltip
  const contradictingClaims = contradictions.map(c => 
    getContradictingClaim(record.claimId, c)
  ).filter(Boolean);

  return (
    <TooltipProvider>
      <div className=" border p-1 rounded-md border-indigo-300 flex justify-between items-start gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`
                flex items-center px-2 py-2 rounded-lg border text-xs
                ${record.isActive 
                  ? hasContradiction
                    ? "bg-amber-50 border-amber-300 hover:border-amber-400"
                    : "bg-white border-gray-200 hover:border-sky-300"
                  : "bg-gray-50 border-gray-300 opacity-60 line-through"
                }
                ${onClick ? "cursor-pointer" : ""}
                transition-colors
              `}
              onClick={onClick}
              role={onClick ? "button" : undefined}
              tabIndex={onClick ? 0 : undefined}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5">{moveIcons[record.moveKind]}</span>
                <span className="flex-1 text-gray-800">
                  {record.claimText}
                </span>
                {hasContradiction && (
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                )}
                {record.isPromoted && (
                  <Badge variant="secondary" className="text-[9px] bg-sky-100 text-sky-700 border-sky-200 flex items-center gap-1">
                    <Link2 className="h-2.5 w-2.5" />
                    Ludics
                  </Badge>
                )}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-gray-900 text-white border-gray-800 max-w-md">
            <div className="space-y-1 text-xs">
              <div className="font-semibold">
                {record.moveKind === "ASSERT" && "Asserted"}
                {record.moveKind === "CONCEDE" && "Conceded"}
                {record.moveKind === "RETRACT" && "Retracted"}
              </div>
              <div className="text-gray-400">{formattedTime}</div>
              {!record.isActive && (
                <div className="text-red-400">No longer committed</div>
              )}
              {hasContradiction && (
                <div className="text-amber-400 border-t border-gray-700 pt-1 mt-1">
                  <div className="font-semibold flex items-center gap-1 mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    ⚠️ Contradiction Detected
                  </div>
                  {contradictingClaims.map((claim, idx) => (
                    <div key={idx} className="text-gray-300 text-[11px] mt-1">
                      Contradicts: "{claim?.text}"
                    </div>
                  ))}
                  {contradictions.length > 0 && (
                    <div className="text-amber-300 text-[10px] mt-1">
                      Confidence: {(contradictions[0].confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              )}
              {record.isPromoted && (
                <div className="text-sky-400 border-t border-gray-700 pt-1 mt-1">
                  Promoted to {record.ludicOwnerId} as {record.ludicPolarity === "pos" ? "fact" : "rule"}
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Promote Button */}
        {canPromote && (
          <button
          
            className="flex w-fit text-[11px] gap-2 items-center btnv2--ghost rounded-lg px-2 bg-white  py-2 whitespace-nowrap text-sky-800 border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            onClick={() => onPromote({
              participantId: participantId!,
              proposition: record.claimText,
              claimId: record.claimId,
              claimText: record.claimText
            })}
          >
            <ArrowRight className="flex h-3 w-3 " />
            Add to Ludics
          </button>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Timeline view showing commitment evolution
 */
function CommitmentTimeline({
  records,
  onClaimClick
}: {
  records: CommitmentRecord[];
  onClaimClick?: (claimId: string) => void;
}) {
  // Sort by timestamp
  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="space-y-2">
      {sortedRecords.map((record, idx) => (
        <div key={`${record.moveId}-${idx}`} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div 
              className={`
                w-2 h-2 rounded-full
                ${record.moveKind === "ASSERT" ? "bg-sky-500" : ""}
                ${record.moveKind === "CONCEDE" ? "bg-green-500" : ""}
                ${record.moveKind === "RETRACT" ? "bg-red-500" : ""}
              `}
            />
            {idx < sortedRecords.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 min-h-[20px]" />
            )}
          </div>
          <div className="flex-1 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[9px]">
                {record.moveKind}
              </Badge>
              <span className="text-[10px] text-gray-500">
                {new Date(record.timestamp).toLocaleString("en-US", {
                  hour: "numeric",
                  minute: "2-digit"
                })}
              </span>
            </div>
            <div
              className={`
                text-sm
                ${record.isActive ? "text-gray-800" : "text-gray-500 line-through"}
                ${onClaimClick ? "cursor-pointer hover:text-sky-600" : ""}
              `}
              onClick={() => onClaimClick?.(record.claimId)}
            >
              {record.claimText}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CommitmentStorePanel({
  stores,
  deliberationId,
  onClaimClick,
  onRefresh,
  showTimeline = false,
  className = ""
}: CommitmentStorePanelProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(
    stores.length > 0 ? stores[0].participantId : null
  );
  const [promotionModal, setPromotionModal] = useState<{
    isOpen: boolean;
    commitment: { participantId: string; proposition: string; claimId: string; claimText: string } | null;
  }>({ isOpen: false, commitment: null });

  // Detect contradictions for all participants
  const participantContradictions = useMemo(() => {
    const result = new Map<string, Contradiction[]>();
    
    stores.forEach(store => {
      // Convert timestamp strings to Date objects for contradiction detection
      const commitmentsWithDates = store.commitments.map(c => ({
        ...c,
        timestamp: typeof c.timestamp === "string" ? new Date(c.timestamp) : c.timestamp
      }));
      
      const contradictions = detectContradictions(commitmentsWithDates);
      result.set(store.participantId, contradictions);
    });
    
    return result;
  }, [stores]);

  // Count total contradictions across all participants
  const totalContradictions = useMemo(() => {
    let count = 0;
    participantContradictions.forEach(contradictions => {
      count += contradictions.length;
    });
    return count;
  }, [participantContradictions]);

  const handleOpenPromoteModal = (commitment: { participantId: string; proposition: string; claimId: string; claimText: string }) => {
    setPromotionModal({ isOpen: true, commitment });
  };

  const handleClosePromoteModal = () => {
    setPromotionModal({ isOpen: false, commitment: null });
  };

  const handlePromotionSuccess = (response: PromoteCommitmentResponse) => {
    console.log("Promotion successful:", response);
    // Refresh commitment stores
    onRefresh?.();
  };

  const selectedStore = stores.find(s => s.participantId === selectedParticipant);
  const selectedContradictions = selectedParticipant 
    ? participantContradictions.get(selectedParticipant) || []
    : [];

  // Calculate statistics. `commitments` holds the full move history (one row
  // per ASSERT / CONCEDE / RETRACT), so multiple ASSERTs of the same claim
  // produce multiple rows. The "active" set is the dedup'd set of claimIds
  // that are currently asserted (most-recent move wins).
  const activeByClaim = selectedStore
    ? (() => {
        const m = new Map<string, typeof selectedStore.commitments[number]>();
        for (const c of selectedStore.commitments) {
          if (c.isActive) m.set(c.claimId, c); // later iterations overwrite earlier
        }
        return m;
      })()
    : null;
  const stats = selectedStore && activeByClaim ? {
    total: selectedStore.commitments.length,
    active: activeByClaim.size,
    retracted: selectedStore.commitments.filter(c => !c.isActive).length,
    contradictions: selectedContradictions.length
  } : null;

  if (stores.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4" />
            Commitment Stores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            No commitment data available. Enable dialogue layer to track participant commitments.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Per-store distinct active count (dedup by claimId, since `commitments`
  // is move history not the active set).
  const distinctActive = (store: { commitments: { claimId: string; isActive: boolean }[] }) => {
    const s = new Set<string>();
    for (const c of store.commitments) if (c.isActive) s.add(c.claimId);
    return s.size;
  };

  return (
    <Card className={className}>
      <CardHeader className="p-3">
        <CardTitle className="text-sm  flex items-center gap-2">
          <User className="h-4 w-4" />
          Commitment Stores
         
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedParticipant || undefined} onValueChange={setSelectedParticipant}>
          {/* Participant selector - Use dropdown when there are many participants */}
          {stores.length > 4 ? (
            <TabsListDropdown
              value={selectedParticipant || undefined}
              onValueChange={setSelectedParticipant}
              placeholder="Select participant..."
              className="mb-4"
            >
              {stores.map(store => (
                <TabsTrigger key={store.participantId} value={store.participantId}>
                  <span className="flex items-center gap-2">
                    {store.participantName}
                    <Badge variant="secondary" className="text-[9px] h-4 px-1">
                      {distinctActive(store)}
                    </Badge>
                  </span>
                </TabsTrigger>
              ))}
            </TabsListDropdown>
          ) : (
            <TabsList className="flex flex-col w-full" >
              {stores.map(store => (
                <TabsTrigger key={store.participantId} value={store.participantId} className="text-xs">
                  {store.participantName}
                  <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
                    {distinctActive(store)}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {/* Commitment list per participant */}
          {stores.map(store => (
            <TabsContent key={store.participantId} value={store.participantId} className="mt-4">
              {/* View mode toggle */}
              {showTimeline && (
                <div className="flex items-center gap-2 mb-3">
                  <button
                    className="text-xs flex items-center gap-1 text-sky-600 hover:text-sky-700"
                    onClick={() => {/* Toggle timeline view */}}
                  >
                    <History className="h-3 w-3" />
                    Timeline View
                  </button>
                </div>
              )}

              {/* Statistics */}
              {stats && (
                <div className="flex gap-2 mb-2 text-xs flex-wrap">
                  {stats.contradictions > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {stats.contradictions} contradiction{stats.contradictions !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                    {stats.active} active
                  </Badge>
                  {stats.retracted > 0 && (
                    <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
                      {stats.retracted} retracted
                    </Badge>
                  )}
                </div>
              )}

             

              {/* Commitment list or timeline */}
              <div className="h-full overflow-y-auto border border-slate-400 p-1 rounded-md">
                {showTimeline ? (
                  <CommitmentTimeline
                    records={store.commitments}
                    onClaimClick={onClaimClick}
                  />
                ) : (
                  <div className="space-y-2">
                    {/* Active commitments first — dedup'd by claimId so the
                        same claim asserted twice doesn't render twice. */}
                    {Array.from(
                      (() => {
                        const m = new Map<string, typeof store.commitments[number]>();
                        for (const c of store.commitments) {
                          if (c.isActive) m.set(c.claimId, c);
                        }
                        return m.values();
                      })(),
                    )
                      .map((record, idx) => {
                        const recordContradictions = getContradictionsForClaim(
                          record.claimId,
                          selectedContradictions
                        );
                        
                        return (
                          <CommitmentItem
                            key={`${record.moveId}-${idx}`}
                            record={record}
                            onClick={() => onClaimClick?.(record.claimId)}
                            onPromote={deliberationId ? handleOpenPromoteModal : undefined}
                            deliberationId={deliberationId}
                            participantId={store.participantId}
                            contradictions={recordContradictions}
                            allContradictions={selectedContradictions}
                          />
                        );
                      })}
                    
                    {/* Retracted commitments (if any) */}
                    {store.commitments.filter(c => !c.isActive).length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-gray-500 mt-4 mb-2">
                          Retracted
                        </div>
                        {store.commitments
                          .filter(c => !c.isActive)
                          .map((record, idx) => (
                            <CommitmentItem
                              key={`${record.moveId}-${idx}`}
                              record={record}
                              onClick={() => onClaimClick?.(record.claimId)}
                              onPromote={undefined}
                              deliberationId={deliberationId}
                              participantId={store.participantId}
                              contradictions={[]}
                              allContradictions={selectedContradictions}
                            />
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>
               {/* Contradiction Summary */}
              {selectedContradictions.length > 0 && (
                <div className="mb-0 mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
                  <div className="font-semibold text-amber-800 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Contradictions Detected
                  </div>
                  <div className="text-amber-700 space-y-1">
                    {selectedContradictions.map((contradiction, idx) => (
                      <div key={idx} className="text-[11px]">
                        • {contradiction.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Promotion Modal */}
      {promotionModal.commitment && deliberationId && (
        <PromoteToLudicsModal
          isOpen={promotionModal.isOpen}
          onClose={handleClosePromoteModal}
          deliberationId={deliberationId}
          commitment={promotionModal.commitment}
          onSuccess={handlePromotionSuccess}
        />
      )}
    </Card>
  );
}
