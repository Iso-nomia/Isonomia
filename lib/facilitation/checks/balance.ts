/**
 * BALANCE check (v1) — see docs/facilitation/QUESTION_CHECKS.md §3.
 *
 * Applies only to choice / evaluative framings.
 */

import {
  FacilitationCheckKind,
  FacilitationCheckSeverity,
  FacilitationFramingType,
} from "../types";
import type { CheckFn, CheckResult } from "./types";
import { tokens, lowerSet } from "./util";
import defaultLexicon from "./data/clarity_jargon.en.json";

const LOADED = lowerSet((defaultLexicon as unknown as { loadedAdjectives: string[] }).loadedAdjectives);
const EVAL_VERBS = ["approve", "support", "endorse", "back"];
const NEGATIVE_PHRASES = [
  /\b(or|vs\.?|versus)\s+(oppose|reject|disapprove|deny)\b/i,
];

function splitChoiceClauses(text: string): string[] {
  // Split on "or", " vs ", " vs.", " versus ", honoring word boundaries.
  return text
    .split(/\s+(?:or|vs\.?|versus)\s+/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function loadedAdjectivesIn(toks: string[]): string[] {
  return toks.filter((t) => LOADED.has(t.toLowerCase()));
}

export const balanceCheck: CheckFn = (text, ctx) => {
  const out: CheckResult[] = [];

  if (
    ctx.framingType !== FacilitationFramingType.choice &&
    ctx.framingType !== FacilitationFramingType.evaluative
  ) {
    return out;
  }

  if (ctx.framingType === FacilitationFramingType.choice) {
    const clauses = splitChoiceClauses(text);
    if (clauses.length < 2) {
      out.push({
        kind: FacilitationCheckKind.BALANCE,
        severity: FacilitationCheckSeverity.BLOCK,
        messageText: "Choice framing requires at least two options; only one detected.",
        evidence: { clauseCount: clauses.length },
      });
      return out;
    }
    const detail = clauses.map((c) => {
      const toks = tokens(c);
      return { text: c, tokens: toks.length, loadedAdjectives: loadedAdjectivesIn(toks) };
    });
    for (let i = 0; i < detail.length; i++) {
      for (let j = i + 1; j < detail.length; j++) {
        const a = detail[i];
        const b = detail[j];
        const adjDelta = Math.abs(a.loadedAdjectives.length - b.loadedAdjectives.length);
        const lenRatio =
          Math.abs(a.tokens - b.tokens) / Math.max(a.tokens, b.tokens, 1);
        if (adjDelta >= 2) {
          out.push({
            kind: FacilitationCheckKind.BALANCE,
            severity: FacilitationCheckSeverity.WARN,
            messageText:
              "Asymmetric framing: one option carries more loaded adjectives than the other.",
            evidence: { framingType: "choice", clauses: detail, asymmetry: { adjectiveDelta: adjDelta, lengthRatio: round(lenRatio) } },
          });
        }
        if (lenRatio > 0.5) {
          out.push({
            kind: FacilitationCheckKind.BALANCE,
            severity: FacilitationCheckSeverity.INFO,
            messageText: "Choice clauses differ substantially in length.",
            evidence: { framingType: "choice", clauses: detail, asymmetry: { adjectiveDelta: adjDelta, lengthRatio: round(lenRatio) } },
          });
        }
      }
    }
    return out;
  }

  // evaluative
  const lower = text.toLowerCase();
  const hasEvalVerb = EVAL_VERBS.some((v) => new RegExp(`\\b${v}\\b`, "i").test(lower));
  if (hasEvalVerb) {
    const hasNegative = NEGATIVE_PHRASES.some((re) => re.test(text));
    if (!hasNegative) {
      out.push({
        kind: FacilitationCheckKind.BALANCE,
        severity: FacilitationCheckSeverity.WARN,
        messageText: "Evaluative framing should make the negative option visible (e.g. 'or oppose').",
        evidence: { framingType: "evaluative" },
      });
    }
  }
  return out;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
