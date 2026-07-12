/**
 * READABILITY check (v1) — see docs/facilitation/QUESTION_CHECKS.md §5.
 */

import { FacilitationCheckKind, FacilitationCheckSeverity } from "../types";
import type { CheckFn, CheckResult } from "./types";
import { fleschKincaidGrade } from "./util";

export const readabilityCheck: CheckFn = (text, ctx) => {
  const stats = fleschKincaidGrade(text);
  const blockGrade = ctx.readabilityBlockGrade ?? 16;
  let severity: FacilitationCheckSeverity;
  let message: string;

  if (stats.grade <= 6) {
    severity = FacilitationCheckSeverity.INFO;
    message = `Reading grade ${stats.grade}; very accessible.`;
  } else if (stats.grade <= 12) {
    severity = FacilitationCheckSeverity.INFO;
    message = `Reading grade ${stats.grade}.`;
  } else if (stats.grade <= blockGrade) {
    severity = FacilitationCheckSeverity.WARN;
    message = `Reading grade ${stats.grade}; consider simplifying.`;
  } else {
    severity = FacilitationCheckSeverity.BLOCK;
    message = `Reading grade ${stats.grade}; too complex for general deliberation.`;
  }

  return [
    {
      kind: FacilitationCheckKind.READABILITY,
      severity,
      messageText: message,
      evidence: {
        fleschKincaidGrade: stats.grade,
        fleschReadingEase: stats.ease,
        syllableCount: stats.syllableCount,
        wordCount: stats.wordCount,
        sentenceCount: stats.sentenceCount,
        blockGrade,
      },
    },
  ];
};
