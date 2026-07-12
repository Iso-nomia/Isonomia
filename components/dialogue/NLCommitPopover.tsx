// components/dialogue/NLCommitPopover.tsx
"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { normalizeNL } from "@/lib/nl";
import { InlineEvidencePicker } from "@/components/dialogue/InlineEvidencePicker";

export function NLCommitPopover({
  open,
  onOpenChange,
  deliberationId,
  targetType,
  targetId,
  locusPath,
  defaultOwner = "Proponent",
  defaultPolarity = "pos",
  defaultText = "",
  cqKey = "default",
  onDone,
  requiresEvidence = false,
  burdenHint = null,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  deliberationId: string;
  targetType: "argument" | "claim" | "card";
  targetId: string;
  locusPath: string;
  defaultOwner?: "Proponent" | "Opponent";
  defaultPolarity?: "pos" | "neg";
  defaultText?: string;
  cqKey?: string;
  onDone?: () => void;
  /** Phase 3d: when true, mount InlineEvidencePicker and gate submit. */
  requiresEvidence?: boolean;
  /** Phase 3d: optional burden-of-proof hint shown above the picker. */
  burdenHint?: string | null;
}) {
  const [text, setText] = React.useState(defaultText);
  const [owner, setOwner] = React.useState<"Proponent" | "Opponent">(defaultOwner);
  const [polarity, setPolarity] = React.useState<"pos" | "neg">(defaultPolarity);
  const [evidenceRefs, setEvidenceRefs] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    kind: "fact" | "rule";
    canonical: string;
    tips?: string[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) {
      setText(defaultText);
      setError(null);
      setPreview(null);
      setEvidenceRefs([]);
    } else {
      // Ensure focus when opened, with a small delay to let the portal render
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [open, defaultText]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!text.trim()) {
        setPreview(null);
        setError(null);
        return;
      }
      try {
        const res = await normalizeNL(text);
        if (!alive) return;
        if (!res.ok) {
          setPreview(null);
          setError('Could not parse. Try "fact" or "A & B -> C" for rules.');
          return;
        }
        if (res.kind === "fact") {
          setPreview({
            kind: "fact",
            canonical: res.canonical,
            tips: res.suggestions,
          });
        } else {
          setPreview({ kind: "rule", canonical: res.canonical });
        }
        setError(null);
      } catch (err) {
        if (!alive) return;
        console.error("[NLCommitPopover] Normalization error:", err);
        setError("Failed to normalize input");
        setPreview(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [text]);

  const submit = async () => {
    const canonical = preview?.canonical || text.trim();
    if (!canonical) {
      setError("Please enter a fact or rule");
      return;
    }

    if (requiresEvidence && evidenceRefs.length === 0) {
      setError("This critical question requires at least one evidence reference (URL or DOI).");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const r = await fetch("/api/dialogue/answer-and-commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliberationId,
          targetType,
          targetId,
          cqKey,
          locusPath,
          expression: canonical,
          original: text,
          commitOwner: owner,
          commitPolarity: polarity,
          evidenceRefs: evidenceRefs.length > 0 ? evidenceRefs : undefined,
        }),
      });

      const result = await r.json();

      if (!r.ok || !result.ok) {
        throw new Error(result.error || `HTTP ${r.status}`);
      }

      window.dispatchEvent(
        new CustomEvent("dialogue:moves:refresh", {
          detail: { deliberationId, moveId: result.move?.id, kind: "GROUNDS" },
        })
      );
      window.dispatchEvent(
        new CustomEvent("dialogue:cs:refresh", {
          detail: { dialogueId: deliberationId, ownerId: owner },
        } as any)
      );

      onDone?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[NLCommitPopover] Submit error:", e);
      setError(e.message || "Failed to post. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  // Ensure we're in the browser before using portal
  if (typeof window === "undefined") return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex place-items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onOpenChange(false);
      }}
    >
      <div className="w-[480px] rounded-xl border border-slate-200 bg-white p-4 shadow-xl mx-auto">
        <div className="text-base font-semibold mb-3 text-slate-900">
          Answer & Commit
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 mb-1 block">
              Fact or Rule
            </label>
            <textarea
              ref={textareaRef}
              className="w-full h-24 border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              placeholder='Type a fact like "Congestion downtown is high" or a rule like "congestion_high & revenue_earmarked_transit -> net_public_benefit"'
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={busy}
              autoFocus
            />
          </div>

          {preview ? (
            <div className="text-xs rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="font-semibold text-emerald-800">
                  Will save:
                </span>
                <code className="flex-1 text-emerald-900 font-mono">
                  {preview.canonical}
                </code>
                <span className="text-emerald-600 opacity-75">
                  ({preview.kind})
                </span>
              </div>
              {preview.tips?.length ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-emerald-700 opacity-75">
                    Suggestions:
                  </span>
                  {preview.tips.slice(0, 3).map((t, i) => (
                    <button
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded border border-emerald-300 hover:bg-emerald-100 transition-colors"
                      onClick={() => setText(t)}
                      disabled={busy}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-slate-500 px-1">
              Enter a fact or rule. Examples:{" "}
              <code className="bg-slate-100 px-1 rounded">congestion_high</code>{" "}
              ·{" "}
              <code className="bg-slate-100 px-1 rounded">
                A &amp; B -&gt; C
              </code>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="font-medium">Owner:</span>
              <select
                className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={owner}
                onChange={(e) => setOwner(e.target.value as any)}
                disabled={busy}
              >
                <option>Proponent</option>
                <option>Opponent</option>
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="font-medium">Type:</span>
              <select
                className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={polarity}
                onChange={(e) => setPolarity(e.target.value as any)}
                disabled={busy}
              >
                <option value="pos">Fact</option>
                <option value="neg">Rule</option>
              </select>
            </label>
            <span className="ml-auto text-[11px] text-slate-500">
              @ {locusPath}
            </span>
          </div>

          {requiresEvidence && (
            <InlineEvidencePicker
              value={evidenceRefs}
              onChange={setEvidenceRefs}
              required
              helperText={burdenHint ?? "This CQ requires evidence references to be attached when answering."}
            />
          )}

          {error ? (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="text-[11px] text-slate-500">
              Press ⌘+Enter to submit
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={submit}
                disabled={busy || !text.trim() || (requiresEvidence && evidenceRefs.length === 0)}
                title={requiresEvidence && evidenceRefs.length === 0 ? "Attach at least one evidence reference" : undefined}
              >
                {busy ? "Posting…" : "Post & Commit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render using portal to escape the modal's stacking context
  return createPortal(modalContent, document.body);
}
