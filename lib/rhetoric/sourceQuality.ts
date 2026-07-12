// lib/rhetoric/sourceQuality.ts
export type SourceClass =
  | 'peerreview'  // doi:/pubmed:/nature.com/nejm.org/etc
  | 'preprint'    // arxiv.org, biorxiv, osf.io
  | 'gov'         // .gov / who.int / ecdc etc.
  | 'edu'         // .edu, university domains
  | 'ngo'         // reputable NGOs, e.g., unicef, oxfam
  | 'news_t1'     // tier-1 (AP/Reuters/FT/WSJ/NYT/etc.)
  | 'news_t2'     // tier-2 regional
  | 'blog_forum'  // medium/substack/reddit etc.
  | 'unknown';

export type EvidenceSignals = {
  hasDOI: boolean;
  hasArXiv: boolean;
  hasYear: boolean;
  hasQuant: boolean;  // %/ratio/CI/etc in vicinity
};

export type SourceGrade = {
  cls: SourceClass;
  score: number;      // 0..1
  signals: EvidenceSignals;
  url?: string;
};

const RX = {
  DOI: /\bdoi:\s*\S+/i,
  ARXIV: /\barXiv:\s*\d{4}\.\d{4,5}\b/i,
  YEAR: /\b(19|20)\d{2}\b/,
  QUANT: /\b\d+(?:\.\d+)?\s?(%|percent|ratio|CI|R²|p[<=>])\b/i,
};

const TIER_1 = ['apnews.com','reuters.com','ft.com','wsj.com','nytimes.com','economist.com','nature.com','science.org'];
const GOV = [/\.gov\b/i,'who.int','ecdc.europa.eu','cdc.gov','nih.gov'];
const EDU = [/\.edu\b/i];
const PREPRINT = ['arxiv.org','biorxiv.org','osf.io'];

function host(url: string) {
  try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; }
}
function anyMatch(h: string, ls: (string|RegExp)[]) {
  return ls.some(x => typeof x === 'string' ? h.endsWith(x) : x.test(h));
}

export function classifySource(url: string, contextText = ''): SourceGrade {
  const h = host(url);
  const hasDOI = RX.DOI.test(contextText) || /doi\.org\//i.test(url);
  const hasArXiv = RX.ARXIV.test(contextText) || /arxiv\.org\//i.test(url);
  const hasYear = RX.YEAR.test(contextText);
  const hasQuant = RX.QUANT.test(contextText);

  let cls: SourceClass = 'unknown';
  if (hasDOI || anyMatch(h, ['nature.com','science.org','nejm.org','thelancet.com','jama.com'])) cls = 'peerreview';
  else if (anyMatch(h, PREPRINT)) cls = 'preprint';
  else if (anyMatch(h, GOV)) cls = 'gov';
  else if (anyMatch(h, EDU)) cls = 'edu';
  else if (anyMatch(h, TIER_1)) cls = 'news_t1';
  else if (/\b(news|times|post|chronicle)\b/i.test(h)) cls = 'news_t2';
  else if (/\b(medium|substack|wordpress|blogspot|reddit|hackernews|lesswrong)\b/i.test(h)) cls = 'blog_forum';

  const base =
    cls === 'peerreview' ? 0.95 :
    cls === 'preprint'   ? 0.75 :
    cls === 'gov'        ? 0.85 :
    cls === 'edu'        ? 0.8 :
    cls === 'news_t1'    ? 0.7 :
    cls === 'news_t2'    ? 0.55 :
    (cls as SourceClass) === 'ngo' ? 0.65 :
    cls === 'blog_forum' ? 0.35 :
    0.5;

  const up = (hasDOI ? 0.05 : 0) + (hasArXiv ? 0.03 : 0) + (hasQuant ? 0.03 : 0);
  const score = Math.min(1, Math.max(0, base + up));
  return { cls, score, signals: { hasDOI, hasArXiv, hasYear, hasQuant }, url };
}

/** Extract URLs from a text (simple) */
export function extractUrls(text: string): string[] {
  const rx = /\bhttps?:\/\/[^\s)]+/g;
  return Array.from(text.match(rx) || []);
}
