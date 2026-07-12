/**
 * Crossref API integration for DOI resolution
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * API Docs: https://api.crossref.org/swagger-ui/index.html
 * Polite Pool: Include mailto parameter for higher rate limits (50 req/s)
 */

import { SourceIdentifierType } from "@prisma/client";

const CROSSREF_BASE = "https://api.crossref.org/works";
const POLITE_POOL_EMAIL =
  process.env.CROSSREF_POLITE_EMAIL ||
  process.env.CROSSREF_EMAIL ||
  "contact@mesh.app";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface CrossrefAuthor {
  given?: string;
  family?: string;
  ORCID?: string;
  sequence?: string;
  affiliation?: Array<{ name: string }>;
}

interface CrossrefWork {
  DOI: string;
  title: string[];
  author?: CrossrefAuthor[];
  published?: {
    "date-parts": number[][];
  };
  "published-print"?: {
    "date-parts": number[][];
  };
  "published-online"?: {
    "date-parts": number[][];
  };
  abstract?: string;
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  subject?: string[];
  URL?: string;
  type?: string;
  link?: Array<{
    URL: string;
    "content-type"?: string;
    "intended-application"?: string;
  }>;
}

interface CrossrefResponse {
  status: string;
  "message-type": string;
  message: CrossrefWork;
}

export interface ResolvedSource {
  identifier: string;
  identifierType: SourceIdentifierType;
  title: string;
  authorsJson: Array<{ family?: string; given?: string; orcid?: string }>;
  authorOrcids: string[];
  year?: number;
  abstractText?: string;
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  keywords: string[];
  url?: string;
  kind: string;
  pdfUrl?: string;
}

// ─────────────────────────────────────────────────────────
// DOI Normalization
// ─────────────────────────────────────────────────────────

/**
 * Normalize various DOI input formats to a clean DOI string
 * 
 * Handles:
 * - Raw DOI: 10.1234/abc
 * - doi: prefix: doi:10.1234/abc
 * - doi.org URL: https://doi.org/10.1234/abc
 * - dx.doi.org URL: http://dx.doi.org/10.1234/abc
 */
export function normalizeDOI(input: string): string | null {
  const cleaned = input.trim();
  
  const patterns = [
    /^(10\.\d{4,}\/[^\s]+)$/,                              // Raw DOI
    /^doi:(10\.\d{4,}\/[^\s]+)$/i,                         // doi: prefix
    /^https?:\/\/doi\.org\/(10\.\d{4,}\/[^\s]+)$/i,        // doi.org URL
    /^https?:\/\/dx\.doi\.org\/(10\.\d{4,}\/[^\s]+)$/i,    // dx.doi.org URL
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validate if a string is a valid DOI format
 */
export function isValidDOI(input: string): boolean {
  return normalizeDOI(input) !== null;
}

// ─────────────────────────────────────────────────────────
// DOI Resolution
// ─────────────────────────────────────────────────────────

/**
 * Resolve a DOI to source metadata via Crossref API
 * 
 * @param doi - DOI in any common format
 * @returns Resolved source data or null if resolution fails
 */
export async function resolveDOI(doi: string): Promise<ResolvedSource | null> {
  const normalizedDOI = normalizeDOI(doi);
  if (!normalizedDOI) {
    console.warn(`Invalid DOI format: ${doi}`);
    return null;
  }

  try {
    const response = await fetch(
      `${CROSSREF_BASE}/${encodeURIComponent(normalizedDOI)}`,
      {
        headers: {
          "User-Agent": `MeshApp/1.0 (mailto:${POLITE_POOL_EMAIL})`,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`DOI not found in Crossref: ${normalizedDOI}`);
      } else {
        console.error(`Crossref API error: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const data: CrossrefResponse = await response.json();
    return mapCrossrefToSource(data.message);
  } catch (error) {
    console.error("DOI resolution failed:", error);
    return null;
  }
}

/**
 * Map Crossref work data to our Source model format
 */
function mapCrossrefToSource(work: CrossrefWork): ResolvedSource {
  // Build authors array
  const authorsJson = (work.author || []).map((a) => ({
    family: a.family,
    given: a.given,
    orcid: a.ORCID ? a.ORCID.replace(/^https?:\/\/orcid\.org\//, "") : undefined,
  }));

  // Extract ORCIDs
  const authorOrcids = authorsJson
    .filter((a) => a.orcid)
    .map((a) => a.orcid!);

  // Parse publication date
  const dateSource = work.published || work["published-print"] || work["published-online"];
  let year: number | undefined;
  if (dateSource?.["date-parts"]?.[0]?.[0]) {
    year = dateSource["date-parts"][0][0];
  }

  // Find PDF link if available
  let pdfUrl: string | undefined;
  if (work.link) {
    const pdfLink = work.link.find(
      (l) => l["content-type"] === "application/pdf" || 
             l["intended-application"] === "text-mining"
    );
    pdfUrl = pdfLink?.URL;
  }

  // Map work type to our kind
  const kind = mapWorkType(work.type);

  return {
    identifier: work.DOI,
    identifierType: "DOI",
    title: work.title?.[0] || "Untitled",
    authorsJson,
    authorOrcids,
    year,
    abstractText: work.abstract ? stripJatsHTML(work.abstract) : undefined,
    container: work["container-title"]?.[0],
    volume: work.volume,
    issue: work.issue,
    pages: work.page,
    publisher: work.publisher,
    keywords: work.subject || [],
    url: work.URL,
    kind,
    pdfUrl,
  };
}

/**
 * Map Crossref work type to our Source kind
 */
function mapWorkType(type?: string): string {
  const typeMap: Record<string, string> = {
    "journal-article": "article",
    "book-chapter": "book",
    "book": "book",
    "proceedings-article": "article",
    "dissertation": "article",
    "report": "article",
    "dataset": "dataset",
    "posted-content": "article", // preprints
  };
  return typeMap[type || ""] || "article";
}

/**
 * Strip JATS XML tags from Crossref abstracts
 */
function stripJatsHTML(html: string): string {
  return html
    .replace(/<jats:[^>]+>/gi, "")
    .replace(/<\/jats:[^>]+>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────
// Batch Operations
// ─────────────────────────────────────────────────────────

/**
 * Resolve multiple DOIs with rate limiting
 * 
 * @param dois - Array of DOIs to resolve
 * @returns Map of DOI -> ResolvedSource for successful resolutions
 */
export async function resolveDOIs(
  dois: string[]
): Promise<Map<string, ResolvedSource>> {
  const results = new Map<string, ResolvedSource>();
  
  // Process in batches to respect rate limits (50 req/s for polite pool)
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 250; // ms between batches
  
  for (let i = 0; i < dois.length; i += BATCH_SIZE) {
    const batch = dois.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (doi) => {
      const normalizedDOI = normalizeDOI(doi);
      if (!normalizedDOI) return;
      
      const result = await resolveDOI(doi);
      if (result) {
        results.set(normalizedDOI, result);
      }
    });
    
    await Promise.all(promises);
    
    // Add delay between batches (except for last batch)
    if (i + BATCH_SIZE < dois.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  return results;
}

// ─────────────────────────────────────────────────────────
// DOI Extraction from Text
// ─────────────────────────────────────────────────────────

/**
 * Extract DOIs from a block of text (e.g., from a PDF or reference list)
 */
export function extractDOIsFromText(text: string): string[] {
  // Match DOI patterns in text
  const doiPattern = /\b(10\.\d{4,}\/[^\s"'<>]+)/gi;
  const matches = text.match(doiPattern) || [];
  
  // Deduplicate and normalize
  const uniqueDOIs = new Set<string>();
  for (const match of matches) {
    // Clean up trailing punctuation that might have been captured
    const cleaned = match.replace(/[.,;:!?)]+$/, "");
    const normalized = normalizeDOI(cleaned);
    if (normalized) {
      uniqueDOIs.add(normalized);
    }
  }
  
  return Array.from(uniqueDOIs);
}
