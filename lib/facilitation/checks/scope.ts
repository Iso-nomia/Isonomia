/**
 * SCOPE check (v1) — see docs/facilitation/QUESTION_CHECKS.md §4.
 */

import { FacilitationCheckKind, FacilitationCheckSeverity } from "../types";
import type { CheckFn, CheckResult } from "./types";
import { questionMarkCount } from "./util";

const EMBEDDED_INTERROGATIVE_RE =
  /\b(and|as well as)\b\s+(what|why|how|when|where|who|which|should|do|does|did|is|are|was|were|will|would|can|could)\b/gi;

const HIDDEN_CONDITIONAL_RE =
  /\bif\b[^?]{0,200}\b(what|why|how|when|where|who|which|should|do|does|did|is|are|was|were|will|would|can|could)\b[^?]{0,200}\?/i;

export const scopeCheck: CheckFn = (text) => {
  const out: CheckResult[] = [];
  const qmarks = questionMarkCount(text);

  if (qmarks > 1) {
    out.push({
      kind: FacilitationCheckKind.SCOPE,
      severity: FacilitationCheckSeverity.BLOCK,
      messageText: "Multiple questions detected; ask one at a time.",
      evidence: { questionMarkCount: qmarks },
    });
  }

  EMBEDDED_INTERROGATIVE_RE.lastIndex = 0;
  const embedded: Array<{ value: string; offset: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = EMBEDDED_INTERROGATIVE_RE.exec(text)) !== null) {
    embedded.push({ value: m[0], offset: m.index });
    if (m.index === EMBEDDED_INTERROGATIVE_RE.lastIndex) {
      EMBEDDED_INTERROGATIVE_RE.lastIndex++;
    }
  }
  if (embedded.length > 0) {
    out.push({
      kind: FacilitationCheckKind.SCOPE,
      severity: FacilitationCheckSeverity.WARN,
      messageText: "Embedded sub-question detected.",
      evidence: { embeddedClauseCount: embedded.length, matches: embedded },
    });
  }

  if (HIDDEN_CONDITIONAL_RE.test(text)) {
    out.push({
      kind: FacilitationCheckKind.SCOPE,
      severity: FacilitationCheckSeverity.WARN,
      messageText: "Hidden conditional sub-question detected.",
      evidence: { questionMarkCount: qmarks },
    });
  }

  return out;
};
