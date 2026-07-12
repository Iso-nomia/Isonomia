// app/(dashboard)/rooms/[id]/settings/SovereigntyPanel.tsx
'use client';
import { useState, useEffect } from 'react';
import { useDecentraliseStatus } from '@/components/rooms/useDecentraliseStatus';
export function SovereigntyPanel({ roomId }: { roomId: string }) {
  const [tier, setTier] = useState<'pooled'|'sovereign'|'portable'|'byoc'>('pooled');
  const [region, setRegion] = useState('us-east-1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const progress = useDecentraliseStatus(roomId);


  async function decentralise(kind: 'CONVERSATION'|'REALTIME') {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/rooms/${roomId}/decentralise`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region, kind })
    });
    setBusy(false);
    if (!r.ok) { setMsg('Failed to start decentralise'); return; }
    const json = await r.json();
    setMsg(`Started job ${json.jobId}`);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sovereignty</h3>
      <div className="flex gap-2">
        <button className={`px-2 py-1 rounded ${tier==='pooled'?'bg-gray-200':''}`} onClick={()=>setTier('pooled')}>Pooled</button>
        <button className={`px-2 py-1 rounded ${tier==='sovereign'?'bg-gray-200':''}`} onClick={()=>setTier('sovereign')}>Sovereign</button>
        <button className={`px-2 py-1 rounded ${tier==='portable'?'bg-gray-200':''}`} onClick={()=>setTier('portable')}>Portable</button>
        <button className={`px-2 py-1 rounded opacity-60`} disabled>BYOC (soon)</button>
      </div>
      <div>
        <label className="mr-2">Region</label>
        <select value={region} onChange={e=>setRegion(e.target.value)} className="border rounded px-2 py-1">
          <option>us-east-1</option>
          <option>us-west-2</option>
          <option>eu-central-1</option>
        </select>
      </div>
      {progress && (
  <div className="text-sm">
    <div>Step: <b>{progress.step}</b> {progress.status && `(${progress.status})`}</div>
    {progress.step === 'verify' && (
      <div>Parity {progress.table}: {progress.src} → {progress.dst} {progress.ok ? '✓' : '✕'}</div>
    )}
    {progress.step === 'done' && (
      <div>Receipt: s3://{progress.bucket}/{progress.receiptKey}</div>
    )}
  </div>
)}
      <div className="flex gap-2">
        <button disabled={busy} className="px-3 py-2 bg-black text-white rounded" onClick={()=>decentralise('CONVERSATION')}>Decentralise (Conversation)</button>
        <button disabled={busy} className="px-3 py-2 bg-black text-white rounded" onClick={()=>decentralise('REALTIME')}>Decentralise (Realtime)</button>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
    </div>
  );
}
