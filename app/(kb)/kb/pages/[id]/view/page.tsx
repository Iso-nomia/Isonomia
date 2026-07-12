'use client';
import * as React from 'react';
import useSWR from 'swr';
import { KbBlockRenderer } from '@/components/kb/KbBlockRenderer';

const fetcher = (u:string) => fetch(u, { cache:'no-store' }).then(r => r.json());

export default function KbPageView({ params }: { params: { id: string } }) {
  const { data: meta } = useSWR(`/api/kb/pages/${params.id}`, fetcher);
  const { data: blk }  = useSWR(`/api/kb/pages/${params.id}/blocks`, fetcher);

  const [hydrated, setHydrated] = React.useState<any[]|null>(null);
  const [err, setErr] = React.useState<string|undefined>();
// add this handler inside component:
async function togglePin(block:any, env:any) {
  if (!meta?.page?.canEdit) return alert('No edit permission');
  const nextLive = block.live === false; // unpin -> live, pin -> frozen
  const payload: any = { live: nextLive };
  if (!nextLive) payload.pinnedJson = env; else payload.pinnedJson = null;
  await fetch(`/api/kb/blocks/${block.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  // re-hydrate
  setHydrated(null);
}
  React.useEffect(() => {
    (async () => {
      setErr(undefined);
      if (!meta?.page?.spaceId || !Array.isArray(blk?.blocks)) return;

      const blocks = blk.blocks as any[];
      // 1) Pre-allocate output array aligned with blocks
      const out: any[] = new Array(blocks.length).fill(null);

      // 2) Collect structured items and remember their target indices
      type Item =
        | { kind:'claim'; id:string; lens?:string; roomId?:string }
        | { kind:'argument'; id:string; lens?:string }
        | { kind:'sheet'; id:string; lens?:string }
        | { kind:'room_summary'; id:string; lens?:string; limit?:number }
        | { kind:'transport'; fromId:string; toId:string; lens?:string };

      const items: Item[] = [];
      const mapIdx: number[] = []; // items[i] belongs to blocks[ mapIdx[i] ]

      blocks.forEach((b, i) => {
        const d = b?.dataJson ?? {};
        // If the block is pinned and has pinnedJson, use it directly.
        if (b.live === false && b.pinnedJson) {
          out[i] = b.pinnedJson;
          return;
        }

        
        // Structured kinds → push valid items; text/image/link are rendered locally
        if (b.type === 'claim' && typeof d.id === 'string' && d.id.length >= 6) {
          items.push({ kind:'claim', id:d.id, lens:d.lens ?? 'belpl', roomId:d.roomId });
          mapIdx.push(i);
        } else if (b.type === 'argument' && typeof d.id === 'string' && d.id.length >= 6) {
          items.push({ kind:'argument', id:d.id, lens:d.lens ?? 'diagram' });
          mapIdx.push(i);
        } else if (b.type === 'sheet' && typeof d.id === 'string' && d.id.length >= 6) {
          items.push({ kind:'sheet', id:d.id, lens:d.lens ?? 'nodes' });
          mapIdx.push(i);
        } else if (b.type === 'room_summary' && typeof d.id === 'string' && d.id.length >= 6) {
          items.push({ kind:'room_summary', id:d.id, lens:d.lens ?? 'top_claims', limit: d.limit ?? 5 });
          mapIdx.push(i);
      
        } 
          // NEW
  else if (b.type === 'theory_work' && typeof d.workId === 'string') {
    items.push({ kind:'theory_work', id:d.workId, lens: d.lens ?? 'summary' } as any);
    mapIdx.push(i);
    return;
  }

        else if (b.type === 'transport' && typeof d.fromId === 'string' && typeof d.toId === 'string'
                    && d.fromId.length >= 6 && d.toId.length >= 6) {
          items.push({ kind:'transport', fromId:d.fromId, toId:d.toId, lens:d.lens ?? 'map' });
          mapIdx.push(i);
        }
        // text/image/link → no transclusion request
      });

      // Nothing to fetch? we’re done.
      if (items.length === 0) { setHydrated(out); return; }

      // 3) Call transclude and place results back in their original indices
      const res = await fetch('/api/kb/transclude', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          spaceId: meta.page.spaceId,
          eval: (meta.page.frontmatter?.eval ?? { mode:'product', imports:'off' }),
          at: null,
          items
        })
      });

      
      const j = await res.json();
      if (!res.ok || j?.error) {
        setErr(j?.error || `HTTP ${res.status}`);
        setHydrated(out);
        return;
      }
      const arr = Array.isArray(j.items) ? j.items : [];
      arr.forEach((env:any, k:number) => { out[mapIdx[k]] = env; });
      setHydrated(out);
    })().catch(e => setErr(String(e)));
  }, [meta, blk]);

  if (!meta || !blk) return <div className="p-6 text-sm text-slate-600">Loading page…</div>;
  if (err) return <div className="p-6 text-sm text-rose-600">Failed to load: {err}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{meta.page.title}</h1>
        {!!meta.page.summary && <p className="text-slate-600">{meta.page.summary}</p>}
      </div>

      <div className="space-y-4">
        {(blk.blocks || []).map((b:any, i:number) => (
          <KbBlockRenderer key={b.id} block={b} hydrated={hydrated?.[i] ?? null} />
        ))}
      </div>
    </div>
  );
}
