export const dynamic = "force-dynamic";


// import { prisma } from '@/lib/prismaclient'
// import { NextResponse } from 'next/server'
// import { z } from 'zod'


// const CreateArticle = z.object({
//   authorId: z.string(),               // <-- make sure your Prisma model expects string here
//   title: z.string(),
//   slug: z.string(),
//   heroImageKey: z.string().nullable().optional(),
//   template: z.string().default('standard'),
//   astJson: z.unknown(),               // or z.any()
// })

// export async function GET() {
//   const articles = await prisma.article.findMany()
//   return NextResponse.json(articles)
// }

// export async function POST(req: Request) {

//   const data = CreateArticle.parse(await req.json())
//  // If your Prisma model uses a scalar authorId field:
//  const payload: prisma.ArticleUncheckedCreateInput = {
//   authorId: data.authorId,
//   title: data.title,
//   slug: data.slug,
//   heroImageKey: data.heroImageKey ?? null,
//   template: data.template ?? 'standard',
//   astJson: data.astJson as prisma.JsonValue, // <- important
//   status: 'DRAFT',                           // include if required or omit if defaulted
// }


// const article = await prisma.article.create({ data: payload })
// return NextResponse.json({ id: article.id }, { status: 201 })
// }
import { prisma } from '@/lib/prismaclient'
import { NextResponse } from 'next/server'
import { getUserFromCookies } from '@/lib/serverutils'
import { z } from 'zod'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const a = await prisma.article.findUnique({ where: { id: params.id } })
  if (
    !a ||
    !user.userId ||
    a.authorId !== user.userId.toString()
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: a.id,
    title: a.title,
    slug: a.slug,
    status: a.status,
    template: a.template,
    heroImageKey: a.heroImageKey,
    astJson: a.astJson,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  })
}

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  template: z.string().optional(),
  heroImageKey: z.string().nullable().optional(),
})
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies()
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  // ✔ check ownership first
  const a = await prisma.article.findUnique({ where: { id: params.id } })
  if (!a || a.authorId !== user.userId.toString()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.article.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromCookies()
  if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const a = await prisma.article.findUnique({ where: { id: params.id } })
  if (!a || a.authorId !== user.userId.toString())
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const hard = new URL(_req.url).searchParams.get('hard') === '1'
if (hard) {
  await prisma.article.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

  await prisma.article.update({ where: { id: params.id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
