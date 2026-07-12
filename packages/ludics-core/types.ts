export type LocusPath = string;          // "0.1.2"
// export type Polarity = 'P' | 'O';
export type TravelStatus = 'ONGOING'|'CONVERGENT'|'DIVERGENT';

export type Polarity = 'P' | 'O' | 'pos' | 'neg' | 'daimon';


export type ProperAct = {
  kind: 'PROPER';
  polarity: Polarity;
  locus: LocusPath;           // MUST exist / be created in LudicLocus
  ramification: string[];     // child suffixes or named slots
  expression?: string;
  additive?: boolean;         // additive gate at THIS locus
  isAdditive?: boolean;

  meta?: Record<string, unknown>;
};

export type DaimonAct = {
  kind: 'DAIMON';
  expression?: string;        // optional reason/label for †
};

// export type DialogueAct = ProperAct | DaimonAct;
export type DialogueAct = {
  kind?: string;
  polarity?: 'pos' | 'neg' | 'daimon' | 'O' | 'P';
  locus?: string;
  ramification?: string[];     // child suffixes or named slots

  locusPath?: string;         // e.g., "0.3"
  openings?: string[];       // children opened by this act
  expression?: string;       // canonical text
  additive?: boolean;        // true = additive (exclusive), false/undefined = multiplicative
};

export type MovePayload = {
  cqId?: string;
  locusPath?: string;        // default "0"
  expression?: string;
  original?: string;
  acts?: DialogueAct[];      // NEW
};

export type LudicDesign = {
  id?: string;
  /** Initial loci (default ["0"]). Only needed for validation; travel logic infers entry. */
  base?: LocusPath[];
  acts: DialogueAct[];
};

export type TracePair = {
  posActId: string;
  negActId: string;
  ts: number;
  actor?: string;
};

export type InteractionTrace = {
  convergent: boolean;
  divergent: boolean;
  reason?: string;
  /** The ordered handshake pairs we visited. */
  pairs: TracePair[];
  /** If convergent, where † happened. */
  daimonAt?: LocusPath;
};

export type Endorsement = {
  locusPath: string;
  byParticipantId: string;
  viaActId: string;
};

export type DaimonHint = {
  locusPath: string;
  act: { polarity: 'daimon'; locus: string; openings: []; additive: false;reason: 'no-openings' };
};

// export type StepResult = {
//   status: 'ONGOING' | 'CONVERGENT' | 'DIVERGENT';
//   pairs: { posActId: string; negActId: string; ts: number }[];
//   endedAtDaimonForParticipantId?: string;
//   endorsement?: Endorsement;
//   decisiveIndices?: number[];               // existing v2 field
//   usedAdditive?: Record<string, string>;    // existing v2 field
//   daimonHints?: DaimonHint[];               // 👈 NEW (optional)
// };



export type StepResult = {
  status: 'ONGOING'|'CONVERGENT'|'DIVERGENT'|'STUCK';
  pairs: { posActId?: string; negActId?: string; locusPath: string; ts: number }[];
  decisiveIndices?: number[];                      // explain “why it ended”
  endedAtDaimonForParticipantId?: 'Proponent'|'Opponent';
  usedAdditive?: Record<string,string>;            // parentPath -> chosen child suffix
  daimonHints?: DaimonHint[];                              // NEW
  endorsement?: Endorsement;
  reason?: 'timeout'|'incoherent-move'|'additive-violation'|'no-response'|'consensus-draw'|'dir-collision';
  /**
   * First-divergence address (path, e.g. "0.1.2") on `DIVERGENT` runs — the
   * locus of the first unmatched positive (warm-up object E0 of Q-040 / C012).
   * Surfaced verbatim from the pure kernel `stepCore`; `undefined` otherwise.
   */
  divergenceLocus?: string;
  collisions?: { base: string; dirs: string[] }[];
  shiftInserted?: boolean;
  terminated?: boolean;
  terminatedFor?: ('Proponent'|'Opponent')[];
  traceId?: string;
};


export type FocusPhase = 'focus-P'|'focus-O'|'neutral';
