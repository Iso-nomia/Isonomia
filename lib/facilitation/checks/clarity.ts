/**
 * CLARITY check (v1) — see docs/facilitation/QUESTION_CHECKS.md §1.
 */

import { FacilitationCheckKind, FacilitationCheckSeverity } from "../types";
import type { CheckFn, CheckResult } from "./types";
import { tokens, sentenceCount, avgWordLength, lowerSet } from "./util";
import defaultLexicon from "./data/clarity_jargon.en.json";
import legalLexicon from "./data/clarity_jargon.legal.json";
import medicalLexicon from "./data/clarity_jargon.medical.json";

interface Lexicon {
  jargon: string[];
  loadedAdjectives: string[];
}

const LEXICONS: Record<string, Lexicon> = {
  default: defaultLexicon as unknown as Lexicon,
  legal: legalLexicon as unknown as Lexicon,
  medical: medicalLexicon as unknown as Lexicon,
};

function pickLexicon(key?: string): Lexicon {
  if (key && LEXICONS[key]) return LEXICONS[key];
  return LEXICONS.default;
}

export const clarityCheck: CheckFn = (text, ctx) => {
  const out: CheckResult[] = [];
  const lex = pickLexicon(ctx.lexiconOverrideKey);
  const jargonSet = lowerSet(lex.jargon);
  const toks = tokens(text);
  const sCount = sentenceCount(text);
  const avg = avgWordLength(toks);

  const jargonHits = toks.filter((t) => jargonSet.has(t.toLowerCase()));
  const density = toks.length === 0 ? 0 : jargonHits.length / toks.length;

  // Token count
  if (toks.length < 4) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.BLOCK,
      messageText: "Too short to elicit deliberation.",
      evidence: { tokenCount: toks.length },
    });
  } else if (toks.length > 60) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.WARN,
      messageText: `Question is long (${toks.length} tokens); consider tightening.`,
      evidence: { tokenCount: toks.length },
    });
  }

  // Sentence count
  if (sCount > 5) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.BLOCK,
      messageText: "Question is too long; split or tighten.",
      evidence: { sentenceCount: sCount },
    });
  } else if (sCount > 3) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.WARN,
      messageText: "Question has multiple sentences; consider tightening into a single ask.",
      evidence: { sentenceCount: sCount },
    });
  }

  // Average word length
  if (avg > 6.5) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.WARN,
      messageText: `Average word length ${Math.round(avg * 10) / 10} chars; consider simpler vocabulary.`,
      evidence: { avgWordLength: Math.round(avg * 10) / 10 },
    });
  }

  // Jargon density
  if (density > 0.2) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.BLOCK,
      messageText: `High jargon density (${Math.round(density * 100)}%).`,
      evidence: {
        jargonHits,
        jargonDensity: Math.round(density * 1000) / 1000,
        lexiconScope: ctx.lexiconOverrideKey ?? "default",
      },
    });
  } else if (density > 0.1) {
    out.push({
      kind: FacilitationCheckKind.CLARITY,
      severity: FacilitationCheckSeverity.WARN,
      messageText: `Elevated jargon density (${Math.round(density * 100)}%).`,
      evidence: {
        jargonHits,
        jargonDensity: Math.round(density * 1000) / 1000,
        lexiconScope: ctx.lexiconOverrideKey ?? "default",
      },
    });
  }

  return out;
};
