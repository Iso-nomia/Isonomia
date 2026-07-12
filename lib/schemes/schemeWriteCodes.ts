/**
 * lib/schemes/schemeWriteCodes.ts
 *
 * Roadmap E.1 (SCHEMES_MCP_ALIGNMENT_ROADMAP §4.1) — the single source of truth
 * for the typed error/warning codes the argument WRITE surface emits. Both the
 * `resolveSchemeForWrite` health gate and the `POST /api/arguments/quick-structured`
 * route reference this table so a code can never drift between the gate's verdict
 * and the HTTP response, and so the MCP descriptions document a stable vocabulary.
 *
 * The §1.4 seam: WF1/WF2/WF3 (scheme-DEFINITION authoring) codes are deliberately
 * absent — they belong to the admin definition path, never to an argument write.
 * If an MCP scheme-authoring surface is ever specced, those codes get their own
 * table.
 *
 * `canonical` convention (roadmap "error.canonical — the redirected key / fixed
 * value"): the corrected/applied value a consumer should adopt. For a refusal it
 * is `null` (there is no automatic fix); for a canonicalisation it is the
 * canonical scheme key; for an epistemic-mode shift it is the resolved mode; for
 * an inconclusive verdict it is the peer key the check ran against.
 */

export type SchemeWriteSeverity = "error" | "warning";

export interface SchemeWriteCodeMeta {
  severity: SchemeWriteSeverity;
  /** Roadmap phase the code belongs to (documentation only). */
  phase: string;
  /** Human-readable cause, mirrored from the §4.1 table. */
  cause: string;
}

/**
 * The §4.1 code table. Keys are the wire-level `code` values; the metadata is
 * for documentation, severity routing, and test assertions.
 */
export const SCHEME_WRITE_CODES = {
  SCHEME_UNKNOWN: {
    severity: "error",
    phase: "A/B",
    cause: "key not in list_schemes",
  },
  SCHEME_NOT_ARGUMENT_PATTERN: {
    severity: "error",
    phase: "B",
    cause: "dialogue-meta / test placeholder",
  },
  SCHEME_CANONICALIZED: {
    severity: "warning",
    phase: "B",
    cause: "duplicate auto-redirected",
  },
  PREMISE_TYPE_INCONSISTENT: {
    severity: "warning",
    phase: "B",
    cause: "premiseType conflicts w/ scheme default",
  },
  EPISTEMIC_MODE_CHANGED_FINGERPRINT: {
    severity: "warning",
    phase: "B",
    cause: "agent override shifts fingerprint",
  },
  VERIFIER_INCONCLUSIVE: {
    severity: "warning",
    phase: "B/C",
    cause: "verdict inconclusive on same-fingerprint check",
  },
} as const satisfies Record<string, SchemeWriteCodeMeta>;

export type SchemeWriteCode = keyof typeof SCHEME_WRITE_CODES;

/** Codes whose `severity` is `"error"` — block the write. */
export type SchemeWriteErrorCode = {
  [K in SchemeWriteCode]: (typeof SCHEME_WRITE_CODES)[K]["severity"] extends "error"
    ? K
    : never;
}[SchemeWriteCode];

/** Codes whose `severity` is `"warning"` — ship with a flag. */
export type SchemeWriteWarningCode = {
  [K in SchemeWriteCode]: (typeof SCHEME_WRITE_CODES)[K]["severity"] extends "warning"
    ? K
    : never;
}[SchemeWriteCode];

export function isSchemeWriteCode(value: string): value is SchemeWriteCode {
  return Object.prototype.hasOwnProperty.call(SCHEME_WRITE_CODES, value);
}

export function severityOf(code: SchemeWriteCode): SchemeWriteSeverity {
  return SCHEME_WRITE_CODES[code].severity;
}

/**
 * A canonical write warning: a typed code, a human-readable detail, and the
 * `canonical` corrected value a consumer should adopt (or `null` when there is
 * none). Operational warnings that are NOT part of the §4.1 table (slot
 * presence, premise dedup, server-side inference) carry their own union in the
 * route and are not modelled here.
 */
export interface SchemeWriteWarning {
  code: SchemeWriteWarningCode;
  detail: string;
  canonical: string | null;
}

/** A canonical write error: refuses the write with a typed code. */
export interface SchemeWriteError {
  code: SchemeWriteErrorCode;
  /** Human-readable message. */
  error: string;
  /** The corrected/applied value, or `null` when there is no automatic fix. */
  canonical: string | null;
}
