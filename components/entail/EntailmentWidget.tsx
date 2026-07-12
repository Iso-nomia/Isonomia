// components/entail/EntailmentWidget.tsx
"use client";
import * as React from 'react';
import { NLCommitPopover } from '@/components/dialogue/NLCommitPopover';


type EntailRule =
  | 'AND_ELIM'
  | 'MODUS_PONENS'
  | 'UNIVERSAL_INSTANT'
  | 'DIRECT_MATCH'
  | 'NEGATION_CONFLICT';

type EntailStep = { rule: EntailRule; used: string[]; derived?: string };

type NLI = { relation?: 'entails'|'contradicts'|'neutral'; score?: number };

type VizTracePair = { posActId?: string; negActId?: string; locusPath?: string; ts: number };
type VizTrace = {
  status: 'ONGOING'|'CONVERGENT'|'DIVERGENT'|'STUCK';
  pairs: VizTracePair[];
  decisiveIndices?: number[];
  usedAdditive?: Record<string,string>;
  reason?: string;
};
type Viz = { posDesignId: string; negDesignId: string; trace: VizTrace };

type DialogicalEntailResponse = {
  ok: boolean;
  status: 'ENTAILED'|'UNDECIDED'|'CONTRADICTS';
  steps: EntailStep[];
  derived: string[];
  classicalPatterns?: EntailRule[];
  nli?: NLI | null;
  viz?: Viz | null;
};

export function EntailmentWidget({
  seedSentences = [],
  seedHypothesis = '',
  deliberationId,                 // optional: enables “emit Ludics viz”
  defaultNliAssist = true,
  defaultEmitViz = false,
  onViz,
  // —— Send-to-dialogue options (new)
  dialogueTarget,                 // { targetType, targetId } for /api/dialogue/move
  defaultCommitOwner = 'Proponent',
  defaultLocus = '0',
}: {
  seedSentences?: string[];
  seedHypothesis?: string;
  deliberationId?: string;
  defaultNliAssist?: boolean;
  defaultEmitViz?: boolean;
  onViz?: (viz: Viz) => void;
    // —— Send-to-dialogue
    dialogueTarget?: { targetType: 'claim'|'argument'|'card'; targetId: string };
    defaultCommitOwner?: 'Proponent'|'Opponent';
    defaultLocus?: string;
}) {
  const seedText = React.useMemo(() => seedSentences.join('\n'), [seedSentences]);
  const [text, setText] = React.useState(seedText);
  const [hyp, setHyp] = React.useState(seedHypothesis);
  const [useNli, setUseNli] = React.useState(defaultNliAssist);
  const [emitViz, setEmitViz] = React.useState(defaultEmitViz);
  const [res, setRes] = React.useState<DialogicalEntailResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

 // —— Send-to-dialogue state (new)
 const derivedList = res?.derived ?? [];
 const [picked, setPicked] = React.useState<string>(derivedList[0] ?? seedHypothesis ?? '');
 const [baseLocus, setBaseLocus] = React.useState<string>(defaultLocus);
 const [owner, setOwner] = React.useState<'Proponent'|'Opponent'>(defaultCommitOwner);
 const [commitOpen, setCommitOpen] = React.useState(false);

 const hasSeeds = seedSentences.length > 0 || !!seedHypothesis;


 React.useEffect(() => {
  // refresh pick/locus after new result
  if (derivedList.length) setPicked(derivedList[0]);
  // if viz returned, prefer last locus of the trace as default base
  const lp = res?.viz?.trace?.pairs?.at(-1)?.locusPath;
  setBaseLocus(lp || defaultLocus);
}, [res?.derived, res?.viz, defaultLocus]); // eslint-disable-line


  async function run() {
    setLoading(true);
    setRes(null);
    setError(null);
    try {
      const sentences = text.split('\n').map(s => s.trim()).filter(Boolean);
      if (!sentences.length || !hyp.trim()) {
        setError('Please enter at least one premise and a hypothesis.');
        return;
      }
      const body: any = {
        textSentences: sentences,
        hypothesis: hyp.trim(),
        nliAssist: !!useNli,
        emitLudics: !!emitViz && !!deliberationId,
        deliberationId,
      };
      const r = await fetch('/api/entail/dialogical', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as DialogicalEntailResponse | { ok:false; error:any };
      if (!r.ok || (j as any)?.ok === false) {
        throw new Error(JSON.stringify((j as any)?.error ?? `HTTP ${r.status}`));
      }
      setRes(j as DialogicalEntailResponse);
      if ((j as DialogicalEntailResponse)?.viz && onViz) onViz((j as DialogicalEntailResponse).viz!);
    } catch (e: any) {
      setError(String(e?.message ?? e ?? 'entailment_failed'));
    } finally {
      setLoading(false);
    }
  }

  function resetToSeeds() {
    setText(seedText);
    setHyp(seedHypothesis);
    setRes(null);
    setError(null);
  }
  function pasteSample() {
    setText(['If a then b', 'a'].join('\n'));
    setHyp('b');
    setRes(null);
    setError(null);
  }

  const statusClass =
    res?.status === 'ENTAILED'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : res?.status === 'CONTRADICTS'
      ? 'bg-rose-50 border-rose-200 text-rose-700'
      : 'bg-amber-50 border-amber-200 text-amber-700';


  // —— Post WHY (new)
  async function postWhy() {
    if (!dialogueTarget || !deliberationId) return;
    try {
      const body = {
        deliberationId,
        targetType: dialogueTarget.targetType,
        targetId: dialogueTarget.targetId,
        kind: 'WHY' as const,
        payload: { locusPath: baseLocus, brief: picked || hyp },
        autoCompile: true,
        autoStep: true,
        phase: 'neutral' as const,
      };
      const r = await fetch('/api/dialogue/move', {
        method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body),
      });
      const j = await r.json().catch(()=>null);
      if (!r.ok || j?.ok === false) throw new Error(String(j?.error ?? r.status));
      window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
    } catch {
      // swallow; UI is passive here
    }
  }

  const canSend = !!dialogueTarget && !!deliberationId && !!picked && !!baseLocus;

  return (
    <div className="rounded border p-3 space-y-2 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Dialogical entailment</div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] flex items-center gap-1">
            <input type="checkbox" className="accent-black" checked={useNli} onChange={e=>setUseNli(e.target.checked)} />
            <span>NLI assist</span>
          </label>
          <label className="text-[11px] flex items-center gap-1">
            <input
              type="checkbox"
              className="accent-black"
              checked={emitViz}
              onChange={e=>setEmitViz(e.target.checked)}
              disabled={!deliberationId}
              title={deliberationId ? '' : 'Requires deliberationId'}
            />
            <span>Emit Ludics viz</span>
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <textarea
          className="w-full border rounded p-2 text-sm"
          rows={4}
          placeholder="Premises (one per line)"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <input
          className="w-full border rounded p-2 text-sm"
          placeholder="Hypothesis"
          value={hyp}
          onChange={e => setHyp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button className="px-2 py-1 btnv2--ghost rounded text-xs bg-white" onClick={run} disabled={loading}>
            {loading ? 'Checking…' : 'Check entailment'}
          </button>
          {hasSeeds && (
            <button className="px-2 py-1 btnv2--ghost rounded text-xs bg-white" onClick={resetToSeeds} disabled={loading}>
              Reset to seeds
            </button>
          )}
          <button className="px-2 py-1 btnv2--ghost rounded text-xs bg-white" onClick={pasteSample} disabled={loading}>
            Paste sample
          </button>

          {res?.ok && (
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${statusClass}`}>{res.status}</span>
          )}
          {!!res?.nli?.relation && (
            <span className="px-1.5 py-0.5 rounded border text-[10px] bg-slate-50">
              NLI: {res.nli.relation}{typeof res.nli.score === 'number' ? ` ${(res.nli.score*100).toFixed(0)}%` : ''}
            </span>
          )}
          {Array.isArray(res?.classicalPatterns) && res!.classicalPatterns!.length > 0 && (
            <span className="px-1.5 py-0.5 rounded border text-[10px] bg-slate-50">
              Classical: {res!.classicalPatterns!.join(', ')}
            </span>
          )}
        </div>
      </div>

      {error && <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">{error}</div>}

      {/* Proof-ish steps */}
      {Array.isArray(res?.steps) && res!.steps!.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium">Trace</div>
          <ol className="text-xs pl-4 list-decimal">
            {res!.steps!.map((s, i) => (
              <li key={i} className="mt-0.5">
                <b>{s.rule}</b>{' '}
                {s.derived ? <span>⇒ <code>{s.derived}</code></span> : null}
                <span className="opacity-70"> (from {s.used.join(' ; ')})</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Derived facts */}
      {Array.isArray(res?.derived) && res!.derived!.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium">Derived facts</div>
            <button
              className="text-[11px] underline decoration-dotted"
              onClick={() => navigator.clipboard?.writeText(res!.derived!.join('\n')).catch(()=>{})}
            >
              Copy
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {res!.derived!.map((d, i) => (
              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded border bg-neutral-50">{d}</span>
            ))}
          </div>
        </div>
      )}

      {/* Viz */}
      {res?.viz && deliberationId && (
        <div className="mt-2 border rounded p-2 bg-white">
          <div className="text-xs font-medium">Ludics visualization</div>
          <div className="text-[11px] text-neutral-600 mt-1">
            pos={res.viz.posDesignId.slice(0,8)} · neg={res.viz.negDesignId.slice(0,8)} · steps={res.viz.trace.pairs?.length ?? 0}
          </div>
          <a className="inline-block mt-1 text-[11px] underline" href={`/deliberation/${deliberationId}`} target="_blank" rel="noreferrer">
            Open in Deep Dive
          </a>
        </div>

      )}

      {/* ——————————————————— Send to dialogue ——————————————————— */}
      {res?.ok && dialogueTarget && deliberationId && (
        <div className="mt-3 border rounded p-2 bg-white">
          <div className="text-xs font-semibold mb-1">Send to dialogue</div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px]">Pick fact</label>
            <select className="text-[11px] border rounded px-1 py-0.5 max-w-[18rem]" value={picked} onChange={(e)=>setPicked(e.target.value)}>
              {[...(derivedList.length ? derivedList : [hyp])].map((d) => (
                <option key={d} value={d}>{d.slice(0,120)}</option>
              ))}
            </select>

            <label className="text-[11px]">Locus</label>
            <input className="text-[11px] border rounded px-1 py-0.5 w-20" value={baseLocus} onChange={e=>setBaseLocus(e.target.value)} placeholder="0 or 0.2" />

            <label className="text-[11px]">Owner</label>
            <select className="text-[11px] border rounded px-1 py-0.5" value={owner} onChange={e=>setOwner(e.target.value as any)}>
              <option value="Proponent">Proponent</option>
              <option value="Opponent">Opponent</option>
            </select>

            <button className="px-2 py-0.5 border rounded text-[11px] bg-white disabled:opacity-50" disabled={!canSend} onClick={postWhy}>
              Ask WHY @ {baseLocus}
            </button>

            <button className="px-2 py-0.5 border rounded text-[11px] bg-white disabled:opacity-50" disabled={!canSend} onClick={()=>setCommitOpen(true)}>
              Commit fact
            </button>
          </div>

          {/* Inline commit popover */}
          {commitOpen && (
            <NLCommitPopover
              open={commitOpen}
              onOpenChange={setCommitOpen}
              deliberationId={deliberationId}
              targetType={dialogueTarget.targetType}
              targetId={dialogueTarget.targetId}
              locusPath={baseLocus}
              defaultOwner={owner}
              // we can’t prefill label via this popover; it prompts.
              onDone={() => {
                window.dispatchEvent(new CustomEvent('dialogue:cs:refresh', { detail: { dialogueId: deliberationId, ownerId: owner } } as any));
                window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}