/**
 * LEADING check (v1) — see docs/facilitation/QUESTION_CHECKS.md §2.
 */

import { FacilitationCheckKind, FacilitationCheckSeverity } from "../types";
import type { CheckFn, CheckResult } from "./types";
import config from "./data/leading.en.json";

interface PatternRule {
  key: string;
  regex: string;
  flags: string;
  severity: keyof typeof FacilitationCheckSeverity;
  messageTemplate: string;
}

interface LeadingConfig {
  patterns: PatternRule[];
  presuppositionVerbs: string[];
  presuppositionMessageTemplate: string;
}

const CFG = config as unknown as LeadingConfig;

const COMPILED = CFG.patterns.map((p) => ({
  ...p,
  re: new RegExp(p.regex, ensureGlobal(p.flags)),
}));

function ensureGlobal(flags: string): string {
  return flags.includes("g") ? flags : flags + "g";
}

const PRESUP_RE = new RegExp(
  `\\b(${CFG.presuppositionVerbs.map(escapeRegex).join("|")})\\b`,
  "gi",
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fillTemplate(tpl: string, value: string): string {
  return tpl.replace(/\{value\}/g, value);
}

export const leadingCheck: CheckFn = (text) => {
  const out: CheckResult[] = [];

  for (const p of COMPILED) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      out.push({
        kind: FacilitationCheckKind.LEADING,
        severity: FacilitationCheckSeverity[p.severity],
        messageText: fillTemplate(p.messageTemplate, m[0]),
        evidence: {
          pattern: p.key,
          value: m[0],
          offset: m.index,
        },
      });
      // Avoid infinite loops on zero-width matches.
      if (m.index === p.re.lastIndex) p.re.lastIndex++;
    }
  }

  PRESUP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PRESUP_RE.exec(text)) !== null) {
    out.push({
      kind: FacilitationCheckKind.LEADING,
      severity: FacilitationCheckSeverity.WARN,
      messageText: fillTemplate(CFG.presuppositionMessageTemplate, m[0]),
      evidence: {
        pattern: "presupposition_verb",
        value: m[0],
        offset: m.index,
      },
    });
    if (m.index === PRESUP_RE.lastIndex) PRESUP_RE.lastIndex++;
  }

  return out;
};
