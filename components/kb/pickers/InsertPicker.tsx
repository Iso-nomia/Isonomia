// components/kb/pickers/InsertPicker.tsx
'use client';
import * as React from 'react';

export function InsertPicker({
  open, onClose, kind, spaceId, onPick
}:{
  open:boolean; onClose:()=>void; kind:'claim'|'argument'|'room'|'sheet'; spaceId:string;
  onPick:(item:any)=>void
}) {
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!open || !q.trim()) { setItems([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/kb/find?kind=${kind}&q=${encodeURIComponent(q)}&spaceId=${spaceId}`);
      const j = await res.json(); setItems(j?.items ?? []);
    }, 180);
    return () => clearTimeout(t);
  }, [open, q, kind, spaceId]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div className="mx-auto mt-24 max-w-lg rounded-lg border bg-white p-3 shadow" onClick={e=>e.stopPropagation()}>
        <div className="mb-2 text-sm font-medium">Insert {kind}</div>
        <input
          value={q} onChange={e=>setQ(e.target.value)}
          placeholder={`Search ${kind}s…`} className="w-full rounded border px-2 py-1 text-sm"
        />
        <ul className="mt-2 max-h-64 overflow-auto divide-y">
          {items.map((it:any)=>(
            <li key={it.id} className="py-2 px-1 hover:bg-slate-50 cursor-pointer"
                onClick={()=>{ onPick(it); onClose(); }}>
              <div className="text-sm">{it.title || it.text || it.id}</div>
              <div className="text-[11px] text-slate-500">{it.id}</div>
            </li>
          ))}
          {q && items.length===0 && <li className="py-4 text-xs text-slate-500">No results.</li>}
        </ul>
      </div>
    </div>
  );
}
