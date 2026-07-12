'use client';
import * as React from 'react';

type Slot = 'ground'|'warrant'|'backing'|'qualifier'|'rebuttal';

const MICRO: Record<Slot, string> = {
  ground:    'Facts/data that directly support the claim.',
  warrant:   'General rule that licenses the inference from grounds to claim.',
  backing:   'Citations, studies, or authorities supporting the warrant.',
  qualifier: 'Strength: SOME/MANY/MOST/ALL and COULD/LIKELY/NECESSARY.',
  rebuttal:  'Exceptions/objections limiting or defeating the conclusion.',
};

export default function InlineSlotEditor({
  argumentId, deliberationId, claimId,
  slot, initialText = '',
  onSaved, onCancel,
}: {
  argumentId: string;
  deliberationId?: string;
  claimId?: string;
  slot: Slot;
  initialText?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [text, setText] = React.useState(initialText);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string|null>(null);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/monological/slots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ argumentId, deliberationId, claimId, slot, text }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved?.();
      // let other panels refresh (Toolbar listens for this)
     window.dispatchEvent(new CustomEvent('monological:slots:changed', {
       detail: { argumentId }
     }));
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded border bg-white p-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold capitalize">{slot}</div>
        <div className="text-[11px] text-neutral-500" title={MICRO[slot]}>
          What counts as {slot}? 
        </div>
      </div>
      <textarea
        className="mt-2 w-full border rounded px-2 py-1 text-sm"
        rows={3}
        placeholder={MICRO[slot]}
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={busy}
      />
      {err && <div className="text-[11px] text-rose-600 mt-1">{err}</div>}
      <div className="mt-2 flex gap-2 justify-start">
        <button className="px-2 py-1 border rounded text-xs" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="px-2 py-1 border rounded text-xs bg-emerald-600 text-white disabled:opacity-60"
          onClick={save} disabled={busy || text.trim().length < 2}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
