// components/AttackSubtypePicker.tsx
'use client';
import * as React from 'react';

const OPTIONS = ['UNDERMINE','REBUT','UNDERCUT','OVERCUT','SUPPORT_ATTACK','CONSEQUENCE_ATTACK','JUSTIFICATION_ATTACK'] as const;
type Sub = typeof OPTIONS[number];

export default function AttackSubtypePicker({ edgeId, initial }:{ edgeId:string; initial?:Sub }) {
  const [val,setVal] = React.useState<Sub|undefined>(initial);
  const [busy,setBusy] = React.useState(false);
  return (
    <div className="inline-flex items-center gap-1">
      <select className="text-[11px] border rounded px-1 py-0.5" value={val || ''} disabled={busy}
        onChange={async e=>{
          const v = e.target.value as Sub; setBusy(true);
          await fetch(`/api/argument-edges/${edgeId}/subtype`, {
            method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ attackSubtype: v })
          }).catch(()=>{}).finally(()=>setBusy(false));
          setVal(v);
        }}>
        <option value="">— subtype —</option>
        {OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
