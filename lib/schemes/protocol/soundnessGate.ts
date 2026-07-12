// lib/schemes/protocol/soundnessGate.ts
//
// Phase 4 / Spec 3 §3.3 — instance-close soundness gate.
//
// Pure decision: given a scheme + its CQ bundle + the live protocol
// state, return ok-or-reason. No DB writes. Caller decides whether a
// non-ok verdict is logged (phase 3a) or thrown (phase 3b); the
// feature flag in `lib/schemes/protocol/soundnessMode.ts` controls
// the gate-mode at runtime.
//
// Decision rule (verbatim from Spec 3 §3.3):
//   ok iff every CQ in the scheme's bundle is in a closing status
//   (discharged | waived | failed-with-proponent-rebuttal) AND
//   per-clause invariants hold.
//
// Per-clause invariants (also §3.3):
//   - requiresEvidence: discharging move cited >= 1 evidence ref
//   - burdenOfProof = OPPONENT: closingMove author role matches
//     burden (mechanically: we treat the obligation row's
//     status==='discharged' as proponent-by-default; if burden is
//     OPPONENT, the gate flags it for review)
//   - premiseType = "exception": Carneades default is false ->
//     status must be 'failed' (not established) OR 'discharged'
//     (established + rebutted)
//   - premiseType = "assumption": Carneades default is true ->
//     'not-offered' auto-transitions to 'waived' at gate-check time
//     (handled by the caller via `autoWaiveAssumptions` below).

import type {
  CqObligationRecord,
  CqObligationStatus,
  SchemeInstanceProtocolState,
} from "./protocolState";

export type SoundnessFailure =
  | { kind: "undischarged-obligation"; cqKey: string; status: CqObligationStatus }
  | { kind: "missing-evidence"; cqKey: string }
  | { kind: "exception-not-established"; cqKey: string }
  | { kind: "design-outside-behaviour"; details: string };

export type SoundnessVerdict =
  | { ok: true; waived: string[] }
  | { ok: false; reasons: SoundnessFailure[]; waived: string[] };

const CLOSING_STATUSES: ReadonlySet<CqObligationStatus> = new Set([
  "discharged",
  "failed",
  "waived",
]);

/**
 * Apply Carneades-assumption auto-waive. Returns a new array; does
 * not mutate. Caller persists the waived transitions via
 * `recordObligationTransition` BEFORE calling `checkSoundnessOnClose`
 * if it wants the DB to reflect them.
 *
 * This separation lets the gate be invoked in dry-run mode for
 * audits (read DB state, compute verdict, never write).
 */
export function autoWaiveAssumptions(
  obligations: CqObligationRecord[]
): CqObligationRecord[] {
  return obligations.map((o) =>
    o.status === "not-offered" && o.premiseType === "ASSUMPTION"
      ? { ...o, status: "waived" }
      : o
  );
}

export function checkSoundnessOnClose(
  state: SchemeInstanceProtocolState
): SoundnessVerdict {
  const obligations = autoWaiveAssumptions(state.obligations);
  const reasons: SoundnessFailure[] = [];
  const waived: string[] = [];

  for (const o of obligations) {
    if (o.status === "waived" && o.premiseType === "ASSUMPTION") {
      waived.push(o.cqKey);
    }

    if (!CLOSING_STATUSES.has(o.status)) {
      reasons.push({
        kind: "undischarged-obligation",
        cqKey: o.cqKey,
        status: o.status,
      });
      continue;
    }

    // exception: Carneades default false. Status must be 'failed'
    // (exception not established) OR 'discharged' (exception
    // established + proponent rebutted). 'waived' is not legal for
    // exception premises.
    if (
      o.premiseType === "EXCEPTION" &&
      o.status !== "failed" &&
      o.status !== "discharged"
    ) {
      reasons.push({ kind: "exception-not-established", cqKey: o.cqKey });
      continue;
    }

    // evidence requirement: only applies on discharge
    if (
      o.requiresEvidence &&
      o.status === "discharged" &&
      o.evidenceRefs.length === 0
    ) {
      reasons.push({ kind: "missing-evidence", cqKey: o.cqKey });
    }
  }

  if (reasons.length === 0) {
    return { ok: true, waived };
  }
  return { ok: false, reasons, waived };
}

/**
 * Convenience: human-readable failure summary for UI / error
 * messages.
 */
export function summariseFailure(failure: SoundnessFailure): string {
  switch (failure.kind) {
    case "undischarged-obligation":
      return `CQ "${failure.cqKey}" is still ${failure.status}; close requires discharged | waived | failed.`;
    case "missing-evidence":
      return `CQ "${failure.cqKey}" was discharged without citing evidence (requiresEvidence=true).`;
    case "exception-not-established":
      return `CQ "${failure.cqKey}" is a Carneades exception premise; it must be raised and adjudicated (not waived).`;
    case "design-outside-behaviour":
      return `Design lies outside the scheme's behaviour: ${failure.details}`;
  }
}

export class SoundnessViolationError extends Error {
  readonly reasons: SoundnessFailure[];
  constructor(reasons: SoundnessFailure[]) {
    super(
      `Scheme instance close blocked: ${reasons.length} soundness violation(s) — ` +
        reasons.map(summariseFailure).join(" | ")
    );
    this.name = "SoundnessViolationError";
    this.reasons = reasons;
  }
}
