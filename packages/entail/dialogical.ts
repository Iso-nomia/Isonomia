// packages/entail/dialogical.ts
// Minimal dialogical entailment helper (no DB). Classical patterns only.

export type EntailStatus = 'ENTAILED' | 'UNDECIDED' | 'CONTRADICTS';

export type EntailRequest = {
  textSentences: string[];        // T
  hypothesis: string;             // H
  nliAssist?: boolean;            // (handled in API, not here)
};

export type EntailRule =
  | 'AND_ELIM'          // A ∧ B ⟹ A or B
  | 'MODUS_PONENS'      // A, (A → B) ⟹ B
  | 'UNIVERSAL_INSTANT' // All X are Y; Z is X ⟹ Z is Y
  | 'DIRECT_MATCH'      // H appears directly in facts
  | 'NEGATION_CONFLICT' // ┴ via conflicting negative
  ;

export type EntailTraceStep = {
  rule: EntailRule;
  used: string[];       // human-readable premises used in this step
  derived?: string;     // conclusion obtained in this step
};

export type EntailResponse = {
  status: EntailStatus;
  derived: string[];           // fact closure (strings)
  usedRules: EntailRule[];     // applied rules in order
  steps: EntailTraceStep[];    // “proof-ish” breadcrumb
  classicalPatterns: EntailRule[]; // alias of usedRules (for UI label)
};

/** ---------- Light normalization ---------- */
function norm(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/[.?!]+$/g, '').toLowerCase();
}

/** Primitive shapes we recognize */
type Prem =
  | { kind: 'atom'; text: string }
  | { kind: 'imp';  antecedent: string; consequent: string }                 // A -> B
  | { kind: 'and';  parts: string[] }                                        // A and B
  | { kind: 'all';  subj: string; pred: string }                             // all X are Y
  | { kind: 'is';   entity: string; type: string }                           // z is x
  | { kind: 'no';   subj: string; pred: string };                            // no X are Y

// --- ultra-light lemmatizer for noun types ---
function lemmaType(s: string): string {
  const x = norm(s);
  if (x.endsWith('men')) return x.replace(/men$/, 'man');
  if (x.endsWith('women')) return x.replace(/women$/, 'woman');
  return x.replace(/^(an?\s+)?/, '').replace(/s$/, '');
}

/** Naive surface parser for a few patterns */
export function parseSentence(s: string): Prem[] {
  const x = norm(s);

  // 1) Implication: "if A then B" / "A implies B"
  const ifThen = x.match(/^if (.+?)(?:,?\s*then\s+|\s*then\s+)(.+)$/);
  if (ifThen) return [{ kind: 'imp', antecedent: ifThen[1], consequent: ifThen[2] }];

  const implies = x.match(/^(.+?)\s+implies\s+(.+)$/);
  if (implies) return [{ kind: 'imp', antecedent: implies[1], consequent: implies[2] }];

  // 2) Conjunction: "A and B"
  if (x.includes(' and ')) {
    const parts = x.split(/\s+and\s+/).map(norm);
    if (parts.length >= 2) return [{ kind: 'and', parts }];
  }

  // 3) Universal
  const all1 = x.match(/^(all|every)\s+([a-z ]+?)\s+(?:are|is)\s+([a-z ]+)$/);
  if (all1) return [{ kind: 'all', subj: lemmaType(all1[2]), pred: lemmaType(all1[3]) }];

  // 4) Negative universal
  const none = x.match(/^no\s+([a-z ]+?)\s+(?:are|is)\s+([a-z ]+)$/);
  if (none) return [{ kind: 'no', subj: lemmaType(none[1]), pred: lemmaType(none[2]) }];

  // 5) Instantiation: "z is (a) x"
  const is1 = x.match(/^([a-z][a-z0-9_-]*)\s+is\s+(?:an?\s+)?([a-z ]+)$/);
  if (is1) return [{ kind: 'is', entity: norm(is1[1]), type: lemmaType(is1[2]) }];

  // Default: treat as atom
  return [{ kind: 'atom', text: x }];
}

export function entailDialogical(req: EntailRequest): EntailResponse {
  const { textSentences, hypothesis } = req;

  const facts = new Set<string>();
  const steps: EntailTraceStep[] = [];
  const usedRules: EntailRule[] = [];

  const rulesImp: Array<{ a: string; b: string; raw: string }> = [];
  const rulesAll: Array<{ s: string; p: string; raw: string }> = [];
  const negAll:  Array<{ s: string; p: string; raw: string }> = [];

  // helpers
  const addFact = (t: string, why?: EntailTraceStep) => {
    const v = norm(t);
    if (!facts.has(v)) {
      facts.add(v);
      if (why) steps.push(why);
    }
  };
  const addIsFact = (entity: string, type: string, used: string[]) => {
    const t = `${norm(entity)} is ${lemmaType(type)}`;
    addFact(t, { rule: 'DIRECT_MATCH', used, derived: t });
  };

  // Seed: parse text T into facts / rules
  for (const sent of textSentences) {
    const ps = parseSentence(sent);
    for (const p of ps) {
      switch (p.kind) {
        case 'atom':
          addFact(p.text, { rule: 'DIRECT_MATCH', used: [sent], derived: p.text });
          break;
        case 'and':
          for (const q of p.parts) {
            addFact(q, { rule: 'AND_ELIM', used: [sent], derived: q });
            usedRules.push('AND_ELIM');
          }
          break;
        case 'imp':
          rulesImp.push({ a: p.antecedent, b: p.consequent, raw: sent });
          break;
        case 'all':
          rulesAll.push({ s: p.subj, p: p.pred, raw: sent });
          break;
        case 'is':
          addIsFact(p.entity, p.type, [sent]);
          break;
        case 'no':
          negAll.push({ s: p.subj, p: p.pred, raw: sent });
          break;
      }
    }
  }

  // Forward-chaining
  let changed = true;
  while (changed) {
    changed = false;

    // Modus Ponens
    for (const r of rulesImp) {
      if (facts.has(norm(r.a)) && !facts.has(norm(r.b))) {
        addFact(r.b, { rule: 'MODUS_PONENS', used: [r.a, r.raw], derived: r.b });
        usedRules.push('MODUS_PONENS');
        changed = true;
      }
    }

    // Universal instantiation
    const isFacts = Array.from(facts).map(f => {
      const m = f.match(/^([a-z][a-z0-9_-]*)\s+is\s+([a-z ]+)$/);
      return m ? { entity: m[1], type: m[2], raw: f } : null;
    }).filter(Boolean) as Array<{entity:string; type:string; raw:string}>;

    for (const r of rulesAll) {
      for (const inst of isFacts) {
        if (lemmaType(inst.type) === lemmaType(r.s)) {
          const concl = `${inst.entity} is ${lemmaType(r.p)}`;
          if (!facts.has(norm(concl))) {
            addFact(concl, { rule: 'UNIVERSAL_INSTANT', used: [inst.raw, `all ${r.s} are ${r.p}`], derived: concl });
            usedRules.push('UNIVERSAL_INSTANT');
            changed = true;
          }
        }
      }
    }
  }

  // Check contradiction (NO X ARE Y)
  const contradiction = negAll.some(({ s, p }) => {
    const targetS = ` is ${lemmaType(s)}`;
    const targetP = ` is ${lemmaType(p)}`;
    const zIsS = Array.from(facts).find(f => f.endsWith(targetS));
    const zIsP = Array.from(facts).find(f => f.endsWith(targetP));
    return zIsS && zIsP;
  });
  if (contradiction) {
    steps.push({ rule: 'NEGATION_CONFLICT', used: ['no X are Y', 'z is X', 'z is Y'] });
    return {
      status: 'CONTRADICTS',
      derived: Array.from(facts),
      usedRules: [...usedRules, 'NEGATION_CONFLICT'],
      steps,
      classicalPatterns: [...usedRules, 'NEGATION_CONFLICT'],
    };
  }

  // Hypothesis check (accept several surface shapes)
  const H = norm(hypothesis);
  const hp = parseSentence(H)[0];
  const hText = (() => {
    switch (hp.kind) {
      case 'atom': return hp.text;
      case 'is':   return `${hp.entity} is ${lemmaType(hp.type)}`;
      case 'and':  return hp.parts.every(p => facts.has(norm(p))) ? hp.parts.join(' & ') : '';
      case 'imp':  return facts.has(norm(hp.consequent)) ? hp.consequent : '';
      case 'all':
      case 'no':   return H; // treat as atom-ish for now
      default:     return '';
    }
  })();

  if (hText && facts.has(norm(hText))) {
    steps.push({ rule: 'DIRECT_MATCH', used: ['T ⊢ …'], derived: hText });
    if (!usedRules.includes('DIRECT_MATCH')) usedRules.push('DIRECT_MATCH');
    return {
      status: 'ENTAILED',
      derived: Array.from(facts),
      usedRules,
      steps,
      classicalPatterns: usedRules,
    };
  }

  // Fallback
  return {
    status: 'UNDECIDED',
    derived: Array.from(facts),
    usedRules,
    steps,
    classicalPatterns: usedRules,
  };
}
