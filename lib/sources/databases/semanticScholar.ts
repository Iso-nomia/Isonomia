/**
 * Semantic Scholar API Integration
 *
 * Semantic Scholar provides access to 200M+ academic papers with:
 * - Full-text search
 * - Citation/reference graphs
 * - Author information
 * - Paper embeddings for similarity
 *
 * API Docs: https://api.semanticscholar.org/api-docs/
 *
 * Rate limits:
 * - Without API key: 100 requests/5 minutes
 * - With API key: Much higher limits
 *
 * @module lib/sources/databases/semanticScholar
 */

import { AcademicSearchResult, normalizeTitle } from "../academicSearch";

const API_BASE = "https://api.semanticscholar.org/graph/v1";

// Optional API key for higher rate limits
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

interface SemanticScholarSearchResponse {
  total: number;
  offset: number;
  next?: number;
  data: SemanticScholarPaper[];
}

interface SemanticScholarPaper {
  paperId: string;
  externalIds?: {
    DOI?: string;
    ArXiv?: string;
    PubMed?: string;
    PubMedCentral?: string;
    MAG?: string;
    CorpusId?: number;
  };
  url?: string;
  title: string;
  abstract?: string;
  venue?: string;
  publicationVenue?: {
    id?: string;
    name?: string;
    type?: string;
    alternate_names?: string[];
    issn?: string;
    url?: string;
  };
  year?: number;
  referenceCount?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: {
    url?: string;
    status?: string;
  };
  fieldsOfStudy?: string[];
  s2FieldsOfStudy?: Array<{
    category: string;
    source: string;
  }>;
  publicationTypes?: string[];
  publicationDate?: string;
  journal?: {
    name?: string;
    pages?: string;
    volume?: string;
  };
  authors?: Array<{
    authorId?: string;
    name?: string;
  }>;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  yearFrom?: number;
  yearTo?: number;
  openAccessOnly?: boolean;
  fieldsOfStudy?: string[];
}

/**
 * Build headers for Semantic Scholar API
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Accept": "application/json",
    "User-Agent": "Mesh-App/1.0 (https://mesh.app)",
  };

  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  return headers;
}

/**
 * Search Semantic Scholar for papers
 */
export async function searchSemanticScholar(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: AcademicSearchResult[]; total: number }> {
  const { limit = 20, offset = 0, yearFrom, yearTo, openAccessOnly, fieldsOfStudy } = options;

  // Build search query with filters
  let searchQuery = query;
  if (yearFrom || yearTo) {
    searchQuery += ` year:${yearFrom || 1900}-${yearTo || new Date().getFullYear()}`;
  }

  const fields = [
    "paperId",
    "externalIds",
    "url",
    "title",
    "abstract",
    "venue",
    "publicationVenue",
    "year",
    "referenceCount",
    "citationCount",
    "influentialCitationCount",
    "isOpenAccess",
    "openAccessPdf",
    "fieldsOfStudy",
    "publicationTypes",
    "publicationDate",
    "journal",
    "authors",
  ].join(",");

  const params = new URLSearchParams({
    query: searchQuery,
    offset: String(offset),
    limit: String(limit),
    fields,
  });

  if (openAccessOnly) {
    params.set("openAccessPdf", "");
  }

  if (fieldsOfStudy && fieldsOfStudy.length > 0) {
    params.set("fieldsOfStudy", fieldsOfStudy.join(","));
  }

  const url = `${API_BASE}/paper/search?${params}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Semantic Scholar API error:", response.status, error);
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data: SemanticScholarSearchResponse = await response.json();

  const results = data.data.map(transformPaper);

  return {
    results,
    total: data.total,
  };
}

/**
 * Get a specific paper by ID
 */
export async function getSemanticScholarPaper(paperId: string): Promise<AcademicSearchResult | null> {
  const fields = [
    "paperId",
    "externalIds",
    "url",
    "title",
    "abstract",
    "venue",
    "publicationVenue",
    "year",
    "referenceCount",
    "citationCount",
    "influentialCitationCount",
    "isOpenAccess",
    "openAccessPdf",
    "fieldsOfStudy",
    "publicationTypes",
    "publicationDate",
    "journal",
    "authors",
  ].join(",");

  const url = `${API_BASE}/paper/${encodeURIComponent(paperId)}?fields=${fields}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const paper: SemanticScholarPaper = await response.json();
  return transformPaper(paper);
}

/**
 * Get paper by DOI
 */
export async function getSemanticScholarPaperByDOI(doi: string): Promise<AcademicSearchResult | null> {
  return getSemanticScholarPaper(`DOI:${doi}`);
}

/**
 * Get paper by arXiv ID
 */
export async function getSemanticScholarPaperByArxiv(arxivId: string): Promise<AcademicSearchResult | null> {
  return getSemanticScholarPaper(`ARXIV:${arxivId}`);
}

/**
 * Get recommendations for a paper
 */
export async function getSemanticScholarRecommendations(
  paperId: string,
  limit = 10
): Promise<AcademicSearchResult[]> {
  const fields = [
    "paperId",
    "externalIds",
    "url",
    "title",
    "abstract",
    "venue",
    "year",
    "citationCount",
    "isOpenAccess",
    "authors",
  ].join(",");

  const url = `${API_BASE}/recommendations/v1/papers/forpaper/${encodeURIComponent(paperId)}?fields=${fields}&limit=${limit}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.recommendedPapers || []).map(transformPaper);
}

/**
 * Get citations for a paper
 */
export async function getSemanticScholarCitations(
  paperId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<{ citations: AcademicSearchResult[]; total: number }> {
  const { offset = 0, limit = 20 } = options;

  const fields = [
    "paperId",
    "externalIds",
    "title",
    "abstract",
    "venue",
    "year",
    "citationCount",
    "authors",
  ].join(",");

  const url = `${API_BASE}/paper/${encodeURIComponent(paperId)}/citations?fields=${fields}&offset=${offset}&limit=${limit}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    return { citations: [], total: 0 };
  }

  const data = await response.json();

  return {
    citations: (data.data || []).map((item: { citingPaper: SemanticScholarPaper }) =>
      transformPaper(item.citingPaper)
    ),
    total: data.total || 0,
  };
}

/**
 * Get references for a paper
 */
export async function getSemanticScholarReferences(
  paperId: string,
  options: { offset?: number; limit?: number } = {}
): Promise<{ references: AcademicSearchResult[]; total: number }> {
  const { offset = 0, limit = 20 } = options;

  const fields = [
    "paperId",
    "externalIds",
    "title",
    "abstract",
    "venue",
    "year",
    "citationCount",
    "authors",
  ].join(",");

  const url = `${API_BASE}/paper/${encodeURIComponent(paperId)}/references?fields=${fields}&offset=${offset}&limit=${limit}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    return { references: [], total: 0 };
  }

  const data = await response.json();

  return {
    references: (data.data || []).map((item: { citedPaper: SemanticScholarPaper }) =>
      transformPaper(item.citedPaper)
    ),
    total: data.total || 0,
  };
}

/**
 * Transform Semantic Scholar paper to standard format
 */
function transformPaper(paper: SemanticScholarPaper): AcademicSearchResult {
  return {
    externalId: paper.paperId,
    source: "semantic_scholar",
    title: paper.title || "Untitled",
    authors: (paper.authors || []).map((a) => a.name || "Unknown").filter(Boolean),
    abstract: paper.abstract,
    publicationDate: paper.publicationDate,
    year: paper.year,
    doi: paper.externalIds?.DOI,
    arxivId: paper.externalIds?.ArXiv,
    pmid: paper.externalIds?.PubMed,
    pmcid: paper.externalIds?.PubMedCentral,
    venue: paper.publicationVenue?.name || paper.venue,
    journal: paper.journal?.name,
    volume: paper.journal?.volume,
    pages: paper.journal?.pages,
    url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
    pdfUrl: paper.openAccessPdf?.url,
    isOpenAccess: paper.isOpenAccess,
    citationCount: paper.citationCount,
    influentialCitationCount: paper.influentialCitationCount,
    referenceCount: paper.referenceCount,
    normalizedTitle: normalizeTitle(paper.title || ""),
    rawData: paper as unknown as Record<string, unknown>,
  };
}
