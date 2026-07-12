export type AttackOption = {
    key: string;
    label: string;
    type: 'rebut'|'undercut';
    targetScope?: 'premise'|'inference'|'conclusion';
    template: string;
  };
  
  export type CQPreset = {
    schemeKey: string;
    cqKey?: string;                    // optional narrow match
    shape: 'conditional'|'quantifier'|'disjunction'|'conjunction'|'source'|'analogy'|'definition'|'exception';
    options: AttackOption[];
  };
  
  export const CQ_PRESETS: CQPreset[] = [
    {
      schemeKey: 'expert_opinion',
      shape: 'conditional',  // implicitly: (Expert says p) ⇒ p
      options: [
        { key: 'undercut_warrant', label: 'Undercut (testimony ⇒ truth)', type:'undercut', targetScope:'inference',
          template: 'The statement is testimony and does not by itself entail its truth in this context (missing corroboration).' },
        { key: 'rebut_counter_expert', label: 'Rebut (counter‑expert)', type:'rebut', targetScope:'conclusion',
          template: 'An equally/ more qualified source concludes the opposite under similar conditions.' },
        { key: 'rebut_credentials', label: 'Rebut (credentials/independence)', type:'rebut', targetScope:'premise',
          template: 'The quoted expert lacks relevant expertise/independence required for this domain.' },
      ]
    },
    {
      schemeKey: 'cause_to_effect',
      shape: 'conditional',
      options: [
        { key:'undercut_alt_cause', label:'Undercut (alternative cause)', type:'undercut', targetScope:'inference',
          template:'The effect can be explained by an alternative cause not ruled out by the argument.' },
        { key:'rebut_counterexample', label:'Rebut (counterexample)', type:'rebut', targetScope:'conclusion',
          template:'There exist cases with the cause present but the effect absent under comparable conditions.' },
      ]
    },
    {
      schemeKey: 'argument_from_sign',
      shape: 'conditional',
      options: [
        { key:'undercut_reliability', label:'Undercut (sign reliability)', type:'undercut', targetScope:'inference',
          template:'The sign is unreliable in this context (low PPV / confounded).' },
      ]
    },
    {
      schemeKey: 'appeal_to_consequences',
      shape: 'analogy',
      options: [
        { key:'undercut_normative', label:'Undercut (normative gap)', type:'undercut', targetScope:'inference',
          template:'Consequences alone do not justify the normative conclusion without an explicit value premise.' },
      ]
    },
    {
      schemeKey: 'definition',
      shape: 'definition',
      options: [
        { key:'rebut_counterdef', label:'Rebut (counter‑definition)', type:'rebut', targetScope:'premise',
          template:'An accepted alternative definition in this domain yields a different classification.' },
      ]
    },
    {
      schemeKey: 'claim_truth',
      shape: 'conditional',
      options: [
        { key:'rebut_evidence', label:'Rebut (counter-evidence)', type:'rebut', targetScope:'conclusion',
          template:'Evidence contradicts or undermines the claim.' },
        { key:'undercut_reliability', label:'Undercut (source reliability)', type:'undercut', targetScope:'inference',
          template:'The evidence source is unreliable or the inference from evidence to claim is unwarranted.' },
      ]
    },
    {
      schemeKey: 'claim_relevance',
      shape: 'conditional',
      options: [
        { key:'rebut_off_topic', label:'Rebut (off-topic)', type:'rebut', targetScope:'conclusion',
          template:'This claim is not relevant to the topic of discussion.' },
        { key:'undercut_context', label:'Undercut (context mismatch)', type:'undercut', targetScope:'inference',
          template:'The claim does not address the specific context or scope of the deliberation.' },
      ]
    },
    // add more as you need…
  ];
  
  export function presetsForCQ(schemeKey: string, cqKey?: string) {
    return CQ_PRESETS.filter(p => p.schemeKey === schemeKey && (!p.cqKey || p.cqKey === cqKey));
  }
  