// components/pascal/PascalBuilder.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

type Proposition = { id: string; statement: string };
type Action = { id: string; label: string };
type Utilities = Record<string, Record<string, number>>; // actionId -> worldId -> utility

export default function PascalBuilder({ workId }: { workId: string }) {
  const { data, mutate, isLoading } = useSWR<{ok:boolean; pascal:any}>(`/api/works/${workId}/pascal`, fetcher);

  const [propositions, setProps] = React.useState<Proposition[]>([]);
  const [actions, setActs] = React.useState<Action[]>([]);
  const [utilities, setUtils] = React.useState<Utilities>({});
  const [assumption, setAssump] = React.useState<string>('');
  const [method, setMethod] = React.useState<'laplace'|'minimax'|'regret'>('laplace');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const p = data?.pascal;
    if (p) {
      setProps(p.propositions ?? []);
      setActs(p.actions ?? []);
      setUtils(p.utilities ?? {});
      setAssump(p.assumption ?? '');
      setMethod(p.decision?.method ?? 'laplace');
    }
  }, [data?.pascal]);

  const addWorld = () => setProps(s => [...s, { id: `w${Date.now()}`, statement: '' }]);
  const addAction = () => setActs(s => [...s, { id: `a${Date.now()}`, label: '' }]);

  const setU = (aId: string, wId: string, v: number) => {
    setUtils(u => ({ ...u, [aId]: { ...(u[aId] ?? {}), [wId]: v } }));
  };

  const save = async () => {
    if (!propositions.length || !actions.length) {
      alert('Add at least one proposition and one action.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${workId}/pascal`, {
        method: 'PUT',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({ propositions, actions, utilities, assumption: assumption || null, method }),
      });
      if (!res.ok) throw new Error(await res.text());
      await mutate();
      alert('Decision saved.');
    } catch (e:any) {
      alert(`Save failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded border p-3 bg-white/60 space-y-3">
      <div className="text-sm font-medium">Pascal Builder (as‑if decision, OP)</div>
      {isLoading && <div className="text-xs text-neutral-500">Loading…</div>}

      <div className="text-[11px] text-neutral-500">
        Specify mutually‑exclusive propositions (worlds), actions, and a utility table. Laplace (uniform) expected utility is default;
        minimax/regret available as alternatives.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className='border rounded p-2'>
          <div className="flex items-center justify-between ">
            <div className="text-xs font-medium">Propositions (worlds)</div>
            <button className="text-xs underline" onClick={addWorld}>+ Add</button>
          </div>
          <div className="mt-2 space-y-2">
            {propositions.map((w, i) => (
              <input
                key={w.id}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="e.g., [A] is true"
                value={w.statement}
                onChange={(e)=>setProps(arr => { const c=[...arr]; c[i]={...c[i], statement:e.target.value}; return c; })}
              />
            ))}
            {!propositions.length && <div className="text-[11px] text-neutral-500">No propositions yet.</div>}
          </div>
        </div>

            <div className='border rounded p-2'>

          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">Actions</div>
            <button className="text-xs underline" onClick={addAction}>+ Add</button>
          </div>
          <div className="mt-2 space-y-2">
            {actions.map((a, i) => (
              <input
                key={a.id}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="e.g., Act as if [A] is true"
                value={a.label}
                onChange={(e)=>setActs(arr => { const c=[...arr]; c[i]={...c[i], label:e.target.value}; return c; })}
              />
            ))}
            {!actions.length && <div className="text-[11px] text-neutral-500">No actions yet.</div>}
          </div>
        </div>
      </div>

      {/* Utilities matrix */}
      {propositions.length > 0 && actions.length > 0 && (
        <div className="overflow-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border px-2 py-1 text-left">Action ↓ / World →</th>
                {propositions.map(w => (
                  <th key={w.id} className="border px-2 py-1 text-left">{w.statement || w.id}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map(a => (
                <tr key={a.id}>
                  <td className="border px-2 py-1 font-medium">{a.label || a.id}</td>
                  {propositions.map(w => (
                    <td key={`${a.id}:${w.id}`} className="border px-2 py-1">
                      <input
                        type="number"
                        className="w-24 border rounded px-1 py-0.5"
                        value={(utilities[a.id]?.[w.id] ?? 0)}
                        onChange={(e)=>setU(a.id, w.id, Number(e.target.value))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border rounded px-2 py-1 text-xs"
          value={method}
          onChange={(e)=>setMethod(e.target.value as any)}
        >
          <option value="laplace">Laplace (uniform expected utility)</option>
          <option value="minimax">Minimax (max of worst‑case)</option>
          <option value="regret">Minimize regret</option>
        </select>
        <input
          className="flex-1 border rounded px-2 py-1 text-xs"
          placeholder={`Assumption (e.g., "no theoretical evidence discriminates among worlds")`}
          value={assumption}
          onChange={(e)=>setAssump(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button className="btnv2--ghost px-3 py-1 rounded border text-xs bg-white hover:bg-neutral-100 disabled:opacity-50" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save decision'}
        </button>
      </div>
    </section>
  );
}
