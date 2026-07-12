// components/dialogue/normalizeNL.ts
import { DialogueAct } from "@/packages/ludics-core/types";

export function normalizeNL(text: string, locusPath = '0'): { acts: DialogueAct[]; original: string } {
  const t = text.trim();
  // Presupposition template demo (paper’s Example 7)
  // “Have you stopped X?” -> [ask(X), yes, ask(stopped(X))]
  if (/^have you stopped\b/i.test(t)) {
    const x = t.replace(/^have you stopped\s*/i, '').replace(/\?+$/,'').trim();
    return {
      original: t,
      acts: [
        { polarity:'neg', locusPath, openings:[], expression:`Did you ${x}?`, additive:true },
        { polarity:'pos', locusPath, openings:[], expression:`Yes.` },
        { polarity:'neg', locusPath, openings:[], expression:`Have you stopped ${x}?`, additive:true },
      ]
    };
  }
  // “Choose one: A or B” => additive
  if (/choose one: /i.test(t) && / or /i.test(t)) {
    return {
      original: t,
      acts: [{ polarity:'pos', locusPath, openings:['0.1','0.2'], expression:t, additive:true }]
    };
  }
  // Default: one positive act, multiplicative
  return { original: t, acts: [{ polarity:'pos', locusPath, openings:[], expression: t }] };
}
