// Legal attacks based on simple linguistic cues in the text.
//lib/dialogue/legalAttacks.ts
export type Shape = 'conditional'|'conjunction'|'disjunction'|'forall'|'exists'|'premise'|'unknown';
export type AttackOption =
  | { key: 'attack_antecedent'; label: string; template: string }
  | { key: 'request_consequent'; label: string; template: string }
  | { key: 'challenge_premise'; label: string; template: string }
  | { key: 'pick_disjunct'; label: string; template: string }
  | { key: 'split_conjunct'; label: string; template: string }
  | { key: 'instantiate_forall'; label: string; template: string }
  | { key: 'challenge_exists'; label: string; template: string };

export function detectShape(text: string): Shape {
  const t = (text || '').toLowerCase();
  if (/\bif\b.+\bthen\b/.test(t) || /\btherefore\b/.test(t)) return 'conditional';
  if (/\b(and|both)\b/.test(t)) return 'conjunction';
  if (/\b(or|either)\b/.test(t)) return 'disjunction';
  if (/\b(all|every|any)\b/.test(t)) return 'forall';
  if (/\b(some|there exists|at least one)\b/.test(t)) return 'exists';
  if (/\b(because|since|given that|as)\b/.test(t)) return 'premise';
  return 'unknown';
}

/** Ludics/dialogue-friendly move suggestions. */
export function legalAttacksFor(text: string): { shape: Shape; options: AttackOption[] } {
  const shape = detectShape(text);
  const opts: AttackOption[] = [];

  switch (shape) {
    case 'conditional':
      opts.push(
        { key:'attack_antecedent',   label:'Deny antecedent (show counterexample to IF‑part)', template:'I contest the antecedent: …'},
        { key:'request_consequent',  label:'Request consequent (commit to THEN‑part)',         template:'Please commit to the consequent: …'},
      );
      break;
    case 'conjunction':
      opts.push(
        { key:'split_conjunct', label:'Split & challenge a conjunct', template:'I challenge the conjunct “…”, not the other part.' },
      );
      break;
    case 'disjunction':
      opts.push(
        { key:'pick_disjunct', label:'Pick a disjunct to press', template:'Let’s focus on the “… or …” branch: I pick “…”.' },
      );
      break;
    case 'forall':
      opts.push(
        { key:'instantiate_forall', label:'Instantiate ∀ with a concrete case', template:'Consider the instance “…”. Does it satisfy your claim?' },
      );
      break;
    case 'exists':
      opts.push(
        { key:'challenge_exists', label:'Ask for witness / challenge ∃', template:'Provide a concrete instance (witness) of “…”.' },
      );
      break;
    case 'premise':
      opts.push(
        { key:'challenge_premise', label:'Challenge premise (“Why?”)', template:'Why should we accept the premise “…”, and what is its source?' },
      );
      break;
    default:
      // provide a safe generic
      opts.push({ key:'challenge_premise', label:'Ask for reason or evidence', template:'Please provide a reason/evidence for “…”.' });
  }

  return { shape, options: opts };
}


