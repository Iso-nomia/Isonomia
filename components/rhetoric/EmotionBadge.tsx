'use client';
import * as React from 'react';
import { analyzeLexiconsMany } from './lexiconAnalyzers';

export default function EmotionBadge({ texts }: { texts: string[] }) {
  const memo = React.useMemo(() => analyzeLexiconsMany(texts), [texts]);
  const { affectCounts, valenceScorePer100w } = memo;

  const topEmotion = ['joy','anger','fear','sadness']
    .map(k => ({ k, n: (affectCounts as any)[k] as number }))
    .sort((a,b)=>b.n-a.n)[0];

  return (
    <div className="inline-flex items-center gap-1 rounded border px-2 py-.5 text-[11px] bg-white/70">
      {/* <span className="font-medium">Pathos:</span> */}
      <span title="(positive - negative) per 100 words" className="px-2 py-.5  rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
        Valence {valenceScorePer100w >= 0 ? '+' : ''}{valenceScorePer100w}
      </span>
      <span className="text-neutral-600 py-.5 ">
      · pos {affectCounts.positive} / neg {affectCounts.negative}
      </span>
      {topEmotion && topEmotion.n > 0 && (
        <span className="text-neutral-600 py-.5 ">
          · top emotion: <b>{topEmotion.k}</b> ({topEmotion.n})
        </span>
      )}
    </div>
  );
}
