// components/dialogue/ForceChip.tsx
export function ForceChip({ force, relevance }: { force?: 'ATTACK'|'SURRENDER'|'NEUTRAL', relevance?: 'likely'|'unlikely'|null }) {
  const base = 'px-1 py-0.5 rounded text-[10px] border';
  const cls =
    force === 'ATTACK' ? 'bg-rose-50 border-rose-200 text-rose-700' :
    force === 'SURRENDER' ? 'bg-sky-50 border-sky-200 text-sky-700' :
    'bg-slate-50 border-slate-200 text-slate-700';
  const dim = relevance === 'unlikely' ? 'opacity-50' : '';
  return <span className={`${base} ${cls} ${dim}`}>{force ?? '—'}</span>;
}
