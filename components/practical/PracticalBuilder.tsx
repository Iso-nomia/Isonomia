// components/practical/PracticalBuilder.tsx
'use client';

import * as React from 'react';
import { mcdaResult, sensitivity } from '@/lib/practical/compute';
type Crit = { id: string; label: string; weight: number; kind?: 'prudential'|'moral' };
type Opt  = { id: string; label: string; desc?: string };
type Scores = Record<string, Record<string, number>>;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function PracticalBuilder({
  workId,
  canEdit = true,
  defaultOpen = true,
  purposeDefault = '',
  onSaved,
  className = '',
}: {
  workId: string;
  canEdit?: boolean;
  defaultOpen?: boolean;
  purposeDefault?: string;
  onSaved?: (payload: any) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [purpose, setPurpose] = React.useState(purposeDefault);
  const [criteria, setCriteria] = React.useState<Crit[]>([]);
  const [options, setOptions]   = React.useState<Opt[]>([]);
  const [scores, setScores]     = React.useState<Scores>({});
  const [result, setResult]     = React.useState<any>(null);

  // load existing
  React.useEffect(() => {
    let abort = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/works/${workId}/practical`, { cache: 'no-store' });
        const data = await res.json();
        if (abort) return;
        const j = data?.justification ?? null;
        if (j) {
          setPurpose(j.purpose ?? '');
          setCriteria(Array.isArray(j.criteria) ? j.criteria : []);
          setOptions(Array.isArray(j.options) ? j.options : []);
          setScores(j.scores ?? {});
          setResult(j.result ?? null);
        }
      } catch (e) {
        console.error('load practical failed', e);
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [workId]);

  const addCriterion = () => {
    const label = prompt('Criterion label (e.g., Simplicity, Coverage, Safety)');
    if (!label) return;
    const weightStr = prompt('Weight (e.g., 1..5; higher = more important)', '1') ?? '1';
    const weight = Math.max(0, Number(weightStr) || 0);
    const id = uid('c');
    setCriteria(prev => [...prev, { id, label, weight }]);
  };

  const addOption = () => {
    const label = prompt('Option label (e.g., Policy A, Rule v2)');
    if (!label) return;
    const desc  = prompt('Short description (optional)') ?? '';
    const id = uid('o');
    setOptions(prev => [...prev, { id, label, desc }]);
    setScores(prev => ({ ...prev, [id]: prev[id] ?? {} }));
  };

  const removeCriterion = (id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
    // clean matrix column
    setScores(prev => {
      const next: Scores = {};
      for (const [optId, row] of Object.entries(prev)) {
        const { [id]: _, ...rest } = row;
        next[optId] = rest;
      }
      return next;
    });
  };

  const removeOption = (id: string) => {
    setOptions(prev => prev.filter(o => o.id !== id));
    setScores(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const setCell = (optId: string, critId: string, val: number) => {
    setScores(prev => ({
      ...prev,
      [optId]: { ...(prev[optId] ?? {}), [critId]: val }
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { purpose, criteria, options, scores };
      const res = await fetch(`/api/works/${workId}/practical`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error ? JSON.stringify(data.error) : res.statusText;
        alert(`Save failed: ${msg}`);
        return;
      }
      setResult(data?.justification?.result ?? null);
      onSaved?.(data);
    } catch (e: any) {
      alert(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  const res = mcdaResult(criteria, options, scores);
const sen = sensitivity(criteria, options, scores, 0.1);


  return (
    <section className={`rounded border ${className}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-sm font-medium">Practical Argument (MCDA)</div>
        <button
          className="text-xs underline"
          onClick={() => setOpen(o => !o)}
          type="button"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {loading ? (
            <div className="text-xs text-neutral-500">Loading…</div>
          ) : (
            <>
              <div>
                <label className="block text-xs text-neutral-600 mb-1">
                  Purpose (TL;DR of what you’re justifying)
                </label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Which instrument best realizes the standard output?"
                  disabled={!canEdit}
                />
              </div>

              {/* Criteria editor */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-neutral-600">Criteria</div>
                  {canEdit && (
                    <button className="text-xs underline" onClick={addCriterion} type="button">
                      Add criterion
                    </button>
                  )}
                </div>
                {!criteria.length ? (
                  <div className="text-xs text-neutral-500 mt-1">No criteria yet.</div>
                ) : (
                  <div className="mt-1 space-y-1">
                    {criteria.map(c => (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <span className="px-1.5 py-0.5 rounded border bg-slate-50">{c.label}</span>
                        <span className="text-[11px] text-neutral-500">weight {c.weight}</span>
                        {canEdit && (
                          <button className="text-[11px] underline" onClick={() => removeCriterion(c.id)} type="button">
                            remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Options editor */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-neutral-600">Options</div>
                  {canEdit && (
                    <button className="text-xs underline" onClick={addOption} type="button">
                      Add option
                    </button>
                  )}
                </div>
                {!options.length ? (
                  <div className="text-xs text-neutral-500 mt-1">No options yet.</div>
                ) : (
                  <div className="mt-1 space-y-1">
                    {options.map(o => (
                      <div key={o.id} className="flex items-center gap-2 text-sm">
                        <span className="px-1.5 py-0.5 rounded border bg-slate-50">{o.label}</span>
                        {o.desc && <span className="text-[11px] text-neutral-500">— {o.desc}</span>}
                        {canEdit && (
                          <button className="text-[11px] underline" onClick={() => removeOption(o.id)} type="button">
                            remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Score matrix */}
              {options.length > 0 && criteria.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-[520px] border text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border px-2 py-1 text-left">Option \ Criterion</th>
                        {criteria.map(c => (
                          <th key={c.id} className="border px-2 py-1 text-left">
                            {c.label}<br/>
                            <span className="text-[10px] text-neutral-500">w={c.weight}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {options.map(o => (
                        <tr key={o.id}>
                          <td className="border px-2 py-1">{o.label}</td>
                          {criteria.map(c => {
                            const v = scores[o.id]?.[c.id] ?? 0;
                            return (
                              <td key={c.id} className="border px-2 py-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  className="w-20 border rounded px-1 py-0.5"
                                  value={v}
                                  onChange={(e) => setCell(o.id, c.id, Number(e.target.value))}
                                  disabled={!canEdit}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded border text-sm bg-white disabled:opacity-50"
                  onClick={save}
                  disabled={!canEdit || saving || !criteria.length || !options.length}
                  type="button"
                >
                  {saving ? 'Saving…' : 'Compute & Save'}
                </button>
                {result?.bestOptionId && (
                  <span className="text-sm">
                    Best: <b>{(options.find(o => o.id === result.bestOptionId)?.label) ?? result.bestOptionId}</b>
                  </span>
                )}
                <div className="text-xs mt-1">
  {sen.stable
    ? <span className="text-emerald-700">Sensitivity: stable (±10% weights keeps {res.bestOptionId})</span>
    : <span className="text-amber-700">
        Sensitivity: fragile — flips if {sen.flips.slice(0,3).map(f => `${f.criterionId}${f.dir}`).join(', ')}
        {sen.flips.length>3 ? ` +${sen.flips.length-3}` : ''}
      </span>
  }
</div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
