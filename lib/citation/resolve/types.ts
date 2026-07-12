/**
 * Auto-Citation Engine — shared resolver types
 *
 * Phase 1 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * The resolver's contract is "URL in, ResolvedCitation out". A
 * ResolvedCitation is the *intermediate* in-flight shape: it holds the
 * canonical-URL key, the detected identifier (if any), the bibliographic
 * payload (a `ResolvedSource` from `lib/integrations/crossref.ts`), and
 * the audit trail of which adapter produced which fields.
 *
 * Persistence (Phase 2) lifts a ResolvedCitation into a `Source` row;
 * this type is deliberately *not* a Prisma model.
 */

import type { ResolvedSource } from "@/lib/integrations/crossref";

/** Where a piece of metadata came from. Audit-grade, never inferred. */
export type ResolverSource =
  | "crossref"      // DOI content negotiation (gold path)
  | "openalex"      // enrichment of an existing DOI hit
  | "highwire"      // <meta name="citation_*"> scrape
  | "arxiv"         // Atom-feed parse
  | "wayback"       // archive.org snapshot lookup
  | "llm"           // Haiku / GPT extraction fallback
  | "manual";       // user-pasted bibliographic stub

/**
 * Confidence in the resolved metadata as a whole.
 *
 * - "high"   — DOI content negotiation succeeded, or arXiv ID parsed.
 * - "medium" — Highwire / OpenAlex returned a canonical-looking record
 *              but no DOI was confirmed.
 * - "low"    — LLM extraction or sparse OG/Twitter tags only.
 * - "none"   — nothing usable; resolver fell through.
 */
export type Confidence = "high" | "medium" | "low" | "none";

export interface ResolvedCitation {
  /**
   * Canonical URL after redirect-following and tracking-param stripping.
   * This is the cache key; two URLs that canonicalize to the same string
   * MUST produce the same ResolvedCitation.
   */
  canonicalUrl: string;

  /** Original URL the caller passed in, before canonicalization. */
  inputUrl: string;

  /** DOI if one was extracted or returned by an adapter. */
  doi?: string;

  /**
   * Bibliographic payload. Reuses the existing `ResolvedSource` shape so
   * Phase 2 can upsert into `Source` without a translation layer.
   * Null when every adapter failed (caller still gets `confidence: "none"`).
   */
  source: ResolvedSource | null;

  /**
   * Which adapter produced the *primary* metadata. Enrichment adapters
   * (e.g. OpenAlex on top of Crossref) record their contribution in
   * `enrichedBy` instead of overwriting this field.
   */
  resolvedFrom: ResolverSource;

  /** Adapters that contributed enrichment fields on top of `resolvedFrom`. */
  enrichedBy: ResolverSource[];

  confidence: Confidence;

  /** ISO-8601 timestamp the resolution completed. */
  resolvedAt: string;

  /** Wall-clock duration of the full waterfall in ms (for telemetry). */
  durationMs: number;

  /**
   * Soft-fail diagnostics. Never thrown; readers can surface to logs or
   * the composer's "edit metadata" UI.
   */
  warnings?: string[];

  /**
   * Wayback Machine snapshot URL, if one was found while resolving.
   * Populated for *any* outcome (including success) when archive lookup
   * succeeds — gives readers a stable copy independent of the live URL.
   */
  archiveUrl?: string;

  /** ISO-8601 timestamp of the archive snapshot, if any. */
  archiveCapturedAt?: string;

  /**
   * Identifiers derived cheaply from the input URL itself (DOI prefix
   * scan, arXiv ID regex). Populated *up front*, regardless of whether
   * the downstream waterfall succeeds — so a 403 from the publisher
   * does not erase the fact that the URL embedded a DOI.
   *
   * Callers wanting "did we at least register an identifier?" semantics
   * (e.g. attaching evidence with `confidence:"none"` but a known DOI)
   * should read this. Always present (object), but `doi` / `arxivId`
   * may be undefined when nothing was extractable.
   */
  derivedIdentifiers: {
    doi?: string;
    arxivId?: string;
  };
}
