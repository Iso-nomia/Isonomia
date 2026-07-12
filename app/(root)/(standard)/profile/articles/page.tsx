import { prisma } from '@/lib/prismaclient'
import { getUserFromCookies } from '@/lib/serverutils'
import { notFound, redirect } from 'next/navigation'
import ArticlesDashboard from './ui/ArticlesDashboard'

export const dynamic = 'force-dynamic'; // always fresh for dashboards

const PAGE_SIZE = 15;


export default async function ArticlesPage() {
  const user = await getUserFromCookies()
  if (!user) redirect('/login') // or notFound()

  const items = await prisma.article.findMany({
    where: { authorId: user.userId!.toString(), deletedAt: null },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,                // grab one extra to compute nextCursor
    select: {
      id: true, title: true, slug: true, status: true,
      createdAt: true, updatedAt: true, heroImageKey: true, template: true,
    },
  });



  const hasMore = items.length > PAGE_SIZE;
  const page = items.slice(0, PAGE_SIZE);
  const next = hasMore ? page[page.length - 1] : null;

  const initialItems = page.map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  const initialNextCursor = next
    ? { updatedAt: next.updatedAt.toISOString(), id: next.id }
    : null;

  return (
    <ArticlesDashboard
      initialItems={initialItems}
      initialNextCursor={initialNextCursor}
      pageSize={PAGE_SIZE}
    />
  );
}

