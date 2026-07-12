// components/rhetoric/schemeSignals.ts
export type SchemeKey =
  | 'ExpertOpinion'       // a.k.a. argument from authority
  | 'Analogy'
  | 'Pragmatic'           // a.k.a. argument from consequences/practical reasoning
  | 'Causal'              // cause-to-effect (vs. mere correlation)
  | 'Sign'                // symptomatic/indicator
  | 'PopularOpinion';     // ad populum / majority view

export type CueHit = { label: string; start: number; end: number; match: string };
export type CueSet = Record<string, RegExp[]>;

export type SchemeSpec = {
  title: string;
  cues: CueSet;               // label -> regexes to scan
  suggest?: string;           // short nudge shown when cues fire
  // optional “guardrail” CQ keys (only used as a fallback if you don't have open-by-scheme)
  cqGuardrails?: string[];    // depends on your CQ keys; keep short
};

// --- lightweight cue lists ---
// keep them tiny and readable; add to taste
const RX = {
  // ethos-ish titles/affiliations/credentials
  ETHOS: /\b(dr\.|prof(?:essor)?|md|ph\.?d|nobel|harvard|mit|stanford|fellow|chair)\b/i,
  BOOST: /\b(obviously|undeniably|clearly|certainly)\b/i,
  HEDGE: /\b(might|could|seems?|appears|likely|perhaps|possibly)\b/i,

  ANALOGY: /\b(like|as if|as though|akin to|similar to)\b/i,
  CONSEQ: /\b(will (?:lead to|result in|cause)|consequently|therefore|thus|risk|benefit|cost)\b/i,
  CAUSAL: /\b(because|due to|causes?|caused by|leads? to|results? in)\b/i,
  SIGN:   /\b(sign|indicator|symptom|hallmark|proxy|signal)\b/i,
  POP:    /\b(everyone|most people|the majority|polls? show|consensus)\b/i,

  NUM:    /\b\d+(\.\d+)?\s?(%|percent|million|billion)\b/i,
  CITE:   /\b(doi:|https?:\/\/|arxiv\.org|journal|proceedings|report)\b/i,
};

export const SCHEME_SPECS: Record<SchemeKey, SchemeSpec> = {
  ExpertOpinion: {
    title: 'Expert Opinion',
    cues: {
      titles:   [RX.ETHOS],
      boosters: [RX.BOOST],
      hedges:   [RX.HEDGE],
      evidence: [RX.CITE, RX.NUM],
    },
    suggest: 'Name the field, credentials & source; check trustworthiness/consensus.',
    // example guardrails — adapt to your CQ key names
    cqGuardrails: ['field', 'trustworthiness', 'consensus', 'backing'],
  },
  Analogy: {
    title: 'Analogy',
    cues: { markers: [RX.ANALOGY], boosters: [RX.BOOST] },
    suggest: 'State relevant similarities & address key disanalogies.',
    cqGuardrails: ['similarity', 'difference', 'relevance'],
  },
  Pragmatic: {
    title: 'Pragmatic Consequences',
    cues: { markers: [RX.CONSEQ], numbers: [RX.NUM] },
    suggest: 'Clarify likelihood/scale of outcomes; check plausible alternatives.',
    cqGuardrails: ['feasibility', 'side-effects', 'alternatives'],
  },
  Causal: {
    title: 'Causal',
    cues: { markers: [RX.CAUSAL], numbers: [RX.NUM] },
    suggest: 'Rule out confounders; show mechanism or study design.',
    cqGuardrails: ['mechanism', 'correlation', 'confounders'],
  },
  Sign: {
    title: 'Sign / Symptom',
    cues: { markers: [RX.SIGN] },
    suggest: 'Check the reliability of the indicator and alternative explanations.',
    cqGuardrails: ['reliability', 'alternatives'],
  },
  PopularOpinion: {
    title: 'Popular Opinion',
    cues: { markers: [RX.POP] },
    suggest: 'Popularity ≠ truth; check independent reasons or expertise.',
    cqGuardrails: ['independent-reasons', 'bandwagon'],
  },
};

export function scanCues(text: string, spec: SchemeSpec): CueHit[] {
  const hits: CueHit[] = [];
  if (!text) return hits;
  for (const [label, regs] of Object.entries(spec.cues)) {
    regs.forEach((re) => {
      let m: RegExpExecArray | null;
      const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      while ((m = rx.exec(text))) {
        hits.push({ label, start: m.index, end: m.index + m[0].length, match: m[0] });
        if (m.index === rx.lastIndex) rx.lastIndex++; // avoid zero-length loops
      }
    });
  }
  return hits;
}

// Simple density: cues per 100 words
export function densityPer100(text: string, hits: CueHit[]): number {
  const words = (text.match(/\b\w+\b/g) || []).length || 1;
  return Math.round((hits.length / words) * 10000) / 100; // 2 decimals
}
