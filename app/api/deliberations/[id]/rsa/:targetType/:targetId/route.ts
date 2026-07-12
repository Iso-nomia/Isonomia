export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/rsa/:targetType/:targetId/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: { id:string, targetType:'argument'|'claim', targetId:string } }) {
  // 1) Relevance: cosine sim between target text and concatenated grounds text
  // 2) Sufficiency: (# grounds weighted by CQ satisfied + source quality) / desired threshold
  // 3) Acceptability: mix of source quality (publisher/domain), warrant fit signal, fallacy penalty
  // Stub: return neutral until you wire models
  return NextResponse.json({
    ok:true,
    R: 0.72,  // replace with real calc
    S: 0.55,
    A: 0.68,
    notes: {
      R: ['High lexical overlap with grounds g1, g3'],
      S: ['Only 1 independent ground; 3 CQs open'],
      A: ['Two sources are preprints; warrant matches scheme "Expert Opinion"'],
    }
  });
}
