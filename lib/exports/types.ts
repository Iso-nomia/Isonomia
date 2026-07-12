/**
 * Export Types
 * 
 * Phase 3.2: Export Formats
 * 
 * Type definitions for academic export formats:
 * - BibTeX
 * - RIS (Research Information Systems)
 * - PDF Reports
 * - JSON
 * - Markdown
 */

import type {
  AcademicClaimType,
  ConsensusStatus,
  VersionChangeType,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────
// Common Export Types
// ─────────────────────────────────────────────────────────

/** Supported export formats */
export type ExportFormat =
  | "bibtex"
  | "ris"
  | "pdf"
  | "json"
  | "markdown"
  | "csl-json"; // Citation Style Language JSON

/** Export target type */
export type ExportTarget =
  | "deliberation"
  | "release"
  | "claim"
  | "argument"
  | "quote"
  | "source";

/** Export options for customizing output */
export interface ExportOptions {
  /** Include full content or just citation */
  includeContent?: boolean;
  /** Include author information */
  includeAuthors?: boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Include related items (premises, sources, etc.) */
  includeRelated?: boolean;
  /** Include version history */
  includeVersions?: boolean;
  /** Custom citation key prefix */
  keyPrefix?: string;
  /** Date format for output */
  dateFormat?: "iso" | "human" | "bibtex";
}

/** Result of an export operation */
export interface ExportResult {
  /** The exported content as a string */
  content: string;
  /** MIME type for the content */
  mimeType: string;
  /** Suggested filename */
  filename: string;
  /** Export format used */
  format: ExportFormat;
  /** Number of items exported */
  itemCount: number;
  /** Generation timestamp */
  generatedAt: Date;
}

// ─────────────────────────────────────────────────────────
// BibTeX Types
// ─────────────────────────────────────────────────────────

/** BibTeX entry types */
export type BibTeXEntryType =
  | "article"
  | "book"
  | "booklet"
  | "conference"
  | "inbook"
  | "incollection"
  | "inproceedings"
  | "manual"
  | "mastersthesis"
  | "misc"
  | "online"
  | "phdthesis"
  | "proceedings"
  | "techreport"
  | "unpublished";

/** BibTeX field mapping */
export interface BibTeXFields {
  author?: string;
  title?: string;
  year?: string | number;
  month?: string;
  journal?: string;
  booktitle?: string;
  publisher?: string;
  address?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  howpublished?: string;
  note?: string;
  abstract?: string;
  keywords?: string;
  // Custom fields for Mesh
  meshId?: string;
  meshType?: string;
  deliberation?: string;
  consensusStatus?: string;
  version?: string;
}

/** BibTeX entry representation */
export interface BibTeXEntry {
  key: string;
  type: BibTeXEntryType;
  fields: BibTeXFields;
}

/** BibTeX export result */
export interface BibTeXExportResult extends ExportResult {
  format: "bibtex";
  entries: BibTeXEntry[];
}

// ─────────────────────────────────────────────────────────
// RIS Types
// ─────────────────────────────────────────────────────────

/** RIS reference types */
export type RISType =
  | "ABST"  // Abstract
  | "ADVS"  // Audiovisual material
  | "BLOG"  // Blog
  | "BOOK"  // Book
  | "CASE"  // Case
  | "CHAP"  // Book chapter
  | "CONF"  // Conference proceeding
  | "DATA"  // Data file
  | "ELEC"  // Electronic source
  | "GEN"   // Generic
  | "JOUR"  // Journal
  | "MGZN"  // Magazine
  | "NEWS"  // Newspaper
  | "RPRT"  // Report
  | "THES"  // Thesis
  | "UNPB"  // Unpublished work
  | "WEB";  // Web page

/** RIS field tags */
export type RISFieldTag =
  | "TY"    // Type
  | "AU"    // Author
  | "TI"    // Title
  | "T1"    // Primary title
  | "T2"    // Secondary title (journal, book)
  | "T3"    // Tertiary title
  | "AB"    // Abstract
  | "N1"    // Notes
  | "N2"    // Abstract
  | "KW"    // Keywords
  | "PY"    // Publication year
  | "Y1"    // Primary date
  | "DA"    // Date
  | "JO"    // Journal name
  | "JF"    // Full journal name
  | "J2"    // Alternate journal name
  | "VL"    // Volume
  | "IS"    // Issue
  | "SP"    // Start page
  | "EP"    // End page
  | "PB"    // Publisher
  | "CY"    // City/Place
  | "DO"    // DOI
  | "UR"    // URL
  | "SN"    // ISBN/ISSN
  | "L1"    // File attachment 1
  | "L2"    // File attachment 2
  | "LA"    // Language
  | "ID"    // Reference ID
  | "ER";   // End of reference

/** RIS entry representation */
export interface RISEntry {
  type: RISType;
  fields: Partial<Record<RISFieldTag, string | string[]>>;
}

/** RIS export result */
export interface RISExportResult extends ExportResult {
  format: "ris";
  entries: RISEntry[];
}

// ─────────────────────────────────────────────────────────
// CSL-JSON Types (Citation Style Language)
// ─────────────────────────────────────────────────────────

/** CSL-JSON item type */
export type CSLType =
  | "article"
  | "article-journal"
  | "article-magazine"
  | "article-newspaper"
  | "book"
  | "chapter"
  | "dataset"
  | "entry"
  | "entry-dictionary"
  | "entry-encyclopedia"
  | "manuscript"
  | "paper-conference"
  | "post"
  | "post-weblog"
  | "report"
  | "speech"
  | "thesis"
  | "webpage";

/** CSL-JSON name object */
export interface CSLName {
  family?: string;
  given?: string;
  literal?: string;
  suffix?: string;
  "dropping-particle"?: string;
  "non-dropping-particle"?: string;
}

/** CSL-JSON date object */
export interface CSLDate {
  "date-parts"?: Array<[number, number?, number?]>;
  raw?: string;
  literal?: string;
}

/** CSL-JSON item */
export interface CSLItem {
  id: string;
  type: CSLType;
  title?: string;
  author?: CSLName[];
  issued?: CSLDate;
  accessed?: CSLDate;
  abstract?: string;
  DOI?: string;
  URL?: string;
  "container-title"?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  "publisher-place"?: string;
  note?: string;
  keyword?: string;
  // Custom fields
  "custom-mesh-id"?: string;
  "custom-mesh-type"?: string;
}

// ─────────────────────────────────────────────────────────
// Exportable Data Types
// ─────────────────────────────────────────────────────────

/** Deliberation data for export */
export interface ExportableDeliberation {
  id: string;
  title: string;
  description?: string | null;
  createdAt: Date;
  updatedAt?: Date;
  author?: {
    id: string;
    name: string | null;
  } | null;
  claimCount?: number;
  argumentCount?: number;
  participantCount?: number;
  latestVersion?: string | null;
  citationUri?: string | null;
  doi?: string | null;
}

/** Claim data for export */
export interface ExportableClaim {
  id: string;
  text: string;
  claimType?: string | null;
  academicClaimType?: AcademicClaimType | null;
  consensusStatus?: ConsensusStatus | null;
  createdAt: Date;
  author?: {
    id: string;
    name: string | null;
  } | null;
  deliberationId?: string | null;
  deliberationTitle?: string | null;
  sources?: ExportableSource[];
  currentVersion?: number | null;
  versionHistory?: ExportableClaimVersion[];
}

/** Claim version for export */
export interface ExportableClaimVersion {
  versionNumber: number;
  text: string;
  changeType: VersionChangeType;
  changeReason?: string | null;
  createdAt: Date;
  author?: {
    id: string;
    name: string | null;
  } | null;
}

/** Argument data for export */
export interface ExportableArgument {
  id: string;
  text?: string | null;
  argumentType?: string | null;
  schemeId?: string | null;
  schemeName?: string | null;
  createdAt: Date;
  author?: {
    id: string;
    name: string | null;
  } | null;
  deliberationId?: string | null;
  deliberationTitle?: string | null;
  premises?: Array<{
    id: string;
    text: string;
  }>;
  conclusion?: {
    id: string;
    text: string;
  } | null;
}

/** Quote data for export */
export interface ExportableQuote {
  id: string;
  text: string;
  locator?: string | null;
  locatorType?: string | null;
  createdAt: Date;
  author?: {
    id: string;
    name: string | null;
  } | null;
  source?: ExportableSource | null;
}

/** Source data for export */
export interface ExportableSource {
  id: string;
  kind: string;
  title?: string | null;
  authors?: Array<{
    family?: string;
    given?: string;
  }>;
  year?: number | null;
  doi?: string | null;
  url?: string | null;
  container?: string | null;
  publisher?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
}

/** Release data for export */
export interface ExportableRelease {
  id: string;
  version: string;
  title: string;
  summary?: string | null;
  releasedAt: Date;
  deliberationId: string;
  deliberationTitle?: string | null;
  citationUri?: string | null;
  doi?: string | null;
  author?: {
    id: string;
    name: string | null;
  } | null;
  claimCount?: number;
  argumentCount?: number;
}

// ─────────────────────────────────────────────────────────
// PDF Report Types
// ─────────────────────────────────────────────────────────

/** PDF report section */
export type PDFReportSection =
  | "title"
  | "abstract"
  | "table-of-contents"
  | "claims"
  | "arguments"
  | "attack-graph"
  | "timeline"
  | "changelog"
  | "bibliography"
  | "appendix";

/** PDF report options */
export interface PDFReportOptions extends ExportOptions {
  /** Sections to include */
  sections?: PDFReportSection[];
  /** Include cover page */
  includeCover?: boolean;
  /** Include page numbers */
  includePageNumbers?: boolean;
  /** Paper size */
  paperSize?: "letter" | "a4";
  /** Margins in inches */
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Font size */
  fontSize?: number;
  /** Custom header text */
  headerText?: string;
  /** Custom footer text */
  footerText?: string;
}

/** PDF generation result */
export interface PDFExportResult extends ExportResult {
  format: "pdf";
  pageCount: number;
  sections: PDFReportSection[];
}

// ─────────────────────────────────────────────────────────
// Export Request Types
// ─────────────────────────────────────────────────────────

/** Request to export a deliberation */
export interface ExportDeliberationRequest {
  deliberationId: string;
  format: ExportFormat;
  options?: ExportOptions;
}

/** Request to export a release */
export interface ExportReleaseRequest {
  releaseId: string;
  format: ExportFormat;
  options?: ExportOptions;
}

/** Request to export claims */
export interface ExportClaimsRequest {
  claimIds: string[];
  format: ExportFormat;
  options?: ExportOptions;
}

/** Request to export arguments */
export interface ExportArgumentsRequest {
  argumentIds: string[];
  format: ExportFormat;
  options?: ExportOptions;
}

/** Request to export sources */
export interface ExportSourcesRequest {
  sourceIds: string[];
  format: ExportFormat;
  options?: ExportOptions;
}

// ─────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────

/** Format MIME types */
export const FORMAT_MIME_TYPES: Record<ExportFormat, string> = {
  bibtex: "application/x-bibtex",
  ris: "application/x-research-info-systems",
  pdf: "application/pdf",
  json: "application/json",
  markdown: "text/markdown",
  "csl-json": "application/vnd.citationstyles.csl+json",
};

/** Format file extensions */
export const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  bibtex: ".bib",
  ris: ".ris",
  pdf: ".pdf",
  json: ".json",
  markdown: ".md",
  "csl-json": ".json",
};

/** Helper to get MIME type for format */
export function getMimeType(format: ExportFormat): string {
  return FORMAT_MIME_TYPES[format] || "application/octet-stream";
}

/** Helper to get file extension for format */
export function getFileExtension(format: ExportFormat): string {
  return FORMAT_EXTENSIONS[format] || ".txt";
}

/** Helper to generate filename for export */
export function generateExportFilename(
  baseName: string,
  format: ExportFormat,
  timestamp?: boolean
): string {
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
  
  const ts = timestamp
    ? `_${new Date().toISOString().slice(0, 10)}`
    : "";
  
  return `${sanitized}${ts}${getFileExtension(format)}`;
}
