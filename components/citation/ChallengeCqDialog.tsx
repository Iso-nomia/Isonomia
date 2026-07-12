"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, X, Loader2, Plus } from "lucide-react";

/**
 * Attack-type catalogue with §10.3 plain-language labels. The `kind` is the
 * REQUIRED `attackType` posted to `/api/cqs/challenge` (never inferred).
 */
const ATTACK_TYPES: {
  kind: "REBUT" | "UNDERMINE" | "UNDERCUT";
  label: string;
  hint: string;
}[] = [
  {
    kind: "REBUT",
    label: "This CQ isn't actually satisfied",
    hint: "Contest the answer's conclusion directly.",
  },
  {
    kind: "UNDERMINE",
    label: "The evidence cited doesn't hold",
    hint: "Attack a premise / cited source — evidence required.",
  },
  {
    kind: "UNDERCUT",
    label: "Valid point, but it doesn't address this question",
    hint: "Concede the answer but deny it resolves the CQ.",
  },
];

/** Error-code → field-level UI copy map (Dev Spec §12.3; reuses §11.2 codes). */
type ChallengeErrorCode =
  | "CQ_CHALLENGE_NEEDS_EVIDENCE"
  | "CQ_DUPLICATE_CHALLENGE"
  | "CQ_NOT_ANSWERED"
  | "CQ_EVIDENCE_NOT_FOUND"
  | "ARGUMENT_NOT_FOUND"
  | "SCHEME_AMBIGUOUS"
  | "AUTH"
  | "GENERIC";

export type ChallengeCqDialogProps = {
  argumentId: string;
  cqKey: string;
  schemeKey: string | null;
  cqRequiresEvidence: boolean;
  cqBurden: "PROPONENT" | "CHALLENGER" | "OPPONENT";
  answerSelfCanonical: boolean;
  onClose: () => void;
  /** Called once the challenge is accepted (201) so the card can flip to DISPUTED. */
  onFiled: () => void;
};

export default function ChallengeCqDialog({
  argumentId,
  cqKey,
  schemeKey,
  cqRequiresEvidence,
  cqBurden,
  answerSelfCanonical,
  onClose,
  onFiled,
}: ChallengeCqDialogProps) {
  const [attackType, setAttackType] =
    useState<"REBUT" | "UNDERMINE" | "UNDERCUT">("REBUT");
  const [groundsText, setGroundsText] = useState("");
  const [evidenceClaimIds, setEvidenceClaimIds] = useState<string[]>([]);
  const [claimDraft, setClaimDraft] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [urlDraft, setUrlDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<ChallengeErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [badClaimId, setBadClaimId] = useState<string | null>(null);

  // `requestId` is minted once per dialog open — idempotency across double
  // submits (Dev Spec §11.2 step 6 / §12.3).
  const requestId = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    [],
  );

  // Client-side admissibility mirror (UX only; server is authoritative §12.3).
  const evidenceRequired =
    attackType === "UNDERMINE" ||
    (cqRequiresEvidence && cqBurden !== "PROPONENT");
  const hasEvidence = evidenceClaimIds.length > 0 || sourceUrls.length > 0;
  const groundsLen = groundsText.trim().length;
  const groundsValid = groundsLen >= 10 && groundsLen <= 5000;
  const canSubmit =
    !submitting && groundsValid && (!evidenceRequired || hasEvidence);

  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  function addClaimId() {
    const v = claimDraft.trim();
    if (!v || evidenceClaimIds.includes(v)) {
      setClaimDraft("");
      return;
    }
    setEvidenceClaimIds((prev) => [...prev, v]);
    setClaimDraft("");
    if (badClaimId) setBadClaimId(null);
  }

  function addUrl() {
    const v = urlDraft.trim();
    if (!v || sourceUrls.includes(v)) {
      setUrlDraft("");
      return;
    }
    setSourceUrls((prev) => [...prev, v]);
    setUrlDraft("");
  }

  function mapError(
    code: string | undefined,
    fallback: string,
  ): { code: ChallengeErrorCode; message: string } {
    switch (code) {
      case "CQ_CHALLENGE_NEEDS_EVIDENCE":
        return {
          code: "CQ_CHALLENGE_NEEDS_EVIDENCE",
          message:
            "This challenge needs evidence — cite at least one claim or source URL.",
        };
      case "CQ_DUPLICATE_CHALLENGE":
        return {
          code: "CQ_DUPLICATE_CHALLENGE",
          message: "You already have an open challenge on this answer.",
        };
      case "CQ_NOT_ANSWERED":
        return {
          code: "CQ_NOT_ANSWERED",
          message:
            "This answer is no longer in a challengeable state — refreshing…",
        };
      case "CQ_EVIDENCE_NOT_FOUND":
        return {
          code: "CQ_EVIDENCE_NOT_FOUND",
          message: "One of the cited claim IDs could not be found.",
        };
      default:
        return { code: "GENERIC", message: fallback };
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorCode(null);
    setErrorMessage(null);
    setBadClaimId(null);
    try {
      const res = await fetch("/api/cqs/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          argumentId,
          cqKey,
          ...(schemeKey ? { schemeKey } : {}),
          attackType,
          groundsText: groundsText.trim(),
          evidenceClaimIds,
          sourceUrls,
          requestId,
        }),
      });

      if (res.ok) {
        onFiled();
        onClose();
        return;
      }

      if (res.status === 401) {
        setErrorCode("AUTH");
        setErrorMessage("Your session has expired — please sign in again.");
        return;
      }

      let payload: { code?: string; error?: string } = {};
      try {
        payload = await res.json();
      } catch {
        /* non-JSON error body */
      }
      const mapped = mapError(payload.code, payload.error ?? "Challenge failed.");
      setErrorCode(mapped.code);
      setErrorMessage(mapped.message);

      // CQ_NOT_ANSWERED means server state drifted — refresh to reconcile.
      if (mapped.code === "CQ_NOT_ANSWERED") {
        setTimeout(() => {
          if (typeof window !== "undefined") window.location.reload();
        }, 1500);
      }
    } catch {
      setErrorCode("GENERIC");
      setErrorMessage("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Challenge this answer"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">
              Challenge this answer
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {answerSelfCanonical && (
            <p className="text-xs text-amber-700/90 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2 leading-relaxed">
              This answer was self-asserted by an AI and has not yet been
              independently contested — your challenge is especially valuable.
            </p>
          )}

          {/* Attack type */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[11px] font-bold tracking-[0.08em] uppercase text-slate-500 mb-1">
              What kind of challenge?
            </legend>
            {ATTACK_TYPES.map((opt) => {
              const selected = attackType === opt.kind;
              return (
                <label
                  key={opt.kind}
                  className={
                    "flex items-start gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors " +
                    (selected
                      ? "border-amber-300 bg-amber-50/60"
                      : "border-slate-200 hover:border-slate-300")
                  }
                >
                  <input
                    type="radio"
                    name="attackType"
                    value={opt.kind}
                    checked={selected}
                    onChange={() => setAttackType(opt.kind)}
                    className="mt-0.5 accent-amber-600"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">
                      {opt.label}
                    </span>
                    <span className="text-xs text-slate-500">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {/* Grounds */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cq-grounds"
              className="text-[11px] font-bold tracking-[0.08em] uppercase text-slate-500"
            >
              Your grounds
            </label>
            <textarea
              id="cq-grounds"
              value={groundsText}
              onChange={(e) => setGroundsText(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="Explain why this answer should be re-examined…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300/60 resize-y"
            />
            <div className="flex justify-between text-[11px]">
              <span
                className={
                  groundsLen > 0 && groundsLen < 10
                    ? "text-rose-500"
                    : "text-slate-400"
                }
              >
                {groundsLen < 10
                  ? `At least ${10 - groundsLen} more character(s)`
                  : "\u00a0"}
              </span>
              <span className="text-slate-400 tabular-nums">
                {groundsLen}/5000
              </span>
            </div>
          </div>

          {/* Evidence */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-slate-500">
                Evidence{" "}
                {evidenceRequired ? (
                  <span className="text-amber-600">(required)</span>
                ) : (
                  <span className="text-slate-400 font-normal normal-case tracking-normal">
                    (optional)
                  </span>
                )}
              </span>
            </div>

            {evidenceRequired && !hasEvidence && (
              <p
                className={
                  "text-xs rounded-lg px-3 py-2 leading-relaxed " +
                  (errorCode === "CQ_CHALLENGE_NEEDS_EVIDENCE"
                    ? "text-rose-700 bg-rose-50 border border-rose-200"
                    : "text-amber-700 bg-amber-50 border border-amber-200/70")
                }
              >
                {attackType === "UNDERMINE"
                  ? "Undermining the cited evidence requires you to cite at least one claim or source."
                  : "This critical question's burden requires evidence to challenge it."}
              </p>
            )}
            {errorCode === "CQ_CHALLENGE_NEEDS_EVIDENCE" && hasEvidence && errorMessage && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 leading-relaxed">
                {errorMessage}
              </p>
            )}

            {/* Claim ID chips */}
            <div className="flex flex-wrap gap-1.5">
              {evidenceClaimIds.map((id) => (
                <span
                  key={id}
                  className={
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono " +
                    (badClaimId === id
                      ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300"
                      : "bg-slate-100 text-slate-700")
                  }
                >
                  {id}
                  <button
                    type="button"
                    onClick={() =>
                      setEvidenceClaimIds((prev) => prev.filter((x) => x !== id))
                    }
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={`Remove claim ${id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            {badClaimId && (
              <p className="text-xs text-rose-600">
                Claim <span className="font-mono">{badClaimId}</span> could not
                be found — remove or correct it.
              </p>
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={claimDraft}
                onChange={(e) => setClaimDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addClaimId();
                  }
                }}
                placeholder="Claim ID…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              />
              <button
                type="button"
                onClick={addClaimId}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {/* Source URLs */}
            <div className="flex flex-col gap-1">
              {sourceUrls.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-600 font-mono break-all"
                >
                  {url}
                  <button
                    type="button"
                    onClick={() =>
                      setSourceUrls((prev) => prev.filter((x) => x !== url))
                    }
                    className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                    aria-label={`Remove source ${url}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUrl();
                  }
                }}
                placeholder="https://source-url…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              />
              <button
                type="button"
                onClick={addUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>

          {/* Top-level error banners */}
          {errorMessage &&
            errorCode !== "CQ_CHALLENGE_NEEDS_EVIDENCE" &&
            errorCode !== "CQ_EVIDENCE_NOT_FOUND" && (
              <p
                className={
                  "text-xs rounded-lg px-3 py-2 leading-relaxed border " +
                  (errorCode === "CQ_DUPLICATE_CHALLENGE"
                    ? "text-amber-700 bg-amber-50 border-amber-200/70"
                    : "text-rose-700 bg-rose-50 border-rose-200")
                }
                role="alert"
              >
                {errorMessage}
              </p>
            )}
          {errorCode === "CQ_EVIDENCE_NOT_FOUND" && errorMessage && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            File challenge
          </button>
        </div>
      </div>
    </div>
  );
}
