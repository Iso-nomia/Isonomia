// components/dialogue/CommitmentDelta.tsx
'use client';
import * as React from 'react';

type Snapshot = {
  facts: { label: string; entitled?: boolean }[];
  rules: { label: string }[];
};
type Delta = {
  addedFacts: { owner: 'Proponent'|'Opponent'; label: string }[];
  removedFacts: { owner: 'Proponent'|'Opponent'; label: string }[];
  toggled: { owner: 'Proponent'|'Opponent'; label: string; entitled: boolean }[];
  addedRules: { owner: 'Proponent'|'Opponent'; label: string }[];
  removedRules: { owner: 'Proponent'|'Opponent'; label: string }[];
};

function asMapFacts(rows: Snapshot['facts']) {
  const m = new Map<string, boolean>();
  for (const f of rows ?? []) m.set(f.label ?? '', f.entitled !== false);
  return m;
}
function asSetLabels(rows: {label:string}[]) { return new Set((rows ?? []).map(r=>r.label ?? '')); }

export function CommitmentDelta({
  dialogueId,
  refreshKey,        // bump this when trace changes
}: { dialogueId: string; refreshKey: any }) {
  const [snap, setSnap] = React.useState<{ P?: Snapshot; O?: Snapshot }>({});
  const [delta, setDelta] = React.useState<Delta | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [p, o] = await Promise.all([
        fetch(`/api/commitments/state?dialogueId=${encodeURIComponent(dialogueId)}&ownerId=Proponent`, {cache:'no-store'}).then(r=>r.json()).catch(()=>null),
        fetch(`/api/commitments/state?dialogueId=${encodeURIComponent(dialogueId)}&ownerId=Opponent`, {cache:'no-store'}).then(r=>r.json()).catch(()=>null),
      ]);
      if (!alive || !p?.ok || !o?.ok) return;

      const prevP = snap.P, prevO = snap.O;
      const nextP: Snapshot = { facts: p.facts ?? [], rules: p.rules ?? [] };
      const nextO: Snapshot = { facts: o.facts ?? [], rules: o.rules ?? [] };

      if (prevP || prevO) {
        const d: Delta = { addedFacts:[], removedFacts:[], toggled:[], addedRules:[], removedRules:[] };

        // facts
        for (const owner of ['Proponent','Opponent'] as const) {
          const prev = asMapFacts((owner==='Proponent'? prevP:prevO) ?.facts ?? []);
          const cur  = asMapFacts((owner==='Proponent'? nextP:nextO).facts ?? []);
          // added / removed
          for (const [lbl] of cur.entries()) if (!prev.has(lbl)) d.addedFacts.push({ owner, label: lbl });
          for (const [lbl] of prev.entries()) if (!cur.has(lbl)) d.removedFacts.push({ owner, label: lbl });
          // toggled
          for (const [lbl, ent] of cur.entries()) {
            if (prev.has(lbl) && prev.get(lbl) !== ent) d.toggled.push({ owner, label: lbl, entitled: ent });
          }
        }
        // rules
        for (const owner of ['Proponent','Opponent'] as const) {
          const prev = asSetLabels((owner==='Proponent'? prevP:prevO)?.rules ?? []);
          const cur  = asSetLabels((owner==='Proponent'? nextP:nextO).rules ?? []);
          for (const lbl of cur) if (!prev.has(lbl)) d.addedRules.push({ owner, label: lbl });
          for (const lbl of prev) if (!cur.has(lbl)) d.removedRules.push({ owner, label: lbl });
        }
        setDelta(d);
      }
      setSnap({ P: nextP, O: nextO });
    })();
    return () => { alive = false; };
  }, [dialogueId, refreshKey]); // refreshKey: e.g., trace.status + trace.steps.length

  if (!delta || (
    !delta.addedFacts.length && !delta.removedFacts.length &&
    !delta.toggled.length && !delta.addedRules.length && !delta.removedRules.length
  )) return null;

  const pill = (txt:string, cls:string) => (
    <span className={['px-1.5 py-0.5 rounded border text-[11px]', cls].join(' ')}>{txt}</span>
  );

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {delta.addedFacts.map((x,i)=>pill(`+ fact ${x.label} (${x.owner[0]})`,'bg-emerald-50 border-emerald-200 text-emerald-700'))}
      {delta.removedFacts.map((x,i)=>pill(`– fact ${x.label} (${x.owner[0]})`,'bg-rose-50 border-rose-200 text-rose-700'))}
      {delta.toggled.map((x,i)=>pill(`${x.entitled?'✅':'⚠'} ${x.label} (${x.owner[0]})`,'bg-white border-slate-200'))}
      {delta.addedRules.map((x,i)=>pill(`+ rule ${x.label} (${x.owner[0]})`,'bg-amber-50 border-amber-200 text-amber-700'))}
      {delta.removedRules.map((x,i)=>pill(`– rule ${x.label} (${x.owner[0]})`,'bg-purple-50 border-purple-200 text-purple-700'))}
    </div>
  );
}
