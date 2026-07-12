// lib/ports/claimReader.ts
export async function listClaims(deliberationId: string) {
  const u = new URL('/api/claims', location.origin);
  u.searchParams.set('deliberationId', deliberationId);
  const r = await fetch(u.toString(), { cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ items: Array<{id:string, text:string}> }>;
}
