// components/rhetoric/MixDebug.tsx
'use client';
import * as React from 'react';
import { explain, featuresFromPipeline } from '@/lib/rhetoric/mlMini';

export function MixDebug({ text, det, nlpHits }: { text: string; det: any; nlpHits?: any[] }) {
  const exp = React.useMemo(() => explain(featuresFromPipeline({ det, nlpHits, text })), [det, nlpHits, text]);
  const top = (arr: any[]) => arr.slice(0, 3).map(d => `${d.feature}×${d.weight.toFixed(2)}=${d.contrib.toFixed(2)}`).join(' • ');
  return (
    <div className="text-[10px] text-neutral-600">
      <div><b>Ethos</b> {top(exp.byClass.ethos)}</div>
      <div><b>Logos</b> {top(exp.byClass.logos)}</div>
      <div><b>Pathos</b> {top(exp.byClass.pathos)}</div>
    </div>
  );
}
