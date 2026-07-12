export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { computeRSAForArgument, computeRSAForClaim } from '@/packages/analysis/rsa';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const targetType = url.searchParams.get('targetType') as 'argument'|'claim'|null;
  const targetId   = url.searchParams.get('targetId') || null;
  const targetsCsv = url.searchParams.get('targets'); // e.g. "argument:a1,argument:a2,claim:c9"

  try {
    if (targetsCsv) {
      const out: Record<string, any> = {};
      const elems = targetsCsv.split(',').map(s => s.trim()).filter(Boolean);
      // de-dup
      const uniq = Array.from(new Set(elems));
      for (const p of uniq) {
        const [tt, id] = p.split(':');
        if (!tt || !id) continue;
        if (tt === 'argument') out[`argument:${id}`] = await computeRSAForArgument(params.id, id);
        else if (tt === 'claim') out[`claim:${id}`] = await computeRSAForClaim(params.id, id);
      }
      return NextResponse.json({ ok:true, byTarget: out });
    }

    if (targetType && targetId) {
      const res = targetType === 'argument'
        ? await computeRSAForArgument(params.id, targetId)
        : await computeRSAForClaim(params.id, targetId);
      return NextResponse.json({ ok:true, ...res });
    }

    return NextResponse.json({ ok:false, error:'Provide targetType & targetId or targets CSV' }, { status: 400 });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'RSA_FAILED' }, { status: 500 });
  }
}
