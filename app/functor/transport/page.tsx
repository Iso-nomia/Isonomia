'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';

type Mapping = {
  id: string | null;
  fromRoomId: string;
  toRoomId: string;
  claimMapJson: Record<string, string> | null;
  notes?: string | null;
};

type Proposal = {
  fingerprint: string;
  previewText?: string | null;
  base?: number | null;
  fromArgumentId?: string | null;
  fromClaimId?: string | null;
  toClaimId?: string | null;
  premiseCount?: number;
  premiseChain?: string[];
};

type ApiOk = { ok?: boolean };
type MappingResponse = ApiOk & { mapping?: Mapping | null; error?: string | null };
type SuggestResponse = ApiOk & { claimMap?: Record<string, string> | null; error?: string | null };
type PreviewResponse = ApiOk & { proposals?: Proposal[] | null; error?: string | null };
type ApplyResponse = ApiOk & { applied?: number; skipped?: number; error?: string | null };

const fetcher = async <T,>(u: string): Promise<T | { error: string }> => {
  try {
    const r = await fetch(u);
    if (!r.ok) return { error: `HTTP ${r.status}` };
    // tolerate empty bodies
    const text = await r.text();
    if (!text) return {} as T;
    try { return JSON.parse(text) as T; }
    catch { return { error: 'Invalid JSON' }; }
  } catch (e: any) {
    return { error: e?.message || 'Network error' };
  }
};

// tiny utils
const isObj = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

const coerceClaimMap = (x: unknown): Record<string, string> => {
  if (!isObj(x)) return {};
  const entries = Object.entries(x).filter(
    ([k, v]) => typeof k === 'string' && typeof v === 'string' && k && v
  ) as [string, string][];
  return Object.fromEntries(entries);
};

const safeSlice = (s?: string | null, n = 8) =>
  typeof s === 'string' ? s.slice(0, n) : '—';

function TransportPageInner() {
  const params = useSearchParams();
  const fromId = params?.get('from') ?? '';
  const toId = params?.get('to') ?? '';

  const swrKey = fromId && toId ? `/api/room-functor/map?from=${fromId}&to=${toId}` : null;
  const {
    data: mappingDataRaw,
    mutate: refetchMap,
    isLoading: isMapLoading,
  } = useSWR<MappingResponse>(swrKey, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const mappingError = (mappingDataRaw as any)?.error as string | undefined;
  const mapping = (mappingDataRaw && 'mapping' in mappingDataRaw ? mappingDataRaw.mapping : null) ?? null;

  const claimMap = React.useMemo(
    () => coerceClaimMap(mapping?.claimMapJson ?? {}),
    [mapping]
  );

  const [proposals, setProposals] = React.useState<Proposal[] | null>(null);
  const [busySuggest, setBusySuggest] = React.useState(false);
  const [busyPreview, setBusyPreview] = React.useState(false);
  const [busyApply, setBusyApply] = React.useState(false);
  const [note, setNote] = React.useState<string>('');
  const [err, setErr] = React.useState<string>('');
  const [depth, setDepth] = React.useState<number>(1);


const { data: fromNames } = useSWR<{ names?: Record<string, string> | null } & { error?: string }>(
  fromId ? `/api/room-functor/claims?room=${encodeURIComponent(fromId)}` : null,
  fetcher,
  { revalidateOnFocus: false }
);
const { data: toNames } = useSWR<{ names?: Record<string, string> | null } & { error?: string }>(
  toId ? `/api/room-functor/claims?room=${encodeURIComponent(toId)}` : null,
  fetcher,
  { revalidateOnFocus: false }
);
const nameOfFrom = React.useCallback((cid?:string|null) =>
  (fromNames?.names?.[cid ?? ''] as string|undefined) ?? '', [fromNames]);
const nameOfTo = React.useCallback((cid?:string|null) =>
  (toNames?.names?.[cid ?? ''] as string|undefined) ?? '', [toNames]);

const [showIds, setShowIds] = React.useState(false);


  // reset proposals when room pair changes
  React.useEffect(() => {
    setProposals(null);
    setNote('');
    setErr('');
  }, [fromId, toId]);

  async function suggest() {
    if (!fromId || !toId) return;
    setBusySuggest(true);
    setErr('');
    setNote('');
    try {
      const r = await fetch('/api/room-functor/suggest-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId }),
      });
      const text = await r.text();
      const j: SuggestResponse = text ? JSON.parse(text) : {};
      if (!r.ok || (j && j.error)) {
        setErr(j?.error || `HTTP ${r.status}`);
        return;
      }
      const suggested = coerceClaimMap(j?.claimMap ?? {});
      // merge suggestion into current map
      const mergeRes = await fetch('/api/room-functor/transport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, claimMap: suggested, merge: true }),
      });
      if (!mergeRes.ok) {
        setErr(`Transport merge failed: HTTP ${mergeRes.status}`);
        return;
      }
      await refetchMap();
      setNote('Mapping updated from overlaps.');
    } catch (e: any) {
      setErr(e?.message || 'Suggest failed');
    } finally {
      setBusySuggest(false);
    }
  }

  async function preview() {
    if (!fromId || !toId) return;
    setBusyPreview(true);
    setErr('');
    setNote('');
    try {
      const r = await fetch('/api/room-functor/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, claimMap, depth }),
      });
      const text = await r.text();
      const j: PreviewResponse = text ? JSON.parse(text) : {};
      if (!r.ok || j?.error) {
        setErr(j?.error || `HTTP ${r.status}`);
        setProposals(null);
        return;
      }
      setProposals(Array.isArray(j?.proposals) ? j!.proposals! : []);
      if (!j?.proposals?.length) setNote('No proposals were generated.');
    } catch (e: any) {
      setErr(e?.message || 'Preview failed');
      setProposals(null);
    } finally {
      setBusyPreview(false);
    }
  }

  async function apply() {
    if (!fromId || !toId) return;
    if (!proposals?.length) {
      setNote('Nothing to apply.');
      return;
    }
    setBusyApply(true);
    setErr('');
    setNote('');
    try {
      const r = await fetch('/api/room-functor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId, toId, proposals, claimMap, depth }),
      });
      const text = await r.text();
      const j: ApplyResponse = text ? JSON.parse(text) : {};
      if (!r.ok || j?.error) {
        setErr(j?.error || `HTTP ${r.status}`);
        return;
      }
      const applied = j?.applied ?? 0;
      const skipped = j?.skipped ?? 0;
      setNote(`Applied ${applied} (skipped ${skipped}).`);
    } catch (e: any) {
      setErr(e?.message || 'Apply failed');
    } finally {
      setBusyApply(false);
    }
  }

  if (!fromId || !toId) {
    return <div className="p-3 text-sm text-red-600">Missing <code>?from=&to=</code></div>;
  }

  const anyBusy = busySuggest || busyPreview || busyApply;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <h1 className="text-lg font-semibold">Transport (Room Functor)</h1>
      <div className="text-xs text-slate-600">
        from <code>{fromId}</code> → to <code>{toId}</code>
      </div>

      {(mappingError || err) && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
          {mappingError || err}
        </div>
      )}
      {note && !err && (
        <div className="rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
          {note}
        </div>
      )}

      <div className="rounded border p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="font-medium text-sm">Claim map</div>
          <button
            type="button"
            className="text-xs underline disabled:opacity-50"
            onClick={suggest}
            disabled={anyBusy || isMapLoading}
            title="Infer a mapping from overlaps"
          >
            {busySuggest ? 'Suggesting…' : 'Suggest from overlaps'}
          </button>
            <label className="ml-auto text-[11px] inline-flex items-center gap-1">
    <input type="checkbox" className="accent-slate-600" checked={showIds}
           onChange={(e)=>setShowIds(e.target.checked)} />
    Show IDs
  </label>
        </div>

        <ul className="text-sm space-y-1">
  {Object.keys(claimMap).length ? (
    Object.entries(claimMap).map(([fromClaimId, toClaimId]) => {
      const ftxt = nameOfFrom(fromClaimId) || '(no text)';
      const ttxt = nameOfTo(toClaimId)     || '(no text)';
      return (
        <li key={fromClaimId} className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="min-w-0">
            <div className="truncate" title={ftxt}>{ftxt}</div>
            {showIds && <div className="text-[11px] text-slate-500 font-mono truncate">{fromClaimId}</div>}
          </div>
          <div className="text-slate-400">→</div>
          <div className="min-w-0">
            <div className="truncate" title={ttxt}>{ttxt}</div>
            {showIds && <div className="text-[11px] text-slate-500 font-mono truncate">{toClaimId}</div>}
          </div>
        </li>
      );
    })
  ) : (
    <li className="text-xs text-slate-500">
      {isMapLoading ? 'Loading…' : 'No mappings yet. Click “Suggest”.'}
    </li>
  )}
</ul>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Depth:</label>
          <select 
            value={depth} 
            onChange={(e) => setDepth(Number(e.target.value))}
            className="px-2 py-1 border rounded text-sm"
            disabled={anyBusy}
          >
            <option value={1}>1 (no premises)</option>
            <option value={2}>2 (include premises)</option>
            <option value={3}>3 (recursive premises)</option>
          </select>
        </div>
        <button
          type="button"
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={preview}
          disabled={busyPreview || isMapLoading}
        >
          {busyPreview ? 'Previewing…' : 'Preview'}
        </button>
        <button
          type="button"
          className="px-2 py-1 border rounded disabled:opacity-50"
          onClick={apply}
          disabled={busyApply || !proposals?.length}
          title={!proposals?.length ? 'Run Preview first to generate proposals' : undefined}
        >
          {busyApply ? 'Applying…' : 'Apply'}
        </button>
      </div>

      <div className="rounded border p-3">
        <div className="font-medium text-sm mb-2">Proposed imports</div>
        <ul className="text-sm space-y-2">
          
{proposals?.length ? (
  proposals.map((p) => {
    const leftTxt  = nameOfFrom(p.fromClaimId) || "";
    const rightTxt = nameOfTo(p.toClaimId)     || "";
    const hasPremises = (p.premiseCount ?? 0) > 0;
    return (
      <li key={p.fingerprint} className="border rounded px-2 py-1">
        <div className="text-[13px]">{p.previewText || "(no preview)"}</div>
        
    <div className="text-[11px] text-slate-500">
  arg:{p.fromArgumentId ? p.fromArgumentId.slice(0,8) : "—"}… · {Math.round((p.base ?? 0)*100)}% ·
  φ:{leftTxt ? `"${leftTxt.slice(0,60)}"` : (p.fromClaimId ? p.fromClaimId.slice(0,6)+'…' : "—")} → φ′:{rightTxt ? `"${rightTxt.slice(0,60)}"` : (p.toClaimId ? p.toClaimId.slice(0,6)+'…' : "—")}
</div>
        {hasPremises && (
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
            <span className="font-medium">📊 Composition:</span>
            <span>{p.premiseCount} premise{(p.premiseCount ?? 0) > 1 ? 's' : ''} will be imported recursively</span>
          </div>
        )}
      </li>
    );
  })
) : (
            <li className="text-xs text-slate-500">
              {busyPreview ? 'Computing…' : 'No proposals yet.'}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary to avoid de-opting the whole
// page during static prerender.
export default function TransportPage() {
  return (
    <React.Suspense fallback={null}>
      <TransportPageInner />
    </React.Suspense>
  );
}
