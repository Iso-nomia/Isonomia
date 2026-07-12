export const dynamic = "force-dynamic";

import { prisma } from '@/lib/prismaclient'
import { NextResponse } from 'next/server'
import { getUserFromCookies } from '@/lib/serverutils'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies()
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  const a = await prisma.article.findUnique({ where: { id: params.id } })
  if (!a || a.authorId !== user.userId.toString())
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.article.update({ where: { id: params.id }, data: { deletedAt: null } })
  return NextResponse.json({ ok: true })
}
export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const user = await getUserFromCookies()
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  
    const { revisionId } = await req.json().catch(() => ({}))
    if (!revisionId) return NextResponse.json({ error: 'Missing revisionId' }, { status: 400 })
  
    const a = await prisma.article.findUnique({ where: { id: params.id } })
    if (!a || a.authorId !== user.userId.toString()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  
    const rev = await prisma.revision.findUnique({ where: { id: revisionId } })
    if (!rev || rev.articleId !== a.id) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })
  
    // write the revision into the article and snapshot current as a new revision
    await prisma.$transaction([
      prisma.revision.create({ data: { articleId: a.id, astJson: a.astJson as any } }),
      prisma.article.update({ where: { id: a.id }, data: { astJson: rev.astJson as any } }),
    ])
  
    return NextResponse.json({ ok: true })
  }
  