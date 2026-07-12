// components/monological/QuantifierModalityPicker.tsx
'use client';
import * as React from 'react';

export function QuantifierModalityPicker({
  initialQuantifier,
  initialModality,
  onChange,
}: {
  initialQuantifier?: 'SOME'|'MANY'|'MOST'|'ALL'|null;
  initialModality?: 'COULD'|'LIKELY'|'NECESSARY'|null;
  onChange: (q: any, m: any) => void;
}) {
  const [q, setQ] = React.useState(initialQuantifier ?? null);
  const [m, setM] = React.useState(initialModality ?? null);

  return (
    <div className="flex flex-col  text-[11px]">
      <select className="border rounded px-1 py-0.5"
        value={q ?? ''} onChange={e => { const v = (e.target.value || null) as any; setQ(v); onChange(v, m); }}>
        <option value="">Quantifier…</option>
        <option value="SOME">SOME</option><option value="MANY">MANY</option>
        <option value="MOST">MOST</option><option value="ALL">ALL</option>
      </select>
      <select className="border rounded px-1 py-0.5"
        value={m ?? ''} onChange={e => { const v = (e.target.value || null) as any; setM(v); onChange(q, v); }}>
        <option value="">Modality…</option>
        <option value="COULD">COULD</option><option value="LIKELY">LIKELY</option>
        <option value="NECESSARY">NECESSARY</option>
      </select>
    </div>
  );
}
