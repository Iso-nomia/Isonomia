export const dynamic = "force-dynamic";

// // app/api/commitments/state/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prismaclient';

// export async function GET(req: NextRequest) {
//   const u = req.nextUrl.searchParams;
//   const dialogueId = u.get('dialogueId') || '';
//   const ownerId    = u.get('ownerId')    || '';
//   if (!dialogueId || !ownerId) return NextResponse.json({ ok:false, error:'missing' }, { status:400 });

//   const cs = await prisma.ludicCommitmentState.findFirst({
//     where: { ownerId },
//     include: { elements: { include: { baseLocus: true } } },
//   });

//   const facts = cs?.elements.filter(e=>e.basePolarity==='pos').map(e=>e.label ?? '') ?? [];
//   const rules = cs?.elements.filter(e=>e.basePolarity==='neg').map(e=>e.label ?? '') ?? [];

//   // naïve re-derive (mirror interactCE v0)
//   const derived = (rules.includes('r1') && facts.includes('contract') && facts.includes('delivered'))
//     ? ['to.pay'] : [];

//   const contradictions = (derived.includes('to.pay') || facts.includes('to.pay')) && facts.includes('notPaid')
//     ? [{ a:'to.pay', b:'notPaid' }] : [];

//   return NextResponse.json({ ok:true, facts, rules, derived, contradictions });
// }
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listCS } from 'packages/ludics-engine/commitments';

const Q = z.object({
  dialogueId: z.string().min(5),
  ownerId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = Q.safeParse(q);
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { dialogueId, ownerId } = parsed.data;
  const data = await listCS(dialogueId, ownerId);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
