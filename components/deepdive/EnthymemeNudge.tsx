// components/deepdive/EnthymemeNudge.tsx
'use client';
import * as React from 'react';

function looksConclusive(text: string) {
  const t = (text || '').toLowerCase();
  const markers = ['therefore', 'so we must', 'hence', 'thus', 'it follows', 'consequently'];
  return markers.some(m => t.includes(m));
}

export default function EnthymemeNudge({
  deliberationId,          // NEW: needed for /move
  targetType, targetId, draft, insert, onPosted,
}: {
  deliberationId: string;
  targetType: 'argument' | 'card';
  targetId?: string;
  draft: string;
  insert: (t: string) => void;
  onPosted?: () => void;
}) {
  const [openPad, setOpenPad] = React.useState(false);
  const [ptype, setPtype] = React.useState<'premise'|'warrant'>('premise');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  // const suggest = Boolean(targetId) && looksConclusive(draft);
const suggest = Boolean(targetId) && (looksConclusive(draft) || draft.length >= 1);

  // same look as MissingAxiomBar
  if (!suggest) return null;

  async function post() {
    if (!targetId || !text.trim() || busy) return;
    try {
      setBusy(true);
        // (1) Look up an open CQ (fallback: none)
        const lm = await fetch(`/api/dialogue/legal-moves?deliberationId=${encodeURIComponent(deliberationId)}&targetType=${targetType}&targetId=${targetId}`)
          .then(r=>r.json()).catch(()=>null);
        const openWhy = (lm?.moves ?? []).find((m:any)=>m.kind==='GROUNDS' && m.payload?.cqId);
        const payload = openWhy?.payload?.cqId ? { cqId: openWhy.payload.cqId, expression: text.trim(), premiseType: ptype } 
                                              : { expression: text.trim(), premiseType: ptype };
        // (2) Prefer protocol move (GROUNDS). Server already records GROUNDS→CQ satisfied.
        const res = await fetch('/api/dialogue/move', {
          method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({
            deliberationId, targetType, targetId,
            kind:'GROUNDS', payload, autoCompile:true, autoStep:true
          })
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed'));
      setOk(true);
      setText('');
      setOpenPad(false);
      onPosted?.();
      setTimeout(() => setOk(false), 900);
    } catch {
      // swallow; you can add a toast here if you want
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative space-y-1.5">
      {/* Chip row (mirrors MissingAxiomBar style) */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px]">
        <span className="opacity-60 mr-1">Enthymeme prompts:</span>

        {/* Quick inserts (match your bar) */}
        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => insert('Premise: …')}
          title="Insert a missing premise scaffold"
        >
          + Premise
        </button>
        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => insert('Warrant (linking rule): …')}
          title="Insert a missing warrant scaffold"
        >
          + Warrant
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />

        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => insert('Default rule:\nSUPPOSE …\nUNLESS not(…)\nTHEREFORE …')}
          title="Insert a default-rule (defeasible) template"
        >
          Default rule ⟨α, ¬β⟩ ⇒ γ
        </button>
        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => insert('∀x (…x…) — instantiate with x = …')}
          title="Universal instantiation helper"
        >
          ∀-instantiate
        </button>
        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => insert('∃x (…x…) — provide witness: x = …')}
          title="Existential witness helper"
        >
          ∃-witness
        </button>
        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => insert('Presupposition: “…” — please justify or revise.')}
          title="Flag the hidden assumption"
        >
          Presupposition?
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />

        {/* Open/close the tiny propose pad */}
        <button
          className="px-2 py-0.5 rounded border"
          onClick={() => setOpenPad(o => !o)}
          title="Propose a missing premise/warrant to the parent"
        >
          {openPad ? 'Close' : 'Quick propose…'}
        </button>

        {ok && <span className="ml-1 text-emerald-700">✓</span>}
      </div>

      {/* Inline pad (compact) */}
      {openPad && (
        <div className="rounded-md border border-slate-200/80 bg-amber-50/40 p-2">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-neutral-700">
            <label className="inline-flex items-center gap-1">
              Kind:
              <select
                className="border rounded px-1 py-0.5"
                value={ptype}
                onChange={(e) => setPtype(e.target.value as 'premise'|'warrant')}
              >
                <option value="premise">Premise</option>
                <option value="warrant">Warrant</option>
              </select>
            </label>
            <span className="opacity-70">
              What unspoken idea links your point to the conclusion?
            </span>
          </div>

          <textarea
            rows={3}
            className="w-full text-xs border rounded px-2 py-1 bg-white"
            placeholder={`Write the missing ${ptype}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) post();
            }}
          />

          <div className="mt-1 flex gap-2">
            <button
              className="text-xs px-2 py-0.5 border rounded bg-white"
              onClick={post}
              disabled={!text.trim() || busy || !targetId}
              title={targetId ? 'Submit to /api/missing-premises' : 'Reply target required'}
            >
              {busy ? 'Posting…' : 'Propose'}
            </button>
            <button
              className="text-xs text-neutral-600"
              onClick={() => { setOpenPad(false); setText(''); }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
