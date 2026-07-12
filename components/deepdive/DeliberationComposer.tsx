//This is a legacy, obselete file kept for reference. Please do not edit or use this file.

"use client";
import { useState,useEffect } from "react";
import { z } from "zod";
import { invalidateDeliberation } from '@/lib/deepdive/invalidate';
import EnthymemeNudge from '@/components/deepdive/EnthymemeNudge';
import { TheoryFraming } from "../compose/TheoryFraming";
import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLegalMoves } from "../dialogue/useLegalMoves";
import useSWR from 'swr';

const fetcher = (u:string)=>fetch(u,{cache:'no-store'}).then(r=>r.json());


type Props = {
  key?: string;
  deliberationId: string;
  onPosted?: () => void;
  targetArgumentId?: string;
  targetPreviewText?: string;
    isReplyMode?: boolean;                     // ← new
  onClearReply?: () => void;                 // ← new
} & React.HTMLAttributes<HTMLDivElement>; // <-- allow id/className/etc
type CounterKind =
  | "none"
  | "rebut_conclusion"
  | "rebut_premise"
  | "undercut_inference";

const schema = z.object({
  text: z.string().min(1).max(5000),
  sources: z.array(z.string().url()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  isImplicit: z.boolean().optional(),
  quantifier: z.enum(['SOME','MANY','MOST','ALL']).optional(),
   modality: z.enum(['COULD','LIKELY','NECESSARY']).optional(),
});

// --- Helpers (no deps) ---

function MissingAxiomBar({ insert }:{ insert:(t:string)=>void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] mb-2">
      <span className="opacity-60 mr-1">Axiom prompts:</span>
      <button className="px-2 py-0.5 rounded border"
        onClick={() => insert('Default rule:\nSUPPOSE …\nUNLESS not(…)\nTHEREFORE …')}>
        Default rule ⟨α, ¬β⟩ ⇒ γ
      </button>
      <button className="px-2 py-0.5 rounded border"
        onClick={() => insert('∀x (…x…) — instantiate with x = …')}>
        ∀‑instantiate
      </button>
      <button className="px-2 py-0.5 rounded border"
        onClick={() => insert('∃x (…x…) — provide witness: x = …')}>
        ∃‑witness
      </button>
      <button className="px-2 py-0.5 rounded border"
        onClick={() => insert('Presupposition: “…” — please justify or revise.')}>
        Presupposition?
      </button>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value?: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-slate-200/80 bg-white/70 p-0.5 backdrop-blur"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={[
              "px-2.5 py-1 text-xs rounded",
              active
                ? "bg-slate-100  text-slate-900"
                : "text-slate-900  hover:bg-slate-300",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Insert text at the caret (or append if no focus)
function useInsertAtCursor(
  text: string,
  setText: React.Dispatch<React.SetStateAction<string>>
) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  function insert(snippet: string) {
    const el = ref.current;
    if (!el) {
      setText((t) => (t ? t + "\n\n" + snippet : snippet));
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + snippet + text.slice(end);
    setText(next);
    queueMicrotask(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }
  return { textareaRef: ref, insertAtCursor: insert };
}

// Auto-resize a textarea as content grows (caps at 320px)
function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement>, value: string) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(320, el.scrollHeight) + "px";
  }, [ref, value]);
}

  function mapKeyToTemplate(rawKey: string): string {
    const key = rawKey.replace(/[\s-]/g, '_'); // normalize
    const T: Record<string, string> = {
    attack_antecedent: 'I contest the antecedent: …',
    ask_consequent: 'Please commit to the consequent: …',
    pick_disjunct: 'Let’s focus on the “… or …” branch: I pick “…”.',

      choose_left: 'Let’s focus on the left disjunct “…”.',
      choose_right: 'Let’s focus on the right disjunct “…”.',
      challenge_conjunct_1: 'I challenge the first conjunct “…”.',
      challenge_conjunct_2: 'I challenge the second conjunct “…”.',
      instantiate: '∀x (…x…) — instantiate with x = …',
      ask_witness: '∃x (…x…) — provide witness: x = …',
    challenge_presup: 'Presupposition: “…” — please justify or revise.',
   };
  return T[key] ?? 'Please provide a reason or evidence for “…”.';
}

export default function DeliberationComposer({
key,
  deliberationId,
  onPosted,
  targetArgumentId,
    targetPreviewText,
  className,
    isReplyMode = false,
  onClearReply,
  ...rest
}: Props) {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [edgeType, setEdgeType] = useState<
    "support" | "rebut" | "undercut" | null
  >(null);
  const [imageUrl, setImageUrl] = useState("");
  const [quantifier, setQuantifier] = useState<
    "SOME" | "MANY" | "MOST" | "ALL" | undefined
  >();
  const [modality, setModality] = useState<
    "COULD" | "LIKELY" | "NECESSARY" | undefined
  >();
  const [counterKind, setCounterKind] = useState<CounterKind>("none");
  const [workTitle, setWorkTitle] = useState("");
const [workBody, setWorkBody]   = useState("");

  const [showYesBut, setShowYesBut] = useState(false);
  const [concession, setConcession] = useState("");
  const [counter, setCounter] = useState("");

  const [showWorkFields, setShowWorkFields] = useState(false);
  const [savedWorkId, setSavedWorkId] = React.useState<string | null>(null);
  const framingRef = React.useRef<HTMLDivElement|null>(null);



  const [framing, setFraming] = React.useState<{ theoryType:'DN'|'IH'|'TC'|'OP'; standardOutput?:string }>({
    theoryType: 'DN',
  });

  const { textareaRef, insertAtCursor } = useInsertAtCursor(text, setText);
useAutoGrow(textareaRef, text);

const [sourceInput, setSourceInput] = useState("");
const removeSource = (url: string) =>
  setSources((prev) => prev.filter((u) => u !== url));


const [isFocused, setIsFocused] = React.useState(false);
const [recentReply, setRecentReply] = React.useState<{ id: string; text: string } | null>(null);




// Accept “insert template” events from elsewhere (e.g., SequentDetails)
useEffect(() => {
  const handler = (ev: any) => {
    const tmpl = ev?.detail?.template as string | undefined;
    if (!tmpl) return;
    insertAtCursor(tmpl);
  };
  window.addEventListener("mesh:composer:insert", handler);
  return () => window.removeEventListener("mesh:composer:insert", handler);
}, [insertAtCursor]);

// Optional: Cmd/Ctrl + Enter to post
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim() && !pending) {
      e.preventDefault();
      post();
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [text, pending]); 
  
  const { user } = useAuth();
// Derive an id from common providers
const effectiveUserId =
  // Supabase / Clerk
  (user as any)?.id ??
  // Custom contexts that use userId
  (user as any)?.userId ??
  // Firebase
  (user as any)?.uid ??
  // Auth0
  (user as any)?.sub ??
  null;

  // const userId = effectiveUserId;
    const addSource = (url: string) => {
    try {
      new URL(url);
      setSources((prev) => [...new Set([...prev, url])]);
    } catch {}
  };

  const post = async () => {
    const body = {
      text,
      sources,
      confidence,
      quantifier,
      modality,
      mediaType: imageUrl ? "image" : "text",
      mediaUrl: imageUrl || undefined,
    };
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      return alert("Please add a point (and valid sources if included).");

    setPending(true);
    try {
      // 1) create argument
      const res = await fetch(
        `/api/deliberations/${deliberationId}/arguments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const { argument } = await res.json();

      // 2) if replying to a target with an edge type, add edge
      if (targetArgumentId && edgeType) {
        await fetch(`/api/deliberations/${deliberationId}/edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromArgumentId: argument.id,
            toArgumentId: targetArgumentId,
            type: edgeType,
          }),
        });
      }
      invalidateDeliberation(deliberationId);
    recordRecentReply(); 
      setText("");
      setSources([]);
      setConfidence(undefined);
      setEdgeType(null);
      onPosted?.();
    } catch (e: any) {
      console.error(e);
      alert("Could not post. Please try again.");
    } finally {
      setPending(false);
    }
  };

  async function createArgument(argText: string) {
    const res = await fetch(`/api/deliberations/${deliberationId}/arguments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: argText }),
    });
    const data = await res.json();
    if (!res.ok || data.error)
      throw new Error(data.error ?? "Failed to create argument");
    return data.argument as { id: string };
  }

  async function createEdge(
    fromArgumentId: string,
    toArgumentId: string,
    kind: CounterKind | "support" | "concede"
  ) {
    // map to API payload
    let type: "support" | "rebut" | "undercut" | "concede" = "support";
    let targetScope: "conclusion" | "premise" | "inference" | undefined;

    if (kind === "rebut_conclusion") {
      type = "rebut";
      targetScope = "conclusion";
    } else if (kind === "rebut_premise") {
      type = "rebut";
      targetScope = "premise";
    } else if (kind === "undercut_inference") {
      type = "undercut";
      targetScope = "inference";
    } else if (kind === "concede") {
      type = "concede";
    }

    const res = await fetch(`/api/deliberations/${deliberationId}/edges`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fromArgumentId,
        toArgumentId,
        type,
        targetScope,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error)
      throw new Error(data.error ?? "Failed to create edge");
    return data.edge;
  }

  const { data: targetArg } = useSWR(
    targetArgumentId ? `/api/arguments/${targetArgumentId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const swrText = targetArg?.argument?.text ?? '';
  const targetText = swrText || targetPreviewText || '';

  const showReplyContext = isReplyMode && !!targetArgumentId; // ← use this

  // capture the active reply target as "recent" when a post succeeds
const recordRecentReply = React.useCallback(() => {
  if (targetArgumentId && (targetText || targetPreviewText)) {
    setRecentReply({ id: targetArgumentId, text: targetText || targetPreviewText! });
  }
}, [targetArgumentId, targetText, targetPreviewText]);



  //const targetText: string = targetArg?.argument?.text ?? '';
  
  async function submitSimple() {
    if (!text.trim()) return;
    setPending(true);
    try {
      const created = await createArgument(text.trim());

      // If this is a counter reply, attach the appropriate edge
      if (targetArgumentId && counterKind !== "none") {
        await createEdge(created.id, targetArgumentId, counterKind);
      }
      invalidateDeliberation(deliberationId);

      setText("");
      setCounterKind("none");
      onPosted?.();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    } finally {
      setPending(false);
    }
  }


useEffect(() => {
  const onFocus = (ev: any) => {
    if (!ev?.detail || ev.detail.deliberationId === deliberationId) {
      textareaRef.current?.focus();
    }
  };
  window.addEventListener('mesh:composer:focus', onFocus);
  return () => window.removeEventListener('mesh:composer:focus', onFocus);
}, [deliberationId]);

// Also focus after a new reply target arrives (nice UX)
useEffect(() => {
  if (targetArgumentId) {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }
}, [targetArgumentId]);

  async function submitYesBut() {
    if (!targetArgumentId) return; // needs a target
    const hasConcession = concession.trim().length > 0;
    const hasCounter = counter.trim().length > 0;
    if (!hasConcession && !hasCounter) return;

    setPending(true);
    try {
      // (a) post concession (optional)
      let concessionArgId: string | null = null;
      if (hasConcession) {
        const a = await createArgument(concession.trim());
        concessionArgId = a.id;
        await createEdge(concessionArgId, targetArgumentId, "concede"); // visual concession link
      }

      // (b) post counter (required for counter effect)
      if (hasCounter) {
        const b = await createArgument(counter.trim());
        await createEdge(b.id, targetArgumentId, "rebut_conclusion"); // default rebut-to-conclusion
      }

      setConcession("");
      setCounter("");
      setShowYesBut(false);
      invalidateDeliberation(deliberationId);

      onPosted?.();
    } catch (e: any) {
      alert(e?.message ?? "Failed");
    } finally {
      setPending(false);
    }
  }
  // inside DeliberationComposer (add this effect near other hooks)
useEffect(() => {
  const handler = (ev: CustomEvent) => {
    if (!ev?.detail) return;
    if (ev.detail.deliberationId !== deliberationId) return;
    setShowWorkFields(true);
    // optional: focus title for quick typing
    setTimeout(() => {
      const el = document.getElementById('work-title-input');
      if (el) (el as HTMLInputElement).focus();
    }, 0);
  };
  window.addEventListener('mesh:open-work-fields', handler as any);
  return () => window.removeEventListener('mesh:open-work-fields', handler as any);
}, [deliberationId]);

const { data: lm } = useLegalMoves(targetText);
useEffect(() => {
  if (!workTitle && !workBody) return;
  const t = setTimeout(() => {
    if (
      !savedWorkId &&
      (workTitle.trim().length || workBody.trim().length)
    ) {
      // Fire off a draft save
      fetch("/api/theoryworks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          title: workTitle.trim() || "(untitled)",
          body: workBody.trim(),
          draft: true,
          ...(framing?.theoryType ? { theoryType: framing.theoryType } : {}),
        }),
      }).catch(() => {}); // ignore failures
    }
  }, 1500);
  return () => clearTimeout(t);
}, [workTitle, workBody, savedWorkId, deliberationId, framing]);


async function saveWork() {
  if (!workTitle.trim() || !workBody.trim()) {
    alert("Please provide a work title and body.");
    return;
  }

  const payload = {
    deliberationId,
    title: workTitle.trim(),
    body: workBody.trim(),
    ...(framing?.theoryType ? { theoryType: framing.theoryType } : {}),
    standardOutput: framing?.standardOutput ?? null,
  };

  try {
    const res = await fetch("/api/theoryworks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}
    if (!res.ok) {
      const msg = json?.error || json?.message || text || `HTTP ${res.status}`;
      alert(`Save failed: ${msg}`);
      return;
    }
    const { ok, work } = json;
    if (ok && work?.id) {
      setSavedWorkId(work.id);
      setTimeout(
        () =>
          framingRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50
      );
    }
    alert("Work saved.");
  } catch (err: any) {
    console.error(err);
    alert(`Save failed: ${err?.message ?? "Unknown error"}`);
  }
}
return (
  <div className="group relative rounded-2xl panel-edge bg-indigo-50/70  p-4 backdrop-blur space-y-3" id={key}>
    {/* slim top shine */}
    <div className="pointer-events-none absolute inset-x-2 top-1 h-px bg-gradient-to-b from-white/70 to-transparent" />

    {/* Header */}
    <div className="flex items-center justify-between">
      <div className="text-md font-semibold  text-slate-700">Compose</div>
      <div className="text-[11px] text-neutral-500">
        {pending ? "Posting…" : "⌘/Ctrl + Enter to post"}
      </div>
    </div>
       {showReplyContext && (
 <div
      {...rest}
      className={[
        "group relative rounded-2xl panel-edge bg-indigo-50/70 p-4 backdrop-blur space-y-3",
        "scroll-mt-24", // plays nice with sticky headers
        className || ""
      ].join(" ")}
    >
    {/* Replying-to context */}

        <div className="rounded-md border-none bg-transparent p-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Replying to
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btnv2--ghost btnv2--sm"
                onClick={() => insertAtCursor(targetText ? `> ${targetText}\n\n` : '> (quote)\n\n')}
              >
                Quote
              </button>
              <button
                className="btnv2--ghost btnv2--sm"
                onClick={() => onClearReply?.()}
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="line-clamp-2 text-[13px] text-slate-700">
            {targetText || '…'}
          </div>
        </div>

    </div>
          )}
    {/* Textarea + char counter */}
    <div className="space-y-2 ">
      <textarea
      id="delib-composer-anchor"
        ref={textareaRef}
        className="w-full resize-none rounded-lg articlesearchfield px-3 py-2 mt-4 bg-white text-sm "
        rows={4}
        placeholder="Respond here…"
        value={text}
        onFocus={() => setIsFocused(true)}
onBlur={() => setIsFocused(false)}
        onChange={(e) => setText(e.target.value)}
      />
      {(() => {
        const max = 5000;
        const used = text.length;
        const pct = Math.min(1, used / max);
        return (
          <>
            <div className="h-1.5 overflow-hidden rounded bg-slate-200/70">
              <div
                className="h-full rounded bg-[linear-gradient(90deg,theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.sky.400))]"
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            <div className="text-[11px] text-neutral-500 tabular-nums">
              {used}/{max}
            </div>
          </>
        );
      })()}
      <MissingAxiomBar insert={insertAtCursor} />

      <EnthymemeNudge
      deliberationId={deliberationId}
      insert={insertAtCursor}
        targetType="argument"
        targetId={targetArgumentId}
        draft={text}
        onPosted={() => {}}
      />
    </div>

    {/* Controls rail */}
    <div className="flex flex-wrap items-center gap-3">
      {/* Sources */}
      <div className="flex items-center gap-2">
        <input
          type="url"
          placeholder="Paste source URL"
          className="w-56 rounded articlesearchfield border-slate-200 px-2 py-1 text-xs"
          value={sourceInput}
          onChange={(e) => setSourceInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && sourceInput.trim()) {
              addSource(sourceInput.trim());
              setSourceInput("");
            }
          }}
        />
        <button
          className="btnv2--ghost btnv2--sm bg-white"
          onClick={() => {
            if (!sourceInput.trim()) return;
            addSource(sourceInput.trim());
            setSourceInput("");
          }}
        >
          Add
        </button>
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {sources.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/70 px-1.5 py-0.5 text-[10px]"
            >
              <a href={s} target="_blank" className="underline">
                {new URL(s).host}
              </a>
              <button
                className="text-neutral-500 hover:text-rose-600"
                title="Remove"
                onClick={() => removeSource(s)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Quantifier */}
      <div className="flex items-center gap-2">
        <span className="text-[11px]  text-neutral-600">Quantifier</span>
        <Segmented
          ariaLabel="Quantifier"
          
          value={quantifier ?? null}
          onChange={(v) => setQuantifier(v)}
          options={[
            { value: "SOME", label: "Some" },
            { value: "MANY", label: "Many" },
            { value: "MOST", label: "Most" },
            { value: "ALL", label: "All" },
          ]}
        />
      </div>

      {/* Modality */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-600">Modality</span>
        <Segmented
          ariaLabel="Modality"
          value={modality ?? null}
          onChange={(v) => setModality(v)}
          options={[
            { value: "COULD", label: "Could" },
            { value: "LIKELY", label: "Likely" },
            { value: "NECESSARY", label: "Necessary" },
          ]}
        />
      </div>

      {/* Confidence */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] text-neutral-600">Confidence</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.25}
          value={confidence ?? 0.5}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="h-2 w-36 cursor-pointer accent-indigo-500"
          title={`${Math.round((confidence ?? 0.5) * 100)}%`}
        />
        <span className="text-[11px] tabular-nums text-neutral-700">
          {Math.round((confidence ?? 0.5) * 100)}%
        </span>
      </div>
    </div>

    {/* Theory Builder toggle */}
    <div className="flex items-center gap-3">
      <span className="text-sm text-neutral-700">Theory Builder</span>
      <button
        type="button"
        className="btnv2--ghost btnv2--sm bg-white"
        onClick={() => setShowWorkFields((v) => !v)}
      >
        {showWorkFields ? "Hide" : "Expand"}
      </button>
    </div>

    {showWorkFields && (
      <div className="rounded-xl border border-slate-200 bg-white/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
    <div>
      <div className="text-sm font-semibold">Theory Builder</div>
      <div className="text-[11px] text-neutral-600">
        Pick a theory type, then give it a name and a short rationale.
      </div>
    </div>
    {savedWorkId && (
      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
        Draft saved
      </span>
    )}
  </div>

        <div ref={framingRef}>
          <TheoryFraming
            key={savedWorkId ?? "no-work"}
            value={framing}
            onChange={setFraming}
            workId={savedWorkId ?? undefined}
            canEditPractical={true}
            defaultOpenBuilder={!!savedWorkId}
            className="mb-2"
          />
        </div>

        {(framing.theoryType === 'IH' || framing.theoryType === 'TC') && (
    <div className="text-[11px] text-neutral-500 -mt-2">
      Your “Standard Output” tells us what success looks like.
    </div>
  )}


        <label className="block text-xs text-neutral-600">Title</label>
        <input
          id="work-title-input"
          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          placeholder="Ex: Protocol_A v2"
          value={workTitle}
          onChange={(e) => setWorkTitle(e.target.value)}
          maxLength={140}
        />
  <div className="text-[10px] text-neutral-500">{workTitle.length}/140</div>

        <label className="block text-xs text-neutral-600">Body</label>
        <textarea
    className="min-h-[120px] w-full rounded border px-2 py-1 text-sm"
    placeholder="Context & intuition (why this matters; 3–5 sentences)... Tip: cite claims with [[claim:123]]"
    value={workBody}
    onChange={(e) => setWorkBody(e.target.value)}
  />

        <button
          className="btnv2"
          onClick={saveWork} // extract your existing POST into a saveWork fn

          
        >
                {savedWorkId ? 'Save changes' : 'Save & Open Full Builder'}

                </button>
    {/* <span className="text-[11px] text-neutral-500">
      Fields autosave every few seconds.
    </span> */}
  </div>

    )}

    {/* Counter toolbar (reply only) */}
    {targetArgumentId && !showYesBut && (
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-neutral-600">Counter type</span>
        <Segmented
          ariaLabel="Counter type"
          value={
            (counterKind === "rebut_conclusion" && "rebut_conclusion") ||
            (counterKind === "rebut_premise" && "rebut_premise") ||
            (counterKind === "undercut_inference" && "undercut_inference") ||
            "none"
          }
          onChange={(v) =>
            setCounterKind(
              v as "none" | "rebut_conclusion" | "rebut_premise" | "undercut_inference"
            )
          }
          options={[
            { value: "none" as const, label: "None" },
            { value: "rebut_conclusion" as const, label: "Rebut (conclusion)" },
            { value: "rebut_premise" as const, label: "Rebut (premise)" },
            { value: "undercut_inference" as const, label: "Undercut (inference)" },
          ]}
        />
        <button
          className="btnv2--ghost btnv2--sm"
          onClick={() => {
            setShowYesBut(true);
            setCounterKind("none");
          }}
          title='Posts two linked items: Concession + Counter (concede + rebut)'
        >
         Counterargument
        </button>
      </div>
    )}

    {/* Legal moves */}
    {targetArgumentId && lm?.ok && lm.options?.length ? (
      <div className="flex flex-wrap gap-2">
        {lm.options.map((o: any) => (
          <button
            key={o.key}
            className="btnv2--ghost btnv2--sm"
            onClick={() => {
              const tmpl = o.template ?? mapKeyToTemplate(o.key);
              insertAtCursor((text ? "\n\n" : "") + tmpl);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    ) : null}

    {/* Yes, … but … */}
    {showYesBut && (
      <div className="space-y-2 rounded border border-amber-200 bg-amber-50/40 p-3">
        <div className="text-xs font-medium">Contingent Agreement</div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[11px] text-neutral-600">Concession</label>
            <textarea
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              placeholder="Acknowledge the strongest part of the target…"
              value={concession}
              onChange={(e) => setConcession(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[11px] text-neutral-600">Counter</label>
            <textarea
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              placeholder="Present your counterpoint…"
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btnv2"
            onClick={submitYesBut}
            disabled={
              pending ||
              !(concession.trim() || counter.trim()) ||
              !targetArgumentId
            }
          >
            {pending ? "Posting…" : "Post both"}
          </button>
          <button
            className="btnv2--ghost btnv2--sm"
            onClick={() => {
              setShowYesBut(false);
              setConcession("");
              setCounter("");
            }}
            disabled={pending}
          >
            Cancel
          </button>
        </div>

        <div className="text-[11px] text-neutral-500">
          This posts two linked arguments: a concession (<code>concede</code>) and a
          counter (<code>rebut</code> to the conclusion).
        </div>
      </div>
    )}

    {/* Image argument */}
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          type="url"
          placeholder="Paste image URL (optional)"
          className="w-full rounded articlesearchfield px-2 py-2 text-xs"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        {imageUrl && (
          <button className="btnv2--ghost btnv2--sm" onClick={() => setImageUrl("")}>
            Clear
          </button>
        )}
      </div>
      {imageUrl && (
        <div className="rounded border border-slate-200 bg-white/80 p-2">
          <img
            src={imageUrl}
            alt="preview"
            className="mx-auto max-h-40 object-contain"
          />
        </div>
      )}
    </div>

    {/* {targetArgumentId && (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-700">This is a reply</span>
        <Segmented
          ariaLabel="Reply edge"
          value={edgeType ?? null}
          onChange={(v) => setEdgeType(v)}
          options={[
            { value: "support" as const, label: "Support" },
            { value: "rebut" as const, label: "Rebut" },
            { value: "undercut" as const, label: "Undercut" },
          ]}
        />
        <span className="text-[11px] text-neutral-500">
          “Undercut” challenges the link, not the claim.
        </span>
      </div>
    )} */}

    {/* Post */}
    <div className="flex justify-start">
      <button
        disabled={pending || !text.trim()}
        onClick={post}
        className="btnv2 px-5 py-2 text-xs tracking-wide"
      >
        {pending ? "Posting…" : "Post"}
      </button>
    </div>
  </div>
);
        }