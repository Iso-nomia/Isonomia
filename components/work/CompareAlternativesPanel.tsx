// components/work/CompareAlternativesPanel.tsx
'use client';
import * as React from 'react';

type Edge = {
  id: string;
  kind: 'ALTERNATIVE_TO' | 'EVALUATES' | string;
  fromWorkId?: string | null;
  toWorkId?: string | null;
  meta?: any;
  createdAt?: string;
};

type WorkLite = { id: string; title: string; theoryType: 'IH'|'TC'|'DN'|'OP' };

export default function CompareAlternativesPanel({ workId }:{ workId:string }) {
  const [alts, setAlts] = React.useState<Edge[]>([]);
  const [evals, setEvals] = React.useState<Edge[]>([]);
  const [workMap, setWorkMap] = React.useState<Record<string, WorkLite>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/knowledge-edges?toWorkId=${workId}&kinds=ALTERNATIVE_TO,EVALUATES`, { cache:'no-store' });
      const j = await r.json();
      if (cancelled) return;
      setAlts((j.edges ?? []).filter((e:Edge)=>e.kind==='ALTERNATIVE_TO'));
      setEvals((j.edges ?? []).filter((e:Edge)=>e.kind==='EVALUATES'));
      const wm: Record<string, WorkLite> = {};
      for (const w of (j.works ?? [])) wm[w.id] = w;
      setWorkMap(wm);
    })();
    return () => { cancelled = true; };
  }, [workId]);

  const altIds = Array.from(new Set(alts.map(a => a.fromWorkId!).filter(Boolean)));
  const rows = altIds.map(id => {
    const w = workMap[id];
    const ev = evals.find(e => e.fromWorkId === id);
    const mcda = ev?.meta?.mcda;
    const verdict =
      mcda?.bestOptionId ? `Best: ${mcda.bestOptionId} (k=${Object.keys(mcda.totals||{}).length})` :
      ev ? 'Evaluated' : '—';
    return { id, title: w?.title ?? id, type: w?.theoryType ?? 'IH', verdict };
  });

  return (
    <div className="rounded border p-2 bg-white/70">
      <div className="text-sm font-medium">Compare alternatives</div>
      {!rows.length ? (
        <div className="text-xs text-neutral-500 mt-1">No ALTERNATIVE_TO edges yet.</div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-neutral-50">
              <tr>
                <th className="border px-2 py-1 text-left">Alternative Work</th>
                <th className="border px-2 py-1 text-left">Type</th>
                <th className="border px-2 py-1 text-left">Evaluation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="border px-2 py-1">
                    <a className="underline" href={`/works/${r.id}`}>{r.title}</a>
                  </td>
                  
                  <td className="border px-2 py-1">{r.type}</td>
                  <td className="border px-2 py-1">{r.verdict}</td>
                  <td className="border px-2 py-1">
  {r.verdict}
  <button
    className="ml-2 text-xs underline"
    onClick={() => window.dispatchEvent(new CustomEvent('mesh:open-evaluation-sheet', { detail: { toWorkId: workId, fromWorkId: r.id } }))}
  >
    Compare now
  </button>
</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[11px] text-neutral-500 mt-2">
        Alternatives sourced from <code>ALTERNATIVE_TO</code>; evaluations from <code>EVALUATES</code> (MCDA snapshot).
      </div>
    </div>
  );
}
