
'use client';
import { useState, useMemo, useCallback, memo } from 'react';
import useSWR from 'swr';
import React from 'react';
import { GlossaryText } from '@/components/glossary/GlossaryText';
import { InlineCommitmentCount } from '@/components/aif/CommitmentBadge';
import { ContraryBadge } from '@/components/claims/contraryBadge/ContraryBadge';

const fetcher = (url: string) => fetch(url).then((r) => r.json());
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import CriticalQuestionsV3 from '@/components/claims/CriticalQuestionsV3';
  import { DialogueActionsButton } from '@/components/dialogue/DialogueActionsButton';
  import { LegalMoveChips } from '@/components/dialogue/LegalMoveChips';
import { Crosshair, Activity } from 'lucide-react';

// Enhanced claim row with full AIF + dialogical integration
type ClaimRow = {
  id: string;
  text: string;
  moid?: string;
  createdAt: string;
  createdById?: number | null;
  counts: { supports: number; rebuts: number };
  cq?: { required: number; satisfied: number };
  // AIF metadata
  argumentCount?: number;
  topArgumentId?: string | null;
  // Scheme info (from top argument)
  scheme?: { id: string; key: string; name: string } | null;
  // Attack counts (incoming)
  attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number };
  // Dialogical status
  moves?: {
    whyCount: number;
    groundsCount: number;
    concedeCount: number;
    retractCount: number;
    openWhys: number;
  };
  // Edges
  edges?: {
    incoming: Array<{ id: string; type: string; attackType?: string; fromClaimId: string }>;
    outgoing: Array<{ id: string; type: string; attackType?: string; toClaimId: string }>;
  };
};
type LabelRow = { claimId: string; label: 'IN'|'OUT'|'UNDEC'; explainJson?: any };

// Memoized sub-components for performance
const Dot = memo(({ label }: { label: 'IN'|'OUT'|'UNDEC' }) => {
  const cls = label === 'IN' ? 'bg-emerald-500' : label === 'OUT' ? 'bg-rose-500' : 'bg-zinc-600';
  const title =
    label === 'IN' ? 'Warranted (grounded semantics)' :
    label === 'OUT' ? 'Defeated by an IN attacker' : 'Undecided';
  return <span title={title} className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`} />;
});
Dot.displayName = 'Dot';

const CqMeter = memo(({ cq }: { cq?: { required: number; satisfied: number } }) => {
  const r = cq?.required ?? 0, s = cq?.satisfied ?? 0;
  const pct = r ? Math.round((s / r) * 100) : 0;
  const color = pct >= 100 ? "bg-emerald-400/15 text-emerald-900 border-emerald-500/40" :
                pct >= 50 ? "bg-amber-400/15 text-amber-900 border-amber-500/40" :
                "bg-stone-200/75 text-slate-600 border-slate-900/20";
  return (
    <span
      className={`text-[10px] px-2 py-1 rounded-lg border backdrop-blur-sm ${color} font-medium`}
      title={r ? `${s}/${r} CQs satisfied` : "No CQs yet"}
    >
      CQ {pct}%
    </span>
  );
});
CqMeter.displayName = 'CqMeter';

const SchemeBadge = memo(({ scheme }: { scheme?: { id: string; key: string; name: string } | null }) => {
  if (!scheme) return null;
  return (
    <span
      className="text-[10px] px-2 py-1 rounded-lg bg-gradient-to-br from-sky-400/15 to-cyan-400/15 text-sky-900 border border-cyan-500/30 backdrop-blur-sm font-medium shadow-sm"
      title={scheme.name}
    >
      {scheme.key}
    </span>
  );
});
SchemeBadge.displayName = 'SchemeBadge';

const AttackBadges = memo(({ attacks }: { attacks?: { REBUTS: number; UNDERCUTS: number; UNDERMINES: number } }) => {
  // Only show if attacks object exists and has at least one non-zero attack
  if (!attacks) return null;
  
  const totalAttacks = (attacks.REBUTS ?? 0) + (attacks.UNDERCUTS ?? 0) + (attacks.UNDERMINES ?? 0);
  if (totalAttacks === 0) return null;
  
  return (
    <div className="flex items-center gap-1.5">
      {(attacks.REBUTS ?? 0) > 0 && (
        <span className="text-[10px] px-2 py-1 rounded-lg bg-gradient-to-br from-rose-400/15 to-red-400/15 text-rose-900 border border-rose-500/40 backdrop-blur-sm font-medium" title="Rebuttals">
          R:{attacks.REBUTS}
        </span>
      )}
      {(attacks.UNDERCUTS ?? 0) > 0 && (
        <span className="text-[10px] px-2 py-1 rounded-lg bg-gradient-to-br from-orange-400/15 to-amber-400/15 text-orange-900 border border-orange-500/40 backdrop-blur-sm font-medium" title="Undercuts">
          U:{attacks.UNDERCUTS}
        </span>
      )}
      {(attacks.UNDERMINES ?? 0) > 0 && (
        <span className="text-[10px] px-2 py-1 rounded-lg bg-gradient-to-br from-yellow-400/15 to-amber-400/15 text-yellow-900 border border-yellow-500/40 backdrop-blur-sm font-medium" title="Undermines">
          M:{attacks.UNDERMINES}
        </span>
      )}
    </div>
  );
});
AttackBadges.displayName = 'AttackBadges';

const DialogicalStatus = memo(({ moves }: { moves?: ClaimRow["moves"] }) => {
  if (!moves) return null;
  const hasActivity = moves.whyCount + moves.groundsCount + moves.concedeCount + moves.retractCount > 0;
  if (!hasActivity) return null;
  
  const openColor = moves.openWhys > 0 ? "text-amber-900 font-semibold" : "text-slate-600";
  
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-medium">
      {moves.whyCount > 0 && (
        <span className={openColor} title={`${moves.whyCount} WHY moves (${moves.openWhys} open)`}>
          ?{moves.whyCount}
        </span>
      )}
      {moves.groundsCount > 0 && (
        <span className="text-emerald-700" title={`${moves.groundsCount} GROUNDS responses`}>
          G:{moves.groundsCount}
        </span>
      )}
      {moves.concedeCount > 0 && (
        <span className="text-sky-700" title={`${moves.concedeCount} concessions`}>
          ✓{moves.concedeCount}
        </span>
      )}
      {moves.retractCount > 0 && (
        <span className="text-rose-700" title={`${moves.retractCount} retractions`}>
          ✗{moves.retractCount}
        </span>
      )}
    </div>
  );
});
DialogicalStatus.displayName = 'DialogicalStatus';

// Loading skeleton component
const ClaimCardSkeleton = memo(() => (
  <div className="relative flex flex-col rounded-xl backdrop-blur-md border border-slate-900/10 bg-slate-900/5 shadow-lg overflow-hidden p-4 gap-3 animate-pulse">
    <div className="flex items-start gap-3">
      <div className="mt-1 w-2.5 h-2.5 rounded-full bg-slate-300" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-slate-300 rounded w-3/4" />
        <div className="h-4 bg-slate-300 rounded w-1/2" />
      </div>
      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        <div className="h-6 w-12 bg-slate-300 rounded-lg" />
        <div className="h-6 w-12 bg-slate-300 rounded-lg" />
        <div className="h-6 w-16 bg-slate-300 rounded-lg" />
      </div>
    </div>
  </div>
));
ClaimCardSkeleton.displayName = 'ClaimCardSkeleton';

const PAGE_SIZE = 8;

// SWR configuration for optimal caching and performance
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  keepPreviousData: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  shouldRetryOnError: (error: any) => {
    // Don't retry on 404s or auth errors
    return error?.status !== 404 && error?.status !== 401 && error?.status !== 403;
  },
};

export default function ClaimMiniMap({ deliberationId, selectedClaimId, onClaimClick, claimAuthorId, currentUserId }: 
  { deliberationId: string; selectedClaimId?: string; onClaimClick?: (claimId: string) => void; claimAuthorId?: string; currentUserId?: string; }) {
  
  // Core data fetching with enhanced endpoints
  const { data: summary, error, isLoading, mutate: mutateSummary } = useSWR(
    deliberationId ? `/api/claims/summary?deliberationId=${deliberationId}` : null,
    fetcher,
    swrConfig
  );
  
  const { data: labelsData, mutate: mutateLabels } = useSWR(
    deliberationId ? `/api/claims/labels?deliberationId=${deliberationId}` : null,
    fetcher,
    swrConfig
  );

  // Fetch enhanced AIF metadata for all claims
  const claimIds = useMemo(() => summary?.claims?.map((c: ClaimRow) => c.id) ?? [], [summary]);
  const claimIdsStr = claimIds.join(',');
  
  const { data: aifData } = useSWR(
    claimIdsStr ? `/api/claims/batch?ids=${encodeURIComponent(claimIdsStr)}` : null,
    fetcher,
    swrConfig
  );

  // Fetch dialogical moves for all claims
  const { data: movesData } = useSWR(
    deliberationId ? `/api/deliberations/${deliberationId}/moves?limit=500` : null,
    fetcher,
    swrConfig
  );

  // Fetch edges for graph connectivity
  const { data: edgesData } = useSWR(
    deliberationId ? `/api/claims/edges?deliberationId=${deliberationId}` : null,
    fetcher,
    swrConfig
  );

  // Fetch commitment data for badges
  const { data: commitmentData } = useSWR(
    deliberationId ? `/api/aif/dialogue/${deliberationId}/commitments` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60000 }
  );

  // Debounced event handler for better performance
  const handleDataRefresh = useCallback(() => {
    mutateSummary();
    mutateLabels();
  }, [mutateSummary, mutateLabels]);

  React.useEffect(() => {
    // Debounce timer to prevent excessive refreshes
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const debouncedHandler = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleDataRefresh();
      }, 300); // 300ms debounce
    };
    
    window.addEventListener("claims:changed", debouncedHandler);
    window.addEventListener("dialogue:moves:refresh", debouncedHandler);
    window.addEventListener("arguments:changed", debouncedHandler);
    
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("claims:changed", debouncedHandler);
      window.removeEventListener("dialogue:moves:refresh", debouncedHandler);
      window.removeEventListener("arguments:changed", debouncedHandler);
    };
  }, [handleDataRefresh]);

  const [currentPage, setCurrentPage] = useState(1);
  const [cqOpenFor, setCqOpenFor] = useState<string | null>(null);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [showMoves, setShowMoves] = useState<string | null>(null);
  const [loadingSchemes, setLoadingSchemes] = useState<Set<string>>(new Set());
  const [expandedCQs, setExpandedCQs] = useState<Set<string>>(new Set());

  // Enrich claims with AIF + dialogical data
  const enrichedClaims: ClaimRow[] = useMemo(() => {
    const baseClaims = summary?.claims ?? [];
    const aifMap = new Map((aifData?.claims ?? []).map((c: any) => [c.id, c]));
    const movesByTarget = new Map<string, any[]>();
    const edgesByTarget = { incoming: new Map<string, any[]>(), outgoing: new Map<string, any[]>() };

    // Group moves by targetId
    (movesData?.moves ?? []).forEach((m: any) => {
      if (m.targetType === 'claim') {
        const list = movesByTarget.get(m.targetId) ?? [];
        list.push(m);
        movesByTarget.set(m.targetId, list);
      }
    });

    // Group edges
    (edgesData?.edges ?? []).forEach((e: any) => {
      const incoming = edgesByTarget.incoming.get(e.toClaimId) ?? [];
      incoming.push(e);
      edgesByTarget.incoming.set(e.toClaimId, incoming);
      
      const outgoing = edgesByTarget.outgoing.get(e.fromClaimId) ?? [];
      outgoing.push(e);
      edgesByTarget.outgoing.set(e.fromClaimId, outgoing);
    });

    return baseClaims.map((c: ClaimRow) => {
      const aif = aifMap.get(c.id);
      const moves = movesByTarget.get(c.id) ?? [];
      
      const whyMoves = moves.filter((m: any) => m.kind === 'WHY');
      const groundsMoves = moves.filter((m: any) => m.kind === 'GROUNDS');
      const openWhys = whyMoves.filter((w: any) => {
        const answered = groundsMoves.some((g: any) => 
          new Date(g.createdAt) > new Date(w.createdAt) &&
          g.payload?.cqId === w.payload?.cqId
        );
        return !answered;
      }).length;

      // Calculate attacks from actual incoming edges instead of trusting API
      const incomingEdges = edgesByTarget.incoming.get(c.id) ?? [];
      const calculatedAttacks = {
        REBUTS: incomingEdges.filter((e: any) => e.type === 'rebuts' || e.attackType === 'REBUTS').length,
        UNDERCUTS: incomingEdges.filter((e: any) => e.attackType === 'UNDERCUTS').length,
        UNDERMINES: incomingEdges.filter((e: any) => e.attackType === 'UNDERMINES').length,
      };

      return {
        ...c,
        argumentCount: (aif as any)?._count?.arguments ?? 0,
        topArgumentId: (aif as any)?.topArgumentId ?? null,
        scheme: (aif as any)?.scheme ?? null,
        attacks: calculatedAttacks, // Use calculated attacks from edges
        moves: {
          whyCount: whyMoves.length,
          groundsCount: groundsMoves.length,
          concedeCount: moves.filter((m: any) => m.kind === 'CONCEDE').length,
          retractCount: moves.filter((m: any) => m.kind === 'RETRACT').length,
          openWhys,
        },
        edges: {
          incoming: edgesByTarget.incoming.get(c.id) ?? [],
          outgoing: edgesByTarget.outgoing.get(c.id) ?? [],
        },
      };
    });
  }, [summary, aifData, movesData, edgesData]);

  // Memoized handlers for better performance
  const handleEnsureSchemes = useCallback(async (claimId: string) => {
    setLoadingSchemes(prev => new Set(prev).add(claimId));
    try {
      await fetch(`/api/claims/${claimId}/ensure-schemes`, { method: "POST" });
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      console.error("Failed to ensure schemes:", err);
    } finally {
      setLoadingSchemes(prev => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
  }, []);

  const handleOpenCQ = useCallback(async (claimId: string) => {
    await handleEnsureSchemes(claimId);
    await new Promise(resolve => setTimeout(resolve, 100));
    setCqOpenFor(claimId);
  }, [handleEnsureSchemes]);

  const handleToggleExpanded = useCallback(async (claimId: string) => {
    const willExpand = expandedClaim !== claimId;
    if (willExpand) {
      await handleEnsureSchemes(claimId);
    } else {
      // When collapsing, also collapse CQs
      setExpandedCQs(prev => {
        const next = new Set(prev);
        next.delete(claimId);
        return next;
      });
    }
    setExpandedClaim(willExpand ? claimId : null);
  }, [expandedClaim, handleEnsureSchemes]);

  const handleToggleCQs = useCallback((claimId: string) => {
    setExpandedCQs(prev => {
      const next = new Set(prev);
      if (next.has(claimId)) {
        next.delete(claimId);
      } else {
        next.add(claimId);
      }
      return next;
    });
  }, []);

  const handleClaimClick = useCallback((claimId: string) => {
    onClaimClick?.(claimId);
  }, [onClaimClick]);

  // Compute data unconditionally so hooks count/order is stable
  const labels: Record<string, LabelRow> = useMemo(
    () => Object.fromEntries(
      ((labelsData?.labels ?? []) as LabelRow[]).map(l => [l.claimId, l])
    ),
    [labelsData]
  );

  // Build commitment counts map
  const commitmentCounts = useMemo(() => {
    if (!commitmentData || !Array.isArray(commitmentData)) return new Map<string, { total: number; active: number }>();
    
    const counts = new Map<string, { total: number; active: number }>();
    
    for (const store of commitmentData) {
      for (const commitment of store.commitments || []) {
        const current = counts.get(commitment.claimId) || { total: 0, active: 0 };
        counts.set(commitment.claimId, {
          total: current.total + 1,
          active: commitment.isActive ? current.active + 1 : current.active,
        });
      }
    }
    
    return counts;
  }, [commitmentData]);
  
  // Pagination calculations
  const totalPages = Math.ceil(enrichedClaims.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleClaims = enrichedClaims.slice(startIndex, endIndex);
  
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const failed = Boolean(error || summary?.error);

  return (
    <div className="relative mt-3 rounded-xl overflow-hidden bg-white/55  shadow-lg p-6 mb-1">
      {/* Glass overlay */}
      {/* <div className="absolute inset-0 bg-gradient-to-b from-slate-900/5 via-transparent to-slate-900/10 pointer-events-none" /> */}
      
      {/* Radial light - sky tint */}
      {/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(56,189,248,0.08),transparent_50%)] pointer-events-none" /> */}
      
      {/* Water droplets */}
      <div className="absolute top-10 right-20 w-32 h-32 bg-sky-400/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 left-10 w-40 h-40 bg-cyan-400/8 rounded-full blur-3xl animate-pulse delay-1000" />
      
      {/* Content wrapper with z-index */}
      <div className="relative z-10">
        {isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <div className="h-7 w-48 bg-slate-300 rounded animate-pulse" />
              <div className="h-10 w-32 bg-slate-300 rounded-xl animate-pulse" />
            </div>
            {[...Array(3)].map((_, i) => (
              <ClaimCardSkeleton key={i} />
            ))}
          </div>
        ) : failed ? (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-400/15 to-red-400/15 backdrop-blur-md border border-rose-500/40 p-5 shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent" />
            <div className="relative flex gap-4 items-start">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/30 to-red-500/30 shadow-lg h-fit">
                <svg className="w-5 h-5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold mb-1 text-rose-900 text-sm">Failed to load claims</p>
                <p className="text-xs text-rose-800">Please try refreshing the page or contact support if the issue persists.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-black flex items-center gap-2">
              {/* <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" /> */}
              Claims List
                            <span className=" text-sm font-normal text-slate-500">({enrichedClaims.length})</span>
            </h3>
            <button
              onClick={async () => {
                const newExpandedId = expandedClaim ? null : visibleClaims[0]?.id ?? null;
                if (newExpandedId) {
                  await handleEnsureSchemes(newExpandedId);
                }
                setExpandedClaim(newExpandedId);
              }}
              className="relative  overflow-hidden text-xs px-3 py-1 mb-2 rounded-xl menuv2--lite bg-teal-300
              shadow-sm shadow-indigo-600/30 hover:shadow-indigo-600/70 text-slate-700 tracking-wide
                transition-all duration-300 disabled:opacity-50 group"
              disabled={loadingSchemes.size > 0}
            >
              {/* Glass shine */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 
              to-transparent translate-y-[50%] 
              transition-transform duration-700" />
              <span className="relative">
                {loadingSchemes.has(visibleClaims[0]?.id) ? "Loading…" : expandedClaim ? "Collapse" : "Expand"}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {visibleClaims.map((c) => {
              const lab = labels[c.id]?.label ?? "UNDEC";
              const tip = labels[c.id]?.explainJson ? JSON.stringify(labels[c.id]?.explainJson) : undefined;
              const isExpanded = expandedClaim === c.id;
              const isSelected = selectedClaimId === c.id;
              
              return (
                <div
                  key={c.id}
                  id={`row-${c.id}`}
                  data-claim-id={c.id}
                  className={`group relative flex flex-col rounded-xl transition-all duration-300  border shadow-md shadow-orange-600/20 overflow-hidden p-4 gap-3 ${
                    isSelected 
                      ? "border-sky-600/20 bg-cyan-100/10  shadow-md shadow-cyan-600/20" 
                      : "border-orange-500/50 bg-slate-300/15 hover:bg-slate-400/10 hover:border-red-600/20 "
                  }`}
                  title={tip}
                >
                  {/* Glass shine effect */}
                  {/* <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" /> */}
                  
                  {/* Selection indicator dot */}
                  {isSelected && (
                    <div className="absolute top-3 right-3">
                      <div className="w-2 h-2 rounded-full bg-cyan-600 shadow-lg shadow-cyan-600/50 animate-pulse" />
                    </div>
                  )}
                  
                  {/* Main claim row */}
                  <div className="relative flex items-center gap-3">
                    <div className="mt-0"><Dot label={lab} /></div>
                    <div 
                      className={`flex-1 text-sm line-clamp-2 w-full cursor-pointer  ${
                        isSelected ? "text-cyan-900 font-medium" : "text-slate-900 hover:text-sky-800"
                      }`}
                      onClick={() => handleClaimClick(c.id)}
                    >
                      <GlossaryText text={c.text} />
                    </div>
                    <div className="shrink-0 flex items-center gap-2 flex-wrap">
                      {/* Support/Rebut counts */}
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-gradient-to-br from-emerald-400/15 to-green-400/15 text-emerald-900 border border-emerald-500/40 backdrop-blur-sm font-medium shadow-sm">
                        +{c.counts.supports}
                      </span>
                      <span className="text-[11px] px-2 py-1 rounded-lg bg-gradient-to-br from-rose-400/15 to-red-400/15 text-rose-900 border border-rose-500/40 backdrop-blur-sm font-medium shadow-sm">
                        −{c.counts.rebuts}
                      </span>
                      
                      {/* CQ Status */}
                      <CqMeter cq={c.cq} />
                      
                      {/* Scheme badge */}
                      <SchemeBadge scheme={c.scheme} />
                      
                      {/* Commitment badge */}
                      {commitmentCounts.get(c.id) && (
                        <InlineCommitmentCount 
                          count={commitmentCounts.get(c.id)!.total}
                          isActive={commitmentCounts.get(c.id)!.active > 0}
                        />
                      )}
                      
                      {/* Attack types */}
                      <AttackBadges attacks={c.attacks} />

                      {/* Explicit contraries (Phase D-1) */}
                      <ContraryBadge
                        deliberationId={deliberationId}
                        claimId={c.id}
                        claimText={c.text}
                        size="xs"
                      />
                      
                      {/* Dialogical status */}
                      <DialogicalStatus moves={c.moves} />
                      
                      {/* Argument count */}
                      {(c.argumentCount ?? 0) > 0 && (
                        <span className="text-[10px] px-2 py-1 rounded-lg bg-gradient-to-br from-sky-400/15 to-cyan-400/15 text-sky-900 border border-cyan-500/30 backdrop-blur-sm font-medium shadow-sm" title="Arguments">
                          Args:{c.argumentCount}
                        </span>
                      )}
                      
                      {/* Action buttons */}
                      <button
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-yellow-400/40 backdrop-blur-md border border-yellow-900/20 text-yellow-900 hover:bg-yellow-500/40 hover:border-yellow-900/30 transition-all duration-200 disabled:opacity-50 font-medium shadow-sm"
                        title="Open Critical Questions"
                        disabled={loadingSchemes.has(c.id)}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleOpenCQ(c.id);
                        }}
                      >
                        {loadingSchemes.has(c.id) ? "Loading…" : "CQs"}
                      </button>
                      
                      <button
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-teal-500/30 backdrop-blur-md border border-teal-900/20 text-teal-900 hover:bg-teal-600/30 
                        hover:border-teal-900/30 transition-all duration-200 font-medium shadow-sm"
                        title="Show dialogical moves"
                        onClick={(e) => { e.stopPropagation(); setShowMoves(showMoves === c.id ? null : c.id); }}
                      >
                        Moves
                      </button>
                      
                      <button
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-gradient-to-br from-sky-400/15 to-cyan-400/15 backdrop-blur-md border border-cyan-500/30 text-sky-900 hover:from-sky-400/20 hover:to-cyan-400/20 hover:border-cyan-500/40 transition-all duration-200 disabled:opacity-50 font-medium shadow-sm"
                        title="Expand details"
                        disabled={loadingSchemes.has(c.id)}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleToggleExpanded(c.id);
                        }}
                      >
                        {isExpanded ? "−" : "+"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded view */}
                  {isExpanded && (
                    <div className="mt-3 pl-6 border-l-2 border-cyan-500/40 space-y-3">
                      {/* Metadata */}
                      <div className="text-xs text-slate-700 space-y-1 bg-slate-300/25 backdrop-blur-md p-3 rounded-lg border border-teal-500/30">
                        <div className="font-semibold text-sm text-sky-900 mb-2">Metadata</div>
                        <div><strong className="text-slate-900">ID:</strong> <span className="text-slate-600">{c.id}</span></div>
                        {c.moid && <div><strong className="text-slate-900">MOID:</strong> <span className="text-slate-600">{c.moid}</span></div>}
                        <div><strong className="text-slate-900">Created:</strong> <span className="text-slate-600">{new Date(c.createdAt).toLocaleString()}</span></div>
                        {c.topArgumentId && (
                          <div>
                            <strong className="text-slate-900">Top Argument:</strong>{" "}
                            <a href={`#arg-${c.topArgumentId}`} className="text-sky-700 hover:text-cyan-700 hover:underline transition-colors">
                              {c.topArgumentId.slice(0, 8)}…
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Edges summary */}
                      {(c.edges && (c.edges.incoming.length > 0 || c.edges.outgoing.length > 0)) && (
                        <div className="text-xs bg-slate-300/35 backdrop-blur-sm p-3 rounded-lg border border-cyan-300/40">
                          <strong className="text-sky-900 text-sm font-semibold">Graph Connections:</strong>
                          {c.edges.incoming.length > 0 && (
                            <div className="ml-2 mt-1.5 text-slate-700">
                              ← {c.edges.incoming.length} incoming ({c.edges.incoming.filter((e: any) => e.type === "supports").length} supports, {c.edges.incoming.filter((e: any) => e.type === "rebuts").length} rebuts)
                            </div>
                          )}
                          {c.edges.outgoing.length > 0 && (
                            <div className="ml-2 mt-1 text-slate-700">
                              → {c.edges.outgoing.length} outgoing
                            </div>
                          )}
                        </div>
                      )}

                      {/* Critical Questions interface */}
                      <div className="h-full">
                        <button
                          onClick={() => handleToggleCQs(c.id)}
                          className=" border btnv2  bg-white  border-cyan-500/50
                          w-full h-full text-left text-md font-semibold  text-sky-900 flex items-center 
                          gap-2 hover:text-cyan-700 transition-colors py-3 px-3 rounded-lg hover:bg-teal-300/10"
                        >
                          <div className="w-2 h-2 rounded-full bg-sky-600" />
                          Critical Questions
                          <svg 
                            className={`w-4 h-4 ml-auto transition-transform duration-200 ${expandedCQs.has(c.id) ? "rotate-180" : ""}`}
                            fill="none" 
                            viewBox="0 0 24 24" 
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedCQs.has(c.id) && (
                          <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-slate-900/10 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                            <CriticalQuestionsV3
                              targetType="claim"
                              targetId={c.id}
                              createdById={c.createdById ? String(c.createdById) : undefined}
                              
                              claimAuthorId={c.createdById ? String(c.createdById) : undefined}
                              deliberationId={deliberationId}
                              
                            />
                          </div>
                        )}
                      </div>

                      {/* Thesis Builder */}
                      {/* <div className="pt-2 border-t border-cyan-500/20 mt-2">
                        <div className="border bg-white border-teal-500/50 w-full text-left text-md font-semibold text-sky-900 flex items-center gap-2 hover:text-cyan-700 transition-colors py-3 px-3 rounded-lg">
                          <div className="w-2 h-2 rounded-full bg-teal-600" />
                          <div className="flex items-center gap-5 flex-1">
                            <span className="text-md font-medium">Thesis Builder</span>
                            <button
                              onClick={() => {
                                // Create new thesis with this claim as the main claim
                                window.location.href = `/deliberations/${deliberationId}/thesis/new?claimId=${c.id}`;
                              }}
                              className="ml-auto px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-teal-700 hover:to-emerald-700 transition-all shadow-sm"
                            >
                              Promote to Thesis
                            </button>
                          </div>
                        </div>
                      </div> */}

                      {/* Legal moves interface */}
                      <div className="pt-2 border-t border-cyan-500/20 mt-2">
                        <div   className=" border   bg-white  border-purple-500/50
                          w-full h-full text-left text-md font-semibold  text-sky-900 flex items-center 
                          gap-2 hover:text-cyan-700 transition-colors py-3 px-3 rounded-lg "
                        >
                          <div className="w-2 h-2 rounded-full bg-sky-600" />
                                                     <div className="flex items-center gap-5">

                          <span className="text-md font-medium">Dialogical Moves</span>

                          <DialogueActionsButton
                            deliberationId={deliberationId}
                            targetType="claim"
                            targetId={c.id}
                            locusPath="0"
                            variant="compact"
                            label="Open Dialogue Actions"
                            onMovePerformed={() => {
                              window.dispatchEvent(new CustomEvent("claims:changed"));
                              window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
                            }}
                          />
                        </div>
                        </div>
                       
                      </div>
                    </div>
                  )}

                  {/* Show moves panel */}
                  {showMoves === c.id && c.moves && (
                    <div className="mt-3 pl-6 border-l-2 border-amber-500/40 bg-gradient-to-br from-amber-400/15 to-yellow-400/15 backdrop-blur-sm p-4 rounded-xl border border-amber-500/30 shadow-lg space-y-4">
                      <div className="font-semibold mb-2 text-amber-900 text-xs flex items-center gap-2">
                        
                        <Activity className="w-4 h-4 text-amber-600" />
                        Dialogical Activity:
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">WHY moves:</span> 
                          <span className="text-slate-700">{c.moves.whyCount} <span className="text-amber-800">(open: {c.moves.openWhys})</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">GROUNDS responses:</span> 
                          <span className="text-slate-700">{c.moves.groundsCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Concessions:</span> 
                          <span className="text-slate-700">{c.moves.concedeCount}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Retractions:</span> 
                          <span className="text-slate-700">{c.moves.retractCount}</span>
                        </div>
                      </div>
                      {c.moves.openWhys > 0 && (
                        <div className="mt-3 pt-2 border-t border-amber-500/20 text-amber-900 font-semibold text-xs flex items-center gap-2">
                          <span className="text-base">⚠️</span>
                          {c.moves.openWhys} open challenge{c.moves.openWhys > 1 ? "s" : ""} requiring response
                        </div>
                      )}

                      {/* Interactive moves - LegalMoveChips */}
                      <div className="pt-3 border-t border-amber-500/20">
                        <div className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-2">
                          <Crosshair className="w-4 h-4 text-amber-600" />
                          Quick Actions:
                        </div>
                        <div>
                          <LegalMoveChips
                            deliberationId={deliberationId}
                            targetType="claim"
                            targetId={c.id}
                            locusPath="0"
                            onPosted={() => {
                            window.dispatchEvent(new CustomEvent("claims:changed"));
                            window.dispatchEvent(new CustomEvent("dialogue:moves:refresh"));
                          }}
                        />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {enrichedClaims.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-6 bg-slate-900/5 backdrop-blur-sm rounded-xl border border-slate-900/10">
                No claims yet.
              </div>
            )}
          </div>

          {enrichedClaims.length > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={!canGoPrev}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-slate-900/5 backdrop-blur-md border border-slate-900/20 text-slate-900 hover:bg-slate-900/10 hover:border-slate-900/30 transition-all duration-200 font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-700 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <span className="text-xs text-slate-500">
                  ({startIndex + 1}-{Math.min(endIndex, enrichedClaims.length)} of {enrichedClaims.length})
                </span>
              </div>

              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!canGoNext}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-slate-900/5 backdrop-blur-md border border-slate-900/20 text-slate-900 hover:bg-slate-900/10 hover:border-slate-900/30 transition-all duration-200 font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          <div className="text-[11px] text-slate-600 mt-5 pt-4 border-t border-slate-900/10 flex items-center gap-4 flex-wrap font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> IN
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" /> OUT
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700 shadow-sm" /> UNDEC
            </span>
            <span className="text-slate-500">(grounded semantics)</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">R=Rebuts, U=Undercuts, M=Undermines</span>
          </div>

          {/* CQ Modal */}
          {cqOpenFor && (
            <Dialog open onOpenChange={(o) => { if (!o) setCqOpenFor(null); }}>
              <DialogContent 
                className="!z-[60] bg-white/95 backdrop-blur-xl rounded-xl max-w-[90vw] w-full sm:max-w-[880px] max-h-[85vh] overflow-y-auto shadow-2xl"
                overlayClassName="!z-[60]"
              >
                
                {/* Water droplets */}
                <div className="absolute top-10 right-20 w-24 h-24 bg-sky-400/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
                <div className="absolute bottom-20 left-10 w-32 h-32 bg-cyan-400/8 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none" />
                
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
                      createdById={claimAuthorId}
                      currentUserId={currentUserId}
                      claimAuthorId={enrichedClaims.find(c => c.id === cqOpenFor)?.createdById ? String(enrichedClaims.find(c => c.id === cqOpenFor)?.createdById) : undefined}
                      deliberationId={deliberationId}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
      </div>
    </div>
  );
}
