'use client';
import * as React from 'react';
type Step = { posActId?: string; negActId?: string; locusPath?: string; ts?: number };



export function TraceRibbon(props: {
  steps?: Step[] | null;
  status?: 'ONGOING'|'CONVERGENT'|'DIVERGENT';
  badges?: Record<number, string>;
  onFocus?: (pairIndex: number) => void;
  focusIndex?: number;
  decisiveIndices?: number[];
  revFailIndices?: number[];
}) {
  const steps: Step[] = Array.isArray(props.steps) ? props.steps : [];
  const status = props.status ?? 'ONGOING';
  const badges = props.badges ?? {};
  const decisive = new Set(props.decisiveIndices ?? []);
  const focus = typeof props.focusIndex === 'number' ? props.focusIndex : -1;
const revFail = new Set(props.revFailIndices ?? []);

  // if (!steps.length) return <div className="text-xs opacity-60">No steps yet.</div>;

  const statusChip =
    status === 'CONVERGENT' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
    status === 'DIVERGENT'  ? 'bg-rose-50 border-rose-200 text-rose-700' :
                               'bg-slate-50 border-slate-200 text-slate-700';

  return (
    <div className="flex flex-wrap items-center gap-2 ">
      {steps.map((s, i) => {
        const hi = decisive.has(i);
        const focused = i === focus;
        return (
          <button
            key={i}
            onClick={() => props.onFocus?.(i)}
            className={[
              'flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition',
              hi ? 'border-green-300 bg-green-50/60' : 'border-slate-200 bg-white/70',
              focused ? 'ring-2 ring-sky-300' : 'hover:bg-white'
            ].join(' ')}
            title={`#${i+1}`}
          >
            <span className="opacity-70">#{i+1}</span>
            <span className="px-1.5 py-0.5 rounded border bg-slate-50">
              P:{s.posActId ? s.posActId.slice(0,4) : '∅'}
            </span>            <span>⇄</span>
            <span className="px-1.5 py-0.5 rounded border bg-slate-50">
               O:{s.negActId ? s.negActId.slice(0,4) : '∅'}
             </span>
             {s.locusPath && (
               <code className="text-[10px] px-1 py-0.5 rounded border bg-white/60">{s.locusPath}</code>
             )}            {badges[i] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-700">
                {badges[i]}
              </span>
            )}
            {/* ⊙ reversible indicator: red if dual(prefix) fails path check */}
              <span
                className={[
                  'text-[10px] px-1.5 py-0.5 rounded border',
                  revFail.has(i) ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                ].join(' ')}
                title={revFail.has(i) ? 'Dual(prefix) is not a path (negative-jump?)' : 'Reversible so far'}
              >
                ⊙
              </span>
          </button>
        );
      })}
      <span className={`ml-2 text-[11px] px-2 py-0.5 rounded border ${statusChip}`}>{status === 'CONVERGENT' ? '† CONVERGENT' : status}</span>
    </div>
  );
}
