// app/(root)/(standard)/discussions/page.tsx
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { redirect } from 'next/navigation';
import DiscussionsDashboard from './ui/DiscussionsDashboard';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 15;

export default async function DiscussionsPage() {
  const user = await getUserFromCookies();
  if (!user) redirect('/login');

  const userId = String(user.userId);

  const items = await prisma.discussion.findMany({
    where: { createdById: userId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
          lastActiveAt: true, // ✅ Added

      conversationId: true,
      replyCount: true,
      createdById: true,
    },
  });

  const hasMore = items.length > PAGE_SIZE;
  const page = items.slice(0, PAGE_SIZE);
  const initialItems = page.map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
      lastActiveAt: i.lastActiveAt.toISOString(), // ✅ Serialize

    conversationId: i.conversationId !== null ? Number(i.conversationId) : null,
  }));
  const last = page[page.length - 1];
  const initialNextCursor = hasMore
    ? { updatedAt: last.updatedAt.toISOString(), id: last.id }
    : null;

  return (
    <DiscussionsDashboard
      initialItems={initialItems}
      initialNextCursor={initialNextCursor}
      pageSize={PAGE_SIZE}
      userId={userId}
    />
  );
}