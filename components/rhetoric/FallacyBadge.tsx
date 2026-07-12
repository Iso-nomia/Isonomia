// components/rhetoric/FallacyBadge.tsx
'use client';
import * as React from 'react';
import { FALLACY_LEX, FallacyKey } from '@/lib/rhetoric/fallacies';

const RX = Object.fromEntries(
  (Object.keys(FALLACY_LEX) as FallacyKey[]).map(k => [
    k,
    new RegExp(`\\b(?:${FALLACY_LEX[k].map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`,'i')
  ])
) as Record<FallacyKey, RegExp>;

export function FallacyBadge({ text }: { text: string }) {
  const hits = (Object.keys(RX) as FallacyKey[]).filter(k => RX[k].test(text));
  if (!hits.length) return null;
  const label = hits.map(h =>
    h === 'ad_hominem' ? 'Ad hominem' :
    h === 'whataboutism' ? 'Whataboutism' :
    h === 'strawman' ? 'Straw man' :
    'Slippery slope'
  ).join(' • ');
  return <span className="px-1.5 py-0.5 rounded border bg-rose-50 border-rose-200 text-rose-700 text-[10px]">{label}</span>;
}
