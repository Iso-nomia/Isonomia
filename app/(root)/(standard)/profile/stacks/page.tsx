import { prisma } from '@/lib/prismaclient';
import { getUserFromCookies } from '@/lib/serverutils';
import { redirect } from 'next/navigation';
import StacksDashboard from './ui/StacksDashboard';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 15;

export default async function StacksPage() {
  const user = await getUserFromCookies();
  if (!user || user.userId === null) redirect('/login');

  const ownerId = BigInt(user.userId);

  const items = await prisma.stack.findMany({
    where: { owner_id: ownerId },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      slug: true,
      is_public: true,
      created_at: true,
      description: true,
    },
  });

  const page = items.slice(0, PAGE_SIZE);
  const initialItems = page.map(s => ({
    id: s.id,
    name: s.name,
    slug: s.slug ?? '',
    is_public: s.is_public,
    created_at: s.created_at.toISOString(),
    description: s.description ?? null,
  }));

  return <StacksDashboard initialItems={initialItems} />;
}
