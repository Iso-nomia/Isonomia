/**
 * Spec 4 §3.4 — Non-redundancy admin panel.
 *
 * Mounted inside `SchemeCreator` beside the Submit button. Behaviour:
 *
 *   1. Admin clicks "Check for behavioural duplicates" — we POST the
 *      current draft to /api/schemes/non-redundancy-check.
 *   2. The endpoint runs the verifier against a clusterTag/CQ-window
 *      filtered candidate set and returns verdicts.
 *   3. We render `equal` / `subset` / `inconclusive` matches inline with
 *      links to the offending scheme. `incomparable` matches are filtered
 *      out server-side.
 *   4. If there are any `equal` or `subset` hits, the admin must type a
 *      `nonRedundancyJustification` to proceed; the parent (SchemeCreator)
 *      consults `hasBlockingHits` to gate the submit button.
 *
 * Posture: additive. Does NOT block the submission itself — the parent
 * decides. Does NOT auto-fire on every keystroke (catalogue-sized N calls
 * are expensive); the check is button-driven.
 */

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, AlertTriangle, Search, ExternalLink } from "lucide-react";

type DraftCq = {
  cqKey: string;
  text: string;
  attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope?: "conclusion" | "inference" | "premise";
  burdenOfProof?: "PROPONENT" | "OPPONENT" | "CHALLENGER";
  requiresEvidence?: boolean;
  premiseType?: "ORDINARY" | "ASSUMPTION" | "EXCEPTION" | null;
};

export type NonRedundancyDraft = {
  id?: string | null;
  key?: string;
  name?: string;
  clusterTag?: string | null;
  epistemicMode?: string;
  premises?: unknown;
  conclusion?: unknown;
  cqs: DraftCq[];
};

type Verdict =
  | { kind: "equal"; certificate: any }
  | { kind: "subset"; certificate: { direction: string; extraCqs: string[] } }
  | { kind: "incomparable"; certificate: any }
  | { kind: "inconclusive"; reason: string };

type CheckResult = {
  fingerprint: string;
  candidatesScanned: number;
  catalogueSize: number;
  candidates: Array<{
    schemeId: string;
    schemeKey: string;
    schemeName: string | null;
    sameFingerprint: boolean;
    verdict: Verdict;
  }>;
};

type Props = {
  draft: NonRedundancyDraft;
  justification: string;
  onJustificationChange: (next: string) => void;
  /** Called after each check so the parent can mirror `hasBlockingHits`
   *  into its submit-disabled state. */
  onResultChange?: (result: CheckResult | null) => void;
};

function verdictBadgeClasses(kind: Verdict["kind"]): string {
  switch (kind) {
    case "equal":
      return "bg-rose-100 text-rose-900 border-rose-300";
    case "subset":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "inconclusive":
      return "bg-slate-100 text-slate-700 border-slate-300";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function verdictLabel(v: Verdict): string {
  switch (v.kind) {
    case "equal":
      return "behaviourally equal";
    case "subset":
      return v.certificate?.direction === "left-subset-right"
        ? "draft is a subset of"
        : "draft is a superset of";
    case "inconclusive":
      return `inconclusive (${v.reason})`;
    default:
      return v.kind;
  }
}

export default function SchemeNonRedundancyPanel({
  draft,
  justification,
  onJustificationChange,
  onResultChange,
}: Props) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<CheckResult | null>(null);

  const blockingHits = React.useMemo(
    () =>
      (result?.candidates ?? []).filter(
        (c) => c.verdict.kind === "equal" || c.verdict.kind === "subset",
      ),
    [result],
  );
  const hasBlockingHits = blockingHits.length > 0;

  const runCheck = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/schemes/non-redundancy-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id ?? undefined,
          key: draft.key,
          name: draft.name,
          clusterTag: draft.clusterTag ?? null,
          epistemicMode: draft.epistemicMode,
          premises: draft.premises,
          conclusion: draft.conclusion,
          cqs: draft.cqs,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `check failed (${res.status})`);
      }
      const data: CheckResult = await res.json();
      setResult(data);
      onResultChange?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setResult(null);
      onResultChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [draft, onResultChange]);

  const canCheck = (draft.cqs?.length ?? 0) >= 1;

  return (
    <div
      className="rounded-md border border-slate-900/10 bg-white/40 px-3 py-2 text-sm space-y-2"
      data-testid="non-redundancy-panel"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-700" />
        <span className="font-medium text-slate-900">
          Behavioural-redundancy check
        </span>
        <span className="text-xs text-slate-500">
          (Spec 4 phase 4b — runs `verifyBehaviourEquality` against catalogue
          siblings)
        </span>
        <div className="ml-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || !canCheck}
            onClick={runCheck}
            data-testid="non-redundancy-check-btn"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                Checking…
              </>
            ) : (
              <>Check for duplicates</>
            )}
          </Button>
        </div>
      </div>

      {!canCheck && (
        <p className="text-xs text-slate-500">
          Add at least one critical question before running the check.
        </p>
      )}

      {error && (
        <p className="text-xs text-rose-700 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {result && !error && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">
            Scanned <strong>{result.candidatesScanned}</strong> of{" "}
            <strong>{result.catalogueSize}</strong> catalogue rows.
            Fingerprint: <code className="text-[10px]">{result.fingerprint.slice(0, 12)}…</code>
          </p>

          {result.candidates.length === 0 && (
            <p
              className="text-xs text-emerald-800 flex items-center gap-1"
              data-testid="non-redundancy-clear"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              No behaviourally-related schemes detected.
            </p>
          )}

          {result.candidates.length > 0 && (
            <ul className="space-y-1.5" data-testid="non-redundancy-hits">
              {result.candidates.map((c) => (
                <li
                  key={c.schemeId}
                  className={`flex items-center gap-2 rounded border px-2 py-1 ${verdictBadgeClasses(c.verdict.kind)}`}
                >
                  <span className="text-xs uppercase tracking-wide font-semibold">
                    {c.verdict.kind}
                  </span>
                  <span className="text-xs">
                    {verdictLabel(c.verdict)}{" "}
                    <strong>{c.schemeKey}</strong>
                    {c.schemeName ? ` (${c.schemeName})` : ""}
                    {c.sameFingerprint ? " · same fingerprint" : ""}
                  </span>
                  <a
                    href={`/admin/schemes/${c.schemeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs underline inline-flex items-center gap-0.5"
                  >
                    open <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}

          {hasBlockingHits && (
            <div className="space-y-1 pt-1">
              <Label htmlFor="non-redundancy-justification" className="text-xs">
                Justification (required when an `equal` / `subset` hit exists)
              </Label>
              <Textarea
                id="non-redundancy-justification"
                rows={2}
                placeholder="Explain why this scheme is materially distinct from the flagged candidate(s) — recorded on the row's audit trail."
                value={justification}
                onChange={(e) => onJustificationChange(e.target.value)}
                data-testid="non-redundancy-justification"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
