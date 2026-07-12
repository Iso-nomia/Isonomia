// app/api/kb/pages/[id]/blocks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { Prisma, KbBlockType } from '@prisma/client';
import { z } from 'zod';
import { requireKbRole, fail } from '@/lib/kb/withSpaceAuth';
import { KbBlockType as KbBlockTypeAlias } from '@/lib/kb/types'; // Ensure KbBlockType is exported as an enum or object, not just a type
export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

async function loadPageSpace(id: string) {
  const p = await prisma.kbPage.findUnique({
    where: { id },
    select: { id: true, spaceId: true },
  });
  if (!p) throw Object.assign(new Error('not_found'), { status: 404 });
  return p;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const page = await loadPageSpace(params.id);
    await requireKbRole(req, { spaceId: page.spaceId, need: 'reader' });

    const blocks = await prisma.kbBlock.findMany({
      where: { pageId: page.id },
      orderBy: { ord: 'asc' },
      select: { id:true, pageId:true, ord:true, type:true, live:true, dataJson:true, pinnedJson:true, citations:true, createdAt:true, updatedAt:true },
    });

    return NextResponse.json({ ok: true, blocks }, NO_STORE);
  } catch (e) {
    return fail(e);
  }
}

const CreateZ = z.object({
  type: z.enum([
    "text",
    "image",
    "link",
    "claim",
    "claim_set",
    "argument",
    "sheet",
    "room_summary",
    "transport",
    "evidence_list",
    "cq_tracker",
    "theory_work",
    "plexus_tile"
  ]).default("text"),
  ord: z.number().int().min(0).optional(),
  dataJson: z.any().optional(), // defaulted per type
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const page = await loadPageSpace(params.id);
    await requireKbRole(req, { spaceId: page.spaceId, need: 'editor' });

    const body = CreateZ.parse(await req.json().catch(() => ({})));
    const nextOrd = body.ord ?? (await prisma.kbBlock.count({ where: { pageId: page.id } }));

    const defaultData =
      body.type === 'text'
        ? { text: '' }
        : body.type === 'image'
        ? { src: '', alt: '' }
        : {};

    const created = await prisma.kbBlock.create({
      data: {
        pageId: page.id,
        ord: nextOrd,
        type: body.type as KbBlockType,
        live: true,
        dataJson: body.dataJson ?? defaultData,
        pinnedJson: Prisma.JsonNull,
        citations: [],
        createdById: 'system', // or actual user id if you pipe it here
      },
      select: { id: true, ord: true, type: true, dataJson: true, live: true },
    });

    return NextResponse.json({ ok: true, block: created }, NO_STORE);
  } catch (e) {
    return fail(e);
  }
}
