'use client';
import * as React from 'react';

type Side = 'Proponent' | 'Opponent';
type DaimonReason = 'accept' | 'fail';

export function JudgeConsole(props: {
  // existing handlers (kept compatible)
  onForceConcession: (locusPath: string, text: string, target?: Side) => void | Promise<void>;
  onCloseBranch:     (locusPath: string,             target?: Side) => void | Promise<void>;
  onConcede:         (locusPath: string, proposition: string, conceding?: Side) => void | Promise<void>;

  // optional extras (wire up only if you want)
  onAssignBurden?:   (locusPath: string, to: Side) => void | Promise<void>;
  onEndWithDaimon?:  (target: Side, reason?: DaimonReason) => void | Promise<void>;
  onStepNow?:        () => void | Promise<void>;

  // UI niceties
  locusSuggestions?: string[];  // e.g., ["0.1","0.2","0.2.1"]
  defaultTarget?: Side;         // default Opponent
}) {
   const [target, setTarget] = React.useState<Side>(props.defaultTarget ?? 'Opponent');
  const [locus, setLocus]   = React.useState('');
  const [ackText, setAckText] = React.useState('ACK');
  const [prop, setProp]     = React.useState('delivered');
  const [autoStep, setAutoStep] = React.useState(true);
  const [busy, setBusy]     = React.useState<string | null>(null);
  const [msg, setMsg]       = React.useState<{kind:'ok'|'err', text:string} | null>(null);

  // tiny locus validator
  const locusOK = locus === '' || /^[0-9]+(\.[0-9]+)*$/.test(locus);

  async function run(name: string, fn: () => void | Promise<void>) {
    try {
      setBusy(name); setMsg(null);
      await fn();
      setMsg({ kind:'ok', text: `${name} ✓` });
      if (autoStep && props.onStepNow) await props.onStepNow();
    } catch (e: any) {
      setMsg({ kind:'err', text: e?.message ?? `${name} failed` });
    } finally {
      setBusy(null);
    }
  }
  // Using a constant list id keeps SSR/CSR markup identical to avoid hydration drift
  const listId = "judge-locus-suggestions";

  const ActionButton = (p: {label:string; onClick:()=>void; danger?:boolean; disabled?:boolean}) => (
    <button
      onClick={p.onClick}
      disabled={busy !== null || p.disabled}
      className={`px-3 py-2 rounded-lg btnv2 text-xs ${
        p.danger ? 'border-rose-300 bg-rose-50' : 'border-slate-300 bg-white'
      } disabled:opacity-50`}
      title={busy ? 'Working…' : undefined}
    >
      {busy ? 'Working…' : p.label}
    </button>
  );

  return (
    <div className="rounded-lg bg-white/70 border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Judge Tools</h4>
        <label className="text-[11px] flex items-center gap-2">
          <input type="checkbox" checked={autoStep} onChange={e=>setAutoStep(e.target.checked)} />
          step after action
        </label>
      </div>

      {/* Target side */}
      <div className='flex flex-wrap gap-4'>
      <div className="flex  items-center gap-2 text-sm">
        <span className="opacity-70">Target:</span>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="radio"  name="jt-side" checked={target==='Opponent'} onChange={()=>setTarget('Opponent')} />
          Opponent
        </label>
        <label className="inline-flex items-center gap-1 cursor-pointer">
          <input type="radio" name="jt-side" checked={target==='Proponent'} onChange={()=>setTarget('Proponent')} />
          Proponent
        </label>
      </div>

      {/* Locus row */}
      <div className="flex items-center gap-2">
        <input list={listId} 
          placeholder="locus path (e.g. 0.1)"
          value={locus}
          onChange={e=>setLocus(e.target.value)}
          className={`border minorfield rounded px-2 py-1 text-sm flex-1 ${!locusOK ? 'border-rose-400' : 'border-slate-300'}`}
        />
        {props.locusSuggestions?.length ? (
           <datalist id={listId}>
            {props.locusSuggestions.map(x => <option key={x} value={x} />)}
          </datalist>
        ) : null}
        {!locusOK && <span className="text-[11px] text-rose-600">invalid</span>}
      </div>
      </div>

      {/* ACK / Concession inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm ">ACK text</label>
          <input
            value={ackText}
            onChange={e=>setAckText(e.target.value)}
            className="border minorfield rounded px-2 py-1 text-sm flex-1 focus:outline-none"
            placeholder="ACK"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm ">Proposition</label>
          <input
            value={prop}
            onChange={e=>setProp(e.target.value)}
            className="border minorfield rounded px-2 py-1 text-sm flex-1 focus:outline-none"
            placeholder="delivered"
          />
        </div>
      </div>

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <ActionButton
          label={`Force concession (${ackText})`}
          onClick={() => run('Force concession', () => props.onForceConcession(locus, ackText, target))}
          disabled={!locusOK || !locus}
        />
        <ActionButton
          label="Close branch"
          danger
          onClick={() => run('Close branch', () => props.onCloseBranch(locus, target))}
          disabled={!locusOK || !locus}
        />
        <ActionButton
          label={`Concede: ${prop}`}
          onClick={() => run('Concede', () => props.onConcede(locus, prop, target))}
          disabled={!locusOK || !locus || !prop.trim()}
        />
      </div>

      {/* Optional extras */}
      {(props.onAssignBurden || props.onEndWithDaimon) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {props.onAssignBurden && (
            <ActionButton
              label={`Assign burden → ${target}`}
              onClick={() => run('Assign burden', () => props.onAssignBurden!(locus || '0', target))}
            />
          )}
          {props.onEndWithDaimon && (
            <>
              <ActionButton
                label={`End with †(accept) → ${target}`}
                onClick={() => run('End (accept)', () => props.onEndWithDaimon!(target, 'accept'))}
              />
              <ActionButton
                label={`End with †(fail) → ${target}`}
                danger
                onClick={() => run('End (fail)', () => props.onEndWithDaimon!(target, 'fail'))}
              />
            </>
          )}
        </div>
      )}

      {/* Quick locus suggestions as chips */}
      {props.locusSuggestions?.length ? (
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-[11px] opacity-70 pr-1">Suggested:</span>
          {props.locusSuggestions.slice(0, 10).map(x => (
        <button
          key={'sugg-'+x}
          onClick={()=>setLocus(x)}
          className="text-[11px] px-2 py-0.5 btnv2 mx-1 rounded "
        >
          {x}
        </button>
          ))}
        </div>
      ) : null}

      {/* status line */}
      {msg && (
        <div className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
