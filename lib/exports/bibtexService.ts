/**
 * BibTeX Export Service
 * 
 * Phase 3.2: Export Formats
 * 
 * Generates BibTeX format exports for:
 * - Deliberations (as @misc or @online)
 * - Releases (as @techreport or @misc with version)
 * - Claims (as @misc with custom fields)
 * - Arguments (as @misc with scheme info)
 * - Sources (using their native types)
 * - Quotes (as @misc with locator info)
 */

import type {
  BibTeXEntry,
  BibTeXEntryType,
  BibTeXFields,
  BibTeXExportResult,
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
 * Export a deliberation to BibTeX
 */
export function exportDeliberationToBibTeX(
  deliberation: ExportableDeliberation,
  options: ExportOptions = {}
): BibTeXExportResult {
  const usedKeys = new Set<string>();
  const entries: BibTeXEntry[] = [];

  // Main deliberation entry
  const mainEntry = createDeliberationEntry(deliberation, usedKeys);
  entries.push(mainEntry);

  const content = generateBibTeXContent(entries, {
    header: `Mesh Deliberation: ${deliberation.title}`,
  });

  return {
    content,
    mimeType: getMimeType("bibtex"),
    filename: generateExportFilename(deliberation.title, "bibtex", true),
    format: "bibtex",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export a release to BibTeX
 */
export function exportReleaseToBibTeX(
  release: ExportableRelease,
  options: ExportOptions = {}
): BibTeXExportResult {
  const usedKeys = new Set<string>();
  const entries: BibTeXEntry[] = [];

  const entry = createReleaseEntry(release, usedKeys);
  entries.push(entry);

  const content = generateBibTeXContent(entries, {
    header: `Mesh Release: ${release.title} v${release.version}`,
  });

  return {
    content,
    mimeType: getMimeType("bibtex"),
    filename: generateExportFilename(
      `${release.title}_v${release.version}`,
      "bibtex",
      true
    ),
    format: "bibtex",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export claims to BibTeX
 */
export function exportClaimsToBibTeX(
  claims: ExportableClaim[],
  options: ExportOptions = {}
): BibTeXExportResult {
  const usedKeys = new Set<string>();
  const entries: BibTeXEntry[] = [];

  for (const claim of claims) {
    const entry = createClaimEntry(claim, usedKeys);
    entries.push(entry);

    // Optionally include related sources
    if (options.includeRelated && claim.sources) {
      for (const source of claim.sources) {
        const sourceEntry = createSourceEntry(source, usedKeys);
        entries.push(sourceEntry);
      }
    }
  }

  const content = generateBibTeXContent(entries, {
    header: `Mesh Claims Export (${claims.length} claim${claims.length !== 1 ? "s" : ""})`,
  });

  return {
    content,
    mimeType: getMimeType("bibtex"),
    filename: generateExportFilename("claims_export", "bibtex", true),
    format: "bibtex",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export arguments to BibTeX
 */
export function exportArgumentsToBibTeX(
  args: ExportableArgument[],
  options: ExportOptions = {}
): BibTeXExportResult {
  const usedKeys = new Set<string>();
  const entries: BibTeXEntry[] = [];

  for (const arg of args) {
    const entry = createArgumentEntry(arg, usedKeys);
    entries.push(entry);
  }

  const content = generateBibTeXContent(entries, {
    header: `Mesh Arguments Export (${args.length} argument${args.length !== 1 ? "s" : ""})`,
  });

  return {
    content,
    mimeType: getMimeType("bibtex"),
    filename: generateExportFilename("arguments_export", "bibtex", true),
    format: "bibtex",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export sources to BibTeX
 */
export function exportSourcesToBibTeX(
  sources: ExportableSource[],
  options: ExportOptions = {}
): BibTeXExportResult {
  const usedKeys = new Set<string>();
  const entries: BibTeXEntry[] = [];

  for (const source of sources) {
    const entry = createSourceEntry(source, usedKeys);
    entries.push(entry);
  }

  const content = generateBibTeXContent(entries, {
    header: `Mesh Sources Export (${sources.length} source${sources.length !== 1 ? "s" : ""})`,
  });

  return {
    content,
    mimeType: getMimeType("bibtex"),
    filename: generateExportFilename("sources_export", "bibtex", true),
    format: "bibtex",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

/**
 * Export quotes to BibTeX
 */
export function exportQuotesToBibTeX(
  quotes: ExportableQuote[],
  options: ExportOptions = {}
): BibTeXExportResult {
  const usedKeys = new Set<string>();
  const entries: BibTeXEntry[] = [];

  for (const quote of quotes) {
    const entry = createQuoteEntry(quote, usedKeys);
    entries.push(entry);

    // Include the source if available
    if (options.includeRelated && quote.source) {
      const sourceEntry = createSourceEntry(quote.source, usedKeys);
      entries.push(sourceEntry);
    }
  }

  const content = generateBibTeXContent(entries, {
    header: `Mesh Quotes Export (${quotes.length} quote${quotes.length !== 1 ? "s" : ""})`,
  });

  return {
    content,
    mimeType: getMimeType("bibtex"),
    filename: generateExportFilename("quotes_export", "bibtex", true),
    format: "bibtex",
    itemCount: entries.length,
    generatedAt: new Date(),
    entries,
  };
}

// ─────────────────────────────────────────────────────────
// Entry Creation Functions
// ─────────────────────────────────────────────────────────

/**
 * Create BibTeX entry for a deliberation
 */
function createDeliberationEntry(
  deliberation: ExportableDeliberation,
  usedKeys: Set<string>
): BibTeXEntry {
  const key = generateKey(deliberation.title, deliberation.createdAt, usedKeys);
  const year = deliberation.createdAt.getFullYear();

  const fields: BibTeXFields = {
    title: deliberation.title,
    year,
    howpublished: "Mesh Academic Platform",
    note: `Deliberation with ${deliberation.claimCount || 0} claims and ${deliberation.argumentCount || 0} arguments`,
    meshId: deliberation.id,
    meshType: "deliberation",
  };

  if (deliberation.author?.name) {
    fields.author = deliberation.author.name;
  }

  if (deliberation.description) {
    fields.abstract = truncate(deliberation.description, 500);
  }

  if (deliberation.citationUri) {
    fields.url = deliberation.citationUri;
  }

  if (deliberation.doi) {
    fields.doi = deliberation.doi;
  }

  if (deliberation.latestVersion) {
    fields.version = deliberation.latestVersion;
  }

  return { key, type: "misc", fields };
}

/**
 * Create BibTeX entry for a release
 */
function createReleaseEntry(
  release: ExportableRelease,
  usedKeys: Set<string>
): BibTeXEntry {
  const key = generateKey(
    `${release.title}_v${release.version}`,
    release.releasedAt,
    usedKeys
  );
  const year = release.releasedAt.getFullYear();
  const month = formatMonth(release.releasedAt.getMonth());

  const fields: BibTeXFields = {
    title: `${release.title} (Version ${release.version})`,
    year,
    month,
    howpublished: "Mesh Academic Platform",
    note: `Deliberation release: ${release.claimCount || 0} claims, ${release.argumentCount || 0} arguments`,
    version: release.version,
    meshId: release.id,
    meshType: "release",
    deliberation: release.deliberationTitle || release.deliberationId,
  };

  if (release.author?.name) {
    fields.author = release.author.name;
  }

  if (release.summary) {
    fields.abstract = truncate(release.summary, 500);
  }

  if (release.citationUri) {
    fields.url = release.citationUri;
  }

  if (release.doi) {
    fields.doi = release.doi;
  }

  // Use techreport for versioned releases
  return { key, type: "techreport", fields };
}

/**
 * Create BibTeX entry for a claim
 */
function createClaimEntry(
  claim: ExportableClaim,
  usedKeys: Set<string>
): BibTeXEntry {
  const key = generateKey(
    claim.text.substring(0, 50),
    claim.createdAt,
    usedKeys,
    "claim"
  );
  const year = claim.createdAt.getFullYear();

  const fields: BibTeXFields = {
    title: truncate(claim.text, 200),
    year,
    howpublished: "Mesh Academic Platform",
    meshId: claim.id,
    meshType: claim.academicClaimType || claim.claimType || "claim",
  };

  if (claim.author?.name) {
    fields.author = claim.author.name;
  }

  if (claim.deliberationTitle) {
    fields.note = `Part of deliberation: ${claim.deliberationTitle}`;
  }

  if (claim.consensusStatus) {
    fields.consensusStatus = claim.consensusStatus;
  }

  if (claim.currentVersion) {
    fields.version = `v${claim.currentVersion}`;
  }

  return { key, type: "misc", fields };
}

/**
 * Create BibTeX entry for an argument
 */
function createArgumentEntry(
  arg: ExportableArgument,
  usedKeys: Set<string>
): BibTeXEntry {
  const titleText = arg.text || arg.conclusion?.text || "Argument";
  const key = generateKey(
    titleText.substring(0, 50),
    arg.createdAt,
    usedKeys,
    "arg"
  );
  const year = arg.createdAt.getFullYear();

  const fields: BibTeXFields = {
    title: truncate(titleText, 200),
    year,
    howpublished: "Mesh Academic Platform",
    meshId: arg.id,
    meshType: arg.argumentType || "argument",
  };

  if (arg.author?.name) {
    fields.author = arg.author.name;
  }

  if (arg.schemeName) {
    fields.note = `Argumentation scheme: ${arg.schemeName}`;
  }

  if (arg.deliberationTitle) {
    if (fields.note) {
      fields.note += `; Part of: ${arg.deliberationTitle}`;
    } else {
      fields.note = `Part of deliberation: ${arg.deliberationTitle}`;
    }
  }

  if (arg.premises && arg.premises.length > 0) {
    const premiseTexts = arg.premises.map((p, i) => `P${i + 1}: ${truncate(p.text, 100)}`);
    fields.keywords = premiseTexts.join("; ");
  }

  return { key, type: "misc", fields };
}

/**
 * Create BibTeX entry for a source
 */
function createSourceEntry(
  source: ExportableSource,
  usedKeys: Set<string>
): BibTeXEntry {
  const key = generateKey(
    source.title || "source",
    source.year ? new Date(source.year, 0) : new Date(),
    usedKeys
  );
  const type = mapSourceKindToBibTeX(source.kind);

  const fields: BibTeXFields = {
    meshId: source.id,
    meshType: source.kind,
  };

  if (source.title) {
    fields.title = source.title;
  }

  if (source.authors && source.authors.length > 0) {
    fields.author = formatAuthors(source.authors);
  }

  if (source.year) {
    fields.year = source.year;
  }

  if (source.container) {
    if (type === "article") {
      fields.journal = source.container;
    } else {
      fields.booktitle = source.container;
    }
  }

  if (source.publisher) {
    fields.publisher = source.publisher;
  }

  if (source.volume) {
    fields.volume = source.volume;
  }

  if (source.issue) {
    fields.number = source.issue;
  }

  if (source.pages) {
    fields.pages = source.pages;
  }

  if (source.doi) {
    fields.doi = source.doi;
  }

  if (source.url) {
    fields.url = source.url;
  }

  return { key, type, fields };
}

/**
 * Create BibTeX entry for a quote
 */
function createQuoteEntry(
  quote: ExportableQuote,
  usedKeys: Set<string>
): BibTeXEntry {
  const key = generateKey(
    quote.text.substring(0, 50),
    quote.createdAt,
    usedKeys,
    "quote"
  );
  const year = quote.createdAt.getFullYear();

  const fields: BibTeXFields = {
    title: truncate(quote.text, 200),
    year,
    howpublished: "Mesh Academic Platform",
    meshId: quote.id,
    meshType: "quote",
  };

  if (quote.author?.name) {
    fields.author = quote.author.name;
  }

  if (quote.locator) {
    const locatorLabel = quote.locatorType || "location";
    fields.note = `${locatorLabel}: ${quote.locator}`;
  }

  if (quote.source?.title) {
    fields.booktitle = quote.source.title;
  }

  return { key, type: "misc", fields };
}

// ─────────────────────────────────────────────────────────
// BibTeX Content Generation
// ─────────────────────────────────────────────────────────

interface GenerateOptions {
  header?: string;
}

/**
 * Generate BibTeX file content from entries
 */
function generateBibTeXContent(
  entries: BibTeXEntry[],
  options: GenerateOptions = {}
): string {
  const lines: string[] = [];

  // Header comments
  lines.push(`% BibTeX export from Mesh Academic Platform`);
  if (options.header) {
    lines.push(`% ${options.header}`);
  }
  lines.push(`% Exported on ${new Date().toISOString()}`);
  lines.push(`%`);
  lines.push("");

  // Generate each entry
  for (const entry of entries) {
    lines.push(formatEntry(entry));
    lines.push("");
  }

  if (entries.length === 0) {
    lines.push("% No exportable entries found.");
  }

  return lines.join("\n");
}

/**
 * Format a single BibTeX entry
 */
function formatEntry(entry: BibTeXEntry): string {
  const lines: string[] = [];
  lines.push(`@${entry.type}{${entry.key},`);

  const fieldEntries = Object.entries(entry.fields).filter(
    ([_, value]) => value !== undefined && value !== null && value !== ""
  );

  fieldEntries.forEach(([field, value], index) => {
    const isLast = index === fieldEntries.length - 1;
    const formattedValue = formatFieldValue(value);
    lines.push(`  ${field} = {${formattedValue}}${isLast ? "" : ","}`);
  });

  lines.push(`}`);
  return lines.join("\n");
}

/**
 * Format a field value for BibTeX
 */
function formatFieldValue(value: string | number | undefined): string {
  if (value === undefined || value === null) return "";
  const str = String(value);
  return escapeBibTeX(str);
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Generate a unique citation key
 */
function generateKey(
  title: string,
  date: Date,
  usedKeys: Set<string>,
  prefix?: string
): string {
  // Extract first meaningful word
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  const titleWord = words[0] || "item";
  const year = date.getFullYear();

  const baseKey = prefix
    ? `${prefix}_${titleWord}${year}`
    : `${titleWord}${year}`;

  let key = baseKey.toLowerCase();
  let counter = 0;

  while (usedKeys.has(key)) {
    counter++;
    key = `${baseKey}${String.fromCharCode(96 + counter)}`.toLowerCase();
  }

  usedKeys.add(key);
  return key;
}

/**
 * Map source kind to BibTeX entry type
 */
function mapSourceKindToBibTeX(kind: string): BibTeXEntryType {
  const map: Record<string, BibTeXEntryType> = {
    article: "article",
    "journal-article": "article",
    book: "book",
    chapter: "inbook",
    "book-chapter": "inbook",
    inproceedings: "inproceedings",
    conference: "inproceedings",
    "conference-paper": "inproceedings",
    thesis: "phdthesis",
    "phd-thesis": "phdthesis",
    "masters-thesis": "mastersthesis",
    report: "techreport",
    "technical-report": "techreport",
    web: "online",
    webpage: "online",
    dataset: "misc",
    video: "misc",
    other: "misc",
  };
  return map[kind.toLowerCase()] || "misc";
}

/**
 * Format author array to BibTeX format
 */
function formatAuthors(
  authors: Array<{ family?: string; given?: string }>
): string {
  return authors
    .map((a) => {
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || a.given || "";
    })
    .filter(Boolean)
    .join(" and ");
}

/**
 * Format month number to BibTeX month
 */
function formatMonth(month: number): string {
  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  return months[month] || "jan";
}

/**
 * Escape special BibTeX characters
 */
function escapeBibTeX(str: string): string {
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export default {
  exportDeliberationToBibTeX,
  exportReleaseToBibTeX,
  exportClaimsToBibTeX,
  exportArgumentsToBibTeX,
  exportSourcesToBibTeX,
  exportQuotesToBibTeX,
};
