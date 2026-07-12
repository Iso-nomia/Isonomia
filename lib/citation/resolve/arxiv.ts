/**
 * arXiv adapter for the Auto-Citation Engine.
 *
 * Phase 3 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Detects arXiv IDs in a URL and resolves them via the public Atom
 * query API:
 *
 *   http://export.arxiv.org/api/query?id_list=<id>
 *
 * Returns a `ResolvedSource` keyed by `arxiv:<id>`. We do not try to
 * promote arXiv preprints to their published-DOI counterpart here —
 * Crossref handles that automatically when the preprint has been
 * cross-listed, and falsely re-routing a preprint to a paywalled
 * journal version misrepresents the actual cited work.
 */

import { SourceIdentifierType } from "@prisma/client";
import { acquireHostToken } from "./rateLimit";
import { extractArxivIdFromUrl } from "./extractDoi";
import type { ResolvedSource } from "@/lib/integrations/crossref";

const ARXIV_API = "http://export.arxiv.org/api/query";

export interface ArxivResult {
  source: ResolvedSource;
  /** arXiv IDs are deterministic — always high confidence. */
  confidence: "high";
}

export async function resolveArxivFromUrl(
  url: string,
  opts: { userAgent: string; timeoutMs: number },
): Promise<ArxivResult | null> {
  const id = extractArxivIdFromUrl(url);
  if (!id) return null;
  return resolveArxivId(id, opts);
}

export async function resolveArxivId(
  id: string,
  opts: { userAgent: string; timeoutMs: number },
): Promise<ArxivResult | null> {
  const ok = await acquireHostToken(ARXIV_API);
  if (!ok) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  let xml: string;
  try {
    const res = await fetch(`${ARXIV_API}?id_list=${encodeURIComponent(id)}`, {
      headers: { "User-Agent": opts.userAgent, Accept: "application/atom+xml" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  const entry = sliceFirst(xml, "<entry>", "</entry>");
  if (!entry) return null;

  const title = decodeXmlEntities(stripTags(sliceFirst(entry, "<title>", "</title>") ?? "")).trim();
  if (!title) return null;
  const summary = decodeXmlEntities(stripTags(sliceFirst(entry, "<summary>", "</summary>") ?? "")).trim();
  const published = sliceFirst(entry, "<published>", "</published>") ?? "";
  const year = matchYear(published);

  // Authors: <author><name>X</name></author>
  const authors: Array<{ family?: string; given?: string }> = [];
  const authorRegex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
  let m: RegExpExecArray | null;
  while ((m = authorRegex.exec(entry)) !== null) {
    const name = decodeXmlEntities(stripTags(m[1])).trim();
    if (!name) continue;
    authors.push(splitName(name));
  }

  // PDF link: <link title="pdf" href="..."/>
  const pdfMatch = entry.match(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/);
  const pdfUrl = pdfMatch ? pdfMatch[1] : undefined;

  // Categories → keywords (term attribute on <category>).
  const keywords: string[] = [];
  const catRegex = /<category[^>]+term="([^"]+)"/g;
  while ((m = catRegex.exec(entry)) !== null) keywords.push(m[1]);

  // arXiv may include a journal-ref / DOI for accepted papers.
  const arxivDoi = (sliceFirst(entry, "<arxiv:doi>", "</arxiv:doi>") ?? "").trim();
  const journalRef = (sliceFirst(entry, "<arxiv:journal_ref>", "</arxiv:journal_ref>") ?? "").trim();

  const source: ResolvedSource = {
    identifier: arxivDoi || `arxiv:${id}`,
    identifierType: arxivDoi ? SourceIdentifierType.DOI : SourceIdentifierType.ARXIV,
    title,
    authorsJson: authors,
    authorOrcids: [],
    year,
    abstractText: summary || undefined,
    container: journalRef || "arXiv",
    publisher: "arXiv",
    keywords,
    url: `https://arxiv.org/abs/${id}`,
    kind: "preprint",
    pdfUrl,
  };
  return { source, confidence: "high" };
}

// ─────────────────────────────────────────────────────────
// Tiny XML helpers (Atom is small + well-formed enough)
// ─────────────────────────────────────────────────────────

function sliceFirst(haystack: string, openTag: string, closeTag: string): string | null {
  const i = haystack.indexOf(openTag);
  if (i === -1) return null;
  const j = haystack.indexOf(closeTag, i + openTag.length);
  if (j === -1) return null;
  return haystack.slice(i + openTag.length, j);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function matchYear(s: string): number | undefined {
  const m = s.match(/(\d{4})/);
  return m ? Number(m[1]) : undefined;
}

function splitName(name: string): { family?: string; given?: string } {
  // arXiv usually returns "Given Family"; "Family, Given" appears too.
  if (name.includes(",")) {
    const [family, given] = name.split(",", 2).map((p) => p.trim());
    return { family, given };
  }
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { family: parts[0] };
  const family = parts.pop()!;
  return { family, given: parts.join(" ") };
}
