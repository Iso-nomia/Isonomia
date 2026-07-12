export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';

const Body = z.object({
  title: z.string().min(3),
  scope: z.string().optional(),
  ruleset: z.object({
    semantics: z.array(z.enum(['grounded','preferred','hybrid'])).default(['grounded']),
    backchannels: z.boolean().default(true)
  }).optional()
});

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { title, scope, ruleset } = Body.parse(await req.json());

  const sheet = await prisma.debateSheet.create({
    data: {
      title,
      scope,
      roles: ['Proponent','Opponent','Curator'],
      rulesetJson: ruleset ?? { semantics: ['grounded'], backchannels: true },
      createdById: String(userId)
    },
    select: { id: true, title: true }
  });

 return NextResponse.json({
  ok: true,
  sheet,
  links: { // optional sugar
    open: `/sheets/${sheet.id}`,
  }
});
}
