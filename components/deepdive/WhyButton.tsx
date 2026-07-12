'use client';
import { useState } from 'react';

export default function WhyButton({
  deliberationId, targetType, targetId, actorId,
}: {
  deliberationId: string;
  targetType: 'argument'|'claim';
  targetId: string;
  actorId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    const res = await fetch('/api/dialogue/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliberationId, targetType, targetId, kind: 'WHY', actorId }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) setDeadline(json.move?.payload?.deadlineAt ?? null);
    else alert(json.error ?? 'Failed');
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={ask} disabled={busy} className="text-xs underline">
        {busy ? 'Asking…' : 'Ask why'}
      </button>
      {deadline && (
        <span className="text-[11px] text-slate-600" title="Respond with grounds or retract">
          Respond by {new Date(deadline).toLocaleString()}
        </span>
      )}
    </span>
  );
}
