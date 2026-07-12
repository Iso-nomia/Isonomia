export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export async function GET(_req: Request, { params }: { params:{ id:string } }) {
  const claimId = params.id;
  const claim = await prisma.claim.findUnique({
    where:{ id: claimId },
    select:{ deliberationId:true }
  });
  if (!claim?.deliberationId) return NextResponse.json({ error:'Not found' }, { status:404 });

  // Use your existing label table if present; else synthesize from counts
  const aifs = await fetch(new URL(`/api/deliberations/${claim.deliberationId}/arguments/aif`, _req.url), { cache:'no-store' }).then(r=>r.json());
  // Find rows where this claim is a conclusion; roll up a simple heuristic label & why
  const rows = (aifs.items ?? []).filter((r:any) => r?.aif?.conclusion?.id === claimId);
  const attacks = rows.reduce((a:any,r:any)=>({ REBUTS:a.REBUTS+r.aif.attacks.REBUTS, UNDERCUTS:a.UNDERCUTS+r.aif.attacks.UNDERCUTS, UNDERMINES:a.UNDERMINES+r.aif.attacks.UNDERMINES }), {REBUTS:0,UNDERCUTS:0,UNDERMINES:0});
  const supports = rows.flatMap((r:any)=>r.aif?.premises||[]).length;
  const cqReq = rows.reduce((s:number,r:any)=>s+(r.aif?.cq?.required||0),0);
  const cqOk  = rows.reduce((s:number,r:any)=>s+(r.aif?.cq?.satisfied||0),0);

  const label = (supports>0 && attacks.REBUTS===0 && attacks.UNDERCUTS===0) ? 'IN' :
                (attacks.REBUTS>0 || attacks.UNDERCUTS>0) ? 'UNDEC' : 'UNDEC';
  const why = `Supports:${supports}, Attacks(R/U/M):${attacks.REBUTS}/${attacks.UNDERCUTS}/${attacks.UNDERMINES}, CQs:${cqOk}/${cqReq}`;

  return NextResponse.json({ ok:true, label, why });
}
