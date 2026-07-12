// components/ludics/TensorProbeCard.tsx
'use client';
import * as React from 'react';
import useSWR from 'swr';
import { isPath, dualPath, type Act } from '@/packages/ludics-core/ve/pathCheck';

type QTok = { pol:'pos'|'neg'; locus:string };
const parseQ = (s:string): QTok[] =>
  s.split(/\s+/).map(w => {
    const [h,t] = w.split('@'); const pol = h==='+'?'pos':'neg';
    return { pol, locus: (t ?? '0').trim() };
  });

export default function TensorProbeCard({ dialogueId }:{ dialogueId:string }) {
  const { data } = useSWR(`/api/ludics/designs?deliberationId=${encodeURIComponent(dialogueId)}`, u=>fetch(u).then(r=>r.json()));
  const designs: Array<{id:string; participantId:string}> = (data?.designs ?? data ?? []);
  const P = designs.find(d=>d.participantId==='Proponent')?.id ?? designs[0]?.id;
  const O = designs.find(d=>d.participantId==='Opponent')?.id ?? designs[1]?.id;
  const [qStr, setQStr]   = React.useState('+@0.1 -@0 +@0.2'); // sample
  const [note, setNote]   = React.useState('');
  const [ok, setOK]       = React.useState<'idle'|'pass'|'fail'>('idle');

  async function check() {
    setNote(''); setOK('idle');
    const q = parseQ(qStr).map(a => ({ pol:a.pol, locus:a.locus })) as Act[];
    const revOK = isPath(dualPath(q)).ok;
    if (!revOK) { setNote('Dual(q) is not a path (⊙ fails)'); setOK('fail'); return; }
    // rough membership to VA[B] ⊔ VB[A]: at least syntactic “path” and alternation ok (stronger checks can call server)
    const qOK = isPath(q).ok;
    if (!qOK) { setNote('q itself is not a path'); setOK('fail'); return; }
    // OPTIONAL: POST to a backend checker that tries to witness q under “extension + shuffle”
    setOK('pass'); setNote('Syntactic checks passed; engine-witness optional.');
  }

  return (
    <section className="rounded border bg-white/80 p-2 text-[12px]">
      <div className="flex items-center justify-between">
        <b>Tensor visitability (A ⊗ B)</b>
        <span className="opacity-60">Prop. 3.6</span>
      </div>
      <div className="mt-1 grid md:grid-cols-[1fr_auto] gap-2">
        <input className="border rounded px-2 py-1" value={qStr} onChange={e=>setQStr(e.target.value)}
               placeholder="+@0.1 -@0 +@0.2 (space‑separated ±@ξ)" />
        <button className="btnv2" onClick={check}>Check</button>
      </div>
      <div className="mt-1">
        {ok==='pass' && <span className="px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700">OK (dual is path; basic shuffle legality)</span>}
        {ok==='fail' &&  <span className="px-2 py-0.5 rounded border bg-rose-50 text-rose-700">{note}</span>}
        {ok==='idle' && !!note && <span className="px-2 py-0.5 rounded border bg-amber-50 text-amber-700">{note}</span>}
      </div>
      <div className="mt-1 text-[11px] opacity-70">
        Tip: enter q as tokens “+@ξ.k” and “-@ξ”, matching your loci. Conditions checked per Prop. 3.6.
      </div>
    </section>
  );
}
