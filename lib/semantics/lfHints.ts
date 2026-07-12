
export type ConditionalHint = { antecedent: string; consequent: string; spanA: [number, number]; spanB: [number, number] };
export type QuantHint = { quant: 'every'|'some'|'no'|'most'|'many'|'at_least'|'at_most'; raw: string; start: number; end: number };

export type LfHints = {
  conditionals: ConditionalHint[];
  quantifiers: QuantHint[];
};

const IF_THEN = /\bif\s+(.+?)\s*,?\s*(then\s+)?(.+?)\b(?:\.|;|$)/i;
const QUANTS: [RegExp, QuantHint['quant']][] = [
  [/\bevery\b/i, 'every'], [/\bsome\b/i, 'some'], [/\bno\b/i, 'no'],
  [/\bmost\b/i, 'most'], [/\bmany\b/i, 'many'],
  [/\bat\s+least\b/i, 'at_least'], [/\bat\s+most\b/i, 'at_most'],
];

export function lfHints(text: string): LfHints {
  const T = text || '';
  const conditionals: ConditionalHint[] = [];
  const m = IF_THEN.exec(T);
  if (m && m[1] && m[3]) {
    const a = m[1].trim(); const b = m[3].trim();
    conditionals.push({
      antecedent: a, consequent: b,
      spanA: [m.index + m[0].indexOf(a), m.index + m[0].indexOf(a) + a.length],
      spanB: [m.index + m[0].lastIndexOf(b), m.index + m[0].lastIndexOf(b) + b.length],
    });
  }
  const quantifiers: QuantHint[] = [];
  for (const [re, tag] of QUANTS) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, 'ig');
    while ((m = r.exec(T))) {
      quantifiers.push({ quant: tag, raw: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  return { conditionals, quantifiers };
}
