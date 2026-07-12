'use client';
import * as React from 'react';

export default function DefaultRuleEditor({
  argumentId, role='premise', onSaved, onCancel
}:{
  argumentId: string;
  role?: 'premise'|'claim';
  onSaved?: ()=>void;
  onCancel?: ()=>void;
}) {
  const [antecedent,setAntecedent] = React.useState('');
  const [justification,setJustification] = React.useState('');
  const [consequent,setConsequent] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  const [err,setErr] = React.useState<string|null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/monological/defaults', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ argumentId, role, antecedent, justification, consequent })
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved?.();
    } catch (e:any) { setErr(e?.message || 'Failed to save'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2 border rounded p-2 bg-white">
      <div className="text-[11px] font-semibold mb-1">Add default {role}</div>
      <div className="grid grid-cols-3 gap-2">
        <input className="border rounded px-2 py-1 text-[12px]" placeholder="α (antecedent)"
               value={antecedent} onChange={e=>setAntecedent(e.target.value)} disabled={busy}/>
        <input className="border rounded px-2 py-1 text-[12px]" placeholder="β (justification)"
               value={justification} onChange={e=>setJustification(e.target.value)} disabled={busy}/>
        <input className="border rounded px-2 py-1 text-[12px]" placeholder="γ (consequent)"
               value={consequent} onChange={e=>setConsequent(e.target.value)} disabled={busy}/>
      </div>
      {err && <div className="text-[11px] text-rose-600 mt-1">{err}</div>}
      <div className="mt-2 flex gap-2">
        <button className="px-2 py-0.5 border rounded text-[11px]" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="px-2 py-0.5 border rounded bg-emerald-600 text-white text-[11px]"
                onClick={save} disabled={busy || !antecedent || !justification || !consequent}>
          {busy ? 'Saving…' : 'Save default'}
        </button>
      </div>
    </div>
  );
}
