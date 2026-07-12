/**
 * RIS Export Service
 * 
 * Phase 3.2: Export Formats
 * 
 * Generates RIS (Research Information Systems) format exports for:
 * - Deliberations
 * - Releases
 * - Claims
 * - Arguments
 * - Sources
 * - Quotes
 * 
 * RIS is widely supported by reference managers (Zotero, Mendeley, EndNote).
 */

import type {
  RISEntry,
  RISType,
  RISFieldTag,
  RISExportResult,
  ExportableDeliberation,
  ExportableRelease,
  ExportableClaim,
  ExportableArgument,
  ExportableSource,
  ExportableQuote,
  ExportOptions,
} from "./types";
import { getMimeType, generateExportFilename } from "./types";

// ─────────────────────────────────────────────────────────
// Main Export Functions
// ─────────────────────────────────────────────────────────

/**
 * Export a deliberation to RIS format
 */
export function exportDeliberationToRIS(
  deliberation: ExportableDeliberation,
  options: ExportOptions = {}
): RISExportResult {
  const entries: RISEntry[] = [];

  const entry = createDeliberationEntry(deliberation);
  entries.push(entry);

  const content = generateRISContent(entries);

  return {
    content,
    mimeType: getMimeType("ris"),
    filename: generateExportFilename(deliberation.title, "ris", true),
    format: "ris",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export a release to RIS format
 */
export function exportReleaseToRIS(
  release: ExportableRelease,
  options: ExportOptions = {}
): RISExportResult {
  const entries: RISEntry[] = [];

  const entry = createReleaseEntry(release);
  entries.push(entry);

  const content = generateRISContent(entries);

  return {
    content,
    mimeType: getMimeType("ris"),
    filename: generateExportFilename(
      `${release.title}_v${release.version}`,
      "ris",
      true
    ),
    format: "ris",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export claims to RIS format
 */
export function exportClaimsToRIS(
  claims: ExportableClaim[],
  options: ExportOptions = {}
): RISExportResult {
  const entries: RISEntry[] = [];

  for (const claim of claims) {
    const entry = createClaimEntry(claim);
    entries.push(entry);

    // Include related sources
    if (options.includeRelated && claim.sources) {
      for (const source of claim.sources) {
        const sourceEntry = createSourceEntry(source);
        entries.push(sourceEntry);
      }
    }
  }

  const content = generateRISContent(entries);

  return {
    content,
    mimeType: getMimeType("ris"),
    filename: generateExportFilename("claims_export", "ris", true),
    format: "ris",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export arguments to RIS format
 */
export function exportArgumentsToRIS(
  args: ExportableArgument[],
  options: ExportOptions = {}
): RISExportResult {
  const entries: RISEntry[] = [];

  for (const arg of args) {
    const entry = createArgumentEntry(arg);
    entries.push(entry);
  }

  const content = generateRISContent(entries);

  return {
    content,
    mimeType: getMimeType("ris"),
    filename: generateExportFilename("arguments_export", "ris", true),
    format: "ris",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export sources to RIS format
 */
export function exportSourcesToRIS(
  sources: ExportableSource[],
  options: ExportOptions = {}
): RISExportResult {
  const entries: RISEntry[] = [];

  for (const source of sources) {
    const entry = createSourceEntry(source);
    entries.push(entry);
  }

  const content = generateRISContent(entries);

  return {
    content,
    mimeType: getMimeType("ris"),
    filename: generateExportFilename("sources_export", "ris", true),
    format: "ris",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export quotes to RIS format
 */
export function exportQuotesToRIS(
  quotes: ExportableQuote[],
  options: ExportOptions = {}
): RISExportResult {
  const entries: RISEntry[] = [];

  for (const quote of quotes) {
    const entry = createQuoteEntry(quote);
    entries.push(entry);

    if (options.includeRelated && quote.source) {
      const sourceEntry = createSourceEntry(quote.source);
      entries.push(sourceEntry);
    }
  }

  const content = generateRISContent(entries);

  return {
    content,
    mimeType: getMimeType("ris"),
    filename: generateExportFilename("quotes_export", "ris", true),
    format: "ris",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

// ─────────────────────────────────────────────────────────
// Entry Creation Functions
// ─────────────────────────────────────────────────────────

/**
 * Create RIS entry for a deliberation
 */
function createDeliberationEntry(
  deliberation: ExportableDeliberation
): RISEntry {
  const fields: Partial<Record<RISFieldTag, string | string[]>> = {
    TI: deliberation.title,
    PY: String(deliberation.createdAt.getFullYear()),
    DA: formatRISDate(deliberation.createdAt),
    PB: "Mesh Academic Platform",
    ID: deliberation.id,
  };

  if (deliberation.author?.name) {
    fields.AU = [deliberation.author.name];
  }

  if (deliberation.description) {
    fields.AB = truncate(deliberation.description, 1000);
  }

  if (deliberation.citationUri) {
    fields.UR = deliberation.citationUri;
  }

  if (deliberation.doi) {
    fields.DO = deliberation.doi;
  }

  // Notes with stats
  const notes: string[] = [];
  notes.push(`Mesh Deliberation`);
  if (deliberation.claimCount) {
    notes.push(`Claims: ${deliberation.claimCount}`);
  }
  if (deliberation.argumentCount) {
    notes.push(`Arguments: ${deliberation.argumentCount}`);
  }
  if (deliberation.latestVersion) {
    notes.push(`Version: ${deliberation.latestVersion}`);
  }
  fields.N1 = notes.join("; ");

  return { type: "GEN", fields };
}

/**
 * Create RIS entry for a release
 */
function createReleaseEntry(release: ExportableRelease): RISEntry {
  const fields: Partial<Record<RISFieldTag, string | string[]>> = {
    TI: `${release.title} (Version ${release.version})`,
    PY: String(release.releasedAt.getFullYear()),
    DA: formatRISDate(release.releasedAt),
    PB: "Mesh Academic Platform",
    ID: release.id,
  };

  if (release.author?.name) {
    fields.AU = [release.author.name];
  }

  if (release.summary) {
    fields.AB = truncate(release.summary, 1000);
  }

  if (release.citationUri) {
    fields.UR = release.citationUri;
  }

  if (release.doi) {
    fields.DO = release.doi;
  }

  // Notes
  const notes: string[] = [];
  notes.push(`Mesh Deliberation Release v${release.version}`);
  if (release.deliberationTitle) {
    notes.push(`Deliberation: ${release.deliberationTitle}`);
  }
  if (release.claimCount) {
    notes.push(`Claims: ${release.claimCount}`);
  }
  if (release.argumentCount) {
    notes.push(`Arguments: ${release.argumentCount}`);
  }
  fields.N1 = notes.join("; ");

  return { type: "RPRT", fields };
}

/**
 * Create RIS entry for a claim
 */
function createClaimEntry(claim: ExportableClaim): RISEntry {
  const fields: Partial<Record<RISFieldTag, string | string[]>> = {
    TI: truncate(claim.text, 500),
    PY: String(claim.createdAt.getFullYear()),
    DA: formatRISDate(claim.createdAt),
    PB: "Mesh Academic Platform",
    ID: claim.id,
  };

  if (claim.author?.name) {
    fields.AU = [claim.author.name];
  }

  // Notes
  const notes: string[] = [];
  notes.push(`Mesh Claim`);
  if (claim.academicClaimType) {
    notes.push(`Type: ${claim.academicClaimType}`);
  }
  if (claim.consensusStatus) {
    notes.push(`Status: ${claim.consensusStatus}`);
  }
  if (claim.deliberationTitle) {
    notes.push(`Deliberation: ${claim.deliberationTitle}`);
  }
  if (claim.currentVersion) {
    notes.push(`Version: ${claim.currentVersion}`);
  }
  fields.N1 = notes.join("; ");

  // Keywords from claim type
  if (claim.academicClaimType || claim.claimType) {
    fields.KW = [claim.academicClaimType || claim.claimType || "claim"];
  }

  return { type: "GEN", fields };
}

/**
 * Create RIS entry for an argument
 */
function createArgumentEntry(arg: ExportableArgument): RISEntry {
  const titleText = arg.text || arg.conclusion?.text || "Argument";

  const fields: Partial<Record<RISFieldTag, string | string[]>> = {
    TI: truncate(titleText, 500),
    PY: String(arg.createdAt.getFullYear()),
    DA: formatRISDate(arg.createdAt),
    PB: "Mesh Academic Platform",
    ID: arg.id,
  };

  if (arg.author?.name) {
    fields.AU = [arg.author.name];
  }

  // Notes
  const notes: string[] = [];
  notes.push(`Mesh Argument`);
  if (arg.schemeName) {
    notes.push(`Scheme: ${arg.schemeName}`);
  }
  if (arg.argumentType) {
    notes.push(`Type: ${arg.argumentType}`);
  }
  if (arg.deliberationTitle) {
    notes.push(`Deliberation: ${arg.deliberationTitle}`);
  }
  fields.N1 = notes.join("; ");

  // Abstract with premises
  if (arg.premises && arg.premises.length > 0) {
    const premiseText = arg.premises
      .map((p, i) => `P${i + 1}: ${p.text}`)
      .join("\n");
    fields.AB = premiseText;
  }

  // Keywords
  const keywords: string[] = [];
  if (arg.argumentType) keywords.push(arg.argumentType);
  if (arg.schemeName) keywords.push(arg.schemeName);
  if (keywords.length > 0) {
    fields.KW = keywords;
  }

  return { type: "GEN", fields };
}

/**
 * Create RIS entry for a source
 */
function createSourceEntry(source: ExportableSource): RISEntry {
  const type = mapSourceKindToRIS(source.kind);

  const fields: Partial<Record<RISFieldTag, string | string[]>> = {
    ID: source.id,
  };

  if (source.title) {
    fields.TI = source.title;
  }

  if (source.authors && source.authors.length > 0) {
    fields.AU = source.authors.map((a) => {
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || a.given || "";
    }).filter(Boolean);
  }

  if (source.year) {
    fields.PY = String(source.year);
  }

  if (source.container) {
    if (type === "JOUR") {
      fields.JO = source.container;
      fields.JF = source.container;
    } else {
      fields.T2 = source.container;
    }
  }

  if (source.publisher) {
    fields.PB = source.publisher;
  }

  if (source.volume) {
    fields.VL = source.volume;
  }

  if (source.issue) {
    fields.IS = source.issue;
  }

  if (source.pages) {
    const [sp, ep] = source.pages.split("-").map((s) => s.trim());
    if (sp) fields.SP = sp;
    if (ep) fields.EP = ep;
  }

  if (source.doi) {
    fields.DO = source.doi;
  }

  if (source.url) {
    fields.UR = source.url;
  }

  return { type, fields };
}

/**
 * Create RIS entry for a quote
 */
function createQuoteEntry(quote: ExportableQuote): RISEntry {
  const fields: Partial<Record<RISFieldTag, string | string[]>> = {
    TI: truncate(quote.text, 500),
    PY: String(quote.createdAt.getFullYear()),
    DA: formatRISDate(quote.createdAt),
    PB: "Mesh Academic Platform",
    ID: quote.id,
  };

  if (quote.author?.name) {
    fields.AU = [quote.author.name];
  }

  // Notes with locator
  const notes: string[] = [];
  notes.push(`Mesh Quote`);
  if (quote.locator) {
    const locatorLabel = quote.locatorType || "location";
    notes.push(`${locatorLabel}: ${quote.locator}`);
  }
  if (quote.source?.title) {
    notes.push(`Source: ${quote.source.title}`);
  }
  fields.N1 = notes.join("; ");

  if (quote.source?.title) {
    fields.T2 = quote.source.title;
  }

  return { type: "GEN", fields };
}

// ─────────────────────────────────────────────────────────
// RIS Content Generation
// ─────────────────────────────────────────────────────────

/**
 * Generate RIS file content from entries
 */
function generateRISContent(entries: RISEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    // Type line
    lines.push(`TY  - ${entry.type}`);

    // Field lines
    for (const [tag, value] of Object.entries(entry.fields)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        // Multiple values (e.g., authors, keywords)
        for (const v of value) {
          lines.push(`${tag}  - ${escapeRIS(v)}`);
        }
      } else {
        lines.push(`${tag}  - ${escapeRIS(value)}`);
      }
    }

    // End of reference
    lines.push(`ER  - `);
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Map source kind to RIS reference type
 */
function mapSourceKindToRIS(kind: string): RISType {
  const map: Record<string, RISType> = {
    article: "JOUR",
    "journal-article": "JOUR",
    book: "BOOK",
    chapter: "CHAP",
    "book-chapter": "CHAP",
    inproceedings: "CONF",
    conference: "CONF",
    "conference-paper": "CONF",
    thesis: "THES",
    "phd-thesis": "THES",
    "masters-thesis": "THES",
    report: "RPRT",
    "technical-report": "RPRT",
    web: "ELEC",
    webpage: "ELEC",
    blog: "BLOG",
    dataset: "DATA",
    video: "ADVS",
    news: "NEWS",
    magazine: "MGZN",
    other: "GEN",
  };
  return map[kind.toLowerCase()] || "GEN";
}

/**
 * Format date for RIS (YYYY/MM/DD format)
 */
function formatRISDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Escape special characters for RIS
 */
function escapeRIS(str: string): string {
  // RIS doesn't require much escaping, but we should handle newlines
  return str.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export default {
  exportDeliberationToRIS,
  exportReleaseToRIS,
  exportClaimsToRIS,
  exportArgumentsToRIS,
  exportSourcesToRIS,
  exportQuotesToRIS,
};
