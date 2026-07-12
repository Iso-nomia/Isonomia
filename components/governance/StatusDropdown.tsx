'use client';
import { useState } from 'react';

const OPTIONS = ['OK','NEEDS_SOURCES','WORKSHOP','OFF_TOPIC_REDIRECT','DUPLICATE_MERGE','DISPUTED','OUT_OF_BOUNDS'] as const;
type Opt = typeof OPTIONS[number];

export default function StatusDropdown({
  roomId,
  actorId, // host/steward id; pass from server or inject via header in the API
  targetType,
  targetId,
  initial,
}: {
  roomId: string;
  actorId: string;
  targetType: 'article'|'post'|'room_thread'|'deliberation'|'argument'|'card'|'claim'|'brief'|'brief_version';
  targetId: string;
  initial?: Opt;
}) {
  const [value, setValue] = useState<Opt>(initial ?? 'OK');
  const [busy, setBusy] = useState(false);

  async function update(next: Opt) {
    setBusy(true);
    try {
      const res = await fetch('/api/governance/status', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          roomId, actorId, targetType, targetId,
          newStatus: next,
          reason: 'Host update',
        }),
      });
      if (res.ok) setValue(next);
    } finally { setBusy(false); }
  }

  return (
    <select className="text-xs border rounded px-2 py-1" value={value} onChange={(e)=>update(e.target.value as Opt)} disabled={busy}>
      {OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
