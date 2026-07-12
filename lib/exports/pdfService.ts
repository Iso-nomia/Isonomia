/**
 * PDF Export Service
 * 
 * Phase 3.2: Export Formats
 * 
 * Generates PDF reports for:
 * - Deliberations (full academic report)
 * - Releases (versioned snapshot report)
 * - Claims (with provenance)
 * - Arguments (with structure visualization)
 * 
 * This service generates HTML that can be converted to PDF
 * using a headless browser (Puppeteer) or server-side rendering.
 * 
 * For client-side PDF generation, you can use libraries like:
 * - jsPDF + html2canvas
 * - react-pdf
 * - pdfmake
 */

import type {
  ExportResult,
  PDFReportOptions,
  PDFReportSection,
  PDFExportResult,
  ExportableDeliberation,
  ExportableRelease,
  ExportableClaim,
  ExportableArgument,
  ExportableQuote,
  ExportableSource,
} from "./types";
import { getMimeType, generateExportFilename } from "./types";

// ─────────────────────────────────────────────────────────
// PDF HTML Templates
// ─────────────────────────────────────────────────────────

const DEFAULT_PDF_OPTIONS: PDFReportOptions = {
  sections: ["title", "abstract", "claims", "arguments", "bibliography"],
  includeCover: true,
  includePageNumbers: true,
  paperSize: "letter",
  margins: { top: 1, right: 1, bottom: 1, left: 1 },
  fontSize: 11,
};

// ─────────────────────────────────────────────────────────
// Main Export Functions
// ─────────────────────────────────────────────────────────

/**
 * Generate PDF HTML for a deliberation
 * Returns HTML that can be rendered to PDF
 */
export function generateDeliberationPDFHtml(
  deliberation: ExportableDeliberation,
  claims: ExportableClaim[] = [],
  args: ExportableArgument[] = [],
  sources: ExportableSource[] = [],
  options: PDFReportOptions = {}
): PDFExportResult {
  const opts = { ...DEFAULT_PDF_OPTIONS, ...options };
  const sections = opts.sections || [];
  const html: string[] = [];

  // Document start
  html.push(generateDocumentHead(deliberation.title, opts));
  html.push(`<body>`);

  // Cover page
  if (opts.includeCover && sections.includes("title")) {
    html.push(generateCoverPage(deliberation, opts));
  }

  // Abstract / Overview
  if (sections.includes("abstract") && deliberation.description) {
    html.push(generateAbstractSection(deliberation.description));
  }

  // Table of Contents
  if (sections.includes("table-of-contents")) {
    html.push(generateTableOfContents(claims, args, sections));
  }

  // Claims section
  if (sections.includes("claims") && claims.length > 0) {
    html.push(generateClaimsSection(claims, opts));
  }

  // Arguments section
  if (sections.includes("arguments") && args.length > 0) {
    html.push(generateArgumentsSection(args, opts));
  }

  // Timeline (if included)
  if (sections.includes("timeline")) {
    html.push(generateTimelineSection(claims, args));
  }

  // Bibliography
  if (sections.includes("bibliography") && sources.length > 0) {
    html.push(generateBibliographySection(sources));
  }

  // Footer
  html.push(generateFooter(deliberation, opts));
  html.push(`</body></html>`);

  const content = html.join("\n");

  // Estimate page count (rough: ~3000 chars per page)
  const estimatedPages = Math.ceil(content.length / 3000);

  return {
    content,
    mimeType: "text/html", // This is HTML to be converted to PDF
    filename: generateExportFilename(deliberation.title, "pdf", true),
    format: "pdf",
    itemCount: 1 + claims.length + args.length,
    generatedAt: new Date(),
    pageCount: estimatedPages,
    sections: sections,
  };
}

/**
 * Generate PDF HTML for a release
 */
export function generateReleasePDFHtml(
  release: ExportableRelease,
  claims: ExportableClaim[] = [],
  args: ExportableArgument[] = [],
  sources: ExportableSource[] = [],
  changelogText?: string,
  options: PDFReportOptions = {}
): PDFExportResult {
  const opts = { ...DEFAULT_PDF_OPTIONS, ...options };
  const sections = opts.sections || [];
  const html: string[] = [];

  // Document start
  html.push(generateDocumentHead(`${release.title} v${release.version}`, opts));
  html.push(`<body>`);

  // Cover page
  if (opts.includeCover) {
    html.push(generateReleaseCoverPage(release, opts));
  }

  // Summary
  if (release.summary) {
    html.push(generateAbstractSection(release.summary));
  }

  // Changelog
  if (sections.includes("changelog") && changelogText) {
    html.push(generateChangelogSection(changelogText));
  }

  // Claims
  if (sections.includes("claims") && claims.length > 0) {
    html.push(generateClaimsSection(claims, opts));
  }

  // Arguments
  if (sections.includes("arguments") && args.length > 0) {
    html.push(generateArgumentsSection(args, opts));
  }

  // Bibliography
  if (sections.includes("bibliography") && sources.length > 0) {
    html.push(generateBibliographySection(sources));
  }

  // Footer
  html.push(generateReleaseFooter(release, opts));
  html.push(`</body></html>`);

  const content = html.join("\n");
  const estimatedPages = Math.ceil(content.length / 3000);

  return {
    content,
    mimeType: "text/html",
    filename: generateExportFilename(
      `${release.title}_v${release.version}`,
      "pdf",
      true
    ),
    format: "pdf",
    itemCount: 1 + claims.length + args.length,
    generatedAt: new Date(),
    pageCount: estimatedPages,
    sections: sections,
  };
}

/**
 * Generate simple PDF HTML for claims only
 */
export function generateClaimsPDFHtml(
  claims: ExportableClaim[],
  options: PDFReportOptions = {}
): PDFExportResult {
  const opts = { ...DEFAULT_PDF_OPTIONS, ...options };
  const html: string[] = [];

  html.push(generateDocumentHead("Claims Report", opts));
  html.push(`<body>`);

  // Simple header
  html.push(`
    <div class="header">
      <h1>Claims Report</h1>
      <p class="subtitle">${claims.length} claim${claims.length !== 1 ? "s" : ""} | Generated ${formatDate(new Date())}</p>
    </div>
  `);

  // Claims
  html.push(generateClaimsSection(claims, opts));

  html.push(`</body></html>`);

  const content = html.join("\n");
  const estimatedPages = Math.ceil(content.length / 3000);

  return {
    content,
    mimeType: "text/html",
    filename: generateExportFilename("claims_report", "pdf", true),
    format: "pdf",
    itemCount: claims.length,
    generatedAt: new Date(),
    pageCount: estimatedPages,
    sections: ["claims"],
  };
}

/**
 * Generate simple PDF HTML for arguments only
 */
export function generateArgumentsPDFHtml(
  args: ExportableArgument[],
  options: PDFReportOptions = {}
): PDFExportResult {
  const opts = { ...DEFAULT_PDF_OPTIONS, ...options };
  const html: string[] = [];

  html.push(generateDocumentHead("Arguments Report", opts));
  html.push(`<body>`);

  // Simple header
  html.push(`
    <div class="header">
      <h1>Arguments Report</h1>
      <p class="subtitle">${args.length} argument${args.length !== 1 ? "s" : ""} | Generated ${formatDate(new Date())}</p>
    </div>
  `);

  // Arguments
  html.push(generateArgumentsSection(args, opts));

  html.push(`</body></html>`);

  const content = html.join("\n");
  const estimatedPages = Math.ceil(content.length / 3000);

  return {
    content,
    mimeType: "text/html",
    filename: generateExportFilename("arguments_report", "pdf", true),
    format: "pdf",
    itemCount: args.length,
    generatedAt: new Date(),
    pageCount: estimatedPages,
    sections: ["arguments"],
  };
}

// ─────────────────────────────────────────────────────────
// HTML Section Generators
// ─────────────────────────────────────────────────────────

function generateDocumentHead(title: string, opts: PDFReportOptions): string {
  const margins = opts.margins || { top: 1, right: 1, bottom: 1, left: 1 };
  const fontSize = opts.fontSize || 11;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: ${opts.paperSize === "a4" ? "A4" : "letter"};
      margin: ${margins.top}in ${margins.right}in ${margins.bottom}in ${margins.left}in;
    }
    
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: ${fontSize}pt;
      line-height: 1.5;
      color: #1a1a1a;
      max-width: 100%;
    }
    
    h1 { font-size: 24pt; margin-bottom: 0.5em; }
    h2 { font-size: 18pt; margin-top: 1.5em; margin-bottom: 0.5em; border-bottom: 1px solid #ccc; padding-bottom: 0.25em; }
    h3 { font-size: 14pt; margin-top: 1em; margin-bottom: 0.5em; }
    h4 { font-size: 12pt; margin-top: 0.75em; margin-bottom: 0.25em; }
    
    p { margin: 0.5em 0; text-align: justify; }
    
    blockquote {
      margin: 1em 0;
      padding: 0.5em 1em;
      border-left: 3px solid #666;
      background: #f9f9f9;
      font-style: italic;
    }
    
    .cover-page {
      text-align: center;
      padding-top: 3in;
      page-break-after: always;
    }
    
    .cover-page h1 {
      font-size: 28pt;
      margin-bottom: 0.25em;
    }
    
    .cover-page .subtitle {
      font-size: 14pt;
      color: #666;
    }
    
    .cover-page .metadata {
      margin-top: 2in;
      font-size: 12pt;
    }
    
    .header {
      margin-bottom: 2em;
    }
    
    .section {
      margin-bottom: 2em;
    }
    
    .claim-card, .argument-card {
      margin: 1em 0;
      padding: 1em;
      border: 1px solid #ddd;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    
    .claim-text, .argument-text {
      font-size: 12pt;
      margin-bottom: 0.5em;
    }
    
    .metadata-row {
      font-size: 10pt;
      color: #666;
    }
    
    .metadata-row span {
      margin-right: 1em;
    }
    
    .status-badge {
      display: inline-block;
      padding: 0.1em 0.5em;
      border-radius: 3px;
      font-size: 9pt;
      font-weight: bold;
    }
    
    .status-accepted { background: #d4edda; color: #155724; }
    .status-contested { background: #fff3cd; color: #856404; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .status-default { background: #e9ecef; color: #495057; }
    
    .premises-list {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }
    
    .premises-list li {
      margin: 0.25em 0;
    }
    
    .conclusion {
      margin-top: 0.5em;
      padding: 0.5em;
      background: #f0f0f0;
      border-radius: 3px;
    }
    
    .bibliography-entry {
      margin: 0.5em 0;
      padding-left: 2em;
      text-indent: -2em;
    }
    
    .toc {
      margin: 1em 0;
    }
    
    .toc-item {
      margin: 0.25em 0;
    }
    
    .footer {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 1px solid #ccc;
      font-size: 10pt;
      color: #666;
      text-align: center;
    }
    
    .page-break {
      page-break-after: always;
    }
  </style>
</head>
`;
}

function generateCoverPage(
  deliberation: ExportableDeliberation,
  opts: PDFReportOptions
): string {
  return `
<div class="cover-page">
  <h1>${escapeHtml(deliberation.title)}</h1>
  <p class="subtitle">Academic Deliberation Report</p>
  
  <div class="metadata">
    ${deliberation.author?.name ? `<p><strong>Author:</strong> ${escapeHtml(deliberation.author.name)}</p>` : ""}
    <p><strong>Created:</strong> ${formatDate(deliberation.createdAt)}</p>
    ${deliberation.latestVersion ? `<p><strong>Version:</strong> ${deliberation.latestVersion}</p>` : ""}
    <p><strong>Claims:</strong> ${deliberation.claimCount || 0} | <strong>Arguments:</strong> ${deliberation.argumentCount || 0}</p>
    ${deliberation.citationUri ? `<p><strong>URI:</strong> ${escapeHtml(deliberation.citationUri)}</p>` : ""}
    ${deliberation.doi ? `<p><strong>DOI:</strong> ${escapeHtml(deliberation.doi)}</p>` : ""}
    <p style="margin-top: 1in;"><em>Generated from Mesh Academic Platform</em></p>
    <p>${formatDate(new Date())}</p>
  </div>
</div>
`;
}

function generateReleaseCoverPage(
  release: ExportableRelease,
  opts: PDFReportOptions
): string {
  return `
<div class="cover-page">
  <h1>${escapeHtml(release.title)}</h1>
  <p class="subtitle">Version ${release.version}</p>
  
  <div class="metadata">
    ${release.author?.name ? `<p><strong>Released by:</strong> ${escapeHtml(release.author.name)}</p>` : ""}
    <p><strong>Released:</strong> ${formatDate(release.releasedAt)}</p>
    ${release.deliberationTitle ? `<p><strong>Deliberation:</strong> ${escapeHtml(release.deliberationTitle)}</p>` : ""}
    <p><strong>Claims:</strong> ${release.claimCount || 0} | <strong>Arguments:</strong> ${release.argumentCount || 0}</p>
    ${release.citationUri ? `<p><strong>URI:</strong> ${escapeHtml(release.citationUri)}</p>` : ""}
    ${release.doi ? `<p><strong>DOI:</strong> ${escapeHtml(release.doi)}</p>` : ""}
    <p style="margin-top: 1in;"><em>Generated from Mesh Academic Platform</em></p>
    <p>${formatDate(new Date())}</p>
  </div>
</div>
`;
}

function generateAbstractSection(description: string): string {
  return `
<div class="section">
  <h2>Abstract</h2>
  <p>${escapeHtml(description)}</p>
</div>
`;
}

function generateTableOfContents(
  claims: ExportableClaim[],
  args: ExportableArgument[],
  sections: PDFReportSection[]
): string {
  const items: string[] = [];
  
  if (sections.includes("abstract")) {
    items.push(`<div class="toc-item">1. Abstract</div>`);
  }
  if (sections.includes("claims") && claims.length > 0) {
    items.push(`<div class="toc-item">2. Claims (${claims.length})</div>`);
  }
  if (sections.includes("arguments") && args.length > 0) {
    items.push(`<div class="toc-item">3. Arguments (${args.length})</div>`);
  }
  if (sections.includes("bibliography")) {
    items.push(`<div class="toc-item">4. Bibliography</div>`);
  }

  return `
<div class="section">
  <h2>Table of Contents</h2>
  <div class="toc">
    ${items.join("\n")}
  </div>
</div>
`;
}

function generateClaimsSection(
  claims: ExportableClaim[],
  opts: PDFReportOptions
): string {
  const claimCards = claims.map((claim, i) => {
    const statusClass = getStatusClass(claim.consensusStatus);
    
    return `
<div class="claim-card">
  <div class="claim-text">${i + 1}. ${escapeHtml(claim.text)}</div>
  <div class="metadata-row">
    <span class="status-badge ${statusClass}">${claim.consensusStatus || "UNDETERMINED"}</span>
    ${claim.academicClaimType ? `<span>Type: ${claim.academicClaimType}</span>` : ""}
    ${claim.author?.name ? `<span>Author: ${escapeHtml(claim.author.name)}</span>` : ""}
    <span>Created: ${formatDate(claim.createdAt)}</span>
    ${claim.currentVersion ? `<span>v${claim.currentVersion}</span>` : ""}
  </div>
</div>
`;
  }).join("\n");

  return `
<div class="section">
  <h2>Claims</h2>
  <p><em>${claims.length} claim${claims.length !== 1 ? "s" : ""} in this deliberation.</em></p>
  ${claimCards}
</div>
`;
}

function generateArgumentsSection(
  args: ExportableArgument[],
  opts: PDFReportOptions
): string {
  const argCards = args.map((arg, i) => {
    const title = arg.text || arg.conclusion?.text || "Argument";
    
    let premisesHtml = "";
    if (arg.premises && arg.premises.length > 0) {
      premisesHtml = `
<div><strong>Premises:</strong></div>
<ol class="premises-list">
  ${arg.premises.map((p) => `<li>${escapeHtml(p.text)}</li>`).join("\n")}
</ol>
`;
    }

    let conclusionHtml = "";
    if (arg.conclusion) {
      conclusionHtml = `
<div class="conclusion">
  <strong>Conclusion:</strong> ${escapeHtml(arg.conclusion.text)}
</div>
`;
    }

    return `
<div class="argument-card">
  <h4>${i + 1}. ${escapeHtml(truncate(title, 80))}</h4>
  ${arg.schemeName ? `<p><em>Scheme: ${escapeHtml(arg.schemeName)}</em></p>` : ""}
  ${premisesHtml}
  ${conclusionHtml}
  <div class="metadata-row">
    ${arg.argumentType ? `<span>Type: ${arg.argumentType}</span>` : ""}
    ${arg.author?.name ? `<span>Author: ${escapeHtml(arg.author.name)}</span>` : ""}
    <span>Created: ${formatDate(arg.createdAt)}</span>
  </div>
</div>
`;
  }).join("\n");

  return `
<div class="section">
  <h2>Arguments</h2>
  <p><em>${args.length} argument${args.length !== 1 ? "s" : ""} in this deliberation.</em></p>
  ${argCards}
</div>
`;
}

function generateTimelineSection(
  claims: ExportableClaim[],
  args: ExportableArgument[]
): string {
  // Combine and sort by date
  const events = [
    ...claims.map((c) => ({
      date: c.createdAt,
      type: "claim" as const,
      text: truncate(c.text, 60),
    })),
    ...args.map((a) => ({
      date: a.createdAt,
      type: "argument" as const,
      text: truncate(a.text || a.conclusion?.text || "Argument", 60),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const eventRows = events.slice(0, 20).map((e) => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td>${e.type}</td>
      <td>${escapeHtml(e.text)}</td>
    </tr>
  `).join("\n");

  return `
<div class="section">
  <h2>Timeline</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr>
        <th style="text-align: left; border-bottom: 1px solid #ccc;">Date</th>
        <th style="text-align: left; border-bottom: 1px solid #ccc;">Type</th>
        <th style="text-align: left; border-bottom: 1px solid #ccc;">Description</th>
      </tr>
    </thead>
    <tbody>
      ${eventRows}
    </tbody>
  </table>
  ${events.length > 20 ? `<p><em>... and ${events.length - 20} more events</em></p>` : ""}
</div>
`;
}

function generateChangelogSection(changelogText: string): string {
  // Convert markdown-style changelog to HTML
  const htmlContent = changelogText
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  return `
<div class="section">
  <h2>Changelog</h2>
  ${htmlContent}
</div>
`;
}

function generateBibliographySection(sources: ExportableSource[]): string {
  const entries = sources.map((source) => {
    let citation = "";
    
    if (source.authors && source.authors.length > 0) {
      const authorStr = source.authors
        .map((a) => (a.family && a.given ? `${a.family}, ${a.given.charAt(0)}.` : a.family || a.given))
        .join(", ");
      citation += authorStr;
    }
    
    if (source.year) {
      citation += ` (${source.year}).`;
    }
    
    if (source.title) {
      citation += ` ${escapeHtml(source.title)}.`;
    }
    
    if (source.container) {
      citation += ` <em>${escapeHtml(source.container)}</em>`;
      if (source.volume) {
        citation += `, ${source.volume}`;
        if (source.issue) {
          citation += `(${source.issue})`;
        }
      }
      if (source.pages) {
        citation += `, ${source.pages}`;
      }
      citation += ".";
    }
    
    if (source.doi) {
      citation += ` https://doi.org/${source.doi}`;
    }

    return `<div class="bibliography-entry">${citation.trim()}</div>`;
  }).join("\n");

  return `
<div class="section page-break">
  <h2>Bibliography</h2>
  ${entries}
</div>
`;
}

function generateFooter(
  deliberation: ExportableDeliberation,
  opts: PDFReportOptions
): string {
  return `
<div class="footer">
  <p>
    ${escapeHtml(deliberation.title)}
    ${deliberation.latestVersion ? ` | v${deliberation.latestVersion}` : ""}
    | Generated from Mesh Academic Platform
    | ${formatDate(new Date())}
  </p>
</div>
`;
}

function generateReleaseFooter(
  release: ExportableRelease,
  opts: PDFReportOptions
): string {
  return `
<div class="footer">
  <p>
    ${escapeHtml(release.title)} v${release.version}
    | Generated from Mesh Academic Platform
    | ${formatDate(new Date())}
  </p>
</div>
`;
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

function getStatusClass(status?: string | null): string {
  switch (status) {
    case "ACCEPTED":
      return "status-accepted";
    case "CONTESTED":
      return "status-contested";
    case "REJECTED":
      return "status-rejected";
    default:
      return "status-default";
  }
}

export default {
  generateDeliberationPDFHtml,
  generateReleasePDFHtml,
  generateClaimsPDFHtml,
  generateArgumentsPDFHtml,
};
