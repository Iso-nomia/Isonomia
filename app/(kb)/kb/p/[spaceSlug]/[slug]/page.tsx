// app/(kb)/kb/p/[spaceSlug]/[slug]/page.tsx
import { prisma } from '@/lib/prismaclient';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Page({ params }:{ params:{ spaceSlug:string; slug:string }}) {
  const space = await prisma.kbSpace.findUnique({ where: { slug: params.spaceSlug }, select: { id:true } });
  if (!space) return notFound();
  const page = await prisma.kbPage.findUnique({
    where: { spaceId_slug: { spaceId: space.id, slug: params.slug } },
    select: { id: true }
  });
  if (!page) return notFound();
  redirect(`/kb/pages/${page.id}`);
}
