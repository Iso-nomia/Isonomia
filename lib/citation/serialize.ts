/**
 * Canonical CitationBlock — Track AI-EPI Pt. 3 §7
 *
 * One shape, used by:
 *   - the public API (`/api/v3/search/arguments`, `/api/a/:id/aif`)
 *   - the MCP server (`get_argument`, `cite_argument`)
 *   - the AIF attestation envelope (`buildArgumentAttestation`)
 *
 * The point: callers never need to parse prose for citations. Every cited
 * source arrives as a structured object with URL/DOI/quote/anchor + the
 * provenance fields we already collect on `ClaimEvidence` rows.
 *
 * Mirrors the public-facing `EvidenceProvenance` shape from
 * `lib/citations/argumentAttestation.ts` but with explicit citation
 * vocabulary (title, publisher, accessedAt, quoteAnchor) so downstream
 * consumers can render proper citation chips without re-deriving fields.
 */

export interface CitationBlock {
  /** Stable evidence row id (cuid) */
  id: string;
  /** Source title (best-effort: provided, or unfurled at evidence-create time) */
  title: string | null;
  /** Source URL (the human-followable canonical link) */
  url: string | null;
  /** Optional DOI when the source is a scholarly artifact */
  doi: string | null;
  /** Best-effort publisher / domain owner, derived from the URL host */
  publisher: string | null;
  /** ISO timestamp when provenance enrichment last successfully fetched the source */
  accessedAt: string | null;
  /** ISO timestamp when an archive snapshot was taken / observed */
  archivedAt: string | null;
  /** Wayback / archive.org snapshot URL when one exists */
  archivedUrl: string | null;
  /** sha256:<hex> of the fetched response body, when archived */
  contentSha256: string | null;
  /** Optional pull-quote (the cited passage) */
  quote: string | null;
  /**
   * Optional fragment-anchor metadata that lets a UI scroll the source to
   * the cited passage. We default to a `text-quote` selector matching the
   * `quote` field — clients can render this as `#:~:text=...` where the
   * browser supports text-fragment links.
   */
  quoteAnchor: { selector: string; type: "text-quote" } | null;
}

/**
 * Best-effort publisher derivation from a URL string. Falls back to null
 * for opaque URLs. Strips a leading `www.` for cleanliness.
 */
function publisherFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Recognise a DOI either embedded in the URL or already isolated. */
function extractDoi(url: string | null | undefined): string | null {
  if (!url) return null;
  // doi.org/10.xxxx/xxx
  const m = url.match(/(10\.\d{4,9}\/[^\s\/?#]+)/);
  return m ? m[1] : null;
}

/**
 * Convert a raw `ClaimEvidence` Prisma row (or compatible shape) into a
 * `CitationBlock`. Caller is responsible for selecting the right fields
 * upstream — this function only normalizes and projects.
 */
export function toCitationBlock(ev: {
  id: string;
  title?: string | null;
  uri?: string | null;
  citation?: string | null; // legacy field that often holds a pull-quote
  contentSha256?: string | null;
  archivedUrl?: string | null;
  archivedAt?: Date | string | null;
  fetchedAt?: Date | string | null;
}): CitationBlock {
  const url = ev.uri ?? null;
  const quote = ev.citation ?? null;
  return {
    id: ev.id,
    title: ev.title ?? null,
    url,
    doi: extractDoi(url),
    publisher: publisherFromUrl(url),
    accessedAt: ev.fetchedAt
      ? new Date(ev.fetchedAt).toISOString()
      : null,
    archivedAt: ev.archivedAt ? new Date(ev.archivedAt).toISOString() : null,
    archivedUrl: ev.archivedUrl ?? null,
    contentSha256: ev.contentSha256 ?? null,
    quote,
    quoteAnchor: quote ? { selector: quote, type: "text-quote" } : null,
  };
}
