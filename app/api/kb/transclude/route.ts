// app/api/kb/transclude/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EvalZ = z.object({
  // Phase 5b step 1: log-odds is the default confidence algebra (was 'product').
  mode: z.enum(['product', 'min', 'logodds']).default('logodds'),
  tau: z.number().min(0).max(1).optional(),
  imports: z.enum(['off', 'materialized', 'virtual', 'all']).default('off'),
}).default({ mode: 'logodds', imports: 'off' });

const ItemZ = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('claim'), id: z.string().min(6), lens: z.string().optional(), roomId: z.string().optional() }),
  z.object({ kind: z.literal('argument'), id: z.string().min(6), lens: z.string().optional() }),
  z.object({ kind: z.literal('room_summary'), id: z.string().min(6), lens: z.string().optional(), limit: z.number().int().positive().max(50).default(5) }),
  z.object({ kind: z.literal('sheet'), id: z.string().min(6), lens: z.string().optional() }),
  z.object({ kind: z.literal('transport'), fromId: z.string().min(6), toId: z.string().min(6), lens: z.string().optional() }),
    z.object({ kind: z.literal('theory_work'), id: z.string().min(6), lens: z.enum(['summary','structure','full']).optional() }),

]);

const BodyZ = z.object({
  spaceId: z.string().min(6),
  eval: EvalZ,
  at: z.string().datetime().or(z.null()).optional(), // for MVP we return live; pin support lands in Phase‑B
  items: z.array(ItemZ).max(50),
});

type Item = z.infer<typeof ItemZ>;

function urlOrigin(req: NextRequest) { return new URL(req.url).origin; }
function fwdAuthHeaders(req: NextRequest) {
  const h = new Headers();
  const cookie = req.headers.get('cookie');
  const auth = req.headers.get('authorization');
  if (cookie) h.set('cookie', cookie);
  if (auth)   h.set('authorization', auth);
  h.set('cache-control','no-store');
  return h;
}

export async function POST(req: NextRequest) {
  try {
    const body = BodyZ.parse(await req.json());
    await requireKbRole(req, { spaceId: body.spaceId, need: 'reader' });

    const origin = urlOrigin(req);
    const authHeaders = fwdAuthHeaders(req);
    const errors: Array<{ index: number; code: string; message?: string; ref?: any }> = [];
    const results: any[] = [];

    async function findClaimRoomId(claimId: string): Promise<string|null> {
      const c = await prisma.claim.findUnique({ where: { id: claimId }, select: { deliberationId: true } });
      return c?.deliberationId ?? null;
    }

    for (let i = 0; i < body.items.length; i++) {
      const it = body.items[i] as Item;
      try {
        if (it.kind === 'claim') {
          const roomId = it.roomId ?? (await findClaimRoomId(it.id));
          if (!roomId) { results.push(null); errors.push({ index:i, code:'not_found', ref:it }); continue; }
          const qs = new URLSearchParams({ mode: body.eval.mode, imports: body.eval.imports });
          if (body.eval.tau != null) qs.set('confidence', String(body.eval.tau));

          const ev = await fetch(`${origin}/api/deliberations/${roomId}/evidential?${qs}`, {
            headers: authHeaders, redirect: 'manual'
          });
          if (!ev.ok) throw new Error(`evidential HTTP ${ev.status}`);
          const ej = await ev.json();

          // Phase 5a: `dsSupport` retired from the evidential response (Phase 4).
          // bel/pl now collapse to the scalar support for the legacy belpl lens.
          const bel = ej?.support?.[it.id] ?? 0;
          const pl  = bel;
          const node = (ej?.nodes || []).find((n:any)=>n.id===it.id);
          const top  = node?.top ?? [];

          results.push({
            kind:'claim', id: it.id, live:true, pinnedAt:null, lens: it.lens ?? 'belpl',
            data: { text: node?.text ?? '', bel, pl, top, roomId },
            provenance: { source:'deliberation', roomId, endpoints:[`GET /api/deliberations/${roomId}/evidential?${qs}`] },
            actions: { openRoom:`/deliberation/${roomId}`, openSheet:`/sheets/delib:${roomId}` }
          });
        }
         // NEW: theory_work
      else if (it.kind === 'theory_work') {
        const res = await fetch(`${origin}/api/works/${it.id}/dossier?format=json`, { headers: authHeaders });
        if (!res.ok) throw { code: 'work_fetch_failed' };
        const j = await res.json();
        results.push({ kind:'theory_work', lens: it.lens ?? 'summary', data: j });
        continue;
      }


        else if (it.kind === 'argument') {
          const r = await fetch(`${origin}/api/arguments/${it.id}?view=diagram`, {
            headers: authHeaders, redirect: 'manual'
          });
          if (!r.ok) throw new Error(`argument HTTP ${r.status}`);
          const diag = await r.json();
          results.push({
            kind:'argument', id: it.id, live:true, pinnedAt:null, lens: it.lens ?? 'diagram',
            data: { diagram: diag },
            provenance: { source:'argument', endpoints:[`GET /api/arguments/${it.id}?view=diagram`] },
            actions: { openArgument:`/api/arguments/${it.id}?view=diagram` }
          });
        }

        else if (it.kind === 'room_summary') {
          const qs = new URLSearchParams({ mode: body.eval.mode, imports: body.eval.imports });
          if (body.eval.tau != null) qs.set('confidence', String(body.eval.tau));
          const ev = await fetch(`${origin}/api/deliberations/${it.id}/evidential?${qs}`, {
            headers: authHeaders, redirect: 'manual'
          });
          if (!ev.ok) throw new Error(`evidential HTTP ${ev.status}`);
          const ej = await ev.json();
          const claims = (ej?.nodes || [])
            .sort((a:any,b:any)=>(b.score??0)-(a.score??0))
            .slice(0, (it as any).limit ?? 5)
            .map((n:any)=>({
              id:n.id, text:n.text, score:n.score,
              bel: n.score,
              pl:  n.score,
              diagramId: n.diagramId ?? null
            }));
          results.push({
            kind:'room_summary', id: it.id, live:true, pinnedAt:null, lens: it.lens ?? 'top_claims',
            data: { claims },
            provenance:{ source:'deliberation', endpoints:[`GET /api/deliberations/${it.id}/evidential?${qs}`] },
            actions:{ openRoom:`/deliberation/${it.id}` }
          });
        }

        else if (it.kind === 'sheet') {
          const r = await fetch(`${origin}/api/sheets/${it.id}`, {
            headers: authHeaders, redirect:'manual'
          });
          if (!r.ok) throw new Error(`sheet HTTP ${r.status}`);
          const s = await r.json();
          results.push({
            kind:'sheet', id: it.id, live:true, pinnedAt:null, lens: it.lens ?? 'nodes',
            data: s,
            provenance:{ source:'sheet', endpoints:[`GET /api/sheets/${it.id}`] },
            actions:{ openSheet:`/sheets/${it.id}` }
          });
        }

        else if (it.kind === 'transport') {
          const mapRes = await fetch(`${origin}/api/room-functor/map?from=${it.fromId}&to=${it.toId}`, {
            headers: authHeaders, redirect:'manual'
          });
          if (!mapRes.ok) throw new Error(`map HTTP ${mapRes.status}`);
          const map = await mapRes.json();
          const claimMap = (map?.mapping?.claimMapJson ?? {}) as Record<string,string>;

          const includeProposals = (it.lens ?? 'map') === 'map_proposals';
          let proposals: any[] = [];
          if (includeProposals) {
            const prev = await fetch(`${origin}/api/room-functor/preview`, {
              method:'POST',
              headers: new Headers({ ...Object.fromEntries(authHeaders), 'Content-Type':'application/json' }),
              body: JSON.stringify({ fromId: it.fromId, toId: it.toId, claimMap }),
              redirect:'manual'
            });
            if (prev.ok) {
              const pj = await prev.json();
              proposals = Array.isArray(pj?.proposals) ? pj.proposals : [];
            }
          }

          results.push({
            kind:'transport', fromId: it.fromId, toId: it.toId, live:true, pinnedAt:null, lens: it.lens ?? 'map',
            data: { claimMap, proposals },
            provenance:{ source:'room_functor', endpoints:['/api/room-functor/map', ...(includeProposals?['/api/room-functor/preview']:[]) ] },
            actions:{ openTransport:`/functor/transport?from=${it.fromId}&to=${it.toId}` }
          });
        }

      } catch (e:any) {
        results.push(null);
        errors.push({ index:i, code:'resolve_failed', message:e?.message, ref:it });
      }
    }

    return NextResponse.json(
      { ok:true, items: results, errors },
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    );
  } catch (err) { return fail(err); }
}