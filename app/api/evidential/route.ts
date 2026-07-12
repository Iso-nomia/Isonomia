export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

const Q = z.object({
  deliberationId: z.string().min(5),
  mode: z.enum(['min','prod','ds']).optional().default('min')
});

function chainScore(nums: number[], mode:'min'|'prod'|'ds') {
  if (!nums.length) return 0;
  if (mode === 'min')  return Math.min(...nums);
  if (mode === 'prod') return nums.reduce((a,b)=>a*b, 1);
  // simple DS placeholder: treat like product until BBAs are modeled
  return nums.reduce((a,b)=>a*b, 1);
}
function joinScore(nums: number[], mode:'min'|'prod'|'ds') {
  // accrued independent reasons → noisy max; start with max for simplicity
  return Math.max(0, ...nums);
}

export async function GET(req: NextRequest) {
  const parsed = Q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status:400 });

  const { deliberationId, mode } = parsed.data;

  // Pull arguments and their (optional) weights; default 1.0
  const args = await prisma.argument.findMany({
    where:{ deliberationId },
    select:{
      id:true, conclusionClaimId:true, text:true,
      premises:{ select:{ claimId:true }},
      // If you add a weight column later, select it here
    }
  });

  // Index: for each conclusion claim, the set of supporting arguments
  const byClaim = new Map<string, { argId:string; weight:number; chain:number; explanation:any }[]>();

  for (const a of args) {
    // toy chain score: all premise links assumed 1.0; extend to pull real per‑edge weights
    const premiseWeights = a.premises.map(()=>1);
    const chain = chainScore(premiseWeights, mode);
    const entry = { argId:a.id, weight:1, chain, explanation:{ premises:a.premises.map(p=>p.claimId), mode } };
    if (!byClaim.has(a.conclusionClaimId ?? '')) byClaim.set(a.conclusionClaimId ?? '', []);
    byClaim.get(a.conclusionClaimId ?? '')!.push(entry);
  }

  // Combine arguments per claim
  const claimScores: Record<string, number> = {};
  const claimWhy:    Record<string, any>    = {};

  for (const [claimId, rows] of byClaim.entries()) {
    const chainScores = rows.map(r => r.chain * r.weight);
    claimScores[claimId] = joinScore(chainScores, mode);
    claimWhy[claimId]    = rows;
  }

  return NextResponse.json({ ok:true, mode, claims: claimScores, explanations: claimWhy }, { headers:{ 'Cache-Control': 'no-store' }});
}
