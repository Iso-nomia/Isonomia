// components/kb/KbBlockRenderer.tsx
'use client';
import * as React from 'react';
import { ProvenanceChip } from './ProvenanceChip';
import { TextBlock } from './blocks/TextBlock';

export function KbBlockRenderer({
  block, hydrated, canEdit, onTogglePin, onUpdate
}: { block:any; hydrated:any; canEdit?:boolean; onTogglePin?:(env:any)=>void; onUpdate?:()=>void }) {
  const t = block.type as string;

  function PinToggle() {
    if (!canEdit) return null;
    if (!hydrated) return null;
    const live = hydrated?.live !== false;
    return (
      <button
        onClick={()=>onTogglePin?.(hydrated)}
        className="ml-2 text-[11px] underline"
        title={live ? 'Pin this block (freeze as‑of)' : 'Unpin (return to live)'}
      >
        {live ? 'Pin' : 'Unpin'}
      </button>
    );
  }

  // TEXT - Use enhanced TextBlock component
  if (t === 'text') {
    return <TextBlock block={block} canEdit={canEdit} onUpdate={onUpdate} />;
  }
if (hydrated && hydrated.kind === 'error') {
  return (
    <div className="rounded-lg border bg-amber-50/70 p-3 text-xs text-amber-800">
      Could not resolve this block ({block.type}). {hydrated.message ? `Reason: ${hydrated.message}` : ''}
    </div>
  );
}
  if (!hydrated) {
    return <div className="rounded-lg border bg-white/60 p-3 text-xs text-slate-500">Loading…</div>;
  }

  // IMAGE
  if (t === 'image') {
    const src = String(block?.dataJson?.src ?? '');
    const alt = String(block?.dataJson?.alt ?? '');
    return (
      <figure className="rounded-lg border bg-white/80 p-3">
        {src ? <img src={src} alt={alt} className="max-w-full rounded" /> : <div className="text-xs text-slate-500">No image</div>}
        {alt && <figcaption className="text-[11px] text-slate-600 mt-1">{alt}</figcaption>}
      </figure>
    );
  }

  // LINK
  if (t === 'link') {
    const href = String(block?.dataJson?.href ?? '');
    const text = String(block?.dataJson?.text ?? href);
    return (
      <div className="rounded-lg border bg-white/80 p-3 text-sm">
        {href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{text}</a> : 'No link'}
      </div>
    );
  }

  // CLAIM
  if (t === 'claim' && hydrated.kind === 'claim') {
    const d = hydrated.data || {};
    return (
      <div className="rounded-lg border bg-white/80 p-4">
        <div className="text-sm font-medium">{d.text || '—'}</div>
        <div className="mt-1 text-xs text-slate-600">Bel {pct(d.bel)} • Pl {pct(d.pl)}</div>
        {!!(d.top?.length) && (
          <ul className="mt-1 text-xs text-slate-700 list-disc pl-4">
            {d.top.slice(0,3).map((x:any) => <li key={x.argumentId}>arg {x.argumentId.slice(0,8)}… · {pct(x.score)}</li>)}
          </ul>
        )}
        <div className="mt-2"><ProvenanceChip  item={hydrated} blockId={block.id} canToggle={true}  />
              <PinToggle/>
</div>
      </div>
    );
  }

  // ARGUMENT
  if (t === 'argument' && hydrated.kind === 'argument') {
    return (
      <div className="rounded-lg border bg-white/80 p-4">
        <div className="text-sm font-medium mb-2">Argument (diagram)</div>
        <pre className="text-[11px] bg-slate-50 border rounded p-2 overflow-auto max-h-56">
          {JSON.stringify(hydrated.data?.diagram, null, 2)}
        </pre>
        <div className="mt-2"><ProvenanceChip  item={hydrated} blockId={block.id} canToggle={true}  />
              <PinToggle/>
</div>
      </div>
    );
  }

  // ROOM SUMMARY
  if (t === 'room_summary' && hydrated.kind === 'room_summary') {
    const claims = hydrated.data?.claims || [];
    return (
      <div className="rounded-lg border bg-white/80 p-4">
        <div className="text-sm font-medium mb-2">Room summary</div>
        <ul className="text-xs space-y-1">
          {claims.map((c:any) => (
            <li key={c.id} className="flex justify-between gap-2">
              <span className="truncate">{c.text}</span>
              <span className="text-slate-600">{pct(c.bel ?? c.score)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2"><ProvenanceChip item={hydrated} blockId={block.id} canToggle={true} />
      <PinToggle/>
      </div>
      </div>
    );
  }
   if (t === 'theory_work' && hydrated.kind === 'theory_work') {
  const m = hydrated.data?.meta || {};
  const integrity = hydrated.data?.integrity;
  return (
    <div className="rounded border p-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="font-medium">{m.title}</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100">{m.theoryType}</span>
      </div>
      {hydrated.lens !== 'full' && m.summary && <p className="text-sm mt-1">{m.summary}</p>}
      {integrity && (
        <div className="mt-2 text-[11px] text-slate-600">
          Integrity: {Math.round((integrity.completion ?? 0)*100)}%
        </div>
      )}
      <a className="text-xs underline mt-2 inline-block" href={`/works/${m.id}`}>Open Work</a>
    </div>
  );
}

  // SHEET
  if (t === 'sheet' && hydrated.kind === 'sheet') {
    const s = hydrated.data || {};
    return (
      <div className="rounded-lg border bg-white/80 p-4">
        <div className="text-sm font-medium mb-2">{s?.title ?? 'Sheet'}</div>
        <pre className="text-[11px] bg-slate-50 border rounded p-2 overflow-auto max-h-56">
          {JSON.stringify(s, null, 2)}
        </pre>
        <div className="mt-2"><ProvenanceChip  item={hydrated} blockId={block.id} canToggle={true} />
              <PinToggle/>
</div>
      </div>
    );
  }

  // TRANSPORT
  if (t === 'transport' && hydrated.kind === 'transport') {
    const m = hydrated.data?.claimMap || {};
    const pairs = Object.entries(m) as Array<[string, string]>;
    return (
      <div className="rounded-lg border bg-white/80 p-4">
        <div className="text-sm font-medium mb-2">Room functor map</div>
        {pairs.length ? (
          <ul className="text-xs space-y-1">
            {pairs.map(([a,b]) => <li key={a}><code>{a.slice(0,8)}…</code> → <code>{b.slice(0,8)}…</code></li>)}
          </ul>
        ) : <div className="text-xs text-slate-500">No mapped claims yet.</div>}
        <div className="mt-2"><ProvenanceChip  item={hydrated} blockId={block.id} canToggle={true}  />
              <PinToggle/>
</div>
      </div>
    );
  }

  return <div className="rounded-lg border bg-white/60 p-3 text-xs text-amber-600">Unsupported block type</div>;
}

function pct(x:number) { return `${Math.round((x ?? 0)*100)}%`; }
