export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const Body = z.object({
  attackSubtype: z.enum([
    'SUPPORT_ATTACK','CONSEQUENCE_ATTACK','JUSTIFICATION_ATTACK',
    'UNDERMINE','REBUT','UNDERCUT','OVERCUT'
  ])
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status:400 });

  const edge = await prisma.argumentEdge.update({
    where: { id: params.id },
    data: { attackSubtype: parsed.data.attackSubtype }
  });
  return NextResponse.json({ ok:true, edge });
}
