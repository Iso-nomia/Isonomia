// components/hermeneutic/HermeneuticBuilder.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';

type JustificationKind = 'PERCEPTION'|'INSTRUMENT'|'INTERPRETIVE'|'TESTIMONY';
type Fact = { id?: string; text: string; sourceUrl?: string; justification?: JustificationKind };
type Hypothesis = { id?: string; text: string; notes?: string; prior?: number };
type Plausibility = { hypothesisId: string; score: number; method: 'bayes'|'heuristic' };

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

// helper to ensure local ids exist
function ensureIds<T extends { id?: string }>(arr: T[], prefix: string): (T & { id: string })[] {
  return (arr ?? []).map((x, i) => x.id ? (x as T & { id: string }) : ({ ...x, id: `${prefix}${Date.now()}_${i}` }));
}

export default function HermeneuticBuilder({
  workId,
  onExportSelectedToPractical,
}: {
  workId: string;
  onExportSelectedToPractical?: (labels: string[]) => void;
}) {
  const { data, mutate, isLoading } = useSWR<{ok:boolean; hermeneutic:any}>(`/api/works/${workId}/hermeneutic`, fetcher);

  const [corpusUrl, setCorpusUrl] = React.useState<string>('');
  const [facts, setFacts] = React.useState<Fact[]>([]);
  const [hyps, setHyps] = React.useState<Hypothesis[]>([]);
  const [plaus, setPlaus] = React.useState<Plausibility[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const h = data?.hermeneutic;
    if (!h) return;
    setCorpusUrl(h.corpusUrl ?? '');
    setFacts(ensureIds(h.facts ?? [], 'f|'));
    setHyps(ensureIds(h.hypotheses ?? [], 'h|'));
    setPlaus(h.plausibility ?? []);
    setSelectedIds(h.selectedIds ?? []);
  }, [data?.hermeneutic]);

  const addFact = () => setFacts(s => [...s, { id:`f|${Date.now()}`, text: '' }]);
  const addHyp  = () => setHyps(s => [...s, { id:`h|${Date.now()}`, text: '', prior: 0.5 }]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${workId}/hermeneutic`, {
        method: 'PUT',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          corpusUrl: corpusUrl || null,
          facts, hypotheses: hyps, plausibility: plaus, selectedIds
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await mutate();
    } catch (e:any) {
      alert(`Save failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const exportToPractical = async () => {
    // Build option labels from selected items (facts + hypotheses)
    const byId = new Map<string, string>();
    for (const f of facts) if (f.id) byId.set(f.id, f.text);
    for (const h of hyps) if (h.id) byId.set(h.id, h.text);
    const labels = selectedIds.map(id => byId.get(id)).filter(Boolean) as string[];

    // Merge into practical options (GET→PUT)
    try {
      const res0 = await fetch(`/api/works/${workId}/practical`, { cache:'no-store' });
      const { practical } = await res0.json();
      const existing: any[] = Array.isArray(practical?.options) ? practical.options : [];
      const newOpts = labels
        .filter(l => !existing.some((o:any) => (o?.label ?? o) === l))
        .map(l => ({ id: `sel:${l.slice(0,24)}`, label: l, desc: 'Selected from hermeneutic phase'}));

      const res = await fetch(`/api/works/${workId}/practical`, {
        method: 'PUT',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          criteria: practical?.criteria ?? [],
          options: [...existing, ...newOpts],
          scores: practical?.scores ?? {},
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onExportSelectedToPractical?.(labels);
      alert('Selected pieces exported to Practical options.');
    } catch (e:any) {
      alert(`Export failed: ${e?.message ?? 'Unknown error'}`);
    }
  };

  return (
    <section className="rounded border p-3 bg-white/60 space-y-3">
      <div className="text-sm font-medium">Interpretive (Hermeneutic) Phase</div>

      {isLoading && <div className="text-xs text-neutral-500">Loading…</div>}

      <div>
        <label className="block text-xs text-neutral-600">Corpus / practice URL (optional)</label>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="Link to the practice/text being interpreted"
          value={corpusUrl}
          onChange={(e)=>setCorpusUrl(e.target.value)}
        />
      </div>

      {/* Facts */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium">Facts / observations</div>
          <button className="text-xs underline" onClick={addFact}>+ Add fact</button>
        </div>
        <div className="mt-2 space-y-2">
          {facts.map((f, i) => (
            <div key={i} className="rounded border p-2">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Observed fact…"
                value={f.text}
                onChange={(e)=>setFacts(arr => { const c=[...arr]; c[i]={...c[i], text:e.target.value}; return c; })}
              />
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1 text-xs"
                  placeholder="Source URL"
                  value={f.sourceUrl || ''}
                  onChange={(e)=>setFacts(arr => { const c=[...arr]; c[i]={...c[i], sourceUrl:e.target.value}; return c; })}
                />
                <select
                  className="border rounded px-2 py-1 text-xs"
                  value={f.justification ?? ''}
                  onChange={(e)=>setFacts(arr => { const c=[...arr]; c[i]={...c[i], justification: (e.target.value || undefined) as JustificationKind}; return c; })}
                >
                  <option value="">— justification —</option>
                  <option value="PERCEPTION">Perception</option>
                  <option value="INSTRUMENT">Instrument</option>
                  <option value="INTERPRETIVE">Interpretive</option>
                  <option value="TESTIMONY">Testimony</option>
                </select>
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={f.id ? selectedIds.includes(f.id) : false}
                    onChange={()=> f.id && toggleSelect(f.id)}
                    disabled={!f.id}
                  />
                  Select
                </label>
              </div>
            </div>
          ))}
          {!facts.length && <div className="text-[11px] text-neutral-500">No facts yet.</div>}
        </div>
      </div>

      {/* Hypotheses */}
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium">Hypotheses (subjective reasons, functions)</div>
          <button className="text-xs underline" onClick={addHyp}>+ Add hypothesis</button>
        </div>
        <div className="mt-2 space-y-2">
          {hyps.map((h, i) => (
            <div key={i} className="rounded border p-2">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Hypothesis…"
                value={h.text}
                onChange={(e)=>setHyps(arr => { const c=[...arr]; c[i]={...c[i], text:e.target.value}; return c; })}
              />
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1 text-xs"
                  placeholder="Notes"
                  value={h.notes || ''}
                  onChange={(e)=>setHyps(arr => { const c=[...arr]; c[i]={...c[i], notes:e.target.value}; return c; })}
                />
                <div className="text-xs text-neutral-600">Plausibility:</div>
                <input
                  type="range"
                  min={0} max={1} step={0.05}
                  value={h.prior ?? 0.5}
                  onChange={(e)=>setHyps(arr => { const c=[...arr]; c[i]={...c[i], prior: Number(e.target.value)}; return c; })}
                />
                <label className="text-xs flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={h.id ? selectedIds.includes(h.id) : false}
                    onChange={()=> h.id && toggleSelect(h.id)}
                    disabled={!h.id}
                  />
                  Select
                </label>
              </div>
            </div>
          ))}
          {!hyps.length && <div className="text-[11px] text-neutral-500">No hypotheses yet.</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-1 rounded border text-sm bg-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save interpretive phase'}
        </button>

        <button
          className="px-3 py-1 rounded border text-sm bg-white"
          onClick={exportToPractical}
          title="Adds selected pieces as Practical options"
        >
          Export selected → Practical options
        </button>
      </div>

      <div className="text-[11px] text-neutral-500">
        Tip: In IH, interpretation precedes construction. Use “Export selected” to evaluate candidate pieces in the Practical builder.
      </div>
    </section>
  );
}
