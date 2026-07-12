'use client';
import * as React from 'react';
import useSWR from 'swr';
import InlineSlotEditor from './InlineSlotEditor';
import QualityBadgeBreakdown from './QualityBadgeBreakdown';
import { QuantifierModalityPicker } from './QuantifierModalityPicker';
import { BehaviourHUD } from '../ludics/BehaviourHUD';
type Slot = 'ground'|'warrant'|'backing'|'qualifier'|'rebuttal';

const fetcher = (u: string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());



// NEW: tiny helper to detect a conclusion (last-sentence heuristic)
const REBUTTAL_RE = /\b(unless|except when|however|but|on the other hand|still|nevertheless)\b/i;
function detectConclusion(text: string) {
  if (!text) return false;
  const last = (text.match(/[^.!?]+[.!?]+/g) || [text]).map(t=>t.trim()).filter(Boolean).slice(-1)[0] || '';
  const looksLikeConclusion = /\b(therefore|thus|so|hence|in conclusion|we should|it follows)\b/i.test(last);
  const looksLikeRebuttal = /\b(unless|except when|however|but|nevertheless|still)\b/i.test(last);
  return looksLikeConclusion || (!looksLikeRebuttal && last.length > 6);
}


export default function MonologicalToolbar({
  deliberationId,
  argument,
  cqSummary,              // optional: { satisfied:number, required:number }
  onChanged,
}: {
  deliberationId: string;
  argument: { id: string; text: string; claimId?: string | null };
  cqSummary?: { satisfied: number; required: number };
  onChanged?: () => void;
}) {
    const { data: ex, mutate } = useSWR<{ ok: boolean; slots: Record<string,string[]> }>(
    argument?.id ? `/api/monological/extract?argumentId=${encodeURIComponent(argument.id)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
    React.useEffect(() => {
        if (!argument?.id) return;
        const h = (e: any) => {
          if (e?.detail?.argumentId === argument.id) mutate();
        };
        window.addEventListener('monological:slots:changed', h);
        return () => window.removeEventListener('monological:slots:changed', h);
      }, [argument?.id, mutate]);

  // Tiny helpers (mirror ToulminBox’s last-sentence bias)
 function splitSents(t: string) {
   return (t.match(/[^.!?]+[.!?]+/g) || [t]).map(s => s.trim()).filter(Boolean);
}
const REBUT = /\b(unless|except when|however|but|on the other hand|still|nevertheless)\b/i;
const [bridgeIntent, setBridgeIntent] = React.useState<'justify'|'explain'>('justify');

  const slots = ex?.slots ?? { claim:[], grounds:[], warrant:[], backing:[], qualifier:[], rebuttal:[] } as any;

  // NEW: robust "claim present" detection
  const conclusionDetected = React.useMemo(
    () => detectConclusion(argument?.text || ''),
    [argument?.text]
  );


const claimPresent = Boolean(argument?.claimId) || detectConclusion(argument?.text || '');


//   const have = {
//    grounds:  (slots.grounds?.length ?? 0) > 0,
//    warrant:  (slots.warrant?.length ?? 0) > 0,
//     // Treat "claim present" as either promoted OR heuristically detected from text
//     claim:    Boolean(argument?.claimId) || conclusionDetected ||  hasLikelyConclusion(argument?.text),
//  };

const have = {
  grounds:  (slots.grounds?.length ?? 0) > 0,
  warrant:  (slots.warrant?.length ?? 0) > 0,
  claim:    claimPresent,               // <— was (slots.claim?.length ?? 0) > 0
};


//  const completeness = Math.round(100 * (['grounds','warrant','claim'].filter(k => (have as any)[k]).length / 3));

   // claim present = promoted OR conclusion heuristic (handled outside)
   const baseComplete = (['grounds','warrant','claim'].filter(k => (have as any)[k]).length / 3);
  const completeness = Math.round(100 * baseComplete);

  const [editing, setEditing] = React.useState<Slot | null>(null);

  function MissingChecklist() {
    const need: Slot[] = [];
    if (!have.grounds) need.push('ground');
    if (!have.warrant) need.push('warrant');
    // backing/qualifier/rebuttal are optional by design but we surface them:
    if ((slots.backing?.length ?? 0) === 0) need.push('backing');
    if ((slots.qualifier?.length ?? 0) === 0) need.push('qualifier');
    if ((slots.rebuttal?.length ?? 0) === 0) need.push('rebuttal');
    if (!need.length) return null;
    return (
      <div className="text-[11px] text-neutral-600 flex flex-wrap gap-2">
        {need.map(s => (
          <button key={s} className="px-1.5 py-0.5  btnv2--ghost rounded" onClick={() => setEditing(s)}>
            □ {s}
          </button>
        ))}
      </div>
    );
  }
// inside QuantifierModalityPicker consumer row
const saveQualifier = React.useMemo(() => {
    let t: any; 
    return (id: string, q: any, m: any) => {
      clearTimeout(t);
      t = setTimeout(() => {
        fetch(`/api/arguments/${id}/qualifier`, {
          method:'PUT', headers:{'content-type':'application/json'},
          body: JSON.stringify({ quantifier:q, modality:m })
        }).catch(()=>{});
      }, 400);
    };
  }, []);
     // per-argument mix
   const { data: mixArg } = useSWR(
     argument?.id ? `/api/monological/telemetry?argumentId=${encodeURIComponent(argument.id)}` : null,
     fetcher,
     { revalidateOnFocus:false }
   );
   // deliberation saturation hint
   const { data: mixDelib } = useSWR(
     deliberationId ? `/api/monological/telemetry?deliberationId=${encodeURIComponent(deliberationId)}` : null,
     fetcher,
     { revalidateOnFocus:false }
   );
   const m = mixArg?.perArgument?.[argument.id];
   const showMix = !!m;
const [bridgeMode, setBridgeMode] = React.useState<'argument'|'explanation'>('argument');

  return (
    <div className="mt-2 rounded-lg border bg-white/90 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
  className="flex px-2 py-0 btnv2--ghost rounded text-[10px] "
  onClick={async ()=>{
    await fetch('/api/monological/bridge',{
      method:'POST', headers:{'content-type':'application/json'},
   body: JSON.stringify({ argumentId: argument.id, mode: bridgeMode /* 'argument' | 'explanation' */ })
    });
    // let panels refresh
    window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
  }}
>
  Open in dialogue
</button>
<BehaviourHUD deliberationId={deliberationId} />

<select
  className="text-[10px] border rounded px-1 py-0"
  value={bridgeMode}
  onChange={e=>setBridgeMode(e.target.value as any)}
  title="Choose dialogical reading"
>
  <option value="argument">Argument</option>
  <option value="explanation">Explanation</option>
</select>
{/* <div className="flex items-center gap-1 text-[10px]">
  <button
    className={`px-2 py-0 rounded btnv2--ghost ${bridgeIntent==='justify'?'ring-1 ring-slate-300':''}`}
    onClick={()=>setBridgeIntent('justify')}
    title="Build a justificatory argument (ASSERT/WHY/GROUNDS)"
  >Argue</button>
  <button
    className={`px-2 py-0 rounded btnv2--ghost ${bridgeIntent==='explain'?'ring-1 ring-slate-300':''}`}
    onClick={()=>setBridgeIntent('explain')}
    title="Build an explanation (EXPLAIN/BECAUSE)"
  >Explain</button>
</div> */}

        <span className="text-[11px] px-1.5 py-.5 rounded border bg-slate-50">
          Toulmin completeness: {completeness}%
        </span>
{showMix && (
           <span className="text-[11px] px-1.5 py-0.5 rounded border bg-white">
             Mix: G{m.grounds} · Q{m.qualifiers} · R{m.rebuttals}
           </span>
         )}
         {mixDelib?.saturation?.likely && (
           <span className="text-[11px] px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-700"
                 title="Qualifiers are piling up with very few rebuttals — likely saturation">
             Likely saturation
           </span>
         )}
        <QualityBadgeBreakdown
          argumentText={argument.text}
          toulminPresence={have}
          fallacyCount={0}
          cqSatisfied={cqSummary?.satisfied ?? 0}
          cqRequired={cqSummary?.required ?? 0}
        />

        <div className="ml-auto flex gap-2">
          {(['ground','warrant','backing','rebuttal'] as Slot[]).map(s => (
            <button key={s}
              className="px-2 py-1  btnv2--ghost rounded text-[11px]"
              onClick={() => setEditing(s)}
              title={`Add ${s}`}
            >
              + {s}
            </button>
          ))}

          <button className="px-2 py-1 btnv2--ghost rounded text-[11px]"
            title="Extract & review"
            onClick={()=>{/* SWR already fetched; opening missing checklist helps */}}>
            Extract
          </button>
        </div>
      </div>

      <div className="inline-flex gap-2 mt-2">
        <span className='text-xs flex gap-2'> {"Missing: "} </span>
        <MissingChecklist />
      </div>

{/* <div className="flex flex-col  w-fit mt-2">
          <QuantifierModalityPicker
            initialQuantifier={null}
            initialModality={null}
            onChange={(q,m)=>saveQualifier(argument.id, q, m)}
            />
        </div> */}
      {editing && (
        <InlineSlotEditor
          argumentId={argument.id}
          deliberationId={deliberationId}
          claimId={argument.claimId ?? undefined}
          slot={editing}
          onSaved={async () => {
                        setEditing(null);
                        await mutate();      // refresh extract
                        onChanged?.();       // let parent refetch its list if it wants
                      }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
