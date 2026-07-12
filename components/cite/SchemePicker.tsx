// components/cite/SchemePicker.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';

type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'number' | 'boolean';
  required?: boolean;
  placeholder?: string;
};

type SchemeDef = {
  key: string;
  // Allow either shape from /api/schemes:
  title?: string;     // DB-backed shape (preferred for display)
  label?: string;     // fallback shape
  fields: FieldDef[];
};

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());

function getIn(obj: any, path: string) {
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}
function setIn(obj: any, path: string, val: any) {
  const segs = path.split('.');
  const last = segs.pop()!;
  let cur = obj;
  for (const s of segs) {
    if (typeof cur[s] !== 'object' || cur[s] === null) cur[s] = {};
    cur = cur[s];
  }
  cur[last] = val;
  return obj;
}
function coerce(val: string, t: FieldDef['type']) {
  if (t === 'number') return val === '' ? null : Number(val);
  if (t === 'boolean') return val === 'true';
  return val;
}

export default function SchemePicker({
  targetType,
  targetId,
  createdById,
  onAttached,
}: {
  targetType: 'claim';
  targetId: string;
  createdById: string;
  onAttached?: (instance: any) => void;
}) {
  const { data, error, isLoading } = useSWR<{ schemes: SchemeDef[] }>('/api/schemes', fetcher, {
    revalidateOnFocus: false,
  });

  const schemes = data?.schemes ?? [];
  const [open, setOpen] = useState(false);
  const [schemeKey, setSchemeKey] = useState<string>('');
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  const active = useMemo(() => schemes.find(s => s.key === schemeKey), [schemes, schemeKey]);

  // Friendly display name: title (preferred) → label → key
  const display = (s: SchemeDef) => s.title ?? s.label ?? s.key;

  // Initialize selection on first load
  useEffect(() => {
    if (!schemeKey && schemes.length) {
      setSchemeKey(schemes[0].key);
      setForm({});
    }
  }, [schemes, schemeKey]);

  // Reset form when switching scheme
  useEffect(() => { setForm({}); }, [schemeKey]);

  const missingRequired = useMemo(() => {
    if (!active) return false;
    return active.fields.some(f => {
      if (!f.required) return false;
      const v = getIn(form, f.name);
      if (f.type === 'boolean') return typeof v !== 'boolean';
      return v == null || String(v).trim() === '';
    });
  }, [active, form]);

  async function attach() {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch('/api/schemes/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,                 // 'claim'
          targetId,                   // the claim id
          schemeKey,                  // selected scheme
          data: form,                 // arbitrary JSON per scheme
          createdById,                // who attached
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Attach failed');
      // Refresh ToulminMini backing slot immediately
      mutate(`/api/claims/${targetId}/toulmin`);
      onAttached?.(json);
      setOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-block">
      <button
        className="text-xs px-2 py-1 border rounded"
        onClick={() => setOpen(v => !v)}
        disabled={isLoading || !!error}
        title={error ? 'Failed to load schemes' : 'Attach a scheme'}
      >
        {isLoading ? 'Loading…' : error ? 'Schemes unavailable' : 'Attach scheme'}
      </button>

      {open && active && (
        <div className="mt-2 border rounded p-3 space-y-2 bg-white w-[22rem]">
          {/* Scheme select */}
          <label className="block text-xs text-neutral-600">Scheme</label>
          <select
            className="w-full text-sm border rounded px-2 py-1"
            value={schemeKey}
            onChange={(e) => setSchemeKey(e.target.value)}
          >
            {schemes.map(s => (
              <option key={s.key} value={s.key}>{display(s)}</option>
            ))}
          </select>

          {/* Dynamic fields */}
          <div className="space-y-2">
            {active.fields.map((f) => (
              <div key={f.name}>
                <label className="block text-xs text-neutral-600">
                  {f.label}{f.required ? ' *' : ''}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    className="w-full text-sm border rounded px-2 py-1"
                    placeholder={f.placeholder}
                    value={getIn(form, f.name) ?? ''}
                    onChange={e => setForm(setIn({ ...form }, f.name, e.target.value))}
                    rows={3}
                  />
                ) : f.type === 'boolean' ? (
                  <select
                    className="w-full text-sm border rounded px-2 py-1"
                    value={String(getIn(form, f.name) ?? '')}
                    onChange={e => setForm(setIn({ ...form }, f.name, coerce(e.target.value, f.type)))}
                  >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    className="w-full text-sm border rounded px-2 py-1"
                    type={f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                    placeholder={f.placeholder}
                    value={getIn(form, f.name) ?? ''}
                    onChange={e => setForm(setIn({ ...form }, f.name, coerce(e.target.value, f.type)))}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              disabled={busy || missingRequired}
              onClick={attach}
              className="text-xs px-2 py-1 bg-emerald-600 text-white rounded disabled:opacity-50"
              title={missingRequired ? 'Fill required fields' : 'Attach'}
            >
              {busy ? 'Attaching…' : 'Attach'}
            </button>
            <button className="text-xs px-2 py-1 border rounded" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
