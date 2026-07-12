'use client';
import { useState } from 'react';

export default function BriefCompiler(props: {
  roomId: string;
  createdById: string;
  deliberationId?: string;
  seed?: { overview?: string; positions?: string; evidence?: string; openQuestions?: string; decision?: string };
  seedSources?: { sourceType: 'card'|'argument'|'post'; sourceId: string }[];
}) {
  const [title, setTitle] = useState('');
  const [overview, setOverview] = useState(props.seed?.overview ?? '');
  const [positions, setPositions] = useState(props.seed?.positions ?? '');
  const [evidence, setEvidence] = useState(props.seed?.evidence ?? '');
  const [openQ, setOpenQ] = useState(props.seed?.openQuestions ?? '');
  const [decision, setDecision] = useState(props.seed?.decision ?? '');
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState<string| null>(null);

  async function publish() {
    setBusy(true);
    const b = await fetch('/api/briefs', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ roomId: props.roomId, title, createdById: props.createdById }),
    }).then(r=>r.json());

    const v = await fetch(`/api/briefs/${b.id}/publish`, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({
        createdById: props.createdById,
        compiledFromDeliberationId: props.deliberationId,
        sections: { overview, positions, evidence, openQuestions: openQ, decision },
        citations: [],
        linkSources: props.seedSources ?? [],
        roomId: props.roomId,
      }),
    }).then(r=>r.json());
    setBusy(false);
    setSlug(v.slug);
  }

  return (
    <div className="border rounded p-3 space-y-3">
      <div className="text-sm font-semibold">Compile to brief</div>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Brief title" className="w-full border rounded px-2 py-1" />
      <textarea value={overview} onChange={e=>setOverview(e.target.value)} placeholder="Overview" className="w-full border rounded px-2 py-1 min-h-[90px]" />
      <textarea value={positions} onChange={e=>setPositions(e.target.value)} placeholder="Positions" className="w-full border rounded px-2 py-1 min-h-[90px]" />
      <textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Evidence" className="w-full border rounded px-2 py-1 min-h-[90px]" />
      <textarea value={openQ} onChange={e=>setOpenQ(e.target.value)} placeholder="Open questions" className="w-full border rounded px-2 py-1 min-h-[90px]" />
      <textarea value={decision} onChange={e=>setDecision(e.target.value)} placeholder="Decision / next steps" className="w-full border rounded px-2 py-1 min-h-[90px]" />
      <button onClick={publish} disabled={busy || !title.trim()} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm">
        {busy ? 'Publishing…' : 'Publish brief'}
      </button>
      {slug && (
        <div className="text-sm">
          Published → <a className="underline" href={`/briefs/${slug}`}>/briefs/{slug}</a>
        </div>
      )}
    </div>
  );
}
