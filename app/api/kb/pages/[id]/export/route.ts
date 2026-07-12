// app/api/kb/pages/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fwdAuth(req: NextRequest) {
  const h = new Headers();
  const cookie = req.headers.get('cookie'); if (cookie) h.set('cookie', cookie);
  const auth   = req.headers.get('authorization'); if (auth) h.set('authorization', auth);
  h.set('cache-control', 'no-store');
  return h;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const as = (req.nextUrl.searchParams.get('as') ?? 'md').toLowerCase();
  if (as !== 'md' && as !== 'pdf') return NextResponse.json({ error: 'unsupported' }, { status: 400 });

  const page = await prisma.kbPage.findUnique({
    where: { id: params.id },
    select: { id:true, title:true, spaceId:true, frontmatter:true },
  });
  if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await requireKbRole(req, { spaceId: page.spaceId, need: 'reader' });

  const blocks = await prisma.kbBlock.findMany({
    where: { pageId: page.id },
    orderBy: { ord: 'asc' },
    select: { id:true, type:true, dataJson:true, live:true, pinnedJson:true },
  });

  // Build transclusion request
  const items: any[] = [];
  const indexMap: number[] = [];
  blocks.forEach((b, i) => {
    const d: any = b.dataJson || {};
    if (b.live === false && b.pinnedJson) return; // will use pinned directly
    if (b.type === 'claim' && d.id) { items.push({kind:'claim', id:d.id, lens:d.lens, roomId:d.roomId}); indexMap.push(i); }
    if (b.type === 'argument' && d.id) { items.push({kind:'argument', id:d.id, lens:d.lens}); indexMap.push(i); }
    if (b.type === 'sheet' && d.id) { items.push({kind:'sheet', id:d.id, lens:d.lens}); indexMap.push(i); }
    if (b.type === 'room_summary' && d.id) { items.push({kind:'room_summary', id:d.id, lens:d.lens, limit:d.limit??5}); indexMap.push(i); }
    if (b.type === 'transport' && d.fromId && d.toId) { items.push({kind:'transport', fromId:d.fromId, toId:d.toId, lens:d.lens??'map'}); indexMap.push(i); }
  });

  let hydrated: any[] = new Array(blocks.length).fill(null);

// After `let hydrated: any[] = new Array(blocks.length).fill(null);` add:
async function hydrateTheoryWork(d:any) {
  // d = block.dataJson
  const wid = d?.workId || d?.id;
  if (!wid) return null;
  const r = await fetch(new URL(`/api/works/${wid}/dossier?format=json`, req.url).toString(), {
    headers: fwdAuth(req)
  });
  if (!r.ok) return null;
  const j = await r.json();
  return { kind:'theory_work', data: j, lens: d?.lens ?? 'summary' };
}

  if (items.length) {
    const j = await fetch(new URL('/api/kb/transclude', req.url).toString(), {
      method:'POST', headers: new Headers({ ...Object.fromEntries(fwdAuth(req)), 'Content-Type':'application/json' }),
      body: JSON.stringify({ spaceId: page.spaceId, eval: ((page.frontmatter as any)?.eval ?? { mode:'product', imports:'off' }), at: null, items })
    }).then(r => r.json()).catch(()=>({}));
    if (Array.isArray(j?.items)) j.items.forEach((env:any, k:number) => { hydrated[indexMap[k]] = env; });
  }

// Later, right before serialization, populate `hydrated[i]` for live theory_work items
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  if (b.type === 'theory_work' && b.live !== false) {
    hydrated[i] = await hydrateTheoryWork(b.dataJson);
  }
}

  // Simple MD serialization
  const lines: string[] = [`# ${page.title}`, ''];
  blocks.forEach((b, i) => {
    if (b.type === 'text') {
      const md = String((b.dataJson as any)?.md ?? '').trim();
      if (md) lines.push(md, '');
      else lines.push('<!-- empty text block -->', '');
      return;
    }
    const env = b.live === false && b.pinnedJson ? b.pinnedJson : hydrated[i];
    if (!env) { lines.push('<!-- unresolved block -->', ''); return; }

    if (env.kind === 'claim') {
      const d = env.data || {};
      lines.push(`### Claim ${d?.text ? '— ' + d.text : ''}`);
      lines.push(`- Bel: ${Math.round((d.bel ?? 0)*100)}%  Pl: ${Math.round((d.pl ?? d.bel ?? 0)*100)}%`);
      lines.push('');
    } else if (env.kind === 'argument') {
      lines.push(`### Argument (diagram)`);
      lines.push('```json'); lines.push(JSON.stringify(env.data?.diagram ?? {}, null, 2)); lines.push('```', '');
    } else if (env.kind === 'room_summary') {
      lines.push(`### Room summary (top claims)`);
      (env.data?.claims ?? []).forEach((c:any)=>lines.push(`- ${c.text} (${Math.round((c.bel ?? c.score ?? 0)*100)}%)`));
      lines.push('');
    } else if (env.kind === 'sheet') {
      lines.push(`### Sheet ${env.data?.title ? '— ' + env.data.title : ''}`);
      lines.push('```json'); lines.push(JSON.stringify(env.data ?? {}, null, 2)); lines.push('```', '');
    } else if (env.kind === 'transport') {
      lines.push(`### Transport map`);
      const pairs = Object.entries(env?.data?.claimMap ?? {});
      pairs.forEach(([a,b]) => lines.push(`- ${a} → ${b}`));
      lines.push('');
    }
     else if (env.kind === 'theory_work') {
  const m = env.data?.meta ?? {};
  const lens = env.lens ?? 'summary';
  lines.push(`### Theory Work — ${m.title ?? m.id}`);
  lines.push(`_Type:_ **${m.theoryType ?? ''}**`);
  if (lens !== 'full' && m.summary) lines.push(m.summary, '');
  if (lens === 'full') {
    lines.push('```json'); lines.push(JSON.stringify(env.data ?? {}, null, 2)); lines.push('```', '');
  } else {
    lines.push('_(summary view)_', '');
  }
}
  });

  const md = lines.join('\n');
  if (as === 'pdf') {
    // Keep it honest; wire real PDF later (Phase E).
    return NextResponse.json({ error: 'pdf_not_implemented' }, { status: 501 });
  }

  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${page.title?.toLowerCase().replace(/\s+/g,'-').slice(0,40) || page.id}.md"`,
    }
  });
}
