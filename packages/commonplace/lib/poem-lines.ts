/**
 * Poem-aware line extraction from a Tiptap JSON document.
 *
 * Unlike {@link extractPlainText}, which collapses all whitespace for search,
 * this preserves poetic structure so it can be diffed line-by-line:
 *  - Within a block, `hardBreak` nodes split the text into separate lines.
 *  - An *empty* block (an empty paragraph) is a stanza break, emitted as an
 *    empty-string line.
 *
 * This mirrors how the editor and the read view represent a poem: each line is
 * its own paragraph (or a hard-broken line) and stanzas are separated by an
 * empty paragraph. Consecutive blank lines collapse to one; leading/trailing
 * blanks are trimmed.
 */
export function extractPoemLines(doc: unknown): string[] {
  const blocks = topLevelBlocks(doc);

  const lines: string[] = [];
  for (const block of blocks) {
    const content = (block as { content?: unknown[] }).content;
    if (!Array.isArray(content) || content.length === 0) {
      // Empty paragraph → stanza break.
      lines.push("");
      continue;
    }
    for (const line of splitInlineIntoLines(content)) lines.push(line);
  }

  // Collapse runs of blank lines to a single stanza break.
  const collapsed: string[] = [];
  for (const line of lines) {
    if (line === "" && collapsed[collapsed.length - 1] === "") continue;
    collapsed.push(line);
  }

  // Trim leading/trailing blank lines.
  while (collapsed.length && collapsed[0] === "") collapsed.shift();
  while (collapsed.length && collapsed[collapsed.length - 1] === "")
    collapsed.pop();
  return collapsed;
}

/**
 * The ordered top-level blocks of the document (paragraphs, headings, …). Falls
 * back to treating the node itself as a single block if it isn't a doc.
 */
function topLevelBlocks(doc: unknown): unknown[] {
  if (!doc || typeof doc !== "object") return [];
  const n = doc as { type?: string; content?: unknown[] };
  if (n.type === "doc" && Array.isArray(n.content)) return n.content;
  if (Array.isArray(n.content)) return [n];
  return [];
}

function splitInlineIntoLines(content: unknown[]): string[] {
  const lines: string[] = [];
  let current = "";
  for (const child of content) {
    const c = child as { type?: string; text?: string };
    if (c.type === "hardBreak") {
      lines.push(current.replace(/\s+$/, ""));
      current = "";
    } else if (typeof c.text === "string") {
      current += c.text;
    }
  }
  lines.push(current.replace(/\s+$/, ""));
  return lines;
}

