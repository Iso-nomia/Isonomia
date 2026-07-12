// components/rhetoric/SaveHighlights.tsx
'use client';
import { useState } from 'react';

export default function SaveHighlights({
  targetType, targetId, highlights
}: {
  targetType: 'argument'|'claim';
  targetId: string;
  highlights: Array<{ kind: string; text: string; start: number; end: number }>;
}) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  async function save() {
    setPending(true); setMsg(null);
    try {
      const res = await fetch('/api/argument-annotations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, highlights }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg('Saved ✓');
    } catch (e: any) {
      setMsg(e?.message ?? 'Failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-xs flex items-center gap-2">
      <button className="btnv2" onClick={save} disabled={pending}>
        {pending ? 'Saving…' : 'Save highlights'}
      </button>
      {msg && <span className="text-neutral-500">{msg}</span>}
    </div>
  );
}
