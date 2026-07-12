// lib/dialogue/signature.ts
import crypto from 'crypto';

export function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => JSON.stringify(k)+":"+stableStringify(value[k])).join(",")}}`;
}

function cqKey(p:any){ return String(p?.cqId ?? p?.schemeKey ?? 'default'); }
function hashExpr(s?: string) {
  if (!s) return '∅';
  let h = 0; for (let i=0;i<s.length;i++) h = ((h<<5)-h) + s.charCodeAt(i) | 0; return String(h);
}

/** Deterministic signature for idempotent inserts. */
export function computeDialogueMoveSignature(input: {
  deliberationId: string;
  targetType: string;
  targetId: string;
  kind: string;
  payload?: any;
}): string {
  const { deliberationId, targetType, targetId, kind, payload } = input;
  const locus = String(payload?.locusPath ?? '0');

  if (kind === 'WHY')     return [`WHY`, targetType, targetId, cqKey(payload)].join(':');
  if (kind === 'GROUNDS') return [`GROUNDS`, targetType, targetId, cqKey(payload), locus, String(payload?.childSuffix ?? ''), hashExpr(String(payload?.expression ?? payload?.brief ?? payload?.note ?? ''))].join(':');
  if (kind === 'CLOSE')   return [`CLOSE`, targetType, targetId, locus].join(':');
  if (kind === 'ASSERT' && payload?.as === 'CONCEDE') {
    const hexpr = hashExpr(String(payload?.expression ?? payload?.text ?? ''));
    return [`CONCEDE`, targetType, targetId, hexpr].join(':');
  }

  // Fallback (stable, but not used for idempotency checks)
  const base = [deliberationId, targetType, targetId, kind, payload === undefined ? "" : stableStringify(payload)].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}
