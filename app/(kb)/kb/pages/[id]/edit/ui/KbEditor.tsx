'use client';

import * as React from 'react';
import useSWR from 'swr';
import TextBlockLexical from './TextBlockLexical';
import { KbBlockRenderer } from '@/components/kb/KbBlockRenderer';
import { EntityPicker } from '@/components/kb/EntityPicker';
import { TransportComposer } from '@/components/kb/TransportComposer';

type Block = {
  id: string; pageId: string; ord: number; type: string; live: boolean;
  dataJson: any; pinnedJson?: any; updatedAt: string;
};

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function KbEditor({ pageId, spaceId }:{ pageId:string; spaceId:string }) {
  const { data, mutate } =
    useSWR<{ ok:boolean; blocks: Block[] }>(`/api/kb/pages/${pageId}/blocks`, fetcher, { revalidateOnFocus:false });

  const blocks = data?.blocks ?? [];

  /** ---------- Add blocks (with pickers) ---------- */
  const [picker, setPicker] =
    React.useState<null|{kind:'claim'|'argument'|'room'|'sheet'|'transport'|'theory_work'}>(null);

//   async function createBlock(type: string, data?: any) {
//     // Normalize text payloads to { md, lexical }
//     const payload = type === 'text' ? { md: String(data?.md ?? ''), lexical: data?.lexical ?? null } : (data ?? {});
//     await fetch(`/api/kb/blocks`, {
//       method:'POST',
//       headers:{ 'Content-Type':'application/json' },
//       body: JSON.stringify({ pageId, type, data: payload })
//     });
//     mutate();
//   }

    async function createBlock(type: string, data?: any) {
    await fetch(`/api/kb/blocks`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ pageId, type, data })
    });
    mutate();
  }

  /** ---------- Drag-to-reorder ---------- */
  const [dragId, setDragId] = React.useState<string|null>(null);
  const [order, setOrder] = React.useState<string[]>([]);

  // Keep a local list of ids mirroring the server order
  React.useEffect(() => {
    setOrder(blocks.map(b => b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(blocks.map(b => b.id))]);

  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(id: string, e: React.DragEvent) {
    e.preventDefault();
    if (!dragId || dragId === id) return;
    setOrder(cur => {
      const next = [...cur];
      const from = next.indexOf(dragId);
      const to   = next.indexOf(id);
      if (from < 0 || to < 0 || from === to) return cur;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }
  async function onDrop() {
    if (!dragId) return;
    setDragId(null);
    await fetch(`/api/kb/pages/${pageId}/reorder`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ order })
    });
    mutate();
  }

  /** ---------- Text save (Lexical) ---------- */
  async function saveText(blockId: string, lexicalJson: any, md: string) {
    await fetch(`/api/kb/blocks/${blockId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ dataJson: { lexical: lexicalJson, md } })
    });
    mutate();
  }


  /** ---------- Fallback prompt creators (Ctrl-/ menu) ---------- */
  function promptAndCreate(kind: 'claim'|'argument'|'sheet'|'room_summary'|'transport'|'image'|'link'|'theory_work') {
    const ask = (q: string) => window.prompt(q) || '';
    if (kind === 'image')        return createBlock('image', { src:'', alt:'' });
    if (kind === 'link')         return createBlock('link',  { href:'https://', text:'' });
    if (kind === 'claim')        return createBlock('claim', { id: ask('Claim id (φ)…'), lens:'belpl' });
    if (kind === 'argument')     return createBlock('argument', { id: ask('Argument id (A0)…') });
    if (kind === 'sheet')        return createBlock('sheet', { id: ask('Sheet id…') });
    if (kind === 'room_summary') return createBlock('room_summary', { id: ask('Deliberation (room) id…'), limit: 5 });
    if (kind === 'theory_work')  return createBlock('theory_work', { workId: ask('Theory Work id…'), lens:'summary' });
    if (kind === 'transport')    return createBlock('transport', { fromId: ask('From room id…'), toId: ask('To room id…') });
  }

  /** ---------- Render ---------- */
  const orderedBlocks = order.length
    ? order.map(id => blocks.find(b => b.id === id)).filter(Boolean) as Block[]
    : blocks;

  return (
    <div className="space-y-4">

      {/* --- Toolbar --- */}
      <div className="flex items-center gap-2">
        <select
          onChange={(e) => {
            const v = e.target.value as any;
            if (v === 'text')          createBlock('text', { md: '' });
            else if (v === 'image')    createBlock('image', { src:'', alt:'' });
            else if (v === 'link')     createBlock('link',  { href:'https://', text:'' });
            else if (v === 'transport') setPicker({ kind:'transport' });
            else if (v)                setPicker({ kind: v }); // claim | argument | sheet | room
            e.target.value = '';
          }}
          defaultValue=""
          className="px-2 py-1 menuv2--lite tracking-wide text-xs "
        >
          <option value="" disabled>Add Block</option>
          <option value="text">Text</option>
          <option value="image">Image</option>
          <option value="link">Link</option>
          <option value="claim">Claim</option>
          <option value="argument">Argument</option>
          <option value="theory_work">Theory Work</option>

          <option value="sheet">Sheet</option>
          <option value="room">Room summary</option>
          <option value="transport">Transport</option>
        </select>

        {/* Pickers */}
        {picker?.kind === 'claim' && (
          <EntityPicker
            kind="claim" open onClose={()=>setPicker(null)}
            onPick={(it)=>createBlock('claim', { id: it.id, lens:'belpl', roomId: it.roomId })}
          />
        )}
        {picker?.kind === 'argument' && (
          <EntityPicker
            kind="argument" open onClose={()=>setPicker(null)}
            onPick={(it)=>createBlock('argument', { id: it.id })}
          />
        )}
        {picker?.kind === 'sheet' && (
          <EntityPicker
            kind="sheet" open onClose={()=>setPicker(null)}
            onPick={(it)=>createBlock('sheet', { id: it.id })}
          />
        )}
        {picker?.kind === 'room' && (
          <EntityPicker
            kind="room" open onClose={()=>setPicker(null)}
            onPick={(it)=>createBlock('room_summary', { id: it.id, limit: 5 })}
          />
        )}
{picker?.kind === 'theory_work' && (
  <EntityPicker
    kind="theory_work" open onClose={()=>setPicker(null)}
    onPick={(it)=>createBlock('theory_work', { workId: it.id, lens:'summary' })}
  />
)}
        {picker?.kind === 'transport' && (
          <TransportComposer open onClose={()=>setPicker(null)} onCreate={(fromId, toId)=>{
            createBlock('transport', { fromId, toId });
          }}/>
        )}

       

        <a className="ml-auto text-xs btnv2 rounded-full px-4 bg-white/80 font-medium text-slate-900 "
           href={`/api/kb/pages/${pageId}/export?as=md`} target="_blank" rel="noopener noreferrer">
          Export
        </a>
      </div>

      {/* --- One canonical, draggable list --- */}
      <ul className="space-y-4" onDrop={onDrop}>
        {orderedBlocks.map(b => (
          <li
            key={b.id}
            draggable
            onDragStart={()=>onDragStart(b.id)}
            onDragOver={(e)=>onDragOver(b.id, e)}
            className="border rounded-lg shadow-md bg-white/80 px-3 py-2 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] uppercase tracking-wide text-slate-600">
                <span className="inline-block mr-2 text-sm select-none">≡</span>{b.type}
                {!b.live && (
                  <span className="ml-2 px-1.5 py-[1px] rounded bg-amber-50 border border-amber-200 text-amber-700">
                    pinned
                  </span>
                )}
              </div>
              {['claim','argument','sheet','room_summary','transport'].includes(b.type) && (
                <BlockToolbar b={b} onPinned={mutate} />
              )}
            </div>

            {b.type === 'text' ? (
              <TextBlockLexical
                blockId={b.id}
                initialState={b.dataJson?.lexical ?? null}
                onInsertBlock={(k)=>promptAndCreate(k)}
                onSave={(json, md)=>saveText(b.id, json, md)}
              />
            ) : (
              <EditorStructuredPreview
                spaceId={spaceId}
                block={b}
              />
            )}
          </li>
        ))}
      </ul>

      {blocks.length === 0 && (
        <div className="rounded border border-dashed p-6 text-sm text-slate-600">
          This page has no content yet. Add a block to start, then embed claims, arguments, sheets, a room summary, or a transport map.
        </div>
      )}
    </div>
  );
}

/** ---------- Structured preview (single-item transclude) ---------- */
function EditorStructuredPreview({ spaceId, block }:{
  spaceId:string; block:any;
}) {
  const [env, setEnv] = React.useState<any|null>(null);
  const [err, setErr] = React.useState<string|undefined>();

  React.useEffect(() => {
    (async () => {
      setErr(undefined);

      if (!spaceId) { setEnv(null); return; }

      // Pinned → trust local pinnedJson
      if (block.live === false && block.pinnedJson) { setEnv(block.pinnedJson); return; }

      // Build one-item request for transclusion
      const d = block.dataJson || {};
      const item =
        block.type === 'claim'        ? (d.id ? { kind:'claim', id:d.id, lens:d.lens, roomId:d.roomId } : null) :
        block.type === 'argument'     ? (d.id ? { kind:'argument', id:d.id, lens:d.lens } : null) :
        block.type === 'sheet'        ? (d.id ? { kind:'sheet', id:d.id, lens:d.lens } : null) :
        block.type === 'room_summary' ? (d.id ? { kind:'room_summary', id:d.id, lens:d.lens, limit:d.limit ?? 5 } : null) :
        
        block.type === 'transport'    ? (d.fromId && d.toId ? { kind:'transport', fromId:d.fromId, toId:d.toId, lens:d.lens ?? 'map' } :null) :
        block.type === 'theory_work'
    ? (block.dataJson?.workId
        ? { kind:'theory_work', id:block.dataJson.workId, lens:block.dataJson.lens ?? 'summary' }
        : null) :
        null;

      if (!item) { setEnv(null); return; }

      const r = await fetch('/api/kb/transclude', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ spaceId, eval:{mode:'product',imports:'off'}, at:null, items:[item] })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) {
        setErr(j?.error || `HTTP ${r.status}`);
        setEnv({ kind:'error', message: j?.error || 'resolve_failed' });
        return;
      }
      if (Array.isArray(j.errors) && j.errors.length) {
        setErr(j.errors[0]?.message || j.errors[0]?.code || 'resolve_failed');
        setEnv({ kind:'error', message: j.errors[0]?.code ?? 'error' });
        return;
      }
      setEnv(Array.isArray(j?.items) ? j.items[0] : null);
    })();
  }, [spaceId, block.id, block.live, JSON.stringify(block.dataJson)]);

  return <KbBlockRenderer block={block} hydrated={env} />;
}

/** ---------- Pin / Unpin (editor-side) ---------- */
function BlockToolbar({ b, onPinned }: { b:any; onPinned:()=>void }) {
  const [busy, setBusy] = React.useState(false);


  async function resolveEnvForSnapshot() {
    // Use the same “one-item” transclusion used by the preview
    const d = b.dataJson || {};
    const item =
      b.type === 'theory_work' && d.workId ? { kind:'theory_work', id:d.workId, lens:d.lens ?? 'summary' } :
      b.type === 'claim' && d.id ? { kind:'claim', id:d.id, lens:d.lens, roomId:d.roomId } :
      b.type === 'argument' && d.id ? { kind:'argument', id:d.id, lens:d.lens } :
      b.type === 'sheet' && d.id ? { kind:'sheet', id:d.id, lens:d.lens } :
      b.type === 'room_summary' && d.id ? { kind:'room_summary', id:d.id, lens:d.lens, limit:d.limit ?? 5 } :
      b.type === 'transport' && d.fromId && d.toId ? { kind:'transport', fromId:d.fromId, toId:d.toId, lens:d.lens ?? 'map' } :
      null;

    if (!item) return null;

    const r = await fetch('/api/kb/transclude', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ items:[item] })
    });
    const j = await r.json().catch(()=>({}));
    return Array.isArray(j?.items) ? j.items[0] : null;
  }

  const pinNow = async () => {
    setBusy(true);
    // TIP: we could reuse the latest env from preview, but safest is to refetch now.
    await fetch(`/api/kb/blocks/${b.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ live:false, pinnedJson: b.pinnedJson ?? null })
    });
    setBusy(false); onPinned();
  };
  const unpin = async () => {
    setBusy(true);
    await fetch(`/api/kb/blocks/${b.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ live:true, pinnedJson: null })
    });
    setBusy(false); onPinned();
  };
  return (
    <div className="text-[11px]">
      {b.live ? (
        <button disabled={busy} onClick={pinNow} className="underline">{busy ? 'pinning…' : 'Pin (freeze)'}</button>
      ) : (
        <button disabled={busy} onClick={unpin} className="underline">{busy ? 'unpinning…' : 'Unpin (live)'}</button>
      )}
    </div>
  );
}
