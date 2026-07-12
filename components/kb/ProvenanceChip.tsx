// // components/kb/ProvenanceChip.tsx
// 'use client';
// import * as React from 'react';
// import clsx from 'clsx';

// export function ProvenanceChip({
//   source,
//   updated,
//   mode,
//   tau,
//   href,
//   pinnedAt,
//   className,
// }: {
//   source: string;          // e.g., "deliberation", "argument", "sheet", "room_functor"
//   updated?: string | null; // ISO
//   mode?: 'product'|'min'|'ds';
//   tau?: number | null;
//   href?: string;
//   pinnedAt?: string | null;
//   className?: string;
// }) {
//   const parts = [
//     source,
//     ...(mode ? [mode] : []),
//     ...(tau!=null ? [`τ=${tau}`] : []),
//     ...(pinnedAt ? [`pinned ${new Date(pinnedAt).toLocaleDateString()}`] : []),
//     ...(updated ? [`updated ${new Date(updated).toLocaleDateString()}`] : []),
//   ].filter(Boolean);

//   const inner = (
//     <span
//       className={clsx(
//         'inline-flex items-center gap-1 text-[11px] px-1.5 py-[2px] rounded border bg-white/70',
//         pinnedAt ? 'border-amber-300 text-amber-700' : 'border-slate-200 text-slate-700',
//         className
//       )}
//     >
//       <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500" />
//       {parts.join(' • ')}
//     </span>
//   );

//   return href ? (
//     <a href={href} target="_blank" rel="noopener noreferrer">
//       {inner}
//     </a>
//   ) : inner;
// }

// components/kb/ProvenanceChip.tsx

'use client';
import React from "react";

export function ProvenanceChip({
  item, blockId, canToggle
}: { item:any; blockId?:string; canToggle?:boolean }) {
  const live = item?.live !== false;
  const [busy, setBusy] = React.useState(false);
  async function togglePin() {
    if (!blockId) return;
    setBusy(true);
    // fetch current env for pin if going live→pinned
    let pinnedJson:any = null;
    if (live) {
      const one = Array.isArray(item) ? item[0] : item;
      pinnedJson = one || null;
    }
    const r = await fetch(`/api/kb/blocks/${blockId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(live ? { live:false, pinnedJson } : { live:true, pinnedJson:null })
    });
    setBusy(false);
    if (!r.ok) alert('Pin/unpin failed');
  }

  return (
    <div className="inline-flex items-center gap-2 text-[11px] text-slate-700">
      <span className="rounded border bg-white/70 px-1.5 py-[1px]">{live ? 'live' : 'pinned'}</span>
      <span className="text-slate-500">•</span>
      <span>{item?.provenance?.source ?? '—'}</span>
      {canToggle && blockId && (
        <>
          <span className="text-slate-500">•</span>
          <button className="underline disabled:opacity-50" disabled={busy} onClick={togglePin}>
            {busy ? '…' : (live ? 'Pin here' : 'Unpin')}
          </button>
        </>
      )}
    </div>
  );
}
