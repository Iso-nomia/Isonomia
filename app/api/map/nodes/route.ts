export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const Kind = z.enum(['claim','reason','counter','evidence']);

const PostBody = z.object({
  argumentId: z.string().min(5),
  text: z.string().min(1).max(4000),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  kind: Kind,
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { argumentId, text, kind } = parsed.data;
  let { start, end } = parsed.data;
  if (end < start) [start, end] = [end, start];

  // Validate the argument exists (and fetch deliberationId if you need it later)
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { id: true, text: true },
  });
  if (!arg) return NextResponse.json({ error: 'Argument not found' }, { status: 404 });

  // Clamp offsets to the argument's text length best-effort
  const fullLen = (arg.text || '').length;
  const safeStart = Math.max(0, Math.min(start, fullLen));
  const safeEnd   = Math.max(safeStart, Math.min(end, fullLen));

  // Persist as an ArgumentAnnotation (no migration needed)
  const ann = await prisma.argumentAnnotation.create({
    data: {
      targetType: 'argument',
      targetId: argumentId,
      type: `map:${kind}`,            // 'map:claim' | 'map:reason' | ...
      offsetStart: safeStart,
      offsetEnd: safeEnd,
      text,                           // selection text
      source: 'map',                  // mark provenance
    },
    select: { id: true },
  });

  // (Optional) fire an event for any listening SWR hooks in the app (UI)
  // Not needed server-side — your client can re-fetch after success

  return NextResponse.json({ ok: true, id: ann.id });
}
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const argumentId = url.searchParams.get('argumentId') || '';
    const deliberationId = url.searchParams.get('deliberationId') || '';
    const kind = url.searchParams.get('kind') as z.infer<typeof Kind> | null;
    const kindsCsv = url.searchParams.get('kinds') || '';   // e.g., "claim,reason"
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '500', 10), 1), 500);
  
    // Collect argumentIds according to the filter shape
    let argumentIds: string[] = [];
  
    if (argumentId) {
      argumentIds = [argumentId];
    } else if (deliberationId) {
      const args = await prisma.argument.findMany({
        where: { deliberationId },
        select: { id: true },
        take: 10000,
      });
      argumentIds = args.map(a => a.id);
      // ✅ If deliberation is given but it has no arguments, return empty (don't drop the filter!)
      if (argumentIds.length === 0) {
        return NextResponse.json({ ok: true, nodes: [] });
      }
    }
  
    // Build 'type' filter from kind/kinds
    let typeFilter: string[] | null = null;
    if (kind) {
      typeFilter = [`map:${kind}`];
    } else if (kindsCsv) {
      const reqKinds = kindsCsv
        .split(',')
        .map(s => s.trim())
        .filter(Boolean) as Array<z.infer<typeof Kind>>;
      if (reqKinds.length) typeFilter = reqKinds.map(k => `map:${k}`);
    }
  
    const where: any = {
      targetType: 'argument',
      ...(argumentIds.length ? { targetId: { in: argumentIds } } : {}),
      ...(typeFilter
        ? { type: { in: typeFilter } }
        : { type: { startsWith: 'map:' } }),
      ...(q ? { text: { contains: q, mode: 'insensitive' as const } } : {}),
    };
  
    const rows = await prisma.argumentAnnotation.findMany({
      where,
      // SAFE order: use `id` to avoid Prisma errors on schemas without createdAt
      // if you know you have createdAt, you can swap this to: orderBy: { createdAt: 'desc' }
      orderBy: { id: 'desc' },
      select: {
        id: true,
        targetId: true,
        text: true,
        offsetStart: true,
        offsetEnd: true,
        type: true,
        // include createdAt only if present in your schema; otherwise omit it
        // createdAt: true,
      },
      take: limit,
    });
  
    const nodes = rows.map(r => ({
      id: r.id,
      argumentId: r.targetId,
      kind: r.type.replace(/^map:/, '') as 'claim'|'reason'|'counter'|'evidence',
      text: r.text,
      start: r.offsetStart,
      end: r.offsetEnd,
      // createdAt: r.createdAt?.toISOString?.() ?? null, // add back if selected
    }));
  
    return NextResponse.json({ ok: true, nodes });
  }

export async function DELETE(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.argumentAnnotation.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
