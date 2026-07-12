export const dynamic = "force-dynamic";

// app/api/articles/route.ts

// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prismaclient";


// // (optional) GET for listing all articles
// export async function GET() {
//   const articles = await prisma.article.findMany();
//   return NextResponse.json(articles);
// }
// // POST for creating a new article
import { prisma } from '@/lib/prismaclient'
import { NextResponse } from 'next/server'
import { getUserFromCookies } from '@/lib/serverutils'
import { nanoid } from 'nanoid'
import { z } from 'zod'
export async function GET(req: Request) {
  const user = await getUserFromCookies()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const url = new URL(req.url)
  const page     = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1)
  const pageSize = Math.min(Math.max(parseInt(url.searchParams.get('pageSize') || '20', 10), 1), 100)
  const q        = (url.searchParams.get('q') || '').trim()
  const status   = url.searchParams.get('status') as 'DRAFT' | 'PUBLISHED' | null
  const template = url.searchParams.get('template') || undefined
  const view     = url.searchParams.get('view') || 'active' // 'active' | 'trash'
  const sort     = url.searchParams.get('sort') || 'updatedAt:desc' // field:dir

  const [sortField, sortDir] = sort.split(':') as [string, 'asc'|'desc']
  const orderBy = [{ [sortField || 'updatedAt']: (sortDir === 'asc' ? 'asc' : 'desc') }]

  if (!user.userId) {
    return NextResponse.json({ error: "User ID missing" }, { status: 400 });
  }
  const where: any = {
    authorId: user.userId.toString(),
    deletedAt: view === 'trash' ? { not: null } : null,
    ...(status ? { status } : {}),
    ...(template ? { template } : {}),
    ...(q ? { OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { slug:  { contains: q, mode: 'insensitive' } },
    ] } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where, orderBy, take: pageSize, skip: (page - 1) * pageSize,
      select: { id:true,title:true,slug:true,status:true,createdAt:true,updatedAt:true,heroImageKey:true,template:true },
    })
  ])

  // serialize dates → strings for client components
  const items = rows.map(r => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))

  return NextResponse.json({ items, total, page, pageSize })
}


const CreateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  template: z.string().optional(),
  heroImageKey: z.string().nullable().optional(),
  astJson: z.unknown().optional(),
})

export async function POST(req: Request) {
  try {
    const user = await getUserFromCookies()
    if (!user?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    // tolerate empty body
    const safe = await req.json().catch(() => ({} as unknown))
    const parsed = CreateSchema.safeParse(safe)

    const {
      title = 'Untitled',
      slug = nanoid(),
      template = 'standard',
      heroImageKey = null,
      astJson = { type: 'doc', content: [] },
    } = parsed.success ? parsed.data : {}

    const article = await prisma.article.create({
      data: {
        authorId: user.userId.toString(),   // never trust client for this
        title,
        slug,
        template,
        heroImageKey,
        astJson: astJson as any,
        status: 'DRAFT',
      },
      select: { id: true },
    })

    return NextResponse.json({ id: article.id }, { status: 201 })
  } catch (err) {
    console.error('Error creating article:', err)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}
