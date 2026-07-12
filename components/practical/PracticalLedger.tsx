// components/practical/PracticalLedger.tsx
'use client';

import * as React from 'react';

export type ValueKey =
  | 'economic'
  | 'security'
  | 'fairness'
  | 'morality'
  | 'capacity';

export const DEFAULT_VALUE_WEIGHTS: Record<ValueKey, number> = {
  economic: 1.0,
  security: 1.0,
  fairness: 1.0,
  morality: 1.0,
  capacity: 1.0,
};

export type Consequence = {
  id: string;
  optionId: string;           // which option this belongs to
  description: string;
  probability: number;        // 0..1
  impact: Partial<Record<ValueKey, number>>; // negative/positive impact, typically -5..+5
  evidenceUrl?: string;
  rationale?: string;
};

export type Option = { id: string; label: string; note?: string };

export type LedgerState = {
  title?: string;
  values: Record<ValueKey, number>; // weights for each value
  options: Option[];
  rows: Consequence[];
  lastSavedAt?: string;
};

function uid() { return Math.random().toString(36).slice(2); }

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function evOfRow(row: Consequence, w: Record<ValueKey, number>) {
  const score = (Object.keys(w) as ValueKey[]).reduce((s, k) => {
    const imp = row.impact[k] ?? 0;
    return s + w[k] * imp;
  }, 0);
  return row.probability * score;
}

function netEV(rows: Consequence[], optionId: string, w: Record<ValueKey, number>) {
  return rows.filter(r => r.optionId === optionId).reduce((s, r) => s + evOfRow(r, w), 0);
}

export default function PracticalLedger({
  initial,
  onChange,
  onSave,
}: {
  initial?: Partial<LedgerState>;
  onChange?: (s: LedgerState) => void;
  onSave?: (s: LedgerState) => Promise<void> | void;
}) {
  const [state, setState] = React.useState<LedgerState>(() => ({
    title: initial?.title ?? 'Practical Argument Ledger',
    values: { ...DEFAULT_VALUE_WEIGHTS, ...(initial?.values || {}) },
    options: initial?.options?.length ? initial.options : [
      { id: uid(), label: 'Option A' },
      { id: uid(), label: 'Option B' },
    ],
    rows: initial?.rows ?? [],
    lastSavedAt: initial?.lastSavedAt,
  }));

  React.useEffect(() => { onChange?.(state); }, [state, onChange]);

  const addRow = (optId: string) => {
    setState(s => ({
      ...s,
      rows: [
        ...s.rows,
        {
          id: uid(),
          optionId: optId,
          description: '',
          probability: 0.5,
          impact: {},
        },
      ],
    }));
  };

  const removeRow = (rowId: string) => {
    setState(s => ({ ...s, rows: s.rows.filter(r => r.id !== rowId) }));
  };

  const updateRow = (rowId: string, patch: Partial<Consequence>) => {
    setState(s => ({
      ...s,
      rows: s.rows.map(r => (r.id === rowId ? { ...r, ...patch } : r)),
    }));
  };

  const addOption = () => {
    setState(s => ({
      ...s,
      options: [...s.options, { id: uid(), label: `Option ${String.fromCharCode(65 + s.options.length)}` }],
    }));
  };

  const removeOption = (optId: string) => {
    setState(s => ({
      ...s,
      options: s.options.filter(o => o.id !== optId),
      rows: s.rows.filter(r => r.optionId !== optId),
    }));
  };

  const save = async () => {
    try {
      await onSave?.(state);
      setState(s => ({ ...s, lastSavedAt: new Date().toISOString() }));
    } catch (e) {
      console.error('save ledger failed', e);
    }
  };

  const w = state.values;
  const totals = Object.fromEntries(state.options.map(o => [o.id, netEV(state.rows, o.id, w)]));

  return (
    <div className="border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {state.title}
          <span className="ml-2 text-[11px] text-neutral-600">Practical arguments net consequences × values. This ledger is <b>non‑exhaustive</b>—please add missing consequences.</span>
        </div>
        <button className="px-2 py-1 border rounded text-xs" onClick={save}>Save</button>
      </div>

      {/* Value weights */}
      <div className="rounded border p-2">
        <div className="text-xs mb-1 font-medium">Value weights</div>
        <div className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(w) as ValueKey[]).map(k => (
            <label key={k} className="flex items-center gap-1">
              <span className="w-16 capitalize">{k}</span>
              <input
                type="number" step="0.1"
                className="w-20 border rounded px-1 py-0.5"
                value={w[k]}
                onChange={e => {
                  const v = Number(e.target.value);
                  setState(s => ({ ...s, values: { ...s.values, [k]: Number.isFinite(v) ? v : 0 } }));
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        {state.options.map(opt => {
          const rows = state.rows.filter(r => r.optionId === opt.id);
          const total = totals[opt.id] ?? 0;
          return (
            <div key={opt.id} className="rounded border p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium">
                  <input
                    className="border rounded px-1 py-0.5 mr-2 text-sm"
                    value={opt.label}
                    onChange={e => setState(s => ({
                      ...s,
                      options: s.options.map(o => o.id === opt.id ? { ...o, label: e.target.value } : o),
                    }))}
                  />
                  <span className="ml-2 text-[11px] text-neutral-600">Net EV: <b className={total >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{total.toFixed(2)}</b></span>
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 border rounded text-xs" onClick={() => addRow(opt.id)}>Add consequence</button>
                  {state.options.length > 1 && (
                    <button className="px-2 py-1 border rounded text-xs" onClick={() => removeOption(opt.id)}>Remove option</button>
                  )}
                </div>
              </div>

              {/* Rows */}
              <div className="mt-2 space-y-2">
                {rows.map(row => {
                  return (
                    <div key={row.id} className="p-2 border rounded">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          placeholder="Consequence description"
                          value={row.description}
                          onChange={e => updateRow(row.id, { description: e.target.value })}
                        />
                        <label className="text-xs flex items-center gap-1">
                          Prob
                          <input
                            type="number" step="0.05" min={0} max={1}
                            className="w-20 border rounded px-1 py-0.5"
                            value={row.probability}
                            onChange={e => updateRow(row.id, { probability: clamp01(Number(e.target.value)) })}
                          />
                        </label>
                        <input
                          className="w-56 border rounded px-2 py-1 text-xs"
                          placeholder="Evidence URL (optional)"
                          value={row.evidenceUrl || ''}
                          onChange={e => updateRow(row.id, { evidenceUrl: e.target.value })}
                        />
                        <button className="px-2 py-1 border rounded text-xs" onClick={() => removeRow(row.id)}>Remove</button>
                      </div>
                      {/* Impacts */}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {(Object.keys(state.values) as ValueKey[]).map(k => (
                          <label key={k} className="flex items-center gap-1">
                            <span className="w-16 capitalize">{k}</span>
                            <input
                              type="number" step="0.5"
                              className="w-20 border rounded px-1 py-0.5"
                              value={row.impact[k] ?? 0}
                              onChange={e => {
                                const v = Number(e.target.value) || 0;
                                updateRow(row.id, { impact: { ...row.impact, [k]: v } });
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      {/* Rationale */}
                      <textarea
                        className="mt-2 w-full border rounded px-2 py-1 text-xs"
                        placeholder="Rationale (why this consequence and impacts?)"
                        rows={2}
                        value={row.rationale || ''}
                        onChange={e => updateRow(row.id, { rationale: e.target.value })}
                      />
                      <div className="mt-1 text-[11px] text-neutral-600">
                        EV for this row: <b>{evOfRow(row, w).toFixed(2)}</b>
                      </div>
                    </div>
                  );
                })}
                {!rows.length && (
                  <div className="text-[11px] text-neutral-500">No consequences yet. Add the first one.</div>
                )}
              </div>
            </div>
          );
        })}
        <button className="px-2 py-1 border rounded text-xs" onClick={addOption}>Add option</button>
      </div>
    </div>
  );
}
