export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import { PaginationQuery, makePage } from '@/lib/server/pagination';
import { since as startTimer, addServerTiming } from '@/lib/server/timing';
import { ensureArgumentSupport } from '@/lib/arguments/ensure-support';

const Query = PaginationQuery.extend({
  claimId: z.string().optional(),
  clusterId: z.string().optional(), // NEW
});



// ---------- Zod schemas ----------
const CreateSchema = z.object({
  text: z.string().min(1).max(10_000),
  sources: z.array(z.string().url()).optional().default([]),
  confidence: z.number().min(0).max(1).optional(),
  isImplicit: z.boolean().optional(),
  quantifier: z.enum(['SOME','MANY','MOST','ALL']).optional(),
  modality: z.enum(['COULD','LIKELY','NECESSARY']).optional(),
  mediaType: z.enum(['text','image','video','audio']).optional().default('text'),
  mediaUrl: z.string().url().optional(),
});

const ArgumentResponseSchema = z.object({
  id: z.string(),
  deliberationId: z.string(),
  authorId: z.string(),
  text: z.string(),
  sources: z.any().optional(),   // you might refine this to array of URLs
  confidence: z.number().nullable(),
  isImplicit: z.boolean(),
  quantifier: z.enum(['SOME','MANY','MOST','ALL']).nullable(),
  modality: z.enum(['COULD','LIKELY','NECESSARY']).nullable(),
  mediaType: z.enum(['text','image','video','audio']),
  mediaUrl: z.string().url().nullable(),
  createdAt: z.string(), // ISO datetime
  edgesOut: z.array(z.object({
    fromArgumentId: z.string(),
    toArgumentId: z.string(),
    type: z.enum(['rebut','undercut']),
    targetScope: z.string().optional(),
  })),
  claimId: z.string().nullable(),
  approvedByUser: z.boolean(),
});


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = startTimer();
  const userId = await getCurrentUserId();
  const url = new URL(req.url);

  const parsed = Query.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    claimId: url.searchParams.get('claimId') ?? undefined,
    clusterId: url.searchParams.get('clusterId') ?? undefined, // 👈 add this

  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cursor, limit, sort, claimId, clusterId } = parsed.data;
  const [field, dir] = (sort ?? 'createdAt:desc').split(':') as ['createdAt','asc'|'desc'];

  // const [field, dir] = sort.split(':') as ['createdAt','asc'|'desc'];


  let argIdFilter: string[] | null = null;
  if (clusterId) {
    const rows = await prisma.argumentCluster.findMany({
      where: { clusterId },
      select: { argumentId: true },
    });
    argIdFilter = rows.map(r => r.argumentId);
    if (argIdFilter.length === 0) {
      const res = NextResponse.json(makePage([], limit), { headers: { 'Cache-Control': 'no-store' } });
      addServerTiming(res, [{ name: 'total', durMs: t() }]);
      return res;
    }
  }

  const rows = await prisma.argument.findMany({
    where: {
      deliberationId: params.id,
      ...(claimId ? { claimId } : {}),
      ...(argIdFilter ? { id: { in: argIdFilter } } : {}),
    },
        orderBy: [{ [field]: dir }, { id: dir }],          // stable order for cursoring
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      outgoingEdges: {
        where: { type: { in: ['rebut', 'undercut'] } },
        select: { fromArgumentId: true, toArgumentId: true, type: true, targetScope: true },
      },
      claim: { select: { id: true } },
      approvals: userId
        ? { where: { userId: String(userId) }, select: { userId: true } }
        : false,
    },
  });

  const items = rows.slice(0, limit).map(a => ({
    id: a.id,
    deliberationId: a.deliberationId,
    authorId: a.authorId,
    text: a.text,
    sources: a.sources,
    confidence: a.confidence,
    isImplicit: a.isImplicit,
    quantifier: a.quantifier,
    modality: a.modality,
    mediaType: a.mediaType,
    mediaUrl: a.mediaUrl,
    createdAt: a.createdAt.toISOString(),
    edgesOut: a.outgoingEdges ?? [],
    claimId: a.claim?.id ?? null,
    approvedByUser: !!(a.approvals && a.approvals.length),
  }));

  const page = makePage(items, limit);
  const res = NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
  addServerTiming(res, [{ name: 'total', durMs: t() }]);
  return res;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deliberationId = params.id;
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // If mediaType != 'text', a mediaUrl is strongly recommended
    if (d.mediaType !== 'text' && !d.mediaUrl) {
      return NextResponse.json({ error: 'mediaUrl required for non-text mediaType' }, { status: 400 });
    }

    const created = await prisma.argument.create({
      data: {
        deliberationId,
        authorId: String(userId),
        text: d.text,
        sources: d.sources ?? [],
        confidence: d.confidence ?? null,
        isImplicit: d.isImplicit ?? false,
        quantifier: d.quantifier ?? null,
        modality: d.modality ?? null,
        mediaType: d.mediaType ?? 'text',
        mediaUrl: d.mediaUrl ?? null,
      },
    });
    
    // NEW: Ensure ArgumentSupport record exists if argument has a claim
    // Note: This endpoint creates arguments without claims, so we only create support if claimId exists
    if (created.claimId) {
      await ensureArgumentSupport({
        argumentId: created.id,
        claimId: created.claimId,
        deliberationId,
        base: d.confidence ?? 0.7,
      });
    }

    return NextResponse.json({ ok: true, argument: created });
  } catch (e: any) {
    console.error('[arguments] failed', e);
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
