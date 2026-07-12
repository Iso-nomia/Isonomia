export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { preflightComposition } from '@/packages/ludics-engine/compose';

const Body = z.object({
  dialogueId: z.string().min(5),
  posDesignId: z.string().min(10),
  negDesignId: z.string().min(10),
  mode: z.enum(['assoc','partial','spiritual']),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });

  try {
    const out = await preflightComposition(parsed.data);
    return NextResponse.json({ ...out, ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
