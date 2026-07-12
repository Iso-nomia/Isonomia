'use client';
import { useState } from 'react';

export default function RequestBridgeButton(props: {
  deliberationId: string;
  roomId: string;
  requestedById: string;
  clusterOptions: { id: string; label: string }[];
}) {
  const [clusterId, setClusterId] = useState(props.clusterOptions[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch('/api/bridges/requests', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({
        deliberationId: props.deliberationId,
        requestedById: props.requestedById,
        targetClusterId: clusterId,
        roomId: props.roomId,
      }),
    }).then(r=>r.json());
    setBusy(false);
    setOk(!!res?.id);
  }

  return (
    <div className="flex items-center gap-2">
      <select value={clusterId} onChange={e=>setClusterId(e.target.value)} className="border rounded px-2 py-1 text-sm">
        {props.clusterOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button onClick={submit} disabled={busy || !clusterId} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">
        {busy ? 'Requesting…' : 'Request outside‑cluster summary'}
      </button>
      {ok && <span className="text-xs text-green-700">Requested ✓</span>}
    </div>
  );
}
