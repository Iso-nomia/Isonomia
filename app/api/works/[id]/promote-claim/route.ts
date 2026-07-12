// app/api/works/[id]/promote-claim/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import { getUserFromCookies } from '@/lib/serverutils';
import crypto from 'crypto';
import { canEditWorkOrClaimOrphan } from '@/lib/permissions/canEditWork';

export const dynamic = 'force-dynamic';

const Body = z
  .object({
    text: z.string().min(3).max(4000),
    locatorStart: z.number().int().nonnegative(),
    locatorEnd: z.number().int().nonnegative(),
    excerptHash: z.string().min(8).max(128).optional(),
  })
  .refine((b) => b.locatorEnd > b.locatorStart, {
    message: "locatorEnd>locatorStart",
    path: ["locatorEnd"],
  });

export async function POST(req: NextRequest, { params }: { params: { id: string }}) {
  const user = await getUserFromCookies();
  if (!user?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workId = params.id;
  const body = await req.json();
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { text, locatorStart, locatorEnd, excerptHash } = parsed.data;

  // Fetch work to get deliberationId
  const work = await prisma.theoryWork.findUnique({ where: { id: workId }});
  if (!work) return NextResponse.json({ error: 'Work not found' }, { status: 404 });

  // Create claim in the same deliberation
  const claim = await prisma.claim.create({
    data: {
      text,
      createdById: String(user.userId),
      deliberationId: work.deliberationId,
      moid: crypto.randomUUID(), // you already enforce uniqueness here
    },
  });
  const hash = excerptHash ?? crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);

  // Link citation back to the Work location
  await prisma.claimCitation.create({
    data: {
      claimId: claim.id,
      uri: `/works/${workId}#loc=${locatorStart}-${locatorEnd}`,
      locatorStart,
      locatorEnd,
      excerptHash: hash,
    },
  });

  return NextResponse.json({ ok: true, claim });
}
