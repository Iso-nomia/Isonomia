export const dynamic = "force-dynamic";

// app/api/eristic/marks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null);
  if (!body?.deliberationId || !Array.isArray(body?.marks)) {
    return NextResponse.json({ ok:false, error:'bad_request' }, { status:400 });
  }
  const { deliberationId, marks } = body;
  for (const m of marks) {
    await prisma.eristicMark.create({
      data: {
        deliberationId,
        targetType: m.targetType ?? 'commitments',
        targetId: m.targetId ?? 'CS',
        tactic: m.tactic ?? 'CS_CONTRADICTION',
        detector: m.detector ?? 'commitments',
        strength: typeof m.strength === 'number' ? m.strength : 1,
      }
    });
  }
  return NextResponse.json({ ok:true });
}