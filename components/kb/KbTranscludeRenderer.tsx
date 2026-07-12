// components/kb/KbTranscludeRenderer.tsx
'use client';
import * as React from 'react';

type Block = { id:string; type:string; dataJson:any; live:boolean };
type Item =
  | { kind:'claim'; id:string; lens?:string; roomId?:string }
  | { kind:'argument'; id:string; lens?:string }
  | { kind:'sheet'; id:string; lens?:string }
  | { kind:'room_summary'; id:string; lens?:string; limit?:number }
  | { kind:'transport'; fromId:string; toId:string; lens?:string }
  | { kind:'theory_work'; id:string; lens?:'summary'|'structure'|'full' }

export function KbTranscludeRenderer({ spaceId, blocks }:{ spaceId:string; blocks:Block[] }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [data, setData]   = React.useState<any[]>([]);

  React.useEffect(() => {
    const req: Item[] = [];
    for (const b of blocks) {
      const d = b.dataJson || {};
      if (b.type === 'claim' && d.id) req.push({ kind:'claim', id:d.id, lens: d.lens, roomId: d.roomId });
      if (b.type === 'argument' && d.id) req.push({ kind:'argument', id:d.id, lens:d.lens });
      if (b.type === 'sheet' && d.id) req.push({ kind:'sheet', id:d.id, lens:d.lens });
      if (b.type === 'room_summary' && d.id) req.push({ kind:'room_summary', id:d.id, lens:d.lens, limit: d.limit ?? 5 });
      if (b.type === 'transport' && d.fromId && d.toId) req.push({ kind:'transport', fromId:d.fromId, toId:d.toId, lens:d.lens ?? 'map' });
      if (b.type === 'theory_work' && b.dataJson?.workId) req.push({ kind:'theory_work', id:b.dataJson.workId, lens:b.dataJson.lens ?? 'summary' });
    }
    setItems(req);
  }, [blocks]);

  React.useEffect(() => {
    if (!items.length) { setData([]); return; }
    (async () => {
      const r = await fetch('/api/kb/transclude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ spaceId, eval: { mode:'product', imports:'off' }, at:null, items })
      });
      const j = await r.json(); setData(j?.items ?? []);
    })();
  }, [spaceId, JSON.stringify(items)]); // serialize to keep it simple

  return (
    <div className="space-y-3">
      {data.map((it, i) => {
        if (!it) return null;
        if (it.kind === 'claim') {
          return (
            <div key={i} className="rounded border p-2">
              <div className="text-sm">{it.data.text}</div>
              <div className="text-xs text-slate-600">bel {Math.round(it.data.bel*100)}% · pl {Math.round(it.data.pl*100)}%</div>
              <ProvenanceChip p={it.provenance} a={it.actions} />
            </div>
          );
        }
        if (it.kind === 'argument') {
          return (
            <div key={i} className="rounded border p-2">
              <div className="text-[13px] font-medium mb-1">Argument diagram</div>
              <pre className="text-xs bg-slate-50 p-2 rounded overflow-auto">{JSON.stringify(it.data.diagram, null, 2)}</pre>
              <ProvenanceChip p={it.provenance} a={it.actions} />
            </div>
          );
        }
        if (it.kind === 'sheet') {
          return (
            <div key={i} className="rounded border p-2">
              <div className="text-[13px] font-medium mb-1">{it.data?.title ?? 'Sheet'}</div>
              <div className="text-xs text-slate-600">nodes {it.data?.nodes?.length ?? 0}</div>
              <ProvenanceChip p={it.provenance} a={it.actions} />
            </div>
          );
        }
        if (it.kind === 'room_summary') {
          return (
            <div key={i} className="rounded border p-2">
              <div className="text-[13px] font-medium mb-1">Top claims</div>
              <ul className="text-sm list-disc ml-4">
                {it.data.claims.map((c:any)=>(
                  <li key={c.id}>{c.text} <span className="text-xs text-slate-500">({Math.round((c.bel ?? c.score)*100)}%)</span></li>
                ))}
              </ul>
              <ProvenanceChip p={it.provenance} a={it.actions} />
            </div>
          );
        }
        if (it.kind === 'transport') {
          return (
            <div key={i} className="rounded border p-2">
              <div className="text-[13px] font-medium mb-1">Room functor map</div>
              <div className="text-xs text-slate-600">pairs {Object.keys(it.data.claimMap ?? {}).length}</div>
              <ProvenanceChip p={it.provenance} a={it.actions} />
            </div>
          );
        }
        if (it.kind === 'theory_work') {
          return (
            <div key={i} className="rounded border p-2">
              <div className="text-[13px] font-medium mb-1">{it.data?.title ?? 'Theory Work'}</div>
              <div className="text-xs text-slate-600">authors {it.data?.authors?.length ?? 0}</div>
              <ProvenanceChip p={it.provenance} a={it.actions} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function ProvenanceChip({ p, a }: { p:any; a:any }) {
  return (
    <div className="mt-2 text-[11px] text-slate-600 flex items-center gap-2">
      <span className="rounded border bg-white px-1.5 py-[1px]">source: {p?.source ?? '—'}</span>
      {a?.openRoom && <a className="underline" href={a.openRoom} target="_blank" rel="noopener noreferrer">open</a>}
      {a?.openSheet && <a className="underline" href={a.openSheet} target="_blank" rel="noopener noreferrer">sheet</a>}
      {a?.openTransport && <a className="underline" href={a.openTransport} target="_blank" rel="noopener noreferrer">transport</a>}
    </div>
  );
}
