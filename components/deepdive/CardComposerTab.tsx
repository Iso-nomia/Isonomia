// components/cards/CardComposerTab.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function CardComposerTab({
  deliberationId,
  hostEmbed,
  hostId,
  onSaved,
}: {
  deliberationId: string;
  hostEmbed?: 'article'|'post'|'room_thread';
  hostId?: string;
  onSaved?: (id: string) => void;
}) {
  const [claim, setClaim] = useState('');
  const [reasons, setReasons] = useState<string[]>(['']);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [obs, setObs] = useState<string[]>([]);
  const [counter, setCounter] = useState('');
  const [conf, setConf] = useState(0.5);
  const [status, setStatus] = useState<'draft'|'published'>('draft');
  const [busy, setBusy] = useState(false);
  const [warrant, setWarrant] = useState<string>('');
  const [quantifier, setQuantifier] = useState<"SOME"|"MANY"|"MOST"|"ALL"|undefined>();
  const [modality, setModality] = useState<"COULD"|"LIKELY"|"NECESSARY"|undefined>();

  const canSave = claim.trim().length >= 2 && reasons.some(r => r.trim().length > 0) && !busy;

  const updList = (list: string[], setList: (v: string[]) => void, i: number, v: string) => {
    const copy = list.slice(); copy[i] = v; setList(copy);
  };
  const rmAt = (list: string[], setList: (v: string[]) => void, i: number) => {
    const copy = list.slice(); copy.splice(i,1); setList(copy.length ? copy : ['']);
  };

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/deliberations/${deliberationId}/cards`, {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          status,                                  // ✅ respect picker
          claimText: claim.trim(),
          reasonsText: reasons.map(s=>s.trim()).filter(Boolean),
          evidenceLinks: evidence.map(s=>s.trim()).filter(Boolean),
          anticipatedObjectionsText: obs.map(s=>s.trim()).filter(Boolean),
          counterText: counter.trim() || undefined,
          quantifier, modality, confidence: conf, warrantText: warrant,
          hostEmbed, hostId,
        }),
      }).then(r=>r.json());
      if (res?.card?.id && onSaved) onSaved(res.card.id);
      // Optionally: reset form or toast
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <Input value={claim} onChange={e=>setClaim(e.target.value)} placeholder="Claim" onKeyDown={e=>{ if ((e.metaKey||e.ctrlKey)&&e.key==='Enter') save(); }} />
      <div>
        <div className="text-sm font-medium mb-1">Reasons</div>
        {reasons.map((r,i)=>(
          <div key={i} className="flex items-center gap-2 mb-1">
            <Input value={r} onChange={e=>updList(reasons, setReasons, i, e.target.value)} placeholder={`Reason ${i+1}`} />
            <Button variant="ghost" size="sm" onClick={()=>rmAt(reasons, setReasons, i)}>−</Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={()=>setReasons([...reasons, ''])}>+ add reason</Button>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Evidence links (optional)</div>
        {evidence.map((r,i)=>(
          <div key={i} className="flex items-center gap-2 mb-1">
            <Input value={r} onChange={e=>updList(evidence, setEvidence, i, e.target.value)} placeholder="https://…" inputMode="url" />
            <Button variant="ghost" size="sm" onClick={()=>rmAt(evidence, setEvidence, i)}>−</Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={()=>setEvidence([...evidence, ''])}>+ add link</Button>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Anticipated objections (optional)</div>
        {obs.map((r,i)=>(
          <div key={i} className="flex items-center gap-2 mb-1">
            <Input value={r} onChange={e=>updList(obs, setObs, i, e.target.value)} placeholder="Objection…" />
            <Button variant="ghost" size="sm" onClick={()=>rmAt(obs, setObs, i)}>−</Button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={()=>setObs([...obs, ''])}>+ add objection</Button>
      </div>

      <label className="text-xs block mt-2">Warrant (rule that links reasons to claim)
        <Textarea className="w-full text-sm mt-1" value={warrant} onChange={e=>setWarrant(e.target.value)} placeholder='e.g., If expert consensus holds in domain D, accept P unless rebutted' />
      </label>

      {/* Qualifiers */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-neutral-500">Quantifier:</span>
        {(['SOME','MANY','MOST','ALL'] as const).map(q=>(
          <Button key={q} type="button" variant={quantifier===q?'default':'outline'} size="sm" onClick={()=>setQuantifier(q)}>{q}</Button>
        ))}
        <span className="ml-4 text-neutral-500">Modality:</span>
        {(['COULD','LIKELY','NECESSARY'] as const).map(m=>(
          <Button key={m} type="button" variant={modality===m?'default':'outline'} size="sm" onClick={()=>setModality(m)}>{m}</Button>
        ))}
      </div>

      <Input value={counter} onChange={e=>setCounter(e.target.value)} placeholder="Counter (optional)" />

      <div className="flex items-center gap-3">
        <label className="text-sm">How sure:</label>
        <input type="range" min={0} max={1} step={0.05} value={conf} onChange={e=>setConf(parseFloat(e.target.value))} />
        <span className="text-sm">{Math.round(conf*100)}%</span>

        <select value={status} onChange={e=>setStatus(e.target.value as any)} className="border rounded px-2 py-1 text-sm ml-auto">
          <option value="draft">Draft</option>
          <option value="published">Publish</option>
        </select>
        <Button onClick={save} disabled={!canSave} className="text-sm">{busy ? 'Saving…' : 'Save card'}</Button>
      </div>
    </div>
  );
}
