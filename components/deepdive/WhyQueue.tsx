'use client';
import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function WhyQueue({
  deliberationId, actorId,
}: {
  deliberationId: string;
  actorId: string;
}) {
  const { data, mutate } = useSWR(`/api/dialogue/move?deliberationId=${deliberationId}`, fetcher, { refreshInterval: 15000 });
  const [link, setLink] = useState('');

  const moves = (data?.moves ?? []) as any[];
  // Open WHYs are those without a later GROUNDS/RETRACT on same target
  const openWhys = moves.filter(m => m.kind === 'WHY').filter(m => {
    const later = moves.filter(x => x.targetType === m.targetType && x.targetId === m.targetId && x.createdAt > m.createdAt);
    return !later.some(x => x.kind === 'GROUNDS' || x.kind === 'RETRACT');
  });

  async function submitGrounds(targetType: string, targetId: string) {
    if (!link.trim()) { alert('Provide a link or short grounds.'); return; }
    const payload = { link };
    const res = await fetch('/api/dialogue/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliberationId, targetType, targetId, kind: 'GROUNDS', payload, actorId }),
    });
    if (res.ok) { setLink(''); mutate(); }
  }

  if (openWhys.length === 0) return null;

  return (
    <div className="rounded border p-3 text-sm space-y-2">
      <div className="font-medium">Open “Why?” requests</div>
      {openWhys.map((m: any) => {
        const due = m.payload?.deadlineAt ? new Date(m.payload.deadlineAt) : null;
        return (
          <div key={m.id} className="flex flex-col gap-1 border-t pt-2">
            <div className="text-xs text-slate-600">
              Target: {m.targetType} #{m.targetId} · {due ? `Respond by ${due.toLocaleString()}` : null}
            </div>
            <div className="flex gap-2">
              <input className="text-xs border rounded px-2 py-1 flex-1"
                     placeholder="Paste source link / explain grounds"
                     value={link} onChange={e=>setLink(e.target.value)} />
              <button className="text-xs px-2 py-1 border rounded" onClick={()=>submitGrounds(m.targetType, m.targetId)}>Provide grounds</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
