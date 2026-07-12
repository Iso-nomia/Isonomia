export type ActAppendedEvt = {
    designId: string; dialogueId: string; actId: string; orderInDesign: number;
    act: { kind: 'PROPER'|'DAIMON'; polarity?: 'P'|'O'; locusPath?: string; expression?: string; additive?: boolean };
  };
  export type TraversalEvt = {
    dialogueId: string; posDesignId: string; negDesignId: string;
    pairs: { posActId: string; negActId: string; ts: number }[];
    status: 'ONGOING'|'CONVERGENT'|'DIVERGENT' | "STUCK"; endedAtDaimonForParticipantId?: string;
  };
  export type CSUpdatedEvt = {
    ownerId: string; csId: string;
    added?: any[]; erased?: any[]; derived?: any[]; contradictions?: any[];
  };
  
  type Listener<T> = (payload: T) => void;
  
  const listeners = {
    actAppended: [] as Listener<ActAppendedEvt>[],
    traversal:   [] as Listener<TraversalEvt>[],
    csUpdated:   [] as Listener<CSUpdatedEvt>[],
  };
  
  export const Hooks = {
    onActAppended(fn: Listener<ActAppendedEvt>) { listeners.actAppended.push(fn); },
    onTraversal(fn: Listener<TraversalEvt>)     { listeners.traversal.push(fn); },
    onCSUpdated(fn: Listener<CSUpdatedEvt>)     { listeners.csUpdated.push(fn); },
    emitActAppended(p: ActAppendedEvt) { for (const f of listeners.actAppended) f(p); },
    emitTraversal(p: TraversalEvt)     { for (const f of listeners.traversal) f(p); },
    emitCSUpdated(p: CSUpdatedEvt)     { for (const f of listeners.csUpdated) f(p); },
  };
  