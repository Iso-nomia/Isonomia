// components/rhetoric/lexiconAnalyzers.ts
import { EMOTION, EmotionKey } from "./lexicons/emotionLex";
import { FRAMES, FrameKey } from "./lexicons/framesLex";
import { LIWC_LITE } from "./lexicons/liwcLite";
import type { Hit, Category } from "./detectors";

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function reFor(words: ReadonlyArray<string>) {
  // Word boundary, case-insensitive, whole words. Join longer first helps phrases if you add any.
  const sorted = Array.from(words)
    .sort((a, b) => b.length - a.length)
    .map(escape);
  return new RegExp(`\\b(?:${sorted.join("|")})\\b`, "gi");
}

type CountMap<T extends string> = Record<T, number>;

export type LexiconSummary = {
  words: number;
  // Affect
  affectCounts: CountMap<EmotionKey> & { positive: number; negative: number };
  valenceScorePer100w: number; // (pos - neg)/words * 100
  // Frames
  frameCounts: CountMap<FrameKey>;
  topFrames: Array<{ key: FrameKey; count: number }>;
  // LIWC-lite
  liwcCounts: {
    certainty: number;
    tentative: number;
    negation: number;
    pronoun_first: number;
    pronoun_second: number;
  };
};

function countMatches(text: string, words: ReadonlyArray<string>) {
  const re = reFor(words);
  const m = text.match(re);
  return m?.length ?? 0;
}

export const LEX_EMOTION = {
  positive: [
    "benefit",
    "improve",
    "progress",
    "opportunity",
    "thrive",
    "success",
    "boost",
    "effective",
    "robust",
    "fair",
    "just",
    "equitable", // can move to fairness frame if it causes FP in your corpus
  ],
  negative: [
    "harm",
    "risk",
    "damage",
    "collapse",
    "crisis",
    "threat",
    "failure",
    "costly",
    "burden",
    "danger",
    "unsafe",
  ],
};

// Boydstun-ish micro-frames (high-precision phrase bias)
export const LEX_FRAMES = {
  economic: [
    "economic growth",
    "job creation",
    "productivity",
    "market impact",
    "budget deficit",
    "cost-benefit",
    "tax burden",
    "fiscal responsibility",
  ],
  morality: [
    "right and wrong",
    "moral duty",
    "ethical obligation",
    "moral obligation",
    "virtue",
    "integrity",
  ],
  security: [
    "national security",
    "public safety",
    "homeland security",
    "border security",
    "security threat",
  ],
  fairness: [
    "equal opportunity",
    "equal treatment",
    "level playing field",
    "social justice",
    "fair share",
  ],
  capacity: [
    "resources",
    "infrastructure capacity",
    "staffing shortages",
    "administrative burden",
    "implementation capacity",
  ],
};

function reFromPhrases(phrases: ReadonlyArray<string>): RegExp | null {
  if (!phrases?.length) return null;
  // Longer phrases first → prefer multiword matches and reduce FPs.
  const sorted = Array.from(phrases)
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // escape regex
  // Word boundaries around starts/ends when plausible; keep \s+ for internal spaces.
  const body = sorted.map((p) => p.replace(/\s+/g, "\\s+")).join("|");
  return new RegExp(`\\b(?:${body})\\b`, "gi");
}

const RX_URL = /https?:\/\/[^\s)]+/gi;

function excludeInside(text: string, hits: Hit[], mask: RegExp) {
  const masks: Array<{ s: number; e: number }> = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(
    mask.source,
    mask.flags.includes("g") ? mask.flags : mask.flags + "g"
  );
  while ((m = rx.exec(text)))
    masks.push({ s: m.index, e: m.index + m[0].length });
  if (!masks.length) return hits;
  return hits.filter(
    (h) => !masks.some((ms) => h.start >= ms.s && h.end <= ms.e)
  );
}

function scanWithLabel(text: string, re: RegExp | null, cat: Category): Hit[] {
  if (!re) return [];
  const out: Hit[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(
    re.source,
    re.flags.includes("g") ? re.flags : re.flags + "g"
  );
  while ((m = rx.exec(text))) {
    out.push({ cat, start: m.index, end: m.index + m[0].length, match: m[0] });
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }
  return out;
}

// Narrow tag unions per family so Records don’t explode across all tags
export type LogosTag = "evidence" | "quant" | "logic" | "method";
export type EthosTag = "credentials" | "duty" | "integrity" | "collective";

export type LexKind =
  | {
      family: "emotion";
      tag: "positive" | "negative" | "joy" | "anger" | "fear" | "sadness";
    }
  | {
      family: "frames";
      tag: "economic" | "morality" | "security" | "fairness" | "capacity";
    }
  | {
      family: "liwc";
      tag:
        | "certainty"
        | "tentative"
        | "negation"
        | "pronoun-first"
        | "pronoun-second";
    }
  | { family: "logos"; tag: LogosTag }
  | { family: "ethos"; tag: EthosTag };

export type LexHit = {
  start: number; // inclusive
  end: number; // exclusive
  surface: string;
  kind: LexKind;
  score?: number;
};

// -----------------------
// Curated, compact lexicons
// -----------------------
// Logos focuses on technical/evidentiary terms that do NOT duplicate simple connectives already covered by detectors.
const LOGOS: Record<LogosTag, string[]> = {
  evidence: [
    "evidence",
    "dataset",
    "data set",
    "data",
    "study",
    "trial",
    "randomized",
    "meta-analysis",
    "systematic review",
    "peer[- ]reviewed",
    "replicate",
    "replication",
    "sample size",
    "cohort",
    "placebo",
    "control group",
    "p-value",
    "confidence interval",
    "effect size",
    "statistically significant",
    "significant at",
    "regression",
    "correlation",
    "model",
    "baseline",
    "variance",
    "standard deviation",
    "odds ratio",
    "hazard ratio",
  ],
  quant: [
    "percent",
    "percentage",
    "proportion",
    "ratio",
    "median",
    "mean",
    "average",
    "quartile",
    "decile",
    "n=",
    "N=",
    "σ",
    "μ",
    "CI",
    "95% CI",
    "R²",
    "p <",
    "p ≤",
    "p=",
    "p≤",
  ],
  logic: [
    "therefore",
    "thus",
    "hence",
    "implies",
    "it follows",
    "infer",
    "deduce",
    "premise",
    "conclusion",
    "contradiction",
  ],
  method: [
    "methodology",
    "protocol",
    "procedure",
    "pre-registered",
    "pre registered",
    "blinded",
    "double[- ]blind",
    "placebo[- ]controlled",
    "power calculation",
    "outcome measure",
    "endpoint",
    "instrument",
    "operationalize",
    "operational definition",
  ],
};

// Ethos focuses on *signals of credibility/authority/integrity* (avoid job-title spam; keep precise).
const ETHOS: Record<EthosTag, string[]> = {
  credentials: [
        "PhD",
    "M\\.?D\\.?",
    "J\\.?D\\.?",
    "DPhil",
    "DSc",
    "MSc",
    "MBA",
    "CPA",
    "Esq\\.?",
    "professor",
    "prof\\.?",
    "dr\\.?",             // matches Dr and Dr.
    "licensed",
    "certified",
    "board[-\\s]certified",
    "board[-\\s]eligible",
    "accredited",
    "registered",
        "chartered",
  ],
  duty: [
    "fiduciary",
    "duty of care",
    "professional standard",
    "best practice",
    "code of ethics",
    "oath",
    "pledge",
  ],
  integrity: [
    "transparent",
   "transparency",
        "disclose",
        "disclosed",
        "disclosing",
        "disclosure",
        "conflict of interest",
        "conflicts of interest",
    "independent",
    "impartial",
    "nonpartisan",
    "bipartisan",
    "reputable",
    "trustworthy",
    "credible",
    "reliability",
    "track record",
  ],
  collective: [
    "on behalf of",
    "in good faith",
    "as a team",
    "our responsibility",
    "shared responsibility",
    "consensus",
    "committee",
    "board",
    "peer committee",
  ],
};

const TOKEN_BOUNDARY = "(?=\\b)|(?<=\\b)";
// Loosen spaces and hyphens to catch "peer reviewed" / "peer-reviewed" / "peer-reviewed"
const loosen = (p: string) =>
  p
    // normalize ASCII hyphen to a class of common hyphen glyphs
    .replace(/-/g, "[-\\u2010-\\u2015]")
    // spaces can be any run of whitespace
    .replace(/\s+/g, "\\s+");
const makeLooseWordBounded = (phrases: string[]) =>
  new RegExp(`\\b(?:${phrases.map(loosen).join("|")})\\b`, "gi");
const makeLoose = (phrases: string[]) =>
  new RegExp(`(?:${phrases.map(loosen).join("|")})`, "gi"); // keep without word bounds when needed

const LOGOS_PATTERNS: { tag: LogosTag; re: RegExp }[] = [
  { tag: "evidence", re: makeLooseWordBounded(LOGOS.evidence) },
  { tag: "quant", re: makeLoose(LOGOS.quant) },
  { tag: "logic", re: makeLooseWordBounded(LOGOS.logic) },
  { tag: "method", re: makeLooseWordBounded(LOGOS.method) },
];

const ETHOS_PATTERNS: { tag: EthosTag; re: RegExp }[] = [
  { tag: "credentials", re: makeLoose(ETHOS.credentials) },
  { tag: "duty", re: makeLooseWordBounded(ETHOS.duty) },
  { tag: "integrity", re: makeLooseWordBounded(ETHOS.integrity) },
  { tag: "collective", re: makeLooseWordBounded(ETHOS.collective) },
];

type ScanOptions = {
  includeFamilies?: {
    pathos?: boolean;
    frames?: boolean;
    liwc?: boolean;
    logos?: boolean;
    ethos?: boolean;
  };
  // mask URL/code ranges to keep precision high in dev content
  maskPatterns?: RegExp[];
  maxHitsPerFamily?: number;
};

const DEFAULT_MASKS = [
  /`[^`]*`/g, // inline code
  /```[\s\S]*?```/g, // code fences
  /\bhttps?:\/\/\S+/gi, // URLs
  /\bdoi:\s*\S+/gi, // DOIs
  /\[[^\]]*\]\([^)]+\)/g, // markdown links
];

type Range = { start: number; end: number };
const invertMasked = (text: string, masks: RegExp[]): Range[] => {
  const masked: Range[] = [];
  masks.forEach((re) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      masked.push({ start: m.index, end: m.index + m[0].length });
    }
  });
  masked.sort((a, b) => a.start - b.start);
  // coalesce
  const merged: Range[] = [];
  for (const r of masked) {
    if (!merged.length || r.start > merged[merged.length - 1].end)
      merged.push({ ...r });
    else
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        r.end
      );
  }
  // invert
  const out: Range[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (cursor < r.start) out.push({ start: cursor, end: r.start });
    cursor = r.end;
  }
  if (cursor < text.length) out.push({ start: cursor, end: text.length });
  return out;
};

// --- public API: span scanner for Layer C highlights ---
export function scanLexiconHits(text: string, opts: ScanOptions = {}): Hit[] {
  if (!text) return [];

  const rePos = reFromPhrases(LEX_EMOTION.positive);
  const reNeg = reFromPhrases(LEX_EMOTION.negative);

  const reEcon = reFromPhrases(LEX_FRAMES.economic);
  const reMoral = reFromPhrases(LEX_FRAMES.morality);
  const reSec = reFromPhrases(LEX_FRAMES.security);
  const reFair = reFromPhrases(LEX_FRAMES.fairness);
  const reCap = reFromPhrases(LEX_FRAMES.capacity);

  let hits: Hit[] = [];
  const {
    includeFamilies = {
      pathos: true,
      frames: true,
      liwc: true,
      logos: true,
      ethos: true,
    },
    maskPatterns = DEFAULT_MASKS,
    maxHitsPerFamily = 500,
  } = opts;

  // Emotion / Frames as Category-typed Hit[]
  if (includeFamilies.pathos) {
    hits.push(
      ...scanWithLabel(text, rePos, "affect-positive"),
      ...scanWithLabel(text, reNeg, "affect-negative")
    );
  }
  if (includeFamilies.frames) {
    hits.push(
      ...scanWithLabel(text, reEcon, "frame-economic"),
      ...scanWithLabel(text, reMoral, "frame-morality"),
      ...scanWithLabel(text, reSec, "frame-security"),
      ...scanWithLabel(text, reFair, "frame-fairness"),
      ...scanWithLabel(text, reCap, "frame-capacity")
    );
  }

  // Logos / Ethos: honor masking & flags
  const allow = invertMasked(text, maskPatterns);
  const scanOver = (re: RegExp, cat: "logos" | "ethos") => {
    let count = 0;
    for (const r of allow) {
      re.lastIndex = r.start;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (m.index >= r.end) break;
        const start = m.index;
        const end = start + m[0].length;
        if (end > r.end) break;
        hits.push({ cat, start, end, match: m[0] });
        if (++count >= maxHitsPerFamily) return;
      }
    }
  };

  //    const scanEthos = (re: RegExp, tag: EthosTag) => {
  //      let count = 0;
  //      for (const r of allow) {
  //        re.lastIndex = r.start;
  //        let m: RegExpExecArray | null;
  //        while ((m = re.exec(text))) {
  //          if (m.index >= r.end) break;
  //          const start = m.index;
  //          const end = start + m[0].length;
  //         if (end > r.end) break;
  //         hits.push({ start, end, surface: m[0], kind: { family: 'ethos', tag } });
  //         if (++count >= maxHitsPerFamily) return;
  //        }
  //      }
  //    };

  //            if (includeFamilies.logos)  for (const { re } of LOGOS_PATTERNS) scanOverCat(re, 'logos');
  //            if (includeFamilies.ethos)  for (const { re } of ETHOS_PATTERNS) scanOverCat(re, 'ethos');

  if (includeFamilies.logos)
    for (const { re } of LOGOS_PATTERNS) scanOver(re, "logos");
  if (includeFamilies.ethos)
    for (const { re } of ETHOS_PATTERNS) scanOver(re, "ethos");

  // Guardrail: do not highlight inside raw URLs (redundant with masks but harmless)
  hits = excludeInside(text, hits, RX_URL);
  if (process.env.NODE_ENV !== 'production') {
    const firstEthos = hits.filter(h => h.cat === 'ethos').slice(0,5);
    if (firstEthos.length) console.debug('[Lexicons] ETHOS hits:', firstEthos);
  }
  return hits.sort((a, b) => a.start - b.start || a.end - b.end);
}
 
// Detailed scanner used for tests / analytics → returns family/tag metadata
export function scanLexiconHitsDetailed(
  text: string,
  opts: ScanOptions = {}
): LexHit[] {
  const {
    includeFamilies = { logos: true, ethos: true },
    maskPatterns = DEFAULT_MASKS,
    maxHitsPerFamily = 500,
  } = opts;
  const hits: LexHit[] = [];
  const allow = invertMasked(text || "", maskPatterns);
  const scanF = <T extends LogosTag | EthosTag>(re: RegExp, kind: LexKind) => {
    let count = 0;
    for (const r of allow) {
      re.lastIndex = r.start;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (m.index >= r.end) break;
        const start = m.index,
          end = start + m[0].length;
        if (end > r.end) break;
        hits.push({ start, end, surface: m[0], kind });
        if (++count >= maxHitsPerFamily) return;
      }
    }
  };
  if (includeFamilies.logos)
    for (const { tag, re } of LOGOS_PATTERNS)
      scanF(re, { family: "logos", tag });
  if (includeFamilies.ethos)
    for (const { tag, re } of ETHOS_PATTERNS)
      scanF(re, { family: "ethos", tag });
  return hits.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function analyzeLexiconsMany(texts: string[]): LexiconSummary {
  const whole = texts.join("\n");
  const words = (whole.match(/\b\w+\b/g) || []).length || 1;
  // Affect
  const affectCounts: any = {
    positive: countMatches(whole, EMOTION.positive),
    negative: countMatches(whole, EMOTION.negative),
    joy: countMatches(whole, EMOTION.joy),
    anger: countMatches(whole, EMOTION.anger),
    fear: countMatches(whole, EMOTION.fear),
    sadness: countMatches(whole, EMOTION.sadness),
  };
  const valenceScorePer100w =
    Math.round(
      ((affectCounts.positive - affectCounts.negative) / words) * 10000
    ) / 100;

  // Frames
  const frameCounts: any = {
    economic: countMatches(whole, FRAMES.economic),
    morality: countMatches(whole, FRAMES.morality),
    security: countMatches(whole, FRAMES.security),
    fairness: countMatches(whole, FRAMES.fairness),
    capacity: countMatches(whole, FRAMES.capacity),
  };
  const topFrames = (Object.keys(frameCounts) as FrameKey[])
    .map((k) => ({ key: k, count: frameCounts[k] }))
    .sort((a, b) => b.count - a.count)
    .filter((x) => x.count > 0)
    .slice(0, 3);

  // LIWC-lite
  const liwcCounts = {
    certainty: countMatches(whole, LIWC_LITE.certainty),
    tentative: countMatches(whole, LIWC_LITE.tentative),
    negation: countMatches(whole, LIWC_LITE.negation),
    pronoun_first: countMatches(whole, LIWC_LITE.pronoun_first),
    pronoun_second: countMatches(whole, LIWC_LITE.pronoun_second),
  };

  return {
    words,
    affectCounts,
    valenceScorePer100w,
    frameCounts,
    topFrames,
    liwcCounts,
  };
}
