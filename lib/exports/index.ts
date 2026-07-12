/**
 * Exports Module Barrel Export
 * 
 * Phase 3.2: Export Formats
 * 
 * Academic export formats for Mesh:
 * - BibTeX (for LaTeX/academic papers)
 * - RIS (for reference managers)
 * - Markdown (for documentation/notes)
 * - PDF Reports (HTML for conversion)
 * - CSL-JSON (for citation styles)
 */

// Types
export * from "./types";

// BibTeX Service
export {
  exportDeliberationToBibTeX,
  exportReleaseToBibTeX,
  exportClaimsToBibTeX,
  exportArgumentsToBibTeX,
  exportSourcesToBibTeX,
  exportQuotesToBibTeX,
} from "./bibtexService";

// RIS Service
export {
  exportDeliberationToRIS,
  exportReleaseToRIS,
  exportClaimsToRIS,
  exportArgumentsToRIS,
  exportSourcesToRIS,
  exportQuotesToRIS,
} from "./risService";

// Markdown Service
export {
  exportDeliberationToMarkdown,
  exportReleaseToMarkdown,
  exportClaimsToMarkdown,
  exportArgumentsToMarkdown,
  exportQuotesToMarkdown,
  exportSourcesToMarkdown,
  type MarkdownExportOptions,
} from "./markdownService";

// PDF Service
export {
  generateDeliberationPDFHtml,
  generateReleasePDFHtml,
  generateClaimsPDFHtml,
  generateArgumentsPDFHtml,
} from "./pdfService";
