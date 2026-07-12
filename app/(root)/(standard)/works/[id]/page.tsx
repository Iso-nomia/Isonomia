//app/works/[id]/page.tsx
import { prisma } from '@/lib/prismaclient';
import WorkDetailClient from '@/components/work/WorkDetailClient';

export default async function Page({ params }: { params: { id: string } }) {
  const work = await prisma.theoryWork.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, theoryType: true, standardOutput: true, deliberationId: true,
      deliberation: { select: { hostType: true, hostId: true } },
    },
  });
  if (!work) throw new Error('Work not found');

  let backHref: string | undefined;
  if (work.deliberation?.hostType === 'article') {
    // Try key, then slug (name may differ in your Article model)
    const article = await prisma.article.findUnique({
              where: { id: work.deliberation.hostId },
              select: { slug: true },
            });
            if (article?.slug) backHref = `/article/${article.slug}`;
  }

  return (
    <WorkDetailClient
      id={work.id}
      deliberationId={work.deliberationId ?? ''}
      title={work.title}
      theoryType={work.theoryType as any}
      standardOutput={work.standardOutput ?? undefined}
      backHref={backHref}
      
    />
  );
}
