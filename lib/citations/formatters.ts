// lib/citations/formatters.ts
export type SourceLike = {
    kind?: string; title?: string; authorsJson?: any; year?: number;
    container?: string; publisher?: string; doi?: string; url?: string;
    platform?: string; accessedAt?: string | Date; archiveUrl?: string | null;
  };
  
  function formatAuthors(authorsJson: any): string {
    const arr = Array.isArray(authorsJson) ? authorsJson : [];
    if (!arr.length) return '';
    const first = (a:any)=>[a?.family, a?.given].filter(Boolean).join(', ');
    if (arr.length === 1) return first(arr[0]);
    if (arr.length === 2) return `${first(arr[0])} & ${first(arr[1])}`;
    return `${first(arr[0])} et al.`;
  }
  
  export function formatCasualWeb(s: SourceLike) {
    const parts: string[] = [];
    const who = formatAuthors(s.authorsJson) || s.platform || s.container || '';
    if (who) parts.push(who);
    if (s.year) parts.push(String(s.year));
    if (s.title) parts.push(`“${s.title}”`);
    const host = s.container && s.container !== s.platform ? s.container : '';
    if (host) parts.push(host);
    if (s.url) parts.push(s.url);
    if (s.accessedAt) parts.push(`accessed ${new Date(s.accessedAt).toLocaleDateString()}`);
    if (s.archiveUrl) parts.push(`archived ${s.archiveUrl}`);
    return parts.filter(Boolean).join(' · ');
  }
  
  // Minimal MLA-ish
  export function formatMLA(s: SourceLike) {
    const a = formatAuthors(s.authorsJson);
    const y = s.year ? ` (${s.year})` : '';
    const c = s.container ? `, *${s.container}*` : '';
    const doi = s.doi ? `. doi:${s.doi}` : s.url ? `. ${s.url}` : '';
    return [a, s.title ? `“${s.title}”` : '', c, y, doi].filter(Boolean).join('');
  }
  