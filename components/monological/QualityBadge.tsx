// components/monological/QualityBadge.tsx
'use client';
import * as React from 'react';

export function qualityScore({
  hasUrl, hasDoi, hasNum, hasYear,
  toulmin: { grounds, warrant, claim },
  fallacyCount,
}: {
  hasUrl: boolean; hasDoi: boolean; hasNum: boolean; hasYear: boolean;
  toulmin: { grounds: boolean; warrant: boolean; claim: boolean };
  fallacyCount: number;
}) {
  let s = 0;
  if (grounds) s += 25; if (warrant) s += 25; if (claim) s += 10;
  if (hasUrl) s += 10; if (hasDoi) s += 10; if (hasNum) s += 10; if (hasYear) s += 5;
  s = Math.max(0, s - fallacyCount * 10);
  return Math.max(0, Math.min(100, s));
}

export default function QualityBadge({ score }: { score: number }) {
  const label = score >= 75 ? 'Strong' : score >= 50 ? 'Fair' : 'Weak';
  return (
    <div className={`px-1.5 py-.5  rounded border text-[11px] ${
      score>=75 ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : score>=50 ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
    }`}>
    <span  title={`Monological quality: ${score}/100`}>
      {label} {score}
    </span>
    </div>
  );
}
