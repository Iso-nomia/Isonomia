// components/practical/PracticalSummary.tsx
'use client';
import * as React from 'react';

export default function PracticalSummary({ workId, className='' }:{
  workId: string; className?: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any>(null);

  // NEW: we need the deliberationId for candidate fetch
  const [deliberationId, setDeliberationId] = React.useState<string | null>(null);
  const [alts, setAlts] = React.useState<{id:string; title:string; theoryType:string}[]>([]);
  const [pick, setPick] = React.useState('');

  // load practical summary
  React.useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const [metaRes, pracRes] = await Promise.all([
          fetch(`/api/works/${workId}`, { cache: 'no-store' }),            // GET { ok:true, work:{ deliberationId,... } }
          fetch(`/api/works/${workId}/practical`, { cache: 'no-store' }),
        ]);
        const meta = metaRes.ok ? await metaRes.json() : null;
        const j    = await pracRes.json();
        if (abort) return;
        setDeliberationId(meta?.work?.deliberationId ?? null);
        setData(j?.justification ?? null);
      } catch (e) {
        console.error('summary load failed', e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [workId]);

  // load IH/TC candidates for “Compare vs…”
  React.useEffect(() => {
    if (!deliberationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/works?deliberationId=${encodeURIComponent(deliberationId)}`, { cache:'no-store' });
        const j = await res.json();
        if (cancelled) return;
        setAlts((j.works ?? []).filter((w:any) => w.theoryType==='IH' || w.theoryType==='TC'));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [deliberationId]);

  if (loading) return <div className={`text-xs text-neutral-500 ${className}`}>Loading…</div>;
  if (!data)   return <div className={`text-xs text-neutral-500 ${className}`}>No practical justification yet.</div>;

  const result = data.result ?? {};
  const bestId = result.bestOptionId as string | undefined;
  const totals: Record<string, number> = result.totals ?? {};
  const options: Array<{ id: string; label: string }> = data.options ?? [];

  return (
    <div className={`rounded border p-3 ${className}`}>
      <div className="text-sm font-medium mb-2">Practical Justification — Summary</div>
      {bestId ? (
        <div className="mb-2 text-sm">
          Best option: <b>{options.find(o => o.id === bestId)?.label ?? bestId}</b>
        </div>
      ) : (
        <div className="mb-2 text-xs text-neutral-500">No computed result yet.</div>
      )}

      {!!Object.keys(totals).length && (
        <div className="overflow-x-auto mb-3">
          <table className="min-w-[420px] text-sm border">
            <thead>
              <tr className="bg-slate-50"><th className="border px-2 py-1 text-left">Option</th><th className="border px-2 py-1 text-left">Total (0–1)</th></tr>
            </thead>
            <tbody>
              {Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([optId, total]) => (
                <tr key={optId}>
                  <td className="border px-2 py-1">{options.find(o => o.id === optId)?.label ?? optId}</td>
                  <td className="border px-2 py-1">{total.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Compare vs (open EvaluationSheet) */}
      <div className="flex items-center gap-2 text-xs">
        <label className="text-neutral-600">Compare vs</label>
        <select className="border rounded px-2 py-1" value={pick} onChange={e=>setPick(e.target.value)}>
          <option value="">— Select IH/TC Work —</option>
          {alts.map(a => <option key={a.id} value={a.id}>{a.title} [{a.theoryType}]</option>)}
        </select>
        <button
          className="px-2 py-1 border rounded bg-white"
          disabled={!pick}
          onClick={() => window.dispatchEvent(new CustomEvent('mesh:open-evaluation-sheet', {
            detail: { fromWorkId: workId, toWorkId: pick }  // source=this work; target=selected
          }))}
        >
          Compare (create EVALUATES)
        </button>
      </div>
    </div>
  );
}
