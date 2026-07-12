export const dynamic = "force-dynamic";

// app/api/monological/defaults/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const Body = z.object({
  argumentId: z.string().min(5),
  role: z.enum(['premise','claim']),
  antecedent: z.string().min(1).max(400),      // α
  justification: z.string().min(1).max(400),  // β
  consequent: z.string().min(1).max(400),     // γ
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { argumentId, role, antecedent, justification, consequent } = parsed.data;

  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: { deliberationId: true }
  });

  const dr = await prisma.defaultRule.create({
    data: {
      deliberationId: arg?.deliberationId ?? '',
      argumentId,
      role,
      antecedent: antecedent.trim(),
      justification: justification.trim(),
      consequent: consequent.trim(),
      createdBy: String(userId),
    }
  });

  return NextResponse.json({ ok: true, defaultRule: dr });
}

export async function GET(req: NextRequest) {
  const argumentId = req.nextUrl.searchParams.get('argumentId');
  if (!argumentId) return NextResponse.json({ error: 'argumentId required' }, { status: 400 });

  const list = await prisma.defaultRule.findMany({
    where: { argumentId },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json({ ok: true, defaults: list });
}
