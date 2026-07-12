/**
 * Extract a DOI from an arbitrary URL or string.
 *
 * Phase 1 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Complements `normalizeDOI` from `lib/integrations/crossref.ts`, which
 * only accepts already-DOI-shaped inputs. This module finds DOIs hiding
 * inside publisher URLs (e.g. `nature.com/articles/s41586-023-...`,
 * `journals.plos.org/plosone/article?id=10.1371/...`,
 * `linkinghub.elsevier.com/retrieve/pii/...?via=`).
 *
 * Strategy: regex-scan the URL path + query for a DOI-shaped substring.
 * False positives are filtered by requiring the prefix `10.` followed by
 * 4+ digits and a slash, per the Crossref DOI handbook.
 *
 * NOT covered here (deferred to Phase 3):
 *   - Scraping `<meta name="citation_doi">` from the page body (Highwire).
 *   - PII → DOI lookup against Crossref (Elsevier articles often only
 *     surface the PII in the URL).
 */

/**
 * DOI character set per the Crossref handbook:
 * https://www.doi.org/the-identifier/resources/handbook/2_numbering/#2.2
 *
 * After the leading `10.NNNN/`, the suffix may contain any printable
 * Unicode character, but in practice we limit to a sane URL-safe subset
 * to avoid swallowing query separators and fragments.
 */
const DOI_REGEX = /\b(10\.\d{4,9}\/[^\s"'<>?#]+)/i;

/**
 * Extract a DOI from a URL (or any string). Returns null when no
 * DOI-shaped substring is found.
 *
 * Trailing punctuation that browsers commonly attach to URLs (`)`, `.`,
 * `,`, `;`, `]`) is stripped from the suffix.
 */
export function extractDoiFromUrl(input: string): string | null {
  if (!input) return null;
  const match = input.match(DOI_REGEX);
  if (!match) return null;
  let doi = match[1];

  // Trim trailing URL/sentence punctuation.
  doi = doi.replace(/[).,;\]]+$/, "");

  // Sanity-check: must still match the prefix rule after trimming.
  if (!/^10\.\d{4,9}\/.+/.test(doi)) return null;

  return doi;
}

/**
 * arXiv ID detector. Matches both legacy (`hep-th/9901001`) and modern
 * (`2304.01234`, `2304.01234v2`) IDs anywhere in the URL.
 *
 * Returns the bare ID without the `arXiv:` prefix or version suffix
 * (callers wanting the version should use the raw match group).
 */
const ARXIV_MODERN = /\b(?:arxiv[:\/])?(\d{4}\.\d{4,5})(v\d+)?\b/i;
const ARXIV_LEGACY =
  /\b(?:arxiv[:\/])?([a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?\b/i;

export function extractArxivIdFromUrl(input: string): string | null {
  if (!input) return null;
  const modern = input.match(ARXIV_MODERN);
  if (modern) return modern[1];
  const legacy = input.match(ARXIV_LEGACY);
  if (legacy) return legacy[1];
  return null;
}
