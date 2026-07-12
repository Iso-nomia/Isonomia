export const dynamic = "force-dynamic";

// app/api/attacks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserId } from '@/lib/serverutils';
import { resolveClaimContext } from '@/lib/server/resolveRoom';
import { createClaimAttack } from '@/lib/argumentation/createClaimAttack';

const Body = z.object({
  fromClaimId: z.string().min(1),
  toClaimId: z.string().min(1),            // target claim
  kind: z.enum(['undercut', 'rebut']),
  scope: z.enum(['premise', 'conclusion']).optional(), // for rebut
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { fromClaimId, toClaimId, kind, scope } = parsed.data;

  const { deliberationId } = await resolveClaimContext(toClaimId);
  if (!deliberationId) {
    return NextResponse.json({ error: 'Unable to resolve deliberation for claim' }, { status: 404 });
  }

  const edge = await createClaimAttack({
    fromClaimId,
    toClaimId,
    deliberationId,
    suggestion: kind === 'undercut' ? { type: 'undercut' } : { type: 'rebut', scope: scope! },
  });

  return NextResponse.json({ ok: true, edge });
}
