'use client';
import { useState, useEffect } from 'react';

export default function SummaryComposer(props: {
  deliberationId: string;
  assigneeId: string;
  assignmentId: string;
  hostType?: 'article'|'post'|'room_thread'|'deliberation';
  hostId?: string;
  onDone?: ()=>void;
}) {
  const [claim, setClaim] = useState('');
  const [reasons, setReasons] = useState<string[]>(['']);
  const [busy, setBusy] = useState(false);

  // Pre-fill with thread context (fetch top arguments / summary if you have an endpoint)
  useEffect(()=> {
    // TODO: call your thread summary API to seed claim/reasons
  }, []);

  async function saveAndComplete() {
    setBusy(true);
    // 1) create a published card
    const cardRes = await fetch(`/api/deliberations/${props.deliberationId}/cards`, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({
        authorId: props.assigneeId,
        status: 'published',
        claimText: claim || 'Bridge summary',
        reasonsText: reasons.filter(Boolean).length ? reasons : ['Summary of the discussion from an outside cluster.'],
        evidenceLinks: [],
        anticipatedObjectionsText: [],
        confidence: 0.7,
        hostEmbed: props.hostType,
        hostId: props.hostId,
      }),
    }).then(r=>r.json());

    // 2) complete assignment + emit amplification
    await fetch(`/api/bridges/assignments/${props.assignmentId}/complete`, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({
        summaryCardId: cardRes.id,
        completedById: props.assigneeId,
        roomId: props.hostId ?? 'room',
        hostType: props.hostType,
        hostId: props.hostId,
        rewardCare: 5,
      }),
    });

    setBusy(false);
    props.onDone?.();
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Write a bridge summary</div>
      <input value={claim} onChange={e=>setClaim(e.target.value)} placeholder="One-sentence summary for outsiders" className="w-full border rounded px-2 py-1" />
      <textarea value={reasons[0]} onChange={e=>setReasons([e.target.value])} placeholder="Key points / what people should know…" className="w-full border rounded px-2 py-2 min-h-[100px]" />
      <button onClick={saveAndComplete} disabled={busy} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm">
        {busy ? 'Submitting…' : 'Submit summary & complete'}
      </button>
    </div>
  );
}
