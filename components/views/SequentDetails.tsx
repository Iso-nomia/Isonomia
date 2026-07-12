'use client';
import React, { useMemo } from 'react';
import { useSequentStatus } from './useSequentStatus';
import { legalAttacksFor } from '@/lib/dialogue/legalAttackCuesFor';

export function SequentDetails({
  gammaTexts, deltaTexts, onInsertTemplate,
}: {
  gammaTexts: string[];
  deltaTexts: string[];
  onInsertTemplate?: (s: string) => void;
}) {
  const { sequent } = useSequentStatus({ gammaTexts, deltaTexts });

  const weakest = useMemo(() => {
    let min = 2, idx = -1;
    sequent.perDelta.forEach((d, i) => { if (d.entail < min) { min = d.entail; idx = i; } });
    return idx >= 0 ? { idx, d: sequent.perDelta[idx] } : null;
  }, [sequent]);

  if (!weakest) return null;
  const delta = deltaTexts[weakest.idx];
  const suggest = legalAttacksFor(delta); // often picks conditional/quantifier “ask antecedent/instantiate” etc.

  return (
    <div className="mt-2 border rounded p-2 bg-white">
      <div className="text-xs mb-1">
        Weakest conclusion: <b>{delta.slice(0, 160)}</b>
        <span className="ml-2 text-neutral-600">entail {(weakest.d.entail*100).toFixed(0)}%</span>
      </div>
      <div className="text-[11px] text-neutral-700">
        Suggested follow‑ups:
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <button className="px-2 py-0.5 border rounded text-[11px]"
          onClick={() => onInsertTemplate?.(`WHY ${delta}? Please supply the missing premise.`)}>
          Ask WHY δ
        </button>
        {suggest.options.map(o => (
          <button key={o.key} className="px-2 py-0.5 border rounded text-[11px]"
            onClick={() => onInsertTemplate?.(o.template)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
