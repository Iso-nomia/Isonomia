// app/(root)/(standard)/discussions/explore/page.tsx
import { prisma } from '@/lib/prismaclient';
import ExploreFeed from './ui/ExploreFeed';
import { getUserFromCookies } from '@/lib/serverutils';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ExplorePage() {
      const user = await getUserFromCookies();
      if (!user) {
        redirect('/login');
        return null;
      }
    
      const userId = String(user.userId);
  // Initial load - hot discussions
  const items = await prisma.discussion.findMany({
    orderBy: [{ lastActiveAt: 'desc' }, { replyCount: 'desc' }],
    take: 21,
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      updatedAt: true,
            lastActiveAt: true, // ✅ Added this

      replyCount: true,
      viewCount: true,
      createdById: true,
    },
  });

  const hasMore = items.length > 20;
  const page = items.slice(0, 20);

  const initialItems = page.map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
        lastActiveAt: i.lastActiveAt.toISOString(), // ✅ Serialize it

    // lastActiveAt: i.lastActiveAt?.toISOString() ?? i.updatedAt.toISOString(),
  }));

  return (<div className='w-full absolute inset-0 '>
     <ExploreFeed currentUserId={userId} initialItems={initialItems} hasMore={hasMore} />
     </div>);
}