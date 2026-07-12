// lib/rhetoric/mlMini.ts
// Tiny, transparent scorer for Ethos / Logos / Pathos mix.
// - No external dependencies
// - Works from your existing detectors/NLP/lexicon outputs
// - Returns softmax-normalized proportions with optional per-feature explanations

import type { Analysis, Hit, Category } from '@/components/rhetoric/detectors';
import { analyzeText } from '@/components/rhetoric/detectors';
import { analyzeLexiconsMany, type LexiconSummary, scanLexiconHits } from '@/components/rhetoric/lexiconAnalyzers';

// ---------------------------
// Types
// ---------------------------

export type Mix = { ethos: number; logos: number; pathos: number };

export type FeatureVector = {
  // Layer A (detectors) densities per 100 words
  det_hedge: number;
  det_booster: number;
  det_absolute: number;
  det_weasel: number;
  det_evidence: number;
  det_connectives: number; // sum of connective-* categories
  det_allcaps: number;

  // Layer B (NLP) densities per 100 words
  nlp_passive: number;
  nlp_imperative: number;
  nlp_negation: number;

  // Layer C (lexicon) densities per 100 words
  lex_emotion_pos: number;
  lex_emotion_neg: number;
  lex_frames_economic: number;

  // Layer C (Logos/Ethos inline lexicons)
  lex_logos: number;
  lex_ethos: number;
};

export type Inputs = {
  det: Analysis;                    // from analyzeText / analyzeMany
  nlpHits?: Hit[];                  // optional: hits from analyzeNlp(...)
  lexSummary?: LexiconSummary;      // from analyzeLexiconsMany([text])
  lexHits?: Hit[];                  // optional: scanLexiconHits(text) with logos/ethos enabled
  text?: string;                    // optional: if provided, we can derive lexHits/lexSummary
};

export type PredictOptions = {
  temperature?: number; // softmax temperature (default 1.0)
  floor?: number;       // minimum epsilon before renorm (default 1e-6)
};

type Weights = { b: number; w: Partial<Record<keyof FeatureVector, number>> };

const W: Record<keyof Mix, Weights> = {
  // Biases are conservative; weights emphasize the most diagnostic features.
  ethos: {
    b: -0.45,
    w: {
      lex_ethos: 1.0,
      det_evidence: 0.05,
      nlp_passive: 0.05,
    },
  },
  logos: {
    b: -0.35,
    w: {
      lex_logos: 1.60,
      det_connectives: 0.35,
      det_evidence: 0.30,
      nlp_negation: 0.10, // mild: negation often appears in careful logical refutation
    },
  },
  pathos: {
    b: -0.30,
    w: {
      lex_emotion_pos: 0.45,
      lex_emotion_neg: 0.90,
      det_booster: 0.10,
      det_absolute: 0.05,
      det_allcaps: 0.15, // rarely triggered; treat as a hint
      det_weasel: 0.05,
    },
  },
};

// ---------------------------
// Helpers
// ---------------------------

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

 const rawPer100 = (count: number, words: number) =>
   (count / Math.max(1, words)) * 100;
 
 // Mild squash to avoid any single family dominating on short texts.
 // sqrt keeps ordering but compresses large counts.
 const squash = (x: number) => Math.sqrt(Math.max(0, x));
 const densityPer100 = (count: number, words: number) => squash(rawPer100(count, words));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function softmax3(z1: number, z2: number, z3: number, tau = 1) {
  const t = Math.max(1e-6, tau);
  const a = Math.exp(z1 / t);
  const b = Math.exp(z2 / t);
  const c = Math.exp(z3 / t);
  const s = a + b + c || 1;
  return { ethos: a / s, logos: b / s, pathos: c / s };
}

const CONNECTIVE_CATS: Category[] = [
  'connective-support',
  'connective-result',
  'connective-contrast',
  'connective-concession',
  'connective-condition',
];

// Count hits in a list by category
function countHits(hits: Hit[] | undefined, cat: Category): number {
  if (!hits?.length) return 0;
  let n = 0;
  for (const h of hits) if (h.cat === cat) n++;
  return n;
}

function countHitsWhere(hits: Hit[] | undefined, pred: (h: Hit) => boolean): number {
  if (!hits?.length) return 0;
  let n = 0;
  for (const h of hits) if (pred(h)) n++;
  return n;
}

// ---------------------------
// Feature construction
// ---------------------------

/**
 * Build a FeatureVector from your existing analyses.
 * Prefer this over the "fromText" variants to avoid re-running analyzers.
 */
export function featuresFromAnalyses(input: Inputs): FeatureVector {
  const det = input.det ?? { hits: [], counts: {}, words: 1 };
  const words = Math.max(1, det.words || 1);

  // Layer A densities
  const det_hedge       = densityPer100(det.counts['hedge'] || 0, words);
  const det_booster     = densityPer100(det.counts['booster'] || 0, words);
  const det_absolute    = densityPer100(det.counts['absolute'] || 0, words);
  const det_weasel      = densityPer100(det.counts['weasel'] || 0, words);
  const det_evidence    = densityPer100(det.counts['evidence'] || 0, words);
  const det_allcaps     = densityPer100(det.counts['allcaps'] || 0, words);
  const det_connectives = densityPer100(
    CONNECTIVE_CATS.map(c => det.counts[c] || 0).reduce((a, b) => a + b, 0),
    words
  );

  // Layer B (NLP) densities
  const nlpHits = input.nlpHits || [];
  const nlp_passive    = densityPer100(countHits(nlpHits, 'passive'), words);
  const nlp_imperative = densityPer100(countHits(nlpHits, 'imperative'), words);
  const nlp_negation   = densityPer100(countHits(nlpHits, 'negation'), words);

  // Layer C (lexicon) densities from summary
  // Use caller-provided summary if available; otherwise derive from text (if provided)
  let lex_emotion_pos = 0;
  let lex_emotion_neg = 0;
  let lex_frames_economic = 0;

  if (input.lexSummary) {
    const s = input.lexSummary;
    // Note: s.words is the word count *in its own join scope*; we prefer 'words' from det for consistency
    lex_emotion_pos = densityPer100((s.affectCounts as any).positive || 0, words);
    lex_emotion_neg = densityPer100((s.affectCounts as any).negative || 0, words);
    lex_frames_economic = densityPer100((s.frameCounts as any).economic || 0, words);
  }

  // Logos/Ethos from inline lex hits (or compute from text if provided)
  let lex_logos = 0;
  let lex_ethos = 0;

  const lexHits =
    input.lexHits ??
    (input.text
      ? scanLexiconHits(input.text, {
          includeFamilies: { logos: true, ethos: true, frames: false, liwc: false, pathos: false },
        })
      : undefined);

  if (lexHits && lexHits.length) {
    const logosCount = countHitsWhere(lexHits, h => h.cat === 'logos');
    const ethosCount = countHitsWhere(lexHits, h => h.cat === 'ethos');
    lex_logos = densityPer100(logosCount, words);
    lex_ethos = densityPer100(ethosCount, words);
  }

  return {
    det_hedge,
    det_booster,
    det_absolute,
    det_weasel,
    det_evidence,
    det_connectives,
    det_allcaps,
    nlp_passive,
    nlp_imperative,
    nlp_negation,
    lex_emotion_pos,
    lex_emotion_neg,
    lex_frames_economic,
    lex_logos,
    lex_ethos,
  };
}

/**
 * Convenience: compute features directly from text (no async NLP).
 * If you want NLP included, prefer the "fromPipeline" helper below.
 */
export function featuresFromTextSync(text: string): FeatureVector {
  const det = analyzeText(text || '');
  const lexSummary = analyzeLexiconsMany([text || '']);
  const lexHits = scanLexiconHits(text || '', {
    includeFamilies: { logos: true, ethos: true, frames: false, liwc: false, pathos: false },
  });
  return featuresFromAnalyses({ det, lexSummary, lexHits });
}

/**
 * Optional async pipeline if you want to include NLP hits that you already compute elsewhere.
 * Pass them in to avoid duplicate work. This function itself is sync; you orchestrate async outside.
 */
export function featuresFromPipeline(params: {
  det: Analysis;
  nlpHits?: Hit[];
  text?: string;
  lexSummary?: LexiconSummary;
  lexHits?: Hit[];
}): FeatureVector {
  const { det, nlpHits, text, lexSummary, lexHits } = params;
  const summary = lexSummary ?? analyzeLexiconsMany([text || '']);
  const hits = lexHits ?? (text ? scanLexiconHits(text, { includeFamilies: { logos: true, ethos: true, frames: false, liwc: false, pathos: false } }) : []);
  return featuresFromAnalyses({ det, nlpHits, lexSummary: summary, lexHits: hits, text });
}

// ---------------------------
// Prediction & explanation
// ---------------------------

const dot = (f: FeatureVector, ww: Weights) =>
  Object.entries(ww.w).reduce((s, [k, v]) => s + ((f as any)[k] ?? 0) * (v as number), ww.b);

export function predictMix(f: FeatureVector, opts: PredictOptions = {}): Mix {
  const tau = opts.temperature ?? 1.0;
  const floor = opts.floor ?? 1e-6;

  // If all features are zero, return uniform
  const totalMag =
    sum(Object.values(f).map((x) => Math.abs(x)));
  if (totalMag === 0) return { ethos: 1 / 3, logos: 1 / 3, pathos: 1 / 3 };

  const z_e = dot(f, W.ethos);
  const z_l = dot(f, W.logos);
  const z_p = dot(f, W.pathos);

  let mix = softmax3(z_e, z_l, z_p, tau);
  // numerical stability floor
  const e = Math.max(mix.ethos, floor);
  const l = Math.max(mix.logos, floor);
  const p = Math.max(mix.pathos, floor);
  const s = e + l + p;
  mix = { ethos: e / s, logos: l / s, pathos: p / s };
  return mix;
}

export type Contribution = { feature: keyof FeatureVector; weight: number; value: number; contrib: number };
export type Explanation = {
  z: { ethos: number; logos: number; pathos: number };
  byClass: { ethos: Contribution[]; logos: Contribution[]; pathos: Contribution[] };
};

/**
 * Get raw logits and per-feature contributions (useful for tooltips).
 */
export function explain(f: FeatureVector): Explanation {
  const contribs = (ww: Weights): Contribution[] =>
    Object.entries(ww.w).map(([k, w]) => {
      const value = (f as any)[k] ?? 0;
      const weight = w as number;
      return { feature: k as keyof FeatureVector, weight, value, contrib: value * weight };
    }).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

  const ethos = contribs(W.ethos);
  const logos = contribs(W.logos);
  const pathos = contribs(W.pathos);

  const z = {
    ethos: dot(f, W.ethos),
    logos: dot(f, W.logos),
    pathos: dot(f, W.pathos),
  };
  return { z, byClass: { ethos, logos, pathos } };
}

/**
 * One‑shot scoring from raw text (sync, no NLP), returning mix + features.
 * Use this for quick demos or tests.
 */
export function scoreTextSync(text: string, opts?: PredictOptions) {
  const feats = featuresFromTextSync(text);
  const mix = predictMix(feats, opts);
  return { mix, features: feats, explanation: explain(feats) };
}
