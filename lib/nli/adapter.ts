import type { z } from "zod";
import { NLI_NEUTRAL_OVERLAP_THRESHOLD, NLI_NEUTRAL_CONFIDENCE } from "@/lib/config/confidence";

export type NLIResult = { relation: "entails"|"contradicts"|"neutral"; score: number };

export interface NLIAdapter {
  name: string;
  batch(pairs: Array<{ premise: string; hypothesis: string }>): Promise<NLIResult[]>;
}

/** Heuristic stub: fast, deterministic, zero deps. */
export const stubNLI: NLIAdapter = {
  name: "stub-heuristic",
  async batch(pairs) {
    return pairs.map(({ premise, hypothesis }) => {
      const P = premise.toLowerCase(), H = hypothesis.toLowerCase();
      // very rough signs
      const negH = /\b(no|not|never|none|cannot|can't|won't|n't)\b/.test(H);
      const negP = /\b(no|not|never|none|cannot|can't|won't|n't)\b/.test(P);
      const overlap = jaccard(tokens(P), tokens(H));
      // If hypothesis is negation of a high-overlap premise → contradiction-ish
      if (overlap > 0.5 && negH !== negP) return { relation: "contradicts", score: 0.75 };
      if (overlap > 0.66) return { relation: "entails", score: 0.70 };
      if (overlap > NLI_NEUTRAL_OVERLAP_THRESHOLD) return { relation: "neutral", score: NLI_NEUTRAL_CONFIDENCE };
      return { relation: "neutral", score: 0.5 };
    });
  },
};

function tokens(s: string) {
  return Array.from(new Set(s.replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean)));
}
function jaccard(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

/** Swap in an HTTP adapter later (HF Inference, your microservice, etc.) */
export function getNLIAdapter(): NLIAdapter {
  // Example: if (process.env.NLI_ENDPOINT) return httpAdapter(process.env.NLI_ENDPOINT)
  return stubNLI;
}
