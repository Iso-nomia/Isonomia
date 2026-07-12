export const dynamic = "force-dynamic";

// app/api/propositions/[id]/promote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: NextRequest, { params }: { params:{ id:string }}) {
  const userId = await getCurrentUserId().catch(()=>null);
  if (!userId) return NextResponse.json({ error:'Unauthorized' }, { status:401 });

  const body = await req.json().catch(()=>({}));
  const deliberationId = String(body?.deliberationId || '');
  if (!deliberationId) return NextResponse.json({ error:'deliberationId required' }, { status:400 });

  const p = await prisma.proposition.findUnique({ where:{ id: params.id }});
  if (!p || p.deliberationId !== deliberationId) return NextResponse.json({ error:'Not found' }, { status:404 });
  if (p.promotedClaimId) return NextResponse.json({ ok:true, claimId: p.promotedClaimId }, NO_STORE);

  const text = String(body?.text || p.text || '').trim();
  if (!text) return NextResponse.json({ error:'text required' }, { status:400 });

  const result = await prisma.$transaction(async (tx) => {
const claim = await tx.claim.create({
  data: {
    deliberationId,
    text,
    createdById: String(userId),
    moid: [deliberationId, String(userId), Date.now()].join(":")
  },
  select: { id: true }
});

await tx.proposition.update({
  where: { id: p.id },
  data: { status: 'CLAIMED', promotedClaimId: claim.id, promotedAt: new Date() }
});

    // Copy unified Citations from proposition to claim
    const existingCitations = await tx.citation.findMany({
      where: { targetType: 'proposition', targetId: p.id }
    });
    
    if (existingCitations.length > 0) {
      await tx.citation.createMany({
        data: existingCitations.map(c => ({
          targetType: 'claim',
          targetId: claim.id,
          sourceId: c.sourceId,
          locator: c.locator,
          quote: c.quote,
          note: c.note,
          relevance: c.relevance,
          createdById: c.createdById
        }))
      });
    }

    // optional: copy legacy citations (deprecated)
    if (Array.isArray(body?.citations) && body.citations.length) {
      await tx.claimCitation.createMany({
        data: body.citations.map((uri: string) => ({ claimId: claim.id, uri, kind: 'secondary' }))
      }).catch(()=>void 0);
    }

    // optional: assert move for Ludics
    if (body?.assertMove !== false) {
      await tx.dialogueMove.create({
        data: {
          deliberationId, authorId: String(userId),
          type:'ASSERT', illocution:'Assert' as any, kind:'ASSERT',
          targetType:'claim', targetId: claim.id, signature: ['ASSERT','claim',claim.id,Date.now()].join(':')
        } as any
      }).catch(()=>void 0);
    }

    return claim.id;
  });

  // nudge listeners
  try { window?.dispatchEvent?.(new CustomEvent('claims:changed', { detail:{ deliberationId } })); } catch {}
  return NextResponse.json({ ok:true, claimId: result }, NO_STORE);
}
