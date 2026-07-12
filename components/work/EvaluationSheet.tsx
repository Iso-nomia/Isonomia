// components/work/EvaluationSheet.tsx
'use client';
import * as React from 'react';

type WorkLite = { id: string; deliberationId: string; title: string; theoryType: 'DN'|'IH'|'TC'|'OP' };
type AdequacyItem = { id: string; criterion: string; result: 'pass'|'partial'|'fail' };

const RESULT_STYLES = {
  pass: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  partial: 'bg-amber-50 border-amber-200 text-amber-700',
  fail: 'bg-rose-50 border-rose-200 text-rose-700',
};

export default function EvaluationSheet() {
  const [open, setOpen] = React.useState(false);
  const [ctx, setCtx] = React.useState<{ toWorkId: string; fromWorkId: string } | null>(null);

  const [fromWork, setFromWork] = React.useState<WorkLite | null>(null);
  const [toWork, setToWork]     = React.useState<WorkLite | null>(null);
  const [deliberationId, setDeliberationId] = React.useState<string | null>(null);

  const [mcda, setMcda] = React.useState<any | null>(null);
  const [method, setMethod] = React.useState<'mcda'|'adequacy'>('mcda');
  const [verdict, setVerdict] = React.useState<string>('');

  const [adequacy, setAdequacy] = React.useState<AdequacyItem[]>([
    { id: crypto.randomUUID(), criterion: 'Completeness', result: 'pass' },
    { id: crypto.randomUUID(), criterion: 'Robustness',   result: 'partial' },
  ]);

  const [pending, setPending] = React.useState(false);
  const [error, setError]     = React.useState<string | null>(null);

  // open handler from outside
  React.useEffect(() => {
    const onOpen = (e: any) => {
      setCtx(e.detail);
      setOpen(true);
    };
    window.addEventListener('mesh:open-evaluation-sheet' as any, onOpen);
    return () => window.removeEventListener('mesh:open-evaluation-sheet' as any, onOpen);
  }, []);

  // load work basics + MCDA snapshot
  React.useEffect(() => {
    if (!open || !ctx) return;

    setError(null);
    setFromWork(null);
    setToWork(null);
    setDeliberationId(null);
    setMcda(null);

    (async () => {
      try {
        const [src, dst] = await Promise.all([
          fetch(`/api/works/${ctx.fromWorkId}`, { cache:'no-store' }).then(r=>r.ok?r.json():null),
          fetch(`/api/works/${ctx.toWorkId}`,   { cache:'no-store' }).then(r=>r.ok?r.json():null),
        ]);
        if (src?.work) setFromWork(src.work as WorkLite);
        if (dst?.work) {
          setToWork(dst.work as WorkLite);
          setDeliberationId(dst.work.deliberationId);
        }

        // pull MCDA snapshot if present
        try {
          const j = await fetch(`/api/works/${ctx.fromWorkId}/practical`, { cache:'no-store' }).then(r=>r.ok?r.json():null);
          const m = j?.justification?.result ?? null;
          setMcda(m);
          setMethod(m ? 'mcda' : 'adequacy');
        } catch {
          setMethod('adequacy');
        }
      } catch (err:any) {
        setError(err?.message ?? 'Failed to load works');
      }
    })();
  }, [open, ctx]);

  if (!open || !ctx) return null;

  function updateAdequacyItem(id: string, patch: Partial<AdequacyItem>) {
    setAdequacy(items => items.map(it => it.id === id ? { ...it, ...patch } : it));
  }
  function addAdequacyItem() {
    setAdequacy(items => [...items, { id: crypto.randomUUID(), criterion: '', result: 'pass' }]);
  }
  function removeAdequacyItem(id: string) {
    setAdequacy(items => items.filter(it => it.id !== id));
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      if (!ctx) {
        setError('Missing evaluation context');
        setPending(false);
        return;
      }
      if (!deliberationId) {
        setError('Missing deliberationId for target work');
        setPending(false);
        return;
      }

      const meta: any = { method, verdict };
      if (method === 'mcda') {
        meta.mcda = mcda ?? null;
        if (!meta.mcda) {
          setError('No MCDA snapshot found on source work; pick "Adequacy" or add a Practical result.');
          setPending(false);
          return;
        }
      } else {
        meta.adequacy = {
          items: adequacy
            .map(a => ({ criterion: a.criterion.trim(), result: a.result }))
            .filter(a => a.criterion.length > 0),
        };
      }

      const r = await fetch('/api/knowledge-edges', {
        method: 'POST',
        headers: { 'content-type':'application/json' },
        body: JSON.stringify({
          deliberationId,
          kind: 'EVALUATES',
          fromWorkId: ctx.fromWorkId,
          toWorkId: ctx.toWorkId,
          meta,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        setError(`Save failed: ${r.status} ${txt}`);
        setPending(false);
        return;
      }

      window.dispatchEvent(new CustomEvent('mesh:edges-updated', { detail: { toWorkId: ctx.toWorkId } }));
      setOpen(false);
    } catch (err:any) {
      setError(err?.message ?? 'Unknown error');
    } finally {
      setPending(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm" 
      onClick={()=>setOpen(false)}
    >
      <div
        className="absolute right-0 top-0 h-full w-[480px] bg-white shadow-2xl flex flex-col"
        onClick={e=>e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b bg-gradient-to-r from-neutral-50 to-white">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900">Evaluation</h2>
            <button 
              className="px-3 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
              onClick={()=>setOpen(false)}
            >
              Close
            </button>
          </div>
          
          {/* Comparison Badge */}
          <div className="mt-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-900 truncate">
                  {fromWork?.title ?? 'Source'}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Source work
                </div>
              </div>
              <div className="flex-shrink-0 px-2 py-1 bg-white rounded border border-neutral-200">
                <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-neutral-900 truncate">
                  {toWork?.title ?? 'Target'}
                </div>
                <div className="text-[10px] text-neutral-500 mt-0.5">
                  Target work
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Method Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">
              Evaluation Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod('mcda')}
                disabled={!mcda}
                className={`
                  px-3 py-2 rounded-lg border-2 text-left transition-all text-xs
                  ${method === 'mcda'
                    ? 'border-sky-300 bg-sky-50 text-sky-900'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }
                  ${!mcda ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="font-semibold">MCDA Snapshot</div>
                <div className="text-[10px] mt-0.5 text-neutral-600">
                  {mcda ? 'Available' : 'Not available'}
                </div>
              </button>
              <button
                onClick={() => setMethod('adequacy')}
                className={`
                  px-3 py-2 rounded-lg border-2 text-left transition-all text-xs cursor-pointer
                  ${method === 'adequacy'
                    ? 'border-purple-300 bg-purple-50 text-purple-900'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }
                `}
              >
                <div className="font-semibold">Adequacy Checklist</div>
                <div className="text-[10px] mt-0.5 text-neutral-600">
                  Manual evaluation
                </div>
              </button>
            </div>
          </div>

          {/* MCDA Summary */}
          {method === 'mcda' && (
            <div className="p-4 rounded-lg border border-sky-200 bg-sky-50/50">
              {mcda ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-700">Best option:</span>
                    <span className="font-semibold text-neutral-900">{mcda.bestOptionId ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-700">Options evaluated:</span>
                    <span className="font-semibold text-neutral-900">{Object.keys(mcda.totals ?? {}).length}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-neutral-600">No MCDA result found on source work.</p>
              )}
            </div>
          )}

          {/* Adequacy Checklist Editor */}
          {method === 'adequacy' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700">
                  Evaluation Criteria
                </label>
                <button 
                  className="text-xs font-medium text-purple-600 hover:text-purple-700"
                  onClick={addAdequacyItem}
                >
                  + Add criterion
                </button>
              </div>
              
              <div className="space-y-2">
                {adequacy.map(item => (
                  <div key={item.id} className="p-3 rounded-lg border border-neutral-200 bg-white space-y-2">
                    <input
                      className="w-full px-2 py-1 text-xs font-medium border-0 bg-transparent focus:outline-none placeholder:text-neutral-400"
                      placeholder="Criterion name (e.g., Completeness)"
                      value={item.criterion}
                      onChange={e=>updateAdequacyItem(item.id, { criterion: e.target.value })}
                    />
                    <div className="flex items-center gap-2">
                      {(['pass', 'partial', 'fail'] as const).map(result => (
                        <button
                          key={result}
                          onClick={() => updateAdequacyItem(item.id, { result })}
                          className={`
                            flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium capitalize
                            border transition-all
                            ${item.result === result
                              ? RESULT_STYLES[result]
                              : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                            }
                          `}
                        >
                          {result}
                        </button>
                      ))}
                      <button 
                        className="px-2 py-1.5 text-[10px] text-neutral-500 hover:text-rose-600 transition-colors"
                        onClick={()=>removeAdequacyItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verdict */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">
              Verdict <span className="text-neutral-500 font-normal">(optional)</span>
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-shadow resize-none"
              rows={3}
              value={verdict}
              onChange={e=>setVerdict(e.target.value)}
              placeholder="e.g., Source dominates target on robustness and completeness"
            />
          </div>

          {/* Info Note */}
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200">
            <p className="text-[10px] text-neutral-600 leading-relaxed">
              {method === 'mcda' 
                ? 'The MCDA snapshot from the source work will be automatically included in the evaluation edge.'
                : 'The adequacy checklist will be saved with the evaluation edge for future reference.'
              }
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t bg-neutral-50">
          <button 
            className="w-full px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={submit} 
            disabled={pending}
          >
            {pending ? 'Saving evaluation…' : 'Save Evaluation Edge'}
          </button>
        </div>
      </div>
    </div>
  );
}