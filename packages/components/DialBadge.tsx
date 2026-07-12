'use client';
import * as React from 'react';

export function DialBadge({ stats, targetType, targetId }:{
  stats: Record<string, { openWhy:number; resolved:number; avgHoursToGrounds:number|null; dialScore:number }>;
  targetType: 'argument'|'claim';
  targetId: string;
}) {
  const s = stats?.[`${targetType}:${targetId}`];
  if (!s) return null;
  let tone = 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (s.dialScore < 0.66) tone = 'bg-amber-50 border-amber-200 text-amber-700';
  if (s.dialScore < 0.33) tone = 'bg-rose-50 border-rose-200 text-rose-700';
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${tone}`}
      title={`Open WHY: ${s.openWhy} · Resolved: ${s.resolved} · t→grounds: ${s.avgHoursToGrounds ?? '—'}h`}>
      Manifest ✓ {Math.round(s.dialScore*100)}%
    </span>
  );
}
