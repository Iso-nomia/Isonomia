import type { NextRequest } from 'next/server';

export async function readJSON<T>(req: NextRequest): Promise<T> {
  try { return await req.json(); } catch { throw new Error('Invalid JSON'); }
}

export function ok(data: any, init: number = 200) {
  return new Response(JSON.stringify(data), {
    status: init,
    headers: { 'content-type': 'application/json' },
  });
}

export function badRequest(message: string, extra?: any) {
  return ok({ error: message, ...(extra ?? {}) }, 400);
}

export function toBigInt(id: string | number | bigint): bigint {
  if (typeof id === 'bigint') return id;
  if (typeof id === 'number') return BigInt(id);
  // string
  return BigInt(id);
}

export function s(x: bigint | number | string | null | undefined) {
  if (x === null || x === undefined) return null;
  return typeof x === 'bigint' ? x.toString() : String(x);
}
