/**
 * lib/argument-chains/chainEvidence.ts
 *
 * Pure, DB-free helpers for PART 5 Step 3 (per-link evidence upgrade) of the
 * Chain Semantics over MCP spec. Mirrors the discipline of `chainTopology.ts`
 * and `chainScopes.ts`: all validation that does not require the database lives
 * here as testable pure functions; the route owns the I/O (Source resolution,
 * ClaimEvidence + Citation writes).
 *
 * Two concerns:
 *   1. Anchor well-formedness (§4.6) — `anchorData` must match `anchorType`,
 *      the evidence analogue of PART 3's claim-fork guard. A citation cannot
 *      claim to anchor at a coordinate it does not carry the data for.
 *   2. Intent contrariety (§4.5) — a `refutes` intent on a support link is
 *      allowed (it may be a steelman) but advisory-flagged so the mismatch is
 *      visible.
 */

// The Citation anchor vocabulary (schema `enum CitationAnchorType`).
export const CITATION_ANCHOR_TYPES = [
  "annotation",
  "text_range",
  "timestamp",
  "page",
  "coordinates",
] as const;
export type CitationAnchorType = (typeof CITATION_ANCHOR_TYPES)[number];

// The Citation intent vocabulary (schema `enum CitationIntent`).
export const CITATION_INTENTS = [
  "supports",
  "refutes",
  "context",
  "defines",
  "method",
  "background",
  "acknowledges",
  "example",
] as const;
export type CitationIntent = (typeof CITATION_INTENTS)[number];

export interface EvidenceAnchorInput {
  anchorType?: CitationAnchorType;
  anchorData?: unknown;
  anchorId?: string;
  intent?: CitationIntent;
  /**
   * The verbatim snippet being cited. For a `text_range` anchor this doubles as
   * a *passage* identifier when no character offsets are available (the common
   * case for an agent citing a PDF/report — see `validateEvidenceAnchor`).
   */
  quote?: string;
}

/**
 * Is this evidence item "executable" — i.e. does it carry any of the PART 5
 * Step 3 fields (`locator`, `anchorType`, `anchorData`, `intent`)?
 *
 * Plain PART-3 evidence (`{ url, quote }` with none of these) writes only a
 * `ClaimEvidence` snapshot — NO `Citation` row, and no `Source` resolution — so
 * that a PART-3 payload behaves exactly as before (§9 backward-compat guard).
 */
export function isExecutableEvidence(item: {
  locator?: string;
  anchorType?: CitationAnchorType;
  anchorData?: unknown;
  intent?: CitationIntent;
}): boolean {
  return (
    item.locator !== undefined ||
    item.anchorType !== undefined ||
    item.anchorData !== undefined ||
    item.intent !== undefined
  );
}

export type EvidenceAnchorResult =
  | { ok: true }
  | { ok: false; code: "EVIDENCE_ANCHOR_MALFORMED"; detail: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Validate a single evidence item's anchor against §4.6.
 *
 * | anchorType   | required anchorData shape                         |
 * |--------------|---------------------------------------------------|
 * | page         | none (locator carries the page)                   |
 * | text_range   | { start, end } offsets — OR a verbatim `quote`    |
 * | timestamp    | { start: number, end?: number } (seconds)         |
 * | coordinates  | { x, y, width, height }                           |
 * | annotation   | anchorId referencing an existing Annotation       |
 *
 * `text_range` is the one anchor an agent can rarely satisfy with exact
 * character offsets (a PDF/report gives you the words, not their indices), so
 * it also accepts the verbatim passage as a `quote` — on `anchorData.quote` or
 * carried on the item itself. The server stores the quote and can resolve
 * offsets against the Source later.
 *
 * Plain PART-3 evidence (no `anchorType`) is always well-formed.
 */
export function validateEvidenceAnchor(
  item: EvidenceAnchorInput,
): EvidenceAnchorResult {
  const { anchorType, anchorData, anchorId, quote } = item;
  if (!anchorType) return { ok: true };

  const malformed = (detail: string): EvidenceAnchorResult => ({
    ok: false,
    code: "EVIDENCE_ANCHOR_MALFORMED",
    detail,
  });

  switch (anchorType) {
    case "page":
      // Page-level reference; the page number lives in `locator`, not anchorData.
      return { ok: true };

    case "annotation":
      if (typeof anchorId === "string" && anchorId.trim().length > 0) {
        return { ok: true };
      }
      return malformed(
        "annotation anchor requires an anchorId referencing an Annotation",
      );

    case "text_range": {
      // Precise anchor: explicit character offsets.
      if (isRecord(anchorData) && isNum(anchorData.start) && isNum(anchorData.end)) {
        return { ok: true };
      }
      // Passage anchor (§4.6 relaxation): an agent citing a PDF/report has the
      // verbatim quotation but no character offsets. Accept a `quote` — either
      // on `anchorData.quote` or carried on the item — as a valid passage; the
      // server stores it and can resolve offsets against the Source later.
      const passageQuote =
        isRecord(anchorData) && typeof anchorData.quote === "string"
          ? anchorData.quote
          : quote;
      if (typeof passageQuote === "string" && passageQuote.trim().length > 0) {
        return { ok: true };
      }
      return malformed(
        "text_range anchor requires anchorData { start, end } character offsets, " +
          "or a verbatim `quote` (the passage text) when offsets are unavailable",
      );
    }

    case "timestamp":
      if (
        isRecord(anchorData) &&
        isNum(anchorData.start) &&
        (anchorData.end === undefined || isNum(anchorData.end))
      ) {
        return { ok: true };
      }
      return malformed(
        "timestamp anchor requires anchorData { start: number, end?: number } in seconds",
      );

    case "coordinates":
      if (
        isRecord(anchorData) &&
        isNum(anchorData.x) &&
        isNum(anchorData.y) &&
        isNum(anchorData.width) &&
        isNum(anchorData.height)
      ) {
        return { ok: true };
      }
      return malformed(
        "coordinates anchor requires anchorData { x, y, width, height }",
      );

    default:
      return { ok: true };
  }
}

/**
 * §4.5 advisory: a `refutes` intent on a support link is contrary (it argues
 * against the very claim the link supports). Advisory-only — never gating.
 */
export function intentContradictsSupport(
  intent: CitationIntent | undefined,
): boolean {
  return intent === "refutes";
}
