// app/api/works/[id]/slots/promote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const Body = z.object({
  slotKey: z.string().min(3),  // e.g. "IH.function"
  text: z.string().min(3).max(4000).optional(),
});

type SlotKey =
  | 'DN.explanandum' | 'DN.nomological'
  | 'IH.structure'   | 'IH.function' | 'IH.objectivity'
  | 'TC.function'    | 'TC.explanation' | 'TC.applications'
  | 'OP.unrecognizability' | 'OP.alternatives';

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const work = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: { id: true, deliberationId: true, theoryType: true },
  });
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });
  const workId = work.id;

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const slotKey = parsed.data.slotKey as SlotKey;

  // Load text from the right record if not provided
  async function loadSlotText(): Promise<string | null> {
    const [kind, field] = slotKey.split('.') as [string, string];
    if (kind === 'DN') {
      const dn = await prisma.workDNStructure.findUnique({ where: { workId } });
      return (dn && (dn as any)[field]) ?? null;
    } else if (kind === 'IH') {
      const ih = await prisma.workIHTheses.findUnique({ where: { workId } });
      return (ih && (ih as any)[field]) ?? null;
    } else if (kind === 'TC') {
      const tc = await prisma.workTCTheses.findUnique({ where: { workId } });
      return (tc && (tc as any)[field]) ?? null;
    } else if (kind === 'OP') {
      const op = await prisma.workOPTheses.findUnique({ where: { workId } });
      return (op && (op as any)[field]) ?? null;
    }
    return null;
  }

  const text = (parsed.data.text ?? (await loadSlotText()) ?? '').trim();
  if (text.length < 3) return NextResponse.json({ error: 'Empty slot' }, { status: 400 });

  const claim = await prisma.claim.create({
    data: {
      text,
      createdById: String(user.userId),
      deliberationId: work.deliberationId,
      moid: crypto.randomUUID(),
    },
  });

  // Deep link back to this editor slot
  await prisma.claimCitation.create({
    data: {
      claimId: claim.id,
      uri: `/works/${work.id}#slot=${slotKey}`,
      locatorStart: 0,
      locatorEnd: Math.min(80, text.length),
      excerptHash: btoa(text).slice(0, 32),
    },
  });

  return NextResponse.json({ ok: true, claimId: claim.id });
}
