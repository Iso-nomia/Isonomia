// components/deepdive/AddGroundRebut.tsx
'use client';
import { useState } from 'react';
import { mutate } from 'swr';
import { useAsyncButton } from '@/packages/ui/useAsyncButton';


export function AddGround({ claimId, deliberationId, createdById }:{
  claimId: string; deliberationId: string; createdById: string;
}) {
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await fetch(`/api/claims/${claimId}/grounds`, {
      method: 'POST', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ text, createdById, deliberationId }),
    });
    setBusy(false); setText('');
    mutate(`/api/claims/${claimId}/toulmin`);      // refresh Toulmin
    mutate(`/api/deliberations/${deliberationId}/graph?lens=af`); // refresh graph
  };
  return (
    <div className="flex gap-2 items-center">
      <input className="text-xs border rounded px-2 py-1 flex-1" placeholder="Add ground (support)…"
             value={text} onChange={e=>setText(e.target.value)} />
      <button onClick={add} disabled={busy} className="text-xs px-2 py-1 border rounded">Attach</button>
    </div>
  );
}

export function AddRebut({ claimId, deliberationId, createdById }:{
  claimId: string; deliberationId: string; createdById: string;
}) {
  const [text, setText] = useState(''); const [scope, setScope] = useState<'conclusion'|'premise'>('conclusion');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await fetch(`/api/claims/${claimId}/rebut`, {
      method: 'POST', headers: { 'content-type':'application/json' },
      body: JSON.stringify({ text, scope, createdById, deliberationId }),
    });
    setBusy(false); setText('');
    mutate(`/api/claims/${claimId}/toulmin`);
    mutate(`/api/deliberations/${deliberationId}/graph?lens=bipolar`);
  };
  return (
    <div className="flex gap-2 items-center">
      <select className="text-xs border rounded px-2 py-1" value={scope} onChange={e=>setScope(e.target.value as any)}>
        <option value="conclusion">Rebut conclusion (C)</option>
        <option value="premise">Rebut premise (P)</option>
      </select>
      <input className="text-xs border rounded px-2 py-1 flex-1" placeholder="Add rebuttal…"
             value={text} onChange={e=>setText(e.target.value)} />
      <button onClick={add} disabled={busy} className="text-xs px-2 py-1 border rounded">Attach</button>
    </div>
  );
}
