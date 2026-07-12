export const dynamic = "force-dynamic";

// app/api/articles/preview/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prismaclient'
import { getUserFromCookies } from '@/lib/serverutils'
import { plainTextFromAst, computeExcerpt, readingTime } from '@/lib/article/text'

// Minimal HTML renderer fallback — replace with your real article renderer.
function renderHtmlFromAst(ast: any): string {
  // TODO: hook up your real renderer. This is a harmless fallback.
  const text = plainTextFromAst(ast)
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
  return `<div class="prose">${escaped}</div>`
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id   = url.searchParams.get('id')
  const slug = url.searchParams.get('slug')

  if (!id && !slug) {
    return NextResponse.json({ error: 'Missing id or slug' }, { status: 400 })
  }

  const user = await getUserFromCookies().catch(() => null)

  const article = await prisma.article.findUnique({
    where: slug ? { slug } : { id: id! },
  })

  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAuthor = user?.userId && article.authorId === user.userId.toString()
  const isPublished = article.status === 'PUBLISHED'
  if (!isPublished && !isAuthor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const html = renderHtmlFromAst(article.astJson)
  const text = plainTextFromAst(article.astJson)
  const excerpt = article.excerpt ?? computeExcerpt(text)
  const minutes = article.readingTime ?? readingTime(text)

  return NextResponse.json({
    title: article.title ?? 'Untitled',
    slug : article.slug,
    heroImageKey: article.heroImageKey,
    html,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    readingTime: minutes,
    excerpt,
  })
}
