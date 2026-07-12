/**
 * Markdown Export Service
 * 
 * Phase 3.2: Export Formats
 * 
 * Generates Markdown format exports for:
 * - Deliberations (full report with claims, arguments, etc.)
 * - Releases (versioned snapshot report)
 * - Claims (with provenance and versions)
 * - Arguments (with schemes and premises)
 * - Quotes (with interpretations)
 * 
 * Markdown is ideal for:
 * - GitHub/GitLab documentation
 * - Obsidian/Notion imports
 * - Quick human-readable exports
 * - Conversion to other formats via Pandoc
 */

import type {
  ExportResult,
  ExportOptions,
  ExportableDeliberation,
  ExportableRelease,
  ExportableClaim,
  ExportableArgument,
  ExportableQuote,
  ExportableSource,
} from "./types";
import { getMimeType, generateExportFilename } from "./types";

// ─────────────────────────────────────────────────────────
// Markdown Export Options
// ─────────────────────────────────────────────────────────

export interface MarkdownExportOptions extends ExportOptions {
  /** Include table of contents */
  includeTOC?: boolean;
  /** Include YAML frontmatter */
  includeFrontmatter?: boolean;
  /** Heading level to start at (1-6) */
  startHeadingLevel?: number;
  /** Include horizontal rules between sections */
  includeSectionDividers?: boolean;
  /** Link style: inline or reference */
  linkStyle?: "inline" | "reference";
  /** Include Mermaid diagrams where applicable */
  includeDiagrams?: boolean;
}

// ─────────────────────────────────────────────────────────
// Main Export Functions
// ─────────────────────────────────────────────────────────

/**
 * Export a deliberation to Markdown
 */
export function exportDeliberationToMarkdown(
  deliberation: ExportableDeliberation,
  claims: ExportableClaim[] = [],
  args: ExportableArgument[] = [],
  options: MarkdownExportOptions = {}
): ExportResult {
  const lines: string[] = [];
  const h = headingLevel(options.startHeadingLevel || 1);

  // Frontmatter
  if (options.includeFrontmatter !== false) {
    lines.push("---");
    lines.push(`title: "${escapeYaml(deliberation.title)}"`);
    lines.push(`type: deliberation`);
    lines.push(`id: ${deliberation.id}`);
    lines.push(`created: ${deliberation.createdAt.toISOString()}`);
    if (deliberation.author?.name) {
      lines.push(`author: "${escapeYaml(deliberation.author.name)}"`);
    }
    if (deliberation.latestVersion) {
      lines.push(`version: "${deliberation.latestVersion}"`);
    }
    lines.push(`exported: ${new Date().toISOString()}`);
    lines.push("---");
    lines.push("");
  }

  // Title
  lines.push(`${h(1)} ${deliberation.title}`);
  lines.push("");

  // Metadata block
  lines.push(`> **Mesh Deliberation** | Created: ${formatDate(deliberation.createdAt)}`);
  if (deliberation.author?.name) {
    lines.push(`> Author: ${deliberation.author.name}`);
  }
  if (deliberation.latestVersion) {
    lines.push(`> Version: ${deliberation.latestVersion}`);
  }
  lines.push("");

  // Description
  if (deliberation.description) {
    lines.push(`${h(2)} Overview`);
    lines.push("");
    lines.push(deliberation.description);
    lines.push("");
  }

  // Statistics
  lines.push(`${h(2)} Statistics`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Claims | ${deliberation.claimCount || 0} |`);
  lines.push(`| Arguments | ${deliberation.argumentCount || 0} |`);
  lines.push(`| Participants | ${deliberation.participantCount || 0} |`);
  lines.push("");

  // Claims section
  if (claims.length > 0) {
    if (options.includeSectionDividers) lines.push("---");
    lines.push(`${h(2)} Claims`);
    lines.push("");

    for (const claim of claims) {
      lines.push(...formatClaimSection(claim, h(3), options));
      lines.push("");
    }
  }

  // Arguments section
  if (args.length > 0) {
    if (options.includeSectionDividers) lines.push("---");
    lines.push(`${h(2)} Arguments`);
    lines.push("");

    for (const arg of args) {
      lines.push(...formatArgumentSection(arg, h(3), options));
      lines.push("");
    }
  }

  // Citation info
  if (options.includeSectionDividers) lines.push("---");
  lines.push(`${h(2)} Citation`);
  lines.push("");
  if (deliberation.citationUri) {
    lines.push(`**URI:** ${deliberation.citationUri}`);
    lines.push("");
  }
  if (deliberation.doi) {
    lines.push(`**DOI:** ${deliberation.doi}`);
    lines.push("");
  }
  lines.push("```bibtex");
  lines.push(generateQuickBibTeX(deliberation));
  lines.push("```");
  lines.push("");

  const content = lines.join("\n");

  return {
    content,
    mimeType: getMimeType("markdown"),
    filename: generateExportFilename(deliberation.title, "markdown", true),
    format: "markdown",
    itemCount: 1 + claims.length + args.length,
    generatedAt: new Date(),
  };
}

/**
 * Export a release to Markdown
 */
export function exportReleaseToMarkdown(
  release: ExportableRelease,
  options: MarkdownExportOptions = {}
): ExportResult {
  const lines: string[] = [];
  const h = headingLevel(options.startHeadingLevel || 1);

  // Frontmatter
  if (options.includeFrontmatter !== false) {
    lines.push("---");
    lines.push(`title: "${escapeYaml(release.title)}"`);
    lines.push(`type: release`);
    lines.push(`version: "${release.version}"`);
    lines.push(`id: ${release.id}`);
    lines.push(`released: ${release.releasedAt.toISOString()}`);
    if (release.author?.name) {
      lines.push(`author: "${escapeYaml(release.author.name)}"`);
    }
    lines.push(`exported: ${new Date().toISOString()}`);
    lines.push("---");
    lines.push("");
  }

  // Title
  lines.push(`${h(1)} ${release.title}`);
  lines.push("");
  lines.push(`**Version ${release.version}** | Released: ${formatDate(release.releasedAt)}`);
  lines.push("");

  // Summary
  if (release.summary) {
    lines.push(`${h(2)} Summary`);
    lines.push("");
    lines.push(release.summary);
    lines.push("");
  }

  // Statistics
  lines.push(`${h(2)} Release Statistics`);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Claims | ${release.claimCount || 0} |`);
  lines.push(`| Arguments | ${release.argumentCount || 0} |`);
  if (release.deliberationTitle) {
    lines.push(`| Deliberation | ${release.deliberationTitle} |`);
  }
  lines.push("");

  // Citation
  lines.push(`${h(2)} Citation`);
  lines.push("");
  if (release.citationUri) {
    lines.push(`**URI:** ${release.citationUri}`);
    lines.push("");
  }
  if (release.doi) {
    lines.push(`**DOI:** ${release.doi}`);
    lines.push("");
  }
  lines.push("```bibtex");
  lines.push(generateReleaseBibTeX(release));
  lines.push("```");
  lines.push("");

  const content = lines.join("\n");

  return {
    content,
    mimeType: getMimeType("markdown"),
    filename: generateExportFilename(
      `${release.title}_v${release.version}`,
      "markdown",
      true
    ),
    format: "markdown",
    itemCount: 1,
    generatedAt: new Date(),
  };
}

/**
 * Export claims to Markdown
 */
export function exportClaimsToMarkdown(
  claims: ExportableClaim[],
  options: MarkdownExportOptions = {}
): ExportResult {
  const lines: string[] = [];
  const h = headingLevel(options.startHeadingLevel || 1);

  // Frontmatter
  if (options.includeFrontmatter !== false) {
    lines.push("---");
    lines.push(`title: "Claims Export"`);
    lines.push(`type: claims`);
    lines.push(`count: ${claims.length}`);
    lines.push(`exported: ${new Date().toISOString()}`);
    lines.push("---");
    lines.push("");
  }

  // Title
  lines.push(`${h(1)} Claims Export`);
  lines.push("");
  lines.push(`*${claims.length} claim${claims.length !== 1 ? "s" : ""} exported on ${formatDate(new Date())}*`);
  lines.push("");

  // Table of contents
  if (options.includeTOC && claims.length > 3) {
    lines.push(`${h(2)} Table of Contents`);
    lines.push("");
    claims.forEach((claim, i) => {
      const title = truncate(claim.text, 60);
      const slug = slugify(claim.text);
      lines.push(`${i + 1}. [${title}](#${slug})`);
    });
    lines.push("");
  }

  // Claims
  for (const claim of claims) {
    if (options.includeSectionDividers) lines.push("---");
    lines.push(...formatClaimSection(claim, h(2), options));
    lines.push("");
  }

  const content = lines.join("\n");

  return {
    content,
    mimeType: getMimeType("markdown"),
    filename: generateExportFilename("claims_export", "markdown", true),
    format: "markdown",
    itemCount: claims.length,
    generatedAt: new Date(),
  };
}

/**
 * Export arguments to Markdown
 */
export function exportArgumentsToMarkdown(
  args: ExportableArgument[],
  options: MarkdownExportOptions = {}
): ExportResult {
  const lines: string[] = [];
  const h = headingLevel(options.startHeadingLevel || 1);

  // Frontmatter
  if (options.includeFrontmatter !== false) {
    lines.push("---");
    lines.push(`title: "Arguments Export"`);
    lines.push(`type: arguments`);
    lines.push(`count: ${args.length}`);
    lines.push(`exported: ${new Date().toISOString()}`);
    lines.push("---");
    lines.push("");
  }

  // Title
  lines.push(`${h(1)} Arguments Export`);
  lines.push("");
  lines.push(`*${args.length} argument${args.length !== 1 ? "s" : ""} exported on ${formatDate(new Date())}*`);
  lines.push("");

  // Arguments
  for (const arg of args) {
    if (options.includeSectionDividers) lines.push("---");
    lines.push(...formatArgumentSection(arg, h(2), options));
    lines.push("");
  }

  const content = lines.join("\n");

  return {
    content,
    mimeType: getMimeType("markdown"),
    filename: generateExportFilename("arguments_export", "markdown", true),
    format: "markdown",
    itemCount: args.length,
    generatedAt: new Date(),
  };
}

/**
 * Export quotes to Markdown
 */
export function exportQuotesToMarkdown(
  quotes: ExportableQuote[],
  options: MarkdownExportOptions = {}
): ExportResult {
  const lines: string[] = [];
  const h = headingLevel(options.startHeadingLevel || 1);

  // Frontmatter
  if (options.includeFrontmatter !== false) {
    lines.push("---");
    lines.push(`title: "Quotes Export"`);
    lines.push(`type: quotes`);
    lines.push(`count: ${quotes.length}`);
    lines.push(`exported: ${new Date().toISOString()}`);
    lines.push("---");
    lines.push("");
  }

  // Title
  lines.push(`${h(1)} Quotes Export`);
  lines.push("");
  lines.push(`*${quotes.length} quote${quotes.length !== 1 ? "s" : ""} exported on ${formatDate(new Date())}*`);
  lines.push("");

  // Quotes
  for (const quote of quotes) {
    if (options.includeSectionDividers) lines.push("---");
    lines.push(...formatQuoteSection(quote, h(2), options));
    lines.push("");
  }

  const content = lines.join("\n");

  return {
    content,
    mimeType: getMimeType("markdown"),
    filename: generateExportFilename("quotes_export", "markdown", true),
    format: "markdown",
    itemCount: quotes.length,
    generatedAt: new Date(),
  };
}

/**
 * Export sources to Markdown (bibliography format)
 */
export function exportSourcesToMarkdown(
  sources: ExportableSource[],
  options: MarkdownExportOptions = {}
): ExportResult {
  const lines: string[] = [];
  const h = headingLevel(options.startHeadingLevel || 1);

  // Frontmatter
  if (options.includeFrontmatter !== false) {
    lines.push("---");
    lines.push(`title: "Bibliography"`);
    lines.push(`type: sources`);
    lines.push(`count: ${sources.length}`);
    lines.push(`exported: ${new Date().toISOString()}`);
    lines.push("---");
    lines.push("");
  }

  // Title
  lines.push(`${h(1)} Bibliography`);
  lines.push("");
  lines.push(`*${sources.length} source${sources.length !== 1 ? "s" : ""}*`);
  lines.push("");

  // Sources as a list
  for (const source of sources) {
    lines.push(...formatSourceEntry(source));
    lines.push("");
  }

  const content = lines.join("\n");

  return {
    content,
    mimeType: getMimeType("markdown"),
    filename: generateExportFilename("bibliography", "markdown", true),
    format: "markdown",
    itemCount: sources.length,
    generatedAt: new Date(),
  };
}

// ─────────────────────────────────────────────────────────
// Section Formatters
// ─────────────────────────────────────────────────────────

function formatClaimSection(
  claim: ExportableClaim,
  heading: string,
  options: MarkdownExportOptions
): string[] {
  const lines: string[] = [];
  const title = truncate(claim.text, 80);

  lines.push(`${heading} ${title}`);
  lines.push("");

  // Full text as blockquote
  lines.push(`> ${claim.text}`);
  lines.push("");

  // Metadata
  lines.push(`**ID:** \`${claim.id}\``);
  if (claim.academicClaimType) {
    lines.push(`**Type:** ${claim.academicClaimType}`);
  }
  if (claim.consensusStatus) {
    lines.push(`**Status:** ${formatStatus(claim.consensusStatus)}`);
  }
  if (claim.author?.name) {
    lines.push(`**Author:** ${claim.author.name}`);
  }
  lines.push(`**Created:** ${formatDate(claim.createdAt)}`);
  if (claim.currentVersion) {
    lines.push(`**Version:** ${claim.currentVersion}`);
  }
  lines.push("");

  // Version history
  if (options.includeVersions && claim.versionHistory && claim.versionHistory.length > 1) {
    lines.push(`**Version History:**`);
    lines.push("");
    for (const v of claim.versionHistory.slice(0, 5)) {
      lines.push(`- **v${v.versionNumber}** (${v.changeType}): ${truncate(v.text, 60)}`);
      if (v.changeReason) {
        lines.push(`  - Reason: ${v.changeReason}`);
      }
    }
    if (claim.versionHistory.length > 5) {
      lines.push(`- *... and ${claim.versionHistory.length - 5} more versions*`);
    }
    lines.push("");
  }

  // Sources
  if (options.includeRelated && claim.sources && claim.sources.length > 0) {
    lines.push(`**Sources:**`);
    lines.push("");
    for (const source of claim.sources) {
      const citation = formatInlineCitation(source);
      lines.push(`- ${citation}`);
    }
    lines.push("");
  }

  return lines;
}

function formatArgumentSection(
  arg: ExportableArgument,
  heading: string,
  options: MarkdownExportOptions
): string[] {
  const lines: string[] = [];
  const title = truncate(arg.text || arg.conclusion?.text || "Argument", 80);

  lines.push(`${heading} ${title}`);
  lines.push("");

  // Scheme badge
  if (arg.schemeName) {
    lines.push(`*Argumentation Scheme: ${arg.schemeName}*`);
    lines.push("");
  }

  // Premises
  if (arg.premises && arg.premises.length > 0) {
    lines.push(`**Premises:**`);
    lines.push("");
    arg.premises.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.text}`);
    });
    lines.push("");
  }

  // Conclusion
  if (arg.conclusion) {
    lines.push(`**Conclusion:**`);
    lines.push("");
    lines.push(`> ${arg.conclusion.text}`);
    lines.push("");
  }

  // Metadata
  lines.push(`**ID:** \`${arg.id}\``);
  if (arg.argumentType) {
    lines.push(`**Type:** ${arg.argumentType}`);
  }
  if (arg.author?.name) {
    lines.push(`**Author:** ${arg.author.name}`);
  }
  lines.push(`**Created:** ${formatDate(arg.createdAt)}`);
  lines.push("");

  // Mermaid diagram for argument structure
  if (options.includeDiagrams && arg.premises && arg.premises.length > 0 && arg.conclusion) {
    lines.push(`**Structure:**`);
    lines.push("");
    lines.push("```mermaid");
    lines.push("graph TB");
    arg.premises.forEach((p, i) => {
      lines.push(`  P${i + 1}["${truncate(p.text, 30)}"]`);
    });
    lines.push(`  C["${truncate(arg.conclusion.text, 30)}"]`);
    arg.premises.forEach((_, i) => {
      lines.push(`  P${i + 1} --> C`);
    });
    lines.push("```");
    lines.push("");
  }

  return lines;
}

function formatQuoteSection(
  quote: ExportableQuote,
  heading: string,
  options: MarkdownExportOptions
): string[] {
  const lines: string[] = [];
  const title = truncate(quote.text, 60);

  lines.push(`${heading} "${title}"`);
  lines.push("");

  // Quote text as blockquote
  lines.push(`> ${quote.text}`);
  lines.push("");

  // Source info
  if (quote.source?.title) {
    lines.push(`— *${quote.source.title}*`);
    if (quote.locator) {
      const locatorLabel = quote.locatorType || "p.";
      lines.push(`, ${locatorLabel} ${quote.locator}`);
    }
    lines.push("");
  }

  // Metadata
  lines.push(`**ID:** \`${quote.id}\``);
  if (quote.author?.name) {
    lines.push(`**Added by:** ${quote.author.name}`);
  }
  lines.push(`**Created:** ${formatDate(quote.createdAt)}`);
  lines.push("");

  return lines;
}

function formatSourceEntry(source: ExportableSource): string[] {
  const lines: string[] = [];

  // Format as academic citation
  let citation = "";

  // Authors
  if (source.authors && source.authors.length > 0) {
    const authorStr = source.authors
      .map((a) => (a.family && a.given ? `${a.family}, ${a.given.charAt(0)}.` : a.family || a.given))
      .join(", ");
    citation += authorStr;
  }

  // Year
  if (source.year) {
    citation += ` (${source.year}).`;
  }

  // Title
  if (source.title) {
    citation += ` ${source.title}.`;
  }

  // Container (journal/book)
  if (source.container) {
    citation += ` *${source.container}*`;
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

  // DOI or URL
  if (source.doi) {
    citation += ` https://doi.org/${source.doi}`;
  } else if (source.url) {
    citation += ` ${source.url}`;
  }

  lines.push(`- ${citation.trim()}`);

  return lines;
}

// ─────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────

/**
 * Create heading level function
 */
function headingLevel(start: number): (level: number) => string {
  return (level: number) => "#".repeat(Math.min(start + level - 1, 6));
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format consensus status with emoji
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    UNDETERMINED: "⚪ Undetermined",
    EMERGING: "🔵 Emerging",
    ACCEPTED: "✅ Accepted",
    CONTESTED: "⚠️ Contested",
    REJECTED: "❌ Rejected",
    SUPERSEDED: "📦 Superseded",
  };
  return statusMap[status] || status;
}

/**
 * Format inline citation
 */
function formatInlineCitation(source: ExportableSource): string {
  let citation = "";
  
  if (source.authors && source.authors.length > 0) {
    const first = source.authors[0];
    citation += first.family || first.given || "Unknown";
    if (source.authors.length > 1) {
      citation += " et al.";
    }
  }
  
  if (source.year) {
    citation += ` (${source.year})`;
  }
  
  if (source.title) {
    citation += `. "${source.title}"`;
  }
  
  if (source.doi) {
    citation += `. [DOI](https://doi.org/${source.doi})`;
  }
  
  return citation || source.title || source.id;
}

/**
 * Generate quick BibTeX for deliberation
 */
function generateQuickBibTeX(deliberation: ExportableDeliberation): string {
  const key = slugify(deliberation.title).substring(0, 30) + deliberation.createdAt.getFullYear();
  const lines: string[] = [];
  lines.push(`@misc{${key},`);
  lines.push(`  title = {${deliberation.title}},`);
  if (deliberation.author?.name) {
    lines.push(`  author = {${deliberation.author.name}},`);
  }
  lines.push(`  year = {${deliberation.createdAt.getFullYear()}},`);
  lines.push(`  howpublished = {Mesh Academic Platform},`);
  if (deliberation.citationUri) {
    lines.push(`  url = {${deliberation.citationUri}},`);
  }
  lines.push(`  note = {Deliberation with ${deliberation.claimCount || 0} claims}`);
  lines.push(`}`);
  return lines.join("\n");
}

/**
 * Generate quick BibTeX for release
 */
function generateReleaseBibTeX(release: ExportableRelease): string {
  const key = slugify(release.title).substring(0, 30) + release.releasedAt.getFullYear();
  const lines: string[] = [];
  lines.push(`@techreport{${key},`);
  lines.push(`  title = {${release.title} (Version ${release.version})},`);
  if (release.author?.name) {
    lines.push(`  author = {${release.author.name}},`);
  }
  lines.push(`  year = {${release.releasedAt.getFullYear()}},`);
  lines.push(`  institution = {Mesh Academic Platform},`);
  if (release.citationUri) {
    lines.push(`  url = {${release.citationUri}},`);
  }
  if (release.doi) {
    lines.push(`  doi = {${release.doi}},`);
  }
  lines.push(`  note = {Release v${release.version}}`);
  lines.push(`}`);
  return lines.join("\n");
}

/**
 * Truncate text
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Slugify text for anchors
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

/**
 * Escape YAML string
 */
function escapeYaml(str: string): string {
  return str.replace(/"/g, '\\"').replace(/\n/g, " ");
}

export default {
  exportDeliberationToMarkdown,
  exportReleaseToMarkdown,
  exportClaimsToMarkdown,
  exportArgumentsToMarkdown,
  exportQuotesToMarkdown,
  exportSourcesToMarkdown,
};
