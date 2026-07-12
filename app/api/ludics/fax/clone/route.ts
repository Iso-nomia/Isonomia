export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { faxClone } from '@/packages/ludics-engine/faxClone';

const Body = z.object({
  designId: z.string().min(1),
  fromPath: z.string().min(1),
  toPath: z.string().min(1),
  rewriteMeta: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(()=>({})));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const res = await faxClone(parsed.data).catch((e)=>({ ok:false, error: String(e?.message ?? e) }));
  if ((res as any).ok === false) return NextResponse.json(res, { status: 400 });
  return NextResponse.json(res);
}
