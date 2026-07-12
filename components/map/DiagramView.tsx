//components/map/DiagramView.tsx
'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { motion } from 'framer-motion';

// ---------------- Types ----------------
export type StatementKind = 'claim' | 'premise' | 'warrant' | 'backing' | 'rebuttal';
export type Statement = { id: string; text: string; kind: StatementKind };
export type Inference = {
  id: string;
  conclusionId: string;
  premiseIds: string[];
  scheme?: string | null;
};
export type EvidenceItem = { id: string; uri: string; note?: string | null };
export type Diagram = {
  id: string;
  title?: string | null;
  statements: Statement[];
  inferences: Inference[];
  evidence: EvidenceItem[];
};



// ---------------- Helpers ----------------
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function kindColors(kind: StatementKind) {
  switch (kind) {
    case 'claim':
      return 'bg-emerald-50 border-emerald-200';
    case 'premise':
      return 'bg-indigo-50 border-indigo-200';
    case 'warrant':
      return 'bg-amber-50 border-amber-200';
    case 'backing':
      return 'bg-cyan-50 border-cyan-200';
    case 'rebuttal':
      return 'bg-rose-50 border-rose-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
}

function useResizeObserver(cb: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => cb());
    ro.observe(el);
    window.addEventListener('resize', cb);
    const t = setTimeout(cb, 0); // after first paint
    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener('resize', cb);
    };
  }, [cb]);
  return ref;
}

// ---------------- Component ----------------
export default function DiagramView({
  diagram: inputDiagram,
  className,
  compact = false,
  onStatementClick,
}: {
  diagram?: Diagram; // if omitted, a tiny demo diagram is shown
  className?: string;
  compact?: boolean;
  onStatementClick?: (id: string) => void;
}) {
  // Fallback sample for preview environments
  const demo: Diagram = useMemo(
    () => ({
      id: 'demo-1',
      title: 'Why the city should add protected bike lanes on Maple Ave',
      statements: [
        { id: 'c', text: 'The city should add protected bike lanes on Maple Ave.', kind: 'claim' },
        { id: 'p1', text: 'Protected lanes reduce injuries by 40–50% in peer cities.', kind: 'premise' },
        { id: 'p2', text: 'Maple Ave carries heavy bike and scooter traffic from two schools.', kind: 'premise' },
        { id: 'w1', text: 'If an intervention reduces injuries and demand is high, the city ought to implement it.', kind: 'warrant' },
      ],
      inferences: [
        { id: 'inf1', conclusionId: 'c', premiseIds: ['p1', 'p2', 'w1'] },
      ],
      evidence: [
        { id: 'e1', uri: 'https://example.org/safety-meta', note: 'Safety meta‑analysis (2023)' },
      ],
    }),
    []
  );

  const diagram = inputDiagram ?? demo;

  // Index statements for quick lookup
  const byId = useMemo(() => new Map(diagram.statements.map((s) => [s.id, s])), [diagram]);
  
  // Build a complete statement hierarchy showing all inferences
  const { layers, allStatementIds } = useMemo(() => {
    if (diagram.inferences.length === 0) {
      return { layers: [], allStatementIds: new Set<string>() };
    }

    // Find all statements that are conclusions
    const conclusionIds = new Set(diagram.inferences.map(inf => inf.conclusionId));
    
    // Find all statements that are only premises (never conclusions)
    const allPremiseIds = new Set(diagram.inferences.flatMap(inf => inf.premiseIds));
    const leafPremiseIds = new Set([...allPremiseIds].filter(id => !conclusionIds.has(id)));
    
    // Build layers from bottom up
    const statementLayers: string[][] = [];
    const processed = new Set<string>();
    
    // Layer 0: Leaf premises (statements that are never conclusions)
    const layer0 = [...leafPremiseIds];
    if (layer0.length > 0) {
      statementLayers.push(layer0);
      layer0.forEach(id => processed.add(id));
    }
    
    // Build subsequent layers by finding statements whose premises are all processed
    let safety = 0;
    while (processed.size < diagram.statements.length && safety < 20) {
      safety++;
      const nextLayer: string[] = [];
      
      for (const inf of diagram.inferences) {
        const conclusionId = inf.conclusionId;
        if (processed.has(conclusionId)) continue;
        
        // Check if all premises for this inference are processed
        const allPremisesProcessed = inf.premiseIds.every(pid => processed.has(pid));
        if (allPremisesProcessed && !nextLayer.includes(conclusionId)) {
          nextLayer.push(conclusionId);
        }
      }
      
      if (nextLayer.length === 0) break;
      
      statementLayers.push(nextLayer);
      nextLayer.forEach(id => processed.add(id));
    }
    
    // Add any remaining statements (shouldn't happen in well-formed diagrams)
    const remaining = diagram.statements
      .map(s => s.id)
      .filter(id => !processed.has(id));
    if (remaining.length > 0) {
      statementLayers.push(remaining);
    }
    
    return { 
      layers: statementLayers,
      allStatementIds: new Set(diagram.statements.map(s => s.id))
    };
  }, [diagram]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const statementRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [paths, setPaths] = useState<Array<{ d: string; fromId: string; toId: string }>>([]);
  const [svgSize, setSvgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const markerId = useId();

  // Measure and draw connectors
  const recompute = React.useCallback(() => {
    const root = containerRef.current;
    if (!root || layers.length === 0) return;
    
    const rootRect = root.getBoundingClientRect();
    const newPaths: Array<{ d: string; fromId: string; toId: string }> = [];

    // Draw connections for each inference
    diagram.inferences.forEach((inf) => {
      const conclusionEl = statementRefs.current[inf.conclusionId];
      if (!conclusionEl) return;
      const cRect = conclusionEl.getBoundingClientRect();

      inf.premiseIds.forEach((pid) => {
        const premiseEl = statementRefs.current[pid];
        if (!premiseEl) return;
        const pRect = premiseEl.getBoundingClientRect();
        
        const x1 = pRect.left - rootRect.left + pRect.width / 2;
        const y1 = pRect.top - rootRect.top + pRect.height; // bottom center of premise
        const x2 = cRect.left - rootRect.left + cRect.width / 2;
        const y2 = cRect.top - rootRect.top; // top center of conclusion
        
        const dx = Math.abs(x2 - x1);
        const curv = Math.min(160, Math.max(48, dx * 0.4));
        const d = `M ${x1} ${y1} C ${x1} ${y1 + curv}, ${x2} ${y2 - curv}, ${x2} ${y2}`;
        newPaths.push({ d, fromId: pid, toId: inf.conclusionId });
      });
    });

    // Update svg size to container box
    setSvgSize({ w: rootRect.width, h: root.scrollHeight });
    setPaths(newPaths);
  }, [diagram.inferences, layers]);

  const roRef = useResizeObserver(recompute);
  useEffect(() => {
    recompute();
  }, [diagram, recompute]);

  // Trigger once refs are set (next frame)
  useEffect(() => {
    const t = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(t);
  }, [recompute]);

  // --------------- UI ---------------
  // Check if we have statements but no inferences
  if (diagram.inferences.length === 0 && diagram.statements.length > 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        This argument has no structured inferences yet.
        <div className="mt-2 text-xs">
          {diagram.statements.map(s => (
            <div key={s.id} className="mt-1">{s.text}</div>
          ))}
        </div>
      </div>
    );
  }

  // Find the top-level conclusion (last layer)
  const topLevelConclusionId = layers.length > 0 ? layers[layers.length - 1][0] : null;
  const topLevelConclusion = topLevelConclusionId ? byId.get(topLevelConclusionId) : undefined;
  return (
    <div ref={(el) => { containerRef.current = el; roRef.current = el; }}
         className={classNames('relative w-full', className)}>
      {/* SVG connectors */}
      <svg className="pointer-events-none absolute inset-0" width={svgSize.w} height={svgSize.h} viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}>
        <defs>
          <marker id={`arrow-${markerId}`} markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400" />
          </marker>
        </defs>
        {paths.map((p, idx) => (
          <path key={`${p.fromId}-${p.toId}-${idx}`}
                d={p.d}
                className={classNames(
                  'fill-none stroke-slate-400',
                  (hoverId === p.fromId || hoverId === p.toId) && 'stroke-2 stroke-indigo-500',
                  !hoverId && 'stroke-[1.5]'
                )}
                markerEnd={`url(#arrow-${markerId})`} />
        ))}
      </svg>

      {/* Legend (top-right)
      <div className="absolute right-2 top-2 z-10 text-xs text-slate-600 bg-white/70 backdrop-blur rounded-full px-2 py-1 shadow">
        <span className="inline-flex items-center gap-1 mr-2"><span className="w-2 h-2 rounded-sm bg-indigo-300"></span>Premise</span>
        <span className="inline-flex items-center gap-1 mr-2"><span className="w-2 h-2 rounded-sm bg-emerald-300"></span>Conclusion</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-300"></span>Link</span>
      </div> */}

      {/* Title */}
      {diagram.title && (
        <div className="mb-3 pl-1 pr-14">
          <h3 className="text-sm font-medium text-slate-700">{diagram.title}</h3>
        </div>
      )}

      {/* Render all layers bottom-up */}
      {layers.map((layer, layerIndex) => (
        <div key={layerIndex} className="mb-10">
          {layerIndex > 0 && (
            <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-2 ml-24 text-center">
              Layer {layerIndex}
            </div>
          )}
          <div className="grid gap-3 md:gap-4"
               style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {layer.map((statementId) => {
              const statement = byId.get(statementId);
              if (!statement) return null;
              
              // Check if this is a top-level conclusion
              const isTopConclusion = layerIndex === layers.length - 1;
              
              return (
                <motion.div
                  key={statement.id}
                  ref={(el) => { statementRefs.current[statement.id] = el; }}
                  onMouseEnter={() => setHoverId(statement.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => onStatementClick?.(statement.id)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: layerIndex * 0.05 }}
                  className={classNames(
                    'relative rounded-2xl border p-3 md:p-4 shadow-sm cursor-default',
                    kindColors(statement.kind),
                    isTopConclusion && 'ring-2 ring-emerald-300/50',
                    'hover:shadow-md hover:border-indigo-300'
                  )}
                >
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                    {statement.kind}
                    {isTopConclusion && ' (Main Conclusion)'}
                  </div>
                  <div className={classNames('text-sm text-slate-800 whitespace-pre-wrap', compact && 'text-[13px]')}>
                    {statement.text}
                  </div>
                  
                  {/* Show scheme if this statement is a conclusion of an inference */}
                  {(() => {
                    const inf = diagram.inferences.find(i => i.conclusionId === statement.id);
                    if (inf?.scheme) {
                      return (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <span className="text-[10px] text-slate-600 bg-slate-100 rounded-full px-2 py-[2px]">
                            {inf.scheme}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Evidence (optional) - show at bottom */}
      {diagram.evidence?.length > 0 && (
        <div className="max-w-3xl mx-auto mt-6 pt-4 border-t border-slate-200">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Evidence</div>
          <ul className="text-sm text-slate-800 list-disc pl-5 space-y-1">
            {diagram.evidence.map((e) => (
              <li key={e.id}>
                <a className="underline decoration-dotted underline-offset-2 hover:decoration-solid" href={e.uri} target="_blank" rel="noreferrer">
                  {e.note || e.uri}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info footer */}
      {layers.length > 0 && (
        <div className="mt-4 text-xs text-slate-500 text-center">
          Showing {diagram.statements.length} statement{diagram.statements.length !== 1 ? 's' : ''} across {layers.length} layer{layers.length !== 1 ? 's' : ''}
          {diagram.inferences.length > 0 && ` • ${diagram.inferences.length} inference${diagram.inferences.length !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}

// ---------------- Usage Notes ----------------
// 1) Fetch your diagram via: GET /api/arguments/:id?view=diagram
//    then render <DiagramView diagram={data.diagram} /> inside a modal/dialog.
// 2) The component auto-measures and draws smooth connectors from each premise
//    to the conclusion, and adapts on resize.
// 3) Pass onStatementClick to hook into node clicks (e.g., open the source card).
