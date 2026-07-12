//components/SchemeComposerPicker.tsx

'use client';
import * as React from 'react';

type Kind = 'claim'|'argument'|'room'|'sheet';
type Item = { id:string; label:string; roomId?:string };

export function SchemeComposerPicker({
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
    <div className="fixed inset-0 z-50  flex items-start justify-center p-6" onClick={onClose}>
      <div className="min-w-[460px] p-3 rounded-lg border border-indigo-200 bg-slate-100 shadow-xl" onClick={e=>e.stopPropagation()}>
        <div className="border-b px-3 py-2 text-md font-medium">Insert {kind}</div>
        <div className=" bg-white rounded-lg border-slate-300 border p-3">
          <input
            autoFocus value={q} onChange={e=>setQ(e.target.value)}
            placeholder={`Search ${kind}s…`}
            className="w-full rounded border px-2 py-2 text-sm articlesearchfield"
          />
          <div className="mt-2 max-h-72 overflow-auto ">
            {loading && <div className="text-xs text-slate-500 p-2">Searching…</div>}
            {!loading && items.length===0 && <div className="text-xs text-slate-500 p-2">No results</div>}
            <ul className="divide-y">
              {items.map(it => (
                <li key={it.id}>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                    onClick={()=>{ onPick(it); onClose(); }}
                  >
                    <div className="truncate">{it.label || it.id}</div>
                    <div className="text-[11px] text-slate-500">{it.id}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-2  flex justify-end ">
            <button className="text-xs   tracking-wide px-5 py-2 btnv2 border border-indigo-500 rounded-lg outline-indigo-100
             bg-slate-200" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
