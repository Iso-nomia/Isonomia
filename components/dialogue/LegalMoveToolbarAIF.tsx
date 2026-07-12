//components/dialogue/LegalMoveToolbarAIF.tsx
"use client";
import * as React from "react";
import useSWR from "swr";
import { NLCommitPopover } from "@/components/dialogue/NLCommitPopover";

type Force = "ATTACK" | "SURRENDER" | "NEUTRAL";
type MoveKind = "ASSERT" | "WHY" | "GROUNDS" | "RETRACT" | "CONCEDE" | "CLOSE";
export type Move = {
  kind: MoveKind;
  label: string;
  payload?: any;
  disabled?: boolean;
  reason?: string;
  force?: Force;
  relevance?: "likely" | "unlikely" | null;
  postAs?: { targetType: "argument" | "claim" | "card"; targetId: string };
};

const fetcher = (u: string) => fetch(u, { cache: "no-store" }).then(r => r.json());

export function LegalMoveToolbarAIF({
  deliberationId,
  targetType,
  targetId,
  locusPath = "0",
  commitOwner = "Proponent",
  onPosted,
}: {
  deliberationId: string;
  targetType: "argument" | "claim" | "card";
  targetId: string;
  locusPath?: string;
  commitOwner?: "Proponent" | "Opponent";
  onPosted?: () => void;
}) {
  const qs = new URLSearchParams({ deliberationId, targetType, targetId, locusPath }).toString();
  const { data, mutate } = useSWR<{ ok: boolean; moves: Move[] }>(`/api/dialogue/legal-moves?${qs}`, fetcher, { revalidateOnFocus: false });
const argOpenCqsKey = `/api/dialogue/open-cqs?` + 
  new URLSearchParams({ deliberationId, targetType: 'argument', targetId });

const { data: cqs } = useSWR<{ ok:boolean; cqOpen:string[] }>(argOpenCqsKey, fetcher, { revalidateOnFocus:false });

// We synthesize a move only when all WHYs for this argument are satisfied:
const canAccept = cqs?.ok && Array.isArray(cqs.cqOpen) && cqs.cqOpen.length === 0;

// Build the Accept move in the shape your poster expects:
const acceptMove: Move = {
  kind: 'ASSERT',
  label: 'Accept argument',
  payload: { locusPath, as: 'ACCEPT_ARGUMENT' },
  force: 'SURRENDER',
  postAs: { targetType: 'argument', targetId }, // ensure it posts against the argument
};

  const moves = (data?.moves ?? []).filter(Boolean);
  const attacks   = moves.filter(m => m.force === "ATTACK"   && !m.disabled);
  const resolves  = moves.filter(m => m.force === "SURRENDER" && !m.disabled);
  const neutrals  = moves.filter(m => m.force === "NEUTRAL"  && !m.disabled);

  const hasClose  = resolves.some(m => m.kind === "CLOSE");
  const why       = attacks.find(m => m.kind === "WHY");
  const answers   = attacks.filter(m => m.kind === "GROUNDS"); // can be >1 for different CQ keys

  const [intent, setIntent] = React.useState<"challenge"|"resolve"|"more">(
    answers.length ? "challenge" : hasClose ? "resolve" : "challenge"
  );

  const [showAll, setShowAll] = React.useState(false);
  const [openCommit, setOpenCommit] = React.useState<Move | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [inlineWhy, setInlineWhy] = React.useState(false);
  const [whyNote, setWhyNote] = React.useState("");


// NEW: post moves to the AIF dialogue route so L-nodes are persisted consistently
async function postMove(m: Move, extraPayload: any = {}) {
  if (busy || m.disabled) return;
  setBusy(true);
  try {
    const postTargetType = m.postAs?.targetType ?? targetType;
    const postTargetId   = m.postAs?.targetId   ?? targetId;

    // Map Move.kind to AIF+ "type" and pick a light illocution label
    const type = m.kind; // 'WHY' | 'ASSERT' | 'GROUNDS' | ...
    const illocution =
      type === 'WHY'    ? 'Question' :
      type === 'ASSERT' ? 'Statement' :
      type === 'GROUNDS'? 'Argue' : type;

    const body: any = {
      deliberationId,
      targetType: postTargetType,
      targetId: postTargetId,
      type,
      illocution,
      replyToMoveId: (extraPayload?.replyToMoveId ?? m.payload?.replyToMoveId) || null,
      payload: { locusPath, ...(m.payload ?? {}), ...(extraPayload ?? {}) },
    };

    // NOTE: GROUNDS via NLCommitPopover continues to handle its own posting.
    if (type === 'GROUNDS') {
      setOpenCommit(m); // opens your existing NLCommitPopover flow
      return;
    }

    const r = await fetch('/api/dialogue/move-aif', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    onPosted?.();
    mutate();
    window.dispatchEvent(new CustomEvent('dialogue:moves:refresh', { detail: { deliberationId } } as any));
  } finally {
    setBusy(false);
  }
}
  function Pill({ tone, children }:{ tone:"attack"|"resolve"|"more"; children: React.ReactNode }) {
    const base = "px-2 py-1 rounded-full text-[11px] border";
    const cls = tone==="attack"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone==="resolve"
      ? "border-sky-300 bg-sky-50 text-sky-800"
      : "border-slate-200 bg-white/70 text-slate-700";
    return <span className={`${base} ${cls}`}>{children}</span>;
  }

  function Segmented() {
    return (
      <div role="tablist" aria-label="Move intent" className="inline-flex rounded-md border border-slate-200/80 bg-white/70 p-0.5">
        {[
          ["challenge","Challenge"] as const,
          ["resolve","Resolve"] as const,
          ["more","More"] as const,
        ].map(([key, label]) => {
          const active = intent === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => setIntent(key as any)}
              className={`px-2.5 py-1 text-xs rounded ${active ? "bg-slate-100 text-slate-900" : "text-slate-900 hover:bg-slate-200"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // hide illegal by default; showAll exposes disabled with dotted style
  const disabled = (data?.moves ?? []).filter(m => m.disabled);

  return (
    <div className="rounded-md border border-slate-200 bg-white/60 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Segmented />
          <Pill tone="attack">WHY {why ? "available" : "—"}</Pill>
          <Pill tone="resolve">{hasClose ? "Closable (†)" : "Not closable"}</Pill>
        </div>
        {disabled.length > 0 && (
          <button className="text-[11px] underline decoration-dotted" onClick={() => setShowAll(v => !v)}>
            {showAll ? "Hide illegal" : `Show ${disabled.length} illegal`}
          </button>
        )}
      </div>

      {/* CHALLENGE */}
      {intent === "challenge" && (
        <div className="flex flex-wrap gap-2">
          {/* Ask WHY */}
          {why && (
            <div className="flex items-start gap-2">
              {!inlineWhy ? (
                <button
                  className="px-2 py-1 rounded text-xs border border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => setInlineWhy(true)}
                  title={why.reason || "Ask WHY"}
                  disabled={!!why.disabled || busy}
                >
                  {why.label || "Ask WHY"}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    className="text-xs rounded border px-2 py-1 w-56"
                    placeholder="WHY? (brief note)…"
                    value={whyNote}
                    onChange={e => setWhyNote(e.target.value)}
                  />
                  <button
                    className="px-2 py-1 rounded text-xs border border-amber-200 text-amber-700"
                    disabled={!whyNote.trim() || busy}
                    onClick={() => postMove(why, { note: whyNote.trim() }).then(()=>{ setInlineWhy(false); setWhyNote(""); })}
                  >
                    Post WHY
                  </button>
                  <button className="text-[11px]" onClick={() => { setInlineWhy(false); setWhyNote(""); }}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {/* Answer (GROUNDS) – can be multiple CQs */}
          {answers.map((m, i) => (
            <div key={`${m.kind}-${m.label}-${i}`} className="inline-flex items-center gap-1">
              <button
                className="px-2 py-1 rounded text-xs border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setOpenCommit(m)}
                disabled={!!m.disabled || busy}
                title={m.reason || m.label}
              >
                {m.label || "Answer"}
              </button>
              <button
                className="text-[11px] underline decoration-dotted"
                onClick={() => setOpenCommit(m)}
                title="Answer & commit"
              >
                + commit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* RESOLVE */}
      {intent === "resolve" && (
        <div className="flex flex-wrap gap-2">
          {resolves.map((m, i) => (
            <button
              key={`${m.kind}-${i}`} 
              className={[
                "px-2 py-1 rounded text-xs border transition",
                m.kind === "CLOSE" ? "border-indigo-300 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 font-semibold" :
                m.kind === "CONCEDE" ? "border-sky-200 text-sky-800 hover:bg-sky-50" :
                "border-slate-200 text-slate-700 hover:bg-slate-50"
              ].join(" ")}
              disabled={!!m.disabled || busy}
              onClick={() => postMove(m)}
              title={m.reason || m.label}
            >
              {m.label || m.kind}
            </button>
          ))}
           {canAccept && (
      <button
        className="px-2 py-1 rounded text-xs border border-sky-200 text-sky-800 hover:bg-sky-50"
        onClick={() => postMove(acceptMove)}
            title="Accept argument (all CQs satisfied)"

      >
        Accept argument
      </button>
    )}

        </div>
      )}

      {/* MORE */}
      {intent === "more" && (
        <div className="flex flex-wrap gap-2">
          {neutrals.map((m, i) => (
            <button
              key={`${m.kind}-${i}`}
              className="px-2 py-1 rounded text-xs border border-slate-200 text-slate-700 hover:bg-slate-50"
              disabled={!!m.disabled || busy}
              onClick={() => postMove(m)}
              title={m.reason || m.label}
            >
              {m.label || m.kind}
            </button>
          ))}
        </div>
      )}

      {/* Show illegal/disabled on demand */}
      {showAll && (
        <div className="pt-1 border-t border-slate-200/70">
          <div className="text-[11px] text-neutral-500 mb-1">Currently illegal</div>
          <div className="flex flex-wrap gap-2">
            {disabled.map((m, i) => (
              <span key={`${m.kind}-d-${i}`} className="px-2 py-1 rounded text-[11px] border border-slate-200/70 text-neutral-500 opacity-70" title={m.reason || "Illegal in current state"}>
                {m.label || m.kind}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Commit popover for GROUNDS */}
      {openCommit && (
        <NLCommitPopover
          open={!!openCommit}
          onOpenChange={(v) => { if (!v) setOpenCommit(null); }}
          deliberationId={deliberationId}
          targetType={targetType}
          targetId={targetId}
          locusPath={openCommit.payload?.justifiedByLocus ?? locusPath}
          cqKey={openCommit.payload?.cqId ?? openCommit.payload?.schemeKey ?? "default"}
          defaultOwner={commitOwner}
          onDone={() => { setOpenCommit(null); mutate(); onPosted?.(); }}
        />
      )}
    </div>
  );
}
