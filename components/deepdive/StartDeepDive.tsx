'use client';
import { useState } from 'react';
import DeepDivePanel from './DeepDivePanel';

export default function StartDeepDive({
  hostType, hostId, roomId
}: { hostType: 'post'|'room_thread'|'article'|'library_stack'|'site'|'work'| 'free' | 'discussion' | 'inbox_thread'; hostId: string; roomId?: string | null }) {
  const [delibId, setDelibId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const start = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/deliberations/upsert', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ hostType, hostId, roomId: roomId ?? null })
      });
      const data = await res.json();
      if (data.deliberationId) setDelibId(data.deliberationId);
      else alert(data.error ?? 'Could not start Deep‑dive');
    } finally {
      setPending(false);
    }
  };

  if (delibId) return <DeepDivePanel deliberationId={delibId} />;

  return (
    <button onClick={start} disabled={pending} className="px-3 py-2 rounded border">
      {pending ? 'Starting…' : 'Start a Deep‑dive'}
    </button>
  );
}
