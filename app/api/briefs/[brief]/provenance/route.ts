export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { resolveBriefByParam } from '@/lib/server/briefs';

export async function GET(_: NextRequest, { params }: { params: { brief: string } }) {
  const brief = await resolveBriefByParam(params.brief);
  if (!brief) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!brief.currentVersionId) return NextResponse.json({ coveragePct: null, sourceCount: null, primaryCount: null, lastVerify: null });

  const version = await prisma.briefVersion.findUnique({
    where: { id: brief.currentVersionId },
    select: { citations: true },
  });

  let total = 0, primary = 0;
  try {
    const cits = version?.citations as any[] | null;
    if (Array.isArray(cits)) {
      total = cits.length;
      primary = cits.filter(c => {
        const t = String(c?.type ?? '').toLowerCase();
        const note = String(c?.note ?? '').toLowerCase();
        // naive primary heuristic; adjust as your CSL schema grows
        return t.includes('dataset') || t.includes('report') || note.includes('primary');
      }).length;
    }
  } catch {}

  // Best-effort for now; upgrade later to compute last verify for linked claims
  const lastCit = await prisma.claimCitation.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });

  return NextResponse.json({
    coveragePct: total ? primary / total : null,
    sourceCount: total || null,
    primaryCount: primary || null,
    lastVerify: lastCit ? 'recent' : null
  });
}
