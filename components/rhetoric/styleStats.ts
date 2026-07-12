// rhetoric/styleStats.ts
export type StyleCounts = {
    hedges: number; boosters: number; absolutes: number;
    analogy: number; metaphor: number; allCaps: number; rq: number; // rhetorical questions
    tokens: number;
  };
  
  const HEDGES = ['might','could','appears','seems','likely','suggests','perhaps','possibly','arguably'];
  const BOOSTERS = ['very','extremely','incredibly','undeniably','obviously','clearly','certainly','always']; // 'always' also in absolutes list—dedupe in counting
  const ABSOLUTES = ['always','never','everyone','no one','nobody','all of us','none of us'];
  const ANALOGY = ['like','as if','as though','akin to'];
  const METAPHOR = [' is a ',' becomes ',' turns into '];
  
  export const SOFT_ALTS: Record<string, string[]> = {
    always: ['often','frequently','in many cases'],
    never: ['rarely','seldom','almost never'],
    obviously: ['it appears','it seems','it is plausible that'],
    clearly: ['it seems','it appears','it’s likely that'],
    undeniably: ['strongly','very likely','compellingly'],
    everyone: ['most people','many people','a lot of people'],
    'no one': ['few people','hardly anyone'],
  };
  
  function countWholeWord(text: string, words: string[]) {
    const re = new RegExp(`\\b(${words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`, 'gi');
    return (text.match(re) || []).length;
  }
  function countPhrases(text: string, phrases: string[]) {
    let n = 0; const t = text.toLowerCase();
    phrases.forEach(p => { const idx = t.indexOf(p.trim().toLowerCase()); if (idx >= 0) n++; });
    return n;
  }
  export function computeStyleCounts(text: string): StyleCounts {
    const tokens = (text.match(/\b\w+\b/g) || []).length || 1;
    const hedges = countWholeWord(text, HEDGES);
    const boosters = countWholeWord(text, BOOSTERS);
    const absolutes = countWholeWord(text, ABSOLUTES);
    const analogy = countWholeWord(text, ANALOGY);
    const metaphor = countPhrases(` ${text} `, METAPHOR); // padded spaces for " is a "
    const allCaps = (text.match(/(?:^|\s)([A-Z]{3,})(?=$|\s)/g) || []).length;
    const rq = (text.match(/\?\s*$/gm) || []).length;
    return { hedges, boosters, absolutes, analogy, metaphor, allCaps, rq, tokens };
  }
  export function per100(c: StyleCounts) {
    const total = c.hedges + c.boosters + c.absolutes + c.analogy + c.metaphor + c.allCaps + c.rq;
    return Math.round((total / c.tokens) * 10000) / 100; // 2 decimals
  }
  