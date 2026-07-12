'use client';
import * as React from 'react';
import { analyzeLexiconsMany } from './lexiconAnalyzers';

export default function FrameChips({ texts }: { texts: string[] }) {
  const memo = React.useMemo(() => analyzeLexiconsMany(texts), [texts]);
  const { topFrames, frameCounts, words } = memo;

  if (!topFrames.length) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      {topFrames.map(f => (
        <span
          key={f.key}
          className="text-[11px] px-2 py-0.5 rounded border bg-blue-50 border-blue-200 text-blue-700 bg-white/70"
          title={`${f.count} matches in sample (~${Math.round((f.count/words)*10000)/100} / 100w)`}
        >
          {labelFor(f.key)} {f.count}
        </span>
      ))}
    </div>
  );
}

function labelFor(k: string) {
  switch (k) {
    case 'economic': return 'Economic';
    case 'morality': return 'Morality';
    case 'security': return 'Security';
    case 'fairness': return 'Fairness';
    case 'capacity': return 'Capacity';
    default: return k;
  }
}
