export const dynamic = "force-dynamic";

// app/api/dialogue/move-aif/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { assertCreateArgumentLegality } from 'packages/aif-core/src/guards';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=> ({}));
  const { type, illocution, replyToMoveId, argument } = body;

  // GROUNDS must carry an argument payload (RA content)
  if (type === 'GROUNDS') {
    try { assertCreateArgumentLegality(argument); }
    catch (e:any) { return NextResponse.json({ ok:false, error: e.message }, { status: 400 }); }
  }

  return prisma.$transaction(async (tx) => {
    let argId: string | undefined;

    if (type === 'GROUNDS') {
      const a = await tx.argument.create({
        data: {
          deliberationId: argument.deliberationId,
          authorId: argument.authorId,
          conclusionClaimId: argument.conclusionClaimId,
          schemeId: argument.schemeId ?? null,
          implicitWarrant: argument.implicitWarrant ?? null,
          text: argument.text ?? "",
        }
      });
      if (argument.premiseClaimIds?.length) {
        await tx.argumentPremise.createMany({
          data: argument.premiseClaimIds.map((cid: string) => ({
            argumentId: a.id, claimId: cid, isImplicit: false
          })),
          skipDuplicates: true,
        });
      }
      argId = a.id;
    }

    const signature = [
      type, (argId ? `arg:${argId}` : `claim:${argument?.conclusionClaimId ?? 'n/a'}`),
      replyToMoveId ?? 'root', (illocution ?? 'Argue'), Date.now()
    ].join(':');

    const move = await tx.dialogueMove.create({
      data: {
        deliberationId: argument?.deliberationId ?? body.deliberationId,
        authorId: argument?.authorId ?? body.authorId,
        type, illocution,
        replyToMoveId: replyToMoveId ?? null,
        argumentId: argId ?? null,
        // required columns often present in your schema:
        kind: type,
        actorId: argument?.authorId ?? body.authorId,
        targetType: argId ? 'argument' : 'claim',
        targetId: argId ?? argument?.conclusionClaimId ?? body.targetId,
        signature,
        payload: body.payload ?? null,
      } as any
    });

    try {
      (globalThis as any).meshBus?.emit?.('dialogue:moves:refresh', { deliberationId: move.deliberationId });
    } catch {}

    return NextResponse.json({ ok:true, moveId: move.id, argumentId: argId ?? null }, { status: 201, ...NO_STORE });
  });
}
