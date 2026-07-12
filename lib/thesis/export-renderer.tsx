/**
 * Server-side thesis rendering for export
 * Converts TipTap JSONContent to static HTML with embedded deliberation objects
 */

import { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prismaclient";

interface RenderOptions {
  includeMetadata?: boolean;
  includeStyles?: boolean;
  expandObjects?: boolean; // Show full claim/argument details vs references
  format?: "html" | "markdown" | "json";
}

interface ThesisExport {
  html?: string;
  markdown?: string;
  json?: string;
  metadata: {
    title: string;
    author?: string;
    publishedAt?: string;
    template: string;
    wordCount: number;
    objectCount: {
      claims: number;
      arguments: number;
      citations: number;
    };
  };
}

/**
 * Fetch claim data for rendering
 */
async function fetchClaim(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      id: true,
      text: true,
      createdAt: true,
      createdById: true,
    },
  });
  return claim;
}

/**
 * Fetch argument data for rendering
 */
async function fetchArgument(argumentId: string) {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      text: true,
      conclusionClaimId: true,
      schemeId: true,
      createdAt: true,
    },
  });
  
  if (!argument) return null;
  
  // Fetch conclusion separately if exists
  let conclusionText = argument.text;
  if (argument.conclusionClaimId) {
    const conclusion = await prisma.claim.findUnique({
      where: { id: argument.conclusionClaimId },
      select: { text: true },
    });
    if (conclusion) {
      conclusionText = conclusion.text;
    }
  }
  
  return {
    ...argument,
    conclusionText,
  };
}

/**
 * Convert TipTap JSON node to HTML
 */
async function nodeToHTML(node: JSONContent, options: RenderOptions): Promise<string> {
  if (!node.type) return "";

  switch (node.type) {
    case "doc":
      const childrenHTML = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return childrenHTML.join("");

    case "paragraph":
      const pContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<p>${pContent.join("")}</p>\n`;

    case "heading":
      const level = node.attrs?.level || 1;
      const hContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<h${level}>${hContent.join("")}</h${level}>\n`;

    case "text":
      let text = node.text || "";
      
      // Apply marks
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case "bold":
              text = `<strong>${text}</strong>`;
              break;
            case "italic":
              text = `<em>${text}</em>`;
              break;
            case "code":
              text = `<code>${text}</code>`;
              break;
            case "link":
              text = `<a href="${mark.attrs?.href || ""}">${text}</a>`;
              break;
          }
        }
      }
      
      return text;

    case "bulletList":
      const ulContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<ul>\n${ulContent.join("")}</ul>\n`;

    case "orderedList":
      const olContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<ol>\n${olContent.join("")}</ol>\n`;

    case "listItem":
      const liContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<li>${liContent.join("")}</li>\n`;

    case "blockquote":
      const bqContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<blockquote>\n${bqContent.join("")}</blockquote>\n`;

    case "codeBlock":
      const codeContent = await Promise.all(
        (node.content || []).map((child) => nodeToHTML(child, options))
      );
      return `<pre><code>${codeContent.join("")}</code></pre>\n`;

    case "hardBreak":
      return "<br>\n";

    case "horizontalRule":
      return "<hr>\n";

    // Custom nodes - deliberation objects
    case "claim":
      const claimId = node.attrs?.claimId;
      if (!claimId) return `<span class="claim-ref">[Claim]</span>`;
      
      if (options.expandObjects) {
        const claim = await fetchClaim(claimId);
        if (claim) {
          return `<div class="claim-expanded">
            <div class="claim-header">Claim</div>
            <div class="claim-text">${claim.text}</div>
            <div class="claim-meta">ID: ${claim.id}</div>
          </div>\n`;
        }
      }
      
      return `<span class="claim-ref" data-claim-id="${claimId}">[Claim #${claimId.slice(0, 8)}]</span>`;

    case "argument":
      const argumentId = node.attrs?.argumentId;
      if (!argumentId) return `<span class="argument-ref">[Argument]</span>`;
      
      if (options.expandObjects) {
        const argument = await fetchArgument(argumentId);
        if (argument) {
          return `<div class="argument-expanded">
            <div class="argument-header">Argument${argument.schemeId ? ` (Scheme: ${argument.schemeId.slice(0, 8)})` : ""}</div>
            <div class="argument-conclusion">
              <strong>Conclusion:</strong> ${argument.conclusionText}
            </div>
            <div class="argument-meta">ID: ${argument.id}</div>
          </div>\n`;
        }
      }
      
      return `<span class="argument-ref" data-argument-id="${argumentId}">[Argument #${argumentId.slice(0, 8)}]</span>`;

    case "citation":
      const citationText = node.attrs?.text || "Citation";
      const citationUrl = node.attrs?.url;
      if (citationUrl) {
        return `<span class="citation"><a href="${citationUrl}">${citationText}</a></span>`;
      }
      return `<span class="citation">${citationText}</span>`;

    case "theorywork":
      const theoryworkId = node.attrs?.theoryworkId;
      const theoryworkTitle = node.attrs?.title || "TheoryWork";
      return `<span class="theorywork-ref" data-theorywork-id="${theoryworkId}">[${theoryworkTitle}]</span>`;

    default:
      // Fallback: try to render children
      if (node.content) {
        const fallbackContent = await Promise.all(
          node.content.map((child) => nodeToHTML(child, options))
        );
        return fallbackContent.join("");
      }
      return "";
  }
}

/**
 * Convert TipTap JSON to Markdown
 */
async function nodeToMarkdown(node: JSONContent, depth: number = 0): Promise<string> {
  if (!node.type) return "";

  const indent = "  ".repeat(depth);

  switch (node.type) {
    case "doc":
      const childrenMD = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth))
      );
      return childrenMD.join("");

    case "paragraph":
      const pContent = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth))
      );
      return `${pContent.join("")}\n\n`;

    case "heading":
      const level = node.attrs?.level || 1;
      const hContent = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth))
      );
      return `${"#".repeat(level)} ${hContent.join("")}\n\n`;

    case "text":
      let text = node.text || "";
      
      if (node.marks) {
        for (const mark of node.marks) {
          switch (mark.type) {
            case "bold":
              text = `**${text}**`;
              break;
            case "italic":
              text = `*${text}*`;
              break;
            case "code":
              text = `\`${text}\``;
              break;
            case "link":
              text = `[${text}](${mark.attrs?.href || ""})`;
              break;
          }
        }
      }
      
      return text;

    case "bulletList":
      const ulContent = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth))
      );
      return ulContent.join("");

    case "orderedList":
      const olContent = await Promise.all(
        (node.content || []).map((child, idx) => nodeToMarkdown(child, depth))
      );
      return olContent.join("");

    case "listItem":
      const liContent = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth + 1))
      );
      return `${indent}- ${liContent.join("").trim()}\n`;

    case "blockquote":
      const bqContent = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth))
      );
      return bqContent.map((line) => `> ${line}`).join("");

    case "codeBlock":
      const codeContent = await Promise.all(
        (node.content || []).map((child) => nodeToMarkdown(child, depth))
      );
      return "```\n" + codeContent.join("") + "```\n\n";

    case "hardBreak":
      return "  \n";

    case "horizontalRule":
      return "---\n\n";

    case "claim":
      const claimId = node.attrs?.claimId;
      return `[Claim #${claimId?.slice(0, 8) || "unknown"}]`;

    case "argument":
      const argumentId = node.attrs?.argumentId;
      return `[Argument #${argumentId?.slice(0, 8) || "unknown"}]`;

    case "citation":
      const citationText = node.attrs?.text || "Citation";
      const citationUrl = node.attrs?.url;
      if (citationUrl) {
        return `[${citationText}](${citationUrl})`;
      }
      return `[${citationText}]`;

    default:
      if (node.content) {
        const fallbackContent = await Promise.all(
          node.content.map((child) => nodeToMarkdown(child, depth))
        );
        return fallbackContent.join("");
      }
      return "";
  }
}

/**
 * Generate CSS styles for exported HTML
 */
function getExportStyles(): string {
  return `
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    color: #1e293b;
  }
  
  h1 { font-size: 2.5rem; margin-top: 0; margin-bottom: 1rem; font-weight: 700; }
  h2 { font-size: 2rem; margin-top: 2rem; margin-bottom: 1rem; font-weight: 600; }
  h3 { font-size: 1.5rem; margin-top: 1.5rem; margin-bottom: 0.75rem; font-weight: 600; }
  
  p { margin-bottom: 1rem; }
  
  .metadata {
    background: #f1f5f9;
    border-left: 4px solid #0ea5e9;
    padding: 1rem;
    margin-bottom: 2rem;
    border-radius: 4px;
  }
  
  .metadata-field {
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .metadata-field strong {
    color: #475569;
    margin-right: 0.5rem;
  }
  
  .claim-ref, .argument-ref, .citation, .theorywork-ref {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9em;
    font-weight: 500;
    margin: 0 0.25rem;
  }
  
  .claim-ref {
    background: #ccfbf1;
    color: #0f766e;
    border: 1px solid #14b8a6;
  }
  
  .argument-ref {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #f59e0b;
  }
  
  .citation {
    background: #e0e7ff;
    color: #3730a3;
    border: 1px solid #6366f1;
  }
  
  .theorywork-ref {
    background: #fce7f3;
    color: #9f1239;
    border: 1px solid #ec4899;
  }
  
  .claim-expanded, .argument-expanded {
    background: #f8fafc;
    border: 2px solid #cbd5e1;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }
  
  .claim-header, .argument-header {
    font-weight: 700;
    color: #0f766e;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
  }
  
  .claim-text, .argument-conclusion {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .claim-meta, .argument-meta {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.5rem;
  }
  
  .argument-premises {
    margin: 0.75rem 0;
  }
  
  .argument-premises ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  
  blockquote {
    border-left: 4px solid #cbd5e1;
    padding-left: 1rem;
    color: #64748b;
    font-style: italic;
    margin: 1rem 0;
  }
  
  code {
    background: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-family: "Courier New", monospace;
    font-size: 0.9em;
  }
  
  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 6px;
    overflow-x: auto;
  }
  
  pre code {
    background: transparent;
    padding: 0;
    color: inherit;
  }
  
  ul, ol {
    margin-bottom: 1rem;
  }
  
  li {
    margin-bottom: 0.5rem;
  }
  
  hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 2rem 0;
  }
  
  @media print {
    body { padding: 1rem; }
    .claim-expanded, .argument-expanded { page-break-inside: avoid; }
  }
</style>
`;
}

/**
 * Main export function
 */
export async function exportThesis(
  thesisId: string,
  options: RenderOptions = {}
): Promise<ThesisExport> {
  const thesis = await prisma.thesis.findUnique({
    where: { id: thesisId },
    select: {
      id: true,
      title: true,
      abstract: true,
      content: true,
      template: true,
      publishedAt: true,
      author: {
        select: {
          name: true,
          username: true,
        },
      },
    },
  });

  if (!thesis) {
    throw new Error("Thesis not found");
  }

  const content = thesis.content as JSONContent | null;
  if (!content) {
    throw new Error("Thesis has no content");
  }

  // Count words (rough estimate)
  const textContent = JSON.stringify(content);
  const wordCount = textContent.split(/\s+/).length;

  // Count embedded objects
  const objectCounts = {
    claims: (textContent.match(/"type":"claim"/g) || []).length,
    arguments: (textContent.match(/"type":"argument"/g) || []).length,
    citations: (textContent.match(/"type":"citation"/g) || []).length,
  };

  const metadata = {
    title: thesis.title,
    author: thesis.author?.name || thesis.author?.username || "Unknown",
    publishedAt: thesis.publishedAt?.toISOString(),
    template: thesis.template,
    wordCount,
    objectCount: objectCounts,
  };

  const result: ThesisExport = { metadata };

  // Generate HTML
  if (options.format === "html" || !options.format) {
    const bodyHTML = await nodeToHTML(content, options);
    
    const metadataHTML = options.includeMetadata
      ? `
      <div class="metadata">
        <div class="metadata-field"><strong>Title:</strong> ${thesis.title}</div>
        <div class="metadata-field"><strong>Author:</strong> ${metadata.author}</div>
        ${thesis.publishedAt ? `<div class="metadata-field"><strong>Published:</strong> ${new Date(thesis.publishedAt).toLocaleDateString()}</div>` : ""}
        <div class="metadata-field"><strong>Template:</strong> ${thesis.template.replace(/_/g, " ")}</div>
        <div class="metadata-field"><strong>Word Count:</strong> ${wordCount}</div>
        ${thesis.abstract ? `<div class="metadata-field"><strong>Abstract:</strong> ${thesis.abstract}</div>` : ""}
      </div>
      `
      : "";

    const stylesHTML = options.includeStyles ? getExportStyles() : "";

    result.html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${thesis.title}</title>
  ${stylesHTML}
</head>
<body>
  <h1>${thesis.title}</h1>
  ${metadataHTML}
  ${bodyHTML}
</body>
</html>
    `.trim();
  }

  // Generate Markdown
  if (options.format === "markdown") {
    const bodyMD = await nodeToMarkdown(content);
    
    const metadataMD = options.includeMetadata
      ? `---
title: ${thesis.title}
author: ${metadata.author}
${thesis.publishedAt ? `published: ${new Date(thesis.publishedAt).toLocaleDateString()}` : ""}
template: ${thesis.template}
---

${thesis.abstract ? `**Abstract:** ${thesis.abstract}\n\n` : ""}`
      : "";

    result.markdown = `# ${thesis.title}\n\n${metadataMD}${bodyMD}`;
  }

  // Generate JSON
  if (options.format === "json") {
    result.json = JSON.stringify(
      {
        ...thesis,
        metadata,
      },
      null,
      2
    );
  }

  return result;
}
