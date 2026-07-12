export const dynamic = "force-dynamic";

// app/api/ludics/delocate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cloneDesignWithShift } from '@/packages/ludics-engine/delocate';

const Body = z.object({
  designId: z.string().min(10),
  tag: z.string().min(1).max(16).regex(/^[A-Za-z0-9_-]+$/),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const out = await cloneDesignWithShift(parsed.data.designId, parsed.data.tag);
    return NextResponse.json({ ok: true, design: out }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 400 });
  }
}
