'use client';
import * as React from 'react';
import useSWR from 'swr';
import DefaultRuleEditor from '../DefaultRuleEditor';
const fetcher = (u: string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

type Slot = 'claim'|'grounds'|'warrant'|'backing'|'qualifier'|'rebuttal';

type DefaultRule = {
  id: string;
  role: string; // e.g. 'premise'|'claim'|'attack' etc. (keep wide unless you have an enum)
  antecedent: string | null;
  justification: string | null;
  consequent: string | null;
  createdAt: string; // ISO
};

// shared local type in ToulminBox.tsx and MonologicalToolbar.tsx
type ExtractResp = {
  ok: boolean;
  slots: Record<string, string[]>;
  meta?: {
    defaults?: Array<{
      id: string;
      role: string;            // 'premise' | 'claim'
      antecedent: string;      // α
      justification: string;   // β
      consequent: string;      // γ
      createdAt: string;
    }>;
    connectives?: { therefore?: boolean; suppose?: boolean };
  };
};


const CUES = {
  claim:     /\b(therefore|thus|so it follows|we should|hence|conclude|thereby|in conclusion)\b/i,
  grounds:   /\b(because|since|given that|as|insofar as|due to|on the grounds that)\b/i,
  warrant:   /\b(generally|as a rule|other things equal|assuming|if.*then|there is reason to think)\b/i,
  backing:   /\b(according to|as shown in|by (the|a) study|evidence from|meta-?analysis|replication)\b/i,
  qualifier: /\b(probably|likely|plausibly|maybe|possibly|almost certainly|in most cases)\b/i,
  rebuttal:  /\b(unless|except when|however|but|on the other hand|still|nevertheless)\b/i,
};


function AttachEvidenceQuick({ claimId, onDone }:{
  claimId: string; onDone?: ()=>void;
}) {
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const [err, setErr] = React.useState<string|null>(null);

  async function attach() {
    if (!url.trim()) return;
    setBusy(true); setErr(null); setOk(false);
    try {
      const res = await fetch(`/api/claims/${encodeURIComponent(claimId)}/evidence`, {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({ uri: url.trim(), kind: 'secondary', cite: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOk(true);
      setTimeout(()=>setOk(false), 1200);
      setUrl('');
      onDone?.();
    } catch (e:any) { setErr(e?.message || 'Failed to attach'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 border rounded px-2 py-1 text-[12px]"
        placeholder="                               89DOI or URL…"
        value={url}
        onChange={e=>setUrl(e.target.value)}
        disabled={busy}
      />
      <button className="px-2 py-1 border rounded text-[11px]" onClick={attach} disabled={busy || !url.trim()}>
        {busy ? 'Attaching…' : 'Attach'}
      </button>
      {ok && <span className="text-[10px] text-emerald-700">✓</span>}
      {err && <span className="text-[10px] text-rose-700">{err}</span>}
    </div>
  );
}

function AttachEvidenceUnpromoted({
  onOpenCitePicker, onPromoteWithEvidence, conclusion
}:{
  onOpenCitePicker?: (initialUrl?: string)=>void;
  onPromoteWithEvidence?: (url:string, conclusionText?:string)=>Promise<void>;
  conclusion?: string;
}) {
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const [err, setErr] = React.useState<string|null>(null);

  async function promoteAndAttach() {
    if (!url.trim() || !onPromoteWithEvidence) {
      onOpenCitePicker?.(url || undefined);
      return;
    }
    setBusy(true); setErr(null); setOk(false);
    try {
      await onPromoteWithEvidence(url.trim(), conclusion);
      setOk(true);
      setTimeout(()=>setOk(false), 1200);
      setUrl('');
    } catch (e:any) {
      setErr(e?.message || 'Failed to promote & attach');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col  gap-2">
      <input
        className="flex-1 border rounded px-2 py-0.5 bg-white btnv2--ghost text-[12px]"
        placeholder="Paste DOI or URL…"
        value={url}
        onChange={e=>setUrl(e.target.value)}
        disabled={busy}
      />
      <div className='flex gap-2'>
      <button
        className="px-2 py-.5 btnv2--ghost bg-white rounded text-[11px]"
        title="Open cite picker"
        onClick={()=>onOpenCitePicker?.(url || undefined)}
        disabled={busy}
      >
        Cite…
      </button>
      <button
        className="px-2 py-.5 btnv2--ghost rounded bg-white text-[11px]"
        onClick={promoteAndAttach}
        disabled={busy || !url.trim()}
      >
        {busy ? 'Working…' : 'Provide Evidence'}
      </button>
      </div>
      {ok && <span className="text-[10px] text-emerald-700">✓</span>}
      {err && <span className="text-[10px] text-rose-700">{err}</span>}
    </div>
  );
}


function splitSents(text: string): string[] {
  const s = (text.match(/[^.!?]+[.!?]+/g) || [text]).map(t => t.trim());
  return s.filter(Boolean);
}

const ORDER: Slot[] = ['grounds','warrant','backing','qualifier','rebuttal','claim'];

export function ToulminBox({
  text,
  argumentId,            // NEW: for save
  deliberationId,        // NEW: for save & ludics
  claimId,               // NEW: for warrant backing to claim
  onAddMissing,          // legacy affordance (still supported)
  onPromoteConclusion,
  onOpenCitePicker,
  onPromoteWithEvidence,
  onOpenCQs,             // NEW: open CQ modal for claim
  onOpenSequent,         // NEW: open Γ⊢Δ
  onChanged,             // NEW: callback after save
  className,
}: {
  text: string;
  argumentId?: string;
  deliberationId?: string;
  claimId?: string | null;

  onAddMissing?: (slot: Slot) => void;
  onPromoteConclusion?: (conclusionText: string) => void;
  onOpenCitePicker?: (initialUrl?: string) => void;
  onPromoteWithEvidence?: (url: string, conclusionText?: string) => Promise<void>;
  
  onOpenCQs?: (claimId: string) => void;
  onOpenSequent?: (gammaTexts: string[], deltaTexts: string[]) => void;
  onChanged?: () => void;
  className?: string;
}) {
  const sents = React.useMemo(() => splitSents(text), [text]);


   // pull server-extracted & saved slots
  //  const { data: ex, mutate } = useSWR<{ ok:boolean; slots: Record<string,string[]> }>(
  //    argumentId ? `/api/monological/extract?argumentId=${encodeURIComponent(argumentId)}` : null,
  //    fetcher,
  //    { revalidateOnFocus: false }
  //  );

   const { data: ex, mutate } = useSWR<ExtractResp>(
  argumentId ? `/api/monological/extract?argumentId=${encodeURIComponent(argumentId)}` : null,
  fetcher,
  { revalidateOnFocus: false }
);
const defaults = React.useMemo(() => ex?.meta?.defaults ?? [], [ex?.meta?.defaults]);


     React.useEffect(() => {
        if (!argumentId) return;
        const h = (e: any) => {
          if (e?.detail?.argumentId === argumentId) mutate();
        };
        window.addEventListener('monological:slots:changed', h);
        return () => window.removeEventListener('monological:slots:changed', h);
      }, [argumentId, mutate]);
 
   // local optimistic adds so it shows up instantly
   const [optimistic, setOptimistic] = React.useState<Record<Slot, string[]>>({
     claim:[], grounds:[], warrant:[], backing:[], qualifier:[], rebuttal:[]
   });

  const buckets = React.useMemo(() => {
    const m: Record<Slot, string[]> = { claim:[], grounds:[], warrant:[], backing:[], qualifier:[], rebuttal:[] };
    for (const s of sents) {
      // rebuttal precedence
      if (CUES.rebuttal.test(s)) { m.rebuttal.push(s); continue; }
      let hit: Slot | null = null;
      for (const k of ORDER) {
        const re = (CUES as any)[k] as RegExp;
        if (re.test(s)) { hit = k; break; }
      }
      if (hit) m[hit].push(s);
    }
    // last sentence bias for claim
    if (m.claim.length === 0 && sents.length) {
      const last = sents[sents.length - 1];
      if (!CUES.rebuttal.test(last)) m.claim.push(last);
    }
    // dedupe & cap
    (Object.keys(m) as Slot[]).forEach(k => {
      const seen = new Set<string>();
      m[k] = (m[k] ?? []).filter(t => {
        const key = t.toLowerCase();
        if (seen.has(key)) return false; seen.add(key); return true;
      }).slice(0, 5);
    });
    // merge persisted (server extract)   optimistic
     const persisted = (ex?.slots ?? {}) as Record<string, string[]>;
     const addAll = (k: Slot, arr?: string[]) => {
       for (const t of (arr ?? [])) if (!m[k].includes(t)) m[k].push(t);
     };
     addAll('grounds',   persisted.grounds || persisted.ground || []);
     addAll('warrant',   persisted.warrant);
     addAll('backing',   persisted.backing);
     addAll('qualifier', persisted.qualifier);
     addAll('rebuttal',  persisted.rebuttal);
     // optimistic last, so it always shows right after save
     (Object.keys(optimistic) as Slot[]).forEach(k => addAll(k, optimistic[k]));
     return m;
  }, [sents, ex?.slots, optimistic]);

  const has = (k: Slot) => (buckets[k]?.length ?? 0) > 0;
  const completeness = (['grounds','warrant','claim'] as Slot[]).filter(has).length / 3;

  const conclusion = buckets.claim?.[0] || '';

  // ---- inline editor state ----
  const [editing, setEditing] = React.useState<Slot | null>(null);
  const [draft, setDraft]     = React.useState('');
  const [busy, setBusy]       = React.useState(false);
  const [err, setErr]         = React.useState<string|null>(null);

     // API expects "ground" (singular); our buckets use "grounds".
   function apiSlot(s: Exclude<Slot,'claim'>):
     'ground'|'warrant'|'backing'|'qualifier'|'rebuttal' {
     return s === 'grounds' ? 'ground' : s;
   }


  async function saveSlot(slot: Exclude<Slot,'claim'>, textVal: string) {
    if (!argumentId || !textVal.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/monological/slots', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          argumentId,
          deliberationId,
          claimId: slot === 'warrant' ? (claimId ?? undefined) : undefined,
          slot: apiSlot(slot), // normalize: 'grounds' -> 'ground'
          text: textVal.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
       // optimistic show
       setOptimistic(o => ({
           ...o,
           [slot]: Array.from(new Set([...(o[slot]||[]), textVal.trim()]))
         }));
      setEditing(null);
      setDraft('');
         // revalidate server extract (so other panels update too)
       await mutate();
       onChanged?.();
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
      window.dispatchEvent(new CustomEvent('monological:slots:changed', {
        detail: { argumentId }
      }));
    }
  }

  function section(slot: Exclude<Slot,'claim'>, title: string, color: string) {

    const items = (buckets[slot] ?? []).slice(0, 3);
    const empty = items.length === 0;
    const explain: Record<string,string> = {
      grounds:   'Facts/data that directly support the claim.',
      warrant:   'General rule that licenses the step from grounds to claim.',
      backing:   'Citations/studies/authority supporting the warrant.',
      qualifier: 'Strength: SOME/MANY/MOST/ALL; COULD/LIKELY/NECESSARY.',
      rebuttal:  'Exceptions/objections that limit the conclusion.',
    };
    

    return (
      <div className={`rounded border ${color} p-2`}>
        <div className="text-[11px] font-semibold mb-1 flex items-center justify-between">
          <span>{title}</span>
          <span className="text-[10px] text-neutral-600" title={explain[slot]}>?</span>
        </div>

        {items.map((t, i) => <div key={i} className="text-[12px] mb-1">• {t}</div>)}

        {/* inline editor */}
        {editing === slot && (
          <div className="mt-1">
            <textarea
              className="w-full border rounded px-2 py-1 text-[12px]"
              rows={3}
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              placeholder={explain[slot]}
              disabled={busy}
            />
            {err && <div className="text-[11px] text-rose-600 mt-1">{err}</div>}
            <div className="mt-1 flex gap-2 justify-end">
              <button className="px-2 py-0.5 border rounded text-[11px]" onClick={()=>{ setEditing(null); setDraft(''); }} disabled={busy}>Cancel</button>
              <button className="px-2 py-0.5 border rounded text-[11px] bg-emerald-600 text-white disabled:opacity-60"
                onClick={()=>saveSlot(slot, draft)} disabled={busy || draft.trim().length<2}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* add button when empty or to add more */}
        {editing !== slot && (
          <div className="mt-1">
            {empty ? (
              <button
                className="text-[11px] underline"
                onClick={() => {
                  setEditing(slot); setDraft(''); setErr(null);
                  onAddMissing?.(slot as Slot); // keep legacy hook semantics (no-op if not provided)
                }}
                title={`Add a ${title.toLowerCase()}`}
              >
                + Add {title}
              </button>
            ) : (
              <button
                className="text-[11px] underline"
                onClick={() => { setEditing(slot); setDraft(''); setErr(null); }}
                title={`Add another ${title.toLowerCase()}`}
              >
                + Add another
              </button>
              
              
            )}
            {/* FIX IS HERE: Removed the invalid ": null" at the end */}
           {slot === 'warrant' && defaults.length > 0 && (
              <div className="mt-2 text-[11px]">
                <div className="font-semibold mb-1">Implicit (default) warrants</div>
                <div className="flex flex-col gap-0.5">
                  {defaults
                    .filter(d => d.role === 'premise')
                    .map(d => (
                      <div key={d.id} className="text-[11px]">
                        α: <code>{d.antecedent}</code>{' '}
                        : β/<code>{d.justification}</code>{' '}
                        / γ: <code>{d.consequent}</code>
                      </div>
                    ))}
                </div>

                {argumentId && (
                  <div className="mt-2">
                    <DefaultRuleEditor
                      argumentId={argumentId}
                      role="premise"
                      onSaved={async ()=>{ await mutate(); onChanged?.(); }}
                      onCancel={()=>{}}
                    />
                  </div>
                )}
              </div>
            )}
            {/* The ": null" that was here has been removed */}

          </div>
        )}
        {slot === 'backing' && (
  <div className="mt-2">
    {claimId ? (
      // If claim exists, attach directly
      <AttachEvidenceQuick claimId={claimId} onDone={onChanged} />
    ) : (
      // If not promoted yet: allow cite picker or "promote with evidence"
      <AttachEvidenceUnpromoted
        onOpenCitePicker={onOpenCitePicker}
        onPromoteWithEvidence={onPromoteWithEvidence}
        conclusion={buckets.claim?.[0] || ''}
      />
    )}
  </div>
)}
      </div>
    );
  }

  // Build Γ/Δ
  const gammaTexts = React.useMemo(() => {
    const g = (buckets.grounds ?? []).concat(buckets.backing ?? []);
    const seen = new Set<string>(); const out: string[] = [];
    for (const t of g) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t); } }
    return out.slice(0, 6);
  }, [buckets.grounds, buckets.backing]);

  function openSequent() {
    if (!onOpenSequent) return;
    const delta = conclusion ? [conclusion] : [];
    onOpenSequent(gammaTexts, delta);
  }

  async function openDialogue() {
    if (!argumentId || !deliberationId) return;
    try {
      await fetch('/api/monological/bridge', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ argumentId }),
      });
      window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
    } catch {}
  }

  function openCQs() {
    if (claimId) {
      onOpenCQs?.(claimId);
      if (!onOpenCQs) {
        window.dispatchEvent(new CustomEvent('dialogue:cq:open', { detail: { targetId: claimId } }));
      }
    }
  }

  return (
    <div className={`mt-2 mb-2 grid grid-cols-3 gap-2 w-3/4 ${className ?? ''}`}>
      {section('grounds',  'Grounds',   'border-emerald-200 bg-emerald-50/60')}
      {section('warrant',  'Warrant',   'border-violet-200  bg-violet-50/60')}
      {section('backing',  'Backing',   'border-sky-200     bg-sky-50/60')}
      {section('qualifier','Qualifier', 'border-amber-200   bg-amber-50/60')}
      {section('rebuttal', 'Rebuttal',  'border-rose-200    bg-rose-50/60')}

      {/* Conclusion cell with actions */}
      <div className="rounded border border-orange-200 bg-orange-50/60 p-2">
        <div className="text-[11px] font-semibold mb-1 flex items-center justify-between">
          <span>Conclusion</span>
          <div className="flex items-center gap-2">
            {/* Sequent */}
            {(gammaTexts.length && conclusion) ? (
              <button className="text-[10px] underline underline-offset-4" onClick={openSequent} title="View as Γ ⊢ Δ">Γ ⊢ Δ</button>
            ) : null}
            {/* Open in dialogue */}
            {/* {argumentId && deliberationId && (
              <button className="text-[10px] underline" onClick={openDialogue} title="Open as dialogue (ASSERT/WHY/GROUNDS)">
                Open in dialogue
              </button>
            )} */}
          </div>
        </div>

        {conclusion
          ? <div className="text-[12px]">• {conclusion}</div>
          : <div className="italic text-[12px] text-neutral-600">not detected</div>}

        {conclusion && (
          <button className="text-[11px] underline mt-1" onClick={() => onPromoteConclusion?.(conclusion)}>
            Promote conclusion → Claim
          </button>
        )}

        {/* CQ hint if missing warrant and claim exists */}
        {!has('warrant') && claimId && (
          <div className="mt-2 text-[11px]">
            <button className="px-1.5 py-0.5 border rounded bg-amber-50 border-amber-200 text-amber-700"
              onClick={openCQs}
              title="Open condition questions about warrant sufficiency"
            >
              CQ likely: warrant sufficiency
            </button>
          </div>
        )}

        <div className="mt-2 text-[10px] text-neutral-600">
          Completeness: {(completeness*100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
