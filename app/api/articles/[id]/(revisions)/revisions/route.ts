export const dynamic = "force-dynamic";

import { prisma } from '@/lib/prismaclient'
import { NextResponse } from 'next/server'
import { getUserFromCookies } from '@/lib/serverutils'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies()
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const a = await prisma.article.findUnique({ where: { id: params.id } })
  if (!a || a.authorId !== user.userId.toString())
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const revs = await prisma.revision.findMany({
    where: { articleId: params.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  })
  return NextResponse.json(revs.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })))
}
