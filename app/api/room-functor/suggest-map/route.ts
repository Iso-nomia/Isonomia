// app/api/room-functor/suggest-map/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

// Keep it simple and Unicode-friendly
function normalize(t: unknown): string {
  if (typeof t !== 'string') return '';
  return t
    .toLowerCase()
    .replace(/^[a-zα-ωά-ώ]\s*:\s*/iu, '')        // strip leading “φ:”/“ψ:”/“a:” style labels
    .replace(/[“”"‘’'`]/g, '')                    // quotes
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')            // punctuation → space
    .replace(/\s+/g, ' ')
    .trim();
}
function tokens(t: string): string[] {
  return normalize(t).split(' ').filter(w => w.length > 1);
}
function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter === 0 ? 0 : inter / (a.size + b.size - inter);
}

type ClaimLite = { id: string; text: string; createdAt: Date };
type ClaimMap = Record<string, string>;

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({} as any));
    const fromId = String(body?.fromId ?? url.searchParams.get('from') ?? '').trim();
    const toId   = String(body?.toId   ?? url.searchParams.get('to')   ?? '').trim();

    if (!fromId || !toId) {
      return NextResponse.json({ ok: false, error: 'Missing fromId/toId' }, { status: 400, ...NO_STORE });
    }

    // Pull a modest set; you can raise limits if needed
    const [fromClaims, toClaims] = await Promise.all([
      prisma.claim.findMany({
        where: { deliberationId: fromId },
        select: { id: true, text: true, createdAt: true },
        take: 5000,
      }),
      prisma.claim.findMany({
        where: { deliberationId: toId },
        select: { id: true, text: true, createdAt: true },
        take: 5000,
      }),
    ]);

    const safeFrom = (fromClaims ?? []).filter((c): c is ClaimLite => !!c?.id && typeof c.text === 'string');
    const safeTo   = (toClaims   ?? []).filter((c): c is ClaimLite => !!c?.id && typeof c.text === 'string');

    if (!safeFrom.length || !safeTo.length) {
      return NextResponse.json({ ok: true, claimMap: {} as ClaimMap }, NO_STORE);
    }

// Prefer exact graph ids that survive room boundaries, then fall back to text.
let byCanon = new Map<string, ClaimLite[]>(), byMoid = new Map<string, ClaimLite[]>();
try {
  // If your schema carries canonicalClaimId or moid, use them.
  // These fields are optional; queries are wrapped in try/catch.
  const toCanon = await prisma.claim.findMany({
    where: { deliberationId: toId, canonicalClaimId: { not: null } },
    select: { id:true, text:true, createdAt:true, canonicalClaimId:true as any }
  });
  for (const c of toCanon) {
    const k = (c as any).canonicalClaimId as string;
    if (!k) continue;
    const arr = byCanon.get(k) ?? [];
    arr.push({ id:c.id, text:c.text, createdAt:c.createdAt });
    byCanon.set(k, arr);
  }
} catch {}
try {
  const toWithMoid = await prisma.claim.findMany({
    where: { deliberationId: toId, moid: { not: null } } as any,
    select: { id:true, text:true, createdAt:true, moid:true }
  });
  for (const c of toWithMoid) {
    const k = (c as any).moid as string;
    if (!k) continue;
        const arr = byMoid.get(k) ?? [];
    arr.push({ id:c.id, text:c.text, createdAt:c.createdAt });
    byMoid.set(k, arr);
  }
} catch {}
    const toByNorm = new Map<string, ClaimLite[]>();
    for (const c of safeTo) {
      const key = normalize(c.text);
      if (!key) continue;
      const arr = toByNorm.get(key);
      if (arr) arr.push(c); else toByNorm.set(key, [c]);
    }

    const usedTo = new Set<string>();
    const claimMap: ClaimMap = {};

     // Pass 0a: by canonical id
try {
  const fromCanon = await prisma.claim.findMany({
    where: { deliberationId: fromId, canonicalClaimId: { not: null } },
    select: { id:true, text:true, createdAt:true, canonicalClaimId:true as any }
  });
  for (const f of fromCanon) {
    const k = (f as any).canonicalClaimId as string;
    const cands = byCanon.get(k);
    if (!k || !cands?.length) continue;
    const best = cands.sort((a,b)=>+a.createdAt - +b.createdAt).find(c => !usedTo.has(c.id));
    if (best) { claimMap[f.id] = best.id; usedTo.add(best.id); }
  }
} catch {}

    try {
  const fromWithMoid = await prisma.claim.findMany({
    where: { deliberationId: fromId, moid: { not: null } } as any,
    select: { id:true, text:true, createdAt:true, moid:true }
  });
  for (const f of fromWithMoid) {
    const k = (f as any).moid as string;
    const cands = byMoid.get(k);
    if (!k || !cands?.length) continue;
    const best = cands.sort((a,b)=>+a.createdAt - +b.createdAt).find(c => !usedTo.has(c.id));
    if (best) { claimMap[f.id] = best.id; usedTo.add(best.id); }
  }
} catch {}

    // Pass 1: exact normalized matches
    for (const f of safeFrom) {
      const key = normalize(f.text);
      if (!key) continue;
      const candidates = toByNorm.get(key);
      if (!candidates?.length) continue;
      // prefer oldest (or earliest) to stabilize
      const best = candidates.sort((a, b) => +a.createdAt - +b.createdAt).find(c => !usedTo.has(c.id));
      if (best) {
        claimMap[f.id] = best.id;
        usedTo.add(best.id);
      }
    }

    // Build token caches for fuzzy pass
    const unmatchedFrom = safeFrom.filter(f => !(f.id in claimMap));
    if (unmatchedFrom.length) {
      const toTokenCache = safeTo
        .filter(c => !usedTo.has(c.id))
        .map(c => ({ c, set: new Set(tokens(c.text)) }))
        .filter(({ set }) => set.size > 0);

      // Pass 2: Jaccard token overlap
      const THRESH = 0.66; // tune if you like
      for (const f of unmatchedFrom) {
        const fset = new Set(tokens(f.text));
        if (!fset.size) continue;

        let best: { id: string; score: number } | null = null;
        for (const { c, set } of toTokenCache) {
          if (usedTo.has(c.id)) continue;
          const s = jaccard(fset, set);
          if (s > (best?.score ?? 0)) best = { id: c.id, score: s };
        }
        if (best && best.score >= THRESH) {
          claimMap[f.id] = best.id;
          usedTo.add(best.id);
        }
      }
    }
    try {
  // If you store claim‑level evidence or can reach argument sources tied to a claim,
  // normalize and intersect domains/DOIs.
  // Placeholder: adjust to your actual evidence tables.
  const norm = (u:string)=> u.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[?#]/)[0];
  const fromEv = await prisma.claimEvidence?.findMany({ where:{ deliberationId: fromId }, select:{ claimId:true, uri:true } } as any).catch(()=>[]);
  const toEv   = await prisma.claimEvidence?.findMany({ where:{ deliberationId: toId },   select:{ claimId:true, uri:true } } as any).catch(()=>[]);
  const toByDom = new Map<string,string[]>(); // domain → [claimId]
  for (const e of (toEv||[])) {
    const d = norm(e.uri||''); if (!d) continue;
    (toByDom.get(d) ?? toByDom.set(d,[]).get(d)!).push(e.claimId);
  }
  for (const e of (fromEv||[])) {
    const d = norm(e.uri||''); if (!d || claimMap[e.claimId]) continue;
    const cand = (toByDom.get(d)||[]).find(id => !usedTo.has(id));
    if (cand) { claimMap[e.claimId] = cand; usedTo.add(cand); }
  }
} catch {}

 // OPTIONAL Pass 4: embedding cosine (server-side vectors table)


    return NextResponse.json({ ok: true, claimMap }, NO_STORE);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'suggest-map failed' },
      { status: 500, ...NO_STORE },
    );
  }
}

// Optional quick health endpoint
export async function GET() {
  return NextResponse.json({ ok: true }, NO_STORE);
}
