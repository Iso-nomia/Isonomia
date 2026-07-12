
'use client';
export default function CQBar({ satisfied, required, compact = false }: { satisfied: number; required: number; compact?: boolean }) {
  const pct = required ? Math.round((satisfied / required) * 100) : 0;
  return (
    <div className={compact ? 'w-32' : 'w-full gap-2 mb-2'}>
         <div className={compact ? '' : 'gap-2'}>

      <div className="text-[11px] text-neutral-600 ">
        CQ: {satisfied}/{required} ({pct}%)
      </div>
      <hr className="h-1 border-transparent py-.5"></hr>
      <div className="h-1.5 bg-slate-200 rounded">
        <div className="h-1.5 bg-emerald-400 rounded" style={{ width: `${pct}%` }} />
      </div>
      </div>
    </div>
  );
}
