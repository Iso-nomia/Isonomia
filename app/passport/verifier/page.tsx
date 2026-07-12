// app/passport/verifier/page.tsx
'use client';
import { useState } from 'react';

export default function VerifierPage() {
  const [payload, setPayload] = useState('');
  const [signature, setSignature] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function verify() {
    const r = await fetch('/api/dev/verify', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ payload: JSON.parse(payload), signature }) });
    const json = await r.json();
    setResult(json.valid ? 'VALID' : 'INVALID');
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Verifier</h1>
      <textarea className="w-full border p-2" rows={8} placeholder="manifest.json" value={payload} onChange={e=>setPayload(e.target.value)} />
      <input className="w-full border p-2" placeholder="export.signature (base64)" value={signature} onChange={e=>setSignature(e.target.value)} />
      <button className="px-3 py-2 bg-black text-white rounded" onClick={verify}>Verify</button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
