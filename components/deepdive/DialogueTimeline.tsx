// components/deepdive/DialogueTimeline.tsx
'use client';
import { Virtuoso } from 'react-virtuoso';
import useSWR from 'swr';
import { useMemo, useState } from 'react';

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function DialogueTimeline({ deliberationId }: { deliberationId: string }) {
  const [kindSet, setKindSet] = useState<string[]>([]); // unchecked means show all
  const kindsParam = kindSet.length ? `&kinds=${encodeURIComponent(kindSet.join(','))}` : '';
  const { data, isLoading, error, mutate } =
    useSWR<{ items: { ts: string; kind: string; actorId?: string; ref: { type: string; id: string }; meta?: any }[] }>(
      `/api/deliberations/${deliberationId}/timeline?limit=1200${kindsParam}`,
      fetcher,
      { revalidateOnFocus: false }
    );

  const items = useMemo(()=> data?.items ?? [], [data]);

  const toggle = (k: string) =>
    setKindSet(prev => prev.includes(k) ? prev.filter(x=>x!==k) : [...prev, k]);

  return (
    <section className="rounded border bg-white p-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Timeline</div>
        <div className="flex gap-2">
          {['ASSERT','GROUNDS','REBUT_C','REBUT_P','UNDERCUT','APPROVE','SELECT_VIEWPOINTS','PANEL','STATUS'].map(k => (
            <label key={k} className="inline-flex items-center gap-1">
              <input type="checkbox" checked={kindSet.includes(k)} onChange={()=>toggle(k)} />
              {k}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-2 h-56">
        {isLoading ? (
          <div className="text-neutral-500">Loading…</div>
        ) : error ? (
          <div className="text-rose-600">Failed to load timeline.</div>
        ) : (
          <Virtuoso
            data={items}
            itemContent={(i, e) => (
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-neutral-400 w-40">{new Date(e.ts).toLocaleString()}</span>
                <span className="px-1 rounded border">{e.kind}</span>
                <button
                  className="underline"
                  title="Focus node on graph"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('mesh:graph:focusNode', { detail: { id: (e.ref.type === 'edge' ? e.meta?.to : e.ref.id) } }));
                  }}
                >
                  {e.ref.type}:{e.ref.id.slice(0,6)}
                </button>
                {e.actorId && <span className="text-neutral-500">by {e.actorId.slice(0,6)}</span>}
              </div>
            )}
          />
        )}
      </div>
    </section>
  );
}
