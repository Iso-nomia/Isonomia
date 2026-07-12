

export class LudicError extends Error { code: string; info?: any;
    constructor(code: string, msg: string, info?: any) { super(msg); this.code = code; this.info = info; }
  }
  export const E = {
    Alternation: 'ALTERNATION',
    AdditiveReuse: 'ADDITIVE_REUSE',
    NoDual: 'NO_DUAL',
    NoSuchDesign: 'NO_SUCH_DESIGN',
    NoSuchLocus: 'NO_SUCH_LOCUS',
    Visibility: 'VISIBILITY', // 👈 NEW

  };
  