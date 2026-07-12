// components/ludics/CommitmentsPanel.tsx
'use client';
import * as React from 'react';
import { parseRule, validateRule } from '../ludics-engine/rule-parser';

type FactRow = { label: string; entitled?: boolean; derived?: boolean; locusPath?: string; inherited?: boolean };
type RuleRow = { label: string; locusPath?: string; inherited?: boolean };

type ScopedInferenceResult = {
  locusPath: string;
  derivedFacts: Array<{ label: string; derivedAt: string }>;
  contradictions: Array<{ a: string; b: string; aLocusPath: string; bLocusPath: string; type: 'local' | 'inherited' }>;
  effectiveFacts: Array<{ label: string; locusPath: string; inherited: boolean }>;
  effectiveRules: Array<{ label: string; locusPath: string; inherited: boolean }>;
};

const toFact = (x: string | FactRow): FactRow =>
  typeof x === 'string' ? { label: x, entitled: true } : x;

export function CommitmentsPanel({
  dialogueId, ownerId, onChanged,
}: {
  dialogueId: string;
  ownerId: string; // 'Proponent' | 'Opponent'
  onChanged?: (summary: any) => void;
}) {
  const [facts, setFacts] = React.useState<FactRow[]>([]);
  const [rules, setRules] = React.useState<RuleRow[]>([]);
  const [label, setLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [summary, setSummary] = React.useState<{derived?: {label:string}[]; contradictions?: {a:string;b:string}[]}>({});
  const [persistDerived, setPersistDerived] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [selectedLocusPath, setSelectedLocusPath] = React.useState<string>('0');
  const [availableLoci, setAvailableLoci] = React.useState<Array<{path: string, label: string}>>([
    {path: '0', label: '0 (root)'}
  ]);
  
  // Scoped inference state
  const [scopedResult, setScopedResult] = React.useState<ScopedInferenceResult | null>(null);
  const [showScoped, setShowScoped] = React.useState(false);


    // --- Debounced/coalesced loader state ---
    const DEBOUNCE_MS = 240;
    const schedRef = React.useRef<{
      timer: ReturnType<typeof setTimeout> | null;
      inflight: boolean;
      next: boolean;
      ac: AbortController | null;
      mounted: boolean;
    }>({ timer: null, inflight: false, next: false, ac: null, mounted: false });
  
    const doFetch = React.useCallback(async (signal?: AbortSignal) => {
      const url = `/api/commitments/state?dialogueId=${encodeURIComponent(dialogueId)}&ownerId=${encodeURIComponent(ownerId)}`;
      const r = await fetch(url, { cache:'no-store', signal });
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      return j;
    }, [dialogueId, ownerId]);
  
    const applyState = React.useCallback((j:any) => {
      setFacts((j.facts ?? []).map(toFact));
      setRules((j.rules ?? []) as RuleRow[]);
      // callers that need summary can compute locally on Infer; keep panel lean here
    }, []);
  
    const flushNow = React.useCallback(async () => {
      const s = schedRef.current;
      if (s.inflight) { s.next = true; return; }
      s.inflight = true;
      try {
        s.ac?.abort();
        s.ac = new AbortController();
        const j = await doFetch(s.ac.signal);
        if (schedRef.current.mounted) applyState(j);
      } catch (_) {
        // ignore aborts
      } finally {
        s.inflight = false;
        if (s.next) { s.next = false; // run once more immediately
          // schedule microtask (no extra debounce), avoids recursion
          Promise.resolve().then(flushNow);
        }
      }
    }, [doFetch, applyState]);
  
    const scheduleLoad = React.useCallback((reason?: string) => {
      const s = schedRef.current;
      if (s.timer) clearTimeout(s.timer);
      s.timer = setTimeout(() => {
        s.timer = null;
        flushNow();
      }, DEBOUNCE_MS);
    }, [flushNow]);

      // ✅ Provide a stable alias used by the UI and helpers
  const load = React.useCallback(async () => {
    await flushNow();
  }, [flushNow]);
 
    // initial load
    React.useEffect(() => {
      const s = schedRef.current;
      s.mounted = true;
      scheduleLoad('mount');
      
      // Fetch available loci from ludics designs
      fetch(`/api/ludics/loci?dialogueId=${encodeURIComponent(dialogueId)}`)
        .then(r => r.json())
        .then(data => {
          if (data.ok && data.loci) {
            const lociOptions = data.loci.map((l: any) => ({
              path: l.path,
              label: l.path === '0' ? '0 (root)' : l.path
            }));
            setAvailableLoci(lociOptions.length > 0 ? lociOptions : [{path: '0', label: '0 (root)'}]);
          }
        })
        .catch(err => console.warn('Could not fetch loci:', err));
      
      return () => {
        s.mounted = false;
        if (s.timer) clearTimeout(s.timer);
        s.ac?.abort();
      };
    }, [scheduleLoad, dialogueId, ownerId]);

  // event bus refresh (optional)
  React.useEffect(() => {
    const h = (e: any) => {
      const d = e?.detail;
      if (d?.dialogueId === dialogueId && d?.ownerId === ownerId) scheduleLoad('cs');
    };
    window.addEventListener('dialogue:cs:refresh', h as any);
    return () => window.removeEventListener('dialogue:cs:refresh', h as any);
    }, [dialogueId, ownerId, scheduleLoad]);
  
    // coalesce general move bursts too
    React.useEffect(() => {
      const h = (e: any) => {
        const d = e?.detail;
        if (d?.deliberationId && d.deliberationId !== dialogueId) return;
        scheduleLoad('moves');
      };
      window.addEventListener('dialogue:moves:refresh', h as any);
      return () => window.removeEventListener('dialogue:moves:refresh', h as any);
    }, [dialogueId, scheduleLoad]);

  async function apply() {
    setBusy(true);
    try {
      const body = {
        dialogueId, ownerId, autoPersistDerived: persistDerived,
        ops: {
          add: [
            ...facts.map(f => ({ label: f.label, basePolarity: 'pos' as const, baseLocusPath: f.locusPath ?? '0', derived: !!f.derived })),
            ...rules.map(r => ({ label: r.label, basePolarity: 'neg' as const, baseLocusPath: r.locusPath ?? '0' })),
          ],
        },
      };
      const res = await fetch('/api/commitments/apply', {
        method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body),
      }).then(r => r.json());

      const derived = (res?.derivedFacts ?? []) as {label:string}[];
      const contradictions = (res?.contradictions ?? []) as {a:string;b:string}[];

      setSummary({ derived, contradictions });
  // Use dialogueId as deliberationId for this context
  const deliberationId = dialogueId;
  if ((contradictions ?? []).length) {
    fetch('/api/eristic/marks', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deliberationId,
        marks: contradictions.map((c:any) => ({
          targetType: 'commitments',
          targetId: ownerId,
          tactic: 'CS_CONTRADICTION',
          detector: 'commitments',
          strength: 1
        }))
      })
    }).catch(()=>{});
}
      onChanged?.(res);

     scheduleLoad('apply');
      // toast could use res.code === 'CS_CONTRADICTION'
    } finally { setBusy(false); }
  }

  const addFact = async () => {
    const v = label.trim();
    if (!v) return;
    setLabel('');
    setBusy(true);
    try {
      await fetch('/api/commitments/apply', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          dialogueId, ownerId, autoPersistDerived: false,
          ops: { add: [{ label: v, basePolarity: 'pos' as const, baseLocusPath: selectedLocusPath }] }
        }),
      });
      scheduleLoad('add-fact');
    } finally { setBusy(false); }
  };

  const addRule = async () => {
    const v = label.trim();
    if (!v) return;
    
    // Validate rule syntax before sending
    const validationError = validateRule(v);
    if (validationError) {
      alert(`Invalid rule syntax: ${validationError}`);
      return;
    }
    
    setLabel('');
    setBusy(true);
    try {
      const res = await fetch('/api/commitments/apply', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          dialogueId, ownerId, autoPersistDerived: false,
          ops: { add: [{ label: v, basePolarity: 'neg' as const, baseLocusPath: selectedLocusPath }] }
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to add rule: ${err.error || 'Unknown error'}`);
        return;
      }
      
     scheduleLoad('add-rule');
    } finally { setBusy(false); }
  };

  const erase = async (label: string) => {
    setBusy(true);
    try {
      await fetch('/api/commitments/apply', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          dialogueId, ownerId, autoPersistDerived: false,
          ops: { erase: [{ byLabel: label, byLocusPath: '0' }] }
        }),
      });
      scheduleLoad('erase');
    } finally { setBusy(false); }
  };

  const toggleEntitled = async (f: FactRow) => {
    setBusy(true);
    try {
      await fetch('/api/commitments/entitlement', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          dialogueId, ownerId, label: f.label, entitled: !(f.entitled !== false),
        }),
      });
       scheduleLoad('entitlement');
    } finally { setBusy(false); }
  };

  const clearDerived = async () => {
    // remove all derived facts by label
    setBusy(true);
    try {
      const derived = facts.filter(f=>f.derived).map(f=>f.label);
      if (!derived.length) return;
      await fetch('/api/commitments/apply', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify({
          dialogueId, ownerId, autoPersistDerived: false,
          ops: { erase: derived.map(l => ({ byLabel: l, byLocusPath: '0' })) }
        }),
      });
      await load();
    } finally { setBusy(false); }
  };

  // Run scoped inference at the selected locus (with inheritance)
  const runScopedInference = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/commitments/infer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dialogueId,
          ownerId,
          locusPath: selectedLocusPath,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setScopedResult(data);
        setShowScoped(true);
      } else {
        alert(`Scoped inference failed: ${data.error}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const exportToDialogue = async () => {
    if (!facts.length) {
      alert('No facts to export');
      return;
    }
    
    const confirmed = confirm(
      `Export ${facts.length} fact(s) from Ludics to Dialogue system for participant "${ownerId}"?\n\n` +
      `This will create Commitment records in the dialogue layer.`
    );
    
    if (!confirmed) return;
    
    setBusy(true);
    try {
      // Get element IDs for all current facts
      const stateRes = await fetch(
        `/api/commitments/state?dialogueId=${encodeURIComponent(dialogueId)}&ownerId=${encodeURIComponent(ownerId)}`,
        { cache: 'no-store' }
      );
      const stateData = await stateRes.json();
      
      // Get full elements with IDs
      const elementsRes = await fetch(
        `/api/commitments/elements?dialogueId=${encodeURIComponent(dialogueId)}&ownerId=${encodeURIComponent(ownerId)}`,
        { cache: 'no-store' }
      );
      const elementsData = await elementsRes.json();
      
      if (!elementsData.ok || !elementsData.elements) {
        alert('Failed to fetch element IDs');
        return;
      }
      
      const elementIds = elementsData.elements
        .filter((el: any) => el.basePolarity === 'pos') // Only export facts, not rules
        .map((el: any) => el.id);
      
      if (elementIds.length === 0) {
        alert('No fact elements found to export');
        return;
      }
      
      const exportRes = await fetch('/api/commitments/export-from-ludics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deliberationId: dialogueId,
          ludicCommitmentElementIds: elementIds,
          targetParticipantId: ownerId,
        }),
      });
      
      const exportData = await exportRes.json();
      
      if (!exportData.ok) {
        alert(`Export failed: ${exportData.error}`);
        return;
      }
      
      alert(
        `✓ Exported ${exportData.created?.length || 0} commitment(s) to dialogue\n` +
        `${exportData.skipped?.length || 0} skipped (already exist)`
      );
      
      await load();
    } catch (err) {
      console.error('Export error:', err);
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const q = (filter ?? '').toLowerCase();
   const filteredFacts = (facts ?? []).filter(f => (f?.label ?? '').toLowerCase().includes(q));
    const filteredRules = (rules ?? []).filter(r => (r?.label ?? '').toLowerCase().includes(q));

  return (
    <div className="rounded-lg border border-slate-200 bg-white/70 p-3 space-y-2 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <strong className="text-sm">Commitments — {ownerId}</strong>
          <span className="text-[11px] px-1.5 py-0.5 rounded border bg-slate-50">facts {facts.length}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded border bg-slate-50">rules {rules.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] inline-flex items-center gap-1">
            <input type="checkbox" checked={persistDerived} onChange={e=>setPersistDerived(e.target.checked)} />
            persist derived
          </label>
          {busy ? <span className="text-[11px] opacity-70">Working…</span> : null}
        </div>
      </div>

      <div className="flex gap-2">
        {/* Locus Selector */}
        <div className="flex items-center gap-1">
          <label className="text-[11px] text-slate-600">@</label>
          <select
            value={selectedLocusPath}
            onChange={(e) => setSelectedLocusPath(e.target.value)}
            className="text-[11px] px-1.5 py-1 rounded border border-slate-300 bg-white"
          >
            {availableLoci.map(locus => (
              <option key={locus.path} value={locus.path}>{locus.label}</option>
            ))}
          </select>
        </div>
        
        <input
          className="discussionfield rounded-md border px-2 py-1 text-sm flex-1"
          placeholder='Add a fact or a rule…  e.g. fact: congestion_high   •   rule: congestion_high & revenue_earmarked_transit -> net_public_benefit'
          value={label}
          onChange={e=>setLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              // heuristics: if looks like a rule, addRule else addFact
              /[-=]>\s|,|&/.test(label) ? addRule() : addFact();
            }
          }}
        />
        
          {/[=-]>\s|,|&/.test(label) && (
    <div className="text-[11px] mt-1 px-2 py-1 rounded border bg-slate-50">
      {(() => {
        const parsed = parseRule(label);
        const error = validateRule(label);
        if (error) {
          return <span className="text-rose-700">⚠️ {error}</span>;
        }
        if (parsed) {
          return <span className="text-green-700">✓ Rule looks good: <code>{parsed.ifAll.join(' & ')} → {parsed.then}</code></span>;
        }
        return <span className="text-amber-700">⚠️ Rule syntax unclear—check arrows</span>;
      })()}
    </div>
 )}
        <button className="px-2 py-1 btnv2 rounded-lg text-xs" onClick={addFact} disabled={busy}>+ Fact</button>
          <button
    className="px-2 py-1 btnv2 rounded-lg text-xs"
    onClick={addRule}
    disabled={busy || (/[=-]>\s|,|&/.test(label) && !parseRule(label))}
  >+ Rule</button>
      </div>

      <details className="rounded border bg-slate-200 px-2 py-1 text-[12px]">
  <summary className="cursor-pointer select-none">How to write rules</summary>
  <div className="mt-1 space-y-2 leading-relaxed">
    <div>
      <b>Facts</b> are single labels you believe are true now, e.g.
      <code className="mx-1">contract</code>,
      <code className="mx-1">delivered</code>,
      <code className="mx-1">to.pay</code>.
    </div>
    <div>
      <b>Rules</b> are written as <i>IF … THEN …</i>:
      <div className="mt-1 rounded bg-white/70 p-2 text-[11px]">
        <div><b>Format:</b> <code>A &amp; B -&gt; C</code> or <code>A,B =&gt; C</code></div>
        <div className="mt-1"><b>Negation:</b> <code>not X</code> or <code>¬X</code></div>
      </div>
    </div>
    <div>
      <b>Examples</b>
      <ul className="mt-1 list-disc pl-5">
        <li><code>contract &amp; delivered -&gt; to.pay</code></li>
        <li><code>charge_on_access &amp; not equity_program_in_place -&gt; regressive_impact</code></li>
        <li><code>regressive_impact -&gt; not net_public_benefit</code></li>
      </ul>
    </div>
    <div className="text-[11px] opacity-80">
      Contradiction is flagged when <code>X</code> and <code>not X</code> both hold.
      Only <b>entitled</b> items are used during inference (you can suspend a fact at any time).
    </div>
  </div>
</details>

      {(summary.derived?.length || summary.contradictions?.length) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {summary.derived?.map(d => (
            <span key={'der-'+d.label} className="px-2 py-0.5 border rounded bg-emerald-50 border-emerald-200 text-emerald-700">
              + derived: <b>{d.label}</b>
            </span>
          ))}
          {summary.contradictions?.map((c, i) => (
            <span key={'con-'+i} className="px-2 py-0.5 border rounded bg-rose-50 border-rose-300 text-rose-700">
              ⟂ {c.a} vs {c.b}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          className="border rounded minorfield px-2 py-1 text-[12px] flex-1"
          placeholder="Filter…"
          value={filter}
          onChange={e=>setFilter(e.target.value)}
        />
        <button className="text-[11px] px-2 py-1 rounded btnv2--ghost bg-white" onClick={load} disabled={busy}>Reload</button>
        <button className="text-[11px] px-2 py-1 rounded btnv2--ghost bg-white" onClick={clearDerived} disabled={busy}>Clear derived</button>
        <button className="text-[11px] px-2 py-1 rounded btnv2--ghost bg-white" onClick={exportToDialogue} disabled={busy} title="Export facts to dialogue system">
          ↗ Export to Dialogue
        </button>
        <button className="px-2 py-1 btnv2 rounded-lg text-xs" onClick={apply} disabled={busy}>Infer</button>
        <button 
          className="flex px-2 py-1 btnv2 w-fit btnv2--ghost rounded-lg text-xs border-sky-300 bg-sky-50 gap-2" 
          onClick={runScopedInference} 
          disabled={busy}
          title="Run inference at selected locus with inheritance from parent loci"
        >
          <span className='flex gap-1'>Infer @{selectedLocusPath}</span>
        </button>
      </div>

      {/* Scoped Inference Results */}
      {showScoped && scopedResult && (
        <div className="rounded border border-sky-200 bg-sky-50/50 p-2 space-y-2">
          <div className="flex items-center justify-between">
            <strong className="text-sm text-sky-800">
              Scoped Inference @ {scopedResult.locusPath}
            </strong>
            <button 
              className="text-[11px] px-2 py-0.5 rounded bg-white border" 
              onClick={() => setShowScoped(false)}
            >
              Close
            </button>
          </div>
          
          {/* Inherited indicator */}
          {scopedResult.effectiveFacts.some(f => f.inherited) && (
            <div className="text-[11px] text-sky-700 px-2 py-1 rounded bg-sky-100 border border-sky-200">
              ↳ Includes {scopedResult.effectiveFacts.filter(f => f.inherited).length} inherited fact(s) from parent loci
            </div>
          )}
          
          {/* Derived facts at this locus */}
          {scopedResult.derivedFacts.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {scopedResult.derivedFacts.map((d, i) => (
                <span key={i} className="px-2 py-0.5 border rounded bg-emerald-50 border-emerald-200 text-emerald-700 text-xs">
                  + {d.label} <span className="opacity-60">@{d.derivedAt}</span>
                </span>
              ))}
            </div>
          )}
          
          {/* Contradictions with locus info */}
          {scopedResult.contradictions.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-rose-700">⚠ Contradictions detected:</div>
              {scopedResult.contradictions.map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-rose-50 border border-rose-200 text-xs">
                  <span className="text-rose-700">⟂</span>
                  <span><b>{c.a}</b> @{c.aLocusPath}</span>
                  <span className="opacity-60">vs</span>
                  <span><b>{c.b}</b> @{c.bLocusPath}</span>
                  {c.type === 'inherited' && (
                    <span className="px-1 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-700 text-[10px]">
                      inherited conflict
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Effective facts grouped by locus */}
          <details className="text-xs">
            <summary className="cursor-pointer text-sky-700">
              View all effective facts ({scopedResult.effectiveFacts.length})
            </summary>
            <div className="mt-1 grid gap-1 pl-2 border-l-2 border-sky-200">
              {scopedResult.effectiveFacts.map((f, i) => (
                <div key={i} className={`px-2 py-0.5 rounded ${f.inherited ? 'bg-slate-100 text-slate-600' : 'bg-white'}`}>
                  {f.label}
                  <span className="ml-1 opacity-60">@{f.locusPath}</span>
                  {f.inherited && <span className="ml-1 text-[10px] text-sky-600">(inherited)</span>}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div>
          <b>Facts</b>
          <ul className="mt-1 space-y-1">
            {filteredFacts.map((f) => (
              <li key={'f:'+f.label} className="flex items-center gap-2">
                <span className={[
                  'px-2 py-0.5 rounded border',
                  f.derived ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white'
                ].join(' ')}>
                  {f.label}
                  {f.locusPath ? (
     <button
       className="ml-1 text-[11px] underline decoration-dotted text-sky-700"
       title="Focus this locus"
       onClick={() => {
         window.dispatchEvent(new CustomEvent('ludics:focus', {
           detail: { deliberationId: dialogueId, phase: 'focus-P' }
         }));
         // also nudge LociTree’s onFocusPathChange via the event; it already listens
         window.dispatchEvent(new CustomEvent('dialogue:moves:refresh'));
       }}
     >
       @{f.locusPath}
     </button>
  ) : null}
                </span>
                <button
                  className="text-[11px] px-1 py-0.5 rounded border bg-white"
                  title={f.entitled === false ? 'Entitlement suspended' : 'Entitled'}
                  onClick={() => toggleEntitled(f)}
                >
                  {f.entitled === false ? '⚠ suspend' : '✅ entitled'}
                </button>
                <button className="text-xs opacity-70" onClick={() => erase(f.label)} title="Remove">×</button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <b>Rules</b>
          <ul className="mt-1 space-y-1">
            {filteredRules.map((r) => (
              <li key={'r:'+r.label} className="flex items-center gap-2">
                <span className="px-2 py-0.5 border rounded bg-white">{r.label}{r.locusPath ? <span className="ml-1 text-[11px] opacity-60">@{r.locusPath}</span> : null}</span>
                <button className="text-xs opacity-70" onClick={() => erase(r.label)} title="Remove">×</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="text-[11px] opacity-70">
        <span className="mr-3">Legend: ✅ entitled, ⚠ suspended, green = derived</span>
      </div>
    </div>
  );
}
