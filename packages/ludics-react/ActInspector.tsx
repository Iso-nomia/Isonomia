'use client';
import * as React from 'react';

 export function ActInspector(props: { pos?: any; neg?: any; onClose?: () => void; }) {
  const [complete, setComplete] = React.useState(false);
   if (!props.pos && !props.neg) return null;
  
  const Box = ({ label, a }: { label: string; a: any }) => {
    // Phase 8: Extract CQ context from metaJson.aspic
    const aspicMeta = a?.metaJson?.aspic;
    const hasCQContext = aspicMeta && (aspicMeta.cqKey || aspicMeta.cqText);
    
    return (
    <div className="border bg-white rounded p-2 flex-1">
      <div className="text-xs opacity-70 mb-1">{label}</div>
      {a ? (
        <div className="text-sm space-y-1">
          <div><b>polarity:</b> {a.polarity ?? (a.kind === 'DAIMON' ? '†' : '-')}</div>
          <div><b>kind:</b> {a.kind}</div>
          <div><b>locus:</b> {a.locus?.path ?? '(none)'}</div>
          {a.expression && <div><b>expr:</b> {a.expression}</div>}
          {a.isAdditive && <div className="text-amber-700 text-xs">⊕ additive</div>}
          
          {/* Phase 8: CQ Context Tooltip */}
          {hasCQContext && (
            <div className="mt-2 pt-2 border-t border-purple-200 bg-purple-50 rounded p-2 space-y-1">
              <div className="text-[11px] font-semibold text-purple-900 flex items-center gap-1">
                <span className="text-purple-600">❓</span>
                Triggered by Critical Question
              </div>
              {aspicMeta.cqText && (
                <div className="text-[11px] text-purple-800 italic leading-relaxed">
                  "{aspicMeta.cqText}"
                </div>
              )}
              {aspicMeta.cqKey && (
                <div className="text-[10px] text-purple-600 font-mono">
                  {aspicMeta.cqKey}
                </div>
              )}
              <div className="flex gap-2 mt-1">
                {aspicMeta.attackType && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-300">
                    {aspicMeta.attackType}
                  </span>
                )}
                {aspicMeta.targetScope && (
                  <span className="text-[10px] text-purple-600 uppercase tracking-wide">
                    → {aspicMeta.targetScope}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {complete && a.polarity==='O' && (
              <div className="text-[11px] text-indigo-700">
                Completion preview: add (−, {a.locus?.path ?? 'ξ'}, I)·z endings where missing. (Prop. 2.22)
              </div>
            )}
        </div>
      ) : <div className="text-xs opacity-70">—</div>}
    </div>
  );
  };
  return (
    <div className="absolute right-12  w-[520px] max-w-[95vw] bg-indigo-50 shadow-xl panel-edge rounded-lg p-3 space-y-2 z-50">
      <div className="flex items-center justify-between">
        <strong className="text-sm">Act Inspector</strong>
        <button className="text-xs opacity-70" onClick={props.onClose}>close</button>
      </div>
              <div className="text-[11px]">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={complete} onChange={e=>setComplete(e.target.checked)} />
            Preview completion (add missing (−, ξ, I) z)
          </label>
        </div>
      <div className="flex gap-2">{/* side-by-side */}
        <Box  label="Positive (P)" a={props.pos} />
        <Box label="Negative (O)" a={props.neg} />
      </div>
    </div>
  );
}
