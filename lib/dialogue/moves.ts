// lib/dialogue/moves.ts
import { LudicPolarity } from "@prisma/client";
export type DialogueKind ="ASSERT" | "WHY" | "GROUNDS" | "RETRACT" | "CONCEDE" | "CLOSE" | "THEREFORE" | "SUPPOSE" | "DISCHARGE" |"ACCEPT_ARGUMENT";
export type TargetType = 'argument'|'claim'|'card';


export function cqKey(p:any){ return String(p?.cqId ?? p?.schemeKey ?? 'default'); }
export function hashExpr(s?: string) {
  if (!s) return '∅';
  let h = 0; for (let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i) | 0; return String(h);
}

export function makeSignature(kind: DialogueKind, targetType: TargetType, targetId: string, payload: any) {
  if (kind === 'WHY') return ['WHY', targetType, targetId, cqKey(payload)].join(':');
  if (kind === 'GROUNDS') {
    const key   = cqKey(payload);
    const locus = String(payload?.locusPath ?? '');
    const child = String(payload?.childSuffix ?? '');
    const hexpr = hashExpr(String(payload?.expression ?? payload?.brief ?? payload?.note ?? ''));
    return ['GROUNDS', targetType, targetId, key, locus, child, hexpr].join(':');
  }
  if (kind === 'ASSERT' && payload?.as === 'CONCEDE') {
    return ['CONCEDE', targetType, targetId, hashExpr(String(payload?.expression ?? payload?.text ?? ''))].join(':');
  }
  if (kind === 'CLOSE') {
    const locus = String(payload?.locusPath ?? '0');
    return ['CLOSE', targetType, targetId, locus].join(':');
  }
  return [kind, targetType, targetId, Date.now().toString(36), Math.random().toString(36).slice(2,8)].join(':');
}

export function synthesizeActs(kind: DialogueKind, payload: any) {
  const locus = String(payload?.locusPath ?? '0');
  const expr  = String(payload?.expression ?? payload?.brief ?? payload?.text ?? payload?.note ?? '');
  const toLudicPolarity = (p: 'pos'|'neg'): 'P'|'O' => (p === 'pos' ? 'P' : 'O'); // aligns with schema

  if (kind === 'WHY')     return [{ polarity:toLudicPolarity('neg') as LudicPolarity, locusPath:locus, openings:[], expression: expr }];
  if (kind === 'GROUNDS') return [{ polarity:toLudicPolarity('pos') as LudicPolarity, locusPath:locus, openings:[], expression: expr, additive:false }];
  if (kind === 'CLOSE')   return [{ polarity:'DAIMON' as LudicPolarity, locusPath:locus, openings:[], expression:'†' }];
  return [{ polarity:toLudicPolarity('pos') as LudicPolarity, locusPath:locus, openings:[], expression: expr }];
}
