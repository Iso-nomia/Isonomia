// components/agora/UndercutPill.tsx
'use client';
import React from 'react';

export default function UndercutPill({
  toArgumentId,
  targetInferenceId,
  deliberationId,
  fromArgumentId,        // optional
  toDiagramId,  
}: {
  toArgumentId: string;
  targetInferenceId: string;
  deliberationId: string;
  fromArgumentId?: string;
   toDiagramId?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  async function send() {
        if (!deliberationId || !toArgumentId) {
      console.warn('Undercut blocked: missing ids', { deliberationId, toArgumentId, toDiagramId, targetInferenceId });
      alert('Missing IDs to undercut (argument or deliberation).');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/attacks/undercut', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
           deliberationId, toArgumentId, targetInferenceId, toDiagramId,
          ...(fromArgumentId ? { fromArgumentId } : { fromText: 'Undercut: the inference is not licensed.' }),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      window.dispatchEvent(new CustomEvent('dialogue:changed'));
    } catch (e) {
      console.error(e);
      alert('Failed to create undercut');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className="ml-2 text-[10px] px-2 py-[2px] rounded-full border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
      onClick={send}
      disabled={busy}
      title="Undercut this inference (attack the inference step)"
    >
      {busy ? '…' : 'Undercut'}
    </button>
  );
}
