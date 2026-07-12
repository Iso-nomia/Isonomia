// lib/text/urls.ts
export function extractUrls(text: string): string[] {
    if (!text) return [];
    // Simple, robust enough for MVP (http/https only, stops at whitespace)
    const re = /\bhttps?:\/\/[^\s<>"')\]]+/gi;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of text.match(re) ?? []) {
      const u = m.trim();
      if (!seen.has(u)) { seen.add(u); out.push(u); }
    }
    return out.slice(0, 8); // cap to avoid spam
  }