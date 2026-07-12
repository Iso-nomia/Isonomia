export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { computeAffinityClusters } from '@/lib/topology/affinityClusters';
import { z } from 'zod';

const Body = z.object({ k: z.number().int().min(2).max(12).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=> ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const res = await computeAffinityClusters(params.id, parsed.data.k ?? 4);
  return NextResponse.json({ ok: true, ...res });
}
