//app/(kb)/kb/dashboard/ui/KbDashboard.tsx
import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { redirect } from 'next/navigation';
// import KbDashboard from './ui/KbDashboard';
import KbDashboard from './ui/KbDashboardPremium';
import { KBGridBG } from '@/components/ui/KBGridBG';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 15;

export default async function KbDashboardPage() {
  const user = await getUserFromCookies();
  if (!user) redirect('/login');

  const userId = String(user.userId ?? user.userId);
  const items = await prisma.kbPage.findMany({
    where: { createdById: userId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    select: { id:true, title:true, updatedAt:true, createdAt:true, spaceId:true, visibility:true },
  });

  const hasMore = items.length > PAGE_SIZE;
  const page = items.slice(0, PAGE_SIZE);
  const initialItems = page.map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));
  const initialNextCursor = hasMore ? {
    updatedAt: page[page.length-1].updatedAt.toISOString(),
    id: page[page.length-1].id
  } : null;

  return <div className='relative w-full h-full'>
    {/* <KBGridBG /> */}
    <KbDashboard initialItems={initialItems} initialNextCursor={initialNextCursor} pageSize={PAGE_SIZE} />
    </div>;
}
