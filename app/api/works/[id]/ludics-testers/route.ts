// app/api/works/[id]/ludics-testers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string }}) {
    const w = await prisma.theoryWork.findUnique({
             where: { id: params.id },
             include: {
               // keep whatever 1:1s you actually use here:
               ihProject: true, // if you added WorkIhProject
               tcProject: true,
               practicalJustification: true,
               hermeneuticProject: true,
               pascalModel: true,
               dnStructure: true,
               ihTheses: true,
               tcTheses: true,
               opTheses: true,
               dnProject: true,
               opProject: true,
             },
           });
  if (!w) return NextResponse.json({ ok:false, testers: [] });

  const testers: any[] = [];

  // If IH.objectivity exists → suggest a timeout/draw probe at a chosen locus (UI will choose)
  if (w.ihProject?.objectiveReasons) {
    testers.push({ kind: 'timeout-draw', atPath: '' , explain: 'Probe objectivity: draw unless justified' });
  }

  // If we have alternatives, suggest herd-to σ·i prompts (UI picks parentPath/child)
  if ((w as any).alternativesTo?.length) {
    testers.push({ kind: 'herd-to', parentPath: '', child: '1', explain: 'Focus comparison branch (σ·1 vs σ·2)' });
  }

  return NextResponse.json({ ok:true, testers });
}
