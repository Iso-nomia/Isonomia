// app/briefs/[slug]/page.tsx (server component)
import { prisma } from '@/lib/prismaclient';
import { notFound } from 'next/navigation';
import BriefViewer from '@/components/briefs/BriefViewer';
import BriefDiffViewer from '@/components/briefs/BriefDiffViewer';

import ProvenanceRibbon from '@/components/briefs/ProvenanceRibbon';

export default async function BriefPublicPage({ params }:{ params: { slug: string } }) {
    const brief = await prisma.brief.findUnique({
        where: { slug: params.slug },
        include: {
            currentVersion: true,
            versions: { include: { links: true } }, // ✅ ensure versions exist
          },
      });
      if (!brief || !brief.currentVersion) return null;



  // server provenance compute (best-effort)
  let coveragePct: number | null = null, sourceCount: number | null = null, primaryCount: number | null = null, lastVerify: string | null = null;
  try {
    const cits = (brief.currentVersion as any).citations as any[] | null;
    if (Array.isArray(cits)) {
      sourceCount = cits.length || null;
      primaryCount = cits.filter(c => {
        const t = String(c?.type ?? '').toLowerCase();
        const note = String(c?.note ?? '').toLowerCase();
        return t.includes('dataset') || t.includes('report') || note.includes('primary');
      }).length || null;
      if (sourceCount && primaryCount != null) coveragePct = primaryCount / sourceCount;
    }
  } catch {}


  // ✅ Pass plain JSON into the client component
  return(
    <div>
    <BriefViewer brief={JSON.parse(JSON.stringify(brief))} />
    <ProvenanceRibbon
        coveragePct={coveragePct}
        sourceCount={sourceCount}
        primaryCount={primaryCount}
        lastVerify={lastVerify}
      />
  <BriefDiffViewer current={brief.currentVersion as any} versions={brief.versions as any} />
  </div>
  );

}
