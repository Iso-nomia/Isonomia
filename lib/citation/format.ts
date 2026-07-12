/**
 * Citation rendering helpers.
 *
 * Phase 5 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Centralizes the "how do we render a citation" decision so the chip in
 * the composer, the tooltip in the argument card, and the AIF export all
 * agree on the same short form.
 */

export interface CitationLike {
  title?: string | null;
  doi?: string | null;
  url?: string | null;
  year?: number | null;
  authors?: Array<{ family?: string | null; given?: string | null }>;
  container?: string | null;
  publisher?: string | null;
}

/**
 * Compact one-line form: "LeCun et al. (2015). Deep learning. Nature."
 *
 * Falls back to the URL hostname if no author/year are known. Always
 * returns a non-empty string for any input that has at least a URL.
 */
export function formatCitationShort(c: CitationLike): string {
  const authorTag = formatAuthors(c.authors);
  const year = c.year ? `(${c.year})` : "";
  const title = (c.title ?? "").trim();
  const container = (c.container ?? c.publisher ?? "").trim();

  const head = [authorTag, year].filter(Boolean).join(" ");
  const body = [head, title, container].filter(Boolean).join(". ");
  if (body.trim()) return body.replace(/\.+$/, "") + ".";

  // Fallback: bare URL hostname, then full URL.
  if (c.url) {
    try {
      return new URL(c.url).hostname;
    } catch {
      return c.url;
    }
  }
  if (c.doi) return `doi:${c.doi}`;
  return "Untitled source";
}

/** "LeCun, Bengio, & Hinton" / "LeCun et al." / "LeCun" */
export function formatAuthors(
  authors: CitationLike["authors"],
): string {
  if (!authors?.length) return "";
  const names = authors
    .map((a) => (a.family ?? a.given ?? "").trim())
    .filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, & ${names[2]}`;
  return `${names[0]} et al.`;
}
