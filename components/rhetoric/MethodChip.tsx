// components/rhetoric/MethodChip.tsx
'use client';
import * as React from 'react';
import { analyzeText } from './detectors';

export default function MethodChip({ text, className }: { text: string; className?: string }) {
  const { top, counts } = React.useMemo(() => {
    const a = analyzeText(text || '');
    const d = a.counts['inference-deductive'] || 0;
    const i = a.counts['inference-inductive'] || 0;
    const ab = a.counts['inference-abductive'] || 0;
    let top: 'D'|'I'|'A'|null = null;
    if (d || i || ab) {
      if (d >= i && d >= ab) top = 'D';
      else if (i >= d && i >= ab) top = 'I';
      else top = 'A';
    }
    return { top, counts: { d, i, ab } };
  }, [text]);

  if (!top) return null;
  const label = top === 'D' ? 'Deductive' : top === 'I' ? 'Inductive' : 'Abductive';
  const color = top === 'D' ? 'bg-green-50 border-green-200 text-green-700'
              : top === 'I' ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-sky-50 border-sky-200 text-sky-700';

  return (
    <span
      title={`D:${counts.d} I:${counts.i} A:${counts.ab}`}
      className={`px-1.5 py-0.5 rounded border text-[10px] ${color} ${className ?? ''}`}
    >
      {label}
    </span>
  );
}
