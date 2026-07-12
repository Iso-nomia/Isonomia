/**
 * Academic Database Search - Unified Interface
 *
 * Provides a unified interface for searching across multiple academic databases:
 * - Semantic Scholar (200M+ papers)
 * - OpenAlex (250M+ works)
 * - CrossRef (140M+ DOIs)
 *
 * @module lib/sources/academicSearch
 */

import { searchSemanticScholar, getSemanticScholarPaper } from "./databases/semanticScholar";
import { searchOpenAlex, getOpenAlexWork } from "./databases/openAlex";
import { searchCrossRef, getCrossRefWork } from "./databases/crossref";

/**
 * Standardized result from any academic database search
 */
export interface AcademicSearchResult {
  // Unique ID in source database
  externalId: string;

  // Which database this came from
  source: "semantic_scholar" | "openalex" | "crossref" | "pubmed" | "arxiv";

  // Core metadata
  title: string;
  authors: string[];
  abstract?: string;
  publicationDate?: string;
  year?: number;

  // Identifiers
  doi?: string;
  arxivId?: string;
  pmid?: string;
  pmcid?: string;

  // Venue info
  venue?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;

  // Access
  url?: string;
  pdfUrl?: string;
  isOpenAccess?: boolean;

  // Metrics
  citationCount?: number;
  influentialCitationCount?: number;
  referenceCount?: number;

  // For deduplication
  normalizedTitle?: string;

  // Source-specific data
  rawData?: Record<string, unknown>;
}

/**
 * Options for academic database search
 */
export interface AcademicSearchOptions {
  // Search query
  query: string;

  // Which databases to search
  databases?: Array<"semantic_scholar" | "openalex" | "crossref" | "pubmed" | "arxiv">;

  // Pagination
  offset?: number;
  limit?: number;

  // Filters
  yearFrom?: number;
  yearTo?: number;
  openAccessOnly?: boolean;

  // Field-specific search
  fields?: {
    title?: string;
    author?: string;
    doi?: string;
  };

  // Sorting
  sortBy?: "relevance" | "date" | "citations";
}

/**
 * Combined search response with results from all databases
 */
export interface AcademicSearchResponse {
  results: AcademicSearchResult[];
  totalBySource: {
    semantic_scholar?: number;
    openalex?: number;
    crossref?: number;
    pubmed?: number;
    arxiv?: number;
  };
  query: string;
  databases: string[];
  deduplicated: boolean;
}

/**
 * Search across multiple academic databases
 */
export async function searchAcademicDatabases(
  options: AcademicSearchOptions
): Promise<AcademicSearchResponse> {
  const databases = options.databases || ["semantic_scholar", "openalex", "crossref"];
  const limit = options.limit || 20;
  const offset = options.offset || 0;

  // Search each database in parallel
  const searchPromises: Promise<{ source: string; results: AcademicSearchResult[]; total: number }>[] = [];

  for (const db of databases) {
    switch (db) {
      case "semantic_scholar":
        searchPromises.push(
          searchSemanticScholar(options.query, { limit, offset, yearFrom: options.yearFrom, yearTo: options.yearTo })
            .then((res) => ({ source: "semantic_scholar", results: res.results, total: res.total }))
            .catch((err) => {
              console.error("Semantic Scholar search failed:", err);
              return { source: "semantic_scholar", results: [], total: 0 };
            })
        );
        break;

      case "openalex":
        searchPromises.push(
          searchOpenAlex(options.query, { limit, offset, yearFrom: options.yearFrom, yearTo: options.yearTo })
            .then((res) => ({ source: "openalex", results: res.results, total: res.total }))
            .catch((err) => {
              console.error("OpenAlex search failed:", err);
              return { source: "openalex", results: [], total: 0 };
            })
        );
        break;

      case "crossref":
        searchPromises.push(
          searchCrossRef(options.query, { limit, offset, yearFrom: options.yearFrom, yearTo: options.yearTo })
            .then((res) => ({ source: "crossref", results: res.results, total: res.total }))
            .catch((err) => {
              console.error("CrossRef search failed:", err);
              return { source: "crossref", results: [], total: 0 };
            })
        );
        break;
    }
  }

  const searchResults = await Promise.all(searchPromises);

  // Combine results
  let allResults: AcademicSearchResult[] = [];
  const totalBySource: Record<string, number> = {};

  for (const { source, results, total } of searchResults) {
    allResults = allResults.concat(results);
    totalBySource[source] = total;
  }

  // Deduplicate by DOI or normalized title
  const deduplicatedResults = deduplicateResults(allResults);

  // Sort by relevance (results are already sorted by relevance from each API)
  // Interleave results from different sources for better UX
  const finalResults = interleaveResults(deduplicatedResults, databases);

  return {
    results: finalResults.slice(0, limit),
    totalBySource,
    query: options.query,
    databases,
    deduplicated: true,
  };
}

/**
 * Get detailed information about a specific paper
 */
export async function getAcademicPaper(
  source: AcademicSearchResult["source"],
  externalId: string
): Promise<AcademicSearchResult | null> {
  switch (source) {
    case "semantic_scholar":
      return getSemanticScholarPaper(externalId);
    case "openalex":
      return getOpenAlexWork(externalId);
    case "crossref":
      return getCrossRefWork(externalId);
    default:
      return null;
  }
}

/**
 * Normalize title for deduplication
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove duplicate results based on DOI or normalized title
 */
function deduplicateResults(results: AcademicSearchResult[]): AcademicSearchResult[] {
  const seen = new Map<string, AcademicSearchResult>();

  for (const result of results) {
    // Prefer DOI for deduplication
    if (result.doi) {
      const normalizedDoi = result.doi.toLowerCase();
      if (!seen.has(`doi:${normalizedDoi}`)) {
        seen.set(`doi:${normalizedDoi}`, result);
      }
      continue;
    }

    // Fall back to normalized title
    const normTitle = normalizeTitle(result.title);
    if (normTitle.length > 10) {
      const key = `title:${normTitle}`;
      if (!seen.has(key)) {
        seen.set(key, result);
      }
    } else {
      // Very short titles, keep them
      seen.set(`id:${result.source}:${result.externalId}`, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * Interleave results from different sources for better UX
 * This ensures users see variety rather than all results from one source
 */
function interleaveResults(
  results: AcademicSearchResult[],
  databases: string[]
): AcademicSearchResult[] {
  // Group by source
  const bySource = new Map<string, AcademicSearchResult[]>();
  for (const db of databases) {
    bySource.set(db, []);
  }

  for (const result of results) {
    const arr = bySource.get(result.source);
    if (arr) {
      arr.push(result);
    }
  }

  // Interleave
  const interleaved: AcademicSearchResult[] = [];
  const maxLen = Math.max(...Array.from(bySource.values()).map((arr) => arr.length));

  for (let i = 0; i < maxLen; i++) {
    for (const db of databases) {
      const arr = bySource.get(db);
      if (arr && arr[i]) {
        interleaved.push(arr[i]);
      }
    }
  }

  return interleaved;
}

/**
 * Convert search result to Source creation data
 */
export function searchResultToSourceData(result: AcademicSearchResult): {
  url: string;
  title: string;
  sourceType: string;
  authors: string[];
  publicationDate?: Date;
  doi?: string;
  venue?: string;
  abstract?: string;
  isOpenAccess?: boolean;
  citationCount?: number;
  externalIds?: Record<string, string>;
} {
  const externalIds: Record<string, string> = {
    [result.source]: result.externalId,
  };

  if (result.doi) externalIds.doi = result.doi;
  if (result.arxivId) externalIds.arxiv = result.arxivId;
  if (result.pmid) externalIds.pmid = result.pmid;
  if (result.pmcid) externalIds.pmcid = result.pmcid;

  return {
    url: result.doi
      ? `https://doi.org/${result.doi}`
      : result.url || `https://${result.source}.org/${result.externalId}`,
    title: result.title,
    sourceType: determineSourceType(result),
    authors: result.authors,
    publicationDate: result.publicationDate ? new Date(result.publicationDate) : undefined,
    doi: result.doi,
    venue: result.journal || result.venue,
    abstract: result.abstract,
    isOpenAccess: result.isOpenAccess,
    citationCount: result.citationCount,
    externalIds,
  };
}

/**
 * Determine source type from search result
 */
function determineSourceType(result: AcademicSearchResult): string {
  if (result.arxivId) return "preprint";
  if (result.journal) return "journal_article";
  if (result.venue?.toLowerCase().includes("conference")) return "conference_paper";
  if (result.venue?.toLowerCase().includes("workshop")) return "workshop_paper";
  return "academic_paper";
}
