// 'use client';
// import { useState } from 'react';

// export default function CitePickerInline({
//   deliberationId,
//   claimId: initialClaimId,
//   argumentText, // used only if we need to promote
//   onDone,
// }: {
//   deliberationId: string;
//   claimId?: string;
//   argumentText?: string;
//   onDone?: () => void;
// }) {
//   const [url, setUrl] = useState('');
//   const [excerpt, setExcerpt] = useState('');
//   const [pending, setPending] = useState(false);
//   const [msg, setMsg] = useState<string | null>(null);

//   async function run() {
//     setPending(true); setMsg(null);
//     try {
//       let claimId = initialClaimId;

//       // Promote to claim if no claimId provided
//       if (!claimId) {
//         if (!argumentText?.trim()) throw new Error('Argument text required to promote');
//         const r = await fetch('/api/claims', {
//           method: 'POST',
//           headers: {'content-type':'application/json'},
//           body: JSON.stringify({ deliberationId, text: argumentText }),
//         });
//         const d = await r.json();
//         if (!r.ok) throw new Error(d?.error ?? 'promote failed');
//         claimId = d?.claim?.id;
//       }

//       // Snapshot + excerpt hash
//       const snap = await fetch('/api/snapshots', {
//         method: 'POST',
//         headers: {'content-type':'application/json'},
//         body: JSON.stringify({ url, excerpt }),
//       }).then(r=>r.json());
//       if (snap.error) throw new Error(snap.error);

//       // Create citation
//       const cit = await fetch(`/api/claims/${claimId}/citations`, {
//         method: 'POST',
//         headers: {'content-type':'application/json'},
//         body: JSON.stringify({
//           uri: url,
//           excerptHash: snap.excerptHash,
//           snapshotKey: snap.snapshotKey,
//         }),
//       }).then(r=>r.json());
//       if (cit.error) throw new Error(cit.error);

//       setMsg('Citation attached ✓');
//       onDone?.();
//       setUrl(''); setExcerpt('');
//     } catch (e: any) {
//       setMsg(e?.message ?? 'Failed to cite');
//     } finally {
//       setPending(false);
//     }
//   }

//   return (
//     <div className="mt-2 z-[5000] w-[300px] rounded border p-2 space-y-2 bg-white">
//       <input
//         className="w-full border rounded px-2 py-1 text-sm"
//         placeholder="Source URL"
//         value={url}
//         onChange={(e)=>setUrl(e.target.value)}
//       />
//       <textarea
//         className="w-full border rounded px-2 py-1 text-sm"
//         rows={3}
//         placeholder="Paste exact excerpt"
//         value={excerpt}
//         onChange={(e)=>setExcerpt(e.target.value)}
//       />
//       <div className="flex items-center gap-2">
//         <button
//           className="text-xs px-2 py-1 rounded bg-amber-500 text-white disabled:opacity-50"
//           disabled={pending || !url || !excerpt}
//           onClick={run}
//         >
//           {pending ? 'Attaching…' : 'Attach citation'}
//         </button>
//         {msg && <div className="text-xs text-neutral-600">{msg}</div>}
//       </div>
//     </div>
//   );
// }
// components/citations/CitePickerInline.tsx
"use client";
import React from 'react';

export default function CitePickerInline({
  deliberationId, argumentText, initialUrl, onDone, onAttach,
  targetType = 'argument', targetId,
}: {
  deliberationId: string;
  argumentText?: string;
  initialUrl?: string;
  onDone?: ()=>void;
  onAttach?: (sourceId:string)=>void;
  targetType: 'argument'|'claim'|'card'|'comment'|'move';
  targetId: string;
}) {
  const [q, setQ] = React.useState(initialUrl ?? '');
  const [libResults, setLibResults] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);

  async function resolveAndAttach(payload: any) {
    setBusy(true);
    try {
      const r = await fetch('/api/citations/resolve', {
        method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload)
      });
      const { source } = await r.json();
      await fetch('/api/citations/attach', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ targetType, targetId, sourceId: source.id })
      });
      window.dispatchEvent(new CustomEvent('citations:changed', { detail: { targetType, targetId } }));
      onAttach?.(source.id); onDone?.();
    } finally { setBusy(false); }
  }

  async function onPaste() {
    const v = q.trim();
    if (!v) return;
    if (/^10\.\d{4,9}\/\S+/i.test(v)) return resolveAndAttach({ doi: v });
    if (/^https?:\/\//i.test(v))     return resolveAndAttach({ url: v, fallback: { title: v } });
  }

  async function searchLibrary() {
    const res = await fetch(`/api/library/search?q=${encodeURIComponent(q)}`);
    const j = await res.json().catch(()=>({items:[]}));
    setLibResults(j.items || []);
  }

  return (
    <div className="rounded border p-2 space-y-2 bg-white">
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1 text-sm flex-1"
               placeholder="Paste DOI / URL…"
               value={q} onChange={e=>setQ(e.target.value)} />
        <button className="px-2 py-1 text-sm border rounded" onClick={onPaste} disabled={busy}>Cite</button>
        <button className="px-2 py-1 text-sm border rounded" onClick={searchLibrary}>Search Library</button>
      </div>

      {!!libResults.length && (
        <div className="max-h-40 overflow-y-auto border rounded">
          {libResults.map((p:any)=>(
            <div key={p.id} className="px-2 py-1 text-sm flex items-center justify-between border-b last:border-0">
              <span className="truncate mr-2">{p.title || p.file_url}</span>
              <button className="px-2 py-0.5 text-xs border rounded"
                      onClick={()=>resolveAndAttach({ libraryPostId: p.id, fallback: { title: p.title } })}>
                Use
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
