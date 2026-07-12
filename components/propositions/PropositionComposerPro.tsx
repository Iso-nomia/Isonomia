'use client';

import * as React from 'react';
import useSWR from 'swr';
import { z } from 'zod';

import { inferEpistemicMetadata, type EpistemicMetadata } from '@/lib/epistemic/inferEpistemicMetadata';
import EnthymemeNudge from '@/components/deepdive/EnthymemeNudge';
import { TheoryFraming } from '@/components/compose/TheoryFraming';
import { invalidateDeliberation } from '@/lib/deepdive/invalidate';
import { useLegalMoves } from '@/components/dialogue/useLegalMoves';
import { GlossaryEditorToolbar } from '@/components/glossary/GlossaryEditorToolbar';
import { GlossaryText } from '@/components/glossary/GlossaryText';
import CitationCollector, { type PendingCitation } from '@/components/citations/CitationCollector';
import type { Proposition } from './PropositionComposer';

// --- Types -------------------------------------------------------------------
type Quantifier = 'SOME' | 'MANY' | 'MOST' | 'ALL';
type Modality   = 'COULD' | 'LIKELY' | 'NECESSARY';
type CounterKind = 'support' | 'rebut_conclusion' | 'rebut_premise' | 'undercut_inference';

export type ReplyTarget =
  | { kind: 'proposition'; id: string; text?: string }
  | { kind: 'argument';    id: string; text?: string }
  | { kind: 'claim';       id: string; text?: string };

type Props = {
  deliberationId: string;
  replyTarget?: ReplyTarget | null;
  onCreated?: (p: Proposition) => void;             // fired after a *new proposition* is created (full row)
  onReplied?: (r: { id: string; text: string; createdAt: string; authorId: string }) => void; // fired after a *reply* is posted
  onPosted?: () => void;                            // generic "done" hook
  className?: string;
  placeholder?: string;
  initialText?: string;                             // pre-fill text (e.g., from article selection)
  autoPromote?: boolean;                            // auto-promote proposition to claim after creation
  onPromoted?: (claimId: string) => void;           // fired after auto-promote completes
};

// --- Validation (aligned to your API contracts) ------------------------------
const CREATE_SCHEMA = z.object({
  text: z.string().trim().min(1).max(5000),
  mediaType: z.enum(['text', 'image']),
  mediaUrl: z.string().url().optional(),
});
const REPLY_SCHEMA = z.object({
  text: z.string().trim().min(1).max(5000),
});

// --- Small fetcher helpers ----------------------------------------------------
const fetchJSON = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json());
async function fetchPropositionById(id: string): Promise<Proposition | null> {
  const res = await fetch(`/api/propositions/${encodeURIComponent(id)}`, { cache: 'no-store' });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.proposition) return null;
  return j.proposition as Proposition;
}

// --- Component ---------------------------------------------------------------
export function PropositionComposerPro({
  deliberationId,
  replyTarget,
  onCreated,
  onReplied,
  onPosted,
  className,
  placeholder = 'State your proposition…',
  initialText = '',
  autoPromote = false,
  onPromoted,
}: Props) {
  const [text, setText] = React.useState(initialText);
  
  // Reset text when initialText changes (e.g., new selection)
  React.useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);
  const [imageUrl, setImageUrl] = React.useState('');
  
  // Citation management - collect citations to attach after proposition is created
  const [pendingCitations, setPendingCitations] = React.useState<PendingCitation[]>([]);

  // Glossary preview mode
  const [showPreview, setShowPreview] = React.useState(false);

  // Epistemics (non-intrusive, progressive disclosure)
  const [quantifier, setQuantifier] = React.useState<Quantifier | undefined>();
  const [modality, setModality]     = React.useState<Modality | undefined>();
  const [confidence, setConfidence] = React.useState<number | undefined>();
  const [detected, setDetected]     = React.useState<EpistemicMetadata | null>(null);
  const [showEpiPanel, setShowEpiPanel] = React.useState(false);

  // Reply context (for non-proposition targets we allow counter-kind & mirror-to-edge)
  const [counterKind, setCounterKind] = React.useState<CounterKind>('support');
  const [concession, setConcession]   = React.useState('');
  const [counter, setCounter]         = React.useState('');

  // UX/state guards like your original composer
  const [pending, setPending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const pendingRef = React.useRef(false);
  const submitAbortRef = React.useRef<AbortController | null>(null);
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort('unmount');
    };
  }, []);

  // Autosize like your original
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.style.height = '0px';
      el.style.height = Math.min(360, el.scrollHeight) + 'px';
    });
    return () => cancelAnimationFrame(raf);
  }, [text]);

  // When replying to an argument, show its text for context
  const { data: targetArg } = useSWR(
    replyTarget?.kind === 'argument' ? `/api/arguments/${replyTarget.id}` : null,
    fetchJSON,
    { revalidateOnFocus: false }
  );
  const targetText =
    replyTarget?.text ||
    (replyTarget?.kind === 'argument' ? targetArg?.argument?.text : '') ||
    '';

  // Legal moves chips (only meaningful for argument/claim targets)
  const { data: legalMoves } = useLegalMoves(targetText);

  // Silent epistemic detection (progressive disclosure)
  const debounced = useDebounced({ text, citationCount: pendingCitations.length }, 500);
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!debounced.text.trim()) { setDetected(null); return; }
      // Pass empty array for sources since we're using structured citations now
      const m = await inferEpistemicMetadata(debounced.text, []);
      if (!cancel) setDetected(m);
      const diff =
        Math.abs((confidence ?? 0.5) - (m.confidence ?? 0.5)) > 0.2 ||
        (!!m.quantifier && m.quantifier !== quantifier) ||
        (!!m.modality && m.modality !== modality);
      if (diff) setShowEpiPanel(true);
    })();
    return () => { cancel = true; };
  }, [debounced.text, debounced.citationCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Contextual “clarify confidence” only on ambiguity
  const needsConfidenceClarifier = React.useMemo(
    () => hasContradictorySignals(text) || hasPrecisionWithoutConfidence(text) || hasConditionalWithoutModality(text),
    [text]
  );

  // Epistemic emoji shortcuts at end of text
  React.useEffect(() => {
    const { cleanText, metadata } = parseEpistemicShortcuts(text);
    if (cleanText !== text) {
      setText(cleanText);
      setQuantifier(metadata.quantifier ?? quantifier);
      setModality(metadata.modality ?? modality);
      setConfidence(metadata.confidence ?? confidence);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function showError(msg: string) {
    setErrorMsg(msg);
    window.setTimeout(() => mountedRef.current && setErrorMsg(null), 3500);
  }

  // --- Submit: correct routing for (A) new proposition vs (B) reply to proposition
  async function submit() {
    if (pendingRef.current) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // (B) Reply to a *proposition* → informal thread at /api/propositions/:id/replies
    if (replyTarget?.kind === 'proposition') {
      const parsed = REPLY_SCHEMA.safeParse({ text: trimmed });
      if (!parsed.success) { showError('Please enter your reply.'); return; }

      pendingRef.current = true; setPending(true);
      submitAbortRef.current?.abort('replaced');
      const ctrl = new AbortController(); submitAbortRef.current = ctrl;

      try {
        const r = await fetch(`/api/propositions/${encodeURIComponent(replyTarget.id)}/replies`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
          signal: ctrl.signal,
        });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

        // invalidate list counts + let parent react
        React.startTransition(() => invalidateDeliberation(deliberationId));
        setText('');
        onReplied?.(j?.reply);
        onPosted?.();
        window.dispatchEvent(new CustomEvent('propositions:reply:created', { detail: { propositionId: replyTarget.id } }));
      } catch (e: any) {
        if (e?.name !== 'AbortError') showError(e?.message ?? 'Could not post reply.');
      } finally {
        if (submitAbortRef.current === ctrl) submitAbortRef.current = null;
        pendingRef.current = false; setPending(false);
      }
      return;
    }

    // (A) New proposition → /api/deliberations/:id/propositions  (returns { ok, propositionId })
    const createPayload =
      imageUrl.trim()
        ? { text: trimmed, mediaType: 'image' as const, mediaUrl: imageUrl.trim() }
        : { text: trimmed, mediaType: 'text' as const };
    const parsed = CREATE_SCHEMA.safeParse(createPayload);
    if (!parsed.success) { showError(parsed.error.issues[0]?.message ?? 'Please check your input.'); return; }

    pendingRef.current = true; setPending(true);
    submitAbortRef.current?.abort('replaced');
    const ctrl = new AbortController(); submitAbortRef.current = ctrl;

    try {
      const r = await fetch(`/api/deliberations/${encodeURIComponent(deliberationId)}/propositions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: ctrl.signal,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);

      // This endpoint returns { ok, propositionId } – fetch full row if the parent wants it
      const createdId: string | undefined = j?.propositionId ?? j?.id;
      let created: Proposition | null = null;
      if (createdId && onCreated) {
        try { created = await fetchPropositionById(createdId); } catch {}
      }

      React.startTransition(() => invalidateDeliberation(deliberationId));
      setText(''); setImageUrl(''); setPendingCitations([]);
      
      // Attach any pending citations to the newly created proposition
      if (createdId && pendingCitations.length > 0) {
        await Promise.all(
          pendingCitations.map(async (citation) => {
            try {
              // First resolve the source
              let resolvePayload: any = {};
              if (citation.type === "url") {
                resolvePayload = { url: citation.value, meta: { title: citation.title } };
              } else if (citation.type === "doi") {
                resolvePayload = { doi: citation.value };
              } else if (citation.type === "library") {
                resolvePayload = { libraryPostId: citation.value, meta: { title: citation.title } };
              }

              const resolveRes = await fetch('/api/citations/resolve', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(resolvePayload),
              });
              const { source } = await resolveRes.json();
              
              if (!source?.id) throw new Error('Failed to resolve source');

              // Then attach the citation
              await fetch('/api/citations/attach', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  targetType: 'proposition',
                  targetId: createdId,
                  sourceId: source.id,
                  locator: citation.locator,
                  quote: citation.quote,
                  note: citation.note,
                }),
              });
            } catch (e) {
              console.error('Failed to attach citation:', e);
            }
          })
        );
        
        // Fire event after all citations are attached
        window.dispatchEvent(new CustomEvent('citations:changed', { 
          detail: { targetType: 'proposition', targetId: createdId } 
        }));
      }
      
      // Call onCreated AFTER citations are attached
      onCreated?.(created ?? ({ id: createdId!, deliberationId, authorId: '', text: trimmed, mediaType: parsed.data.mediaType, mediaUrl: (parsed.data as any).mediaUrl ?? null, status: 'PUBLISHED', promotedClaimId: null, voteUpCount: 0, voteDownCount: 0, endorseCount: 0, replyCount: 0, createdAt: new Date().toISOString() } as any));
      
      // Auto-promote to claim if requested
      if (autoPromote && createdId) {
        try {
          const promoteRes = await fetch(`/api/propositions/${createdId}/promote`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ deliberationId, text: trimmed }),
            signal: ctrl.signal,
          });
          const promoteJson = await promoteRes.json().catch(() => null);
          if (promoteRes.ok && promoteJson?.claimId) {
            onPromoted?.(promoteJson.claimId);
            window.dispatchEvent(new CustomEvent('claims:changed', { detail: { deliberationId } }));
          }
        } catch (e) {
          console.error('Failed to auto-promote proposition to claim:', e);
        }
      }
      
      onPosted?.();
      window.dispatchEvent(new CustomEvent('propositions:created', { detail: { deliberationId, id: createdId } }));

      // Optional: if replying to a *formal* target (argument/claim) and a counter was provided,
      // mirror this as a formal edge (support/rebut/undercut). No-op for proposition targets.
    //   if (replyTarget && replyTarget.kind !== 'proposition' && counterKind !== 'support' && counter.trim()) {
    //     try {
    //       await mirrorInformalCounterAsEdge({ deliberationId, replyTarget, counterKind, counter });
    //       window.dispatchEvent(new CustomEvent('dialogue:moves:refresh', { detail: { deliberationId } }));
    //     } catch { /* soft-fail; workshop first */ }
    //   }
    } catch (e: any) {
      if (e?.name !== 'AbortError') showError(e?.message ?? 'Could not post proposition.');
    } finally {
      if (submitAbortRef.current === ctrl) submitAbortRef.current = null;
      pendingRef.current = false; setPending(false);
    }
  }

  // --- UI --------------------------------------------------------------------
  const used = text.length, max = 5000, pct = Math.min(1, used / max);

  // For TheoryFraming (single, not duplicated)
  const [theoryFramingValue, setTheoryFramingValue] = React.useState<{ theoryType: any; standardOutput?: string }>({ theoryType: undefined });

  return (
    <div
      aria-busy={pending}
      className={[
        'group relative rounded-2xl panel-edge bg-indigo-50/70 p-4 backdrop-blur space-y-3',
        'scroll-mt-24',
        className || '',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-md font-semibold text-slate-700">
          {replyTarget?.kind === 'proposition' ? 'Reply to proposition' : replyTarget ? 'Reply with a proposition' : 'New proposition'}
        </div>
        <div className="text-[11px] text-neutral-500">{pending ? 'Posting…' : '⌘/Ctrl + Enter to post'}</div>
      </div>

      {/* Reply context (only show counter-type / legal moves for *formal* targets) */}
      {replyTarget && replyTarget.kind !== 'proposition' && (
        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-2">
          <div className="text-[11px] mb-1 text-amber-900">Replying to: {targetText || replyTarget.text || replyTarget.id}</div>
          <div className="flex items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1">
              Counter type:
              <select className="border rounded px-2 py-1" value={counterKind} onChange={(e) => setCounterKind(e.target.value as CounterKind)}>
                <option value="support">Support</option>
                <option value="rebut_conclusion">Rebut conclusion</option>
                <option value="rebut_premise">Rebut premise</option>
                <option value="undercut_inference">Undercut inference</option>
              </select>
            </label>
            {legalMoves?.moves?.length > 0 && (
              <LegalMovesChips moves={legalMoves.moves} onInsertTemplate={(t) => insertAtCursor(textareaRef, t, setText)} />
            )}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-neutral-700">Add a “Yes, but…” (concede + counter)</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <textarea rows={3} className="w-full text-xs border rounded px-2 py-1 bg-white" placeholder="Concession (what do you grant?)" value={concession} onChange={(e) => setConcession(e.target.value)} />
              <textarea rows={3} className="w-full text-xs border rounded px-2 py-1 bg-white" placeholder="Counter (what do you push back on?)" value={counter} onChange={(e) => setCounter(e.target.value)} />
            </div>
          </details>
        </div>
      )}

      {/* Core text */}
      <div className="space-y-2">
        {/* Glossary toolbar */}
        <GlossaryEditorToolbar
          deliberationId={deliberationId}
          onInsertTerm={(syntax) => insertAtCursor(textareaRef, syntax, setText)}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
        />

        {/* Edit mode: textarea */}
        {!showPreview && (
          <textarea
            ref={textareaRef}
            rows={3}
            placeholder={placeholder}
            className="w-full h-full resize-none rounded-lg articlesearchfield px-3 py-3 mt-1 bg-white text-sm"
            value={text}
            maxLength={max}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !pending && text.trim()) {
                e.preventDefault(); submit();
              }
            }}
            disabled={pending}
            spellCheck
            aria-label="Proposition text"
            enterKeyHint="done"
          />
        )}

        {/* Preview mode: glossary text */}
        {showPreview && (
          <div className="w-full min-h-[120px] rounded-lg articlesearchfield px-3 py-3 mt-1 bg-white text-sm">
            <GlossaryText text={text} className="whitespace-pre-wrap" />
          </div>
        )}

        <div className="h-1.5 overflow-hidden rounded bg-slate-200/70" aria-hidden>
          <div className="h-full rounded bg-[linear-gradient(90deg,theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.sky.400))]" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="text-[11px] text-neutral-500 tabular-nums">{used}/{max}</div>

        {needsConfidenceClarifier && (
          <div className="absolute right-3 -mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 shadow-sm">
            <div className="text-[10px] text-amber-900 mb-1">Mixed confidence signals—clarify?</div>
            <input type="range" min={0} max={100} defaultValue={Math.round((confidence ?? 0.5) * 100)} className="w-32" onChange={(e) => setConfidence(Number(e.target.value) / 100)} />
          </div>
        )}

        {errorMsg && (
          <div role="status" aria-live="polite" className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Epistemic metadata (collapsed by default, auto-opens when detection differs) */}
      {/* <div className="space-y-2">
        <button type="button" className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900" onClick={() => setShowEpiPanel((v) => !v)}>
          {showEpiPanel ? '▼' : '▶'} Epistemic metadata
          {detected && !showEpiPanel && (
            <span className="ml-2 text-[10px] text-gray-500">
              ({detected.quantifier ?? '?'} • {detected.modality ?? '?'} • {Math.round(detected.confidence * 100)}%)
            </span>
          )}
        </button>
        {showEpiPanel && (
          <div className="space-y-2 pl-4 border-l-2 border-sky-200">
            <div className="flex flex-wrap items-center gap-2">
              <SmallSelect label="Quantifier" value={quantifier} onChange={setQuantifier} options={['SOME', 'MANY', 'MOST', 'ALL']} />
              <SmallSelect label="Modality" value={modality} onChange={setModality} options={['COULD', 'LIKELY', 'NECESSARY']} />
              <SmallSlider label="Confidence" value={confidence ?? 0.7} onChange={setConfidence} />
              {detected && (
                <button className="text-[11px] text-sky-700 underline" onClick={() => { setQuantifier(detected.quantifier ?? undefined); setModality(detected.modality ?? undefined); setConfidence(detected.confidence); }}>
                  Apply detected
                </button>
              )}
            </div>
            {detected && (
              <details className="text-[10px] text-gray-600">
                <summary className="cursor-pointer">How was this confidence detected?</summary>
                <div className="mt-1 space-y-0.5">
                  <div>Hedges: {detected.signals.hedges} • Boosters: {detected.signals.boosters} • Evidence markers: {detected.signals.evidenceCount}</div>
                  <div>Avg source quality: {(detected.signals.sourceQuality * 100).toFixed(0)}%</div>
                  <div>Detected baseline: {Math.round(detected.confidence * 100)}%</div>
                </div>
              </details>
            )}
          </div>
        )}
      </div> */}
<div className='flex w-full gap-2'>
      {/* Citations - Use CitationCollector for evidence attachment */}
      <CitationCollector
        citations={pendingCitations}
        onChange={setPendingCitations}
        className="w-full"
      />

     
</div>
      <details className="rounded-md cardv2 bg-white items-center gap-4 panel-edge px-2 py-2">
        <summary className="cursor-pointer text-xs text-start px-2 tracking-wide text-neutral-700">
          <span className='px-1'>Attach media</span></summary>

     
        <div className="mt-4">

 {/* Media attachment */}
      {replyTarget?.kind !== 'proposition' && (  // replies to propositions stay text-only per API
        <MediaField imageUrl={imageUrl} setImageUrl={setImageUrl} disabled={pending} />
      )}
</div>
 </details>
      {/* Connect to theory (single, not duplicated) */}
       <details className="rounded-md cardv2 bg-white items-center gap-4 panel-edge px-2 py-2">
        <summary className="cursor-pointer text-xs text-start px-2 tracking-wide text-neutral-700">
          <span className='px-1'>Connect to theory</span></summary>
        <div className="mt-3">
          <TheoryFraming value={theoryFramingValue} onChange={setTheoryFramingValue} />
        </div>
      </details>

      {/* Smart helper (enthymeme nudge) */}
      <EnthymemeNudge
        deliberationId={deliberationId}
        targetType={replyTarget?.kind === 'argument' ? 'argument' : 'card'}
        targetId={replyTarget?.kind === 'argument' ? replyTarget.id : undefined}
        draft={text}
        insert={(t) => insertAtCursor(textareaRef, t, setText)}
        onPosted={() => window.dispatchEvent(new CustomEvent('dialogue:moves:refresh', { detail: { deliberationId } }))}
      />

      {/* Submit */}
      <div className="flex justify-start">
        <button type="button" className="btnv2 px-5 py-2 text-xs tracking-wide" onClick={submit} disabled={pending || !text.trim()}>
          {pending ? 'Posting…' : (replyTarget?.kind === 'proposition' ? 'Post reply' : 'Post')}
        </button>
      </div>
    </div>
  );
}

/* -------------------- UI atoms & helpers (unchanged patterns) -------------------- */

function SmallSelect<T extends string>({ label, value, onChange, options }:{
  label: string; value?: T; onChange: (v: T) => void; options: readonly T[];
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs">
      {label}:
      <select className="border rounded px-2 py-1 text-xs" value={value ?? ''} onChange={(e) => onChange(e.target.value as T)}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function SmallSlider({ label, value, onChange }:{ label: string; value: number; onChange: (v: number) => void; }) {
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      {label}:
      <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <span className="tabular-nums">{Math.round(value * 100)}%</span>
    </label>
  );
}

function insertAtCursor(ref: React.RefObject<HTMLTextAreaElement>, snippet: string, setValue: (s: string) => void) {
  const el = ref.current; if (!el) return;
  const start = el.selectionStart ?? el.value.length; const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + snippet + el.value.slice(end);
  setValue(next);
  setTimeout(() => { el.focus(); const pos = start + snippet.length; el.setSelectionRange(pos, pos); }, 0);
}

function useDebounced<T>(value: T, ms = 500): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* --- ambiguity triggers (invisible intelligence) --- */
function hasContradictorySignals(s: string) {
  const hasHedge = /\b(might|could|perhaps|maybe|possibly)\b/i.test(s);
  const hasBooster = /\b(certainly|definitely|clearly|undeniably|must)\b/i.test(s);
  return hasHedge && hasBooster;
}
function hasPrecisionWithoutConfidence(s: string) {
  const hasNumber = /\d+\.\d{2,}/.test(s);
  const hasConfidenceMarker = /\b(approximately|roughly|about|circa|~)\b/i.test(s);
  return hasNumber && !hasConfidenceMarker;
}
function hasConditionalWithoutModality(s: string) {
  const hasIf = /\bif\b/i.test(s);
  const hasModal = /\b(would|could|might|must|should)\b/i.test(s);
  return hasIf && !hasModal;
}

const SHORTCUTS: Record<string, { confidence: number; modality: Modality; quantifier: Quantifier }> = {
  '!!': { confidence: 0.95, modality: 'NECESSARY', quantifier: 'ALL' },
  '!':  { confidence: 0.8,  modality: 'LIKELY',    quantifier: 'MOST' },
  '??': { confidence: 0.3,  modality: 'COULD',     quantifier: 'SOME' },
  '?':  { confidence: 0.5,  modality: 'COULD',     quantifier: 'SOME' },
  '~':  { confidence: 0.6,  modality: 'LIKELY',    quantifier: 'MANY' },
};
function parseEpistemicShortcuts(text: string): {
  cleanText: string; metadata: Partial<{ confidence: number; modality: Modality; quantifier: Quantifier }>;
} {
  const match = text.match(/\s+(!!|\?{1,2}|!|~)\s*$/);
  if (!match) return { cleanText: text, metadata: {} };
  const k = match[1]; const cleanText = text.replace(match[0], '').trim();
  return { cleanText, metadata: SHORTCUTS[k] ?? {} };
}

function SourcesField({ sources, onChange, grades }:{
  sources: string[]; onChange: (s: string[]) => void; grades: Array<{ url: string; host: string; score: number }>;
}) {
  const [val, setVal] = React.useState('');
  return (
    <div className="space-y-1 w-full">
      <div className="flex items-center gap-2">
        <input type="url" placeholder="Add source URL" className="w-full rounded-lg articlesearchfield px-3 py-2 text-xs"
          value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && val.trim()) { onChange([...new Set([...sources, val.trim()])]); setVal(''); } }}
          aria-label="Add source URL"
        />
        {val && <button className="btnv2--ghost btnv2--sm" onClick={() => setVal('')}>Clear</button>}
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {grades.map((g) => (
            <span key={g.url}
              className={[
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
                g.score >= 0.8 ? 'bg-green-50 border-green-200' : g.score >= 0.6 ? 'bg-sky-50 border-sky-200' : 'bg-gray-50 border-gray-200',
              ].join(' ')}
              title={`Quality ~${Math.round(g.score * 100)}%`}
            >
              <a className="underline" href={g.url} target="_blank" rel="noreferrer">{g.host}</a>
              <button className="text-neutral-500 hover:text-rose-600" title="Remove" onClick={() => onChange(sources.filter((u) => u !== g.url))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaField({ imageUrl, setImageUrl, disabled }:{ imageUrl: string; setImageUrl: (s: string) => void; disabled?: boolean; }) {
  const [debounced, setDebounced] = React.useState(imageUrl);
  React.useEffect(() => { const t = setTimeout(() => setDebounced(imageUrl), 300); return () => clearTimeout(t); }, [imageUrl]);
  return (
    <div className="space-y-1 w-full">
      <div className="flex items-center gap-2">
        <input type="url" placeholder="Paste image URL (optional)" className="w-full rounded-lg articlesearchfield px-3 py-2 text-xs"
          value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={disabled} aria-label="Image URL"
        />
        {imageUrl && <button className="btnv2--ghost btnv2--sm" onClick={() => setImageUrl('')} disabled={disabled}>Clear</button>}
      </div>
      {debounced && (
        <div className="rounded border border-slate-200 bg-white/80 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={debounced} alt="image preview" className="mx-auto max-h-40 object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageUrl('')} />
        </div>
      )}
    </div>
  );
}

function LegalMovesChips({ moves, onInsertTemplate }:{ moves: Array<{ label: string; template?: string }>; onInsertTemplate: (t: string) => void; }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
      <span className="opacity-60">Legal moves:</span>
      {moves.map((m, i) => (
        <button key={`${m.label}-${i}`} className="px-1.5 py-0.5 rounded border bg-white hover:bg-slate-50"
          onClick={() => m.template && onInsertTemplate(m.template)} title={m.label}>{m.label}
        </button>
      ))}
    </div>
  );
}

/** Mirror an informal reply to a *formal* counter edge (optional) */
async function mirrorInformalCounterAsEdge({
  deliberationId, replyTarget, counterKind, counter,
}: { deliberationId: string; replyTarget: ReplyTarget; counterKind: CounterKind; counter: string; }) {
  const argRes = await fetch(`/api/deliberations/${deliberationId}/arguments`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: counter.trim() || '(counter)' }),
  });
  const arg = await argRes.json(); if (!argRes.ok || arg?.error) throw new Error(arg?.error ?? 'Failed to create argument');

  let type: 'support' | 'rebut' | 'undercut' = 'support';
  let targetScope: 'conclusion' | 'premise' | 'inference' | undefined;
  if (counterKind === 'rebut_conclusion') (type = 'rebut'), (targetScope = 'conclusion');
  else if (counterKind === 'rebut_premise') (type = 'rebut'), (targetScope = 'premise');
  else if (counterKind === 'undercut_inference') (type = 'undercut'), (targetScope = 'inference');

  await fetch(`/api/deliberations/${deliberationId}/edges`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fromArgumentId: arg.argument.id, toArgumentId: replyTarget.id, type, targetScope }),
  });
}
