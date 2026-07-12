// components/work/editors/slot-helpers.ts
export type SlotKey =
  | 'DN.explanandum' | 'DN.nomological'
  | 'IH.structure'   | 'IH.function' | 'IH.objectivity'
  | 'TC.function'    | 'TC.explanation' | 'TC.applications'
  | 'OP.unrecognizability' | 'OP.alternatives';

export function slotAnchorId(key: SlotKey) {
  return `slot-${key}`;             // e.g. slot-IH.function
}
