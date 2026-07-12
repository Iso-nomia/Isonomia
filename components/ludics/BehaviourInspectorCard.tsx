'use client';

import * as React from 'react';

type Mode = 'assoc'|'partial'|'spiritual';
type Badge = 'ok'|'warn'|'err';

 const fetchJSON = async <T,>(url: string, init?: RequestInit): Promise<T> => {
       const r = await fetch(url, { cache: 'no-store', ...(init ?? {}) });
       let j: any = null;
       try { j = await r.json(); } catch {}
       if (!r.ok) {
         const msg = j?.error || j?.reason || r.statusText || r.status;
         throw new Error(`${msg} @ ${url}`);
       }
       return j as T;
     };

function Chip({ kind='ok', children }:{ kind?: Badge; children: React.ReactNode }) {
  const cls = kind==='ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : kind==='warn' ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-rose-50 border-rose-200 text-rose-700';
  return <span className={`px-1.5 py-0.5 rounded border text-[11px] ${cls}`}>{children}</span>;
}

export function BehaviourInspectorCard({ deliberationId }: { deliberationId: string }) {
    const dialogueId = deliberationId;
  const [mode, setMode] = React.useState<Mode>('assoc');
  const [busy, setBusy] = React.useState<boolean>(false);

  // resolved design pair (preflight may shift them)
  const [posId, setPosId] = React.useState<string>('');
  const [negId, setNegId] = React.useState<string>('');
  const [note, setNote]   = React.useState<string>('');     // system note
 const [error, setError] = React.useState<string>('');     // transport/logic error
  const [collisions, setCollisions] = React.useState<string[]>([]);

  // copy → children + saturation results
  const [basePath, setBasePath] = React.useState<string>('0');
  const [children, setChildren] = React.useState<string[]>([]);
  const [sat, setSat] = React.useState<Array<{ locusPath: string; status: string; reason?: string }>>([]);

  // uniformity inputs + result
  const [childA, setChildA] = React.useState<string>('');
  const [childB, setChildB] = React.useState<string>('');
  const [uniform, setUniform] = React.useState<{ ok?: boolean; a?: string[]; b?: string[] } | null>(null);

  // ---- Design discovery   ensure a proper pair (P, O) ----
   async function loadDesigns() {
         const resp = await fetchJSON<any>(`/api/ludics/designs?deliberationId=${encodeURIComponent(dialogueId)}`);
         // robust to {designs:[]}, {data:[]}, or bare array
         const arr: Array<{id:string; participantId?:string}> =
           Array.isArray(resp) ? resp :
           Array.isArray(resp?.designs) ? resp.designs :
           Array.isArray(resp?.data) ? resp.data : [];
         return arr;
       }
     
       async function ensureDesignPair() {
         let arr = await loadDesigns();
         let P = arr.find(d => d.participantId === 'Proponent') ?? arr[0];
         let O = arr.find(d => d.participantId === 'Opponent')  ?? arr.find(d => d.id !== P?.id);
     
         // If missing or identical, ask server to (re)compile a proper pair
         if (!P || !O || P.id === O.id) {
           await fetchJSON(`/api/ludics/compile`, {
             method: 'POST',
             headers: { 'content-type': 'application/json' },
             body: JSON.stringify({ dialogueId }),
           });
           arr = await loadDesigns();
           P = arr.find(d => d.participantId === 'Proponent') ?? arr[0];
           O = arr.find(d => d.participantId === 'Opponent')  ?? arr.find(d => d.id !== P?.id);
         }
     
         if (!P || !O || P.id === O.id) {
           throw new Error('Could not resolve Proponent/Opponent designs');
         }
         setPosId(P.id); setNegId(O.id);
       }
     
       // boot
       React.useEffect(() => {
         let alive = true;
         (async () => {
           try {
             setBusy(true);
             await ensureDesignPair();
           } catch (e:any) {
             if (alive) setNote(String(e?.message || e));
           } finally { if (alive) setBusy(false); }
         })();
         return () => { alive = false; };
       }, [dialogueId]);
  async function preflight() {
    if (!posId || !negId) { try { await ensureDesignPair(); } catch(e:any){ setError(String(e?.message||e)); return; } }
    setBusy(true);
    try {
      const j = await fetchJSON<any>('/api/compose/preflight', {
        method:'POST', headers:{'content-type':'application/json'},
                 body: JSON.stringify({
                       dialogueId, posDesignId: posId, negDesignId: negId,
                       mode, compositionMode: mode
                     }),
      });
      if (j.ok) {
        setNote(j.note ?? '');
        setCollisions(j.collisions ?? []);
        if (j.posDesignId) setPosId(j.posDesignId);
        if (j.negDesignId) setNegId(j.negDesignId);
      } else {
        setNote(String(j.reason ?? 'blocked'));
        setCollisions(j.collisions ?? []);
      }
    } catch (e:any) {
               setNote(String(e?.message || e));
             } finally { setBusy(false); }
  }

  async function doCopy() {
    setBusy(true);
    try {
      const j = await fetchJSON<{ ok:boolean; children:string[]; bijection:Record<string,string> }>(
        '/api/loci/copy', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ dialogueId, baseLocus: basePath, count: 2 }),
        }
      );
      setChildren(j.children ?? []);
      // pick two by default for uniformity inputs
      setChildA(j.children?.[0] ?? ''); setChildB(j.children?.[1] ?? '');
          } catch (e:any) {
              setNote(String(e?.message || e));
            } finally { setBusy(false); }
  }

  async function saturate() {
    if (!children.length) return;
        if (!posId || !negId) { try { await ensureDesignPair(); } catch(e:any){ setNote(String(e?.message||e)); return; } }
    setBusy(true);
    try {
      // quick harness: run step once per child with a virtual-nega focus
      const results: Array<{ locusPath:string; status:string; reason?:string }> = [];
      for (const c of children) {
        const r = await fetchJSON<any>('/api/ludics/step', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({
            dialogueId, posDesignId: posId, negDesignId: negId,
            maxPairs: 1024, virtualNegPaths: [c],
          }),
        });
        results.push({ locusPath: c, status: r.status, reason: r.reason });
      }
      setSat(results);
           } catch (e:any) {
               setNote(String(e?.message || e));
             } finally { setBusy(false); }
  }

  async function checkUniformity() {
    if (!childA || !childB) return;
    if (!posId || !negId) { try { await ensureDesignPair(); } catch(e:any){ setNote(String(e?.message||e)); return; } }
     setBusy(true);
    try {
     const j = await fetchJSON<any>('/api/ludics/uniformity/check', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
                    dialogueId,
                    posDesignId: posId,
                    negDesignId: negId,
                    baseLocus: basePath || '0',   // ← required by the route
                    childA,
                    childB,
                 fuel: 1024,
        }),
      });
      setUniform(j.uniform ? { ok:true } : { ok:false, a: j.counterexample?.a ?? [], b: j.counterexample?.b ?? [] });
    }
      catch (e:any) {
              setNote(String(e?.message || e));
            } finally { setBusy(false); }
        } 
  
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/75 shadow-md ">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 ">
        <h3 className="text-sm font-semibold text-slate-700">Behaviour Inspector</h3>
      {busy && <span className="text-[11px] text-neutral-500">Working…</span>}
 {!!error && <span className="text-[11px] text-rose-700">{error}</span>}
      </div>

      <div className="px-3 py-3 space-y-4">
      {!!note && (
           <div className="rounded border p-2 text-[11px]">
             <span className="font-semibold mr-1">Note:</span>
             <span>{note}</span>
           </div>
        )}
        {/* A) Composition mode */}
        <div className="rounded border p-2">
          <div className="text-xs font-semibold mb-1">Composition preflight</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px]">Mode</label>
            <select className="text-[11px] border rounded px-1 py-0.5" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
              <option value="assoc">assoc</option>
              <option value="partial">partial</option>
              <option value="spiritual">spiritual</option>
            </select>
            <button className="px-2 py-0.5 border rounded text-[11px]" onClick={preflight} disabled={!posId || !negId}>Preflight</button>
            <Chip kind={note==='shift-inserted' ? 'warn' : 'ok'}>{note || '—'}</Chip>
            {collisions.length ? <Chip kind="err">dir clash: {collisions.join(',')}</Chip> : null}
          </div>
          <div className="mt-1 text-[11px]">
            P: <code>{posId.slice(0,8)}</code> · O: <code>{negId.slice(0,8)}</code>
          </div>
        </div>

        {/* B) Copy children */}
        <div className="rounded border p-2">
          <div className="text-xs font-semibold mb-1">Copy / fresh children</div>
          <div className="flex items-center gap-2">
            <label className="text-[11px]">Base</label>
            <input className="text-[11px] border rounded px-1 py-0.5 w-24" value={basePath} onChange={e=>setBasePath(e.target.value)} placeholder="0 or 0.2" />
            <button className="px-2 py-0.5 border rounded text-[11px]" onClick={doCopy}>Copy</button>
            {children.length ? <Chip>{children.length} children</Chip> : null}
          </div>
          {children.length ? (
            <div className="mt-1 text-[11px]">Children: {children.map(c => <code key={c} className="mr-1">{c}</code>)}</div>
          ) : null}
        </div>

        {/* C) Saturation */}
        <div className="rounded border p-2">
          <div className="text-xs font-semibold mb-1">Saturation (probe each child)</div>
          <button className="px-2 py-0.5 border rounded text-[11px]" onClick={saturate} disabled={!children.length}>Run saturation</button>
          {!!sat.length && (
            <ul className="mt-2 text-[11px] space-y-1">
              {sat.map(s => (
                <li key={s.locusPath} className="flex items-center gap-2">
                  <code>{s.locusPath}</code>
                  <Chip kind={s.status==='CONVERGENT' ? 'ok' : 'warn'}>{s.status}{s.reason ? ` · ${s.reason}` : ''}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* D) Uniformity */}
        <div className="rounded border p-2">
          <div className="text-xs font-semibold mb-1">Uniformity (α-equivalence across copies)</div>
          <div className="flex items-center gap-2">
            <label className="text-[11px]">child A</label>
            <select className="text-[11px] border rounded px-1 py-0.5" value={childA} onChange={e=>setChildA(e.target.value)}>
              <option value="">—</option>
              {children.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="text-[11px]">child B</label>
            <select className="text-[11px] border rounded px-1 py-0.5" value={childB} onChange={e=>setChildB(e.target.value)}>
              <option value="">—</option>
              {children.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="px-2 py-0.5 border rounded text-[11px]" onClick={checkUniformity} disabled={!childA || !childB}>Check</button>
            {uniform?.ok === true && <Chip>uniform ✓</Chip>}
            {uniform?.ok === false && <Chip kind="warn">not uniform</Chip>}
          </div>
          {uniform?.ok === false && (
            <div className="mt-2 grid md:grid-cols-2 gap-2 text-[11px]">
              <div><div className="font-semibold">trace A (α-norm)</div><pre className="whitespace-pre-wrap">{uniform.a?.slice(0,40).join(' → ')}</pre></div>
              <div><div className="font-semibold">trace B (α-norm)</div><pre className="whitespace-pre-wrap">{uniform.b?.slice(0,40).join(' → ')}</pre></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default BehaviourInspectorCard;
