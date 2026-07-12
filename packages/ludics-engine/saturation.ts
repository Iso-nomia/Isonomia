import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { copyAtLocus } from '@/packages/ludics-engine/copy';

const Body = z.object({
  dialogueId: z.string().min(5),
  basePath: z.string().min(1),     // e.g. "0" or "0.2"
  count: z.number().int().min(1).max(8).default(2),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });

  const { dialogueId, basePath, count } = parsed.data;
  const out = await copyAtLocus(dialogueId, basePath, count);
  return NextResponse.json({ ok:true, ...out }, { headers: { 'Cache-Control': 'no-store' } });
}
