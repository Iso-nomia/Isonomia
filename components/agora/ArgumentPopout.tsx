
// components/agora/ArgumentPopout.tsx
'use client';
import { useState } from 'react';
import useSWR from 'swr';
import DiagramView from '../map/DiagramView';
import AifDiagramView from '../map/AifDiagramView';
import { AifDiagramViewerDagre } from '../map/Aifdiagramviewerdagre';
import type { Diagram, AifSubgraph, AifNode } from '@/lib/arguments/diagram';
import UndercutPill from "./UndercutPill";
import type { SheetStatement, SheetInference } from '@/lib/agora/types/types';

type LocalDiagram = {
  id: string;
  title?: string | null;
  statements: SheetStatement[];
  inferences: SheetInference[];
  argumentId?: string;          // ← add
  deliberationId?: string;      // ← add
};

type ViewMode = 'toulmin' | 'aif';

export default function ArgumentPopout({
  node,
  onClose,
}: {
  node: any;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('toulmin');
  const [clickedNode, setClickedNode] = useState<AifNode | null>(null); // ✅ Add missing state

  const key = node?.diagramId
    ? `/api/arguments/${node.diagramId}?view=diagram`
    : node?.argumentId
      ? `/api/arguments/${node.argumentId}?view=diagram`
      : null;

  const { data, error } = useSWR(key, (r) => fetch(r).then((x) => x.json()));

  if (!node?.diagramId && !node?.argumentId) return null;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-semibold mb-1">Failed to load diagram</div>
        <div className="text-xs">{error.message || 'Unknown error'}</div>
      </div>
    );
  }

  if (!data?.diagram) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
        <div className="text-sm text-slate-600">Loading argument diagram...</div>
      </div>
    );
  }

  const raw: LocalDiagram = data.diagram;
  const byId = new Map(raw.statements.map(s => [s.id, s]));

  // Map to DiagramView format
  const stmts = (raw.statements ?? []).map(s => ({
    id: s.id,
    text: s.text,
    kind: (s as any).kind ?? (s.role === "claim" ? "claim" : "premise"),
  }));

  const infs = (raw.inferences ?? []).map(inf => ({
    id: inf.id,
    conclusionId: inf.conclusion?.id ?? '',
    premiseIds: (inf.premises ?? [])
      .map(p => p?.statement?.id)
      .filter(Boolean) as string[],
    scheme: inf.kind ?? undefined,
  }));

  const evidence = Array.isArray((raw as any).evidence)
    ? (raw as any).evidence.map((e: any) => ({ id: e.id, uri: e.uri ?? e.url, note: e.note ?? null }))
    : [];

  const normalized: Diagram = {
    id: raw.id,
    title: raw.title ?? node.title ?? 'Argument',
    statements: stmts as any,
    inferences: infs as any,
    evidence,
    aif: (data.diagram as any).aif, // Pass through AIF data if present
  };

  // Precompute statement membership for the list view
  const conclIds = new Set(
    (raw.inferences ?? [])
      .map((inf) => inf.conclusion?.id)
      .filter(Boolean) as string[]
  );
  const premiseIds = new Set(
    (raw.inferences ?? []).flatMap(
      (inf) =>
        (inf.premises ?? [])
          .map((p) => p.statement?.id)
          .filter(Boolean) as string[]
    )
  );

  const letterFor = (s: { id: string; role?: string | null }) =>
    s.role?.[0]?.toUpperCase() ??
    (conclIds.has(s.id) ? 'C' : premiseIds.has(s.id) ? 'P' : 'S');

  const hasAifData = normalized.aif && normalized.aif.nodes.length > 0;

  // ✅ Handler for AIF node clicks
  const handleAifNodeClick = (nodeId: string) => {
    if (!normalized.aif) return;
    const node = normalized.aif.nodes.find(n => n.id === nodeId);
    setClickedNode(node || null);
    console.log("Clicked AIF node:", node);
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header with title and controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="font-semibold text-lg text-slate-900">
          {node.title ?? raw.title ?? 'Argument Diagram'}
        </h3>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          {hasAifData && (
            <div className="flex border border-slate-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('toulmin')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'toulmin'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Toulmin
              </button>
              <button
                onClick={() => setViewMode('aif')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'aif'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                AIF Graph
              </button>
            </div>
          )}
          <button
            className="text-sm text-slate-600 hover:text-slate-900 underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Left panel: Text summary */}
        <div className="flex-shrink-0 w-96 border border-indigo-200 rounded-xl p-4 bg-indigo-50/30 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4">
            {/* Statements */}
            <div>
              <div className="text-xs font-semibold mb-2 text-indigo-900">Statements</div>
              <ul className="text-xs space-y-2">
                {(raw.statements ?? []).map((s) => (
                  <li key={s.id} className="flex gap-2">
                    <span className="text-indigo-600 font-mono flex-shrink-0">
                      [{letterFor(s)}]
                    </span>
                    <span className="text-slate-700">{s?.text ?? '(untitled)'}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Inferences */}
            <div>
              <div className="text-xs font-semibold mb-2 text-indigo-900">Inferences</div>
              <ul className="text-xs space-y-3">
                {(raw.inferences ?? []).map((inf) => {
                  const concl = byId.get(inf.conclusion?.id ?? "")?.text ?? "(no conclusion)";
                  const premiseTexts = (inf.premises ?? []).map(p => byId.get(p.statement?.id)?.text ?? "(?)");
                  
                  return (
                    <li key={inf.id} className="space-y-1">
                      <div className="text-slate-700">
                        <span className="font-medium text-emerald-700">{inf.kind ?? "→"}</span>
                        {' → '}
                        <span className="text-slate-900">{concl}</span>
                      </div>
                      {!!premiseTexts.length && (
                        <div className="text-[11px] text-slate-500 pl-2">
                          From: {premiseTexts.join(", ")}
                        </div>
                      )}
                      {/* <div className="flex flex-col gap-1.5 pt-1">
                        <UndercutPill
                          toArgumentId={node.argumentId ?? (raw as any).argumentId}
                          targetInferenceId={inf.id}
                          deliberationId={(node as any).deliberationId ?? (raw as any).deliberationId}
                          toDiagramId={node.diagramId ?? raw.id}            // optional fallback (see server fix below)
                        />
                      </div> */}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Right panel: Visual diagram */}
        <div className="flex-1 border border-slate-200 rounded-xl p-4 bg-white min-h-[500px]">
          {viewMode === 'toulmin' ? (
            <DiagramView diagram={normalized as unknown as import("../map/DiagramView").Diagram} />
          ) : hasAifData ? (
            <AifDiagramViewerDagre
              initialGraph={normalized.aif!}
              onNodeClick={handleAifNodeClick}
              layoutPreset="standard"
              className="h-[600px]"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-500">
              No AIF graph data available for this argument
            </div>
          )}
        </div>
      </div>

      {/* ✅ Optional: Display clicked node details */}
      {viewMode === 'aif' && clickedNode && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">
            Selected Node Details
          </h4>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">ID</div>
              <div className="font-mono text-xs text-slate-900">{clickedNode.id}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Kind</div>
              <div className="font-semibold text-slate-900">{clickedNode.kind}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Label</div>
              <div className="text-slate-900">{clickedNode.label || '(none)'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Scheme</div>
              <div className="text-slate-900">{clickedNode.schemeKey || '(none)'}</div>
            </div>
          </div>
          {clickedNode.label && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="text-xs text-slate-500 mb-1">Content</div>
              <div className="text-sm text-slate-700">{clickedNode.label}</div>
            </div>
          )}
        </div>
      )}

      {/* Footer info */}
      {viewMode === 'aif' && hasAifData && (
        <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-200">
          Showing {normalized.aif!.nodes.length} nodes and {normalized.aif!.edges.length} edges
          {normalized.aif!.nodes.filter(n => n.kind === 'CA').length > 0 && (
            <span className="ml-2">
              • {normalized.aif!.nodes.filter(n => n.kind === 'CA').length} conflict(s)
            </span>
          )}
          {normalized.aif!.nodes.filter(n => n.kind === 'PA').length > 0 && (
            <span className="ml-2">
              • {normalized.aif!.nodes.filter(n => n.kind === 'PA').length} preference(s)
            </span>
          )}
        </div>
      )}
    </div>
  );
}