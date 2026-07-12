// components/kb/EntityPicker.tsx
'use client';
import * as React from 'react';

type Kind = 'claim'|'argument'|'room'|'sheet'|'theory_work'|'scheme';
type Item = { id:string; label:string; roomId?:string };

export function EntityPicker({
  kind, open, onClose, onPick
}: { kind:Kind; open:boolean; onClose:()=>void; onPick:(it:Item)=>void }) {
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await fetch(`/api/kb/entity-search?k=${kind}&q=${encodeURIComponent(q)}`);
      const j = await r.json().catch(()=>({items:[]}));
      setItems(Array.isArray(j.items) ? j.items : []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [open, q, kind]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex items-start justify-center p-6" onClick={onClose}>
      <div className="min-w-[460px] rounded-lg border bg-white shadow-xl" onClick={e=>e.stopPropagation()}>
        <div className="border-b px-3 py-2 text-sm font-medium">Insert {kind}</div>
        <div className="p-3">
          <input
            autoFocus value={q} onChange={e=>setQ(e.target.value)}
            placeholder={`Search ${kind}s…`}
            className="w-full rounded border px-2 py-1 text-sm"
          />
          <div className="mt-2 max-h-72 overflow-auto">
            {loading && <div className="text-xs text-slate-500 p-2">Searching…</div>}
            {!loading && items.length===0 && <div className="text-xs text-slate-500 p-2">No results</div>}
            <ul className="divide-y">
              {items.map(it => (
                <li key={it.id}>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={()=>{ onPick(it); onClose(); }}
                  >
                    <div className="truncate">{it.label || it.id}</div>
                    <div className="text-[11px] text-slate-500">{it.id}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-2 flex justify-end">
            <button className="text-sm px-3 py-1 rounded border" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
