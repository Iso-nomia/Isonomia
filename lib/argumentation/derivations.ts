// lib/argumentation/derivations.ts
export type Assumption = {
  id: string;
  kind: 'premise'|'default-exception'|'warrant'|'scheme-fit'|'source'|'cq-open';
  // link to claim/edge/scheme/CQ etc.
  targetType: 'claim'|'edge'|'scheme'|'cq'|'evidence';
  targetId: string;
  weight?: number; // optional local strength, 0..1
};

export type Derivation = {
  id: string;
  argumentId: string;              // the argument node (conclusion)
  premises: string[];              // ids of supporting argument nodes or claims
  schemeKey?: string|null;         // e.g., expert_opinion, analogy, ...
  assumptions: Assumption[];       // free variables in Ambler’s sense
  sources?: string[];              // evidence links
};
