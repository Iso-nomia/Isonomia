import { createHash } from 'crypto';

/** Canonicalize JSON: remove volatile keys, NFC unicode, stable key order, collapse whitespace. */
export function canonicalize(obj: any, opts?: { strip?: string[] }): string {
  const strip = new Set(opts?.strip ?? ['id','createdAt','updatedAt']);
  function clean(x: any): any {
    if (Array.isArray(x)) return x.map(clean);
    if (x && typeof x === 'object') {
      const out: Record<string, any> = {};
      Object.keys(x).sort().forEach(k => {
        if (!strip.has(k)) out[k] = clean(x[k]);
      });
      return out;
    }
    if (typeof x === 'string') {
      return x.normalize('NFC').replace(/\s+/g, ' ').trim();
    }
    return x;
  }
  return JSON.stringify(clean(obj));
}

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Compact Crockford Base32 (no padding) */
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function hexToBase32(hex: string): string {
  const bytes = Buffer.from(hex, 'hex');
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (chunk.length < 5) break;
    out += ALPHA[parseInt(chunk, 2)];
  }
  return out;
}

export function moidForEntity(entity: string, payload: any) {
  const canonical = canonicalize({ entity, payload });
  return sha256Hex(canonical);
}
