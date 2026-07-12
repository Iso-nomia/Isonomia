// DebateSheetReader.tsx

"use client";
import useSWR from "swr";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArgumentCardV2 } from "@/components/arguments/ArgumentCardV2";
import React from "react";
import { useConfidence } from "./useConfidence";
import { fetchClaimScores, ClaimScore } from '@/lib/client/evidential';
import { SupportBar } from "../evidence/SupportBar";
import { MiniNeighborhoodPreview } from "@/components/aif/MiniNeighborhoodPreview";
import { ArgumentActionsSheet } from "@/components/arguments/ArgumentActionsSheet";
import { useAuth } from "@/lib/AuthContext";
import { useDebateFilters } from "@/components/deepdive/v3/hooks/useDebateFilters";
import { useDebateModals } from "@/components/deepdive/v3/hooks/useDebateModals";
import {
  DebateSheetHeader,
  DebateSheetFilters,
  ArgumentNetworkCard,
  type SupportValue,
} from "@/components/deepdive/v3/debate-sheet";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EvNode = {
  id: string; // claimId
  diagramId: string | null; // concluding argument id for this claim (when present)
  text?: string;
  score: number; // support for the claim
  top: { argumentId: string; score: number }[];
};
type EvResp = {
  ok: boolean;
  deliberationId: string;
  mode: "min" | "product" | "logodds";
  nodes: EvNode[];
  arguments: { id: string; text?: string }[];
  meta: any;
  support?: Record<string, number>;
};


export function ClaimsPane({ deliberationId, claims }: { deliberationId: string; claims: { id: string; text: string }[] }) {
  const { mode, tau } = useConfidence();
  // DS mode is now supported by the API
  const { data: scores } = useSWR(
    () => claims?.length ? ['scores', deliberationId, mode, tau, claims.map(c=>c.id).join(',')] : null,
    async () => fetchClaimScores({ deliberationId, mode: mode as any, tau, claimIds: claims.map(c=>c.id) }),
    { revalidateOnFocus: false }
  );

  const byId = new Map<string, ClaimScore>((scores ?? []).map(s => [s.id, s]));
  const items = [...claims].map(c => ({ ...c, _s: byId.get(c.id) }));
  items.sort((a,b) => ((b._s?.score ?? b._s?.bel ?? 0) - (a._s?.score ?? a._s?.bel ?? 0)));

  return (
    <ul className="space-y-2">
      {items.map(c => {
        const s = c._s;
        const v = s?.score ?? s?.bel ?? 0;
        const upperBound = undefined;
        return (
          <li key={c.id} className="flex items-center gap-2">
            <span className="text-sm">{c.text}</span>
            <SupportBar 
              value={v} 
              upperBound={upperBound}
              mode={mode}
              claimId={c.id}
              deliberationId={deliberationId}
            />
            {s?.accepted && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                Accepted
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function DebateSheetReader({ 
  sheetId, 
  deliberationId 
}: { 
  sheetId?: string; 
  deliberationId?: string;
}) {
  const { user } = useAuth();
  const authorId = user?.userId != null ? String(user.userId) : "";
  
  // Extract deliberationId from sheetId if using legacy prop
  const delibId = useMemo(() => {
    if (deliberationId) return deliberationId;
    if (sheetId?.startsWith("delib:")) return sheetId.slice("delib:".length);
    return null;
  }, [deliberationId, sheetId]);
  
  // Legacy: fetch sheet data if sheetId provided (for non-synthetic sheets)
  const isSynthetic = sheetId?.startsWith("delib:") ?? false;
  const { data: sheetData, error: sheetError } = useSWR(
    sheetId && !isSynthetic ? `/api/sheets/${sheetId}` : null,
    r => fetch(r).then(x => x.json()),
    { refreshInterval: 0 }
  );

  const { mode, setMode } = useConfidence();
  const [imports, setImports] = React.useState<'off'|'materialized'|'virtual'|'all'>('off');
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 15;

  // Fetch unified data (AIF + evidential) from new endpoint
  // Note: Using high limit (500) since debate sheets typically need all arguments at once
  // TODO: Consider implementing pagination UI if debates regularly exceed 500 arguments
  const { data: fullData, mutate: refetchData, error: dataError } = useSWR(
    delibId ? `/api/deliberations/${delibId}/arguments/full?limit=500&mode=${mode}&imports=${imports}` : null,
    (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json()),
    { revalidateOnFocus: false }
  );

  // Build lookup map: argumentId -> full argument data (with AIF + support inline)
  const argumentById = useMemo(() => {
    const m = new Map<string, any>();
    if (fullData?.items) {
      for (const item of fullData.items) {
        m.set(item.id, item);
      }
    }
    return m;
  }, [fullData]);

  // Build AIF lookup for backward compatibility with existing code
  const aifByArgId = useMemo(() => {
    const m = new Map<string, any>();
    if (fullData?.items) {
      for (const item of fullData.items) {
        m.set(item.id, item.aif);
      }
    }
    return m;
  }, [fullData]);

  // Create nodes structure for hooks (from sheet or synthesized from arguments)
  const nodes = useMemo(() => {
    if (sheetData?.sheet?.nodes) return sheetData.sheet.nodes;
    if (fullData?.items) {
      return fullData.items.map((arg: any) => ({
        id: arg.id,
        argumentId: arg.id,
        title: arg.text,
        claimId: arg.aif?.conclusion?.id,
        diagramId: arg.id,
      }));
    }
    return [];
  }, [sheetData?.sheet?.nodes, fullData?.items]);

  // Use custom hooks for filters and modals
  const {
    filters,
    filteredNodes,
    availableSchemes,
    setSchemeFilter,
    setOpenCQsFilter,
    setAttackedFilter,
    clearFilters,
    hasActiveFilters,
  } = useDebateFilters({ nodes, aifByArgId });

  // Pagination logic
  const totalPages = Math.ceil(filteredNodes.length / itemsPerPage);
  const paginatedNodes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredNodes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredNodes, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filters.scheme, filters.openCQsOnly, filters.attackedOnly]);

  const {
    previewModal,
    openPreview,
    closePreview,
    actionsSheet,
    openActionsSheet,
    closeActionsSheet,
    expandModal,
    openExpand,
    closeExpand,
    contributingModal,
    openContributing,
    closeContributing,
  } = useDebateModals();

  // Helper to get bar data for a claim
  const barFor = (claimId?: string | null): SupportValue | null => {
    if (!claimId || !fullData?.items) return null;
    const arg = fullData.items.find((a: any) => a.aif?.conclusion?.id === claimId);
    if (!arg) return null;
    
    const s = typeof arg.support === 'number' ? arg.support : arg.support?.bel ?? 0;
    // Sprint C4: pass cross-room transport band through when present.
    return { kind: 'scalar', s, ...(arg.supportBand ? { band: arg.supportBand } : {}) };
  };

  // Build support lookup by claim (from arguments' conclusion claims)
  const supportByClaim = useMemo(() => {
    const m = new Map<string, number>();
    if (fullData?.items) {
      for (const arg of fullData.items) {
        if (arg.aif?.conclusion?.id) {
          const claimId = arg.aif.conclusion.id;
          const supportValue = typeof arg.support === 'number' 
            ? arg.support 
            : arg.support?.bel ?? 0;
          if (!m.has(claimId) || supportValue > (m.get(claimId) ?? 0)) {
            m.set(claimId, supportValue);
          }
        }
      }
    }
    return m;
  }, [fullData]);

  // Build contributing arguments map from API data
  const contributingByClaimId = useMemo(() => {
    const m = new Map<string, Array<{ 
      argumentId: string; 
      contributionScore: number; 
      argumentText: string | null;
      occurrences: number;
    }>>();
    if (fullData?.items) {
      for (const arg of fullData.items) {
        if (arg.aif?.conclusion?.id && arg.contributingArguments?.length) {
          m.set(arg.aif.conclusion.id, arg.contributingArguments);
        }
      }
    }
    return m;
  }, [fullData]);

  // Fetch neighborhood for previewed argument
  const previewedArgumentId = useMemo(() => {
    if (!previewModal.nodeId) return null;
    if (previewModal.argumentId) return previewModal.argumentId;
    const node = nodes.find((n: any) => n.id === previewModal.nodeId);
    return node?.argumentId || null;
  }, [previewModal.nodeId, previewModal.argumentId, nodes]);

  const { data: neighborhoodData, error: neighborhoodError, isLoading: neighborhoodLoading } = useSWR(
    previewedArgumentId ? `/api/arguments/${previewedArgumentId}/aif-neighborhood?depth=1` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // Handle node click to open ArgumentActionsSheet
  const handleNodeClick = (node: any) => {
    if (!node.argumentId) return;
    
    try {
      const aif = aifByArgId?.get(node.argumentId);
      openActionsSheet({
        id: node.argumentId,
        text: node.title || node.id,
        conclusionText: node.title || node.id,
        schemeKey: aif?.scheme?.key,
      });
    } catch (error) {
      console.error("Error opening argument actions sheet:", error);
    }
  };

  if (sheetError || dataError) return <div className="text-xs text-red-600">Failed to load data</div>;
  if (!delibId) return <div className="text-xs text-red-600">No deliberation ID provided</div>;
  if (!fullData && !sheetData) return <div className="text-xs text-neutral-500">Loading…</div>;

  // Extract sheet metadata (for legacy sheet mode) or create defaults
  const sheetInfo = sheetData?.sheet ?? {
    edges: [],
    acceptance: { semantics: 'grounded', labels: {} },
    unresolved: [],
    loci: [],
    title: 'Debate Sheet',
    deliberationId: delibId,
  };
  const { edges, acceptance, unresolved, loci, title } = sheetInfo;

  const argText = (id: string) => argumentById.get(id)?.text;
  const supportOfClaimId = (claimId?: string | null) =>
    claimId && supportByClaim.has(claimId) ? supportByClaim.get(claimId)! : undefined;

  return (
    <>
    <div className="border rounded-xl p-3 bg-slate-50 flex flex-col flex-wrap w-full gap-4 ">
      <aside className="space-y-3">
        {/* Extracted Header Component */}
        <DebateSheetHeader
          title={title}
          mode={mode as "min" | "product" | "ds"}
          onModeChange={(newMode) => { setMode(newMode as typeof mode); refetchData(); }}
          imports={imports}
          onImportsChange={setImports}
        />

        {/* Extracted Filters Component */}
        <DebateSheetFilters
          filters={filters}
          availableSchemes={availableSchemes}
          onSchemeChange={setSchemeFilter}
          onOpenCQsChange={setOpenCQsFilter}
          onAttackedChange={setAttackedFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <div className="text-xs">Semantics: {acceptance.semantics}</div>

        <div className="space-y-1">
          {loci.map((l:any) => (
            <div key={l.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
              <span>Locus {l.locusPath}</span>
              <Badge variant={l.open ? 'default' : 'secondary'}>
                {l.open ? (l.closable ? 'closable' : 'open') : 'closed'}
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <div className="text-xs space-y-2 font-medium ">Unresolved CQs</div>
          <ul className="text-xs flex  mt-2 flex-wrap gap-2 ">
            {unresolved.map((u:any) => {
              const cqDisplay = u.cqText 
                ? u.cqText 
                : u.cqKey.replace(/^aif_attack_/, "").replace(/_/g, " ");
              
              const argNode = nodes.find((n: any) => n.id === u.nodeId || n.argumentId === u.nodeId);
              const nodeDisplay = argNode?.title 
                ? (argNode.title.length > 40 ? argNode.title.slice(0, 40) + "..." : argNode.title)
                : u.nodeId;
              
              return (
                <li key={`${u.nodeId}:${u.cqKey}`} className="border border-amber-400 rounded w-fit h-fit px-2 py-1">
                  <div className="font-medium text-amber-700">{cqDisplay}</div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">→ {nodeDisplay}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <main className="space-y-3">
        <div className="rounded border p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-neutral-600">
              Debate graph ({filteredNodes.length} {filteredNodes.length === 1 ? "node" : "nodes"})
              {totalPages > 1 && (
                <span className="ml-1 text-neutral-500">
                  • Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-xs btnv2 rounded-full hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-xs btnv2 rounded-full rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
          <ul className="grid md:grid-cols-2 lg:grid-cols-2 gap-3">
            {paginatedNodes.map((n:any) => {
              const label = acceptance.labels[n.id] ?? 'undecided';
              const s = supportOfClaimId(n.claimId);
              const v = barFor(n.claimId);
              const aif = n.argumentId ? aifByArgId.get(n.argumentId) : null;
              const edgeCount = edges.filter((e:any)=>e.fromId===n.id || e.toId===n.id).length;

              return (
                <ArgumentNetworkCard
                  key={n.id}
                  node={n}
                  aif={aif}
                  label={label}
                  supportValue={v}
                  supportScore={s}
                  edgeCount={edgeCount}
                  onPreview={(nodeId) => openPreview(nodeId, n.argumentId)}
                  onActions={handleNodeClick}
                  onExpand={() => openExpand(n.id)}
                  onViewContributing={(claimId) => openContributing(claimId)}
                  
                />
              );
            })}
          </ul>
        </div>

        {expandModal.isOpen && expandModal.nodeId && (() => {
          const node = nodes.find((nn:any) => nn.id === expandModal.nodeId);
          const argData = node?.argumentId ? argumentById.get(node.argumentId) : null;
          const aifData = argData?.aif;
          
          if (!argData || !aifData?.conclusion) return null;

          return (
            <Dialog open={expandModal.isOpen} onOpenChange={(open) => !open && closeExpand()}>
              <DialogContent className="max-w-4xl max-h-[90vh] bg-white overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold">Argument Details</DialogTitle>
                </DialogHeader>
                <ArgumentCardV2
                  deliberationId={delibId!}
                  authorId={authorId}
                  id={argData.id}
                  conclusion={{
                    id: aifData.conclusion.id,
                    text: aifData.conclusion.text || argData.text || "Untitled claim"
                  }}
                  premises={aifData.premises?.map((p: any) => ({
                    id: p.id,
                    text: p.text || "Untitled premise"
                  })) ?? []}
                  schemeKey={aifData.scheme?.key}
                  schemeName={aifData.scheme?.name}
                  onAnyChange={() => refetchData()}
                />
              </DialogContent>
            </Dialog>
          );
        })()}

        {contributingModal.isOpen && contributingModal.claimId && (
          <div className="rounded border p-3 w-full max-w-4xl h-full bg-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Contributing arguments (I → φ)</div>
              <button className="text-xs underline" onClick={() => closeContributing()}>Close</button>
            </div>
            <p className="text-[11px] text-neutral-600 mb-2">
              Mode: <code>{mode}</code>. These are the arguments that contribute support to this claim.
            </p>
            <ul className="space-y-2 text-sm">
              {(contributingByClaimId.get(contributingModal.claimId) ?? []).map((c) => (
                <li key={c.argumentId} className="p-2 border rounded flex items-center justify-between gap-2 bg-white">
                  <div className="truncate flex-1">
                    {c.argumentText ?? `Argument ${c.argumentId.slice(0,8)}…`}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.occurrences > 1 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                        ×{c.occurrences}
                      </Badge>
                    )}
                    <div className="text-[11px] tabular-nums font-medium text-emerald-700 min-w-[3ch] text-right">
                      {Math.round(c.contributionScore*100)}%
                    </div>
                  </div>
                </li>
              ))}
              {!(contributingByClaimId.get(contributingModal.claimId)?.length) && (
                <li className="text-xs text-neutral-600">No contributing arguments recorded yet.</li>
              )}
            </ul>
          </div>
        )}
      </main>
    </div>

    {/* AIF Neighborhood Preview Modal */}
    <Dialog open={previewModal.isOpen} onOpenChange={(open) => !open && closePreview()}>
      <DialogContent className="max-w-[750px] backdrop-blur-md border-2  border-white rounded-xl ">
        <DialogHeader>
          <DialogTitle className="tracking-wide text-white font-medium">AIF Neighborhood Preview</DialogTitle>
        </DialogHeader>
        <div className="py-0">
          <MiniNeighborhoodPreview 
            data={neighborhoodData}
            loading={neighborhoodLoading}
            error={neighborhoodError}
            maxWidth={700}
            maxHeight={400}
          />
        </div>
        <div className="text-xs text-neutral-600 text-center border-t pt-1">
          Click the node card to view the full argument with all actions
        </div>
      </DialogContent>
    </Dialog>

    {/* ArgumentActionsSheet Modal for detailed argument exploration */}
    {delibId && (
      <ArgumentActionsSheet
        open={actionsSheet.isOpen}
        onOpenChange={(open) => !open && closeActionsSheet()}
        deliberationId={delibId}
        authorId={authorId}
        selectedArgument={actionsSheet.selectedArgument}
        onRefresh={() => {
          refetchData();
        }}
      />
    )}
    </>
  );
}
