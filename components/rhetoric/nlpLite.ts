// components/rhetoric/nlpLite.ts
'use client';

import type { Hit, Category } from './detectors';

function span(text: string, start: number, end: number, cat: Category, match?: string): Hit | null {
  if (start < 0 || end <= start || end > text.length) return null;
  return { cat, start, end, match: match ?? text.slice(start, end) };
}

type CompTerm = { text: string; tags?: string[]; offset?: { start: number; length: number } };
type CompSent = { text: string; terms?: CompTerm[] };
type CompDoc = { text: string; sentences?: CompSent[] };

// ---------- normalization ----------
function normalize(s: string): string {
  return s
    .replace(/\u00A0/g, ' ')         // NBSP → space
    .replace(/[“”]/g, '"')           // smart quotes → ASCII
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')            // collapse weird spacing
    .trim();
}

// ---- helpers for deontic-passive skipping and parallelism ----
const MODALS = /\b(must|will|shall|should|cannot|can|could|may|might|would)\b/i;

function isDeonticPassiveWindow(text: string, startIndex: number): boolean {
  // look back ~25 chars for a modal before "be <participle>"
  const from = Math.max(0, startIndex - 25);
  const window = text.slice(from, startIndex);
  return MODALS.test(window);
}

// detect repeated "pronoun|proper|noun + verb" across comma-separated clauses
function findRepeatedClauseParallelism(text: string): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  const re = /\b((?:we|you|they|he|she|it|[A-Z][a-z]+)\s+[a-z]{3,})\b(?:[^.?!]*?,\s*\1\b){2,}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    spans.push({ start: m.index, end: m.index + m[0].length });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return spans;
}

async function loadCompromise(): Promise<any | null> {
  try {
    const m: any = await import('compromise');
    return m.default || m;
  } catch { return null; }
}

function sentSpanFromJson(text: string, s: CompSent): { start: number; end: number } {
  if (s.terms && s.terms.length && s.terms[0].offset) {
    const first = s.terms[0].offset!;
    const last = s.terms[s.terms.length - 1].offset!;
    return { start: first.start, end: last.start + last.length };
  }
  const idx = text.indexOf(s.text);
  return { start: idx >= 0 ? idx : 0, end: idx >= 0 ? idx + s.text.length : 0 };
}

const CERTAIN = new Set(['must','will','shall','should','cannot',"can't"]);
const UNCERTAIN = new Set(['may','might','could','would','can']);

const IMP_START = [
  'consider','note','remember','imagine','ensure','make','keep','add','remove','try','compare','check','update',
  'confirm','submit','follow','click','read','see','look','use','provide','explain','prove','show','think','avoid'
];

function looksImperativeText(sentenceText: string): boolean {
  const t = sentenceText.trim();
  if (t.length < 6) return false;
  if (/^please\s+[a-z]{3,}/i.test(t)) return true; // explicit
  const m = /^([a-z]{3,})\b/i.exec(t);
  if (!m) return false;
  const first = m[1].toLowerCase();
  return IMP_START.includes(first); // curated bare-verb list
}

function looksImperativeTags(s: CompSent): boolean {
  if (!s.terms || s.terms.length === 0) return false;
  const terms = s.terms.filter(t => (t.text || '').trim().length > 0);
  if (!terms.length) return false;
  const t0 = terms[0];
  const tags = (t0.tags || []).map(x=>x.toLowerCase());
  // compromise tags like 'Verb', 'Pronoun', 'Noun', 'Adjective', 'Auxiliary', 'PastTense', 'Gerund'
  const isVerbStart = tags.includes('verb') && !tags.includes('pasttense') && !tags.includes('gerund') && !tags.includes('auxiliary');
  const badStarts = ['pronoun','noun','adjective','determiner'];
  const startsBad = badStarts.some(b => tags.includes(b));
  return isVerbStart && !startsBad;
}

export type NlpOptions = Partial<{
  imperatives: boolean;
  passives: boolean;
  nominalizations: boolean;
  parallelism: boolean;
  modals: boolean;
  negation: boolean;
  pronouns: boolean;
  markDeonticPassive: boolean;   // NEW (default false): mark "must be adopted" as passive
}>;

const DEFAULT_OPTS: Required<Omit<NlpOptions, 'markDeonticPassive'>> & { markDeonticPassive: boolean } = {
  imperatives: true,
  passives: true,
  nominalizations: true,
  parallelism: true,
  modals: true,
  negation: true,
  pronouns: true,
  markDeonticPassive: false,
};

export async function analyzeNlp(rawText: string, opts?: NlpOptions): Promise<Hit[]> {
  const o = { ...DEFAULT_OPTS, ...(opts || {}) };
  const text = normalize(rawText);
  const nlp = await loadCompromise();
  const hits: Hit[] = [];

  // ---------------- REGEX FALLBACK BRANCH ----------------
  if (!nlp) {
    if (o.imperatives) {
      // start-of-sentence "please + verb" OR one of our imperative verbs (NO "must" here)
      const re = /(^|[.?!]\s+)(please\s+[a-z]{3,}|(?:consider|note|remember|imagine|ensure|make|keep|add|remove|try|compare|check|update|confirm|submit|follow|click|read|see|look|use|provide|explain|prove|show|think|avoid)\b)[^.?!]*[.?!]/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const s0 = m.index + (m[1]?.length || 0);
        const chunk = m[0].slice(m[1]?.length || 0);
        if (chunk.trim().length >= 6) {
          const h = span(text, s0, s0 + chunk.length, 'imperative');
          if (h) hits.push(h);
        }
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      // include inclusive imperative "let's ..."
      const lets = /(^|[.?!]\s+)let['’]s\s+[a-z]{3,}[^.?!]*[.?!]/gi;
      let lm: RegExpExecArray | null;
      while ((lm = lets.exec(text))) {
        const s0 = lm.index + (lm[1]?.length || 0);
        const chunk = lm[0].slice(lm[1]?.length || 0);
        const h = span(text, s0, s0 + chunk.length, 'imperative');
        if (h) hits.push(h);
        if (lets.lastIndex === lm.index) lets.lastIndex++;
      }
    }

    if (o.passives) {
      const re = /\b(is|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (!o.markDeonticPassive && isDeonticPassiveWindow(text, m.index)) continue;
        const h = span(text, m.index, m.index + m[0].length, 'passive');
        if (h) hits.push(h);
      }
    }

    if (o.nominalizations) {
      const re = /\b\w+(?:tion|sion|ment|ness|ity|ance|ence|ship|al)\b/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const h = span(text, m.index, m.index + m[0].length, 'nominalization');
        if (h) hits.push(h);
      }
    }

    if (o.parallelism) {
      // prepositional tricolon (of/by/for/to/in/with)
      const re = /\b((?:of|by|for|to|in|with)\s+the\s+\w+)(?:\s*,\s*(?:of|by|for|to|in|with)\s+the\s+\w+){2,}(?:\s*(?:,|\band\b)\s*(?:of|by|for|to|in|with)\s+the\s+\w+)*\b/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const h = span(text, m.index, m.index + m[0].length, 'parallelism');
        if (h) hits.push(h);
      }
      // repeated (pronoun|noun)+verb clauses
      for (const sp of findRepeatedClauseParallelism(text)) {
        const h = span(text, sp.start, sp.end, 'parallelism');
        if (h) hits.push(h);
      }
    }

    if (o.modals) {
      const re = /\b(can(?:not)?|can't|could|may|might|must|shall|should|will|would)\b/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const w = m[0].toLowerCase();
        const cat: Category = CERTAIN.has(w) ? 'modal-certainty' : 'modal-uncertainty';
        const h = span(text, m.index, m.index + m[0].length, cat, w);
        if (h) hits.push(h);
      }
    }

    if (o.negation) {
      // "no|not|never" within a short window; include "without ..."
      const re = /\b(no|not|never|without)\b(?:\s+\w+){0,5}/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        const h = span(text, m.index, m.index + m[0].length, 'negation');
        if (h) hits.push(h);
      }
    }

    if (o.pronouns) {
      const reYou = /\b(you|your|yours|yourself|yourselves)\b/gi;
      const reWe = /\b(we|us|our|ours|ourselves)\b/gi;
      let m: RegExpExecArray | null;
      while ((m = reYou.exec(text))) {
        const h = span(text, m.index, m.index + m[0].length, 'pronoun-you');
        if (h) hits.push(h);
      }
      while ((m = reWe.exec(text))) {
        const h = span(text, m.index, m.index + m[0].length, 'pronoun-we');
        if (h) hits.push(h);
      }
    }

    return hits;
  }

  // ---------------- COMPROMISE BRANCH ----------------
  const doc = nlp(text);
  const sents: CompSent[] = (doc as any).sentences().json({ offset: true, terms: true }) as any;

  // Imperatives: tags or "please + verb" or "let's + verb" (no "must")
  if (o.imperatives) {
    sents.forEach((s) => {
      const t = s.text || '';
      if (t.trim().length < 6) return;
      const { start, end } = sentSpanFromJson(text, s);
      if (looksImperativeText(t) || looksImperativeTags(s) || /^let['’]s\s+[a-z]{3,}/i.test(t.trim())) {
        const h = span(text, start, end, 'imperative');
        if (h) hits.push(h);
      }
    });
    const impRe = /(^|[.?!]\s+)\s*(please\s+[a-z]{3,}|(?:consider|note|remember|imagine|ensure|make|keep|add|remove|try|compare|check|update|confirm|submit|follow|click|read|see|look|use|provide|explain|prove|show|think|avoid)\b|let['’]s\s+[a-z]{3,})[^.?!]*/gi;
    let im: RegExpExecArray | null;
    while ((im = impRe.exec(text))) {
      const s0 = im.index + (im[1]?.length || 0);
      const chunk = im[0].slice(im[1]?.length || 0);
      if (chunk.trim().length >= 6) {
        const h = span(text, s0, s0 + chunk.length, 'imperative');
        if (h) hits.push(h);
      }
      if (impRe.lastIndex === im.index) impRe.lastIndex++;
    }
  }

  // Passive: tag-based + fallback regex; skip deontic unless opted in
  if (o.passives) {
    const m = doc.match('(#Copula|#Auxiliary) #Adverb? #PastTense');
    const arr = m.json({ offset: true }) as any as CompDoc[];
    arr.forEach((chunk) => {
      const ss = chunk.sentences?.[0];
      const terms = ss?.terms || [];
      if (terms.length && terms[0].offset) {
        const s0 = terms[0].offset!.start;
        const e0 = terms[terms.length - 1].offset!;
        if (!o.markDeonticPassive && isDeonticPassiveWindow(text, s0)) {
          // skip deontic passive
        } else {
          const h = span(text, s0, e0.start + e0.length, 'passive');
          if (h) hits.push(h);
        }
      } else {
        const idx = text.indexOf(chunk.text);
        if (idx >= 0) {
          if (!o.markDeonticPassive && isDeonticPassiveWindow(text, idx)) {
            // skip
          } else {
            const h = span(text, idx, idx + chunk.text.length, 'passive');
            if (h) hits.push(h);
          }
        }
      }
    });
    const passRe = /\b(is|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/gi;
    let pm: RegExpExecArray | null;
    while ((pm = passRe.exec(text))) {
      if (!o.markDeonticPassive && isDeonticPassiveWindow(text, pm.index)) continue;
      const h = span(text, pm.index, pm.index + pm[0].length, 'passive');
      if (h) hits.push(h);
    }
  }

  // Parallelism: same as fallback + small clause-based refinement
  if (o.parallelism) {
    const re = /\b((?:of|by|for|to|in|with)\s+the\s+\w+)(?:\s*,\s*(?:of|by|for|to|in|with)\s+the\s+\w+){2,}(?:\s*(?:,|\band\b)\s*(?:of|by|for|to|in|with)\s+the\s+\w+)*\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const h = span(text, m.index, m.index + m[0].length, 'parallelism');
      if (h) hits.push(h);
    }
    for (const sp of findRepeatedClauseParallelism(text)) {
      const h = span(text, sp.start, sp.end, 'parallelism');
      if (h) hits.push(h);
    }
    // clause-level heuristic: first two tokens repeated across 3+ segments
    sents.forEach((s) => {
      const t = (s.text || '').trim();
      if (!t.includes(',')) return;
      const segs = t.split(',').map(x => x.trim()).filter(Boolean);
      if (segs.length < 3) return;
      const pattern = segs.map(seg => {
        const m2 = /^((?:we|you|they|he|she|it|[A-Z][a-z]+)\s+[a-z]{3,})\b/i.exec(seg);
        return m2 ? m2[1].toLowerCase() : null;
      }).filter(Boolean) as string[];
      const distinct = new Set(pattern);
      if (pattern.length >= 3 && distinct.size <= 2) {
        const { start, end } = sentSpanFromJson(text, s);
        const h = span(text, start, end, 'parallelism');
        if (h) hits.push(h);
      }
    });
  }

  // Modals: tag + fallback regex
  if (o.modals) {
    const toks = (doc.terms().json({ offset: true, terms: true }) as any) as CompDoc[];
    toks.forEach((tk) => {
      const w = (tk.text || '').toLowerCase();
      const t0 = tk.sentences?.[0]?.terms?.[0];
      if (!w || !t0?.offset) return;
      if (CERTAIN.has(w)) {
        const h = span(text, t0.offset.start, t0.offset.start + t0.offset.length, 'modal-certainty', w);
        if (h) hits.push(h);
      } else if (UNCERTAIN.has(w)) {
        const h = span(text, t0.offset.start, t0.offset.start + t0.offset.length, 'modal-uncertainty', w);
        if (h) hits.push(h);
      }
    });
    const modalRe = /\b(can(?:not)?|can't|could|may|might|must|shall|should|will|would)\b/gi;
    let mm: RegExpExecArray | null;
    while ((mm = modalRe.exec(text))) {
      const w = mm[0].toLowerCase();
      const cat: Category = CERTAIN.has(w) ? 'modal-certainty' : 'modal-uncertainty';
      const h = span(text, mm.index, mm.index + mm[0].length, cat, w);
      if (h) hits.push(h);
    }
  }

  // Negation: compromise + regex (incl. "without")
  if (o.negation) {
    const neg = doc.match('#Negative .{0,5} (#Verb|#Adjective|#Noun)');
    const parts = neg.json({ offset: true, terms: true }) as any as CompDoc[];
    parts.forEach((p) => {
      const terms = p.sentences?.[0]?.terms || [];
      if (!terms.length || !terms[0].offset) return;
      const s0 = terms[0].offset!.start;
      const e0 = terms[terms.length - 1].offset!;
      const h = span(text, s0, e0.start + e0.length, 'negation', p.text);
      if (h) hits.push(h);
    });
    const reNo = /\b(no|not|never|without)\b(?:\s+\w+){0,5}/gi;
    let nm: RegExpExecArray | null;
    while ((nm = reNo.exec(text))) {
      const h = span(text, nm.index, nm.index + nm[0].length, 'negation');
      if (h) hits.push(h);
    }
  }

  // Pronouns: compromise + fallback
  if (o.pronouns) {
    const you = doc.match('(you|your|yours|yourself|yourselves)').json({ offset: true, terms: true }) as any as CompDoc[];
    you.forEach((p) => {
      const t = p.sentences?.[0]?.terms?.[0];
      if (t?.offset) {
        const h = span(text, t.offset.start, t.offset.start + t.offset.length, 'pronoun-you', p.text);
        if (h) hits.push(h);
      }
    });
    const we = doc.match('(we|us|our|ours|ourselves)').json({ offset: true, terms: true }) as any as CompDoc[];
    we.forEach((p) => {
      const t = p.sentences?.[0]?.terms?.[0];
      if (t?.offset) {
        const h = span(text, t.offset.start, t.offset.start + t.offset.length, 'pronoun-we', p.text);
        if (h) hits.push(h);
      }
    });
    const reYou = /\b(you|your|yours|yourself|yourselves)\b/gi;
    const reWe = /\b(we|us|our|ours|ourselves)\b/gi;
    let ym: RegExpExecArray | null;
    while ((ym = reYou.exec(text))) {
      const h = span(text, ym.index, ym.index + ym[0].length, 'pronoun-you');
      if (h) hits.push(h);
    }
    while ((ym = reWe.exec(text))) {
      const h = span(text, ym.index, ym.index + ym[0].length, 'pronoun-we');
      if (h) hits.push(h);
    }
  }

  return hits;
}
