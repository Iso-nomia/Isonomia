/**
 * CrossRef API Integration
 *
 * CrossRef provides access to 140M+ DOIs with:
 * - Metadata for journal articles, books, conference papers
 * - Citation linking
 * - Reference lists
 * - Funder information
 *
 * API Docs: https://api.crossref.org/swagger-ui/index.html
 *
 * Rate limits:
 * - Without polite pool: 50 requests/second
 * - With polite pool (add email): Higher limits, priority
 *
 * @module lib/sources/databases/crossref
 */

import { AcademicSearchResult, normalizeTitle } from "../academicSearch";

const API_BASE = "https://api.crossref.org";

// Optional email for polite pool
const POLITE_EMAIL = process.env.CROSSREF_POLITE_EMAIL;

interface CrossRefSearchResponse {
  status: string;
  "message-type": string;
  "message-version": string;
  message: {
    "total-results": number;
    items: CrossRefWork[];
    "items-per-page": number;
    query: {
      "start-index": number;
      "search-terms": string;
    };
  };
}

interface CrossRefWorkResponse {
  status: string;
  "message-type": string;
  message: CrossRefWork;
}

interface CrossRefWork {
  DOI: string;
  type?: string;
  title?: string[];
  "container-title"?: string[];
  "short-container-title"?: string[];
  publisher?: string;
  abstract?: string;
  author?: Array<{
    given?: string;
    family?: string;
    name?: string;
    sequence?: string;
    affiliation?: Array<{ name?: string }>;
    ORCID?: string;
  }>;
  published?: {
    "date-parts"?: number[][];
  };
  "published-print"?: {
    "date-parts"?: number[][];
  };
  "published-online"?: {
    "date-parts"?: number[][];
  };
  created?: {
    "date-parts"?: number[][];
    "date-time"?: string;
  };
  issued?: {
    "date-parts"?: number[][];
  };
  volume?: string;
  issue?: string;
  page?: string;
  "article-number"?: string;
  URL?: string;
  link?: Array<{
    URL?: string;
    "content-type"?: string;
    "intended-application"?: string;
  }>;
  "is-referenced-by-count"?: number;
  "references-count"?: number;
  reference?: Array<{
    key?: string;
    DOI?: string;
    "article-title"?: string;
    author?: string;
    year?: string;
    "journal-title"?: string;
    volume?: string;
    "first-page"?: string;
  }>;
  ISSN?: string[];
  ISBN?: string[];
  subject?: string[];
  license?: Array<{
    URL?: string;
    start?: {
      "date-parts"?: number[][];
    };
    "content-version"?: string;
    "delay-in-days"?: number;
  }>;
  funder?: Array<{
    DOI?: string;
    name?: string;
    "doi-asserted-by"?: string;
    award?: string[];
  }>;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  yearFrom?: number;
  yearTo?: number;
  type?: string;
  sort?: "relevance" | "published" | "indexed";
  order?: "asc" | "desc";
}

/**
 * Build headers for CrossRef API
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Accept": "application/json",
    "User-Agent": POLITE_EMAIL
      ? `Mesh-App/1.0 (https://mesh.app; mailto:${POLITE_EMAIL})`
      : "Mesh-App/1.0 (https://mesh.app)",
  };
  return headers;
}

/**
 * Search CrossRef for works
 */
export async function searchCrossRef(
  query: string,
  options: SearchOptions = {}
): Promise<{ results: AcademicSearchResult[]; total: number }> {
  const { limit = 20, offset = 0, yearFrom, yearTo, type, sort = "relevance", order = "desc" } = options;

  const params = new URLSearchParams({
    query,
    rows: String(limit),
    offset: String(offset),
    sort: sort === "relevance" ? "score" : sort === "published" ? "published" : "indexed",
    order,
  });

  // Add email for polite pool
  if (POLITE_EMAIL) {
    params.set("mailto", POLITE_EMAIL);
  }

  // Add filters
  const filters: string[] = [];

  if (yearFrom) {
    filters.push(`from-pub-date:${yearFrom}`);
  }
  if (yearTo) {
    filters.push(`until-pub-date:${yearTo}`);
  }
  if (type) {
    filters.push(`type:${type}`);
  }

  if (filters.length > 0) {
    params.set("filter", filters.join(","));
  }

  const url = `${API_BASE}/works?${params}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("CrossRef API error:", response.status, error);
    throw new Error(`CrossRef API error: ${response.status}`);
  }

  const data: CrossRefSearchResponse = await response.json();

  const results = data.message.items.map(transformWork);

  return {
    results,
    total: data.message["total-results"],
  };
}

/**
 * Get a specific work by DOI
 */
export async function getCrossRefWork(doi: string): Promise<AcademicSearchResult | null> {
  // Clean DOI
  const cleanDoi = doi
    .replace(/^https?:\/\/doi\.org\//, "")
    .replace(/^doi:/, "");

  const params = new URLSearchParams();
  if (POLITE_EMAIL) {
    params.set("mailto", POLITE_EMAIL);
  }

  const url = `${API_BASE}/works/${encodeURIComponent(cleanDoi)}?${params}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`CrossRef API error: ${response.status}`);
  }

  const data: CrossRefWorkResponse = await response.json();
  return transformWork(data.message);
}

/**
 * Get multiple works by DOIs
 */
export async function getCrossRefWorksByDOIs(dois: string[]): Promise<AcademicSearchResult[]> {
  // CrossRef doesn't have batch endpoint, so we fetch in parallel with concurrency limit
  const results: AcademicSearchResult[] = [];
  const concurrency = 5;

  for (let i = 0; i < dois.length; i += concurrency) {
    const batch = dois.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((doi) =>
        getCrossRefWork(doi).catch(() => null)
      )
    );
    results.push(...batchResults.filter((r): r is AcademicSearchResult => r !== null));
  }

  return results;
}

/**
 * Get references for a work
 */
export async function getCrossRefReferences(doi: string): Promise<AcademicSearchResult[]> {
  const work = await getCrossRefWork(doi);
  if (!work || !work.rawData) {
    return [];
  }

  const rawWork = work.rawData as unknown as CrossRefWork;
  const references = rawWork.reference || [];

  // Extract DOIs from references and fetch them
  const referenceDOIs = references
    .map((ref) => ref.DOI)
    .filter((d): d is string => !!d);

  if (referenceDOIs.length === 0) {
    // Return basic reference info without full metadata
    return references.map((ref, index) => ({
      externalId: ref.key || `ref-${index}`,
      source: "crossref" as const,
      title: ref["article-title"] || "Unknown Title",
      authors: ref.author ? [ref.author] : [],
      year: ref.year ? parseInt(ref.year, 10) : undefined,
      venue: ref["journal-title"],
      volume: ref.volume,
      pages: ref["first-page"],
      doi: ref.DOI,
    }));
  }

  return getCrossRefWorksByDOIs(referenceDOIs);
}

/**
 * Search by DOI prefix (useful for finding all works from a publisher)
 */
export async function searchByPrefix(
  prefix: string,
  options: SearchOptions = {}
): Promise<{ results: AcademicSearchResult[]; total: number }> {
  const { limit = 20, offset = 0 } = options;

  const params = new URLSearchParams({
    rows: String(limit),
    offset: String(offset),
  });

  if (POLITE_EMAIL) {
    params.set("mailto", POLITE_EMAIL);
  }

  const url = `${API_BASE}/prefixes/${encodeURIComponent(prefix)}/works?${params}`;

  const response = await fetch(url, {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`CrossRef API error: ${response.status}`);
  }

  const data: CrossRefSearchResponse = await response.json();

  return {
    results: data.message.items.map(transformWork),
    total: data.message["total-results"],
  };
}

/**
 * Get publication date from CrossRef date parts
 */
function getPublicationDate(work: CrossRefWork): { date?: string; year?: number } {
  const dateParts =
    work.published?.["date-parts"]?.[0] ||
    work["published-print"]?.["date-parts"]?.[0] ||
    work["published-online"]?.["date-parts"]?.[0] ||
    work.issued?.["date-parts"]?.[0] ||
    work.created?.["date-parts"]?.[0];

  if (!dateParts || dateParts.length === 0) {
    return {};
  }

  const [year, month, day] = dateParts;

  let date: string | undefined;
  if (year && month && day) {
    date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  } else if (year && month) {
    date = `${year}-${String(month).padStart(2, "0")}`;
  } else if (year) {
    date = String(year);
  }

  return { date, year };
}

/**
 * Get authors from CrossRef format
 */
function getAuthors(work: CrossRefWork): string[] {
  if (!work.author) return [];

  return work.author
    .map((a) => {
      if (a.name) return a.name;
      if (a.family && a.given) return `${a.given} ${a.family}`;
      if (a.family) return a.family;
      return null;
    })
    .filter((a): a is string => a !== null);
}

/**
 * Check if work is open access based on license
 */
function isOpenAccess(work: CrossRefWork): boolean {
  if (!work.license) return false;

  const openLicensePatterns = [
    "creativecommons.org",
    "cc-by",
    "cc0",
    "public-domain",
  ];

  return work.license.some((license) =>
    openLicensePatterns.some((pattern) =>
      license.URL?.toLowerCase().includes(pattern)
    )
  );
}

/**
 * Get PDF URL from links
 */
function getPdfUrl(work: CrossRefWork): string | undefined {
  if (!work.link) return undefined;

  const pdfLink = work.link.find(
    (l) =>
      l["content-type"]?.includes("pdf") ||
      l["intended-application"] === "text-mining" ||
      l.URL?.endsWith(".pdf")
  );

  return pdfLink?.URL;
}

/**
 * Transform CrossRef work to standard format
 */
function transformWork(work: CrossRefWork): AcademicSearchResult {
  const { date, year } = getPublicationDate(work);

  return {
    externalId: work.DOI,
    source: "crossref",
    title: work.title?.[0] || "Untitled",
    authors: getAuthors(work),
    abstract: work.abstract?.replace(/<[^>]*>/g, ""), // Strip HTML tags
    publicationDate: date,
    year,
    doi: work.DOI,
    venue: work["container-title"]?.[0],
    journal: work["container-title"]?.[0],
    publisher: work.publisher,
    volume: work.volume,
    issue: work.issue,
    pages: work.page || work["article-number"],
    url: work.URL || `https://doi.org/${work.DOI}`,
    pdfUrl: getPdfUrl(work),
    isOpenAccess: isOpenAccess(work),
    citationCount: work["is-referenced-by-count"],
    referenceCount: work["references-count"],
    normalizedTitle: normalizeTitle(work.title?.[0] || ""),
    rawData: work as unknown as Record<string, unknown>,
  };
}
