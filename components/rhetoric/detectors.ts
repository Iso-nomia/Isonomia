// components/rhetoric/detectors.ts
export type Category =
  | 'hedge' | 'booster' | 'absolute'
  | 'rhet-question'
  | 'analogy' | 'metaphor'
  | 'connective-support' | 'connective-result' | 'connective-contrast' | 'connective-concession' | 'connective-condition'
  | 'weasel' | 'evidence'
  | 'ethos' | 'pathos' | 'logos'
  | 'allcaps'
  | 'exclaim'               // 👈 add this

  // ↓ Layer B cues
  | 'imperative' | 'passive' | 'nominalization' | 'parallelism'
  | 'negation' | 'modal-certainty' | 'modal-uncertainty'
  | 'pronoun-you' | 'pronoun-we'
   // ↓ Layer C (lexicons)
   | 'affect-positive' | 'affect-negative'
   | 'frame-economic' | 'frame-morality' | 'frame-security' | 'frame-fairness' | 'frame-capacity'
  // NEW — inference type (Layer A/B hybrid)

   | 'inference-deductive' | 'inference-inductive' | 'inference-abductive';




const DEDUCTIVE = [
    'therefore','thus','hence','it follows that','implies that','entails that','we conclude that','deduce that'
  ];
  const INDUCTIVE = [
    'probably','likely','suggests that','tends to','on average','in general','typically','the data indicate'
  ];
  const ABDUCTIVE = [
    'best explanation','inference to the best explanation','ibe','would explain','accounts for','explains why','makes sense of'
  ];

  
function scanPhrases(text: string, phrases: string[], cat: Category): Hit[] {
    if (!phrases.length) return [];
    const sorted = [...phrases].sort((a,b)=>b.length-a.length).map(p => p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'));
    const re = new RegExp(`\\b(?:${sorted.join('|')})\\b`,'gi');
    return scanRegex(text, re, cat);
  }


export type Hit = { cat: Category; start: number; end: number; match: string; meta?: string };

const RX = {
  URL: /https?:\/\/[^\s)]+/ig,
  DOI: /\bdoi:\s*\S+/ig,
  NUM: /\b\d+(?:\.\d+)?\s?(%|percent|k|m|million|billion|years?)\b/ig,
  YEAR: /\b(19|20)\d{2}\b/g,
  ALLCAPS: /\b[A-Z]{3,}\b/g,
};

// Keep lists small (precision > recall). Users can extend via settings later.
const HEDGES = ['might','could','seems','appear','appears','likely','perhaps','possibly','arguably','tend to'];
const BOOSTERS = ['obviously','clearly','undeniably','certainly','evidently'];
const ABSOLUTES = ['always','never','everyone','no one','nobody','nothing','entire','entirely','completely'];

const ANALOGY = ['like','as if','as though','akin to','similar to'];
const WEASELS = ['so‑called','people say','it’s known that','many believe','studies show']; // tiny, extend later

const CONN_SUPPORT = ['because','since','given that'];
const CONN_RESULT = ['therefore','thus','hence','as a result','consequently'];
const CONN_CONTRAST = ['however','but','whereas','on the other hand'];
const CONN_CONCESSION = ['although','even though','despite'];
const CONN_CONDITION = ['if','unless','provided that'];

const ETHOS = ['dr.','prof','phd','md','nobel','fellow','chair','harvard','mit','stanford','expert','years of experience'];
const PATHOS = ['outrageous','shocking','heartbreaking','disaster','crisis','threat','fear','hope','devastating','tragic'];
// LOGOS = signals we already detect: numbers/causal/result connectives. We count them later.




export const SOFT_ALTS: Record<string, string[]> = {
  always: ['often','usually'],
  never: ['rarely','seldom'],
  everyone: ['many people','most people'],
  'no one': ['few people','hardly anyone'],
  obviously: ['it appears','it seems'],
  clearly: ['arguably','it seems'],
  undeniably: ['very likely','strongly suggests'],
};

function scanList(text: string, words: string[], cat: Category): Hit[] {
  if (!words.length) return [];
  // join with order by longer phrases first (e.g., 'as a result' before 'as')
  const sorted = [...words].sort((a,b)=>b.length-a.length).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(?:${sorted.join('|')})\\b`, 'gi');
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    hits.push({ cat, start: m.index, end: m.index + m[0].length, match: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return hits;
}

function scanRegex(text: string, re: RegExp, cat: Category): Hit[] {
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = rx.exec(text))) {
    hits.push({ cat, start: m.index, end: m.index + m[0].length, match: m[0] });
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }
  return hits;
}

function scanRhetoricalQuestions(text: string): Hit[] {
  // mark sentences that end with ? or start with leading forms
  const hits: Hit[] = [];
  const reEnd = /[^.?!]*\?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = reEnd.exec(text))) {
    const start = m.index;
    const end = m.index + m[0].length;
    hits.push({ cat: 'rhet-question', start, end, match: m[0].trim() });
    if (m.index === reEnd.lastIndex) reEnd.lastIndex++;
  }
  return hits;
}

function scanMetaphor(text: string): Hit[] {
  // super-naive "X is a Y" pattern, skip obvious copulas like "there is a"
  const re = /\b(?!there)\w{3,}\s+is\s+(?:a|an)\s+\w{3,}\b/gi;
  return scanRegex(text, re, 'metaphor');
}

// Skip highlighting inside URLs
function excludeInside(text: string, hits: Hit[], maskRe: RegExp): Hit[] {
  const masks: Array<{ s: number; e: number }> = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(maskRe.source, maskRe.flags.includes('g') ? maskRe.flags : maskRe.flags + 'g');
  while ((m = rx.exec(text))) masks.push({ s: m.index, e: m.index + m[0].length });
  if (!masks.length) return hits;
  return hits.filter(h => !masks.some(ms => h.start >= ms.s && h.end <= ms.e));
}

export type Analysis = {
  hits: Hit[];
  counts: Partial<Record<Category, number>>;
  words: number;
};

export function analyzeText(text: string): Analysis {
  const words = (text.match(/\b\w+\b/g) || []).length;

  let hits: Hit[] = [
    ...scanList(text, HEDGES, 'hedge'),
    ...scanList(text, BOOSTERS, 'booster'),
    ...scanList(text, ABSOLUTES, 'absolute'),
    ...scanRhetoricalQuestions(text),

    ...scanList(text, ANALOGY, 'analogy'),
    ...scanMetaphor(text),

    ...scanList(text, CONN_SUPPORT, 'connective-support'),
    ...scanList(text, CONN_RESULT, 'connective-result'),
    ...scanList(text, CONN_CONTRAST, 'connective-contrast'),
    ...scanList(text, CONN_CONCESSION, 'connective-concession'),
    ...scanList(text, CONN_CONDITION, 'connective-condition'),

    ...scanList(text, WEASELS, 'weasel'),
    ...scanRegex(text, RX.URL, 'evidence'),
    ...scanRegex(text, RX.DOI, 'evidence'),
    ...scanRegex(text, RX.NUM, 'evidence'),
    ...scanRegex(text, RX.YEAR, 'evidence'),

    ...scanList(text, ETHOS, 'ethos'),
    ...scanList(text, PATHOS, 'pathos'),
    // logos is proximal: numbers/causal/result connectives — count derived below
    ...scanRegex(text, RX.ALLCAPS, 'allcaps'),

    ...scanPhrases(text, DEDUCTIVE, 'inference-deductive'),
    ...scanPhrases(text, INDUCTIVE, 'inference-inductive'),
    ...scanPhrases(text, ABDUCTIVE, 'inference-abductive'),
    
  ];
  hits = pruneAnalogyFalsePositives(text, hits);
  // derive logos by counting evidence + support/result connectives
  const logosCount =
    hits.filter(h => h.cat === 'evidence' || h.cat === 'connective-support' || h.cat === 'connective-result').length;

//   hits = excludeInside(text, hits, RX.URL); // don't mark inside URLs
//   hits = excludeInside(text, hits, RX.URL);

hits = excludeInside(text, hits, RX.URL); // don't mark inside URLs
  // counts
  const counts: Partial<Record<Category, number>> = {};
  hits.forEach(h => (counts[h.cat] = (counts[h.cat] || 0) + 1));
  if (logosCount) counts['logos'] = (counts['logos'] || 0) + logosCount;

  return { hits, counts, words: words || 1 };
}

export function analyzeMany(texts: string[]): Analysis {
  return texts.reduce<Analysis>((acc, t) => {
    const a = analyzeText(t);
    a.hits.forEach(h => acc.hits.push(h));
    Object.entries(a.counts).forEach(([k, v]) => (acc.counts[k as Category] = (acc.counts[k as Category] || 0) + (v || 0)));
    acc.words += a.words;
    return acc;
  }, { hits: [], counts: {}, words: 1 });
}

export function densityPer100(a: Analysis): number {
  return Math.round((a.hits.length / a.words) * 10000) / 100;
}

function pruneAnalogyFalsePositives(text: string, hits: Hit[]): Hit[] {
    const BAD_PREV = /\b(feel(?:s|t|ing)?|look(?:s|ed|ing)?|sound(?:s|ed|ing)?)\s+$/i;
    return hits.filter(h => {
      if (h.cat !== 'analogy') return true;
      // look ~12 chars before the match
      const prev = text.slice(Math.max(0, h.start - 12), h.start);
      return !BAD_PREV.test(prev);
    });
  }
  