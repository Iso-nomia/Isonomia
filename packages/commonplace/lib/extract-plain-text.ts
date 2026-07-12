/**
 * Extract searchable plaintext from a Tiptap JSON document.
 * Walks the doc tree concatenating text nodes; inserts a single space at
 * block boundaries to preserve word separation.
 */
export function extractPlainText(doc: unknown): string {
  const out: string[] = [];
  walk(doc, out);
  return out.join("").replace(/\s+/g, " ").trim();
}

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; text?: string; content?: unknown[] };

  if (typeof n.text === "string") {
    out.push(n.text);
  }

  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      walk(child, out);
    }
    // Block boundary
    if (n.type && n.type !== "text") {
      out.push(" ");
    }
  }
}
