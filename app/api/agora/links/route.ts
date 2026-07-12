import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const Body = z.object({
  kind: z.enum(['xref','stack_ref','imports']),
  fromId: z.string().min(6),
  toId: z.string().min(6),
  meta: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { kind, fromId, toId, meta } = parsed.data;

  try {
    if (kind === 'xref') {
      // Use your XRef model (case-sensitive: adjust to your schema)
      await prisma.xRef.create({
        data: { fromType: 'deliberation', fromId, toType: 'deliberation', toId, relation: 'xref', metaJson: meta ?? {} }
      });
    } else if (kind === 'stack_ref') {
      await prisma.stackReference.create({
        data: { fromDeliberationId: fromId, toDeliberationId: toId, relation: 'attached' }
      });
    } else if (kind === 'imports') {
      await prisma.argumentImport.create({
        data: { fromDeliberationId: fromId, toDeliberationId: toId, kind: 'import', fingerprint: `${fromId}:${toId}:import` }
      });
    }

    // broadcast to live views
    try {
      // this is safe even if you don’t have a server bus; Plexus listens for this DOM event too
      (globalThis as any).dispatchEvent?.(new CustomEvent('xref:changed'));
    } catch {}

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'db error' }, { status: 500 });
  }
}
