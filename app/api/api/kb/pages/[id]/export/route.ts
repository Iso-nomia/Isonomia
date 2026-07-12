// app/api/kb/pages/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';

export const dynamic = 'force-dynamic'; export const revalidate = 0;

function mdEscape(s: string) { return s.replace(/[*_`]/g, m => '\\'+m); }

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireKbRole(req, { pageId: params.id, need: 'reader' });

    const url = new URL(req.url);
    const as = (url.searchParams.get('as') ?? 'md').toLowerCase();
    const at = url.searchParams.get('at'); // 'latest' | ISO (Phase‑B can support snapshot ids)

    const page = await prisma.kbPage.findUnique({
      where: { id: params.id },
      select: { id:true, title:true, summary:true, tags:true, spaceId:true, frontmatter:true, blocks: {
        orderBy: [{ ord: 'asc' }, { createdAt: 'asc' }],
        select: { id:true, type:true, ord:true, live:true, dataJson:true, pinnedJson:true }
      }}
    });
    if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Manifest (pinned later; for now we only record what's live vs pinned)
    const manifest = {
      page: { id: page.id, title: page.title, at: at ?? 'latest' },
      blocks: page.blocks.map(b => ({
        id: b.id, type: b.type, live: b.live, pinned: !b.live && !!b.pinnedJson
      }))
    };

    // Very light serializer (Phase‑A): Structured blocks → short sections with deep links.
    const lines: string[] = [];
    lines.push('---');
    lines.push(`title: ${mdEscape(page.title)}`);
    if (page.summary) lines.push(`summary: ${mdEscape(page.summary)}`);
    if (page.tags?.length) lines.push(`tags: [${page.tags.map(mdEscape).join(', ')}]`);
    if (page.frontmatter) lines.push(`frontmatter: ${JSON.stringify(page.frontmatter)}`);
    lines.push('---\n');

    lines.push(`# ${page.title}\n`);
    if (page.summary) lines.push(`${page.summary}\n`);

    for (const b of page.blocks) {
      const data: any = b.live ? b.dataJson : (b.pinnedJson ?? b.dataJson);

      if (b.type === 'text') {
        const md = (data?.md as string) ?? '';
        lines.push(md.trim()); lines.push('');
        continue;
      }
      if (b.type === 'claim') {
        lines.push(`> **Claim** \`${data?.id ?? '—'}\``);
        lines.push(`> lens: ${data?.lens ?? 'belpl'} · room: ${data?.roomId ?? 'auto'}`);
        lines.push('');
        continue;
      }
      if (b.type === 'argument') {
        lines.push(`> **Argument** \`${data?.id ?? '—'}\` (diagram)`);
        lines.push('');
        continue;
      }
      if (b.type === 'room_summary') {
        lines.push(`> **Room summary** \`${data?.id ?? '—'}\` limit=${data?.limit ?? 5}`);
        lines.push('');
        continue;
      }
      if (b.type === 'sheet') {
        lines.push(`> **Sheet** \`${data?.id ?? '—'}\``);
        lines.push('');
        continue;
      }
      if (b.type === 'transport') {
        lines.push(`> **Transport** ${data?.fromId ?? '—'} → ${data?.toId ?? '—'}`);
        lines.push('');
        continue;
      }
      // Fallback
      lines.push(`> **${b.type}** (unsupported in md export)`); lines.push('');
    }

    // Embed manifest for reproducibility
    lines.push('```json x-kb-manifest');
    lines.push(JSON.stringify(manifest, null, 2));
    lines.push('```');

    if (as === 'md') {
      const md = lines.join('\n');
      return new NextResponse(md, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Disposition': `attachment; filename="${page.title.replace(/\s+/g,'_')}.md"`
        }
      });
    }

    if (as === 'pdf') {
      // Stub: return print‑ready HTML (Phase‑B: render via headless/puppeteer or a PDF service)
      const html = `<!doctype html><meta charset="utf-8">
        <title>${page.title}</title>
        <style>body{font:14px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width:720px; margin:40px auto; color:#0f172a}
        h1{font-size:28px;margin:0 0 12px} blockquote{border-left:3px solid #cbd5e1; margin:12px 0; padding:6px 10px; color:#334155}
        pre{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;overflow:auto}</style>
        <h1>${page.title}</h1>
        ${lines.filter(l=>!l.startsWith('```')).map(l => l.startsWith('> ') ? `<blockquote>${l.slice(2)}</blockquote>` : `<p>${l.replace(/^#\s+.*$/,'')}</p>`).join('\n')}
      `;
      return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    return NextResponse.json({ error: 'unsupported_format' }, { status: 400 });
  } catch (e) { return fail(e); }
}
