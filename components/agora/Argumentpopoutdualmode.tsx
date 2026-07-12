/**
 * Phase 4: Dual-Mode Argument Viewer
 * 
 * Enhanced ArgumentPopout that can toggle between:
 * - Toulmin diagram view (existing DiagramView)
 * - AIF graph view (new AifDiagramView)
 */

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import AifDiagramViewInteractive from '../map/AifDiagramViewInteractive';
import UndercutPill from './UndercutPill';
import type { AifNode } from '@/lib/arguments/diagram';

// Assuming you have DiagramView component
// import DiagramView from './DiagramView';

type ViewMode = 'toulmin' | 'aif';

export default function ArgumentPopoutDualMode({ 
  node, 
  onClose 
}: { 
  node: any; 
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('toulmin');
  const [clickedAifNode, setClickedAifNode] = useState<AifNode | null>(null);

  // Fetch the argument data
  const { data, error, isLoading } = useSWR(
    node?.diagramId ? `/api/arguments/${node.diagramId}` : null,
    (url) => fetch(url).then(r => r.json())
  );

  if (!node?.diagramId) return null;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-red-900">Error Loading Argument</h3>
          <button className="text-xs underline text-red-700" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-sm text-red-600">Failed to load argument diagram</p>
      </div>
    );
  }

  if (isLoading || !data?.diagram) {
    return (
      <div className="rounded-lg border p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{node.title || 'Argument'}</h3>
          <button className="text-xs underline" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="text-xs text-slate-500 py-4 text-center">
          Loading diagram...
        </div>
      </div>
    );
  }

  const diagram = data.diagram;
  const hasAif = !!diagram.aif;
  const provenance = data.provenance;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-lg">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-900">
            {node.title || diagram.title || 'Argument'}
          </h3>
          
          {/* Provenance badge */}
          {provenance && (
            <a
              href={`/room/${provenance.sourceDeliberationId}?highlightArg=${provenance.fingerprint?.split(":")[1] || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
              title={`View source argument in "${provenance.sourceDeliberationName}" (fingerprint: ${provenance.fingerprint?.slice(0, 8)}...)`}
              onClick={(e) => e.stopPropagation()}
            >
              📥 Imported
            </a>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          {hasAif && (
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('toulmin')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'toulmin'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Toulmin
              </button>
              <button
                onClick={() => setViewMode('aif')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === 'aif'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AIF Graph
              </button>
            </div>
          )}
          
          <button 
            className="text-xs text-slate-500 hover:text-slate-700 underline" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* View content */}
      <div className="p-3">
        {viewMode === 'toulmin' ? (
          // Toulmin view - simple list representation for now
          // Replace with your actual DiagramView component
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium mb-2 text-slate-700">Statements</div>
              <ul className="text-xs space-y-1">
                {diagram.statements?.map((s: any) => (
                  <li key={s.id} className="flex gap-2">
                    <span className="text-slate-500 font-semibold">
                      [{s.role.slice(0, 1).toUpperCase()}]
                    </span>
                    <span className="text-slate-700">{s.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <div className="text-xs font-medium mb-2 text-slate-700">Inferences</div>
              <ul className="text-xs space-y-2">
                {diagram.inferences?.map((inf: any) => (
                  <li key={inf.id} className="border-l-2 border-indigo-300 pl-2">
                    <div className="font-semibold text-slate-700">{inf.kind}</div>
                    <div className="text-slate-600 mt-1">
                      → {inf.conclusion?.text || 'conclusion'}
                    </div>
                    {inf.premises?.length > 0 && (
                      <div className="text-slate-500 text-[11px] mt-1">
                        from: {inf.premises.map((p: any) => p.statement.text).join(', ')}
                      </div>
                    )}
                    {node.deliberationId && (
                      <div className="mt-1">
                        <UndercutPill
                          toArgumentId={node.diagramId}
                          targetInferenceId={inf.id}
                          deliberationId={node.deliberationId}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          // AIF view
          <>
            {hasAif ? (
              <div className="space-y-3">
                {/* AIF Diagram */}
                <AifDiagramViewInteractive
                  initialAif={diagram.aif}
                  rootArgumentId={`RA:${node.diagramId}`}
                  className="h-[400px]"
                  enableExpansion={true}
                  maxDepth={2}
                  onNodeClick={setClickedAifNode}
                />

                {/* Clicked AIF node info */}
                {clickedAifNode && (
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Selected Node
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-slate-500 mb-1">Type</div>
                        <div className="font-medium text-slate-900">{clickedAifNode.kind}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">ID</div>
                        <div className="font-mono text-[10px] text-slate-700">
                          {clickedAifNode.id}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Scheme</div>
                        <div className="text-slate-900">
                          {clickedAifNode.schemeKey || '—'}
                        </div>
                      </div>
                    </div>
                    {clickedAifNode.label && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <div className="text-slate-500 mb-1">Content</div>
                        <div className="text-slate-700">{clickedAifNode.label}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                <div className="mb-2">AIF view not available</div>
                <div className="text-xs">
                  This argument has not been converted to AIF format yet.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer info */}
      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div>
            {viewMode === 'toulmin' ? (
              <>
                {diagram.statements?.length || 0} statements · {diagram.inferences?.length || 0} inferences
              </>
            ) : hasAif ? (
              <>
                {diagram.aif?.nodes?.length || 0} nodes · {diagram.aif?.edges?.length || 0} edges
              </>
            ) : (
              'Toulmin view available'
            )}
          </div>
          {viewMode === 'aif' && hasAif && (
            <div className="text-slate-500">
              Click nodes to explore
            </div>
          )}
        </div>
      </div>
    </div>
  );
}