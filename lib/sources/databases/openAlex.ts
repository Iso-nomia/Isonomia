/**
 * OpenAlex API Integration
 *
 * OpenAlex provides access to 250M+ academic works with:
 * - Full-text search
 * - Structured metadata
 * - Author/institution data
 * - Concept tagging
 * - Open access status
 *
 * API Docs: https://docs.openalex.org/
 *
 * Rate limits:
 * - 10 requests/second per user (polite pool with email gets higher)
 * - Add email parameter for polite pool
 *
 * @module lib/sources/databases/openAlex
 */

import { AcademicSearchResult, normalizeTitle } from "../academicSearch";

const API_BASE = "https://api.openalex.org";

// Optional email for polite pool (higher rate limits)
const POLITE_EMAIL = process.env.OPENALEX_POLITE_EMAIL;

interface OpenAlexSearchResponse {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

interface OpenAlexWork {
  id: string;
  doi?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  publication_date?: string;
  type?: string;
  type_crossref?: string;
  open_access?: {
    is_oa?: boolean;
    oa_status?: string;
    oa_url?: string;
    any_repository_has_fulltext?: boolean;
  };
  authorships?: Array<{
    author_position?: string;
    author?: {
      id?: string;
      display_name?: string;
      orcid?: string;
    };
    institutions?: Array<{
      id?: string;
      display_name?: string;
      country_code?: string;
    }>;
    raw_author_name?: string;
  }>;
  primary_location?: {
    source?: {
      id?: string;
      display_name?: string;
      issn_l?: string;
      type?: string;
      host_organization?: string;
    };
    landing_page_url?: string;
    pdf_url?: string;
    is_oa?: boolean;
  };
  locations?: Array<{
    source?: {
      id?: string;
      display_name?: string;
      type?: string;
    };
    landing_page_url?: string;
    pdf_url?: string;
    is_oa?: boolean;
  }>;
  best_oa_location?: {
    landing_page_url?: string;
    pdf_url?: string;
    is_oa?: boolean;
  };
  biblio?: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  cited_by_count?: number;
  referenced_works_count?: number;
  concepts?: Array<{
    id?: string;
    wikidata?: string;
    display_name?: string;
    level?: number;
    score?: number;
  }>;
  ids?: {
    openalex?: string;
    doi?: string;
    pmid?: string;
    pmcid?: string;
    mag?: string;
  };
  abstract_inverted_index?: Record<string, number[]>;
  grants?: Array<{
    funder?: string;
    award_id?: string;
  }>;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  yearFrom?: number;
  yearTo?: number;
  openAccessOnly?: boolean;
  type?: string;
}

/**
 * Build URL with polite email parameter
 */
function buildUrl(path: string, params: URLSearchParams): string {
  if (POLITE_EMAIL) {
    params.set("mailto", POLITE_EMAIL);
  }
  return `${API_BASE}${path}?${params}`;
}

/**
 * Search OpenAlex for works
 */
export async function searchOpenAlex(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: AcademicSearchResult[]; total: number }> {
  const { limit = 20, offset = 0, yearFrom, yearTo, openAccessOnly, type } = options;

  // Calculate page from offset
  const page = Math.floor(offset / limit) + 1;

  const params = new URLSearchParams({
    search: query,
    page: String(page),
    per_page: String(limit),
  });

  // Build filter string
  const filters: string[] = [];

  if (yearFrom && yearTo) {
    filters.push(`publication_year:${yearFrom}-${yearTo}`);
  } else if (yearFrom) {
    filters.push(`publication_year:>${yearFrom - 1}`);
  } else if (yearTo) {
    filters.push(`publication_year:<${yearTo + 1}`);
  }

  if (openAccessOnly) {
    filters.push("open_access.is_oa:true");
  }

  if (type) {
    filters.push(`type:${type}`);
  }

  if (filters.length > 0) {
    params.set("filter", filters.join(","));
  }

  const url = buildUrl("/works", params);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mesh-App/1.0 (https://mesh.app; mailto:support@mesh.app)",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("OpenAlex API error:", response.status, error);
    throw new Error(`OpenAlex API error: ${response.status}`);
  }

  const data: OpenAlexSearchResponse = await response.json();

  const results = data.results.map(transformWork);

  return {
    results,
    total: data.meta.count,
  };
}

/**
 * Get a specific work by OpenAlex ID or DOI
 */
export async function getOpenAlexWork(id: string): Promise<AcademicSearchResult | null> {
  // ID can be full URL or short form
  let workId = id;

  // Handle DOI lookup
  if (id.startsWith("10.") || id.includes("doi.org")) {
    const doi = id.replace(/^https?:\/\/doi\.org\//, "");
    workId = `https://doi.org/${doi}`;
  }

  // Handle OpenAlex ID
  if (id.startsWith("W")) {
    workId = `https://openalex.org/${id}`;
  }

  const params = new URLSearchParams();
  const url = buildUrl(`/works/${encodeURIComponent(workId)}`, params);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mesh-App/1.0 (https://mesh.app; mailto:support@mesh.app)",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`OpenAlex API error: ${response.status}`);
  }

  const work: OpenAlexWork = await response.json();
  return transformWork(work);
}

/**
 * Get works by DOI
 */
export async function getOpenAlexWorkByDOI(doi: string): Promise<AcademicSearchResult | null> {
  return getOpenAlexWork(`https://doi.org/${doi}`);
}

/**
 * Get citations for a work
 */
export async function getOpenAlexCitations(
  workId: string,
  options: { page?: number; perPage?: number } = {}
): Promise<{ citations: AcademicSearchResult[]; total: number }> {
  const { page = 1, perPage = 20 } = options;

  // Extract the short ID if full URL provided
  const shortId = workId.replace("https://openalex.org/", "");

  const params = new URLSearchParams({
    filter: `cites:${shortId}`,
    page: String(page),
    per_page: String(perPage),
  });

  const url = buildUrl("/works", params);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mesh-App/1.0 (https://mesh.app; mailto:support@mesh.app)",
    },
  });

  if (!response.ok) {
    return { citations: [], total: 0 };
  }

  const data: OpenAlexSearchResponse = await response.json();

  return {
    citations: data.results.map(transformWork),
    total: data.meta.count,
  };
}

/**
 * Get references for a work
 */
export async function getOpenAlexReferences(
  workId: string,
  options: { page?: number; perPage?: number } = {}
): Promise<{ references: AcademicSearchResult[]; total: number }> {
  const { page = 1, perPage = 20 } = options;

  // First get the work to find referenced_works
  const work = await getOpenAlexWork(workId);
  if (!work || !work.rawData) {
    return { references: [], total: 0 };
  }

  // OpenAlex includes referenced_works in the work object
  // We need to fetch those works
  const rawWork = work.rawData as unknown as OpenAlexWork & { referenced_works?: string[] };
  const referencedWorkIds = rawWork.referenced_works || [];

  if (referencedWorkIds.length === 0) {
    return { references: [], total: 0 };
  }

  // Fetch referenced works in batches
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const idsToFetch = referencedWorkIds.slice(start, end);

  if (idsToFetch.length === 0) {
    return { references: [], total: referencedWorkIds.length };
  }

  // Use filter to fetch multiple works at once
  const params = new URLSearchParams({
    filter: `openalex:${idsToFetch.join("|")}`,
    per_page: String(perPage),
  });

  const url = buildUrl("/works", params);

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mesh-App/1.0 (https://mesh.app; mailto:support@mesh.app)",
    },
  });

  if (!response.ok) {
    return { references: [], total: referencedWorkIds.length };
  }

  const data: OpenAlexSearchResponse = await response.json();

  return {
    references: data.results.map(transformWork),
    total: referencedWorkIds.length,
  };
}

/**
 * Reconstruct abstract from inverted index
 */
function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string | undefined {
  if (!invertedIndex) return undefined;

  // Find the max position
  let maxPos = 0;
  for (const positions of Object.values(invertedIndex)) {
    for (const pos of positions) {
      if (pos > maxPos) maxPos = pos;
    }
  }

  // Build abstract array
  const words: string[] = new Array(maxPos + 1).fill("");
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }

  return words.join(" ").trim();
}

/**
 * Transform OpenAlex work to standard format
 */
function transformWork(work: OpenAlexWork): AcademicSearchResult {
  // Extract OpenAlex short ID from full URL
  const openAlexId = work.id?.replace("https://openalex.org/", "") || "";

  // Extract authors
  const authors = (work.authorships || [])
    .map((a) => a.author?.display_name || a.raw_author_name)
    .filter(Boolean) as string[];

  // Get best PDF URL
  const pdfUrl =
    work.best_oa_location?.pdf_url ||
    work.primary_location?.pdf_url ||
    work.locations?.find((l) => l.pdf_url)?.pdf_url;

  // Get landing page URL
  const url =
    work.primary_location?.landing_page_url ||
    work.best_oa_location?.landing_page_url ||
    (work.doi ? `https://doi.org/${work.doi.replace("https://doi.org/", "")}` : undefined);

  // Get pages
  const pages =
    work.biblio?.first_page && work.biblio?.last_page
      ? `${work.biblio.first_page}-${work.biblio.last_page}`
      : work.biblio?.first_page;

  // Extract clean DOI
  const doi = work.doi?.replace("https://doi.org/", "");

  return {
    externalId: openAlexId,
    source: "openalex",
    title: work.display_name || work.title || "Untitled",
    authors,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    publicationDate: work.publication_date,
    year: work.publication_year,
    doi,
    pmid: work.ids?.pmid?.replace("https://pubmed.ncbi.nlm.nih.gov/", ""),
    pmcid: work.ids?.pmcid?.replace("https://www.ncbi.nlm.nih.gov/pmc/articles/", ""),
    venue: work.primary_location?.source?.display_name,
    journal: work.primary_location?.source?.type === "journal"
      ? work.primary_location?.source?.display_name
      : undefined,
    volume: work.biblio?.volume,
    issue: work.biblio?.issue,
    pages,
    url,
    pdfUrl,
    isOpenAccess: work.open_access?.is_oa,
    citationCount: work.cited_by_count,
    referenceCount: work.referenced_works_count,
    normalizedTitle: normalizeTitle(work.display_name || work.title || ""),
    rawData: work as unknown as Record<string, unknown>,
  };
}
