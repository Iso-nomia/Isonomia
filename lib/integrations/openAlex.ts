/**
 * OpenAlex API integration for paper enrichment
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * API Docs: https://docs.openalex.org/
 * Free API with polite pool via mailto parameter (100K requests/day)
 */

const OPENALEX_BASE = "https://api.openalex.org";
const OPENALEX_EMAIL =
  process.env.OPENALEX_POLITE_EMAIL ||
  process.env.OPENALEX_EMAIL ||
  "contact@mesh.app";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface OpenAlexAuthor {
  id: string;
  display_name: string;
  orcid?: string;
}

interface OpenAlexInstitution {
  id: string;
  display_name: string;
  ror?: string;
  country_code?: string;
  type?: string;
}

interface OpenAlexAuthorship {
  author: OpenAlexAuthor;
  institutions: OpenAlexInstitution[];
  author_position: string;
  is_corresponding?: boolean;
}

interface OpenAlexConcept {
  id: string;
  wikidata?: string;
  display_name: string;
  level: number;
  score: number;
}

interface OpenAlexLocation {
  is_oa?: boolean;
  landing_page_url?: string;
  pdf_url?: string;
  source?: {
    id: string;
    display_name: string;
    issn_l?: string;
    type?: string;
  };
  license?: string;
  version?: string;
}

interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  display_name: string;
  abstract_inverted_index?: Record<string, number[]>;
  authorships: OpenAlexAuthorship[];
  concepts: OpenAlexConcept[];
  topics?: Array<{
    id: string;
    display_name: string;
    score: number;
  }>;
  cited_by_count: number;
  publication_date?: string;
  publication_year?: number;
  type?: string;
  primary_location?: OpenAlexLocation;
  locations?: OpenAlexLocation[];
  open_access?: {
    is_oa: boolean;
    oa_status?: string;
    oa_url?: string;
  };
  referenced_works?: string[];
  related_works?: string[];
}

interface OpenAlexSearchResponse {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: OpenAlexWork[];
}

export interface OpenAlexEnrichment {
  openAlexId: string;
  abstract?: string;
  concepts: string[];
  topics: string[];
  citedByCount: number;
  authorInstitutions: Map<string, string[]>;
  isOpenAccess: boolean;
  oaUrl?: string;
  pdfUrl?: string;
  relatedWorkIds: string[];
  referencedWorkIds: string[];
}

// ─────────────────────────────────────────────────────────
// Enrichment by DOI
// ─────────────────────────────────────────────────────────

/**
 * Enrich a source with additional metadata from OpenAlex
 * 
 * @param doi - The DOI to look up
 * @returns Enrichment data or null if not found
 */
export async function enrichFromOpenAlex(
  doi: string
): Promise<OpenAlexEnrichment | null> {
  try {
    // OpenAlex accepts DOI URLs as identifiers
    const encodedDOI = encodeURIComponent(`https://doi.org/${doi}`);
    const response = await fetch(
      `${OPENALEX_BASE}/works/${encodedDOI}?mailto=${OPENALEX_EMAIL}`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`DOI not found in OpenAlex: ${doi}`);
      } else {
        console.error(`OpenAlex API error: ${response.status}`);
      }
      return null;
    }

    const work: OpenAlexWork = await response.json();
    return mapOpenAlexEnrichment(work);
  } catch (error) {
    console.error("OpenAlex enrichment failed:", error);
    return null;
  }
}

/**
 * Get work data from OpenAlex by its native ID
 */
export async function getOpenAlexWork(
  openAlexId: string
): Promise<OpenAlexWork | null> {
  try {
    // Handle both full URLs and short IDs
    const id = openAlexId.includes("openalex.org")
      ? openAlexId
      : `https://openalex.org/${openAlexId}`;
    
    const response = await fetch(
      `${OPENALEX_BASE}/works/${encodeURIComponent(id)}?mailto=${OPENALEX_EMAIL}`
    );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("OpenAlex work fetch failed:", error);
    return null;
  }
}

/**
 * Map OpenAlex work data to enrichment format
 */
function mapOpenAlexEnrichment(work: OpenAlexWork): OpenAlexEnrichment {
  // Reconstruct abstract from inverted index
  const abstract = reconstructAbstract(work.abstract_inverted_index);

  // Extract high-level concepts (level 0-1, score > 0.3)
  const concepts = work.concepts
    .filter((c) => c.level <= 1 && c.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.display_name);

  // Extract topics
  const topics = (work.topics || [])
    .filter((t) => t.score > 0.5)
    .map((t) => t.display_name);

  // Map authors to institutions
  const authorInstitutions = new Map<string, string[]>();
  for (const authorship of work.authorships) {
    const name = authorship.author.display_name;
    const institutions = authorship.institutions.map((i) => i.display_name);
    authorInstitutions.set(name, institutions);
  }

  // Find PDF URL from locations
  let pdfUrl: string | undefined;
  const allLocations = [work.primary_location, ...(work.locations || [])].filter(Boolean);
  for (const location of allLocations) {
    if (location?.pdf_url) {
      pdfUrl = location.pdf_url;
      break;
    }
  }

  return {
    openAlexId: work.id.replace("https://openalex.org/", ""),
    abstract,
    concepts,
    topics,
    citedByCount: work.cited_by_count,
    authorInstitutions,
    isOpenAccess: work.open_access?.is_oa || false,
    oaUrl: work.open_access?.oa_url,
    pdfUrl,
    relatedWorkIds: (work.related_works || []).slice(0, 10).map(extractOpenAlexId),
    referencedWorkIds: (work.referenced_works || []).slice(0, 50).map(extractOpenAlexId),
  };
}

/**
 * Reconstruct abstract text from OpenAlex's inverted index format
 * 
 * OpenAlex stores abstracts as inverted indices: { "word": [positions] }
 */
function reconstructAbstract(
  invertedIndex?: Record<string, number[]>
): string | undefined {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return undefined;
  }

  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  
  words.sort((a, b) => a[1] - b[1]);
  return words.map((w) => w[0]).join(" ");
}

/**
 * Extract short ID from full OpenAlex URL
 */
function extractOpenAlexId(url: string): string {
  return url.replace("https://openalex.org/", "");
}

// ─────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────

/**
 * Search OpenAlex for works by title or other text
 * 
 * @param query - Search query string
 * @param limit - Maximum number of results (default 10)
 * @returns Array of matching works
 */
export async function searchOpenAlex(
  query: string,
  limit = 10
): Promise<OpenAlexWork[]> {
  try {
    const params = new URLSearchParams({
      search: query,
      per_page: limit.toString(),
      mailto: OPENALEX_EMAIL,
    });

    const response = await fetch(
      `${OPENALEX_BASE}/works?${params.toString()}`
    );

    if (!response.ok) {
      console.error(`OpenAlex search error: ${response.status}`);
      return [];
    }

    const data: OpenAlexSearchResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("OpenAlex search failed:", error);
    return [];
  }
}

/**
 * Search for works by author ORCID
 */
export async function searchByOrcid(
  orcid: string,
  limit = 25
): Promise<OpenAlexWork[]> {
  try {
    // Normalize ORCID format
    const normalizedOrcid = orcid.replace(/^https?:\/\/orcid\.org\//, "");
    
    const params = new URLSearchParams({
      filter: `author.orcid:${normalizedOrcid}`,
      per_page: limit.toString(),
      sort: "publication_year:desc",
      mailto: OPENALEX_EMAIL,
    });

    const response = await fetch(
      `${OPENALEX_BASE}/works?${params.toString()}`
    );

    if (!response.ok) return [];

    const data: OpenAlexSearchResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("OpenAlex ORCID search failed:", error);
    return [];
  }
}

/**
 * Search for works in a specific venue/journal
 */
export async function searchByVenue(
  issn: string,
  limit = 25
): Promise<OpenAlexWork[]> {
  try {
    const params = new URLSearchParams({
      filter: `primary_location.source.issn:${issn}`,
      per_page: limit.toString(),
      sort: "publication_year:desc",
      mailto: OPENALEX_EMAIL,
    });

    const response = await fetch(
      `${OPENALEX_BASE}/works?${params.toString()}`
    );

    if (!response.ok) return [];

    const data: OpenAlexSearchResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("OpenAlex venue search failed:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// Related Works
// ─────────────────────────────────────────────────────────

/**
 * Get citing works for a given DOI
 * 
 * @param doi - DOI of the work to find citations for
 * @param limit - Maximum number of results
 */
export async function getCitingWorks(
  doi: string,
  limit = 20
): Promise<OpenAlexWork[]> {
  try {
    const params = new URLSearchParams({
      filter: `cites:https://doi.org/${doi}`,
      per_page: limit.toString(),
      sort: "cited_by_count:desc",
      mailto: OPENALEX_EMAIL,
    });

    const response = await fetch(
      `${OPENALEX_BASE}/works?${params.toString()}`
    );

    if (!response.ok) return [];

    const data: OpenAlexSearchResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("OpenAlex citing works search failed:", error);
    return [];
  }
}

/**
 * Get semantically similar works using OpenAlex's related_works
 * 
 * @param openAlexId - OpenAlex work ID
 * @param limit - Maximum number of related works to fetch details for
 */
export async function getRelatedWorks(
  openAlexId: string,
  limit = 10
): Promise<OpenAlexWork[]> {
  try {
    // First get the work to find related work IDs
    const work = await getOpenAlexWork(openAlexId);
    if (!work?.related_works?.length) return [];

    // Fetch details for related works (batch by filter)
    const relatedIds = work.related_works.slice(0, limit);
    const filterValue = relatedIds.map((id) => id.replace("https://openalex.org/", "")).join("|");
    
    const params = new URLSearchParams({
      filter: `openalex_id:${filterValue}`,
      per_page: limit.toString(),
      mailto: OPENALEX_EMAIL,
    });

    const response = await fetch(
      `${OPENALEX_BASE}/works?${params.toString()}`
    );

    if (!response.ok) return [];

    const data: OpenAlexSearchResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("OpenAlex related works fetch failed:", error);
    return [];
  }
}
