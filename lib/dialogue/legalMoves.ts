// lib/dialogue/legalMoves.ts
export type Shape = 'conditional'|'conjunction'|'disjunction'|'forall'|'exists'|'presupposition'|'unknown';
export type LegalOption = { key: string; label: string; action: 'ask'|'challenge'|'choose'|'instantiate' };

const RE = {
  IF: /\b(if|assuming|provided that)\b/i,
  THEN: /\b(then|therefore|hence|so)\b/i,
  AND: /\b(and|as well as)\b/i,
  OR: /\b(or|either)\b/i,
  FORALL: /\b(every|all|any|each)\b/i,
  EXISTS: /\b(some|there exists|at least one)\b/i,
  PRESUP: /\b(again|still|stop|continue)\b/i, // crude “loaded” cue (e.g., “still”)
};

export function detectShape(text: string): Shape {
  const t = text || '';
  if (RE.IF.test(t) && (RE.THEN.test(t) || /,/.test(t))) return 'conditional';
  if (RE.AND.test(t)) return 'conjunction';
  if (RE.OR.test(t)) return 'disjunction';
  if (RE.FORALL.test(t)) return 'forall';
  if (RE.EXISTS.test(t)) return 'exists';
  if (RE.PRESUP.test(t)) return 'presupposition';
  return 'unknown';
}

export function legalAttacksFor(text: string): { on: Shape; options: LegalOption[] } {
  const on = detectShape(text);
  const options: LegalOption[] = [];
  switch (on) {
    case 'conditional':
      options.push(
        { key: 'attack-antecedent', label: 'Challenge antecedent (A)', action: 'challenge' },
        { key: 'ask-consequent',    label: 'Ask to assert consequent (B)', action: 'ask' },
      );
      break;
    case 'conjunction':
      options.push(
        { key: 'challenge-conjunct-1', label: 'Challenge first conjunct', action: 'challenge' },
        { key: 'challenge-conjunct-2', label: 'Challenge second conjunct', action: 'challenge' },
      );
      break;
    case 'disjunction':
      options.push(
        { key: 'choose-left',  label: 'Choose left disjunct', action: 'choose' },
        { key: 'choose-right', label: 'Choose right disjunct', action: 'choose' },
      );
      break;
    case 'forall':
      options.push({ key: 'instantiate', label: 'Instantiate with counterexample', action: 'instantiate' });
      break;
    case 'exists':
      options.push({ key: 'ask-witness', label: 'Ask for a concrete witness/example', action: 'ask' });
      break;
    case 'presupposition':
      options.push({ key: 'challenge-presup', label: 'Challenge presupposition / define term', action: 'challenge' });
      break;
    default:
      break;
  }
  return { on, options };
}
