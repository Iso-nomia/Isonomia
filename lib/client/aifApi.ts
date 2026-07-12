// lib/client/aifApi.ts
export type ClaimLite = { id: string; text: string };

function routeOf(res: Response) {
  try { return new URL(res.url).pathname; } catch { return res.url || '<unknown>'; }
}

async function asJson<T>(res: Response): Promise<T> {
  let j: any = null;
  try { j = await res.json(); } catch { /* non-JSON bodies (204/empty, etc.) */ }

  if (!res.ok || (j && j.ok === false)) {
    const url = routeOf(res);
    const msg = j?.error || j?.message || j?.details || `HTTP ${res.status}`;
    throw new Error(`[${res.status}] ${url} – ${msg}`);
  }
  return (j ?? {}) as T;
}

// async function asJson<T>(res: Response): Promise<T> {
//   const j = await res.json().catch(() => ({}));
//   if (!res.ok || (j && j.ok === false)) throw new Error(j?.error || `HTTP ${res.status}`);
//   return j;
// }

export async function searchClaims(
  q: string,
  deliberationId: string,
  opts?: { signal?: AbortSignal; limit?: number }
): Promise<ClaimLite[]> {
  const params = new URLSearchParams({ q, deliberationId });
  if (opts?.limit) params.set('limit', String(opts.limit));
  const r = await fetch(`/api/claims/search?${params}`, { signal: opts?.signal, cache: 'no-store' });
  const j = await r.json();
  if (!r.ok || j?.ok === false) throw new Error(j?.error || `HTTP ${r.status}`);
  return Array.isArray(j.items) ? j.items : [];
}

export async function tryGetArgumentCQs(argumentId: string) {
  try { return await getArgumentCQs(argumentId); }
  catch { return []; }
}

export async function createClaim(params: { deliberationId: string; authorId: string; text: string }) {
  const res = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });

  // tolerate old/new shapes: {id} | {claim:{id}} | {claimId}
  let j: any = null;
  try { j = await res.json(); } catch {}
  if (!res.ok || j?.ok === false || j?.error) {
    const msg = j?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  const id = j?.id || j?.claim?.id || j?.claimId;
  if (!id) throw new Error('No claim id returned from /api/claims');
  return String(id);
}
// export async function listSchemes() {
//   const { items } = await asJson<{ items: Array<{ id: string; key: string; name: string; slotHints?: any; cqs?: any[] }> }>(
//     await fetch('/api/schemes', { cache: 'no-store' })
//   );
//   return items ?? [];
// }
export async function listSchemes() {
  const r = await fetch('/api/aif/schemes?ensure=1', { cache: 'no-store' });
  const j = await r.json().catch(() => ({ items: [] }));
  const items = Array.isArray(j.items) ? j.items : [];
  return items.map((s: any) => ({
    id: s.id ?? s.schemeId ?? s._id,
    key: s.key,
    name: s.name ?? s.title ?? s.key,         // ← tolerate both shapes
    summary: s.summary,
    slotHints: s.slotHints ?? s.hints ?? null,
    cqs: Array.isArray(s.cqs) ? s.cqs : (Array.isArray(s.cq) ? s.cq : []),
    // Phase 6D: Hierarchy fields
    parentSchemeId: s.parentSchemeId ?? null,
    clusterTag: s.clusterTag ?? null,
    ownCQCount: s.ownCQCount ?? (Array.isArray(s.cqs) ? s.cqs.length : 0),
    totalCQCount: s.totalCQCount ?? (Array.isArray(s.cqs) ? s.cqs.length : 0),
    // Phase 6E: Formal structure
    formalStructure: s.formalStructure ?? null,
  }));
}

export async function createArgument(payload: {
  deliberationId: string;
  authorId: string;
  conclusionClaimId: string;
  premiseClaimIds: string[];
  schemeId?: string | null;
  implicitWarrant?: { text: string } | null;
  text?: string;
  premisesAreAxioms?: boolean;  // Phase B: Axiom designation
  justification?: string;  // Justification for scheme selection
  ruleType?: 'STRICT' | 'DEFEASIBLE';  // ASPIC+ Phase 1b.3: Rule type
  ruleName?: string;  // ASPIC+ Phase 1b.3: Optional rule name
  bypassContradictionCheck?: boolean;  // Allow bypassing contradiction warnings
}) {
  const res = await fetch('/api/arguments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  // Handle contradiction detection (409 status)
  if (res.status === 409) {
    const j = await res.json();
    // Throw a special error that includes contradiction data
    const error = new Error('Contradiction detected') as any;
    error.isContradiction = true;
    error.contradictions = j.contradictions;
    error.message = j.message || 'Your conclusion contradicts an existing commitment';
    throw error;
  }
  
  const j = await asJson<{ argumentId: string }>(res);
  return j.argumentId;
}

export async function getArgumentCQs(argumentId: string) {
  // If you renamed the folder to aif-cqs (recommended):
  const res = await fetch(`/api/arguments/${argumentId}/aif-cqs`, { cache: 'no-store' });
  const j = await res.json().catch(()=>({ items: [] }));
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  return j.items ?? [];
}

export async function getArgumentCQsWithProvenance(argumentId: string) {
  const res = await fetch(`/api/arguments/${argumentId}/cqs-with-provenance`, { cache: 'no-store' });
  const j = await res.json().catch(() => ({ 
    ownCQs: [], 
    inheritedCQs: [], 
    allCQs: [],
    totalCount: 0,
    ownCount: 0,
    inheritedCount: 0 
  }));
  if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
  return j;
}

export async function exportAif(deliberationId: string, opts?: { includeLocutions?: boolean; includeCQs?: boolean }) {
  const params = new URLSearchParams({ deliberationId });
  if (opts?.includeLocutions) params.set('loc', '1');
  if (opts?.includeCQs) params.set('cqs', '1');
  const r = await fetch(`/api/aif/export?${params.toString()}`, { cache: 'no-store' });
  const j = await asJson<any>(r);
  return j;
}

export async function importAifBatch(doc: any, options: { mode: 'validate'|'upsert'; deliberationId?: string; authorId?: string }) {
  const r = await fetch('/api/aif/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...doc, options }),
  });
  return asJson<any>(r);
}
export async function askCQ(argumentId: string, cqKey: string, ctx: { authorId: string; deliberationId: string }) {
  const res = await fetch(`/api/arguments/${argumentId}/cqs/${encodeURIComponent(cqKey)}/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ctx),
  });
  await asJson(res);
}

export async function postAttack(
  targetArgumentId: string,
  payload: {
    deliberationId: string;
    createdById: string;
    fromArgumentId: string;
    attackType: 'REBUTS' | 'UNDERCUTS' | 'UNDERMINES';
    targetScope: 'conclusion' | 'inference' | 'premise';
    toArgumentId?: string | null;
    targetClaimId?: string | null;
    targetPremiseId?: string | null;
    cqKey?: string | null;
  }
) {
  const res = await fetch(`/api/arguments/${encodeURIComponent(targetArgumentId)}/attacks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return asJson<{ ok: boolean; edgeId: string }>(res);
}

export type BatchMode = 'validate' | 'upsert';
export async function batchAif(payload: any, mode: BatchMode = 'validate') {
  const res = await fetch(`/api/batch/aif?mode=${encodeURIComponent(mode)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/ld+json' }, // allow plain JSON too
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  return asJson<{ ok: boolean; report?: any; upserted?: any; rejected?: any[] }>(res);
}

// ---- AIF JSON-LD export (deliberation | argument) ----
export async function exportAifJsonLd(params: { deliberationId?: string; argumentId?: string; includeLocutions?: boolean } ) {
  const q = new URLSearchParams();
  if (params.deliberationId) q.set('deliberationId', params.deliberationId);
  if (params.argumentId) q.set('argumentId', params.argumentId);
  if (params.includeLocutions) q.set('includeLocutions', '1');
  const res = await fetch(`/api/export/aif-jsonld?${q}`, { cache: 'no-store' });
  return asJson<any>(res); // returns a JSON-LD document with @context + @graph
}

// ---- listSchemes with facets ----
export type SchemeFacets = {
  purpose?: ('action' | 'state_of_affairs')[];
  source?: ('internal' | 'external')[];
  materialRelation?: string[];   // 'cause'|'definition'|'analogy'|'authority'|...
  reasoningType?: ('deductive'|'inductive'|'abductive'|'practical')[];
};
export async function listSchemesWithFacets(facets?: SchemeFacets) {
  const q = new URLSearchParams();
  if (facets?.purpose?.length) facets.purpose.forEach(v => q.append('purpose', v));
  if (facets?.source?.length) facets.source.forEach(v => q.append('source', v));
  if (facets?.materialRelation?.length) facets.materialRelation.forEach(v => q.append('materialRelation', v));
  if (facets?.reasoningType?.length) facets.reasoningType.forEach(v => q.append('reasoningType', v));
  const res = await fetch(`/api/aif/schemes?${q.toString()}`, { cache: 'no-store' });
  return asJson<{ items: Array<{
    id: string; key: string; name: string;
    purpose?: string|null; source?: string|null;
    materialRelation?: string|null; reasoningType?: string|null;
    slotHints?: any; cqs?: any[];
  }> }>(res);
}

// ---- Critical Question helpers ----
// Convenience wrapper for CQ lifecycle; optionally couples to CA posting.
export async function openCQ(params: { argumentId: string; schemeKey: string; cqKey: string; authorId: string; deliberationId: string }) {
  const res = await fetch('/api/cq', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'open', ...params })
  });
  return asJson<{ ok:boolean }>(res);
}
export async function resolveCQ(params: {
  argumentId: string; schemeKey: string; cqKey: string; authorId: string; deliberationId: string;
  resolution?: 'answered'|'closed';
  // optional CA coupling, e.g. when answering a WHY as a formal attack
  attachCA?: {
    attackType: 'REBUTS'|'UNDERCUTS'|'UNDERMINES';
    targetScope: 'conclusion'|'inference'|'premise';
    conflictingClaimId?: string; // for REBUTS/UNDERMINES
    conflictedArgumentId?: string; // for UNDERCUTS
    conflictedClaimId?: string; // for UNDERS/REB on claims
  } | null;
}) {
  const res = await fetch('/api/cq', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'resolve', ...params })
  });
  return asJson<{ ok:boolean }>(res);
}
export async function closeCQ(params: { argumentId: string; schemeKey: string; cqKey: string; authorId: string; deliberationId: string }) {
  const res = await fetch('/api/cq', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'close', ...params })
  });
  return asJson<{ ok:boolean }>(res);
}

