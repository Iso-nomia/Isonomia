// components/ludics/DesignTreeView.tsx
'use client';

import * as React from 'react';
import { LociTree } from '@/packages/ludics-react/LociTree';
import { buildTreeFromDesign } from './buildTreeFromDesign';
import { ArgumentSchemeView } from './ArgumentSchemeView';
import type { StepResult } from '@/packages/ludics-core/types';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type Act = {
  id: string;
  kind: string;
  polarity?: string | null;
  expression?: string;
  locus?: { path?: string | null };
  locusPath?: string;
  ramification?: string[];
  isAdditive?: boolean;
  semantic?: any;
};

type Design = {
  id: string;
  participantId: string;
  semantics?: string;
  version?: number;
  acts: Act[];
  extJson?: any;
};

type ViewMode = 'tree' | 'scheme' | 'both';

export function DesignTreeView({
  design,
  deliberationId,
  isSelected,
  onSelect,
  trace,
  highlight,
  preEnrichedDesign,
}: {
  design: Design | undefined | null;
  deliberationId: string;
  isSelected?: boolean;
  onSelect?: () => void;
  trace?: StepResult | null;
  highlight?: 'positive' | 'negative';
  /** If provided, skip the SWR fetch and use this pre-enriched design data */
  preEnrichedDesign?: Design | null;
}) {
  const [viewMode, setViewMode] = React.useState<ViewMode>('tree');
  
  // Fetch semantic enriched design data only if not pre-enriched
  const { data: semanticData } = useSWR(
    // Skip fetch if we have pre-enriched data
    design?.id && !preEnrichedDesign ? `/api/ludics/designs/${design.id}/semantic` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  
  // Use pre-enriched data if available, otherwise use fetched data
  const enrichedDesign = preEnrichedDesign || (semanticData?.ok ? semanticData.design : design);
  
  // Build tree from SINGLE design (with semantic annotations if available)
  const tree = React.useMemo(() => {
    if (!enrichedDesign) return null;
    return buildTreeFromDesign(enrichedDesign);
  }, [enrichedDesign]);
  
  // Extract acts used by THIS design in trace
  const actIdsUsedInTrace = React.useMemo(() => {
    if (!trace?.pairs || !design) return new Set<string>();
    const ids = new Set<string>();
    
    trace.pairs.forEach(pair => {
      if (design.participantId === 'Proponent' && pair.posActId) {
        ids.add(pair.posActId);
      }
      if (design.participantId === 'Opponent' && pair.negActId) {
        ids.add(pair.negActId);
      }
    });
    
    return ids;
  }, [trace, design]);
  
  // Build step index map for this design's acts
  const stepIndexByActId = React.useMemo(() => {
    if (!trace?.pairs || !design) return {};
    const map: Record<string, number> = {};
    
    trace.pairs.forEach((pair, i) => {
      if (design.participantId === 'Proponent' && pair.posActId) {
        map[pair.posActId] = i + 1;
      }
      if (design.participantId === 'Opponent' && pair.negActId) {
        map[pair.negActId] = i + 1;
      }
    });
    
    return map;
  }, [trace, design]);
  
  if (!design) {
    return (
      <div className="design-tree-view empty">
        <div className="p-4 text-sm text-slate-500">
          No design available
        </div>
      </div>
    );
  }
  
  const isProponent = design.participantId === 'Proponent';
  
  return (
    <div 
      className={`design-tree-view  rounded-lg ${isSelected ? 'selected' : ''} ${highlight || ''}`}
      onClick={onSelect}
    >
      {/* Design header with ludics metadata */}
      <div className={`design-header  rounded-t-lg border p-3 ${

        isProponent 
          ? 'bg-gradient-to-br from-sky-50 to-indigo-50 border-sky-200' 
          : 'bg-gradient-to-br from-rose-50 to-orange-50 border-rose-200'
      }`}>
        <div className="design-title flex items-center gap-2 mb-2">
          <span className={`polarity-badge text-lg font-bold px-2 py-1 rounded ${
            isProponent 
              ? 'bg-sky-200 text-sky-700' 
              : 'bg-rose-200 text-rose-700'
          }`}>
            {isProponent ? '+' : '−'}
          </span>
          <h3 className="text-base font-bold text-slate-800">{design.participantId}</h3>
          <code className="design-id text-xs text-slate-500 font-mono bg-white px-1.5 py-0.5 rounded">
            {design.id.slice(0,8)}
          </code>
          
          {/* View mode toggle */}
          <div className="ml-auto flex gap-1 bg-white/80 rounded-md p-0.5 border border-indigo-600">
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('tree'); }}
              className={`px-2 py-1 text-xs rounded transition ${
                viewMode === 'tree' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Show ludics tree"
            >
              𐂷 Tree
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('scheme'); }}
              className={`px-2 py-1 text-xs rounded transition ${
                viewMode === 'scheme' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Show argument schemes"
            >
              ⛭ Schemes
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('both'); }}
              className={`px-2 py-1 text-xs rounded transition ${
                viewMode === 'both' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              title="Show both views"
            >
              ⨈ Both
            </button>
          </div>
        </div>
        
        <div className="design-metadata text-xs text-slate-600 flex flex-wrap gap-3 mb-1">
          <span>Semantics: <strong>{design.semantics || 'CLASSICAL'}</strong></span>
          <span>Version: <strong>{design.version || 1}</strong></span>
          <span>Acts: <strong>{design.acts?.length || 0}</strong></span>
        </div>
        
        <div className="design-description text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-700">Design:</strong> Independent strategy (behavior) for {design.participantId}.
          Interacts with counter-designs at shared loci via normalization.
        </div>
      </div>
      
      {/* Tree: ONLY this design's acts */}
      <div className={`design-content-container border rounded-b-lg bg-white/30 backdrop-blur ${
        isProponent ? 'border-sky-200' : 'border-rose-200'
      }`}>
        {viewMode === 'both' ? (
          // Both view: side-by-side grid with synchronized scrolling
          <div className="grid grid-cols-2 divide-x divide-slate-200">
            {/* Left: Ludics Tree View */}
            <div className="max-h-[500px] overflow-y-auto p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <span>𐂷</span> Ludics Tree
              </div>
              {tree && enrichedDesign?.acts && enrichedDesign.acts.length > 0 ? (
                <LociTree
                  root={tree}
                  showExpressions
                  stepIndexByActId={stepIndexByActId}
                  defaultCollapsedDepth={2}
                  enableKeyboardNav={false}
                  autoScrollOnFocus={false}
                />
              ) : (
                <div className="empty-design p-4 text-sm text-slate-500 text-center">
                  No acts in this design yet
                </div>
              )}
            </div>
            
            {/* Right: Argument Scheme View */}
            <div className="max-h-[500px] overflow-y-auto p-3">
              <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                <span>⛭</span> Argument Schemes
              </div>
              {enrichedDesign ? (
                <ArgumentSchemeView 
                  acts={enrichedDesign.acts || []} 
                  participantId={design.participantId}
                />
              ) : (
                <div className="p-4 text-sm text-slate-500 text-center">
                  Loading schemes...
                </div>
              )}
            </div>
          </div>
        ) : (
          // Single view mode (tree or scheme)
          <div className="max-h-[500px] overflow-y-auto p-2">
            {/* Ludics Tree View */}
            {viewMode === 'tree' && (
              <>
                {tree && enrichedDesign?.acts && enrichedDesign.acts.length > 0 ? (
                  <LociTree
                    root={tree}
                    showExpressions
                    stepIndexByActId={stepIndexByActId}
                    defaultCollapsedDepth={2}
                    enableKeyboardNav={false}
                    autoScrollOnFocus={false}
                  />
                ) : (
                  <div className="empty-design p-4 text-sm text-slate-500 text-center">
                    No acts in this design yet
                  </div>
                )}
              </>
            )}
            
            {/* Argument Scheme View */}
            {viewMode === 'scheme' && enrichedDesign && (
              <ArgumentSchemeView 
                acts={enrichedDesign.acts || []} 
                participantId={design.participantId}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
