'use client';
import * as React from 'react';

type Candidate = { id: string; title: string; theoryType: 'IH'|'TC'|'DN'|'OP' };

export default function SupplyQuickLink({ workId }:{ workId: string }) {
  const [delibId, setDelibId] = React.useState<string | null>(null);
  const [cands, setCands] = React.useState<Candidate[]>([]);
  const [sel, setSel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let off = false;
    (async () => {
      try {
        const w = await fetch(`/api/works/${workId}`, { cache:'no-store' }).then(r=>r.json());
        if (!off) setDelibId(w?.work?.deliberationId ?? null);
      } catch {}
    })();
    return () => { off = true; };
  }, [workId]);

  React.useEffect(() => {
    if (!delibId) return;
    let off = false;
    (async () => {
      try {
        const r = await fetch(`/api/works?deliberationId=${encodeURIComponent(delibId)}`, { cache:'no-store' }).then(r=>r.json());
        const list = (r.works ?? []).filter((w:Candidate)=> w.theoryType==='IH' || w.theoryType==='TC');
        if (!off) setCands(list);
      } catch {}
    })();
    return () => { off = true; };
  }, [delibId]);

  async function link() {
    if (!sel || !delibId) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/knowledge-edges', {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body: JSON.stringify({ deliberationId: delibId, kind:'SUPPLIES_PREMISE', fromWorkId: workId, toWorkId: sel })
      });
      if (!r.ok) throw new Error(await r.text());
      setSel('');
      try { window.dispatchEvent(new CustomEvent('mesh:edges-updated', { detail: { toWorkId: sel } })); } catch {}
    } catch (e:any) {
      setErr(e?.message || 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="border rounded px-2 py-1 text-xs"
        value={sel}
        onChange={e=>setSel(e.target.value)}
      >
        <option value="">Supply to IH/TC…</option>
        {cands.map(c => <option key={c.id} value={c.id}>{c.title} [{c.theoryType}]</option>)}
      </select>
      <button
        className="px-2 py-1 text-[11px] rounded border bg-white hover:bg-slate-50 disabled:opacity-50"
        onClick={link}
        disabled={!sel || busy}
        title="Create SUPPLIES_PREMISE edge now"
      >
        {busy ? 'Linking…' : 'Link'}
      </button>
      {err && <span className="text-[11px] text-rose-600">{err}</span>}
    </div>
  );
}
