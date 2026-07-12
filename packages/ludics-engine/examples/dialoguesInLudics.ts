export type LudicAct = {
  polarity: 'pos' | 'neg' | 'daimon';
  locusPath: string;          // e.g., "0.i1.1"
  openings: number[] | [];    // directory at that address
  expression?: string;        // purely for inspection/UX
};

export type LudicDesign = {
  participantId: 'Proponent' | 'Opponent';
  acts: LudicAct[];
  // (optional) metadata
  title?: string;
};

// Paper Example: “English drama…”  (Fleury–Quatrini–Tronçon)
export const Example_EnglishDrama_P: LudicDesign = {
  participantId: 'Proponent',
  title: 'P — English drama claim',
  acts: [
    // (+, ξ.i1, {1})
    { polarity:'pos', locusPath:'0.i1', openings:[1],
      expression: 'the English were supreme in drama' },

    // (+, ξ.i1.1, {3})
    { polarity:'pos', locusPath:'0.i1.1', openings:[3],
      expression: '(refines focus opened at i1 — ramifies “drama”)' },

    // (+, ξ.i2, {1})
    { polarity:'pos', locusPath:'0.i2', openings:[1],
      expression: 'doesn’t it?' }, // rhetorical tag in paper
  ],
};

export const Example_EnglishDrama_O: LudicDesign = {
  participantId: 'Opponent',
  title: 'O — challenges',
  acts: [
    // c1 = (−, ξ.i1, {1})
    { polarity:'neg', locusPath:'0.i1', openings:[1],
      expression:'(receives the claim at i1)' },

    // (−, ξ.i1.1, {{1},{2}})
    { polarity:'neg', locusPath:'0.i1.1', openings:[1,2],
      expression:'“drama = tragedy & comedy alone” (sets two sub-openings)' },

    // c2 = (−, ξ.i2, {1})
    { polarity:'neg', locusPath:'0.i2', openings:[1],
      expression:'“why not?” / acknowledgment path' },

    // daimon to acknowledge closure (†)
    { polarity:'daimon', locusPath:'0', openings:[], expression:'agree (†)' },
  ],
};
