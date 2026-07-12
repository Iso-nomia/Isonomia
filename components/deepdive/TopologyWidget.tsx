// components/deepdive/TopologyWidget.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';

type TopicItem = { id: string; label: string; size: number; updatedAt?: string };
type ClustersResponse = { items: TopicItem[] };
type BridgesResponse = { items: Array<{ id: string; expiresAt?: string; status?: string }> };

const fetcher = async (u: string) => {
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
};

export default function TopologyWidget({ deliberationId }: { deliberationId: string }) {
  // Tabs (topic/affinity) – topic default; affinity is future-proof
  const [tab, setTab] = React.useState<'topic' | 'affinity'>('topic');

  const {
    data: clusters,
    isLoading,
    error,
    mutate: mutateClusters,
  } = useSWR<ClustersResponse>(
    `/api/deliberations/${deliberationId}/clusters?type=${tab}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: bridges, mutate: mutateBridges } = useSWR<BridgesResponse>(
    `/api/deliberations/${deliberationId}/bridges`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { data: summary } = useSWR<{ items: Array<{ clusterId: string; cohesion: number; contestation: number; cqCompleteness: number }> }>(
    `/api/deliberations/${deliberationId}/topology/summary`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const metricsById = new Map(summary?.items?.map(i => [i.clusterId, i]) ?? []);
  

  // Active cluster focus state (for chip styling + "Clear")
  const [activeClusterId, setActiveClusterId] = React.useState<string | null>(null);

  // Recompute state
  const [recomputing, setRecomputing] = React.useState(false);
  const [recomputeErr, setRecomputeErr] = React.useState<string | null>(null);

  async function recompute() {
    try {
      setRecomputeErr(null);
      setRecomputing(true);
      const res = await fetch(
        `/api/deliberations/${deliberationId}/clusters/recompute`,
        { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }
      );
      if (!res.ok) throw new Error(await res.text());
      await mutateClusters();
    } catch (e: any) {
      setRecomputeErr(e?.message || 'Failed to recompute');
    } finally {
      setRecomputing(false);
    }
  }

  function focusCluster(clusterId: string) {
    setActiveClusterId(clusterId);
    window.dispatchEvent(
      new CustomEvent('mesh:graph:focusCluster', {
        detail: { deliberationId, clusterId },
      })
    );
  }
  function focusClusterIds(ids: string[]) {
    window.dispatchEvent(new CustomEvent('mesh:graph:focusCluster', { detail: { deliberationId, clusterIds: ids } }));
    window.dispatchEvent(new CustomEvent('mesh:list:filterCluster', { detail: { deliberationId, clusterIds: ids } }));
  }
  
  function onChipClick(e: React.MouseEvent, clusterId: string) {
    if (e.metaKey || e.ctrlKey) {
      if (activeClusterId && activeClusterId !== clusterId) {
        focusClusterIds([activeClusterId, clusterId]);  // pair mode → preview dotted edges
        // keep existing active visually; optionally store pair state if you want a badge
      } else {
        setActiveClusterId(clusterId);
        focusClusterIds([clusterId]);
      }
    } else {
      setActiveClusterId(clusterId);
      focusClusterIds([clusterId]);
    }
  }

  function clearFocus() {
    setActiveClusterId(null);
    window.dispatchEvent(
      new CustomEvent('mesh:graph:focusCluster', {
        detail: { deliberationId, clusterId: '' },
      })
    );
  }

  async function volunteer(bridgeId: string) {
    const key = `/api/deliberations/${deliberationId}/bridges`;
    // optimistic: mark as assigned locally (status not used yet, but future-safe)
    const prev = bridges;
    try {
      await fetch(`/api/bridges/${bridgeId}/assign`, { method: 'POST' });
      await mutateBridges();
    } catch {
      await mutateBridges(prev, { revalidate: false });
    }
  }

  const items = clusters?.items ?? [];
  const updatedAt =
    items.length && items[0].updatedAt
      ? new Date(items[0].updatedAt)
      : null;

  return (
    <section className="relative z-10 rounded border p-3 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Topology</h3>
          <div className="flex items-center rounded border text-[11px] overflow-hidden">
            <button
              className={`px-2 py-0.5 ${tab === 'topic' ? 'bg-slate-100 font-medium' : ''}`}
              onClick={() => setTab('topic')}
              aria-pressed={tab === 'topic'}
            >
              Topic
            </button>
            <button
              className={`px-2 py-0.5 border-l ${tab === 'affinity' ? 'bg-slate-100 font-medium' : ''}`}
              onClick={() => setTab('affinity')}
              aria-pressed={tab === 'affinity'}
            >
              Affinity
            </button>
          </div>
          {updatedAt && (
            <span className="text-[11px] text-neutral-500">
              Updated {timeAgo(updatedAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeClusterId && (
            <button
              className="text-xs px-2 py-0.5 border rounded"
              onClick={clearFocus}
              title="Clear cluster focus"
            >
              Clear focus
            </button>
          )}
          <button
            className="text-xs px-2 py-0.5 border rounded disabled:opacity-50"
            onClick={recompute}
            disabled={recomputing}
            aria-busy={recomputing}
            title="Recompute topic clusters"
          >
            {recomputing ? 'Recomputing…' : 'Recompute'}
          </button>
        </div>
      </div>

      {/* Status row */}
      {isLoading && <div className="text-xs text-neutral-500">Loading clusters…</div>}
      {error && (
        <div className="text-xs text-rose-600">
          Failed to load clusters.
        </div>
      )}
      {recomputeErr && (
        <div className="text-xs text-rose-600">
          {recomputeErr}
        </div>
      )}
      {!isLoading && !error && !items.length && (
        <div className="text-xs text-neutral-500">No clusters yet.</div>
      )}

      {/* Chips */}
      {!!items.length && (
        <div className="flex flex-wrap gap-2">
          {items.map((c) => {
  const m = metricsById.get(c.id);
  const coh = m ? Math.round(m.cohesion * 100) : null;
  const con = m ? Math.round(m.contestation * 100) : null;
  const cq  = m ? Math.round(m.cqCompleteness * 100) : null;
  const active = c.id === activeClusterId;
  return (
    <button
      key={c.id}
      className={['px-2 py-1 rounded-full border text-xs', active ? 'bg-slate-100 border-slate-400' : 'hover:bg-slate-50'].join(' ')}
      // onClick={() => focusCluster(c.id)}
      onClick={(e)=>onChipClick(e, c.id)}

      aria-pressed={active}
      title="Focus this cluster on the graph"
    >
      {c.label}{' '}
      <span className="text-neutral-500">· {c.size}</span>
      {m && (
        <span className="ml-2 text-[10px] text-neutral-600">
          coh {coh}% · cont {con}% · CQ {cq}%
        </span>
      )}
    </button>
  );
})}
        </div>
      )}

      {/* Bridges (optional) */}
      {!!bridges?.items?.length && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-neutral-700 mb-1">Bridges</div>
          <ul className="text-xs space-y-1">
            {bridges.items.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>
                  Request {b.id.slice(0, 6)} · due{' '}
                  {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : '—'}
                </span>
                <button
                  className="px-2 py-0.5 border rounded"
                  onClick={() => volunteer(b.id)}
                  title="Volunteer for this bridge"
                >
                  Volunteer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[11px] text-neutral-500 mt-2">
        Aggregated views only; identities are not shown.
      </div>
    </section>
  );
}

function timeAgo(d: Date) {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
