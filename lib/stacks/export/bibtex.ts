/**
 * BibTeX Export Generator
 * 
 * Phase 1.6 of Stacks Improvement Roadmap
 * 
 * Generates BibTeX format export for academic use.
 * Note: This exports blocks with their metadata as bibliography entries.
 * For full Source-based export, integrate with the Source model.
 */

export interface BlockForBibTeX {
  id: string;
  blockType: string | null;
  title: string | null;
  linkUrl: string | null;
  linkSiteName: string | null;
  created_at: Date;
  // For future: source relation
  source?: {
    id: string;
    kind: string;
    title: string | null;
    authorsJson: any;
    year: number | null;
    doi: string | null;
    url: string | null;
    container: string | null;
    publisher: string | null;
    volume: string | null;
    issue: string | null;
    pages: string | null;
  } | null;
}

export interface StackForBibTeXExport {
  name: string;
  items: Array<{
    block: BlockForBibTeX | null;
  }>;
}

/**
 * Generate BibTeX from stack blocks
 * Creates entries based on block metadata
 */
export function generateBibTeXExport(stack: StackForBibTeXExport): string {
  const entries: string[] = [];
  const usedKeys = new Set<string>();

  // Header comment
  entries.push(`% BibTeX export from Mesh Stack: ${stack.name}`);
  entries.push(`% Exported on ${new Date().toISOString()}`);
  entries.push(`%`);
  entries.push("");

  for (const item of stack.items) {
    if (!item.block) continue;
    
    const block = item.block;
    
    // If block has a Source attached, use that for rich metadata
    if (block.source) {
      const entry = generateSourceEntry(block.source, usedKeys);
      if (entry) entries.push(entry);
      continue;
    }

    // Otherwise, create basic entry from block metadata
    const entry = generateBlockEntry(block, usedKeys);
    if (entry) entries.push(entry);
  }

  if (entries.length <= 4) {
    // Only header comments, no actual entries
    entries.push("% No exportable bibliography entries found in this stack.");
  }

  return entries.join("\n");
}

/**
 * Generate BibTeX entry from a Source
 */
function generateSourceEntry(
  source: NonNullable<BlockForBibTeX["source"]>,
  usedKeys: Set<string>
): string | null {
  const key = generateUniqueKey(source.title || "untitled", source.year, usedKeys);
  const type = mapKindToBibType(source.kind);
  const fields: string[] = [];

  if (source.title) {
    fields.push(`  title = {${escapeBibTeX(source.title)}}`);
  }

  if (source.authorsJson) {
    const authors = formatAuthors(source.authorsJson);
    if (authors) {
      fields.push(`  author = {${authors}}`);
    }
  }

  if (source.year) {
    fields.push(`  year = {${source.year}}`);
  }

  if (source.container) {
    const containerField = type === "article" ? "journal" : "booktitle";
    fields.push(`  ${containerField} = {${escapeBibTeX(source.container)}}`);
  }

  if (source.publisher) {
    fields.push(`  publisher = {${escapeBibTeX(source.publisher)}}`);
  }

  if (source.volume) {
    fields.push(`  volume = {${source.volume}}`);
  }

  if (source.issue) {
    fields.push(`  number = {${source.issue}}`);
  }

  if (source.pages) {
    fields.push(`  pages = {${source.pages}}`);
  }

  if (source.doi) {
    fields.push(`  doi = {${source.doi}}`);
  }

  if (source.url) {
    fields.push(`  url = {${source.url}}`);
  }

  return `@${type}{${key},\n${fields.join(",\n")}\n}`;
}

/**
 * Generate basic BibTeX entry from block metadata
 */
function generateBlockEntry(
  block: BlockForBibTeX,
  usedKeys: Set<string>
): string | null {
  // Only create entries for blocks with meaningful metadata
  if (!block.title && !block.linkUrl) {
    return null;
  }

  const blockType = block.blockType || "pdf";
  const year = block.created_at.getFullYear();
  const key = generateUniqueKey(block.title || "untitled", year, usedKeys);
  
  const fields: string[] = [];

  if (block.title) {
    fields.push(`  title = {${escapeBibTeX(block.title)}}`);
  }

  fields.push(`  year = {${year}}`);

  if (block.linkUrl) {
    fields.push(`  url = {${block.linkUrl}}`);
  }

  if (block.linkSiteName) {
    fields.push(`  howpublished = {${escapeBibTeX(block.linkSiteName)}}`);
  }

  // Map block type to BibTeX type
  let bibType = "misc";
  if (blockType === "pdf") {
    bibType = "article"; // Assume PDFs are academic papers
  }

  // Note about the source
  fields.push(`  note = {Exported from Mesh - ${blockType} block}`);

  return `@${bibType}{${key},\n${fields.join(",\n")}\n}`;
}

/**
 * Generate a unique citation key
 */
function generateUniqueKey(
  title: string,
  year: number | null,
  usedKeys: Set<string>
): string {
  // Extract first meaningful word from title
  const words = title.split(/\s+/).filter(w => w.length > 3);
  const titleWord = words[0] || "item";
  
  const baseKey = `${titleWord}${year || "nd"}`.replace(/[^a-zA-Z0-9]/g, "");
  
  let key = baseKey;
  let counter = 1;
  while (usedKeys.has(key.toLowerCase())) {
    key = `${baseKey}${String.fromCharCode(96 + counter)}`; // a, b, c...
    counter++;
  }
  
  usedKeys.add(key.toLowerCase());
  return key;
}

/**
 * Map source kind to BibTeX entry type
 */
function mapKindToBibType(kind: string): string {
  const map: Record<string, string> = {
    article: "article",
    book: "book",
    inproceedings: "inproceedings",
    conference: "inproceedings",
    web: "misc",
    dataset: "misc",
    video: "misc",
    other: "misc",
  };
  return map[kind] || "misc";
}

/**
 * Format author array to BibTeX format
 */
function formatAuthors(authorsJson: any): string | null {
  if (!Array.isArray(authorsJson)) return null;
  
  const formatted = authorsJson
    .map((a: { family?: string; given?: string }) => {
      if (a.family && a.given) return `${a.family}, ${a.given}`;
      return a.family || a.given || "";
    })
    .filter(Boolean);
    
  return formatted.length > 0 ? formatted.join(" and ") : null;
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
