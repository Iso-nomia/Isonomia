export const dynamic = "force-dynamic";



// app/api/articles/[id]/publish/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prismaclient'
import { kebabCase } from 'lodash'
import { createFeedPost } from '@/lib/actions/feedpost.actions'
import { getUserFromCookies } from '@/lib/serverutils'
import { feed_post_type } from '@prisma/client'
import { plainTextFromAst, computeExcerpt, readingTime } from '@/lib/article/text'
// export async function POST(req: Request, { params }: { params: { id: string } }) {
//   const user = await getUserFromCookies()
//   if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

//   const article = await prisma.article.findUnique({ where: { id: params.id } })
//   if (!article || article.authorId !== user.userId.toString()) {
//     return NextResponse.json({ error: 'Not found' }, { status: 404 })
//   }

//   // Body is optional; if present we’ll use it to upsert final fields.
//   let body: any = {}
//   try { body = await req.json() } catch { /* ignore */ }

//   // Unique slug from CURRENT title (fallback to “untitled”)
//   const base = kebabCase(article.title || 'untitled') || 'untitled'
//   let slug = base
//   for (let i = 1; await prisma.article.findUnique({ where: { slug } }); i++) {
//     slug = `${base}-${i}`
//   }

//   // Write publish state + any final changes
//   const updated = await prisma.article.update({
//     where: { id: params.id },
//     data : {
//       slug,
//       status: 'PUBLISHED',
//       ...(body.astJson && { astJson: body.astJson }),
//       ...(body.template && { template: body.template }),
//       ...(body.heroImageKey && { heroImageKey: body.heroImageKey }),
//     },
//   })

//   // Snapshot a revision at publish time
//   await prisma.revision.create({
//     data: { articleId: updated.id, astJson: (body.astJson ?? updated.astJson) as any },
//   })

//   // Try to create a feed post, but never fail the publish if feed fails.
//   let feedPostId: string | null = null
//   try {
//     const post = await createFeedPost({
//       caption: updated.title,
//       content: `/article/${updated.slug}`,
//       imageUrl: updated.heroImageKey ?? undefined,
//       type: feed_post_type.ARTICLE,
//       // extra payload if your feed consumers use it:
//       template: updated.template,
//       heroImageKey: updated.heroImageKey,
//       title: updated.title,
//       slug: updated.slug,
//       id: updated.id,
//       status: updated.status,
//       createdAt: updated.createdAt,
//       authorId: user.userId.toString(),
//       astJson: updated.astJson,
//       analytics: updated.analytics,
//       updatedAt: updated.updatedAt,
//     })
//     // normalize ID if needed
//     feedPostId = (post as any)?.postId?.toString?.() ?? null
//   } catch (e) {
//     console.error('createFeedPost failed:', e)
//     // swallow; publish is already successful
//   }

//   return NextResponse.json(
//     { slug: updated.slug, feedPostId },
//     { status: 201 },
//   )
// }
// ── helpers ──────────────────────────────────────────────────────────────────
function textContent(n: any): string {
  if (!n) return ''
  if (n.type === 'text' && n.text) return n.text
  if (Array.isArray(n.content)) return n.content.map(textContent).join('')
  return ''
}
function titleFromAst(ast: any): string | null {
  if (!ast) return null
  const stack = [ast]
  while (stack.length) {
    const node: any = stack.shift()
    if (node?.type === 'heading' && (!node.attrs?.level || node.attrs.level <= 2)) {
      const t = textContent(node).trim()
      if (t) return t
    }
    if (node?.type === 'paragraph') {
      const t = textContent(node).trim()
      if (t) return t
    }
    if (Array.isArray(node?.content)) stack.unshift(...node.content)
  }
  return null
}
// ─────────────────────────────────────────────────────────────────────────────



export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies()
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const article = await prisma.article.findUnique({ where: { id: params.id } })
  if (!article || article.authorId !== user.userId.toString()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const safeJson = async () => { try { return await _req.json() } catch { return {} } }
  const body = await safeJson()

    // choose the AST we’ll publish
    const ast = body.astJson ?? article.astJson

      // compute derived fields
  const plain   = plainTextFromAst(ast)
  const excerpt = computeExcerpt(plain)
  const minutes = readingTime(plain)

   // 🔑 resolve title
   const fromBody = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : null
   const current  = article.title && article.title !== 'Untitled' ? article.title : null
   const derived  = fromBody ?? current ?? titleFromAst(ast) ?? 'Untitled'
   const title    = derived
 


  // 🔑 resolve slug — rewrite if kebab-invalid, random-ish, or “untitled”
  const looksRandom = /^[A-Za-z0-9_-]{12,}$/.test(article.slug)
  const isKebab     = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)
  const isUntitled  = /^untitled(?:-\d+)?$/.test(article.slug)

  let slug = article.slug
  if (!isKebab || looksRandom || isUntitled) {
    const base = kebabCase(title) || 'untitled'
    slug = base
    for (let i = 1; await prisma.article.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`
    }
  }
  

  // const plain = body.astJson ? plainTextFromAst(body.astJson) : plainTextFromAst(article.astJson)
  // const excerpt = computeExcerpt(plain)
  // const minutes = readingTime(plain)
  
  const updated = await prisma.article.update({
    where: { id: params.id },
    data : {
      ...(title !== article.title ? { title } : {}),
      slug,
      status: 'PUBLISHED',
      publishedAt: article.publishedAt ?? new Date(),
      excerpt,
      readingTime: minutes,
      ...(body.astJson && { astJson: body.astJson }),
      ...(body.template && { template: body.template }),
      ...(body.heroImageKey && { heroImageKey: body.heroImageKey }),
    },
  })

    // store a revision
    await prisma.revision.create({ data: { articleId: updated.id, astJson: (body.astJson ?? updated.astJson) as any } })


  

  await prisma.revision.create({
    data: { articleId: updated.id, astJson: (body.astJson ?? updated.astJson) as any },
  })
// …after you update the Article and create a Revision
const payload = {
  kind: 'article' as const,
  articleId: updated.id,
  slug: updated.slug,
  
  title: updated.title,
  heroImageKey: updated.heroImageKey ?? null,
  excerpt: updated.excerpt ?? null,        // from Phase 1 earlier
  readingTime: updated.readingTime ?? null // from Phase 1 earlier
}
  // OPTIONAL feed post (don’t fail publish if it errors)
  try {
    await createFeedPost({
          postType: feed_post_type.ARTICLE,
          caption: updated.title ?? 'Untitled',
          imageUrl: updated.heroImageKey ?? undefined,
          content: JSON.stringify(payload),  // ← PostCard reads this
          // If your action supports it, pass the linkage explicitly:
          articleId: updated.id,
        })
  } catch (e) {
    console.error('createFeedPost failed:', (e as any)?.message, e)
    }

  return NextResponse.json({ slug: updated.slug }, { status: 201 })
}