/**
 * Highwire Press / DC / OpenGraph metadata scraper.
 *
 * Phase 1 of docs/AUTO_CITATION_ENGINE_ROADMAP.md.
 *
 * Most academic publishers expose Highwire Press meta tags
 * (https://scholar.google.com/intl/en/scholar/inclusion.html#indexing):
 *
 *   <meta name="citation_doi"           content="10.1234/xyz">
 *   <meta name="citation_title"         content="...">
 *   <meta name="citation_author"        content="Last, First"> (repeats)
 *   <meta name="citation_journal_title" content="...">
 *   <meta name="citation_publication_date" content="2024/01/15">
 *   <meta name="citation_volume" / "_issue" / "_firstpage" / "_lastpage">
 *   <meta name="citation_pdf_url"       content="...">
 *
 * We fall back to Dublin Core (DC.title / DC.creator / DC.date) and then
 * to OpenGraph (og:title) for blog/news pages that don't carry citation_*.
 *
 * This module only parses HTML it is given. Network fetching is the
 * waterfall's job (`lib/citation/resolve/index.ts`).
 */

import * as cheerio from "cheerio";
import { SourceIdentifierType } from "@prisma/client";
import type { ResolvedSource } from "@/lib/integrations/crossref";
import type { Confidence } from "./types";

export interface HighwireResult {
  source: ResolvedSource;
  confidence: Confidence;
  /** Set of meta-tag families that contributed (for telemetry). */
  contributedBy: Array<"citation_" | "dc." | "og." | "twitter:">;
}

/**
 * Parse meta tags out of an HTML string.
 *
 * Returns `null` only when the document is so empty that we cannot even
 * extract a title. Any document with at least a title produces a result
 * with `confidence: "low"`; results with `citation_title + citation_doi`
 * (or several `citation_*` tags) earn `"medium"`.
 */
export function scrapeHighwire(html: string, sourceUrl?: string): HighwireResult | null {
  const $ = cheerio.load(html);
  const contributedBy = new Set<HighwireResult["contributedBy"][number]>();

  // ──────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────

  const metaContent = (selector: string): string | undefined => {
    const el = $(selector).first();
    if (!el.length) return undefined;
    const v = el.attr("content");
    return v ? v.trim() : undefined;
  };

  const metaContentAll = (selector: string): string[] =>
    $(selector)
      .map((_i, el) => $(el).attr("content"))
      .get()
      .filter((v): v is string => Boolean(v))
      .map((v) => v.trim());

  // ──────────────────────────────────────────────────────
  // Citation_* (Highwire) — gold path
  // ──────────────────────────────────────────────────────

  const cTitle = metaContent('meta[name="citation_title" i]');
  const cDoi = metaContent('meta[name="citation_doi" i]');
  const cJournal = metaContent('meta[name="citation_journal_title" i]');
  const cPublisher = metaContent('meta[name="citation_publisher" i]');
  const cVolume = metaContent('meta[name="citation_volume" i]');
  const cIssue = metaContent('meta[name="citation_issue" i]');
  const cFirstPage = metaContent('meta[name="citation_firstpage" i]');
  const cLastPage = metaContent('meta[name="citation_lastpage" i]');
  const cPdfUrl = metaContent('meta[name="citation_pdf_url" i]');
  const cAbstractUrl = metaContent('meta[name="citation_abstract_html_url" i]');
  const cFullUrl = metaContent('meta[name="citation_fulltext_html_url" i]');
  const cAuthors = metaContentAll('meta[name="citation_author" i]');
  const cKeywords = metaContent('meta[name="citation_keywords" i]');
  const cPubDate =
    metaContent('meta[name="citation_publication_date" i]') ??
    metaContent('meta[name="citation_online_date" i]') ??
    metaContent('meta[name="citation_date" i]');
  if (cTitle || cDoi || cAuthors.length) contributedBy.add("citation_");

  // ──────────────────────────────────────────────────────
  // Dublin Core fallback
  // ──────────────────────────────────────────────────────

  const dcTitle = metaContent('meta[name="DC.title" i]');
  const dcCreator = metaContentAll('meta[name="DC.creator" i]');
  const dcDate = metaContent('meta[name="DC.date" i]');
  const dcPublisher = metaContent('meta[name="DC.publisher" i]');
  if (dcTitle || dcCreator.length) contributedBy.add("dc.");

  // ──────────────────────────────────────────────────────
  // OpenGraph + Twitter Card fallback (blogs, news)
  // ──────────────────────────────────────────────────────

  const ogTitle = metaContent('meta[property="og:title" i]');
  const ogSiteName = metaContent('meta[property="og:site_name" i]');
  const ogType = metaContent('meta[property="og:type" i]');
  const articlePublishedTime = metaContent(
    'meta[property="article:published_time" i]',
  );
  const articleAuthors = metaContentAll('meta[property="article:author" i]');
  if (ogTitle || ogSiteName) contributedBy.add("og.");

  const twTitle = metaContent('meta[name="twitter:title" i]');
  const twCreator = metaContent('meta[name="twitter:creator" i]');
  if (twTitle || twCreator) contributedBy.add("twitter:");

  // ──────────────────────────────────────────────────────
  // Resolution
  // ──────────────────────────────────────────────────────

  const title = cTitle ?? dcTitle ?? ogTitle ?? twTitle ?? $("title").first().text().trim();
  if (!title) return null;

  const authorsRaw =
    cAuthors.length ? cAuthors :
    dcCreator.length ? dcCreator :
    articleAuthors.length ? articleAuthors :
    twCreator ? [twCreator] :
    [];
  const authorsJson = authorsRaw.map(parseAuthor);
  const authorOrcids: string[] = []; // Highwire rarely exposes ORCIDs; defer to OpenAlex.

  const year = parseYear(cPubDate ?? dcDate ?? articlePublishedTime);

  const pages =
    cFirstPage && cLastPage
      ? `${cFirstPage}-${cLastPage}`
      : cFirstPage ?? undefined;

  const url = cFullUrl ?? cAbstractUrl ?? sourceUrl;

  const kind = inferKind(ogType, cJournal, cDoi);

  // Confidence: DOI present → medium-high; multiple citation_* fields → medium;
  // pure OG/Twitter → low.
  let confidence: Confidence = "low";
  if (cDoi && cTitle) confidence = "medium";
  else if (cTitle && (cAuthors.length || cJournal)) confidence = "medium";

  const source: ResolvedSource = {
    identifier: cDoi ?? url ?? title,
    identifierType: cDoi ? SourceIdentifierType.DOI : SourceIdentifierType.URL,
    title,
    authorsJson,
    authorOrcids,
    year,
    abstractText: undefined,
    container: cJournal ?? ogSiteName,
    volume: cVolume,
    issue: cIssue,
    pages,
    publisher: cPublisher ?? dcPublisher,
    keywords: cKeywords ? cKeywords.split(/[,;]\s*/).filter(Boolean) : [],
    url,
    kind,
    pdfUrl: cPdfUrl,
  };

  return {
    source,
    confidence,
    contributedBy: [...contributedBy],
  };
}

/**
 * Highwire `citation_author` is usually `"Last, First"`. Some publishers
 * use `"First Last"`. We try comma-split first, then space-split as a
 * single-author fallback. Multi-word given names ("Mary Anne") are
 * preserved.
 */
function parseAuthor(raw: string): { family?: string; given?: string } {
  const trimmed = raw.trim();
  if (trimmed.includes(",")) {
    const [family, ...rest] = trimmed.split(",");
    return { family: family.trim(), given: rest.join(",").trim() || undefined };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { family: parts[0] };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(" ") };
}

/**
 * Accept ISO dates, slash dates (`2024/01/15`), or bare years.
 */
function parseYear(input?: string): number | undefined {
  if (!input) return undefined;
  const m = input.match(/(\d{4})/);
  if (!m) return undefined;
  const y = Number(m[1]);
  return y >= 1500 && y <= 2999 ? y : undefined;
}

/**
 * Map adapter-visible signals to a `Source.kind` enum value.
 * Mirrors the inference in `lib/integrations/crossref.ts`.
 */
function inferKind(ogType?: string, journal?: string, doi?: string): string {
  if (journal || doi) return "article";
  if (ogType === "video.other" || ogType === "video.movie") return "video";
  if (ogType === "book") return "book";
  if (ogType === "website" || ogType === "article") return "web";
  return "web";
}
